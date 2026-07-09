use crate::bridge::{AiswBridge, CliAiswBridge};
use crate::errors::{DesktopResult, ErrorPayload};
use crate::models::{
    AddProfileRequest, AppBootstrap, AppSnapshot, BackupEntry, DesktopSettings, DoctorReport,
    MutationResponse, RepairReport, RepairRequest, UpdateSettingsRequest, UseContextRequest,
    UseProfileRequest, VerifyReport,
};
use crate::state::{incompatible_runtime_error, AppState};
use std::path::PathBuf;

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
pub async fn update_settings(
    state: tauri::State<'_, AppState>,
    request: UpdateSettingsRequest,
) -> DesktopResult<DesktopSettings> {
    state.update_settings(request).await.map_err(ErrorPayload::from)
}

#[tauri::command]
pub async fn add_profile(
    state: tauri::State<'_, AppState>,
    request: AddProfileRequest,
) -> DesktopResult<MutationResponse> {
    ensure_compatible(&state).await?;
    state
        .mutate("add_profile", move |bridge| async move { bridge.add_profile(request).await })
        .await
}

#[tauri::command]
pub async fn use_profile(
    state: tauri::State<'_, AppState>,
    request: UseProfileRequest,
) -> DesktopResult<MutationResponse> {
    ensure_compatible(&state).await?;
    state
        .mutate("use_profile", move |bridge| async move { bridge.use_profile(request).await })
        .await
}

#[tauri::command]
pub async fn use_context(
    state: tauri::State<'_, AppState>,
    request: UseContextRequest,
) -> DesktopResult<MutationResponse> {
    ensure_compatible(&state).await?;
    state
        .mutate("use_context", move |bridge| async move { bridge.use_context(request).await })
        .await
}

#[tauri::command]
pub async fn rename_profile(
    state: tauri::State<'_, AppState>,
    tool: String,
    old_name: String,
    new_name: String,
) -> DesktopResult<MutationResponse> {
    ensure_compatible(&state).await?;
    state
        .mutate("rename_profile", move |bridge| async move {
            bridge.rename_profile(tool, old_name, new_name).await
        })
        .await
}

#[tauri::command]
pub async fn remove_profile(
    state: tauri::State<'_, AppState>,
    tool: String,
    profile: String,
    force: bool,
) -> DesktopResult<MutationResponse> {
    ensure_compatible(&state).await?;
    state
        .mutate("remove_profile", move |bridge| async move {
            bridge.remove_profile(tool, profile, force).await
        })
        .await
}

#[tauri::command]
pub async fn restore_backup(
    state: tauri::State<'_, AppState>,
    backup_id: String,
) -> DesktopResult<MutationResponse> {
    ensure_compatible(&state).await?;
    state
        .mutate("restore_backup", move |bridge| async move {
            bridge.restore_backup(backup_id).await
        })
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
pub async fn list_backups(state: tauri::State<'_, AppState>) -> DesktopResult<Vec<BackupEntry>> {
    make_bridge(&state)
        .await?
        .list_backups()
        .await
        .map_err(ErrorPayload::from)
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
