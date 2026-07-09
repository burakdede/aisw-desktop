#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod bridge;
mod commands;
mod errors;
mod models;
mod redaction;
mod settings;
mod state;
mod tray;

use settings::SettingsStore;
use state::AppState;

fn main() {
    tracing_subscriber::fmt().with_target(false).init();

    let app_state = AppState::new(SettingsStore::new(resolve_settings_dir()));
    tauri::Builder::default()
        .manage(app_state)
        .setup(|app| {
            tray::build_tray().build(app)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_bootstrap,
            commands::get_snapshot,
            commands::get_settings,
            commands::update_settings,
            commands::run_init,
            commands::add_profile,
            commands::use_profile,
            commands::use_context,
            commands::rename_profile,
            commands::remove_profile,
            commands::restore_backup,
            commands::run_doctor,
            commands::run_verify,
            commands::run_repair,
            commands::list_backups,
            commands::get_workspace_status,
            commands::get_project_bindings,
            commands::workspace_bind,
            commands::workspace_unbind,
            commands::workspace_guard
        ])
        .run(tauri::generate_context!())
        .expect("failed to run AISW Desktop");
}

fn resolve_settings_dir() -> std::path::PathBuf {
    std::env::var_os("AISW_DESKTOP_CONFIG_DIR")
        .map(std::path::PathBuf::from)
        .or_else(|| {
            std::env::current_exe()
                .ok()
                .and_then(|path| path.parent().map(|parent| parent.join("config")))
        })
        .unwrap_or_else(|| std::path::PathBuf::from(".aisw-desktop"))
}
