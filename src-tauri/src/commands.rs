use crate::bridge::{AiswBridge, CliAiswBridge};
use crate::errors::{DesktopResult, ErrorPayload};
use crate::models::{
    AddOAuthProfileRequest, AddProfileRequest, AppBootstrap, AppSnapshot, BackupEntry,
    DesktopSettings, DoctorReport, InitReport, InstallUpdateReport, MutationResponse,
    ProjectBindingsReport, RepairReport, RepairRequest, ShellHookGuidance, UpdateCheckReport,
    UpdateSettingsRequest, UseAllProfilesRequest, UseContextRequest, UseProfileRequest,
    VerifyReport, WorkspaceBindRequest, WorkspaceStatusReport, WorkspaceUnbindTarget,
};
use crate::shell;
use crate::state::{incompatible_runtime_error, AppState};
use crate::tray;
use crate::updater;
use std::path::PathBuf;
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
    let result = make_bridge(&state)
        .await?
        .init()
        .await
        .map_err(ErrorPayload::from)?;
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
