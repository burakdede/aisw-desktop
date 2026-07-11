import { useState } from "react";
import { DesktopStatusStrip } from "../../../components/DesktopStatusStrip";
import { SplitView } from "../../../components/SplitView";
import type { AppSnapshot, DesktopSettings } from "../../../lib/schemas";
import { ContextsPanel } from "../../contexts/components/ContextsPanel";
import { WorkspacesPanel } from "../../workspaces/components/WorkspacesPanel";

export function SetsPanel({
  snapshot,
  settings,
  onOpenContexts,
}: {
  snapshot: AppSnapshot;
  settings: DesktopSettings;
  onOpenContexts: () => void;
}) {
  const [mode, setMode] = useState<"sets" | "rules">("sets");

  return (
    <div className="stack-list desktop-pane-stack">
      <DesktopStatusStrip
        ariaLabel="Sets highlights"
        items={[
          {
            label: "Sets",
            value: mode === "sets" ? "Saved combinations" : "Project rules",
            note: "Keep reusable switching sets and matching rules in one compact desktop workflow.",
          },
          {
            label: "Navigation",
            value: mode === "sets" ? "Library mode" : "Rule mode",
            note: "Use the split view to move between saved sets and project-aware expectations without extra scrolling.",
          },
          {
            label: "Highlights",
            value: "Shared control",
            pills: ["Saved sets", "Imported sets", "Project rules"],
          },
        ]}
      />
      <SplitView
        className="sets-mode-split"
        primaryClassName="sets-mode-pane"
        secondaryClassName="sets-detail-pane"
        primary={
          <article className="diagnostic-card desktop-source-card">
            <div className="desktop-pane-section-header">
              <div>
                <p className="card-kicker">Categories</p>
                <h3>Sets</h3>
              </div>
            </div>
            <div className="desktop-source-list" aria-label="Sets sections">
              {[
                {
                  value: "sets" as const,
                  label: "Set Library",
                  summary: "Saved switching sets",
                },
                {
                  value: "rules" as const,
                  label: "Project rules",
                  summary: "Expected sets by folder or remote",
                },
              ].map((section) => (
                <button
                  key={section.value}
                  type="button"
                  aria-label={section.label}
                  aria-describedby={`sets-section-summary-${section.value}`}
                  aria-pressed={mode === section.value}
                  className={`desktop-source-row ${
                    mode === section.value ? "desktop-source-row-selected" : ""
                  }`}
                  onClick={() => setMode(section.value)}
                >
                  <div>
                    <strong>{section.label}</strong>
                    <p
                      id={`sets-section-summary-${section.value}`}
                      className="inline-note"
                    >
                      {section.summary}
                    </p>
                  </div>
                  <span className="desktop-source-chevron" aria-hidden="true">
                    ›
                  </span>
                </button>
              ))}
            </div>
          </article>
        }
        secondary={
          mode === "sets" ? (
            <ContextsPanel snapshot={snapshot} settings={settings} />
          ) : (
            <WorkspacesPanel
              snapshot={snapshot}
              settings={settings}
              onOpenContexts={onOpenContexts}
            />
          )
        }
      />
    </div>
  );
}
