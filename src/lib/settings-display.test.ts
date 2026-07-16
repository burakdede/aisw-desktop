import {
  detectedShellLabel,
  SHELL_COMPLETION_AVAILABLE_LABEL,
  SHELL_CONFIG_UNAVAILABLE_LABEL,
  shellConfigPathLabel,
  shellGuidanceFallbackLabel,
  SHELL_GUIDANCE_LOADING_LABEL,
  SHELL_GUIDANCE_UNAVAILABLE_LABEL,
  shellHookStatusLabel,
  selectedShellValue,
  selectedShellVariant,
} from "./settings-display";

describe("settings-display", () => {
  it("formats shell guidance labels and fallbacks", () => {
    const shellGuidance = {
      detected_shell: "zsh",
      capabilities: ["install", "verify"],
      note: "Use the detected shell",
      manual_apply_examples: ["source ~/.zshrc"],
      variants: [
        {
          shell: "zsh",
          title: "Zsh",
          config_path: "~/.zshrc",
          alternate_config_path: null,
          install_command: "install",
          reload_command: "reload",
          verify_command: "verify",
          verify_expected: "ok",
        },
        {
          shell: "bash",
          title: "Bash",
          config_path: "~/.bashrc",
          alternate_config_path: null,
          install_command: "install bash",
          reload_command: "reload bash",
          verify_command: "verify bash",
          verify_expected: "ok",
        },
      ],
    } as const;

    expect(detectedShellLabel("zsh")).toBe("Zsh");
    expect(detectedShellLabel(null)).toBe(SHELL_CONFIG_UNAVAILABLE_LABEL);

    expect(shellHookStatusLabel("pass")).toBe("Installed");
    expect(shellHookStatusLabel("warn")).toBe("Not installed");
    expect(shellHookStatusLabel("bad")).toBe("Not installed");
    expect(shellHookStatusLabel("fail")).toBe(SHELL_CONFIG_UNAVAILABLE_LABEL);

    expect(
      shellConfigPathLabel({
        shell: "zsh",
        title: "Zsh",
        config_path: "~/.zshrc",
        alternate_config_path: null,
        install_command: "install",
        reload_command: "reload",
        verify_command: "verify",
        verify_expected: "ok",
      }),
    ).toBe("~/.zshrc");
    expect(shellConfigPathLabel(undefined)).toBe(SHELL_CONFIG_UNAVAILABLE_LABEL);
    expect(selectedShellVariant(shellGuidance, "bash")).toEqual(shellGuidance.variants[1]);
    expect(selectedShellVariant(shellGuidance, "fish")).toEqual(shellGuidance.variants[0]);
    expect(selectedShellValue(shellGuidance, "")).toBe("zsh");
    expect(selectedShellValue(shellGuidance, "bash")).toBe("bash");
    expect(selectedShellValue(undefined, "")).toBe("");
  });

  it("shares shell guidance fallback copy", () => {
    expect(shellGuidanceFallbackLabel(true)).toBe(SHELL_GUIDANCE_LOADING_LABEL);
    expect(shellGuidanceFallbackLabel(false)).toBe(SHELL_GUIDANCE_UNAVAILABLE_LABEL);
    expect(SHELL_COMPLETION_AVAILABLE_LABEL).toBe("Available in this build");
  });
});
