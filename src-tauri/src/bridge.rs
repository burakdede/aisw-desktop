use crate::errors::{DesktopError, GuiErrorKind};
use crate::models::{
    AddProfileMode, AddProfileRequest, BackupEntry, CapabilitiesInfo, ContextSummary, DoctorReport,
    InitReport, ProjectBindingsReport, RepairReport, RepairRequest, RuntimeKind, ToolProfiles,
    ToolStatus, UseAllProfilesRequest, UseContextRequest, UseProfileRequest, VerifyReport,
    VersionInfo,
    WorkspaceBindRequest, WorkspaceBindTarget, WorkspaceStatusReport, WorkspaceUnbindTarget,
};
use crate::redaction::redact_text;
use async_trait::async_trait;
use serde::de::DeserializeOwned;
use std::collections::HashMap;
use std::path::PathBuf;
use tokio::io::AsyncWriteExt;
use tokio::process::Command;
use tracing::{debug, warn};

#[async_trait]
pub trait AiswBridge: Send + Sync {
    async fn resolve_binary(&self) -> Result<PathBuf, DesktopError>;
    async fn version(&self) -> Result<VersionInfo, DesktopError>;
    async fn capabilities(&self) -> Result<CapabilitiesInfo, DesktopError>;
    async fn status(&self) -> Result<Vec<ToolStatus>, DesktopError>;
    async fn list_profiles(&self) -> Result<HashMap<String, ToolProfiles>, DesktopError>;
    async fn list_contexts(&self) -> Result<Vec<ContextSummary>, DesktopError>;
    async fn doctor(&self) -> Result<DoctorReport, DesktopError>;
    async fn verify(&self) -> Result<VerifyReport, DesktopError>;
    async fn init(&self) -> Result<InitReport, DesktopError>;
    async fn workspace_status(&self) -> Result<WorkspaceStatusReport, DesktopError>;
    async fn project_bindings(&self) -> Result<ProjectBindingsReport, DesktopError>;
    async fn list_backups(&self) -> Result<Vec<BackupEntry>, DesktopError>;
    async fn add_profile(&self, req: AddProfileRequest) -> Result<serde_json::Value, DesktopError>;
    async fn use_profile(&self, req: UseProfileRequest) -> Result<serde_json::Value, DesktopError>;
    async fn use_all_profiles(
        &self,
        req: UseAllProfilesRequest,
    ) -> Result<serde_json::Value, DesktopError>;
    async fn use_context(&self, req: UseContextRequest) -> Result<serde_json::Value, DesktopError>;
    async fn rename_profile(
        &self,
        tool: String,
        old_name: String,
        new_name: String,
    ) -> Result<serde_json::Value, DesktopError>;
    async fn remove_profile(
        &self,
        tool: String,
        profile: String,
        force: bool,
    ) -> Result<serde_json::Value, DesktopError>;
    async fn repair(&self, req: RepairRequest) -> Result<RepairReport, DesktopError>;
    async fn restore_backup(&self, backup_id: String) -> Result<serde_json::Value, DesktopError>;
    async fn workspace_bind(
        &self,
        req: WorkspaceBindRequest,
    ) -> Result<serde_json::Value, DesktopError>;
    async fn workspace_unbind(
        &self,
        target: WorkspaceUnbindTarget,
    ) -> Result<serde_json::Value, DesktopError>;
    async fn workspace_guard(&self, mode: String) -> Result<serde_json::Value, DesktopError>;
}

#[derive(Clone)]
pub struct CliAiswBridge {
    pub runtime_kind: RuntimeKind,
    pub configured_path: Option<PathBuf>,
    pub aisw_home: Option<PathBuf>,
}

impl CliAiswBridge {
    pub fn new(
        runtime_kind: RuntimeKind,
        configured_path: Option<PathBuf>,
        aisw_home: Option<PathBuf>,
    ) -> Self {
        Self {
            runtime_kind,
            configured_path,
            aisw_home,
        }
    }

    async fn run_json<T: DeserializeOwned>(
        &self,
        command_name: &str,
        args: &[&str],
        stdin_payload: Option<&str>,
    ) -> Result<T, DesktopError> {
        let output = self.run_raw(command_name, args, stdin_payload).await?;
        serde_json::from_slice::<T>(&output).map_err(|_| DesktopError::InvalidJson {
            command: command_name.to_owned(),
        })
    }

    async fn run_raw(
        &self,
        command_name: &str,
        args: &[&str],
        stdin_payload: Option<&str>,
    ) -> Result<Vec<u8>, DesktopError> {
        let binary = self.resolve_binary().await?;
        let mut command = Command::new(binary);
        command.args(args);
        if let Some(home) = &self.aisw_home {
            command.env("AISW_HOME", home);
        }
        if stdin_payload.is_some() {
            command.stdin(std::process::Stdio::piped());
        }
        command.stdout(std::process::Stdio::piped());
        command.stderr(std::process::Stdio::piped());

        debug!("running aisw command `{command_name}` with args {:?}", args);
        let mut child = command.spawn().map_err(|_| DesktopError::AiswNotFound)?;

        if let Some(payload) = stdin_payload {
            if let Some(mut stdin) = child.stdin.take() {
                stdin.write_all(payload.as_bytes()).await.map_err(|err| {
                    DesktopError::CommandFailed {
                        command: command_name.to_owned(),
                        kind: GuiErrorKind::Unknown,
                        message: format!("Failed writing sensitive input: {err}"),
                        remediation: None,
                    }
                })?;
            }
        }

        let output = child.wait_with_output().await.map_err(|err| DesktopError::CommandFailed {
            command: command_name.to_owned(),
            kind: GuiErrorKind::Unknown,
            message: err.to_string(),
            remediation: None,
        })?;

        if output.status.success() {
            return Ok(output.stdout);
        }

        let stderr = redact_text(&String::from_utf8_lossy(&output.stderr));
        warn!("aisw command `{command_name}` failed: {stderr}");
        Err(map_command_failure(command_name, &stderr))
    }
}

#[async_trait]
impl AiswBridge for CliAiswBridge {
    async fn resolve_binary(&self) -> Result<PathBuf, DesktopError> {
        if let Some(path) = &self.configured_path {
            if path.exists() {
                return Ok(path.clone());
            }
        }

        if let Some(path) = std::env::var_os("AISW_DESKTOP_AISW_PATH") {
            let candidate = PathBuf::from(path);
            if candidate.exists() {
                return Ok(candidate);
            }
        }

        let fallback = PathBuf::from("aisw");
        match self.runtime_kind {
            RuntimeKind::Bundled | RuntimeKind::System | RuntimeKind::Custom => Ok(fallback),
        }
    }

    async fn version(&self) -> Result<VersionInfo, DesktopError> {
        self.run_json("version", &["version", "--json"], None).await
    }

    async fn capabilities(&self) -> Result<CapabilitiesInfo, DesktopError> {
        self.run_json("capabilities", &["capabilities", "--json"], None).await
    }

    async fn status(&self) -> Result<Vec<ToolStatus>, DesktopError> {
        self.run_json("status", &["status", "--json"], None).await
    }

    async fn list_profiles(&self) -> Result<HashMap<String, ToolProfiles>, DesktopError> {
        self.run_json("list", &["list", "--json"], None).await
    }

    async fn list_contexts(&self) -> Result<Vec<ContextSummary>, DesktopError> {
        let raw: serde_json::Value = self
            .run_json("context_list", &["context", "list", "--json"], None)
            .await?;
        parse_contexts(raw)
    }

    async fn doctor(&self) -> Result<DoctorReport, DesktopError> {
        self.run_json("doctor", &["doctor", "--json"], None).await
    }

    async fn verify(&self) -> Result<VerifyReport, DesktopError> {
        self.run_json("verify", &["verify", "--json"], None).await
    }

    async fn init(&self) -> Result<InitReport, DesktopError> {
        self.run_json(
            "init",
            &["init", "--json", "--no-shell-hook", "--detect-live"],
            None,
        )
        .await
    }

    async fn workspace_status(&self) -> Result<WorkspaceStatusReport, DesktopError> {
        self.run_json("workspace_status", &["workspace", "status", "--json"], None)
            .await
    }

    async fn project_bindings(&self) -> Result<ProjectBindingsReport, DesktopError> {
        self.run_json(
            "project_bindings",
            &["project-bindings", "list", "--json"],
            None,
        )
        .await
    }

    async fn list_backups(&self) -> Result<Vec<BackupEntry>, DesktopError> {
        self.run_json("backup_list", &["backup", "list", "--json"], None)
            .await
    }

    async fn add_profile(&self, req: AddProfileRequest) -> Result<serde_json::Value, DesktopError> {
        let mut args = vec!["add", req.tool.as_str(), req.profile.as_str(), "--json"];
        if let Some(label) = &req.label {
            args.extend(["--label", label.as_str()]);
        }
        if let Some(mode) = &req.state_mode {
            args.extend(["--state-mode", mode.as_str()]);
        }

        match req.import_mode {
            AddProfileMode::FromLive => {
                args.push("--from-live");
                self.run_json("add", &args, None).await
            }
            AddProfileMode::FromEnv => {
                args.push("--from-env");
                self.run_json("add", &args, None).await
            }
            AddProfileMode::ApiKey { value } => {
                args.push("--api-key-stdin");
                self.run_json("add", &args, Some(&value)).await
            }
        }
    }

    async fn use_profile(&self, req: UseProfileRequest) -> Result<serde_json::Value, DesktopError> {
        let mut args = vec!["use", req.tool.as_str(), req.profile.as_str(), "--json"];
        if let Some(state_mode) = &req.state_mode {
            args.extend(["--state-mode", state_mode.as_str()]);
        }
        self.run_json("use_profile", &args, None).await
    }

    async fn use_all_profiles(
        &self,
        req: UseAllProfilesRequest,
    ) -> Result<serde_json::Value, DesktopError> {
        let mut args = vec!["use", "--all", "--profile", req.profile.as_str(), "--json"];
        if let Some(state_mode) = &req.state_mode {
            args.extend(["--state-mode", state_mode.as_str()]);
        }
        self.run_json("use_all_profiles", &args, None).await
    }

    async fn use_context(&self, req: UseContextRequest) -> Result<serde_json::Value, DesktopError> {
        let mut args = vec!["context", "use", req.context.as_str(), "--json"];
        if let Some(state_mode) = &req.state_mode {
            args.extend(["--state-mode", state_mode.as_str()]);
        }
        self.run_json("use_context", &args, None).await
    }

    async fn rename_profile(
        &self,
        tool: String,
        old_name: String,
        new_name: String,
    ) -> Result<serde_json::Value, DesktopError> {
        self.run_json(
            "rename_profile",
            &["rename", &tool, &old_name, &new_name, "--json"],
            None,
        )
        .await
    }

    async fn remove_profile(
        &self,
        tool: String,
        profile: String,
        force: bool,
    ) -> Result<serde_json::Value, DesktopError> {
        let mut args = vec!["remove", tool.as_str(), profile.as_str(), "--json", "--yes"];
        if force {
            args.push("--force");
        }
        self.run_json("remove_profile", &args, None).await
    }

    async fn repair(&self, req: RepairRequest) -> Result<RepairReport, DesktopError> {
        let mut args = vec!["repair", "--json"];
        if req.apply {
            args.push("--apply");
        } else {
            args.push("--dry-run");
        }
        for fix in &req.fixes {
            args.extend(["--fix", fix.as_str()]);
        }
        self.run_json("repair", &args, None).await
    }

    async fn restore_backup(&self, backup_id: String) -> Result<serde_json::Value, DesktopError> {
        self.run_json(
            "backup_restore",
            &["backup", "restore", backup_id.as_str(), "--yes", "--json"],
            None,
        )
        .await
    }

    async fn workspace_bind(
        &self,
        req: WorkspaceBindRequest,
    ) -> Result<serde_json::Value, DesktopError> {
        let mut owned = vec!["workspace".to_owned(), "bind".to_owned()];
        match req.target {
            WorkspaceBindTarget::Default => owned.push("--default".to_owned()),
            WorkspaceBindTarget::Path { path } => owned.push(path),
            WorkspaceBindTarget::GitRemote { pattern } => {
                owned.push("--git-remote".to_owned());
                owned.push(pattern);
            }
        }
        owned.push("--context".to_owned());
        owned.push(req.context);
        owned.push("--json".to_owned());
        let args = owned.iter().map(String::as_str).collect::<Vec<_>>();
        self.run_json("workspace_bind", &args, None).await
    }

    async fn workspace_unbind(
        &self,
        target: WorkspaceUnbindTarget,
    ) -> Result<serde_json::Value, DesktopError> {
        let mut owned = vec!["workspace".to_owned(), "unbind".to_owned()];
        match target {
            WorkspaceUnbindTarget::Default => owned.push("--default".to_owned()),
            WorkspaceUnbindTarget::Path { path } => owned.push(path),
            WorkspaceUnbindTarget::GitRemote { pattern } => {
                owned.push("--git-remote".to_owned());
                owned.push(pattern);
            }
        }
        owned.push("--json".to_owned());
        let args = owned.iter().map(String::as_str).collect::<Vec<_>>();
        self.run_json("workspace_unbind", &args, None).await
    }

    async fn workspace_guard(&self, mode: String) -> Result<serde_json::Value, DesktopError> {
        self.run_json(
            "workspace_guard",
            &["workspace", "guard", "--mode", mode.as_str(), "--json"],
            None,
        )
        .await
    }
}

fn parse_contexts(raw: serde_json::Value) -> Result<Vec<ContextSummary>, DesktopError> {
    if let Some(items) = raw
        .get("contexts")
        .and_then(|value| value.as_array())
        .or_else(|| raw.as_array())
    {
        let mut contexts = Vec::with_capacity(items.len());
        for item in items {
            let name = item
                .get("name")
                .and_then(|value| value.as_str())
                .unwrap_or_default()
                .to_owned();
            let profiles = item
                .get("profiles")
                .and_then(|value| value.as_object())
                .map(|profiles| {
                    profiles
                        .iter()
                        .map(|(tool, profile)| (tool.clone(), profile.as_str().map(str::to_owned)))
                        .collect::<HashMap<_, _>>()
                })
                .unwrap_or_default();
            contexts.push(ContextSummary { name, profiles });
        }
        return Ok(contexts);
    }

    Err(DesktopError::InvalidJson {
        command: "context_list".to_owned(),
    })
}

fn map_command_failure(command: &str, stderr: &str) -> DesktopError {
    let lower = stderr.to_ascii_lowercase();
    let kind = if lower.contains("not found") {
        GuiErrorKind::ToolMissing
    } else if lower.contains("duplicate") {
        GuiErrorKind::DuplicateProfile
    } else if lower.contains("keyring") {
        GuiErrorKind::KeyringUnavailable
    } else if lower.contains("permission") {
        GuiErrorKind::PermissionDenied
    } else if lower.contains("timeout") {
        GuiErrorKind::OAuthTimeout
    } else if lower.contains("lock") {
        GuiErrorKind::ConfigLockTimeout
    } else if lower.contains("state-mode") || lower.contains("invalid state mode") {
        GuiErrorKind::InvalidStateMode
    } else {
        GuiErrorKind::Unknown
    };

    DesktopError::CommandFailed {
        command: command.to_owned(),
        kind,
        message: stderr.trim().to_owned(),
        remediation: None,
    }
}

#[cfg(test)]
mod tests {
    use super::{AiswBridge, CliAiswBridge};
    use crate::models::{
        AddProfileMode, AddProfileRequest, RuntimeKind, UseAllProfilesRequest, WorkspaceBindRequest,
        WorkspaceBindTarget,
    };
    use std::fs;
    use std::os::unix::fs::PermissionsExt;
    use tempfile::tempdir;

    fn write_fake_aisw(script: &str) -> std::path::PathBuf {
        let dir = tempdir().unwrap();
        let path = dir.path().join("aisw");
        fs::write(&path, script).unwrap();
        let mut perms = fs::metadata(&path).unwrap().permissions();
        perms.set_mode(0o755);
        fs::set_permissions(&path, perms).unwrap();
        std::mem::forget(dir);
        path
    }

    #[tokio::test]
    async fn add_profile_uses_stdin_for_api_keys() {
        let path = write_fake_aisw(
            r#"#!/bin/sh
if [ "$1" = "add" ]; then
  read secret
  printf '{"command":"add","received":"%s"}' "$secret"
  exit 0
fi
printf '{"version":"0.3.7","cli_api_version":1,"json_schema_version":1,"progress_schema_version":1}'
"#,
        );
        let bridge = CliAiswBridge::new(RuntimeKind::Custom, Some(path), None);
        let response = bridge
            .add_profile(AddProfileRequest {
                tool: "claude".to_owned(),
                profile: "work".to_owned(),
                label: None,
                state_mode: None,
                import_mode: AddProfileMode::ApiKey {
                    value: "sk-ant-api03-secret".to_owned(),
                },
            })
            .await
            .unwrap();

        assert_eq!(response["received"], "sk-ant-api03-secret");
    }

    #[tokio::test]
    async fn init_and_workspace_commands_use_machine_flags() {
        let path = write_fake_aisw(
            r#"#!/bin/sh
if [ "$1" = "init" ]; then
  printf '{"ok":true,"command":"init","result":{"shell":{"action":"skipped"},"live_accounts":[]}}'
  exit 0
fi
if [ "$1" = "workspace" ] && [ "$2" = "bind" ]; then
  printf '{"ok":true,"command":"workspace_bind","args":"%s %s %s %s %s %s"}' "$1" "$2" "$3" "$4" "$5" "$6"
  exit 0
fi
if [ "$1" = "context" ]; then
  printf '{"contexts":[{"name":"client-acme","profiles":{"claude":"work"}}]}'
  exit 0
fi
if [ "$1" = "use" ] && [ "$2" = "--all" ]; then
  printf '{"ok":true,"command":"use_all","args":"%s %s %s %s %s"}' "$1" "$2" "$3" "$4" "$5"
  exit 0
fi
printf '{}'
"#,
        );
        let bridge = CliAiswBridge::new(RuntimeKind::Custom, Some(path), None);
        let init = bridge.init().await.unwrap();
        assert_eq!(init.raw["command"], "init");
        let contexts = bridge.list_contexts().await.unwrap();
        assert_eq!(contexts[0].name, "client-acme");

        let bound = bridge
            .workspace_bind(WorkspaceBindRequest {
                target: WorkspaceBindTarget::Default,
                context: "work".to_owned(),
            })
            .await
            .unwrap();
        assert_eq!(bound["command"], "workspace_bind");
        assert_eq!(bound["args"], "workspace bind --default --context work --json");

        let switched = bridge
            .use_all_profiles(UseAllProfilesRequest {
                profile: "work".to_owned(),
                state_mode: Some("isolated".to_owned()),
            })
            .await
            .unwrap();
        assert_eq!(switched["command"], "use_all");
    }
}
