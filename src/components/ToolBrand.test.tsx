import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TOOL_BRAND_VARIANTS, ToolBrand, ToolLogo } from "./ToolBrand";

describe("ToolBrand", () => {
  it("merges shared and custom classes for the brand label", () => {
    render(
      <ToolBrand
        tool="claude"
        className="custom-brand"
        nameClassName="custom-name"
        logoClassName="custom-logo"
      />,
    );

    const name = screen.getByText("Claude Code");
    const label = name.parentElement;
    expect(label).toHaveClass("tool-brand");
    expect(label).toHaveClass("custom-brand");
    expect(name).toHaveClass("tool-brand-name");
    expect(name).toHaveClass("custom-name");
    expect(document.querySelector(".tool-logo")).toHaveClass("custom-logo");
  });

  it("uses the shared class helper for fallback logos too", () => {
    render(<ToolLogo tool="mystery" className="fallback-logo" />);

    const logo = screen.getByText("M");
    expect(logo).toHaveClass("tool-logo");
    expect(logo).toHaveClass("tool-logo-fallback");
    expect(logo).toHaveClass("fallback-logo");
  });

  it("applies named presentation variants while still merging custom classes", () => {
    render(
      <ToolBrand
        tool="codex"
        variant="inlineSection"
        className="custom-brand"
        shortName
      />,
    );

    const name = screen.getByText("Codex");
    const label = name.parentElement;

    expect(label).toHaveClass("tool-brand-inline");
    expect(label).toHaveClass("custom-brand");
    expect(document.querySelector(".tool-logo")).toHaveAttribute(
      "style",
      expect.stringContaining(`${TOOL_BRAND_VARIANTS.inlineSection.logoSize}px`),
    );
  });

  it("renders a dedicated antigravity logo instead of the fallback glyph", () => {
    render(<ToolLogo tool="antigravity" className="antigravity-logo" />);

    const logo = document.querySelector(".tool-logo");
    expect(logo).toHaveClass("tool-logo-antigravity");
    expect(logo).toHaveClass("antigravity-logo");
    expect(logo).not.toHaveClass("tool-logo-fallback");
    expect(logo?.querySelector("svg")).not.toBeNull();
  });
});
