use crate::errors::{DesktopError, GuiErrorKind};
use crate::models::{InstallUpdateReport, UpdateCheckReport, UpdateInfo};
use serde_json::Value;
use tauri::{AppHandle, Runtime};
use tauri_plugin_updater::UpdaterExt;
use url::Url;

const GENERIC_ENDPOINT_ENV: &str = "AISW_DESKTOP_UPDATER_ENDPOINT";
const PUBKEY_ENV: &str = "AISW_DESKTOP_UPDATER_PUBKEY";

#[derive(Debug, Clone, PartialEq, Eq)]
struct UpdaterConfig {
    channel: String,
    endpoint: Url,
    pubkey_override: Option<String>,
}

pub async fn check_for_updates<R: Runtime>(
    app: &AppHandle<R>,
    channel: &str,
) -> Result<UpdateCheckReport, DesktopError> {
    let current_version = app.package_info().version.to_string();
    let Some(config) = resolve_updater_config(app, channel)? else {
        return Ok(UpdateCheckReport {
            configured: false,
            channel: channel.to_owned(),
            current_version,
            endpoint: None,
            update: None,
            message: Some(
                "Updates are not configured for this desktop build yet.".to_owned(),
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
    let Some(config) = resolve_updater_config(app, channel)? else {
        return Ok(InstallUpdateReport {
            configured: false,
            channel: channel.to_owned(),
            current_version,
            installed_version: None,
            restart_requested: false,
            message: Some(
                "Updates are not configured for this desktop build yet.".to_owned(),
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
    let mut builder = app.updater_builder();
    if let Some(pubkey) = &config.pubkey_override {
        builder = builder.pubkey(pubkey.clone());
    }
    builder
        .endpoints(vec![config.endpoint.clone()])
        .map_err(map_updater_error)?
        .build()
        .map_err(map_updater_error)
}

fn resolve_updater_config<R: Runtime>(
    app: &AppHandle<R>,
    channel: &str,
) -> Result<Option<UpdaterConfig>, DesktopError> {
    let plugin_config = app.config().plugins.0.get("updater");
    resolve_updater_config_from(channel, |key| std::env::var(key).ok(), plugin_config)
}

fn resolve_updater_config_from<F>(
    channel: &str,
    get_var: F,
    plugin_config: Option<&Value>,
) -> Result<Option<UpdaterConfig>, DesktopError>
where
    F: Fn(&str) -> Option<String>,
{
    let endpoint_raw = resolve_endpoint(channel, &get_var, plugin_config);
    let pubkey_override = get_var(PUBKEY_ENV);

    let Some(endpoint_raw) = endpoint_raw else {
        return Ok(None);
    };

    let endpoint = Url::parse(&endpoint_raw).map_err(|error| DesktopError::CommandFailed {
        command: "desktop_updater".to_owned(),
        kind: GuiErrorKind::Unknown,
        message: format!("Updater endpoint is invalid: {error}"),
        remediation: Some(
            "Configure this desktop build with a valid HTTPS update feed before checking for updates."
                .to_owned(),
        ),
    })?;
    if endpoint.scheme() != "https" {
        return Err(DesktopError::CommandFailed {
            command: "desktop_updater".to_owned(),
            kind: GuiErrorKind::Unknown,
            message: format!(
                "Updater endpoint is invalid: expected https:// URL, got {}://",
                endpoint.scheme()
            ),
            remediation: Some(
                "Configure this desktop build with a valid HTTPS update feed before checking for updates."
                    .to_owned(),
            ),
        });
    }

    Ok(Some(UpdaterConfig {
        channel: channel.to_owned(),
        endpoint,
        pubkey_override,
    }))
}

fn resolve_endpoint<F>(
    channel: &str,
    get_var: &F,
    plugin_config: Option<&Value>,
) -> Option<String>
where
    F: Fn(&str) -> Option<String>,
{
    let endpoint_var = format!(
        "AISW_DESKTOP_UPDATER_ENDPOINT_{}",
        channel.to_ascii_uppercase()
    );
    if let Some(endpoint) = get_var(&endpoint_var) {
        return Some(endpoint);
    }
    if let Some(endpoint) = get_var(GENERIC_ENDPOINT_ENV) {
        return Some(endpoint);
    }

    let plugin_config = plugin_config?;
    plugin_config
        .get("channels")
        .and_then(Value::as_object)
        .and_then(|channels| channels.get(channel))
        .and_then(Value::as_str)
        .map(ToOwned::to_owned)
        .or_else(|| {
            plugin_config
                .get("endpoints")
                .and_then(Value::as_array)
                .and_then(|endpoints| endpoints.first())
                .and_then(Value::as_str)
                .map(ToOwned::to_owned)
        })
}

fn map_updater_error(error: tauri_plugin_updater::Error) -> DesktopError {
    DesktopError::CommandFailed {
        command: "desktop_updater".to_owned(),
        kind: GuiErrorKind::Unknown,
        message: format!("Desktop update failed: {error}"),
        remediation: Some(
            "Check the signed update channel, signing key, and release artifacts for this desktop build."
                .to_owned(),
        ),
    }
}

#[cfg(test)]
mod tests {
    use super::{resolve_updater_config_from, GENERIC_ENDPOINT_ENV, PUBKEY_ENV};
    use crate::errors::DesktopError;
    use serde_json::json;
    use std::collections::HashMap;

    #[test]
    fn returns_none_without_required_env() {
        let env = HashMap::<String, String>::new();
        let config =
            resolve_updater_config_from("stable", |key| env.get(key).cloned(), None).unwrap();
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
        ]);
        let plugin_config = json!({
            "channels": {
                "beta": "https://releases.example.com/beta.json"
            },
            "pubkey": "configured-pubkey"
        });
        let config = resolve_updater_config_from(
            "beta",
            |key| env.get(key).cloned(),
            Some(&plugin_config),
        )
            .unwrap()
            .unwrap();
        assert_eq!(
            config.endpoint.as_str(),
            "https://updates.example.com/beta.json"
        );
        assert!(config.pubkey_override.is_none());
    }

    #[test]
    fn uses_plugin_channel_config_when_env_is_absent() {
        let env = HashMap::<String, String>::new();
        let plugin_config = json!({
            "channels": {
                "beta": "https://releases.example.com/beta.json"
            },
            "pubkey": "configured-pubkey"
        });
        let config = resolve_updater_config_from(
            "beta",
            |key| env.get(key).cloned(),
            Some(&plugin_config),
        )
        .unwrap()
        .unwrap();
        assert_eq!(config.endpoint.as_str(), "https://releases.example.com/beta.json");
        assert!(config.pubkey_override.is_none());
    }

    #[test]
    fn falls_back_to_plugin_generic_endpoint() {
        let env = HashMap::<String, String>::new();
        let plugin_config = json!({
            "endpoints": ["https://releases.example.com/stable.json"],
            "pubkey": "configured-pubkey"
        });
        let config = resolve_updater_config_from(
            "stable",
            |key| env.get(key).cloned(),
            Some(&plugin_config),
        )
        .unwrap()
        .unwrap();
        assert_eq!(
            config.endpoint.as_str(),
            "https://releases.example.com/stable.json"
        );
    }

    #[test]
    fn rejects_invalid_endpoint() {
        let env = HashMap::from([
            (
                "AISW_DESKTOP_UPDATER_ENDPOINT_STABLE".to_owned(),
                "not-a-url".to_owned(),
            ),
        ]);
        let error = resolve_updater_config_from("stable", |key| env.get(key).cloned(), None)
            .unwrap_err();
        assert!(error.to_string().contains("desktop_updater"));
    }

    #[test]
    fn rejects_invalid_plugin_endpoint() {
        let env = HashMap::<String, String>::new();
        let plugin_config = json!({
            "channels": {
                "stable": "not-a-url"
            },
            "pubkey": "configured-pubkey"
        });
        let error = resolve_updater_config_from(
            "stable",
            |key| env.get(key).cloned(),
            Some(&plugin_config),
        )
        .unwrap_err();
        assert!(error.to_string().contains("desktop_updater"));
    }

    #[test]
    fn rejects_non_https_env_endpoint() {
        let env = HashMap::from([(
            "AISW_DESKTOP_UPDATER_ENDPOINT_STABLE".to_owned(),
            "http://updates.example.com/stable.json".to_owned(),
        )]);
        let error = resolve_updater_config_from("stable", |key| env.get(key).cloned(), None)
            .unwrap_err();
        match error {
            DesktopError::CommandFailed { message, .. } => {
                assert!(message.contains("expected https:// URL"));
            }
            other => panic!("expected command failure, got {other:?}"),
        }
    }

    #[test]
    fn rejects_non_https_plugin_endpoint() {
        let env = HashMap::<String, String>::new();
        let plugin_config = json!({
            "channels": {
                "stable": "http://releases.example.com/stable.json"
            },
            "pubkey": "configured-pubkey"
        });
        let error = resolve_updater_config_from(
            "stable",
            |key| env.get(key).cloned(),
            Some(&plugin_config),
        )
        .unwrap_err();
        match error {
            DesktopError::CommandFailed { message, .. } => {
                assert!(message.contains("expected https:// URL"));
            }
            other => panic!("expected command failure, got {other:?}"),
        }
    }

    #[test]
    fn uses_env_pubkey_override_when_present() {
        let env = HashMap::from([
            (
                GENERIC_ENDPOINT_ENV.to_owned(),
                "https://updates.example.com/generic.json".to_owned(),
            ),
            (PUBKEY_ENV.to_owned(), "override-pubkey".to_owned()),
        ]);
        let config = resolve_updater_config_from("stable", |key| env.get(key).cloned(), None)
            .unwrap()
            .unwrap();
        assert_eq!(config.pubkey_override.as_deref(), Some("override-pubkey"));
    }
}
