use crate::models::{ShellHookGuidance, ShellHookVariant};
use std::ffi::OsStr;
use std::path::Path;

pub fn shell_hook_guidance() -> ShellHookGuidance {
    ShellHookGuidance {
        detected_shell: detect_shell(),
        capabilities: vec![
            "Apply CLAUDE_CONFIG_DIR, CODEX_HOME, and GEMINI_API_KEY into the current shell session when you switch profiles from AI Switch.".to_owned(),
            "Enforce workspace guardrails before `claude`, `codex`, or `gemini` launch from that shell.".to_owned(),
        ],
        note: "Without terminal integration, AI Switch still updates local credential files and its managed configuration. Terminal integration is only required for current-shell exports and workspace checks."
            .to_owned(),
        manual_apply_examples: vec![
            "eval \"$(aisw use claude work --emit-env)\"".to_owned(),
            "eval \"$(aisw context use client-acme --emit-env)\"".to_owned(),
        ],
        variants: variants(),
    }
}

fn variants() -> Vec<ShellHookVariant> {
    vec![
        ShellHookVariant {
            shell: "zsh".to_owned(),
            title: "Zsh".to_owned(),
            config_path: "~/.zshrc".to_owned(),
            alternate_config_path: None,
            install_command: "echo 'eval \"$(aisw shell-hook zsh)\"' >> ~/.zshrc".to_owned(),
            reload_command: "source ~/.zshrc".to_owned(),
            verify_command: "echo \"$AISW_SHELL_HOOK\"".to_owned(),
            verify_expected: "1".to_owned(),
        },
        ShellHookVariant {
            shell: "bash".to_owned(),
            title: "Bash".to_owned(),
            config_path: "~/.bashrc".to_owned(),
            alternate_config_path: Some("~/.bash_profile".to_owned()),
            install_command: "echo 'eval \"$(aisw shell-hook bash)\"' >> ~/.bashrc".to_owned(),
            reload_command: "source ~/.bashrc".to_owned(),
            verify_command: "echo \"$AISW_SHELL_HOOK\"".to_owned(),
            verify_expected: "1".to_owned(),
        },
        ShellHookVariant {
            shell: "fish".to_owned(),
            title: "Fish".to_owned(),
            config_path: "~/.config/fish/conf.d/ai-switch.fish".to_owned(),
            alternate_config_path: Some("~/.config/fish/config.fish".to_owned()),
            install_command:
                "mkdir -p ~/.config/fish/conf.d && aisw shell-hook fish > ~/.config/fish/conf.d/ai-switch.fish"
                    .to_owned(),
            reload_command: "source ~/.config/fish/conf.d/ai-switch.fish".to_owned(),
            verify_command: "echo \"$AISW_SHELL_HOOK\"".to_owned(),
            verify_expected: "1".to_owned(),
        },
        ShellHookVariant {
            shell: "pwsh".to_owned(),
            title: "PowerShell".to_owned(),
            config_path: "$PROFILE".to_owned(),
            alternate_config_path: None,
            install_command:
                "if (!(Test-Path $PROFILE)) { New-Item -ItemType File -Force $PROFILE | Out-Null }; Add-Content $PROFILE \"`naisw shell-hook pwsh | Out-String | Invoke-Expression\""
                    .to_owned(),
            reload_command: ". $PROFILE".to_owned(),
            verify_command: "echo $env:AISW_SHELL_HOOK".to_owned(),
            verify_expected: "1".to_owned(),
        },
    ]
}

fn detect_shell() -> Option<String> {
    if let Some(value) = std::env::var_os("AISW_SHELL") {
        if let Some(shell) = normalize_shell(value.as_os_str()) {
            return Some(shell);
        }
    }
    if let Some(value) = std::env::var_os("SHELL") {
        if let Some(shell) = normalize_shell(value.as_os_str()) {
            return Some(shell);
        }
    }
    std::env::var_os("ComSpec").and_then(|value| normalize_shell(value.as_os_str()))
}

fn normalize_shell(value: &OsStr) -> Option<String> {
    let text = value.to_string_lossy();
    let file_name = text
        .rsplit(['/', '\\'])
        .next()
        .filter(|segment| !segment.is_empty())
        .map(str::to_owned)
        .or_else(|| {
            Path::new(text.as_ref())
                .file_name()
                .and_then(|name| name.to_str())
                .map(str::to_owned)
        })
        .unwrap_or_else(|| text.to_string())
        .to_ascii_lowercase();

    match file_name.as_str() {
        "zsh" | "bash" | "fish" | "pwsh" | "powershell" | "powershell.exe" | "pwsh.exe" => Some(
            if file_name.starts_with("power") || file_name.starts_with("pwsh") {
                "pwsh".to_owned()
            } else {
                file_name.trim_end_matches(".exe").to_owned()
            },
        ),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::{normalize_shell, shell_hook_guidance};
    use std::ffi::OsStr;

    #[test]
    fn guidance_contains_supported_variants() {
        let guidance = shell_hook_guidance();
        assert_eq!(guidance.variants.len(), 4);
        assert!(guidance
            .variants
            .iter()
            .any(|variant| variant.shell == "zsh"));
        assert!(guidance
            .variants
            .iter()
            .any(|variant| variant.shell == "pwsh"));
    }

    #[test]
    fn normalizes_shell_names() {
        assert_eq!(
            normalize_shell(OsStr::new("/bin/zsh")).as_deref(),
            Some("zsh")
        );
        assert_eq!(
            normalize_shell(OsStr::new("C:\\Program Files\\PowerShell\\7\\pwsh.exe")).as_deref(),
            Some("pwsh")
        );
        assert_eq!(normalize_shell(OsStr::new("unknown")).as_deref(), None);
    }
}
