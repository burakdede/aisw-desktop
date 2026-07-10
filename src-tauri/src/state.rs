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

const REQUIRED_RUNTIME_FEATURES: &[&str] = &[
    "api_key_stdin",
    "mutation_json",
    "progress_json",
    "non_prompting_init",
    "detect_live_init",
    "verify",
    "repair",
    "contexts",
    "workspace_bindings",
    "project_bindings_alias",
];

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

    pub async fn run_init(&self) -> DesktopResult<crate::models::InitReport> {
        self.with_mutation_lock(|| async {
            let settings = self.load_settings().await.map_err(ErrorPayload::from)?;
            let bridge = self.bridge_from_settings(&settings);
            bridge.init().await.map_err(ErrorPayload::from)
        })
        .await
    }

    pub async fn mutate<F, Fut>(&self, command: &str, f: F) -> DesktopResult<MutationResponse>
    where
        F: FnOnce(Arc<dyn AiswBridge>) -> Fut,
        Fut: std::future::Future<Output = Result<serde_json::Value, DesktopError>>,
    {
        self.with_mutation_lock(|| async {
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
        })
        .await
    }

    pub async fn mutate_cli<F, Fut>(&self, command: &str, f: F) -> DesktopResult<MutationResponse>
    where
        F: FnOnce(CliAiswBridge) -> Fut,
        Fut: std::future::Future<Output = Result<serde_json::Value, DesktopError>>,
    {
        self.with_mutation_lock(|| async {
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
        })
        .await
    }

    pub async fn activate_profile_set(&self, name: &str) -> DesktopResult<MutationResponse> {
        self.with_mutation_lock(|| async {
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
            let raw =
                activate_profile_set_on_bridge(&*bridge, &set, &contexts, &current_snapshot)
                    .await?;
            let snapshot = self
                .fetch_snapshot(&*bridge)
                .await
                .map_err(ErrorPayload::from)?;
            Ok(MutationResponse {
                command: "activate_profile_set".to_owned(),
                raw,
                snapshot,
            })
        })
        .await
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
            for feature in missing_required_features(capabilities) {
                issues.push(format!("aisw does not advertise {feature} support"));
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

    async fn with_mutation_lock<T, F, Fut>(&self, f: F) -> DesktopResult<T>
    where
        F: FnOnce() -> Fut,
        Fut: std::future::Future<Output = DesktopResult<T>>,
    {
        let _guard = self.mutation_lock.lock().await;
        f().await
    }
}

fn is_compatible(version: &VersionInfo, capabilities: &CapabilitiesInfo) -> bool {
    version.cli_api_version == 1
        && version.json_schema_version == 1
        && missing_required_features(capabilities).is_empty()
}

fn missing_required_features(capabilities: &CapabilitiesInfo) -> Vec<&'static str> {
    REQUIRED_RUNTIME_FEATURES
        .iter()
        .copied()
        .filter(|feature| !capabilities.features.get(*feature).copied().unwrap_or(false))
        .collect()
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
    use super::{
        is_compatible, missing_required_features, preferred_global_state_mode,
        preferred_tool_state_mode,
    };
    use crate::models::{AppSnapshot, CapabilitiesInfo, ToolCapabilities, ToolStatus, VersionInfo};
    use crate::settings::SettingsStore;
    use std::collections::HashMap;
    use std::time::{Duration, SystemTime, UNIX_EPOCH};
    use tokio::sync::{mpsc, oneshot};

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

    fn version() -> VersionInfo {
        VersionInfo {
            version: "0.4.0".to_owned(),
            cli_api_version: 1,
            json_schema_version: 1,
            progress_schema_version: 1,
        }
    }

    fn capabilities_with_features(features: &[&str]) -> CapabilitiesInfo {
        let feature_flags = features
            .iter()
            .map(|feature| ((*feature).to_owned(), true))
            .collect::<HashMap<_, _>>();
        let tools = ["claude", "codex", "gemini"]
            .into_iter()
            .map(|tool| {
                (
                    tool.to_owned(),
                    ToolCapabilities {
                        auth_methods: vec![],
                        state_modes: vec![],
                        credential_backends: vec![],
                        fail_closed_keyring_identity: false,
                    },
                )
            })
            .collect::<HashMap<_, _>>();

        CapabilitiesInfo {
            features: feature_flags,
            tools,
        }
    }

    #[test]
    fn compatible_runtime_requires_full_desktop_feature_set() {
        let capabilities = capabilities_with_features(super::REQUIRED_RUNTIME_FEATURES);
        assert!(is_compatible(&version(), &capabilities));

        let missing_progress = capabilities_with_features(&[
            "api_key_stdin",
            "mutation_json",
            "non_prompting_init",
            "detect_live_init",
            "verify",
            "repair",
            "contexts",
            "workspace_bindings",
            "project_bindings_alias",
        ]);
        assert!(!is_compatible(&version(), &missing_progress));
    }

    #[test]
    fn missing_required_features_reports_every_missing_runtime_capability() {
        let capabilities = capabilities_with_features(&["mutation_json", "verify"]);
        assert_eq!(
            missing_required_features(&capabilities),
            vec![
                "api_key_stdin",
                "progress_json",
                "non_prompting_init",
                "detect_live_init",
                "repair",
                "contexts",
                "workspace_bindings",
                "project_bindings_alias",
            ]
        );
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

    #[tokio::test]
    async fn mutation_lock_serializes_concurrent_operations() {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or(Duration::from_secs(0))
            .as_nanos();
        let state = super::AppState::new(SettingsStore::new(
            std::env::temp_dir().join(format!("aisw-desktop-state-test-{unique}")),
        ));
        let (events_tx, mut events_rx) = mpsc::unbounded_channel::<&'static str>();
        let (release_first_tx, release_first_rx) = oneshot::channel::<()>();

        let first = {
            let state = state.clone();
            let events_tx = events_tx.clone();
            tokio::spawn(async move {
                state
                    .with_mutation_lock(|| async move {
                        events_tx.send("first-entered").unwrap();
                        let _ = release_first_rx.await;
                        events_tx.send("first-exiting").unwrap();
                        Ok::<(), crate::errors::ErrorPayload>(())
                    })
                    .await
                    .unwrap();
            })
        };

        assert_eq!(events_rx.recv().await, Some("first-entered"));

        let second = {
            let state = state.clone();
            let events_tx = events_tx.clone();
            tokio::spawn(async move {
                state
                    .with_mutation_lock(|| async move {
                        events_tx.send("second-entered").unwrap();
                        Ok::<(), crate::errors::ErrorPayload>(())
                    })
                    .await
                    .unwrap();
            })
        };

        tokio::task::yield_now().await;
        tokio::task::yield_now().await;
        assert!(events_rx.try_recv().is_err());

        let _ = release_first_tx.send(());
        assert_eq!(events_rx.recv().await, Some("first-exiting"));
        assert_eq!(events_rx.recv().await, Some("second-entered"));

        first.await.unwrap();
        second.await.unwrap();
    }
}
