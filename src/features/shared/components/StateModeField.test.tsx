import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StateModeField } from "./StateModeField";

describe("StateModeField", () => {
  it("renders the compact variant with the selected option copy", () => {
    const onChange = vi.fn();

    render(
      <StateModeField
        name="runtime-state"
        value="shared"
        options={["isolated", "shared"]}
        onChange={onChange}
        variant="compact"
      />,
    );

    expect(screen.getByRole("button", { name: "Shared" })).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByText("Keep the normal tool config and history while switching credentials only."),
    ).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Isolated" }));
    expect(onChange).toHaveBeenCalledWith("isolated");
  });

  it("falls back to the first option and generic copy when the compact value is unknown", () => {
    render(
      <StateModeField
        name="runtime-state"
        value="custom"
        options={["custom", "shared"]}
        onChange={() => undefined}
        variant="compact"
      />,
    );

    expect(screen.getByRole("button", { name: "Custom" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Use the runtime-supported state handling for this profile.")).toBeVisible();
  });

  it("falls back to the first provided option when the compact value is missing", () => {
    render(
      <StateModeField
        name="runtime-state"
        value="missing"
        options={["isolated", "shared"]}
        onChange={() => undefined}
        variant="compact"
      />,
    );

    expect(screen.getByRole("button", { name: "Isolated" })).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByText("Separate config, history, and extensions for this profile."),
    ).toBeVisible();
  });

  it("renders card radios, active styling, and per-option descriptions", () => {
    const onChange = vi.fn();

    const { container } = render(
      <StateModeField
        name="profile-state"
        value="isolated"
        options={["isolated", "shared", "portable"]}
        onChange={onChange}
      />,
    );

    expect(container.querySelector(".state-mode-option-active")).toHaveTextContent("Isolated");
    expect(
      screen.getByText("Separate config, history, and extensions for this profile."),
    ).toBeVisible();
    expect(screen.getByText("Use the runtime-supported state handling for this profile.")).toBeVisible();

    fireEvent.click(screen.getByLabelText("Shared"));
    expect(onChange).toHaveBeenCalledWith("shared");
  });
});
