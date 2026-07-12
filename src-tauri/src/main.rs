#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod bridge;
mod commands;
mod diagnostic_bundle;
mod errors;
mod menu;
mod models;
mod redaction;
mod settings;
mod shell;
mod state;
mod tray;
mod updater;

use settings::SettingsStore;
use state::AppState;
use tauri::Manager;

fn main() {
    tracing_subscriber::fmt().with_target(false).init();

    let app_state = AppState::new(SettingsStore::new(resolve_settings_dir()));
    tauri::Builder::default()
        .manage(app_state)
        .menu(|app| menu::build_menu(app))
        .on_menu_event(|app, event| {
            menu::handle_menu_event(app, event.id().as_ref());
        })
        .setup(|app| {
            app.handle().plugin(tauri_plugin_notification::init())?;
            app.handle()
                .plugin(tauri_plugin_updater::Builder::new().build())?;
            let state = app.state::<AppState>().inner().clone();
            tray::build_tray(&app.handle().clone(), state)?.build(app)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_bootstrap,
            commands::get_snapshot,
            commands::get_settings,
            commands::set_tray_visibility,
            commands::get_shell_guidance,
            commands::check_for_updates,
            commands::install_update,
            commands::update_settings,
            commands::run_init,
            commands::add_profile,
            commands::add_profile_oauth,
            commands::use_profile,
            commands::use_all_profiles,
            commands::use_context,
            commands::activate_profile_set,
            commands::rename_profile,
            commands::remove_profile,
            commands::restore_backup,
            commands::run_doctor,
            commands::run_verify,
            commands::run_repair,
            commands::export_diagnostic_bundle,
            commands::list_backups,
            commands::get_workspace_status,
            commands::get_project_bindings,
            commands::workspace_bind,
            commands::workspace_unbind,
            commands::workspace_guard
        ])
        .run(tauri::generate_context!())
        .expect("failed to run AI Switch");
}

fn resolve_settings_dir() -> std::path::PathBuf {
    std::env::var_os("AI_SWITCH_DESKTOP_CONFIG_DIR")
        .map(std::path::PathBuf::from)
        .or_else(|| std::env::var_os("AISW_DESKTOP_CONFIG_DIR").map(std::path::PathBuf::from))
        .or_else(|| {
            std::env::current_exe()
                .ok()
                .and_then(|path| path.parent().map(|parent| parent.join("config")))
        })
        .unwrap_or_else(|| {
            let current_dir =
                std::env::current_dir().unwrap_or_else(|_| std::path::PathBuf::from("."));
            let preferred = current_dir.join(".ai-switch-desktop");
            let legacy = current_dir.join(".aisw-desktop");
            if preferred.exists() {
                preferred
            } else if legacy.exists() {
                legacy
            } else {
                preferred
            }
        })
}
