import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SegmentedControl } from "./SegmentedControl";

describe("SegmentedControl", () => {
  it("renders button semantics by default", () => {
    const onChange = vi.fn();

    render(
      <SegmentedControl
        ariaLabel="Filters"
        value="all"
        onChange={onChange}
        options={[
          { value: "all", label: "All" },
          { value: "saved", label: "Saved", disabled: true },
        ]}
      />,
    );

    const group = screen.getByLabelText("Filters");
    const allButton = screen.getByRole("button", { name: "All" });
    const savedButton = screen.getByRole("button", { name: "Saved" });

    expect(group).not.toHaveAttribute("role", "tablist");
    expect(allButton).not.toHaveAttribute("role", "tab");
    expect(allButton).toHaveAttribute("aria-pressed", "true");
    expect(allButton).not.toHaveAttribute("aria-selected");
    expect(savedButton).toBeDisabled();

    fireEvent.click(allButton);
    expect(onChange).toHaveBeenCalledWith("all");
  });

  it("renders tab semantics when requested", () => {
    const onChange = vi.fn();

    render(
      <SegmentedControl
        ariaLabel="Sets mode"
        kind="tabs"
        value="rules"
        onChange={onChange}
        options={[
          { value: "sets", label: "Set Library" },
          { value: "rules", label: "Project Rules" },
        ]}
      />,
    );

    const tabList = screen.getByRole("tablist", { name: "Sets mode" });
    const setLibraryTab = screen.getByRole("tab", { name: "Set Library" });
    const projectRulesTab = screen.getByRole("tab", { name: "Project Rules" });

    expect(tabList).toBeInTheDocument();
    expect(setLibraryTab).toHaveAttribute("aria-selected", "false");
    expect(setLibraryTab).toHaveAttribute("aria-pressed", "false");
    expect(projectRulesTab).toHaveAttribute("aria-selected", "true");
    expect(projectRulesTab).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(setLibraryTab);
    expect(onChange).toHaveBeenCalledWith("sets");
  });
});
