use crate::errors::DesktopError;
use crate::redaction::redact_text;
use serde::Serialize;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone, Serialize)]
pub struct DiagnosticBundleExport {
    pub path: String,
    pub filename: String,
    pub generated_at: String,
}

pub fn write_redacted_bundle<T: Serialize>(
    payload: &T,
    output_dir: &Path,
) -> Result<DiagnosticBundleExport, DesktopError> {
    std::fs::create_dir_all(output_dir)?;

    let timestamp = bundle_timestamp();
    let filename = format!("ai-switch-diagnostics-{timestamp}.json");
    let path = output_dir.join(&filename);
    let generated_at = iso_timestamp();
    let json = serde_json::to_string_pretty(payload)?;
    let redacted = redact_text(&json);
    std::fs::write(&path, redacted)?;

    Ok(DiagnosticBundleExport {
        path: path.to_string_lossy().to_string(),
        filename,
        generated_at,
    })
}

pub fn default_output_dir() -> PathBuf {
    std::env::temp_dir().join("ai-switch")
}

fn bundle_timestamp() -> String {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs().to_string())
        .unwrap_or_else(|_| "0".to_owned())
}

fn iso_timestamp() -> String {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| format!("unix:{}", duration.as_secs()))
        .unwrap_or_else(|_| "unix:0".to_owned())
}

#[cfg(test)]
mod tests {
    use super::write_redacted_bundle;
    use serde_json::json;
    use tempfile::tempdir;

    #[test]
    fn writes_redacted_bundle_to_disk() {
        let dir = tempdir().unwrap();
        let export = write_redacted_bundle(
            &json!({
                "doctor": {
                    "detail": "token sk-ant-api03-secret"
                },
                "verify": {
                    "secondary": "AIzaSecret123"
                }
            }),
            dir.path(),
        )
        .unwrap();

        assert!(export.path.ends_with(".json"));
        let written = std::fs::read_to_string(&export.path).unwrap();
        assert!(written.contains("[REDACTED]"));
        assert!(!written.contains("sk-ant-api03-secret"));
        assert!(!written.contains("AIzaSecret123"));
    }
}
