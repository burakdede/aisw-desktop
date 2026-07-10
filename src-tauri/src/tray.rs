use crate::errors::{ErrorPayload, GuiErrorKind};
use crate::models::{
    AppBootstrap, AppSnapshot, DesktopSettings, ProfileSet, UseAllProfilesRequest,
    UseContextRequest, UseProfileRequest,
};
use crate::state::{
    incompatible_runtime_error, preferred_global_state_mode, preferred_tool_state_mode, AppState,
};
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
const RUN_DIAGNOSTICS_EVENT: &str = "tray-run-diagnostics";
const TRAY_COMMAND_RESULT_EVENT: &str = "tray-command-result";

#[derive(Debug, Clone, PartialEq, Eq)]
enum TrayAction {
    Open,
    OpenDiagnostics,
    Quit,
    UseContext(String),
    UseAllProfiles(String),
    ActivateProfileSet(String),
    UseProfile { tool: String, profile: String },
    Unknown,
}

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

#[derive(Debug, Clone, PartialEq, Eq)]
struct TrayMenuModel {
    active_label: String,
    runtime_notice: Option<String>,
    sections: Vec<TraySection>,
    footer_items: Vec<TrayEntry>,
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
    kind: Option<GuiErrorKind>,
    #[serde(skip_serializing_if = "Option::is_none")]
    remediation: Option<String>,
}

pub fn build_tray<R: Runtime>(
    app: &AppHandle<R>,
    state: AppState,
) -> tauri::Result<tauri::tray::TrayIconBuilder<R>> {
    let bootstrap = tauri::async_runtime::block_on(async { state.bootstrap().await.ok() });
    let settings = bootstrap.as_ref().map(|entry| &entry.settings);
    let snapshot = bootstrap.as_ref().and_then(|entry| entry.snapshot.as_ref());
    let runtime_compatible = bootstrap
        .as_ref()
        .map(|entry| entry.runtime_status.compatible)
        .unwrap_or(false);
    let tooltip = tray_status_label(runtime_compatible, snapshot);

    let menu = tray_menu(app, settings, snapshot, runtime_compatible)?;
    Ok(tauri::tray::TrayIconBuilder::with_id(TRAY_ID)
        .menu(&menu)
        .tooltip(tooltip)
        .show_menu_on_left_click(true)
        .on_menu_event(move |app, event| {
            handle_menu_event(app, state.clone(), event.id().as_ref().to_owned());
        }))
}

pub async fn refresh_tray<R: Runtime>(app: &AppHandle<R>, state: AppState) -> tauri::Result<()> {
    let bootstrap = state.bootstrap().await.ok();
    let settings = bootstrap.as_ref().map(|entry| &entry.settings);
    let snapshot = bootstrap.as_ref().and_then(|entry| entry.snapshot.as_ref());
    let runtime_compatible = bootstrap
        .as_ref()
        .map(|entry| entry.runtime_status.compatible)
        .unwrap_or(false);
    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        let menu = tray_menu(app, settings, snapshot, runtime_compatible)?;
        tray.set_menu(Some(menu))?;
        tray.set_tooltip(Some(tray_status_label(runtime_compatible, snapshot)))?;
    }
    Ok(())
}

fn handle_menu_event<R: Runtime>(app: &AppHandle<R>, state: AppState, id: String) {
    match parse_tray_action(&id) {
        TrayAction::Open => {
            show_main_window(app);
        }
        TrayAction::OpenDiagnostics => {
            show_main_window(app);
            let _ = app.emit(OPEN_DIAGNOSTICS_EVENT, ());
            let _ = app.emit(RUN_DIAGNOSTICS_EVENT, ());
        }
        TrayAction::Quit => {
            app.exit(0);
        }
        TrayAction::UseContext(context) => {
            let app_handle = app.clone();
            tauri::async_runtime::spawn(async move {
                let bootstrap = state.bootstrap().await.ok();
                let settings = bootstrap.as_ref().map(|entry| &entry.settings);
                let context_label = tray_context_display_label(settings, &context);
                let result = match ensure_tray_runtime_compatible(&state).await {
                    Ok(()) => {
                        let snapshot = bootstrap.as_ref().and_then(|entry| entry.snapshot.clone());
                        state
                            .mutate("tray_use_context", move |bridge| async move {
                                bridge
                                    .use_context(tray_use_context_request(context.clone(), snapshot.as_ref()))
                                    .await
                            })
                            .await
                    }
                    Err(error) => Err(error),
                };
                emit_tray_command_result(
                    &app_handle,
                    result,
                    TrayCommandScope::Global {
                        id: "context".to_owned(),
                    },
                    "Switch context",
                    format!("Activated context {context_label}."),
                );
                let _ = refresh_tray(&app_handle, state).await;
            });
        }
        TrayAction::UseAllProfiles(profile) => {
            let app_handle = app.clone();
            tauri::async_runtime::spawn(async move {
                let bootstrap = state.bootstrap().await.ok();
                let settings = bootstrap.as_ref().map(|entry| &entry.settings);
                let snapshot = bootstrap.as_ref().and_then(|entry| entry.snapshot.clone());
                let profile_label = snapshot
                    .as_ref()
                    .map(|snapshot| shared_profile_display_name(settings, snapshot, &profile))
                    .unwrap_or_else(|| title_case(&profile));
                let result = match ensure_tray_runtime_compatible(&state).await {
                    Ok(()) => {
                        state
                            .mutate("tray_use_all_profiles", move |bridge| async move {
                                bridge
                                    .use_all_profiles(tray_use_all_profiles_request(profile.clone(), snapshot.as_ref()))
                                    .await
                            })
                            .await
                    }
                    Err(error) => Err(error),
                };
                emit_tray_command_result(
                    &app_handle,
                    result,
                    TrayCommandScope::Global {
                        id: "switch-all".to_owned(),
                    },
                    "Switch all profiles",
                    format!("Switched all tools to {profile_label}."),
                );
                let _ = refresh_tray(&app_handle, state).await;
            });
        }
        TrayAction::ActivateProfileSet(profile_set) => {
            let app_handle = app.clone();
            tauri::async_runtime::spawn(async move {
                let bootstrap = state.bootstrap().await.ok();
                let settings = bootstrap.as_ref().map(|entry| &entry.settings);
                let profile_set_label = tray_context_display_label(settings, &profile_set);
                let result = match ensure_tray_runtime_compatible(&state).await {
                    Ok(()) => state.activate_profile_set(&profile_set).await,
                    Err(error) => Err(error),
                };
                emit_tray_command_result(
                    &app_handle,
                    result,
                    TrayCommandScope::Global {
                        id: "profile-set".to_owned(),
                    },
                    "Activate profile set",
                    format!("Activated profile set {profile_set_label}."),
                );
                let _ = refresh_tray(&app_handle, state).await;
            });
        }
        TrayAction::UseProfile { tool, profile } => {
            let app_handle = app.clone();
            tauri::async_runtime::spawn(async move {
                let bootstrap = state.bootstrap().await.ok();
                let settings = bootstrap.as_ref().map(|entry| &entry.settings);
                let snapshot = bootstrap.as_ref().and_then(|entry| entry.snapshot.clone());
                let tool_label = tool.clone();
                let profile_label = snapshot
                    .as_ref()
                    .map(|snapshot| tray_profile_display_name(settings, snapshot, &tool, &profile))
                    .unwrap_or_else(|| title_case(&profile));
                let result = match ensure_tray_runtime_compatible(&state).await {
                    Ok(()) => {
                        state
                            .mutate("tray_use_profile", move |bridge| async move {
                                bridge
                                    .use_profile(tray_use_profile_request(tool.clone(), profile.clone(), snapshot.as_ref()))
                                    .await
                            })
                            .await
                    }
                    Err(error) => Err(error),
                };
                emit_tray_command_result(
                    &app_handle,
                    result,
                    TrayCommandScope::Tool {
                        tool: tool_label.clone(),
                    },
                    "Switch profile",
                    format!("Switched {tool_label} to {profile_label}."),
                );
                let _ = refresh_tray(&app_handle, state).await;
            });
        }
        TrayAction::Unknown => {}
    }
}

fn emit_tray_command_result<R: Runtime>(
    app: &AppHandle<R>,
    result: Result<crate::models::MutationResponse, ErrorPayload>,
    scope: TrayCommandScope,
    label: &str,
    success_message: String,
) {
    let payload = build_tray_command_result_event(result, scope, label, success_message);
    let _ = app.emit(TRAY_COMMAND_RESULT_EVENT, payload);
}

fn build_tray_command_result_event(
    result: Result<crate::models::MutationResponse, ErrorPayload>,
    scope: TrayCommandScope,
    label: &str,
    success_message: String,
) -> TrayCommandResultEvent {
    match result {
        Ok(_) => TrayCommandResultEvent {
            scope,
            label: label.to_owned(),
            status: "success".to_owned(),
            message: success_message,
            kind: None,
            remediation: None,
        },
        Err(error) => TrayCommandResultEvent {
            scope,
            label: label.to_owned(),
            status: "error".to_owned(),
            message: error.message,
            kind: Some(error.kind),
            remediation: error.remediation,
        },
    }
}

fn tray_use_profile_request(
    tool: String,
    profile: String,
    snapshot: Option<&AppSnapshot>,
) -> UseProfileRequest {
    UseProfileRequest {
        state_mode: preferred_tool_state_mode(&tool, snapshot),
        tool,
        profile,
    }
}

fn tray_use_context_request(
    context: String,
    snapshot: Option<&AppSnapshot>,
) -> UseContextRequest {
    UseContextRequest {
        context,
        state_mode: preferred_global_state_mode(snapshot),
    }
}

fn tray_use_all_profiles_request(
    profile: String,
    snapshot: Option<&AppSnapshot>,
) -> UseAllProfilesRequest {
    UseAllProfilesRequest {
        profile,
        state_mode: preferred_global_state_mode(snapshot),
    }
}

fn parse_tray_action(id: &str) -> TrayAction {
    match id {
        OPEN_ID => TrayAction::Open,
        DIAGNOSTICS_ID => TrayAction::OpenDiagnostics,
        QUIT_ID => TrayAction::Quit,
        _ if id.starts_with("context:") => {
            TrayAction::UseContext(id.trim_start_matches("context:").to_owned())
        }
        _ if id.starts_with(SWITCH_ALL_PREFIX) => {
            TrayAction::UseAllProfiles(id.trim_start_matches(SWITCH_ALL_PREFIX).to_owned())
        }
        _ if id.starts_with(PROFILE_SET_PREFIX) => {
            TrayAction::ActivateProfileSet(id.trim_start_matches(PROFILE_SET_PREFIX).to_owned())
        }
        _ if id.starts_with("profile:") => {
            let mut parts = id.splitn(3, ':');
            let _ = parts.next();
            let tool = parts.next().unwrap_or_default();
            let profile = parts.next().unwrap_or_default();
            if tool.is_empty() || profile.is_empty() {
                TrayAction::Unknown
            } else {
                TrayAction::UseProfile {
                    tool: tool.to_owned(),
                    profile: profile.to_owned(),
                }
            }
        }
        _ => TrayAction::Unknown,
    }
}

fn tray_menu<R: Runtime>(
    app: &AppHandle<R>,
    settings: Option<&DesktopSettings>,
    snapshot: Option<&AppSnapshot>,
    runtime_compatible: bool,
) -> tauri::Result<Menu<R>> {
    let model = tray_menu_model(settings, snapshot, runtime_compatible);
    let mut items: Vec<MenuItemKind<R>> = vec![
        MenuItem::with_id(app, "active-summary", model.active_label, false, None::<&str>)?.kind(),
        PredefinedMenuItem::separator(app)?.kind(),
    ];

    for section in model.sections {
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

    if let Some(notice) = model.runtime_notice {
        items.push(MenuItem::with_id(app, "runtime-blocked", notice, false, None::<&str>)?.kind());
    }

    items.extend(
        model
            .footer_items
            .into_iter()
            .map(|entry| MenuItem::with_id(app, entry.id, entry.label, true, None::<&str>))
            .collect::<tauri::Result<Vec<_>>>()?
            .into_iter()
            .map(|item| item.kind()),
    );

    let item_refs = items
        .iter()
        .map(|item| item as &dyn IsMenuItem<R>)
        .collect::<Vec<_>>();
    Menu::with_items(app, &item_refs)
}

fn tray_menu_model(
    settings: Option<&DesktopSettings>,
    snapshot: Option<&AppSnapshot>,
    runtime_compatible: bool,
) -> TrayMenuModel {
    let active_label = active_set_label(settings, snapshot)
        .map(|name| format!("Active set: {name}"))
        .unwrap_or_else(|| format!("Active: {}", tray_status_label(runtime_compatible, snapshot)));
    let sections = if runtime_compatible {
        snapshot
            .map(|snapshot| tray_sections(settings, snapshot))
            .unwrap_or_default()
    } else {
        Vec::new()
    };

    TrayMenuModel {
        active_label,
        runtime_notice: tray_runtime_notice(runtime_compatible).map(str::to_owned),
        sections,
        footer_items: vec![
            TrayEntry {
                id: OPEN_ID.to_owned(),
                label: "Open AISW Desktop".to_owned(),
            },
            TrayEntry {
                id: DIAGNOSTICS_ID.to_owned(),
                label: "Run diagnostics".to_owned(),
            },
            TrayEntry {
                id: QUIT_ID.to_owned(),
                label: "Quit".to_owned(),
            },
        ],
    }
}

fn tray_status_label(runtime_compatible: bool, snapshot: Option<&AppSnapshot>) -> String {
    if !runtime_compatible {
        return "Runtime blocked".to_owned();
    }

    active_summary_or_default(snapshot)
}

fn tray_runtime_notice(runtime_compatible: bool) -> Option<&'static str> {
    if runtime_compatible {
        None
    } else {
        Some("Runtime blocked. Fix aisw in Settings.")
    }
}

async fn ensure_tray_runtime_compatible(state: &AppState) -> Result<(), ErrorPayload> {
    let bootstrap: AppBootstrap = state.bootstrap().await?;
    if bootstrap.runtime_status.compatible {
        Ok(())
    } else {
        Err(incompatible_runtime_error())
    }
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
    if let Some(settings) = settings {
        let mut sets = settings.profile_sets.iter().collect::<Vec<_>>();
        sets.sort_by(|left, right| left.name.cmp(&right.name));
        if let Some(active_set) = sets
            .into_iter()
            .find(|set| profile_set_is_active(set, snapshot))
        {
            return Some(profile_set_label(active_set, snapshot).trim_end_matches(" ✓").to_owned());
        }
    }
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
    let mut counts = std::collections::HashMap::<String, usize>::new();
    snapshot.profiles.iter().for_each(|(_, entry)| {
        entry.profiles.iter().for_each(|profile| {
            *counts.entry(profile.name.clone()).or_insert(0) += 1;
        });
    });
    let mut entries = counts
        .into_iter()
        .filter_map(|(name, count)| {
            (count > 1).then(|| {
                let label = shared_profile_display_name(settings, snapshot, &name);
                (name, label)
            })
        })
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
                    label: tray_context_entry_label(settings, snapshot, &context.name),
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
        .filter(|set| {
            profile_set_has_usable_selections(set, snapshot)
                && !has_matching_cli_context(snapshot, &set.name)
        })
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

fn profile_set_has_selections(set: &ProfileSet) -> bool {
    set.profiles
        .values()
        .any(|profile| profile.as_deref().is_some_and(|value| !value.trim().is_empty()))
}

fn profile_set_has_usable_selections(set: &ProfileSet, snapshot: &AppSnapshot) -> bool {
    profile_set_has_selections(set)
        && set
            .profiles
            .iter()
            .filter_map(|(tool, profile)| {
                profile
                    .as_deref()
                    .map(str::trim)
                    .filter(|value| !value.is_empty())
                    .map(|value| (tool.as_str(), value))
            })
            .all(|(tool, profile)| {
                snapshot
                    .profiles
                    .get(tool)
                    .map(|entry| entry.profiles.iter().any(|candidate| candidate.name == profile))
                    .unwrap_or(false)
            })
}

fn has_matching_cli_context(snapshot: &AppSnapshot, name: &str) -> bool {
    snapshot.contexts.iter().any(|context| context.name == name)
}

fn tray_context_display_label(settings: Option<&DesktopSettings>, context: &str) -> String {
    settings
        .and_then(|settings| {
            settings
                .profile_sets
                .iter()
                .find(|set| set.name == context)
                .map(|set| set.label.clone().unwrap_or_else(|| set.name.clone()))
        })
        .unwrap_or_else(|| context.to_owned())
}

fn tray_context_entry_label(
    settings: Option<&DesktopSettings>,
    snapshot: &AppSnapshot,
    context: &str,
) -> String {
    let label = tray_context_display_label(settings, context);
    if active_context_name(snapshot) == Some(context) {
        format!("{label} ✓")
    } else {
        label
    }
}

fn active_context_name(snapshot: &AppSnapshot) -> Option<&str> {
    snapshot
        .workspace_status
        .as_ref()
        .and_then(|status| status.raw.get("current_context"))
        .and_then(|value| value.as_str())
        .filter(|value| !value.trim().is_empty() && *value != "none")
}

fn shared_profile_display_name(
    settings: Option<&DesktopSettings>,
    snapshot: &AppSnapshot,
    profile: &str,
) -> String {
    if let Some(label) = settings.and_then(|settings| {
        let mut tools = settings.profile_labels.keys().collect::<Vec<_>>();
        tools.sort();
        tools.into_iter().find_map(|tool| {
            settings
                .profile_labels
                .get(tool)
                .and_then(|labels| labels.get(profile))
                .and_then(|label| label.clone())
        })
    }) {
        return label;
    }

    let mut tools = snapshot.profiles.keys().collect::<Vec<_>>();
    tools.sort();
    tools.into_iter()
        .find_map(|tool| {
            snapshot.profiles.get(tool).and_then(|entry| {
                entry
                    .profiles
                    .iter()
                    .find(|candidate| candidate.name == profile)
                    .and_then(|candidate| candidate.label.clone())
            })
        })
        .unwrap_or_else(|| title_case(profile))
}

fn tray_profile_display_name(
    settings: Option<&DesktopSettings>,
    snapshot: &AppSnapshot,
    tool: &str,
    profile: &str,
) -> String {
    settings
        .and_then(|settings| settings.profile_labels.get(tool))
        .and_then(|labels| labels.get(profile))
        .and_then(|label| label.clone())
        .or_else(|| {
            snapshot.profiles.get(tool).and_then(|entry| {
                entry
                    .profiles
                    .iter()
                    .find(|candidate| candidate.name == profile)
                    .and_then(|candidate| candidate.label.clone())
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
        active_set_label, active_summary, active_summary_or_default, build_tray_command_result_event,
        parse_tray_action, profile_set_entries, profile_set_is_active, shared_profile_entries,
        tray_context_display_label, tray_context_entry_label, tray_menu_model,
        tray_profile_display_name,
        tray_runtime_notice, tray_sections, tray_status_label,
        tray_use_all_profiles_request, tray_use_context_request, tray_use_profile_request,
        TrayAction, TrayCommandScope, TrayEntry, TraySection,
    };
    use crate::errors::{ErrorPayload, GuiErrorKind};
    use crate::models::{
        AppSnapshot, ContextSummary, DesktopSettings, MutationResponse, ProfileSet, RuntimeKind,
        ToolProfileSummary, ToolProfiles, ToolStatus,
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
    fn tray_status_label_reports_blocked_runtime() {
        assert_eq!(tray_status_label(false, None), "Runtime blocked");
        assert_eq!(
            tray_runtime_notice(false),
            Some("Runtime blocked. Fix aisw in Settings.")
        );
        assert_eq!(tray_runtime_notice(true), None);
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
            workspace_status: Some(crate::models::WorkspaceStatusReport {
                raw: serde_json::json!({
                    "status": "match",
                    "current_context": "client-acme",
                    "expected_context": "client-acme",
                }),
            }),
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
                        label: "Client Acme ✓".to_owned(),
                    }],
                },
                TraySection {
                    title: "Profile sets".to_owned(),
                    items: vec![TrayEntry {
                        id: "profile-set:personal-focus".to_owned(),
                        label: "personal-focus".to_owned(),
                    }],
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
    fn active_set_label_prefers_profile_set_label() {
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
            profile_sets: vec![ProfileSet {
                name: "client-acme".to_owned(),
                label: Some("Client Acme".to_owned()),
                profiles: HashMap::from([
                    ("claude".to_owned(), Some("work".to_owned())),
                    ("codex".to_owned(), Some("work".to_owned())),
                ]),
            }],
        };

        assert_eq!(
            active_set_label(Some(&settings), Some(&snapshot)).as_deref(),
            Some("Client Acme")
        );
    }

    #[test]
    fn tray_sections_use_saved_label_overrides() {
        let snapshot = AppSnapshot {
            statuses: vec![],
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
            tray_sections(Some(&settings), &snapshot),
            vec![
                TraySection {
                    title: "Switch all".to_owned(),
                    items: vec![TrayEntry {
                        id: "switch-all:work".to_owned(),
                        label: "Office".to_owned(),
                    }],
                },
                TraySection {
                    title: "Claude profiles".to_owned(),
                    items: vec![TrayEntry {
                        id: "profile:claude:work".to_owned(),
                        label: "Office ✓".to_owned(),
                    }],
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
    fn tray_menu_model_includes_fixed_footer_actions() {
        let snapshot = AppSnapshot {
            statuses: vec![ToolStatus {
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
            }],
            profiles: HashMap::from([(
                "claude".to_owned(),
                ToolProfiles {
                    active: Some("work".to_owned()),
                    profiles: vec![ToolProfileSummary {
                        name: "work".to_owned(),
                        auth: "oauth".to_owned(),
                        label: Some("Work".to_owned()),
                    }],
                },
            )]),
            contexts: vec![],
            workspace_status: None,
            project_bindings: None,
        };

        let model = tray_menu_model(None, Some(&snapshot), true);

        assert_eq!(model.active_label, "Active set: Work");
        assert_eq!(model.runtime_notice, None);
        assert_eq!(
            model.footer_items,
            vec![
                TrayEntry {
                    id: "open".to_owned(),
                    label: "Open AISW Desktop".to_owned(),
                },
                TrayEntry {
                    id: "diagnostics".to_owned(),
                    label: "Run diagnostics".to_owned(),
                },
                TrayEntry {
                    id: "quit".to_owned(),
                    label: "Quit".to_owned(),
                },
            ]
        );
    }

    #[test]
    fn tray_menu_model_shows_runtime_notice_and_hides_sections_when_blocked() {
        let snapshot = AppSnapshot {
            statuses: vec![ToolStatus {
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
            }],
            profiles: HashMap::from([(
                "claude".to_owned(),
                ToolProfiles {
                    active: Some("work".to_owned()),
                    profiles: vec![ToolProfileSummary {
                        name: "work".to_owned(),
                        auth: "oauth".to_owned(),
                        label: Some("Work".to_owned()),
                    }],
                },
            )]),
            contexts: vec![ContextSummary {
                name: "client-acme".to_owned(),
                profiles: HashMap::from([("claude".to_owned(), Some("work".to_owned()))]),
            }],
            workspace_status: None,
            project_bindings: None,
        };

        let model = tray_menu_model(None, Some(&snapshot), false);

        assert_eq!(model.active_label, "Active set: Work");
        assert_eq!(
            model.runtime_notice.as_deref(),
            Some("Runtime blocked. Fix aisw in Settings.")
        );
        assert!(model.sections.is_empty());
        assert_eq!(model.footer_items.len(), 3);
    }

    #[test]
    fn tray_profile_set_entries_skip_empty_sets_and_matching_cli_contexts() {
        let snapshot = AppSnapshot {
            statuses: vec![
                ToolStatus {
                    tool: "claude".to_owned(),
                    binary_found: true,
                    stored_profiles: 1,
                    active_profile: Some("work".to_owned()),
                    auth_method: Some("oauth".to_owned()),
                    credential_backend: Some("system_keyring".to_owned()),
                    state_mode: Some("isolated".to_owned()),
                    active_profile_applied: Some(true),
                    credentials_present: Some(true),
                    permissions_ok: Some(true),
                    token_warning: None,
                    warnings: vec![],
                },
                ToolStatus {
                    tool: "codex".to_owned(),
                    binary_found: true,
                    stored_profiles: 1,
                    active_profile: Some("work".to_owned()),
                    auth_method: Some("api_key".to_owned()),
                    credential_backend: Some("file".to_owned()),
                    state_mode: Some("isolated".to_owned()),
                    active_profile_applied: Some(true),
                    credentials_present: Some(true),
                    permissions_ok: Some(true),
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
            contexts: vec![ContextSummary {
                name: "client-acme".to_owned(),
                profiles: HashMap::from([
                    ("claude".to_owned(), Some("work".to_owned())),
                    ("codex".to_owned(), Some("work".to_owned())),
                ]),
            }],
            workspace_status: None,
            project_bindings: None,
        };
        let settings = DesktopSettings {
            runtime_kind: RuntimeKind::Bundled,
            runtime_path: None,
            aisw_home: None,
            update_channel: "stable".to_owned(),
            profile_labels: HashMap::new(),
            profile_sets: vec![
                ProfileSet {
                    name: "empty-set".to_owned(),
                    label: Some("Empty Set".to_owned()),
                    profiles: HashMap::from([
                        ("claude".to_owned(), None),
                        ("codex".to_owned(), Some(" ".to_owned())),
                    ]),
                },
                ProfileSet {
                    name: "client-acme".to_owned(),
                    label: Some("Client Acme".to_owned()),
                    profiles: HashMap::from([
                        ("claude".to_owned(), Some("work".to_owned())),
                        ("codex".to_owned(), Some("work".to_owned())),
                    ]),
                },
                ProfileSet {
                    name: "stale-set".to_owned(),
                    label: Some("Stale Set".to_owned()),
                    profiles: HashMap::from([
                        ("claude".to_owned(), Some("work".to_owned())),
                        ("codex".to_owned(), Some("missing".to_owned())),
                    ]),
                },
            ],
        };

        assert!(profile_set_entries(&settings, &snapshot).is_empty());
    }

    #[test]
    fn tray_profile_requests_respect_tool_state_modes() {
        let snapshot = AppSnapshot {
            statuses: vec![ToolStatus {
                tool: "claude".to_owned(),
                binary_found: true,
                stored_profiles: 1,
                active_profile: Some("work".to_owned()),
                auth_method: None,
                credential_backend: None,
                state_mode: Some("shared".to_owned()),
                active_profile_applied: None,
                credentials_present: None,
                permissions_ok: None,
                token_warning: None,
                warnings: vec![],
            }],
            profiles: HashMap::new(),
            contexts: vec![],
            workspace_status: None,
            project_bindings: None,
        };
        let claude = tray_use_profile_request("claude".to_owned(), "work".to_owned(), Some(&snapshot));
        assert_eq!(claude.tool, "claude");
        assert_eq!(claude.profile, "work");
        assert_eq!(claude.state_mode.as_deref(), Some("shared"));

        let gemini = tray_use_profile_request("gemini".to_owned(), "travel".to_owned(), Some(&snapshot));
        assert_eq!(gemini.tool, "gemini");
        assert_eq!(gemini.profile, "travel");
        assert_eq!(gemini.state_mode, None);
    }

    #[test]
    fn tray_actions_map_ids_to_matching_commands() {
        assert_eq!(parse_tray_action("open"), TrayAction::Open);
        assert_eq!(parse_tray_action("diagnostics"), TrayAction::OpenDiagnostics);
        assert_eq!(parse_tray_action("quit"), TrayAction::Quit);
        assert_eq!(
            parse_tray_action("context:client-acme"),
            TrayAction::UseContext("client-acme".to_owned())
        );
        assert_eq!(
            parse_tray_action("switch-all:work"),
            TrayAction::UseAllProfiles("work".to_owned())
        );
        assert_eq!(
            parse_tray_action("profile-set:client-acme"),
            TrayAction::ActivateProfileSet("client-acme".to_owned())
        );
        assert_eq!(
            parse_tray_action("profile:gemini:travel"),
            TrayAction::UseProfile {
                tool: "gemini".to_owned(),
                profile: "travel".to_owned(),
            }
        );
        assert_eq!(parse_tray_action("profile:gemini"), TrayAction::Unknown);
        assert_eq!(parse_tray_action("something-else"), TrayAction::Unknown);
    }

    #[test]
    fn tray_error_payloads_include_structured_kind() {
        let payload = build_tray_command_result_event(
            Err(ErrorPayload {
                kind: GuiErrorKind::ProfileMissing,
                message: "profile work no longer exists".to_owned(),
                remediation: Some(
                    "Refresh profile state or recreate the missing profile before retrying."
                        .to_owned(),
                ),
            }),
            TrayCommandScope::Tool {
                tool: "claude".to_owned(),
            },
            "Switch profile",
            "Switched claude to work.".to_owned(),
        );

        assert_eq!(payload.status, "error");
        assert!(matches!(payload.kind, Some(GuiErrorKind::ProfileMissing)));
        assert_eq!(payload.message, "profile work no longer exists");
    }

    #[test]
    fn tray_success_payloads_omit_structured_kind() {
        let payload = build_tray_command_result_event(
            Ok(MutationResponse {
                command: "use_profile".to_owned(),
                raw: serde_json::json!({ "ok": true }),
                snapshot: AppSnapshot {
                    statuses: vec![],
                    profiles: HashMap::new(),
                    contexts: vec![],
                    workspace_status: None,
                    project_bindings: None,
                },
            }),
            TrayCommandScope::Global {
                id: "switch-all".to_owned(),
            },
            "Switch all profiles",
            "Switched all tools to work.".to_owned(),
        );

        assert_eq!(payload.status, "success");
        assert!(payload.kind.is_none());
        assert_eq!(payload.message, "Switched all tools to work.");
    }

    #[test]
    fn tray_context_display_label_prefers_profile_set_label() {
        let settings = DesktopSettings {
            runtime_kind: RuntimeKind::Bundled,
            runtime_path: None,
            aisw_home: None,
            update_channel: "stable".to_owned(),
            profile_labels: HashMap::new(),
            profile_sets: vec![ProfileSet {
                name: "client-acme".to_owned(),
                label: Some("Client Acme".to_owned()),
                profiles: HashMap::new(),
            }],
        };

        assert_eq!(
            tray_context_display_label(Some(&settings), "client-acme"),
            "Client Acme"
        );
        assert_eq!(
            tray_context_display_label(Some(&settings), "raw-context"),
            "raw-context"
        );
    }

    #[test]
    fn tray_context_entry_label_marks_the_active_context() {
        let settings = DesktopSettings {
            runtime_kind: RuntimeKind::Bundled,
            runtime_path: None,
            aisw_home: None,
            update_channel: "stable".to_owned(),
            profile_labels: HashMap::new(),
            profile_sets: vec![ProfileSet {
                name: "client-acme".to_owned(),
                label: Some("Client Acme".to_owned()),
                profiles: HashMap::new(),
            }],
        };
        let snapshot = AppSnapshot {
            statuses: vec![],
            profiles: HashMap::new(),
            contexts: vec![ContextSummary {
                name: "client-acme".to_owned(),
                profiles: HashMap::new(),
            }],
            workspace_status: Some(crate::models::WorkspaceStatusReport {
                raw: serde_json::json!({
                    "status": "match",
                    "current_context": "client-acme",
                }),
            }),
            project_bindings: None,
        };

        assert_eq!(
            tray_context_entry_label(Some(&settings), &snapshot, "client-acme"),
            "Client Acme ✓"
        );
        assert_eq!(
            tray_context_entry_label(Some(&settings), &snapshot, "raw-context"),
            "raw-context"
        );
    }

    #[test]
    fn tray_profile_display_label_prefers_saved_overrides() {
        let settings = DesktopSettings {
            runtime_kind: RuntimeKind::Bundled,
            runtime_path: None,
            aisw_home: None,
            update_channel: "stable".to_owned(),
            profile_labels: HashMap::from([(
                "claude".to_owned(),
                HashMap::from([("work".to_owned(), Some("Work Laptop".to_owned()))]),
            )]),
            profile_sets: vec![],
        };
        let snapshot = AppSnapshot {
            statuses: vec![],
            profiles: HashMap::from([(
                "claude".to_owned(),
                ToolProfiles {
                    active: Some("work".to_owned()),
                    profiles: vec![ToolProfileSummary {
                        name: "work".to_owned(),
                        auth: "oauth".to_owned(),
                        label: Some("Work".to_owned()),
                    }],
                },
            )]),
            contexts: vec![],
            workspace_status: None,
            project_bindings: None,
        };

        assert_eq!(
            tray_profile_display_name(Some(&settings), &snapshot, "claude", "work"),
            "Work Laptop"
        );
        assert_eq!(
            tray_profile_display_name(None, &snapshot, "claude", "work"),
            "Work"
        );
        assert_eq!(
            tray_profile_display_name(None, &snapshot, "claude", "personal"),
            "Personal"
        );
    }

    #[test]
    fn tray_global_requests_preserve_current_mode() {
        let shared_snapshot = AppSnapshot {
            statuses: vec![
                ToolStatus {
                    tool: "claude".to_owned(),
                    binary_found: true,
                    stored_profiles: 1,
                    active_profile: Some("work".to_owned()),
                    auth_method: None,
                    credential_backend: None,
                    state_mode: Some("shared".to_owned()),
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
                    state_mode: Some("shared".to_owned()),
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
        let context = tray_use_context_request("client-acme".to_owned(), Some(&shared_snapshot));
        assert_eq!(context.context, "client-acme");
        assert_eq!(context.state_mode.as_deref(), Some("shared"));

        let switch_all = tray_use_all_profiles_request("work".to_owned(), Some(&shared_snapshot));
        assert_eq!(switch_all.profile, "work");
        assert_eq!(switch_all.state_mode.as_deref(), Some("shared"));

        let isolated = tray_use_context_request("client-acme".to_owned(), None);
        assert_eq!(isolated.state_mode.as_deref(), Some("isolated"));
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
