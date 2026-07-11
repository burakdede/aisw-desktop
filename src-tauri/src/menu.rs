use tauri::menu::{IsMenuItem, Menu, MenuItem, MenuItemKind, PredefinedMenuItem, Submenu};
use tauri::{AppHandle, Emitter, Runtime};

pub const MENU_OPEN_SETTINGS_EVENT: &str = "menu-open-settings";
pub const MENU_OPEN_SETTINGS_UPDATES_EVENT: &str = "menu-open-settings-updates";
pub const MENU_OPEN_PROFILES_EVENT: &str = "menu-open-profiles";
pub const MENU_OPEN_IMPORT_CURRENT_LOGIN_EVENT: &str = "menu-open-import-current-login";
pub const MENU_OPEN_OVERVIEW_EVENT: &str = "menu-open-overview";
pub const MENU_OPEN_SETS_EVENT: &str = "menu-open-sets";
pub const MENU_OPEN_DIAGNOSTICS_EVENT: &str = "menu-open-diagnostics";
pub const MENU_OPEN_BACKUPS_EVENT: &str = "menu-open-backups";
pub const MENU_OPEN_ACTIVITY_EVENT: &str = "menu-open-activity";
pub const MENU_OPEN_QUICK_SWITCH_EVENT: &str = "menu-open-quick-switch";
pub const MENU_EXPORT_DIAGNOSTICS_EVENT: &str = "menu-export-diagnostics";
pub const MENU_OPEN_ADD_PROFILE_EVENT: &str = "menu-open-add-profile";
pub const MENU_RUN_VERIFY_EVENT: &str = "menu-run-verify";
pub const MENU_OPEN_TROUBLESHOOTING_EVENT: &str = "menu-open-troubleshooting";
pub const MENU_OPEN_HELP_EVENT: &str = "menu-open-help";
pub const MENU_REAPPLY_ACTIVE_PROFILE_EVENT: &str = "menu-reapply-active-profile";

const SETTINGS_ID: &str = "menu.settings";
const CHECK_UPDATES_ID: &str = "menu.check-updates";
const ADD_PROFILE_ID: &str = "menu.add-profile";
const IMPORT_CURRENT_LOGIN_ID: &str = "menu.import-current-login";
const EXPORT_REPORT_ID: &str = "menu.export-report";
const QUICK_SWITCH_ID: &str = "menu.quick-switch";
const SWITCH_SET_ID: &str = "menu.switch-set";
const VERIFY_ID: &str = "menu.verify";
const REAPPLY_ACTIVE_PROFILE_ID: &str = "menu.reapply-active-profile";
const VIEW_OVERVIEW_ID: &str = "menu.view.overview";
const VIEW_PROFILES_ID: &str = "menu.view.profiles";
const VIEW_SETS_ID: &str = "menu.view.sets";
const VIEW_DIAGNOSTICS_ID: &str = "menu.view.diagnostics";
const VIEW_BACKUPS_ID: &str = "menu.view.backups";
const VIEW_ACTIVITY_ID: &str = "menu.view.activity";

pub fn build_menu<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<Menu<R>> {
    let settings = MenuItem::with_id(app, SETTINGS_ID, "Settings…", true, Some("CmdOrCtrl+Comma"))?;
    let check_updates =
        MenuItem::with_id(app, CHECK_UPDATES_ID, "Check for Updates…", true, None::<&str>)?;

    let add_profile =
        MenuItem::with_id(app, ADD_PROFILE_ID, "Add Profile…", true, Some("CmdOrCtrl+N"))?;
    let import_current_login = MenuItem::with_id(
        app,
        IMPORT_CURRENT_LOGIN_ID,
        "Import Current Login…",
        true,
        None::<&str>,
    )?;
    let export_report = MenuItem::with_id(
        app,
        EXPORT_REPORT_ID,
        "Export Redacted Diagnostic Report…",
        true,
        None::<&str>,
    )?;

    let quick_switch =
        MenuItem::with_id(app, QUICK_SWITCH_ID, "Quick Switch…", true, Some("CmdOrCtrl+K"))?;
    let switch_set =
        MenuItem::with_id(app, SWITCH_SET_ID, "Switch Set…", true, None::<&str>)?;
    let verify = MenuItem::with_id(
        app,
        VERIFY_ID,
        "Verify Current State",
        true,
        Some("CmdOrCtrl+Shift+V"),
    )?;
    let reapply_active_profile = MenuItem::with_id(
        app,
        REAPPLY_ACTIVE_PROFILE_ID,
        "Re-apply Active Profile",
        true,
        None::<&str>,
    )?;

    let overview =
        MenuItem::with_id(app, VIEW_OVERVIEW_ID, "Overview", true, Some("CmdOrCtrl+1"))?;
    let profiles =
        MenuItem::with_id(app, VIEW_PROFILES_ID, "Profiles", true, Some("CmdOrCtrl+2"))?;
    let sets = MenuItem::with_id(app, VIEW_SETS_ID, "Sets", true, Some("CmdOrCtrl+3"))?;
    let diagnostics = MenuItem::with_id(
        app,
        VIEW_DIAGNOSTICS_ID,
        "Diagnostics",
        true,
        Some("CmdOrCtrl+4"),
    )?;
    let backups =
        MenuItem::with_id(app, VIEW_BACKUPS_ID, "Backups", true, Some("CmdOrCtrl+5"))?;
    let activity =
        MenuItem::with_id(app, VIEW_ACTIVITY_ID, "Activity", true, Some("CmdOrCtrl+6"))?;

    let help_docs = MenuItem::with_id(
        app,
        "menu.help.docs",
        "AI Switch Documentation",
        true,
        None::<&str>,
    )?;
    let help_troubleshooting = MenuItem::with_id(
        app,
        "menu.help.troubleshooting",
        "Troubleshooting",
        true,
        None::<&str>,
    )?;
    let help_issues = MenuItem::with_id(
        app,
        "menu.help.issues",
        "Export Redacted Diagnostic Report…",
        true,
        None::<&str>,
    )?;

    let app_items: Vec<MenuItemKind<R>> = vec![
        PredefinedMenuItem::about(app, Some("About AI Switch"), None)?.kind(),
        PredefinedMenuItem::separator(app)?.kind(),
        settings.kind(),
        check_updates.kind(),
        PredefinedMenuItem::separator(app)?.kind(),
        PredefinedMenuItem::quit(app, Some("Quit AI Switch"))?.kind(),
    ];
    let app_refs = app_items
        .iter()
        .map(|item| item as &dyn IsMenuItem<R>)
        .collect::<Vec<_>>();
    let app_menu = Submenu::with_items(app, "AI Switch Desktop", true, &app_refs)?;

    let file_items: Vec<MenuItemKind<R>> = vec![
        add_profile.kind(),
        import_current_login.kind(),
        export_report.kind(),
    ];
    let file_refs = file_items
        .iter()
        .map(|item| item as &dyn IsMenuItem<R>)
        .collect::<Vec<_>>();
    let file_menu = Submenu::with_items(app, "File", true, &file_refs)?;

    let profile_items: Vec<MenuItemKind<R>> = vec![
        quick_switch.kind(),
        switch_set.kind(),
        verify.kind(),
        reapply_active_profile.kind(),
    ];
    let profile_refs = profile_items
        .iter()
        .map(|item| item as &dyn IsMenuItem<R>)
        .collect::<Vec<_>>();
    let profile_menu = Submenu::with_items(app, "Profile", true, &profile_refs)?;

    let view_items: Vec<MenuItemKind<R>> = vec![
        overview.kind(),
        profiles.kind(),
        sets.kind(),
        diagnostics.kind(),
        backups.kind(),
        activity.kind(),
    ];
    let view_refs = view_items
        .iter()
        .map(|item| item as &dyn IsMenuItem<R>)
        .collect::<Vec<_>>();
    let view_menu = Submenu::with_items(app, "View", true, &view_refs)?;

    let help_items: Vec<MenuItemKind<R>> = vec![
        help_docs.kind(),
        help_troubleshooting.kind(),
        help_issues.kind(),
    ];
    let help_refs = help_items
        .iter()
        .map(|item| item as &dyn IsMenuItem<R>)
        .collect::<Vec<_>>();
    let help_menu = Submenu::with_items(app, "Help", true, &help_refs)?;

    let items: [&dyn IsMenuItem<R>; 5] = [
        &app_menu,
        &file_menu,
        &profile_menu,
        &view_menu,
        &help_menu,
    ];

    let menu = Menu::with_items(app, &items)?;
    Ok(menu)
}

pub fn handle_menu_event<R: Runtime>(app: &AppHandle<R>, id: &str) {
    match id {
        SETTINGS_ID => {
            let _ = app.emit(MENU_OPEN_SETTINGS_EVENT, ());
        }
        CHECK_UPDATES_ID => {
            let _ = app.emit(MENU_OPEN_SETTINGS_UPDATES_EVENT, ());
        }
        ADD_PROFILE_ID => {
            let _ = app.emit(MENU_OPEN_ADD_PROFILE_EVENT, ());
        }
        IMPORT_CURRENT_LOGIN_ID => {
            let _ = app.emit(MENU_OPEN_IMPORT_CURRENT_LOGIN_EVENT, ());
        }
        QUICK_SWITCH_ID => {
            let _ = app.emit(MENU_OPEN_QUICK_SWITCH_EVENT, ());
        }
        SWITCH_SET_ID => {
            let _ = app.emit(MENU_OPEN_SETS_EVENT, ());
        }
        VERIFY_ID => {
            let _ = app.emit(MENU_OPEN_DIAGNOSTICS_EVENT, ());
            let _ = app.emit(MENU_RUN_VERIFY_EVENT, ());
        }
        REAPPLY_ACTIVE_PROFILE_ID => {
            let _ = app.emit(MENU_REAPPLY_ACTIVE_PROFILE_EVENT, ());
        }
        VIEW_OVERVIEW_ID => {
            let _ = app.emit(MENU_OPEN_OVERVIEW_EVENT, ());
        }
        VIEW_PROFILES_ID => {
            let _ = app.emit(MENU_OPEN_PROFILES_EVENT, ());
        }
        VIEW_SETS_ID => {
            let _ = app.emit(MENU_OPEN_SETS_EVENT, ());
        }
        VIEW_DIAGNOSTICS_ID => {
            let _ = app.emit(MENU_OPEN_DIAGNOSTICS_EVENT, ());
        }
        VIEW_BACKUPS_ID => {
            let _ = app.emit(MENU_OPEN_BACKUPS_EVENT, ());
        }
        VIEW_ACTIVITY_ID => {
            let _ = app.emit(MENU_OPEN_ACTIVITY_EVENT, ());
        }
        EXPORT_REPORT_ID => {
            let _ = app.emit(MENU_EXPORT_DIAGNOSTICS_EVENT, ());
        }
        "menu.help.docs" => {
            let _ = app.emit(MENU_OPEN_HELP_EVENT, ());
        }
        "menu.help.troubleshooting" => {
            let _ = app.emit(MENU_OPEN_TROUBLESHOOTING_EVENT, ());
        }
        "menu.help.issues" => {
            let _ = app.emit(MENU_EXPORT_DIAGNOSTICS_EVENT, ());
        }
        _ => {}
    }
}
