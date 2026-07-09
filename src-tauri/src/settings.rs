use crate::errors::DesktopError;
use crate::models::{DesktopSettings, UpdateSettingsRequest};
use std::path::PathBuf;

const SETTINGS_FILE: &str = "settings.json";

#[derive(Clone)]
pub struct SettingsStore {
    path: PathBuf,
}

impl SettingsStore {
    pub fn new(base_dir: PathBuf) -> Self {
        Self {
            path: base_dir.join(SETTINGS_FILE),
        }
    }

    pub async fn load(&self) -> Result<DesktopSettings, DesktopError> {
        if !self.path.exists() {
            return Ok(DesktopSettings::default());
        }

        let bytes = tokio::fs::read(&self.path).await?;
        Ok(serde_json::from_slice(&bytes)?)
    }

    pub async fn save(
        &self,
        request: UpdateSettingsRequest,
    ) -> Result<DesktopSettings, DesktopError> {
        if let Some(parent) = self.path.parent() {
            tokio::fs::create_dir_all(parent).await?;
        }

        let settings = DesktopSettings {
            runtime_kind: request.runtime_kind,
            runtime_path: request.runtime_path,
            aisw_home: request.aisw_home,
            update_channel: request.update_channel,
        };
        let bytes = serde_json::to_vec_pretty(&settings)?;
        tokio::fs::write(&self.path, bytes).await?;
        Ok(settings)
    }
}

#[cfg(test)]
mod tests {
    use super::SettingsStore;
    use crate::models::{RuntimeKind, UpdateSettingsRequest};
    use tempfile::tempdir;

    #[tokio::test]
    async fn round_trips_settings() {
        let dir = tempdir().unwrap();
        let store = SettingsStore::new(dir.path().to_path_buf());
        let saved = store
            .save(UpdateSettingsRequest {
                runtime_kind: RuntimeKind::Custom,
                runtime_path: Some("/tmp/aisw".to_owned()),
                aisw_home: Some("/tmp/home".to_owned()),
                update_channel: "beta".to_owned(),
            })
            .await
            .unwrap();

        assert_eq!(saved.update_channel, "beta");
        let loaded = store.load().await.unwrap();
        assert_eq!(loaded.runtime_path.as_deref(), Some("/tmp/aisw"));
    }
}
