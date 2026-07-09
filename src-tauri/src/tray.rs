use crate::models::{AppSnapshot, UseContextRequest, UseProfileRequest};
use crate::state::AppState;
use tauri::menu::{IsMenuItem, Menu, MenuItem, MenuItemKind, PredefinedMenuItem, Submenu};
use tauri::{AppHandle, Manager, Runtime};

const TRAY_ID: &str = "main-tray";
const OPEN_ID: &str = "open";
const DIAGNOSTICS_ID: &str = "diagnostics";
const QUIT_ID: &str = "quit";

pub fn build_tray<R: Runtime>(
    app: &AppHandle<R>,
    state: AppState,
) -> tauri::Result<tauri::tray::TrayIconBuilder<R>> {
    let snapshot = tauri::async_runtime::block_on(async { state.snapshot().await.ok() });
    let tooltip = snapshot
        .as_ref()
        .map(active_summary)
        .unwrap_or_else(|| "AISW Desktop".to_owned());

    let menu = tray_menu(app, snapshot.as_ref())?;
    Ok(tauri::tray::TrayIconBuilder::with_id(TRAY_ID)
        .menu(&menu)
        .tooltip(tooltip)
        .show_menu_on_left_click(true)
        .on_menu_event(move |app, event| {
            handle_menu_event(app, state.clone(), event.id().as_ref().to_owned());
        }))
}

pub async fn refresh_tray<R: Runtime>(app: &AppHandle<R>, state: AppState) -> tauri::Result<()> {
    let snapshot = state.snapshot().await.ok();
    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        let menu = tray_menu(app, snapshot.as_ref())?;
        tray.set_menu(Some(menu))?;
        tray.set_tooltip(Some(active_summary_or_default(snapshot.as_ref())))?;
    }
    Ok(())
}

fn handle_menu_event<R: Runtime>(app: &AppHandle<R>, state: AppState, id: String) {
    match id.as_str() {
        OPEN_ID | DIAGNOSTICS_ID => {
            show_main_window(app);
        }
        QUIT_ID => {
            app.exit(0);
        }
        _ if id.starts_with("context:") => {
            let context = id.trim_start_matches("context:").to_owned();
            let app_handle = app.clone();
            tauri::async_runtime::spawn(async move {
                let _ = state
                    .mutate("tray_use_context", move |bridge| async move {
                        bridge
                            .use_context(UseContextRequest {
                                context,
                                state_mode: Some("isolated".to_owned()),
                            })
                            .await
                    })
                    .await;
                let _ = refresh_tray(&app_handle, state).await;
            });
        }
        _ if id.starts_with("profile:") => {
            let mut parts = id.splitn(3, ':');
            let _ = parts.next();
            let tool = parts.next().unwrap_or_default().to_owned();
            let profile = parts.next().unwrap_or_default().to_owned();
            let app_handle = app.clone();
            tauri::async_runtime::spawn(async move {
                let _ = state
                    .mutate("tray_use_profile", move |bridge| async move {
                        bridge
                            .use_profile(UseProfileRequest {
                                tool,
                                profile,
                                state_mode: Some("isolated".to_owned()),
                            })
                            .await
                    })
                    .await;
                let _ = refresh_tray(&app_handle, state).await;
            });
        }
        _ => {}
    }
}

fn tray_menu<R: Runtime>(app: &AppHandle<R>, snapshot: Option<&AppSnapshot>) -> tauri::Result<Menu<R>> {
    let mut items: Vec<MenuItemKind<R>> = vec![
        MenuItem::with_id(
            app,
            "active-summary",
            format!("Active: {}", active_summary_or_default(snapshot)),
            false,
            None::<&str>,
        )?
        .kind(),
        PredefinedMenuItem::separator(app)?.kind(),
    ];

    if let Some(snapshot) = snapshot {
        if !snapshot.contexts.is_empty() {
            let context_items = snapshot
                .contexts
                .iter()
                .map(|context| {
                    MenuItem::with_id(
                        app,
                        format!("context:{}", context.name),
                        context.name.clone(),
                        true,
                        None::<&str>,
                    )
                    .map(|item| item.kind())
                })
                .collect::<tauri::Result<Vec<_>>>()?;
            let context_refs = context_items
                .iter()
                .map(|item| item as &dyn IsMenuItem<R>)
                .collect::<Vec<_>>();
            let contexts = Submenu::with_items(app, "Switch Context", true, &context_refs)?;
            items.push(contexts.kind());
        }

        for (tool, entry) in &snapshot.profiles {
            if entry.profiles.is_empty() {
                continue;
            }
            let profile_items = entry
                .profiles
                .iter()
                .map(|profile| {
                    let suffix = if entry.active.as_deref() == Some(profile.name.as_str()) {
                        " ✓"
                    } else {
                        ""
                    };
                    MenuItem::with_id(
                        app,
                        format!("profile:{tool}:{}", profile.name),
                        format!("{}{}", profile.label.as_deref().unwrap_or(&profile.name), suffix),
                        true,
                        None::<&str>,
                    )
                    .map(|item| item.kind())
                })
                .collect::<tauri::Result<Vec<_>>>()?;
            let profile_refs = profile_items
                .iter()
                .map(|item| item as &dyn IsMenuItem<R>)
                .collect::<Vec<_>>();
            let submenu = Submenu::with_items(
                app,
                format!("{} profiles", title_case(tool)),
                true,
                &profile_refs,
            )?;
            items.push(submenu.kind());
        }
    }

    items.push(MenuItem::with_id(app, OPEN_ID, "Open AISW Desktop", true, None::<&str>)?.kind());
    items.push(MenuItem::with_id(app, DIAGNOSTICS_ID, "Open diagnostics", true, None::<&str>)?.kind());
    items.push(MenuItem::with_id(app, QUIT_ID, "Quit", true, None::<&str>)?.kind());

    let item_refs = items
        .iter()
        .map(|item| item as &dyn IsMenuItem<R>)
        .collect::<Vec<_>>();
    Menu::with_items(app, &item_refs)
}

fn show_main_window<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }
}

fn active_summary(snapshot: &AppSnapshot) -> String {
    let active = snapshot
        .statuses
        .iter()
        .filter_map(|status| {
            status
                .active_profile
                .as_ref()
                .map(|profile| format!("{}={profile}", status.tool))
        })
        .collect::<Vec<_>>();
    if active.is_empty() {
        "no active profiles".to_owned()
    } else {
        active.join(", ")
    }
}

fn active_summary_or_default(snapshot: Option<&AppSnapshot>) -> String {
    snapshot
        .map(active_summary)
        .unwrap_or_else(|| "no active profiles".to_owned())
}

fn title_case(value: &str) -> String {
    let mut chars = value.chars();
    match chars.next() {
        Some(first) => format!("{}{}", first.to_uppercase(), chars.as_str()),
        None => String::new(),
    }
}

#[cfg(test)]
mod tests {
    use super::{active_summary, active_summary_or_default};
    use crate::models::{AppSnapshot, ToolProfiles, ToolStatus};
    use std::collections::HashMap;

    #[test]
    fn active_summary_prefers_known_active_profiles() {
        let snapshot = AppSnapshot {
            statuses: vec![
                ToolStatus {
                    tool: "claude".to_owned(),
                    binary_found: true,
                    stored_profiles: 1,
                    active_profile: Some("work".to_owned()),
                    auth_method: None,
                    credential_backend: None,
                    state_mode: None,
                    active_profile_applied: None,
                    credentials_present: None,
                    permissions_ok: None,
                },
                ToolStatus {
                    tool: "codex".to_owned(),
                    binary_found: true,
                    stored_profiles: 1,
                    active_profile: Some("personal".to_owned()),
                    auth_method: None,
                    credential_backend: None,
                    state_mode: None,
                    active_profile_applied: None,
                    credentials_present: None,
                    permissions_ok: None,
                },
            ],
            profiles: HashMap::<String, ToolProfiles>::new(),
            contexts: vec![],
            workspace_status: None,
            project_bindings: None,
        };
        assert_eq!(
            active_summary(&snapshot),
            "claude=work, codex=personal"
        );
        assert_eq!(active_summary_or_default(Some(&snapshot)), "claude=work, codex=personal");
    }
}
