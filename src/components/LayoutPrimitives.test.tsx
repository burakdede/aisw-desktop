import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { KeyValueGrid } from "./KeyValueGrid";
import { SectionCard } from "./SectionCard";
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
