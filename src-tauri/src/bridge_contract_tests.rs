//! Drives a real aisw binary through the desktop bridge so a new runtime
//! release is checked against the payloads the app actually parses, not
//! against hand-written fixtures.
//!
//! AISW_CONTRACT_BINARY=/path/to/aisw cargo test -- --ignored real_aisw

use crate::bridge::{AiswBridge, CliAiswBridge};
use crate::models::{
    AddProfileMode, AddProfileRequest, RuntimeKind, UseAllProfilesRequest, UseProfileRequest,
};
use std::path::PathBuf;
use tempfile::tempdir;

fn contract_binary() -> PathBuf {
    let path = std::env::var("AISW_CONTRACT_BINARY")
        .expect("set AISW_CONTRACT_BINARY to the aisw binary under test");
    PathBuf::from(path)
}

// aisw rejects a second profile that reuses an existing API key.
fn api_key_profile(tool: &str, profile: &str) -> AddProfileRequest {
    AddProfileRequest {
        tool: tool.to_owned(),
        profile: profile.to_owned(),
        label: Some(format!("contract {profile}")),
        state_mode: None,
        credential_backend: Some("file".to_owned()),
        import_mode: AddProfileMode::ApiKey {
            value: format!("sk-aisw-desktop-contract-{tool}-{profile}-0000000000000000"),
        },
    }
}

#[tokio::test]
#[ignore = "needs AISW_CONTRACT_BINARY; run with --ignored"]
async fn real_aisw_supports_desktop_workflows() {
    let sandbox = tempdir().unwrap();
    let home = sandbox.path().join("home");
    std::fs::create_dir_all(&home).unwrap();
    // aisw applies profiles to live tool state under HOME; never touch the
    // developer's real accounts or keychain-backed logins.
    std::env::set_var("HOME", &home);
    std::env::set_var("CODEX_HOME", home.join(".codex"));
    std::env::set_var("CLAUDE_CONFIG_DIR", home.join(".claude"));

    let bridge = CliAiswBridge::new(
        RuntimeKind::Custom,
        Some(contract_binary()),
        Some(sandbox.path().join("aisw-home")),
    );

    let version = bridge.version().await.expect("version");
    assert_eq!(version.cli_api_version, 1);
    assert_eq!(version.json_schema_version, 1);
    assert_eq!(version.progress_schema_version, 1);
    bridge.capabilities().await.expect("capabilities");

    bridge.init().await.expect("init");
    let status = bridge.status().await.expect("status");
    assert!(status.iter().any(|tool| tool.tool == "codex"));
    bridge.doctor().await.expect("doctor");
    bridge.verify().await.expect("verify");

    bridge
        .add_profile(api_key_profile("codex", "work"))
        .await
        .expect("add codex work");
    bridge
        .add_profile(api_key_profile("codex", "personal"))
        .await
        .expect("add codex personal");

    let profiles = bridge.list_profiles().await.expect("list");
    let codex_names: Vec<_> = profiles["codex"]
        .profiles
        .iter()
        .map(|profile| profile.name.as_str())
        .collect();
    assert!(codex_names.contains(&"work"), "{codex_names:?}");
    assert!(codex_names.contains(&"personal"), "{codex_names:?}");

    bridge
        .use_profile(UseProfileRequest {
            tool: "codex".to_owned(),
            profile: "work".to_owned(),
            state_mode: None,
        })
        .await
        .expect("use codex work");
    bridge
        .use_all_profiles(UseAllProfilesRequest {
            profile: "personal".to_owned(),
            state_mode: None,
        })
        .await
        .expect("use all personal");
    let profiles = bridge.list_profiles().await.expect("list after switch");
    assert_eq!(profiles["codex"].active.as_deref(), Some("personal"));

    bridge.list_contexts().await.expect("contexts");
    bridge.workspace_status().await.expect("workspace status");
    bridge.project_bindings().await.expect("project bindings");

    bridge
        .rename_profile("codex".to_owned(), "work".to_owned(), "side".to_owned())
        .await
        .expect("rename");
    bridge
        .remove_profile("codex".to_owned(), "side".to_owned(), false)
        .await
        .expect("remove");

    let backups = bridge.list_backups().await.expect("backups");
    if let Some(backup) = backups.first() {
        bridge
            .restore_backup(backup.backup_id.clone())
            .await
            .expect("restore backup");
    }
}
