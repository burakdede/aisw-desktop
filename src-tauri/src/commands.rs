use crate::bridge::{AiswBridge, CliAiswBridge};
use crate::diagnostic_bundle::{default_output_dir, write_redacted_bundle, DiagnosticBundleExport};
use crate::errors::{DesktopError, DesktopResult, ErrorPayload, GuiErrorKind};
use crate::models::{
    AddOAuthProfileRequest, AddProfileRequest, AppBootstrap, AppSnapshot, BackupEntry,
    DesktopSettings, DoctorReport, InitReport, InstallUpdateReport, LaunchAtLoginStatus,
    MutationResponse, ProjectBindingsReport, RepairReport, RepairRequest, ShellHookGuidance,
    UpdateCheckReport, UpdateSettingsRequest, UseAllProfilesRequest, UseContextRequest,
    UseProfileRequest, VerifyReport, WorkspaceBindRequest, WorkspaceStatusReport,
    WorkspaceUnbindTarget,
};
use crate::shell;
use crate::state::{incompatible_runtime_error, AppState};
use crate::tray;
use crate::updater;
use std::path::{Path, PathBuf};
use std::process::Command;
use tauri::Emitter;

const DEFAULT_ISSUE_TRACKER_URL: &str =
    "https://github.com/issues?q=%22AI+Switch%22+desktop+is%3Aissue";
const MENU_BAR_VISIBILITY_ERROR_MESSAGE: &str =
    "The menu bar icon visibility could not be updated.";
const REFERENCE_DOCUMENT_RESOLUTION_ERROR_MESSAGE: &str =
    "AI Switch could not resolve that reference document.";
const REFERENCE_DOCUMENT_RESOLUTION_REMEDIATION: &str =
    "Choose a supported help action and try again.";
const REFERENCE_DOCUMENT_MISSING_ERROR_MESSAGE: &str =
    "AI Switch could not find the requested reference document.";
#[cfg(target_os = "macos")]
const LAUNCH_AT_LOGIN_ITEM_NAME: &str = "AI Switch";
#[cfg(any(not(target_os = "macos"), test))]
const LAUNCH_AT_LOGIN_UNSUPPORTED_DETAIL: &str =
    "Launch at login is currently available on macOS builds.";
#[cfg(any(not(target_os = "macos"), test))]
const LAUNCH_AT_LOGIN_UNSUPPORTED_MESSAGE: &str =
    "Launch at login is not available on this platform yet.";
#[cfg(any(not(target_os = "macos"), test))]
const LAUNCH_AT_LOGIN_UNSUPPORTED_REMEDIATION: &str =
    "Use a macOS build of AI Switch for this setting.";
#[cfg(any(target_os = "macos", test))]
const MACOS_LOGIN_ITEM_ERROR_MESSAGE: &str = "AI Switch could not update the macOS login item.";

#[tauri::command]
pub async fn get_bootstrap(state: tauri::State<'_, AppState>) -> DesktopResult<AppBootstrap> {
    state.bootstrap().await
}

#[tauri::command]
pub async fn get_snapshot(state: tauri::State<'_, AppState>) -> DesktopResult<AppSnapshot> {
    state.snapshot().await
}

#[tauri::command]
pub async fn get_settings(state: tauri::State<'_, AppState>) -> DesktopResult<DesktopSettings> {
    state.load_settings().await.map_err(ErrorPayload::from)
}

#[tauri::command]
pub async fn open_app_data_folder(state: tauri::State<'_, AppState>) -> DesktopResult<String> {
    let settings = state.load_settings().await.map_err(ErrorPayload::from)?;
    let path = settings
        .aisw_home
        .as_ref()
        .map(PathBuf::from)
        .unwrap_or_else(|| state.app_data_dir());
    std::fs::create_dir_all(&path)
        .map_err(DesktopError::from)
        .map_err(ErrorPayload::from)?;
    open_path_with_default_app(&path)?;
    Ok(path.display().to_string())
}

#[tauri::command]
pub async fn open_reference_document(kind: String) -> DesktopResult<String> {
    let current_dir = std::env::current_dir()
        .map_err(DesktopError::from)
        .map_err(ErrorPayload::from)?;
    let path = reference_document_path(&current_dir, &kind)?;

    if !path.exists() {
        return Err(missing_reference_document_error(&path));
    }

    open_path_with_default_app(&path)?;
    Ok(path.display().to_string())
}

#[tauri::command]
pub async fn open_issue_tracker() -> DesktopResult<String> {
    let url = resolve_issue_tracker_url();

    open_target_with_default_app(&url, "AI Switch could not open the issue tracker.")?;
    Ok(url)
}

#[tauri::command]
pub async fn set_tray_visibility(app: tauri::AppHandle, visible: bool) -> DesktopResult<()> {
    if let Some(tray) = app.tray_by_id("main-tray") {
        tray.set_visible(visible)
            .map_err(|error| command_error(MENU_BAR_VISIBILITY_ERROR_MESSAGE, error.to_string()))?;
    }
    Ok(())
}

#[tauri::command]
pub async fn get_launch_at_login_status(
    app: tauri::AppHandle,
) -> DesktopResult<LaunchAtLoginStatus> {
    launch_at_login_status(&app)
}

#[tauri::command]
pub async fn set_launch_at_login(
    app: tauri::AppHandle,
    enabled: bool,
) -> DesktopResult<LaunchAtLoginStatus> {
    set_launch_at_login_status(&app, enabled)?;
    launch_at_login_status(&app)
}

#[tauri::command]
pub async fn get_shell_guidance() -> DesktopResult<ShellHookGuidance> {
    Ok(shell::shell_hook_guidance())
}

#[tauri::command]
pub async fn check_for_updates(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> DesktopResult<UpdateCheckReport> {
    let settings = state.load_settings().await.map_err(ErrorPayload::from)?;
    updater::check_for_updates(&app, &settings.update_channel)
        .await
        .map_err(ErrorPayload::from)
}

#[tauri::command]
pub async fn install_update(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> DesktopResult<InstallUpdateReport> {
    let settings = state.load_settings().await.map_err(ErrorPayload::from)?;
    updater::install_update(&app, &settings.update_channel)
        .await
        .map_err(ErrorPayload::from)
}

#[tauri::command]
pub async fn update_settings(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    request: UpdateSettingsRequest,
) -> DesktopResult<DesktopSettings> {
    refresh_tray_after(
        &app,
        &state,
        state
            .update_settings(request)
            .await
            .map_err(ErrorPayload::from),
    )
    .await
}

#[tauri::command]
pub async fn add_profile(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    request: AddProfileRequest,
) -> DesktopResult<MutationResponse> {
    ensure_compatible(&state).await?;
    refresh_tray_after(
        &app,
        &state,
        state
            .mutate("add_profile", move |bridge| async move {
                bridge.add_profile(request).await
            })
            .await,
    )
    .await
}

#[tauri::command]
pub async fn add_profile_oauth(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    request: AddOAuthProfileRequest,
) -> DesktopResult<MutationResponse> {
    ensure_compatible(&state).await?;
    let app_handle = app.clone();
    refresh_tray_after(
        &app,
        &state,
        state
            .mutate_cli("add_profile_oauth", move |bridge| async move {
                bridge
                    .add_profile_oauth(request, move |event| {
                        let _ = app_handle.emit("oauth-progress", event);
                    })
                    .await
            })
            .await,
    )
    .await
}

#[tauri::command]
pub async fn use_profile(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    request: UseProfileRequest,
) -> DesktopResult<MutationResponse> {
    ensure_compatible(&state).await?;
    refresh_tray_after(
        &app,
        &state,
        state
            .mutate("use_profile", move |bridge| async move {
                bridge.use_profile(request).await
            })
            .await,
    )
    .await
}

#[tauri::command]
pub async fn use_all_profiles(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    request: UseAllProfilesRequest,
) -> DesktopResult<MutationResponse> {
    ensure_compatible(&state).await?;
    refresh_tray_after(
        &app,
        &state,
        state
            .mutate("use_all_profiles", move |bridge| async move {
                bridge.use_all_profiles(request).await
            })
            .await,
    )
    .await
}

#[tauri::command]
pub async fn use_context(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    request: UseContextRequest,
) -> DesktopResult<MutationResponse> {
    ensure_compatible(&state).await?;
    refresh_tray_after(
        &app,
        &state,
        state
            .mutate("use_context", move |bridge| async move {
                bridge.use_context(request).await
            })
            .await,
    )
    .await
}

#[tauri::command]
pub async fn activate_profile_set(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    name: String,
) -> DesktopResult<MutationResponse> {
    ensure_compatible(&state).await?;
    refresh_tray_after(&app, &state, state.activate_profile_set(&name).await).await
}

#[tauri::command]
pub async fn rename_profile(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    tool: String,
    old_name: String,
    new_name: String,
) -> DesktopResult<MutationResponse> {
    ensure_compatible(&state).await?;
    refresh_tray_after(
        &app,
        &state,
        state
            .mutate("rename_profile", move |bridge| async move {
                bridge.rename_profile(tool, old_name, new_name).await
            })
            .await,
    )
    .await
}

#[tauri::command]
pub async fn remove_profile(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    tool: String,
    profile: String,
    force: bool,
) -> DesktopResult<MutationResponse> {
    ensure_compatible(&state).await?;
    refresh_tray_after(
        &app,
        &state,
        state
            .mutate("remove_profile", move |bridge| async move {
                bridge.remove_profile(tool, profile, force).await
            })
            .await,
    )
    .await
}

#[tauri::command]
pub async fn restore_backup(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    backup_id: String,
) -> DesktopResult<MutationResponse> {
    ensure_compatible(&state).await?;
    refresh_tray_after(
        &app,
        &state,
        state
            .mutate("restore_backup", move |bridge| async move {
                bridge.restore_backup(backup_id).await
            })
            .await,
    )
    .await
}

#[tauri::command]
pub async fn run_doctor(state: tauri::State<'_, AppState>) -> DesktopResult<DoctorReport> {
    make_bridge(&state)
        .await?
        .doctor()
        .await
        .map_err(ErrorPayload::from)
}

#[tauri::command]
pub async fn run_verify(state: tauri::State<'_, AppState>) -> DesktopResult<VerifyReport> {
    make_bridge(&state)
        .await?
        .verify()
        .await
        .map_err(ErrorPayload::from)
}

#[tauri::command]
pub async fn run_repair(
    state: tauri::State<'_, AppState>,
    request: RepairRequest,
) -> DesktopResult<RepairReport> {
    make_bridge(&state)
        .await?
        .repair(request)
        .await
        .map_err(ErrorPayload::from)
}

#[tauri::command]
pub async fn export_diagnostic_bundle(
    state: tauri::State<'_, AppState>,
) -> DesktopResult<DiagnosticBundleExport> {
    let bootstrap = state.bootstrap().await?;
    let snapshot = state.snapshot().await?;
    let settings = state.load_settings().await.map_err(ErrorPayload::from)?;
    let bridge = CliAiswBridge::new(
        settings.runtime_kind.clone(),
        settings.runtime_path.as_ref().map(PathBuf::from),
        settings.aisw_home.as_ref().map(PathBuf::from),
    );
    let doctor = bridge.doctor().await.map_err(ErrorPayload::from)?;
    let verify = bridge.verify().await.map_err(ErrorPayload::from)?;
    let repair_preview = bridge
        .repair(RepairRequest {
            apply: false,
            fixes: Vec::new(),
        })
        .await
        .map_err(ErrorPayload::from)?;
    let backups = bridge.list_backups().await.unwrap_or_default();
    let shell_guidance = shell::shell_hook_guidance();

    let payload = serde_json::json!({
        "app": {
            "name": "AI Switch",
            "version": env!("CARGO_PKG_VERSION"),
            "platform": std::env::consts::OS,
            "arch": std::env::consts::ARCH,
        },
        "generated_at": std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|duration| duration.as_secs())
            .unwrap_or(0),
        "bootstrap": bootstrap,
        "snapshot": snapshot,
        "doctor": doctor,
        "verify": verify,
        "repair_preview": repair_preview,
        "backups": backups,
        "shell_guidance": shell_guidance,
    });

    write_redacted_bundle(&payload, &default_output_dir()).map_err(ErrorPayload::from)
}

#[tauri::command]
pub async fn export_activity_log(contents: String) -> DesktopResult<DiagnosticBundleExport> {
    let output_dir = default_output_dir();
    std::fs::create_dir_all(&output_dir)
        .map_err(DesktopError::from)
        .map_err(ErrorPayload::from)?;
    let generated_at = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or(0);
    let filename = format!("activity-log-{generated_at}.json");
    let path = output_dir.join(&filename);

    tokio::fs::write(&path, contents)
        .await
        .map_err(DesktopError::from)
        .map_err(ErrorPayload::from)?;
    open_path_with_default_app(&path)?;

    Ok(DiagnosticBundleExport {
        path: path.display().to_string(),
        filename,
        generated_at: format!("unix:{generated_at}"),
    })
}

#[tauri::command]
pub async fn list_backups(state: tauri::State<'_, AppState>) -> DesktopResult<Vec<BackupEntry>> {
    make_bridge(&state)
        .await?
        .list_backups()
        .await
        .map_err(ErrorPayload::from)
}

#[tauri::command]
pub async fn run_init(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> DesktopResult<InitReport> {
    refresh_tray_after(&app, &state, state.run_init().await).await
}

#[tauri::command]
pub async fn get_workspace_status(
    state: tauri::State<'_, AppState>,
) -> DesktopResult<WorkspaceStatusReport> {
    make_bridge(&state)
        .await?
        .workspace_status()
        .await
        .map_err(ErrorPayload::from)
}

#[tauri::command]
pub async fn get_project_bindings(
    state: tauri::State<'_, AppState>,
) -> DesktopResult<ProjectBindingsReport> {
    make_bridge(&state)
        .await?
        .project_bindings()
        .await
        .map_err(ErrorPayload::from)
}

#[tauri::command]
pub async fn workspace_bind(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    request: WorkspaceBindRequest,
) -> DesktopResult<MutationResponse> {
    ensure_compatible(&state).await?;
    refresh_tray_after(
        &app,
        &state,
        state
            .mutate("workspace_bind", move |bridge| async move {
                bridge.workspace_bind(request).await
            })
            .await,
    )
    .await
}

#[tauri::command]
pub async fn workspace_unbind(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    target: WorkspaceUnbindTarget,
) -> DesktopResult<MutationResponse> {
    ensure_compatible(&state).await?;
    refresh_tray_after(
        &app,
        &state,
        state
            .mutate("workspace_unbind", move |bridge| async move {
                bridge.workspace_unbind(target).await
            })
            .await,
    )
    .await
}

#[tauri::command]
pub async fn workspace_guard(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    mode: String,
) -> DesktopResult<MutationResponse> {
    ensure_compatible(&state).await?;
    refresh_tray_after(
        &app,
        &state,
        state
            .mutate("workspace_guard", move |bridge| async move {
                bridge.workspace_guard(mode).await
            })
            .await,
    )
    .await
}

async fn ensure_compatible(state: &tauri::State<'_, AppState>) -> DesktopResult<()> {
    let bootstrap = state.bootstrap().await?;
    if bootstrap.runtime_status.compatible {
        Ok(())
    } else {
        Err(incompatible_runtime_error())
    }
}

async fn make_bridge(state: &tauri::State<'_, AppState>) -> DesktopResult<CliAiswBridge> {
    let settings = state.load_settings().await.map_err(ErrorPayload::from)?;
    Ok(CliAiswBridge::new(
        settings.runtime_kind,
        settings.runtime_path.map(PathBuf::from),
        settings.aisw_home.map(PathBuf::from),
    ))
}

async fn refresh_tray_after<T>(
    app: &tauri::AppHandle,
    state: &tauri::State<'_, AppState>,
    result: DesktopResult<T>,
) -> DesktopResult<T> {
    let value = result?;
    let _ = tray::refresh_tray(app, state.inner().clone()).await;
    Ok(value)
}

fn open_path_with_default_app(path: &std::path::Path) -> DesktopResult<()> {
    open_target_with_default_app(
        &path.display().to_string(),
        "AI Switch could not open the selected file.",
    )
}

fn open_target_with_default_app(target: &str, failure_message: &str) -> DesktopResult<()> {
    #[cfg(target_os = "macos")]
    let mut command = {
        let mut command = Command::new("open");
        command.arg(target);
        command
    };

    #[cfg(target_os = "windows")]
    let mut command = {
        let mut command = Command::new("cmd");
        command.args(["/C", "start", "", target]);
        command
    };

    #[cfg(all(not(target_os = "macos"), not(target_os = "windows")))]
    let mut command = {
        let mut command = Command::new("xdg-open");
        command.arg(target);
        command
    };

    command.status().map_err(|error| ErrorPayload {
        kind: GuiErrorKind::Unknown,
        message: failure_message.to_owned(),
        remediation: Some(error.to_string()),
        code: Some("open_failed".to_owned()),
    })?;

    Ok(())
}

fn resolve_issue_tracker_url() -> String {
    std::env::var("AI_SWITCH_DESKTOP_ISSUES_URL")
        .ok()
        .filter(|value| !value.trim().is_empty())
        .or_else(|| {
            std::env::var("AISW_DESKTOP_ISSUES_URL")
                .ok()
                .filter(|value| !value.trim().is_empty())
        })
        .unwrap_or_else(|| DEFAULT_ISSUE_TRACKER_URL.to_owned())
}

fn reference_document_path(current_dir: &Path, kind: &str) -> DesktopResult<PathBuf> {
    match kind {
        "documentation" => Ok(current_dir.join("README.md")),
        "troubleshooting" => Ok(current_dir.join("docs").join("release-runbook.md")),
        _ => Err(command_error(
            REFERENCE_DOCUMENT_RESOLUTION_ERROR_MESSAGE,
            REFERENCE_DOCUMENT_RESOLUTION_REMEDIATION,
        )),
    }
}

fn missing_reference_document_error(path: &Path) -> ErrorPayload {
    command_error(
        REFERENCE_DOCUMENT_MISSING_ERROR_MESSAGE,
        path.display().to_string(),
    )
}

fn command_error(message: &str, remediation: impl Into<String>) -> ErrorPayload {
    ErrorPayload {
        kind: GuiErrorKind::Unknown,
        message: message.to_owned(),
        remediation: Some(remediation.into()),
        code: Some("command_error".to_owned()),
    }
}

#[cfg(any(not(target_os = "macos"), test))]
fn unsupported_launch_at_login_status() -> LaunchAtLoginStatus {
    LaunchAtLoginStatus {
        supported: false,
        enabled: false,
        detail: Some(LAUNCH_AT_LOGIN_UNSUPPORTED_DETAIL.to_owned()),
    }
}

#[cfg(any(not(target_os = "macos"), test))]
fn unsupported_launch_at_login_error() -> ErrorPayload {
    command_error(
        LAUNCH_AT_LOGIN_UNSUPPORTED_MESSAGE,
        LAUNCH_AT_LOGIN_UNSUPPORTED_REMEDIATION,
    )
}

#[cfg(target_os = "macos")]
fn launch_at_login_status(app: &tauri::AppHandle) -> DesktopResult<LaunchAtLoginStatus> {
    let item_name = LAUNCH_AT_LOGIN_ITEM_NAME;
    let target_path = launch_at_login_target_path(app)?;
    let script = format!(
        "tell application \"System Events\" to return exists login item \"{}\"",
        escape_applescript_string(item_name)
    );
    let enabled = run_osascript(&script)?.trim().eq_ignore_ascii_case("true");
    Ok(LaunchAtLoginStatus {
        supported: true,
        enabled,
        detail: Some(format!(
            "macOS login item target: {}",
            target_path.display()
        )),
    })
}

#[cfg(not(target_os = "macos"))]
fn launch_at_login_status(_app: &tauri::AppHandle) -> DesktopResult<LaunchAtLoginStatus> {
    Ok(unsupported_launch_at_login_status())
}

#[cfg(target_os = "macos")]
fn set_launch_at_login_status(app: &tauri::AppHandle, enabled: bool) -> DesktopResult<()> {
    let item_name = LAUNCH_AT_LOGIN_ITEM_NAME;
    let path = escape_applescript_string(&launch_at_login_target_path(app)?.display().to_string());
    let item_name = escape_applescript_string(item_name);
    let script = launch_at_login_script(&item_name, &path, enabled);

    run_osascript(&script).map(|_| ())
}

#[cfg(not(target_os = "macos"))]
fn set_launch_at_login_status(_app: &tauri::AppHandle, _enabled: bool) -> DesktopResult<()> {
    Err(unsupported_launch_at_login_error())
}

#[cfg(target_os = "macos")]
fn launch_at_login_target_path(_app: &tauri::AppHandle) -> DesktopResult<PathBuf> {
    let executable = std::env::current_exe()
        .map_err(DesktopError::from)
        .map_err(ErrorPayload::from)?;
    for ancestor in executable.ancestors() {
        if ancestor.extension().and_then(|value| value.to_str()) == Some("app") {
            return Ok(ancestor.to_path_buf());
        }
    }
    Ok(executable)
}

#[cfg(target_os = "macos")]
fn run_osascript(script: &str) -> DesktopResult<String> {
    let output = Command::new("osascript")
        .arg("-e")
        .arg(script)
        .output()
        .map_err(|error| command_error(MACOS_LOGIN_ITEM_ERROR_MESSAGE, error.to_string()))?;

    if !output.status.success() {
        return Err(command_error(
            MACOS_LOGIN_ITEM_ERROR_MESSAGE,
            String::from_utf8_lossy(&output.stderr).trim().to_owned(),
        ));
    }

    Ok(String::from_utf8_lossy(&output.stdout).trim().to_owned())
}

#[cfg(target_os = "macos")]
fn launch_at_login_script(item_name: &str, path: &str, enabled: bool) -> String {
    if enabled {
        format!(
            "tell application \"System Events\"\n\
             if exists login item \"{item_name}\" then\n\
             set properties of login item \"{item_name}\" to {{path:\"{path}\", hidden:false}}\n\
             else\n\
             make login item at end with properties {{name:\"{item_name}\", path:\"{path}\", hidden:false}}\n\
             end if\n\
             end tell"
        )
    } else {
        format!(
            "tell application \"System Events\"\n\
             if exists login item \"{item_name}\" then\n\
             delete login item \"{item_name}\"\n\
             end if\n\
             end tell"
        )
    }
}

#[cfg(target_os = "macos")]
fn escape_applescript_string(value: &str) -> String {
    value.replace('\\', "\\\\").replace('"', "\\\"")
}

#[cfg(test)]
mod tests {
    #[cfg(target_os = "macos")]
    use super::launch_at_login_script;
    use super::{
        command_error, missing_reference_document_error, reference_document_path,
        resolve_issue_tracker_url, unsupported_launch_at_login_error,
        unsupported_launch_at_login_status, DEFAULT_ISSUE_TRACKER_URL,
        LAUNCH_AT_LOGIN_UNSUPPORTED_DETAIL, LAUNCH_AT_LOGIN_UNSUPPORTED_MESSAGE,
        LAUNCH_AT_LOGIN_UNSUPPORTED_REMEDIATION, MACOS_LOGIN_ITEM_ERROR_MESSAGE,
        REFERENCE_DOCUMENT_MISSING_ERROR_MESSAGE, REFERENCE_DOCUMENT_RESOLUTION_ERROR_MESSAGE,
        REFERENCE_DOCUMENT_RESOLUTION_REMEDIATION,
    };
    use crate::errors::GuiErrorKind;
    use std::path::Path;
    use std::sync::Mutex;

    static ISSUE_TRACKER_ENV_LOCK: Mutex<()> = Mutex::new(());

    #[test]
    fn issue_tracker_prefers_primary_env_override() {
        let _guard = ISSUE_TRACKER_ENV_LOCK.lock().unwrap();
        let primary_key = "AI_SWITCH_DESKTOP_ISSUES_URL";
        let legacy_key = "AISW_DESKTOP_ISSUES_URL";
        let primary_previous = std::env::var(primary_key).ok();
        let legacy_previous = std::env::var(legacy_key).ok();

        std::env::set_var(primary_key, "https://example.com/primary");
        std::env::set_var(legacy_key, "https://example.com/legacy");

        assert_eq!(resolve_issue_tracker_url(), "https://example.com/primary");

        restore_env(primary_key, primary_previous);
        restore_env(legacy_key, legacy_previous);
    }

    #[test]
    fn issue_tracker_uses_legacy_env_override_when_primary_is_missing() {
        let _guard = ISSUE_TRACKER_ENV_LOCK.lock().unwrap();
        let primary_key = "AI_SWITCH_DESKTOP_ISSUES_URL";
        let legacy_key = "AISW_DESKTOP_ISSUES_URL";
        let primary_previous = std::env::var(primary_key).ok();
        let legacy_previous = std::env::var(legacy_key).ok();

        std::env::remove_var(primary_key);
        std::env::set_var(legacy_key, "https://example.com/legacy");

        assert_eq!(resolve_issue_tracker_url(), "https://example.com/legacy");

        restore_env(primary_key, primary_previous);
        restore_env(legacy_key, legacy_previous);
    }

    #[test]
    fn issue_tracker_falls_back_to_default_search_url() {
        let _guard = ISSUE_TRACKER_ENV_LOCK.lock().unwrap();
        let primary_key = "AI_SWITCH_DESKTOP_ISSUES_URL";
        let legacy_key = "AISW_DESKTOP_ISSUES_URL";
        let primary_previous = std::env::var(primary_key).ok();
        let legacy_previous = std::env::var(legacy_key).ok();

        std::env::remove_var(primary_key);
        std::env::remove_var(legacy_key);

        assert_eq!(resolve_issue_tracker_url(), DEFAULT_ISSUE_TRACKER_URL);

        restore_env(primary_key, primary_previous);
        restore_env(legacy_key, legacy_previous);
    }

    #[test]
    fn reference_document_paths_follow_supported_kinds() {
        let root = Path::new("/tmp/aisw-desktop");
        assert_eq!(
            reference_document_path(root, "documentation").unwrap(),
            root.join("README.md")
        );
        assert_eq!(
            reference_document_path(root, "troubleshooting").unwrap(),
            root.join("docs").join("release-runbook.md")
        );
    }

    #[test]
    fn unsupported_reference_document_reports_shared_guidance() {
        let error = reference_document_path(Path::new("/tmp/aisw-desktop"), "unknown")
            .expect_err("expected unsupported reference document kind to fail");

        assert!(matches!(error.kind, GuiErrorKind::Unknown));
        assert_eq!(error.message, REFERENCE_DOCUMENT_RESOLUTION_ERROR_MESSAGE);
        assert_eq!(
            error.remediation.as_deref(),
            Some(REFERENCE_DOCUMENT_RESOLUTION_REMEDIATION)
        );
    }

    #[test]
    fn missing_reference_document_reports_requested_path() {
        let path = Path::new("/tmp/aisw-desktop/docs/missing.md");
        let error = missing_reference_document_error(path);

        assert!(matches!(error.kind, GuiErrorKind::Unknown));
        assert_eq!(error.message, REFERENCE_DOCUMENT_MISSING_ERROR_MESSAGE);
        assert_eq!(
            error.remediation.as_deref(),
            Some(path.to_string_lossy().as_ref())
        );
    }

    #[test]
    fn command_error_wraps_message_and_remediation() {
        let error = command_error(MACOS_LOGIN_ITEM_ERROR_MESSAGE, "stderr");

        assert!(matches!(error.kind, GuiErrorKind::Unknown));
        assert_eq!(error.message, MACOS_LOGIN_ITEM_ERROR_MESSAGE);
        assert_eq!(error.remediation.as_deref(), Some("stderr"));
    }

    #[test]
    fn launch_at_login_fallbacks_share_copy() {
        let status = unsupported_launch_at_login_status();
        assert!(!status.supported);
        assert!(!status.enabled);
        assert_eq!(
            status.detail.as_deref(),
            Some(LAUNCH_AT_LOGIN_UNSUPPORTED_DETAIL)
        );

        let error = unsupported_launch_at_login_error();
        assert!(matches!(error.kind, GuiErrorKind::Unknown));
        assert_eq!(error.message, LAUNCH_AT_LOGIN_UNSUPPORTED_MESSAGE);
        assert_eq!(
            error.remediation.as_deref(),
            Some(LAUNCH_AT_LOGIN_UNSUPPORTED_REMEDIATION)
        );
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn launch_at_login_scripts_share_the_item_name_logic() {
        let enabled = launch_at_login_script("AI Switch", "/Applications/AI Switcher.app", true);
        assert!(enabled.contains("exists login item \"AI Switch\""));
        assert!(enabled.contains("path:\"/Applications/AI Switcher.app\""));
        assert!(enabled.contains("make login item at end"));

        let disabled = launch_at_login_script("AI Switch", "/Applications/AI Switcher.app", false);
        assert!(disabled.contains("delete login item \"AI Switch\""));
        assert!(!disabled.contains("make login item at end"));
    }

    fn restore_env(key: &str, value: Option<String>) {
        if let Some(value) = value {
            std::env::set_var(key, value);
        } else {
            std::env::remove_var(key);
        }
    }
}
