import { useState } from "react";
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
      <article className="desktop-pane-hero sets-hero">
        <div className="desktop-pane-hero-copy">
          <p className="card-kicker">Sets</p>
          <h3>Save reusable switching combinations and map them to projects</h3>
          <p className="inline-note">
            The Sets area keeps saved combinations and project matching rules in one native workflow so switching stays predictable without extra scrolling.
          </p>
        </div>
        <div className="desktop-pane-hero-pills" aria-label="Sets highlights">
          <span className="status-pill">Saved sets</span>
          <span className="status-pill">Shared groups</span>
          <span className="status-pill">Project matching rules</span>
        </div>
      </article>
      <SplitView
        className="sets-mode-split"
        primaryClassName="sets-mode-pane"
        secondaryClassName="sets-detail-pane"
        primary={
          <article className="diagnostic-card desktop-source-card">
            <div className="desktop-pane-section-header">
              <div>
                <p className="card-kicker">Categories</p>
                <h3>Sets and rules</h3>
              </div>
            </div>
            <div className="desktop-source-list" aria-label="Sets sections">
              {[
                {
                  value: "sets" as const,
                  label: "Sets",
                  summary: "Reusable switching combinations",
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
