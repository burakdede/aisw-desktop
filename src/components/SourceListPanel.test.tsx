import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SourceListPanel } from "./SourceListPanel";

describe("SourceListPanel", () => {
  it("merges its base and custom class names while preserving list semantics", () => {
    render(
      <SourceListPanel
        title="Profiles"
        className="custom-panel"
        listLabel="Saved profiles"
        listRole="list"
      >
        <div>Item</div>
      </SourceListPanel>,
    );

    const panel = screen.getByRole("article");
    expect(panel).toHaveClass("source-list-panel");
    expect(panel).toHaveClass("custom-panel");
    expect(screen.getByRole("list", { name: "Saved profiles" })).toBeInTheDocument();
  });
});
