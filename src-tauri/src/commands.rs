use crate::bridge::{AiswBridge, CliAiswBridge};
use crate::diagnostic_bundle::{default_output_dir, write_redacted_bundle, DiagnosticBundleExport};
use crate::errors::{DesktopError, DesktopResult, ErrorPayload, GuiErrorKind};
use crate::models::{
    AddOAuthProfileRequest, AddProfileRequest, AppBootstrap, AppSnapshot, BackupEntry,
    DesktopSettings, DoctorReport, InitReport, InstallUpdateReport, LaunchAtLoginStatus,
    MutationResponse,
    ProjectBindingsReport, RepairReport, RepairRequest, ShellHookGuidance, UpdateCheckReport,
    UpdateSettingsRequest, UseAllProfilesRequest, UseContextRequest, UseProfileRequest,
    VerifyReport, WorkspaceBindRequest, WorkspaceStatusReport, WorkspaceUnbindTarget,
};
use crate::shell;
use crate::state::{incompatible_runtime_error, AppState};
use crate::tray;
use crate::updater;
use std::path::PathBuf;
use std::process::Command;
use tauri::Emitter;

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
pub async fn open_app_data_folder(
    state: tauri::State<'_, AppState>,
) -> DesktopResult<String> {
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
    let current_dir = std::env::current_dir().map_err(DesktopError::from).map_err(ErrorPayload::from)?;
    let path = match kind.as_str() {
        "documentation" => current_dir.join("README.md"),
        "troubleshooting" => current_dir.join("docs").join("release-runbook.md"),
        _ => {
            return Err(ErrorPayload {
                kind: GuiErrorKind::Unknown,
                message: "AI Switch could not resolve that reference document.".to_owned(),
                remediation: Some("Choose a supported help action and try again.".to_owned()),
            });
        }
    };

    if !path.exists() {
        return Err(ErrorPayload {
            kind: GuiErrorKind::Unknown,
            message: "AI Switch could not find the requested reference document.".to_owned(),
            remediation: Some(path.display().to_string()),
        });
    }

    open_path_with_default_app(&path)?;
    Ok(path.display().to_string())
}

#[tauri::command]
pub async fn open_issue_tracker() -> DesktopResult<String> {
    let url = std::env::var("AI_SWITCH_DESKTOP_ISSUES_URL")
        .ok()
        .or_else(|| std::env::var("AISW_DESKTOP_ISSUES_URL").ok())
        .ok_or_else(|| ErrorPayload {
            kind: GuiErrorKind::Unknown,
            message: "AI Switch does not have an issue tracker URL configured in this build.".to_owned(),
            remediation: Some(
                "Set AI_SWITCH_DESKTOP_ISSUES_URL for this build or export a support report instead."
                    .to_owned(),
            ),
        })?;

    open_target_with_default_app(&url, "AI Switch could not open the issue tracker.")?;
    Ok(url)
}

#[tauri::command]
pub async fn set_tray_visibility(app: tauri::AppHandle, visible: bool) -> DesktopResult<()> {
    if let Some(tray) = app.tray_by_id("main-tray") {
        tray.set_visible(visible).map_err(|error| ErrorPayload {
            kind: GuiErrorKind::Unknown,
            message: "The menu bar icon visibility could not be updated.".to_owned(),
            remediation: Some(error.to_string()),
        })?;
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
    let settings = state
        .update_settings(request)
        .await
        .map_err(ErrorPayload::from)?;
    let _ = tray::refresh_tray(&app, state.inner().clone()).await;
    Ok(settings)
}

#[tauri::command]
pub async fn add_profile(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    request: AddProfileRequest,
) -> DesktopResult<MutationResponse> {
    ensure_compatible(&state).await?;
    let result = state
        .mutate("add_profile", move |bridge| async move {
            bridge.add_profile(request).await
        })
        .await?;
    let _ = tray::refresh_tray(&app, state.inner().clone()).await;
    Ok(result)
}

#[tauri::command]
pub async fn add_profile_oauth(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    request: AddOAuthProfileRequest,
) -> DesktopResult<MutationResponse> {
    ensure_compatible(&state).await?;
    let app_handle = app.clone();
    let result = state
        .mutate_cli("add_profile_oauth", move |bridge| async move {
            bridge
                .add_profile_oauth(request, move |event| {
                    let _ = app_handle.emit("oauth-progress", event);
                })
                .await
        })
        .await?;
    let _ = tray::refresh_tray(&app, state.inner().clone()).await;
    Ok(result)
}

#[tauri::command]
pub async fn use_profile(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    request: UseProfileRequest,
) -> DesktopResult<MutationResponse> {
    ensure_compatible(&state).await?;
    let result = state
        .mutate("use_profile", move |bridge| async move {
            bridge.use_profile(request).await
        })
        .await?;
    let _ = tray::refresh_tray(&app, state.inner().clone()).await;
    Ok(result)
}

#[tauri::command]
pub async fn use_all_profiles(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    request: UseAllProfilesRequest,
) -> DesktopResult<MutationResponse> {
    ensure_compatible(&state).await?;
    let result = state
        .mutate("use_all_profiles", move |bridge| async move {
            bridge.use_all_profiles(request).await
        })
        .await?;
    let _ = tray::refresh_tray(&app, state.inner().clone()).await;
    Ok(result)
}

#[tauri::command]
pub async fn use_context(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    request: UseContextRequest,
) -> DesktopResult<MutationResponse> {
    ensure_compatible(&state).await?;
    let result = state
        .mutate("use_context", move |bridge| async move {
            bridge.use_context(request).await
        })
        .await?;
    let _ = tray::refresh_tray(&app, state.inner().clone()).await;
    Ok(result)
}

#[tauri::command]
pub async fn activate_profile_set(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    name: String,
) -> DesktopResult<MutationResponse> {
    ensure_compatible(&state).await?;
    let result = state.activate_profile_set(&name).await?;
    let _ = tray::refresh_tray(&app, state.inner().clone()).await;
    Ok(result)
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
    let result = state
        .mutate("rename_profile", move |bridge| async move {
            bridge.rename_profile(tool, old_name, new_name).await
        })
        .await?;
    let _ = tray::refresh_tray(&app, state.inner().clone()).await;
    Ok(result)
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
    let result = state
        .mutate("remove_profile", move |bridge| async move {
            bridge.remove_profile(tool, profile, force).await
        })
        .await?;
    let _ = tray::refresh_tray(&app, state.inner().clone()).await;
    Ok(result)
}

#[tauri::command]
pub async fn restore_backup(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    backup_id: String,
) -> DesktopResult<MutationResponse> {
    ensure_compatible(&state).await?;
    let result = state
        .mutate("restore_backup", move |bridge| async move {
            bridge.restore_backup(backup_id).await
        })
        .await?;
    let _ = tray::refresh_tray(&app, state.inner().clone()).await;
    Ok(result)
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
    let result = state.run_init().await?;
    let _ = tray::refresh_tray(&app, state.inner().clone()).await;
    Ok(result)
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
    let result = state
        .mutate("workspace_bind", move |bridge| async move {
            bridge.workspace_bind(request).await
        })
        .await?;
    let _ = tray::refresh_tray(&app, state.inner().clone()).await;
    Ok(result)
}

#[tauri::command]
pub async fn workspace_unbind(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    target: WorkspaceUnbindTarget,
) -> DesktopResult<MutationResponse> {
    ensure_compatible(&state).await?;
    let result = state
        .mutate("workspace_unbind", move |bridge| async move {
            bridge.workspace_unbind(target).await
        })
        .await?;
    let _ = tray::refresh_tray(&app, state.inner().clone()).await;
    Ok(result)
}

#[tauri::command]
pub async fn workspace_guard(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    mode: String,
) -> DesktopResult<MutationResponse> {
    ensure_compatible(&state).await?;
    let result = state
        .mutate("workspace_guard", move |bridge| async move {
            bridge.workspace_guard(mode).await
        })
        .await?;
    let _ = tray::refresh_tray(&app, state.inner().clone()).await;
    Ok(result)
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
    })?;

    Ok(())
}

#[cfg(target_os = "macos")]
fn launch_at_login_status(app: &tauri::AppHandle) -> DesktopResult<LaunchAtLoginStatus> {
    let item_name = "AI Switch";
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
    Ok(LaunchAtLoginStatus {
        supported: false,
        enabled: false,
        detail: Some("Launch at login is currently available on macOS builds.".to_owned()),
    })
}

#[cfg(target_os = "macos")]
fn set_launch_at_login_status(app: &tauri::AppHandle, enabled: bool) -> DesktopResult<()> {
    let item_name = "AI Switch";
    let path = escape_applescript_string(&launch_at_login_target_path(app)?.display().to_string());
    let item_name = escape_applescript_string(item_name);
    let script = if enabled {
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
    };

    run_osascript(&script).map(|_| ())
}

#[cfg(not(target_os = "macos"))]
fn set_launch_at_login_status(_app: &tauri::AppHandle, _enabled: bool) -> DesktopResult<()> {
    Err(ErrorPayload {
        kind: GuiErrorKind::Unknown,
        message: "Launch at login is not available on this platform yet.".to_owned(),
        remediation: Some("Use a macOS build of AI Switch for this setting.".to_owned()),
    })
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
        .map_err(|error| ErrorPayload {
            kind: GuiErrorKind::Unknown,
            message: "AI Switch could not update the macOS login item.".to_owned(),
            remediation: Some(error.to_string()),
        })?;

    if !output.status.success() {
        return Err(ErrorPayload {
            kind: GuiErrorKind::Unknown,
            message: "AI Switch could not update the macOS login item.".to_owned(),
            remediation: Some(
                String::from_utf8_lossy(&output.stderr).trim().to_owned(),
            ),
        });
    }

    Ok(String::from_utf8_lossy(&output.stdout).trim().to_owned())
}

#[cfg(target_os = "macos")]
fn escape_applescript_string(value: &str) -> String {
    value.replace('\\', "\\\\").replace('"', "\\\"")
}
