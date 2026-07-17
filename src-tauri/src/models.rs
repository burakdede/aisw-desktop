use serde::{Deserialize, Serialize};
use std::collections::HashMap;

pub type ToolId = String;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RuntimeKind {
    Bundled,
    System,
    Custom,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DesktopSettings {
    pub runtime_kind: RuntimeKind,
    pub runtime_path: Option<String>,
    pub aisw_home: Option<String>,
    pub update_channel: String,
    #[serde(default)]
    pub profile_labels: HashMap<ToolId, HashMap<String, Option<String>>>,
    #[serde(default)]
    pub profile_sets: Vec<ProfileSet>,
}

impl Default for DesktopSettings {
    fn default() -> Self {
        Self {
            runtime_kind: RuntimeKind::Bundled,
            runtime_path: None,
            aisw_home: None,
            update_channel: "stable".to_owned(),
            profile_labels: HashMap::new(),
            profile_sets: Vec::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProfileSet {
    pub name: String,
    pub label: Option<String>,
    #[serde(default)]
    pub profiles: HashMap<ToolId, Option<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VersionInfo {
    pub version: String,
    pub cli_api_version: u32,
    pub json_schema_version: u32,
    pub progress_schema_version: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCapabilities {
    #[serde(default)]
    pub auth_methods: Vec<String>,
    #[serde(default)]
    pub state_modes: Vec<String>,
    #[serde(default)]
    pub credential_backends: Vec<String>,
    #[serde(default)]
    pub fail_closed_keyring_identity: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenWarning {
    pub code: Option<String>,
    pub severity: Option<String>,
    pub summary: Option<String>,
    pub message: Option<String>,
    pub provider: Option<String>,
    pub expires_at: Option<String>,
    pub expires_in_days: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiagnosticWarning {
    pub code: Option<String>,
    pub severity: Option<String>,
    pub message: Option<String>,
    pub remediation: Option<String>,
    pub command: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CapabilitiesInfo {
    pub features: HashMap<String, bool>,
    pub tools: HashMap<String, ToolCapabilities>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolStatus {
    pub tool: String,
    pub binary_found: bool,
    pub stored_profiles: u32,
    pub active_profile: Option<String>,
    pub auth_method: Option<String>,
    pub credential_backend: Option<String>,
    pub claude_auth_classification: Option<String>,
    pub codex_auth_classification: Option<String>,
    pub antigravity_auth_classification: Option<String>,
    pub state_mode: Option<String>,
    pub active_profile_applied: Option<bool>,
    pub credentials_present: Option<bool>,
    pub permissions_ok: Option<bool>,
    pub token_warning: Option<TokenWarning>,
    #[serde(default)]
    pub warnings: Vec<DiagnosticWarning>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolProfileSummary {
    pub name: String,
    pub auth: String,
    pub label: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolProfiles {
    pub active: Option<String>,
    #[serde(default)]
    pub profiles: Vec<ToolProfileSummary>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextSummary {
    pub name: String,
    pub profiles: HashMap<ToolId, Option<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DoctorReport {
    #[serde(flatten)]
    pub raw: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerifyReport {
    #[serde(flatten)]
    pub raw: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InitReport {
    #[serde(flatten)]
    pub raw: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RepairReport {
    #[serde(flatten)]
    pub raw: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceStatusReport {
    #[serde(flatten)]
    pub raw: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectBindingsReport {
    #[serde(flatten)]
    pub raw: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateInfo {
    pub version: String,
    pub current_version: String,
    pub target: String,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateCheckReport {
    pub configured: bool,
    pub channel: String,
    pub current_version: String,
    pub endpoint: Option<String>,
    pub update: Option<UpdateInfo>,
    pub message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstallUpdateReport {
    pub configured: bool,
    pub channel: String,
    pub current_version: String,
    pub installed_version: Option<String>,
    pub restart_requested: bool,
    pub message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShellHookVariant {
    pub shell: String,
    pub title: String,
    pub config_path: String,
    pub alternate_config_path: Option<String>,
    pub install_command: String,
    pub reload_command: String,
    pub verify_command: String,
    pub verify_expected: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShellHookGuidance {
    pub detected_shell: Option<String>,
    pub capabilities: Vec<String>,
    pub note: String,
    pub manual_apply_examples: Vec<String>,
    pub variants: Vec<ShellHookVariant>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LaunchAtLoginStatus {
    pub supported: bool,
    pub enabled: bool,
    pub detail: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupEntry {
    pub backup_id: String,
    pub tool: String,
    pub profile: String,
    pub created_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RuntimeInventory {
    pub bundled_path: Option<String>,
    pub system_path: Option<String>,
    pub configured_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppBootstrap {
    pub settings: DesktopSettings,
    pub runtime_status: RuntimeStatus,
    pub snapshot: Option<AppSnapshot>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RuntimeStatus {
    pub resolved_path: Option<String>,
    pub version: Option<VersionInfo>,
    pub capabilities: Option<CapabilitiesInfo>,
    pub inventory: RuntimeInventory,
    pub compatible: bool,
    pub issues: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSnapshot {
    pub statuses: Vec<ToolStatus>,
    pub profiles: HashMap<String, ToolProfiles>,
    pub contexts: Vec<ContextSummary>,
    pub workspace_status: Option<WorkspaceStatusReport>,
    pub project_bindings: Option<ProjectBindingsReport>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateSettingsRequest {
    pub runtime_kind: RuntimeKind,
    pub runtime_path: Option<String>,
    pub aisw_home: Option<String>,
    pub update_channel: String,
    #[serde(default)]
    pub profile_labels: HashMap<ToolId, HashMap<String, Option<String>>>,
    #[serde(default)]
    pub profile_sets: Vec<ProfileSet>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AddOAuthProfileRequest {
    pub tool: String,
    pub profile: String,
    pub label: Option<String>,
    pub state_mode: Option<String>,
    pub credential_backend: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AddProfileRequest {
    pub tool: String,
    pub profile: String,
    pub label: Option<String>,
    pub state_mode: Option<String>,
    pub credential_backend: Option<String>,
    pub import_mode: AddProfileMode,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum AddProfileMode {
    FromLive,
    FromEnv,
    ApiKey { value: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UseProfileRequest {
    pub tool: String,
    pub profile: String,
    pub state_mode: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UseAllProfilesRequest {
    pub profile: String,
    pub state_mode: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UseContextRequest {
    pub context: String,
    pub state_mode: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RepairRequest {
    pub apply: bool,
    #[serde(default)]
    pub fixes: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "scope", rename_all = "snake_case")]
pub enum WorkspaceBindTarget {
    Default,
    Path { path: String },
    GitRemote { pattern: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceBindRequest {
    pub target: WorkspaceBindTarget,
    pub context: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "scope", rename_all = "snake_case")]
pub enum WorkspaceUnbindTarget {
    Default,
    Path { path: String },
    GitRemote { pattern: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MutationResponse {
    pub command: String,
    #[serde(flatten)]
    pub raw: serde_json::Value,
    pub snapshot: AppSnapshot,
}
