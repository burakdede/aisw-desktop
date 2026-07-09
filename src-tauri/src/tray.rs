use crate::errors::ErrorPayload;
use crate::models::{
    AppSnapshot, DesktopSettings, ProfileSet, UseAllProfilesRequest, UseContextRequest,
    UseProfileRequest,
};
use crate::state::AppState;
use serde::Serialize;
use tauri::menu::{IsMenuItem, Menu, MenuItem, MenuItemKind, PredefinedMenuItem, Submenu};
use tauri::{AppHandle, Emitter, Manager, Runtime};

const TRAY_ID: &str = "main-tray";
const OPEN_ID: &str = "open";
const DIAGNOSTICS_ID: &str = "diagnostics";
const QUIT_ID: &str = "quit";
const SWITCH_ALL_PREFIX: &str = "switch-all:";
const PROFILE_SET_PREFIX: &str = "profile-set:";
const OPEN_DIAGNOSTICS_EVENT: &str = "tray-open-diagnostics";
const TRAY_COMMAND_RESULT_EVENT: &str = "tray-command-result";

#[derive(Debug, Clone, PartialEq, Eq)]
struct TraySection {
    title: String,
    items: Vec<TrayEntry>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct TrayEntry {
    id: String,
    label: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "scope", rename_all = "snake_case")]
enum TrayCommandScope {
    Tool { tool: String },
    Global { id: String },
}

#[derive(Debug, Clone, Serialize)]
struct TrayCommandResultEvent {
    scope: TrayCommandScope,
    label: String,
    status: String,
    message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    remediation: Option<String>,
}

pub fn build_tray<R: Runtime>(
    app: &AppHandle<R>,
    state: AppState,
) -> tauri::Result<tauri::tray::TrayIconBuilder<R>> {
    let (settings, snapshot) = tauri::async_runtime::block_on(async {
        (
            state.load_settings().await.ok(),
            state.snapshot().await.ok(),
        )
    });
    let tooltip = snapshot
        .as_ref()
        .map(active_summary)
        .unwrap_or_else(|| "AISW Desktop".to_owned());

    let menu = tray_menu(app, settings.as_ref(), snapshot.as_ref())?;
    Ok(tauri::tray::TrayIconBuilder::with_id(TRAY_ID)
        .menu(&menu)
        .tooltip(tooltip)
        .show_menu_on_left_click(true)
        .on_menu_event(move |app, event| {
            handle_menu_event(app, state.clone(), event.id().as_ref().to_owned());
        }))
}

pub async fn refresh_tray<R: Runtime>(app: &AppHandle<R>, state: AppState) -> tauri::Result<()> {
    let settings = state.load_settings().await.ok();
    let snapshot = state.snapshot().await.ok();
    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        let menu = tray_menu(app, settings.as_ref(), snapshot.as_ref())?;
        tray.set_menu(Some(menu))?;
        tray.set_tooltip(Some(active_summary_or_default(snapshot.as_ref())))?;
    }
    Ok(())
}

fn handle_menu_event<R: Runtime>(app: &AppHandle<R>, state: AppState, id: String) {
    match id.as_str() {
        OPEN_ID => {
            show_main_window(app);
        }
        DIAGNOSTICS_ID => {
            show_main_window(app);
            let _ = app.emit(OPEN_DIAGNOSTICS_EVENT, ());
        }
        QUIT_ID => {
            app.exit(0);
        }
        _ if id.starts_with("context:") => {
            let context = id.trim_start_matches("context:").to_owned();
            let app_handle = app.clone();
            tauri::async_runtime::spawn(async move {
                let context_for_command = context.clone();
                let result = state
                    .mutate("tray_use_context", move |bridge| async move {
                        bridge
                            .use_context(UseContextRequest {
                                context: context_for_command,
                                state_mode: Some("isolated".to_owned()),
                            })
                            .await
                    })
                    .await;
                emit_tray_command_result(
                    &app_handle,
                    result,
                    TrayCommandScope::Global {
                        id: "context".to_owned(),
                    },
                    "Switch context",
                    format!("Activated context {context}."),
                );
                let _ = refresh_tray(&app_handle, state).await;
            });
        }
        _ if id.starts_with(SWITCH_ALL_PREFIX) => {
            let profile = id.trim_start_matches(SWITCH_ALL_PREFIX).to_owned();
            let app_handle = app.clone();
            tauri::async_runtime::spawn(async move {
                let profile_for_command = profile.clone();
                let result = state
                    .mutate("tray_use_all_profiles", move |bridge| async move {
                        bridge
                            .use_all_profiles(UseAllProfilesRequest {
                                profile: profile_for_command,
                                state_mode: Some("isolated".to_owned()),
                            })
                            .await
                    })
                    .await;
                emit_tray_command_result(
                    &app_handle,
                    result,
                    TrayCommandScope::Global {
                        id: "switch-all".to_owned(),
                    },
                    "Switch all profiles",
                    format!("Switched all tools to {profile}."),
                );
                let _ = refresh_tray(&app_handle, state).await;
            });
        }
        _ if id.starts_with(PROFILE_SET_PREFIX) => {
            let profile_set = id.trim_start_matches(PROFILE_SET_PREFIX).to_owned();
            let app_handle = app.clone();
            tauri::async_runtime::spawn(async move {
                let result = state.activate_profile_set(&profile_set).await;
                emit_tray_command_result(
                    &app_handle,
                    result,
                    TrayCommandScope::Global {
                        id: "profile-set".to_owned(),
                    },
                    "Activate profile set",
                    format!("Activated profile set {profile_set}."),
                );
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
                let tool_for_command = tool.clone();
                let profile_for_command = profile.clone();
                let result = state
                    .mutate("tray_use_profile", move |bridge| async move {
                        bridge
                            .use_profile(UseProfileRequest {
                                tool: tool_for_command,
                                profile: profile_for_command,
                                state_mode: Some("isolated".to_owned()),
                            })
                            .await
                    })
                    .await;
                emit_tray_command_result(
                    &app_handle,
                    result,
                    TrayCommandScope::Tool { tool: tool.clone() },
                    "Switch profile",
                    format!("Switched {tool} to {profile}."),
                );
                let _ = refresh_tray(&app_handle, state).await;
            });
        }
        _ => {}
    }
}

fn emit_tray_command_result<R: Runtime>(
    app: &AppHandle<R>,
    result: Result<crate::models::MutationResponse, ErrorPayload>,
    scope: TrayCommandScope,
    label: &str,
    success_message: String,
) {
    let payload = match result {
        Ok(_) => TrayCommandResultEvent {
            scope,
            label: label.to_owned(),
            status: "success".to_owned(),
            message: success_message,
            remediation: None,
        },
        Err(error) => TrayCommandResultEvent {
            scope,
            label: label.to_owned(),
            status: "error".to_owned(),
            message: error.message,
            remediation: error.remediation,
        },
    };
    let _ = app.emit(TRAY_COMMAND_RESULT_EVENT, payload);
}

fn tray_menu<R: Runtime>(
    app: &AppHandle<R>,
    settings: Option<&DesktopSettings>,
    snapshot: Option<&AppSnapshot>,
) -> tauri::Result<Menu<R>> {
    let active_label = active_set_label(settings, snapshot)
        .map(|name| format!("Active set: {name}"))
        .unwrap_or_else(|| format!("Active: {}", active_summary_or_default(snapshot)));
    let mut items: Vec<MenuItemKind<R>> = vec![
        MenuItem::with_id(app, "active-summary", active_label, false, None::<&str>)?.kind(),
        PredefinedMenuItem::separator(app)?.kind(),
    ];

    if let Some(snapshot) = snapshot {
        for section in tray_sections(settings, snapshot) {
            let submenu_items = section
                .items
                .iter()
                .map(|entry| {
                    MenuItem::with_id(
                        app,
                        entry.id.clone(),
                        entry.label.clone(),
                        true,
                        None::<&str>,
                    )
                    .map(|item| item.kind())
                })
                .collect::<tauri::Result<Vec<_>>>()?;
            let submenu_refs = submenu_items
                .iter()
                .map(|item| item as &dyn IsMenuItem<R>)
                .collect::<Vec<_>>();
            let submenu = Submenu::with_items(app, section.title, true, &submenu_refs)?;
            items.push(submenu.kind());
        }
    }

    items.push(MenuItem::with_id(app, OPEN_ID, "Open AISW Desktop", true, None::<&str>)?.kind());
    items.push(
        MenuItem::with_id(app, DIAGNOSTICS_ID, "Open diagnostics", true, None::<&str>)?.kind(),
    );
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

fn active_set_label(
    settings: Option<&DesktopSettings>,
    snapshot: Option<&AppSnapshot>,
) -> Option<String> {
    let snapshot = snapshot?;
    let mut active_profiles = snapshot
        .statuses
        .iter()
        .filter_map(|status| status.active_profile.as_deref())
        .collect::<Vec<_>>();
    active_profiles.sort_unstable();
    active_profiles.dedup();
    if active_profiles.len() == 1 {
        active_profiles
            .first()
            .map(|profile| shared_profile_display_name(settings, snapshot, profile))
    } else {
        None
    }
}

fn shared_profile_entries(
    settings: Option<&DesktopSettings>,
    snapshot: &AppSnapshot,
) -> Vec<(String, String)> {
    let mut counts = std::collections::HashMap::<String, (usize, String)>::new();
    snapshot.profiles.iter().for_each(|(tool, entry)| {
        entry.profiles.iter().for_each(|profile| {
            let current = counts.entry(profile.name.clone()).or_insert_with(|| {
                (
                    0,
                    shared_profile_display_name_from_parts(settings, tool, profile),
                )
            });
            current.0 += 1;
        });
    });
    let mut entries = counts
        .into_iter()
        .filter_map(|(name, (count, label))| if count > 1 { Some((name, label)) } else { None })
        .collect::<Vec<_>>();
    entries.sort_by(|left, right| left.0.cmp(&right.0));
    entries
}

fn tray_sections(settings: Option<&DesktopSettings>, snapshot: &AppSnapshot) -> Vec<TraySection> {
    let mut sections = Vec::new();

    let shared_profiles = shared_profile_entries(settings, snapshot);
    if !shared_profiles.is_empty() {
        sections.push(TraySection {
            title: "Switch all".to_owned(),
            items: shared_profiles
                .into_iter()
                .map(|(profile, label)| TrayEntry {
                    id: format!("{SWITCH_ALL_PREFIX}{profile}"),
                    label,
                })
                .collect(),
        });
    }

    if !snapshot.contexts.is_empty() {
        sections.push(TraySection {
            title: "Switch Context".to_owned(),
            items: snapshot
                .contexts
                .iter()
                .map(|context| TrayEntry {
                    id: format!("context:{}", context.name),
                    label: context.name.clone(),
                })
                .collect(),
        });
    }

    let profile_sets = settings
        .map(|settings| profile_set_entries(settings, snapshot))
        .unwrap_or_default();
    if !profile_sets.is_empty() {
        sections.push(TraySection {
            title: "Profile sets".to_owned(),
            items: profile_sets,
        });
    }

    let mut profile_tools = snapshot.profiles.iter().collect::<Vec<_>>();
    profile_tools.sort_by(|left, right| left.0.cmp(right.0));

    for (tool, entry) in profile_tools {
        if entry.profiles.is_empty() {
            continue;
        }
        sections.push(TraySection {
            title: format!("{} profiles", title_case(tool)),
            items: entry
                .profiles
                .iter()
                .map(|profile| {
                    let suffix = if entry.active.as_deref() == Some(profile.name.as_str()) {
                        " ✓"
                    } else {
                        ""
                    };
                    TrayEntry {
                        id: format!("profile:{tool}:{}", profile.name),
                        label: format!(
                            "{}{}",
                            shared_profile_display_name_from_parts(settings, tool, profile),
                            suffix
                        ),
                    }
                })
                .collect(),
        });
    }

    sections
}

fn title_case(value: &str) -> String {
    let mut chars = value.chars();
    match chars.next() {
        Some(first) => format!("{}{}", first.to_uppercase(), chars.as_str()),
        None => String::new(),
    }
}

fn profile_set_entries(settings: &DesktopSettings, snapshot: &AppSnapshot) -> Vec<TrayEntry> {
    let mut sets = settings.profile_sets.clone();
    sets.sort_by(|left, right| left.name.cmp(&right.name));
    sets.into_iter()
        .map(|set| TrayEntry {
            id: format!("{PROFILE_SET_PREFIX}{}", set.name),
            label: profile_set_label(&set, snapshot),
        })
        .collect()
}

fn profile_set_label(set: &ProfileSet, snapshot: &AppSnapshot) -> String {
    let label = set.label.as_deref().unwrap_or(&set.name);
    if profile_set_is_active(set, snapshot) {
        format!("{label} ✓")
    } else {
        label.to_owned()
    }
}

fn profile_set_is_active(set: &ProfileSet, snapshot: &AppSnapshot) -> bool {
    let selected = set
        .profiles
        .iter()
        .filter_map(|(tool, profile)| profile.as_ref().map(|profile| (tool.as_str(), profile.as_str())))
        .collect::<Vec<_>>();
    !selected.is_empty()
        && selected.into_iter().all(|(tool, profile)| {
            active_profile_for_tool(snapshot, tool) == Some(profile)
        })
}

fn shared_profile_display_name(
    settings: Option<&DesktopSettings>,
    snapshot: &AppSnapshot,
    profile: &str,
) -> String {
    snapshot
        .profiles
        .iter()
        .find_map(|(tool, entry)| {
            entry.profiles.iter().find_map(|candidate| {
                (candidate.name == profile)
                    .then(|| shared_profile_display_name_from_parts(settings, tool, candidate))
            })
        })
        .unwrap_or_else(|| title_case(profile))
}

fn shared_profile_display_name_from_parts(
    settings: Option<&DesktopSettings>,
    tool: &str,
    profile: &crate::models::ToolProfileSummary,
) -> String {
    settings
        .and_then(|settings| settings.profile_labels.get(tool))
        .and_then(|labels| labels.get(&profile.name))
        .and_then(|label| label.clone())
        .or_else(|| profile.label.clone())
        .unwrap_or_else(|| title_case(&profile.name))
}

fn active_profile_for_tool<'a>(snapshot: &'a AppSnapshot, tool: &str) -> Option<&'a str> {
    snapshot
        .statuses
        .iter()
        .find(|status| status.tool == tool)
        .and_then(|status| status.active_profile.as_deref())
        .or_else(|| {
            snapshot
                .profiles
                .get(tool)
                .and_then(|profiles| profiles.active.as_deref())
        })
}

#[cfg(test)]
mod tests {
    use super::{
        active_set_label, active_summary, active_summary_or_default, profile_set_is_active,
        shared_profile_entries, tray_sections, TrayEntry, TraySection,
    };
    use crate::models::{
        AppSnapshot, ContextSummary, DesktopSettings, ProfileSet, RuntimeKind, ToolProfileSummary,
        ToolProfiles, ToolStatus,
    };
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
                    token_warning: None,
                    warnings: vec![],
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
                    token_warning: None,
                    warnings: vec![],
                },
            ],
            profiles: HashMap::<String, ToolProfiles>::new(),
            contexts: vec![],
            workspace_status: None,
            project_bindings: None,
        };
        assert_eq!(active_summary(&snapshot), "claude=work, codex=personal");
        assert_eq!(
            active_summary_or_default(Some(&snapshot)),
            "claude=work, codex=personal"
        );
        assert_eq!(active_set_label(None, Some(&snapshot)), None);
    }

    #[test]
    fn active_set_label_prefers_single_shared_profile() {
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
                    token_warning: None,
                    warnings: vec![],
                },
                ToolStatus {
                    tool: "codex".to_owned(),
                    binary_found: true,
                    stored_profiles: 1,
                    active_profile: Some("work".to_owned()),
                    auth_method: None,
                    credential_backend: None,
                    state_mode: None,
                    active_profile_applied: None,
                    credentials_present: None,
                    permissions_ok: None,
                    token_warning: None,
                    warnings: vec![],
                },
            ],
            profiles: HashMap::<String, ToolProfiles>::new(),
            contexts: vec![],
            workspace_status: None,
            project_bindings: None,
        };
        assert_eq!(active_set_label(None, Some(&snapshot)).as_deref(), Some("Work"));
    }

    #[test]
    fn shared_profile_entries_list_common_names_once() {
        let snapshot = AppSnapshot {
            statuses: vec![],
            profiles: HashMap::from([
                (
                    "claude".to_owned(),
                    ToolProfiles {
                        active: Some("work".to_owned()),
                        profiles: vec![
                            ToolProfileSummary {
                                name: "work".to_owned(),
                                auth: "oauth".to_owned(),
                                label: Some("Work".to_owned()),
                            },
                            ToolProfileSummary {
                                name: "personal".to_owned(),
                                auth: "oauth".to_owned(),
                                label: Some("Personal".to_owned()),
                            },
                        ],
                    },
                ),
                (
                    "codex".to_owned(),
                    ToolProfiles {
                        active: Some("work".to_owned()),
                        profiles: vec![
                            ToolProfileSummary {
                                name: "work".to_owned(),
                                auth: "api_key".to_owned(),
                                label: Some("Work".to_owned()),
                            },
                            ToolProfileSummary {
                                name: "client-acme".to_owned(),
                                auth: "api_key".to_owned(),
                                label: Some("Client Acme".to_owned()),
                            },
                        ],
                    },
                ),
            ]),
            contexts: vec![],
            workspace_status: None,
            project_bindings: None,
        };
        assert_eq!(
            shared_profile_entries(None, &snapshot),
            vec![("work".to_owned(), "Work".to_owned())]
        );
    }

    #[test]
    fn tray_sections_include_switch_all_contexts_and_active_markers() {
        let snapshot = AppSnapshot {
            statuses: vec![],
            profiles: HashMap::from([
                (
                    "claude".to_owned(),
                    ToolProfiles {
                        active: Some("work".to_owned()),
                        profiles: vec![
                            ToolProfileSummary {
                                name: "work".to_owned(),
                                auth: "oauth".to_owned(),
                                label: Some("Work".to_owned()),
                            },
                            ToolProfileSummary {
                                name: "personal".to_owned(),
                                auth: "oauth".to_owned(),
                                label: Some("Personal".to_owned()),
                            },
                        ],
                    },
                ),
                (
                    "codex".to_owned(),
                    ToolProfiles {
                        active: Some("work".to_owned()),
                        profiles: vec![ToolProfileSummary {
                            name: "work".to_owned(),
                            auth: "api_key".to_owned(),
                            label: Some("Work".to_owned()),
                        }],
                    },
                ),
            ]),
            contexts: vec![ContextSummary {
                name: "client-acme".to_owned(),
                profiles: HashMap::from([("claude".to_owned(), Some("work".to_owned()))]),
            }],
            workspace_status: None,
            project_bindings: None,
        };

        assert_eq!(
            tray_sections(
                Some(&DesktopSettings {
                    runtime_kind: RuntimeKind::Bundled,
                    runtime_path: None,
                    aisw_home: None,
                    update_channel: "stable".to_owned(),
                    profile_labels: HashMap::new(),
                    profile_sets: vec![
                        ProfileSet {
                            name: "client-acme".to_owned(),
                            label: Some("Client Acme".to_owned()),
                            profiles: HashMap::from([
                                ("claude".to_owned(), Some("work".to_owned())),
                                ("codex".to_owned(), Some("work".to_owned())),
                            ]),
                        },
                        ProfileSet {
                            name: "personal-focus".to_owned(),
                            label: None,
                            profiles: HashMap::from([(
                                "claude".to_owned(),
                                Some("personal".to_owned()),
                            )]),
                        },
                    ],
                }),
                &snapshot
            ),
            vec![
                TraySection {
                    title: "Switch all".to_owned(),
                    items: vec![TrayEntry {
                        id: "switch-all:work".to_owned(),
                        label: "Work".to_owned(),
                    }],
                },
                TraySection {
                    title: "Switch Context".to_owned(),
                    items: vec![TrayEntry {
                        id: "context:client-acme".to_owned(),
                        label: "client-acme".to_owned(),
                    }],
                },
                TraySection {
                    title: "Profile sets".to_owned(),
                    items: vec![
                        TrayEntry {
                            id: "profile-set:client-acme".to_owned(),
                            label: "Client Acme ✓".to_owned(),
                        },
                        TrayEntry {
                            id: "profile-set:personal-focus".to_owned(),
                            label: "personal-focus".to_owned(),
                        },
                    ],
                },
                TraySection {
                    title: "Claude profiles".to_owned(),
                    items: vec![
                        TrayEntry {
                            id: "profile:claude:work".to_owned(),
                            label: "Work ✓".to_owned(),
                        },
                        TrayEntry {
                            id: "profile:claude:personal".to_owned(),
                            label: "Personal".to_owned(),
                        },
                    ],
                },
                TraySection {
                    title: "Codex profiles".to_owned(),
                    items: vec![TrayEntry {
                        id: "profile:codex:work".to_owned(),
                        label: "Work ✓".to_owned(),
                    }],
                },
            ]
        );
    }

    #[test]
    fn active_set_label_prefers_settings_override() {
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
                    token_warning: None,
                    warnings: vec![],
                },
                ToolStatus {
                    tool: "codex".to_owned(),
                    binary_found: true,
                    stored_profiles: 1,
                    active_profile: Some("work".to_owned()),
                    auth_method: None,
                    credential_backend: None,
                    state_mode: None,
                    active_profile_applied: None,
                    credentials_present: None,
                    permissions_ok: None,
                    token_warning: None,
                    warnings: vec![],
                },
            ],
            profiles: HashMap::from([
                (
                    "claude".to_owned(),
                    ToolProfiles {
                        active: Some("work".to_owned()),
                        profiles: vec![ToolProfileSummary {
                            name: "work".to_owned(),
                            auth: "oauth".to_owned(),
                            label: Some("Work".to_owned()),
                        }],
                    },
                ),
                (
                    "codex".to_owned(),
                    ToolProfiles {
                        active: Some("work".to_owned()),
                        profiles: vec![ToolProfileSummary {
                            name: "work".to_owned(),
                            auth: "api_key".to_owned(),
                            label: Some("Work".to_owned()),
                        }],
                    },
                ),
            ]),
            contexts: vec![],
            workspace_status: None,
            project_bindings: None,
        };

        let settings = DesktopSettings {
            runtime_kind: RuntimeKind::Bundled,
            runtime_path: None,
            aisw_home: None,
            update_channel: "stable".to_owned(),
            profile_labels: HashMap::from([(
                "claude".to_owned(),
                HashMap::from([("work".to_owned(), Some("Office".to_owned()))]),
            )]),
            profile_sets: vec![],
        };

        assert_eq!(
            active_set_label(Some(&settings), Some(&snapshot)).as_deref(),
            Some("Office")
        );
    }

    #[test]
    fn profile_set_only_marks_active_when_every_selected_tool_matches() {
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
                    token_warning: None,
                    warnings: vec![],
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
                    token_warning: None,
                    warnings: vec![],
                },
            ],
            profiles: HashMap::new(),
            contexts: vec![],
            workspace_status: None,
            project_bindings: None,
        };

        assert!(profile_set_is_active(
            &ProfileSet {
                name: "writer".to_owned(),
                label: None,
                profiles: HashMap::from([("claude".to_owned(), Some("work".to_owned()))]),
            },
            &snapshot,
        ));
        assert!(!profile_set_is_active(
            &ProfileSet {
                name: "mixed".to_owned(),
                label: None,
                profiles: HashMap::from([
                    ("claude".to_owned(), Some("work".to_owned())),
                    ("codex".to_owned(), Some("work".to_owned())),
                ]),
            },
            &snapshot,
        ));
    }
}
