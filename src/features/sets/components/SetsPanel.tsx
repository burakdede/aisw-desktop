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
  const localSetCount = settings.profile_sets?.length ?? 0;
  const importedSetCount = snapshot.contexts.length;
  const activeSetCount = (settings.profile_sets ?? []).filter((set) =>
    Object.entries(set.profiles).some(([tool, profile]) => {
      if (!profile) return false;
      return snapshot.statuses.some(
        (status) => status.tool === tool && status.active_profile === profile,
      );
    }),
  ).length;
  const sections = [
    {
      value: "sets" as const,
      label: "Set Library",
      summary: `${localSetCount} saved set${localSetCount === 1 ? "" : "s"}`,
      note: importedSetCount
        ? `${importedSetCount} imported set${importedSetCount === 1 ? "" : "s"} remain available alongside your local library.`
        : "Save reusable work, personal, and client combinations for one-click switching.",
      badge: activeSetCount ? `${activeSetCount} active` : "Library",
    },
    {
      value: "rules" as const,
      label: "Project rules",
      summary: "Folder and remote matching",
      note: "Attach a saved set to a folder or remote pattern so AI Switch can warn before you code in the wrong profile.",
      badge: "Rules",
    },
  ];

  return (
    <SplitView
      className="sets-mode-split"
      primaryClassName="sets-mode-pane"
      secondaryClassName="sets-detail-pane"
      primary={
        <article className="diagnostic-card desktop-source-card sets-source-card">
          <div className="desktop-pane-section-header">
            <div>
              <p className="card-kicker">Project rules</p>
              <h3>Sets</h3>
            </div>
            <span className="pill pill-soft">{mode === "sets" ? "Library" : "Rules"}</span>
          </div>
          <p className="inline-note">
            Keep reusable switching sets and project-aware expectations in one compact desktop workflow.
          </p>
          <div className="desktop-source-list" aria-label="Sets sections">
            {sections.map((section) => (
              <button
                key={section.value}
                type="button"
                aria-label={section.label}
                aria-describedby={`sets-section-summary-${section.value}`}
                aria-pressed={mode === section.value}
                className={`desktop-source-row sets-source-row ${
                  mode === section.value ? "desktop-source-row-selected" : ""
                }`}
                onClick={() => setMode(section.value)}
              >
                <div className="sets-source-row-main">
                  <div className="sets-source-row-header">
                    <strong>{section.label}</strong>
                    <span className="pill pill-soft">{section.badge}</span>
                  </div>
                  <p id={`sets-section-summary-${section.value}`} className="inline-note">
                    {section.summary}
                  </p>
                  <p className="inline-note">{section.note}</p>
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
  );
}
