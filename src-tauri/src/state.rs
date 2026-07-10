use crate::bridge::{AiswBridge, CliAiswBridge};
use crate::errors::{DesktopError, DesktopResult, ErrorPayload, GuiErrorKind};
use crate::models::{
    AppBootstrap, AppSnapshot, CapabilitiesInfo, DesktopSettings, MutationResponse, ProfileSet,
    RuntimeStatus, UpdateSettingsRequest, UseAllProfilesRequest, UseContextRequest,
    UseProfileRequest, VersionInfo,
};
use crate::settings::SettingsStore;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::Mutex;

#[derive(Clone)]
pub struct AppState {
    settings: SettingsStore,
    mutation_lock: Arc<Mutex<()>>,
}

impl AppState {
    pub fn new(settings: SettingsStore) -> Self {
        Self {
            settings,
            mutation_lock: Arc::new(Mutex::new(())),
        }
    }

    pub async fn load_settings(&self) -> Result<DesktopSettings, DesktopError> {
        self.settings.load().await
    }

    pub async fn update_settings(
        &self,
        request: UpdateSettingsRequest,
    ) -> Result<DesktopSettings, DesktopError> {
        self.settings.save(request).await
    }

    pub async fn bootstrap(&self) -> DesktopResult<AppBootstrap> {
        let settings = self.load_settings().await.map_err(ErrorPayload::from)?;
        let bridge = self.bridge_from_settings(&settings);
        let runtime_status = self.runtime_status(&*bridge).await;
        let snapshot = if runtime_status.compatible {
            Some(
                self.fetch_snapshot(&*bridge)
                    .await
                    .map_err(ErrorPayload::from)?,
            )
        } else {
            None
        };

        Ok(AppBootstrap {
            settings,
            runtime_status,
            snapshot,
        })
    }

    pub async fn snapshot(&self) -> DesktopResult<AppSnapshot> {
        let settings = self.load_settings().await.map_err(ErrorPayload::from)?;
        let bridge = self.bridge_from_settings(&settings);
        self.fetch_snapshot(&*bridge)
            .await
            .map_err(ErrorPayload::from)
    }

    pub async fn mutate<F, Fut>(&self, command: &str, f: F) -> DesktopResult<MutationResponse>
    where
        F: FnOnce(Arc<dyn AiswBridge>) -> Fut,
        Fut: std::future::Future<Output = Result<serde_json::Value, DesktopError>>,
    {
        let _guard = self.mutation_lock.lock().await;
        let settings = self.load_settings().await.map_err(ErrorPayload::from)?;
        let bridge = self.bridge_from_settings(&settings);
        let raw = f(bridge.clone()).await.map_err(ErrorPayload::from)?;
        let snapshot = self
            .fetch_snapshot(&*bridge)
            .await
            .map_err(ErrorPayload::from)?;
        Ok(MutationResponse {
            command: command.to_owned(),
            raw,
            snapshot,
        })
    }

    pub async fn mutate_cli<F, Fut>(&self, command: &str, f: F) -> DesktopResult<MutationResponse>
    where
        F: FnOnce(CliAiswBridge) -> Fut,
        Fut: std::future::Future<Output = Result<serde_json::Value, DesktopError>>,
    {
        let _guard = self.mutation_lock.lock().await;
        let settings = self.load_settings().await.map_err(ErrorPayload::from)?;
        let bridge = CliAiswBridge::new(
            settings.runtime_kind.clone(),
            settings.runtime_path.as_ref().map(PathBuf::from),
            settings.aisw_home.as_ref().map(PathBuf::from),
        );
        let raw = f(bridge.clone()).await.map_err(ErrorPayload::from)?;
        let snapshot = self
            .fetch_snapshot(&bridge)
            .await
            .map_err(ErrorPayload::from)?;
        Ok(MutationResponse {
            command: command.to_owned(),
            raw,
            snapshot,
        })
    }

    pub async fn activate_profile_set(&self, name: &str) -> DesktopResult<MutationResponse> {
        let _guard = self.mutation_lock.lock().await;
        let settings = self.load_settings().await.map_err(ErrorPayload::from)?;
        let bridge = self.bridge_from_settings(&settings);
        let set = settings
            .profile_sets
            .iter()
            .find(|entry| entry.name == name)
            .cloned()
            .ok_or_else(|| ErrorPayload {
                kind: GuiErrorKind::ContextMissing,
                message: format!("Profile set {name} no longer exists."),
                remediation: Some(
                    "Refresh settings or recreate the profile set before trying again."
                        .to_owned(),
                ),
            })?;

        let contexts = bridge.list_contexts().await.unwrap_or_default();
        let current_snapshot = self
            .fetch_snapshot(&*bridge)
            .await
            .map_err(ErrorPayload::from)?;
        let raw = activate_profile_set_on_bridge(&*bridge, &set, &contexts, &current_snapshot).await?;
        let snapshot = self
            .fetch_snapshot(&*bridge)
            .await
            .map_err(ErrorPayload::from)?;
        Ok(MutationResponse {
            command: "activate_profile_set".to_owned(),
            raw,
            snapshot,
        })
    }

    fn bridge_from_settings(&self, settings: &DesktopSettings) -> Arc<dyn AiswBridge> {
        Arc::new(CliAiswBridge::new(
            settings.runtime_kind.clone(),
            settings.runtime_path.as_ref().map(PathBuf::from),
            settings.aisw_home.as_ref().map(PathBuf::from),
        ))
    }

    async fn runtime_status(&self, bridge: &dyn AiswBridge) -> RuntimeStatus {
        let resolved_path = bridge
            .resolve_binary()
            .await
            .ok()
            .map(|path| path.to_string_lossy().to_string());
        let inventory = bridge.runtime_inventory().await;
        let version = bridge.version().await.ok();
        let capabilities = bridge.capabilities().await.ok();
        let compatible = version
            .as_ref()
            .zip(capabilities.as_ref())
            .map(|(version, capabilities)| is_compatible(version, capabilities))
            .unwrap_or(false);
        let mut issues = Vec::new();
        if resolved_path.is_none() {
            issues.push("aisw binary could not be resolved".to_owned());
        }
        if let Some(version) = &version {
            if version.cli_api_version != 1 || version.json_schema_version != 1 {
                issues.push(
                    "aisw contract version is not supported by this desktop build".to_owned(),
                );
            }
        } else {
            issues.push("aisw version info is unavailable".to_owned());
        }
        if let Some(capabilities) = &capabilities {
            if !capabilities
                .features
                .get("mutation_json")
                .copied()
                .unwrap_or(false)
            {
                issues.push("aisw does not advertise mutation_json support".to_owned());
            }
        } else {
            issues.push("aisw capabilities info is unavailable".to_owned());
        }

        RuntimeStatus {
            resolved_path,
            version,
            capabilities,
            inventory,
            compatible,
            issues,
        }
    }

    async fn fetch_snapshot(&self, bridge: &dyn AiswBridge) -> Result<AppSnapshot, DesktopError> {
        Ok(AppSnapshot {
            statuses: bridge.status().await?,
            profiles: bridge.list_profiles().await?,
            contexts: bridge.list_contexts().await.unwrap_or_default(),
            workspace_status: bridge.workspace_status().await.ok(),
            project_bindings: bridge.project_bindings().await.ok(),
        })
    }
}

fn is_compatible(version: &VersionInfo, capabilities: &CapabilitiesInfo) -> bool {
    version.cli_api_version == 1
        && version.json_schema_version == 1
        && capabilities
            .features
            .get("mutation_json")
            .copied()
            .unwrap_or(false)
}

pub fn incompatible_runtime_error() -> ErrorPayload {
    ErrorPayload {
        kind: GuiErrorKind::AiswIncompatible,
        message: "The configured aisw runtime is not compatible with AISW Desktop.".to_owned(),
        remediation: Some(
            "Select a compatible aisw build or switch back to the bundled runtime.".to_owned(),
        ),
    }
}

async fn activate_profile_set_on_bridge(
    bridge: &dyn AiswBridge,
    set: &ProfileSet,
    contexts: &[crate::models::ContextSummary],
    snapshot: &AppSnapshot,
) -> Result<serde_json::Value, ErrorPayload> {
    if contexts.iter().any(|context| context.name == set.name) {
        return bridge
            .use_context(UseContextRequest {
                context: set.name.clone(),
                state_mode: preferred_global_state_mode(Some(snapshot)),
            })
            .await
            .map(|raw| {
                serde_json::json!({
                    "strategy": "context",
                    "name": set.name,
                    "raw": raw,
                })
            })
            .map_err(ErrorPayload::from);
    }

    let selected = set
        .profiles
        .iter()
        .filter_map(|(tool, profile)| profile.as_ref().map(|profile| (tool.clone(), profile.clone())))
        .collect::<Vec<_>>();

    if selected.is_empty() {
        return Ok(serde_json::json!({
            "strategy": "noop",
            "name": set.name,
            "reason": "no_profiles_selected",
        }));
    }

    let unique_profiles = selected
        .iter()
        .map(|(_, profile)| profile.clone())
        .collect::<std::collections::BTreeSet<_>>();
    if unique_profiles.len() == 1 && selected.len() > 1 {
        let profile = unique_profiles.into_iter().next().unwrap_or_default();
        return bridge
            .use_all_profiles(UseAllProfilesRequest {
                profile: profile.clone(),
                state_mode: preferred_global_state_mode(Some(snapshot)),
            })
            .await
            .map(|raw| {
                serde_json::json!({
                    "strategy": "switch_all",
                    "name": set.name,
                    "profile": profile,
                    "raw": raw,
                })
            })
            .map_err(ErrorPayload::from);
    }

    let mut operations = Vec::with_capacity(selected.len());
    for (tool, profile) in selected {
        let raw = bridge
            .use_profile(UseProfileRequest {
                tool: tool.clone(),
                profile: profile.clone(),
                state_mode: preferred_tool_state_mode(&tool, Some(snapshot)),
            })
            .await
            .map_err(ErrorPayload::from)?;
        operations.push(serde_json::json!({
            "tool": tool,
            "profile": profile,
            "raw": raw,
        }));
    }

    Ok(serde_json::json!({
        "strategy": "per_tool",
        "name": set.name,
        "operations": operations,
    }))
}

pub(crate) fn preferred_global_state_mode(snapshot: Option<&AppSnapshot>) -> Option<String> {
    let Some(snapshot) = snapshot else {
        return Some("isolated".to_owned());
    };

    let editable_statuses = snapshot
        .statuses
        .iter()
        .filter(|status| status.tool != "gemini")
        .collect::<Vec<_>>();

    if editable_statuses.is_empty() {
        return Some("isolated".to_owned());
    }

    if editable_statuses
        .iter()
        .all(|status| status.state_mode.as_deref() == Some("shared"))
    {
        Some("shared".to_owned())
    } else {
        Some("isolated".to_owned())
    }
}

pub(crate) fn preferred_tool_state_mode(
    tool: &str,
    snapshot: Option<&AppSnapshot>,
) -> Option<String> {
    if tool == "gemini" {
        return None;
    }

    match snapshot
        .and_then(|entry| entry.statuses.iter().find(|status| status.tool == tool))
        .and_then(|status| status.state_mode.as_deref())
    {
        Some("shared") => Some("shared".to_owned()),
        _ => Some("isolated".to_owned()),
    }
}

#[cfg(test)]
mod tests {
    use super::{preferred_global_state_mode, preferred_tool_state_mode};
    use crate::models::{AppSnapshot, ToolStatus};
    use std::collections::HashMap;

    fn status(tool: &str, state_mode: Option<&str>) -> ToolStatus {
        ToolStatus {
            tool: tool.to_owned(),
            binary_found: true,
            stored_profiles: 1,
            active_profile: Some("work".to_owned()),
            auth_method: None,
            credential_backend: None,
            state_mode: state_mode.map(str::to_owned),
            active_profile_applied: None,
            credentials_present: None,
            permissions_ok: None,
            token_warning: None,
            warnings: vec![],
        }
    }

    fn snapshot(statuses: Vec<ToolStatus>) -> AppSnapshot {
        AppSnapshot {
            statuses,
            profiles: HashMap::new(),
            contexts: vec![],
            workspace_status: None,
            project_bindings: None,
        }
    }

    #[test]
    fn preferred_global_state_mode_preserves_shared_when_all_editable_tools_match() {
        let snapshot = snapshot(vec![status("claude", Some("shared")), status("codex", Some("shared"))]);
        assert_eq!(preferred_global_state_mode(Some(&snapshot)).as_deref(), Some("shared"));
    }

    #[test]
    fn preferred_global_state_mode_falls_back_to_isolated_for_missing_or_mixed_modes() {
        let mixed = snapshot(vec![status("claude", Some("shared")), status("codex", Some("isolated"))]);
        assert_eq!(preferred_global_state_mode(Some(&mixed)).as_deref(), Some("isolated"));

        let missing = snapshot(vec![status("claude", None), status("gemini", None)]);
        assert_eq!(preferred_global_state_mode(Some(&missing)).as_deref(), Some("isolated"));
        assert_eq!(preferred_global_state_mode(None).as_deref(), Some("isolated"));
    }

    #[test]
    fn preferred_tool_state_mode_preserves_shared_for_supported_tools_only() {
        let snapshot = snapshot(vec![status("claude", Some("shared")), status("gemini", None)]);
        assert_eq!(
            preferred_tool_state_mode("claude", Some(&snapshot)).as_deref(),
            Some("shared")
        );
        assert_eq!(preferred_tool_state_mode("codex", Some(&snapshot)).as_deref(), Some("isolated"));
        assert_eq!(preferred_tool_state_mode("gemini", Some(&snapshot)), None);
    }
}
