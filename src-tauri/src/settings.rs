use crate::errors::DesktopError;
use crate::models::{DesktopSettings, RuntimeKind, UpdateSettingsRequest};
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
        Ok(normalize_runtime_settings(serde_json::from_slice(&bytes)?))
    }

    pub async fn save(
        &self,
        request: UpdateSettingsRequest,
    ) -> Result<DesktopSettings, DesktopError> {
        if let Some(parent) = self.path.parent() {
            tokio::fs::create_dir_all(parent).await?;
        }

        let settings = normalize_runtime_settings(DesktopSettings {
            runtime_kind: request.runtime_kind,
            runtime_path: request.runtime_path,
            aisw_home: request.aisw_home,
            update_channel: request.update_channel,
            profile_labels: request.profile_labels,
            profile_sets: request.profile_sets,
        });
        let bytes = serde_json::to_vec_pretty(&settings)?;
        tokio::fs::write(&self.path, bytes).await?;
        Ok(settings)
    }
}

fn normalize_runtime_settings(mut settings: DesktopSettings) -> DesktopSettings {
    settings.runtime_path = match settings.runtime_kind {
        RuntimeKind::Custom => settings.runtime_path,
        RuntimeKind::Bundled | RuntimeKind::System => None,
    };
    settings
}

#[cfg(test)]
mod tests {
    use super::SettingsStore;
    use crate::models::{ProfileSet, RuntimeKind, UpdateSettingsRequest};
    use std::collections::HashMap;
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
                profile_labels: HashMap::from([(
                    "claude".to_owned(),
                    HashMap::from([("work".to_owned(), Some("Work".to_owned()))]),
                )]),
                profile_sets: vec![ProfileSet {
                    name: "work".to_owned(),
                    label: Some("Work".to_owned()),
                    profiles: HashMap::from([("claude".to_owned(), Some("work".to_owned()))]),
                }],
            })
            .await
            .unwrap();

        assert_eq!(saved.update_channel, "beta");
        assert_eq!(saved.profile_sets.len(), 1);
        let loaded = store.load().await.unwrap();
        assert_eq!(loaded.runtime_path.as_deref(), Some("/tmp/aisw"));
        assert_eq!(
            loaded
                .profile_labels
                .get("claude")
                .and_then(|items| items.get("work"))
                .and_then(|value| value.as_deref()),
            Some("Work")
        );
        assert_eq!(loaded.profile_sets[0].name, "work");
    }

    #[tokio::test]
    async fn clears_stale_runtime_path_for_non_custom_runtime() {
        let dir = tempdir().unwrap();
        let store = SettingsStore::new(dir.path().to_path_buf());
        let saved = store
            .save(UpdateSettingsRequest {
                runtime_kind: RuntimeKind::Bundled,
                runtime_path: Some("/tmp/aisw".to_owned()),
                aisw_home: None,
                update_channel: "stable".to_owned(),
                profile_labels: HashMap::new(),
                profile_sets: vec![],
            })
            .await
            .unwrap();

        assert_eq!(saved.runtime_path, None);
        let loaded = store.load().await.unwrap();
        assert_eq!(loaded.runtime_path, None);
    }

    #[tokio::test]
    async fn load_normalizes_legacy_non_custom_runtime_path() {
        let dir = tempdir().unwrap();
        let store = SettingsStore::new(dir.path().to_path_buf());
        tokio::fs::write(
            dir.path().join("settings.json"),
            r#"{
  "runtime_kind": "system",
  "runtime_path": "/tmp/aisw",
  "aisw_home": null,
  "update_channel": "stable",
  "profile_labels": {},
  "profile_sets": []
}"#,
        )
        .await
        .unwrap();

        let loaded = store.load().await.unwrap();
        assert_eq!(loaded.runtime_path, None);
    }
}
