import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ButtonRow } from "./ButtonRow";
import { KeyValueGrid } from "./KeyValueGrid";
import { PaneSectionHeader } from "./PaneSectionHeader";
import { SectionCard } from "./SectionCard";
import { SheetFooter } from "./SheetFooter";
import { SheetHeader } from "./SheetHeader";

describe("SectionCard", () => {
  it("renders optional kicker and actions when provided", () => {
    render(
      <SectionCard title="Overview" kicker="Summary" actions={<button type="button">Refresh</button>}>
        <p>Body</p>
      </SectionCard>,
    );

    expect(screen.getByText("Summary")).toBeVisible();
    expect(screen.getByRole("button", { name: "Refresh" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Overview" })).toBeVisible();
  });

  it("omits optional chrome when kicker and actions are absent", () => {
    const { container } = render(
      <SectionCard title="Profiles">
        <p>Body</p>
      </SectionCard>,
    );

    expect(screen.queryByText("Summary")).toBeNull();
    expect(container.querySelector(".section-actions")).toBeNull();
  });
});

describe("KeyValueGrid", () => {
  it("renders rows in both default and plain variants", () => {
    const { container, rerender } = render(
      <KeyValueGrid rows={[{ label: "Active set", value: "Work" }]} />,
    );

    expect(container.querySelector(".kv-grid")).not.toBeNull();
    expect(container.querySelector(".kv-grid-plain")).toBeNull();
    expect(screen.getByText("Active set")).toBeVisible();
    expect(screen.getByText("Work")).toBeVisible();

    rerender(<KeyValueGrid rows={[{ label: "Switching", value: "Ready" }]} variant="plain" />);

    expect(container.querySelector(".kv-grid-plain")).not.toBeNull();
    expect(screen.getByText("Switching")).toBeVisible();
    expect(screen.getByText("Ready")).toBeVisible();
  });
});

describe("SheetHeader", () => {
  it("renders optional kicker, detail, and actions", () => {
    render(
      <SheetHeader
        kicker="Security"
        title="Export Report"
        detail="Review the generated bundle before sharing it."
        actions={<button type="button">Close</button>}
      />,
    );

    expect(screen.getByText("Security")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Export Report" })).toBeVisible();
    expect(screen.getByText("Review the generated bundle before sharing it.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Close" })).toBeVisible();
  });

  it("omits optional detail and actions when they are not provided", () => {
    const { container } = render(<SheetHeader title="Add Rule" />);

    expect(screen.getByRole("heading", { name: "Add Rule" })).toBeVisible();
    expect(container.querySelector(".card-kicker")).toBeNull();
    expect(container.querySelector(".ghost-button")).toBeNull();
  });
});

describe("SheetFooter", () => {
  it("renders footer content with the shared footer class", () => {
    const { container } = render(
      <SheetFooter>
        <div className="button-row">Actions</div>
      </SheetFooter>,
    );

    expect(container.querySelector("footer.quick-switch-footer")).not.toBeNull();
    expect(screen.getByText("Actions")).toBeVisible();
  });

  it("merges an optional class name", () => {
    const { container } = render(
      <SheetFooter className="quick-switch-footer-compact">
        <p>Hint</p>
      </SheetFooter>,
    );

    expect(container.querySelector("footer.quick-switch-footer-compact")).not.toBeNull();
  });
});

describe("ButtonRow", () => {
  it("renders children with the shared button row class", () => {
    const { container } = render(
      <ButtonRow>
        <button type="button">Confirm</button>
      </ButtonRow>,
    );

    expect(container.querySelector("div.button-row")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Confirm" })).toBeVisible();
  });

  it("merges an optional class name", () => {
    const { container } = render(
      <ButtonRow className="profiles-inspector-action-row">
        <button type="button">Open</button>
      </ButtonRow>,
    );

    expect(container.querySelector("div.profiles-inspector-action-row")).not.toBeNull();
  });
});

describe("PaneSectionHeader", () => {
  it("renders kicker, title, detail, and actions", () => {
    render(
      <PaneSectionHeader
        kicker="Runtime"
        title="Included engine"
        detail="Use the bundled runtime when the custom binary is unavailable."
        actions={<span>Ready</span>}
      />,
    );

    expect(screen.getByText("Runtime")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Included engine" })).toBeVisible();
    expect(screen.getByText("Use the bundled runtime when the custom binary is unavailable.")).toBeVisible();
    expect(screen.getByText("Ready")).toBeVisible();
  });

  it("supports an alternate heading level", () => {
    render(<PaneSectionHeader kicker="Shortcuts" title="Keyboard" titleTag="h4" />);

    expect(screen.getByRole("heading", { level: 4, name: "Keyboard" })).toBeVisible();
  });
});
