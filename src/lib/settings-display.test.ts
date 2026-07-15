import {
  detectedShellLabel,
  SHELL_COMPLETION_AVAILABLE_LABEL,
  SHELL_CONFIG_UNAVAILABLE_LABEL,
  shellConfigPathLabel,
  shellGuidanceFallbackLabel,
  SHELL_GUIDANCE_LOADING_LABEL,
  SHELL_GUIDANCE_UNAVAILABLE_LABEL,
  shellHookStatusLabel,
} from "./settings-display";

describe("settings-display", () => {
  it("formats shell guidance labels and fallbacks", () => {
    expect(detectedShellLabel("zsh")).toBe("Zsh");
    expect(detectedShellLabel(null)).toBe(SHELL_CONFIG_UNAVAILABLE_LABEL);

    expect(shellHookStatusLabel("pass")).toBe("Installed");
    expect(shellHookStatusLabel("warn")).toBe("Not installed");
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
  });

  it("shares shell guidance fallback copy", () => {
    expect(shellGuidanceFallbackLabel(true)).toBe(SHELL_GUIDANCE_LOADING_LABEL);
    expect(shellGuidanceFallbackLabel(false)).toBe(SHELL_GUIDANCE_UNAVAILABLE_LABEL);
    expect(SHELL_COMPLETION_AVAILABLE_LABEL).toBe("Available in this build");
  });
});
