use serde::Serialize;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum DesktopError {
    #[error("AI Switch could not resolve a compatible switching engine")]
    AiswNotFound,
    #[error("AI Switch received invalid engine data for {command}")]
    InvalidJson { command: String },
    #[error("AI Switch engine command failed for {command}")]
    CommandFailed {
        command: String,
        kind: GuiErrorKind,
        message: String,
        remediation: Option<String>,
    },
    #[error("settings persistence failed")]
    SettingsIo(#[from] std::io::Error),
    #[error("serialization failed")]
    Serialization(#[from] serde_json::Error),
}

#[derive(Debug, Clone, Serialize)]
#[allow(dead_code)]
#[serde(rename_all = "PascalCase")]
pub enum GuiErrorKind {
    AiswNotFound,
    AiswIncompatible,
    ToolMissing,
    ProfileMissing,
    ContextMissing,
    DuplicateProfile,
    LiveMismatch,
    PermissionDenied,
    KeyringUnavailable,
    OAuthTimeout,
    ConfigLockTimeout,
    InvalidStateMode,
    NonInteractiveMode,
    CommandContractError,
    Unknown,
}

#[derive(Debug, Clone, Serialize)]
pub struct ErrorPayload {
    pub kind: GuiErrorKind,
    pub message: String,
    pub remediation: Option<String>,
}

impl From<DesktopError> for ErrorPayload {
    fn from(value: DesktopError) -> Self {
        match value {
            DesktopError::AiswNotFound => Self {
                kind: GuiErrorKind::AiswNotFound,
                message: value.to_string(),
                remediation: Some(
                    "Select a valid bundled, system, or custom switching engine.".to_owned(),
                ),
            },
            DesktopError::InvalidJson { command } => Self {
                kind: GuiErrorKind::CommandContractError,
                message: format!("The selected switching engine returned invalid data for `{command}`."),
                remediation: Some(
                    "Check engine compatibility and command support before retrying.".to_owned(),
                ),
            },
            DesktopError::CommandFailed {
                kind,
                message,
                remediation,
                ..
            } => Self {
                kind,
                message,
                remediation,
            },
            DesktopError::SettingsIo(_) | DesktopError::Serialization(_) => Self {
                kind: GuiErrorKind::Unknown,
                message: "Desktop settings could not be loaded or saved.".to_owned(),
                remediation: Some(
                    "Check filesystem permissions for the app settings directory.".to_owned(),
                ),
            },
        }
    }
}

pub type DesktopResult<T> = Result<T, ErrorPayload>;
