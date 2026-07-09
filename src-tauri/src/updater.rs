use crate::errors::{DesktopError, GuiErrorKind};
use crate::models::{InstallUpdateReport, UpdateCheckReport, UpdateInfo};
use tauri::{AppHandle, Runtime};
use tauri_plugin_updater::UpdaterExt;
use url::Url;

const GENERIC_ENDPOINT_ENV: &str = "AISW_DESKTOP_UPDATER_ENDPOINT";
const PUBKEY_ENV: &str = "AISW_DESKTOP_UPDATER_PUBKEY";

#[derive(Debug, Clone, PartialEq, Eq)]
struct UpdaterConfig {
    channel: String,
    endpoint: Url,
    pubkey: String,
}

pub async fn check_for_updates<R: Runtime>(
    app: &AppHandle<R>,
    channel: &str,
) -> Result<UpdateCheckReport, DesktopError> {
    let current_version = app.package_info().version.to_string();
    let Some(config) = resolve_updater_config(channel)? else {
        return Ok(UpdateCheckReport {
            configured: false,
            channel: channel.to_owned(),
            current_version,
            endpoint: None,
            update: None,
            message: Some(
                "Updater is not configured for this build. Set AISW_DESKTOP_UPDATER_ENDPOINT[_CHANNEL] and AISW_DESKTOP_UPDATER_PUBKEY."
                    .to_owned(),
            ),
        });
    };

    let updater = build_updater(app, &config)?;
    let update = updater.check().await.map_err(map_updater_error)?;

    Ok(UpdateCheckReport {
        configured: true,
        channel: config.channel,
        current_version,
        endpoint: Some(config.endpoint.to_string()),
        update: update.map(|item| UpdateInfo {
            version: item.version,
            current_version: item.current_version,
            target: item.target,
            notes: item.body,
        }),
        message: None,
    })
}

pub async fn install_update<R: Runtime>(
    app: &AppHandle<R>,
    channel: &str,
) -> Result<InstallUpdateReport, DesktopError> {
    let current_version = app.package_info().version.to_string();
    let Some(config) = resolve_updater_config(channel)? else {
        return Ok(InstallUpdateReport {
            configured: false,
            channel: channel.to_owned(),
            current_version,
            installed_version: None,
            restart_requested: false,
            message: Some(
                "Updater is not configured for this build. Set AISW_DESKTOP_UPDATER_ENDPOINT[_CHANNEL] and AISW_DESKTOP_UPDATER_PUBKEY."
                    .to_owned(),
            ),
        });
    };

    let updater = build_updater(app, &config)?;
    let update = updater.check().await.map_err(map_updater_error)?;

    let Some(update) = update else {
        return Ok(InstallUpdateReport {
            configured: true,
            channel: config.channel,
            current_version,
            installed_version: None,
            restart_requested: false,
            message: Some("No update is currently available.".to_owned()),
        });
    };

    let installed_version = update.version.clone();
    update
        .download_and_install(|_, _| {}, || {})
        .await
        .map_err(map_updater_error)?;
    app.request_restart();

    Ok(InstallUpdateReport {
        configured: true,
        channel: config.channel,
        current_version,
        installed_version: Some(installed_version),
        restart_requested: true,
        message: Some("Update installed. Restart has been requested.".to_owned()),
    })
}

fn build_updater<R: Runtime>(
    app: &AppHandle<R>,
    config: &UpdaterConfig,
) -> Result<tauri_plugin_updater::Updater, DesktopError> {
    app.updater_builder()
        .pubkey(config.pubkey.clone())
        .endpoints(vec![config.endpoint.clone()])
        .map_err(map_updater_error)?
        .build()
        .map_err(map_updater_error)
}

fn resolve_updater_config(channel: &str) -> Result<Option<UpdaterConfig>, DesktopError> {
    resolve_updater_config_from(channel, |key| std::env::var(key).ok())
}

fn resolve_updater_config_from<F>(
    channel: &str,
    get_var: F,
) -> Result<Option<UpdaterConfig>, DesktopError>
where
    F: Fn(&str) -> Option<String>,
{
    let endpoint_var = format!(
        "AISW_DESKTOP_UPDATER_ENDPOINT_{}",
        channel.to_ascii_uppercase()
    );
    let endpoint_raw = get_var(&endpoint_var).or_else(|| get_var(GENERIC_ENDPOINT_ENV));
    let pubkey = get_var(PUBKEY_ENV);

    let (Some(endpoint_raw), Some(pubkey)) = (endpoint_raw, pubkey) else {
        return Ok(None);
    };

    let endpoint = Url::parse(&endpoint_raw).map_err(|error| DesktopError::CommandFailed {
        command: "desktop_updater".to_owned(),
        kind: GuiErrorKind::Unknown,
        message: format!("Updater endpoint is invalid: {error}"),
        remediation: Some(
            "Set AISW_DESKTOP_UPDATER_ENDPOINT[_CHANNEL] to a valid HTTPS URL.".to_owned(),
        ),
    })?;

    Ok(Some(UpdaterConfig {
        channel: channel.to_owned(),
        endpoint,
        pubkey,
    }))
}

fn map_updater_error(error: tauri_plugin_updater::Error) -> DesktopError {
    DesktopError::CommandFailed {
        command: "desktop_updater".to_owned(),
        kind: GuiErrorKind::Unknown,
        message: format!("Desktop update failed: {error}"),
        remediation: Some(
            "Verify the updater endpoint, signing key, and generated updater artifacts for this release."
                .to_owned(),
        ),
    }
}

#[cfg(test)]
mod tests {
    use super::{resolve_updater_config_from, GENERIC_ENDPOINT_ENV, PUBKEY_ENV};
    use std::collections::HashMap;

    #[test]
    fn returns_none_without_required_env() {
        let env = HashMap::<String, String>::new();
        let config = resolve_updater_config_from("stable", |key| env.get(key).cloned()).unwrap();
        assert!(config.is_none());
    }

    #[test]
    fn prefers_channel_specific_endpoint() {
        let env = HashMap::from([
            (
                GENERIC_ENDPOINT_ENV.to_owned(),
                "https://updates.example.com/generic.json".to_owned(),
            ),
            (
                "AISW_DESKTOP_UPDATER_ENDPOINT_BETA".to_owned(),
                "https://updates.example.com/beta.json".to_owned(),
            ),
            (PUBKEY_ENV.to_owned(), "pubkey".to_owned()),
        ]);
        let config = resolve_updater_config_from("beta", |key| env.get(key).cloned())
            .unwrap()
            .unwrap();
        assert_eq!(
            config.endpoint.as_str(),
            "https://updates.example.com/beta.json"
        );
    }

    #[test]
    fn rejects_invalid_endpoint() {
        let env = HashMap::from([
            (
                "AISW_DESKTOP_UPDATER_ENDPOINT_STABLE".to_owned(),
                "not-a-url".to_owned(),
            ),
            (PUBKEY_ENV.to_owned(), "pubkey".to_owned()),
        ]);
        let error = resolve_updater_config_from("stable", |key| env.get(key).cloned()).unwrap_err();
        assert!(error.to_string().contains("desktop_updater"));
    }
}
