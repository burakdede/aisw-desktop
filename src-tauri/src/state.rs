use crate::bridge::{AiswBridge, CliAiswBridge};
use crate::errors::{DesktopError, DesktopResult, ErrorPayload, GuiErrorKind};
use crate::models::{
    AppBootstrap, AppSnapshot, CapabilitiesInfo, DesktopSettings, MutationResponse, RuntimeStatus,
    UpdateSettingsRequest, VersionInfo,
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
