import { useState } from "react";
import { SectionCard } from "../../../components/SectionCard";
import { SegmentedControl } from "../../../components/SegmentedControl";
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
      heading: "Library view",
      summary: `${localSetCount} saved set${localSetCount === 1 ? "" : "s"}`,
      note: importedSetCount
        ? `${importedSetCount} detected set${importedSetCount === 1 ? "" : "s"} remain available alongside your local library.`
        : "Save reusable work, personal, and client combinations for one-click switching.",
      badge: activeSetCount ? `${activeSetCount} active` : "Library",
    },
    {
      value: "rules" as const,
      label: "Project Rules",
      heading: "Project-rule view",
      summary: "Folder and remote matching",
      note: "Attach a saved set to a folder or remote pattern so AI Switch can warn before you code in the wrong profile.",
      badge: "Rules",
    },
  ];

  const activeSection = sections.find((section) => section.value === mode) ?? sections[0];

  return (
    <SectionCard title="Sets" kicker="Switching sets and project rules">
      <div className="stack-list sets-shell">
        <article className="diagnostic-card sets-mode-card">
          <div className="desktop-pane-section-header">
            <div>
              <p className="card-kicker">View</p>
              <h3>{activeSection.heading}</h3>
            </div>
            <span className="pill pill-soft">{activeSection.badge}</span>
          </div>
          <div className="sets-mode-toolbar">
            <SegmentedControl
              ariaLabel="Sets mode"
              className="sets-mode-segmented"
              options={sections.map((section) => ({
                value: section.value,
                label: section.label,
              }))}
              value={mode}
              onChange={setMode}
            />
            <p className="inline-note">{activeSection.note}</p>
          </div>
          <div className="sets-summary-grid">
            <div>
              <span className="overview-current-set-cell-label">Saved</span>
              <strong>{localSetCount}</strong>
              <p className="inline-note">{sections[0].summary}</p>
            </div>
            <div>
              <span className="overview-current-set-cell-label">Detected</span>
              <strong>{importedSetCount}</strong>
              <p className="inline-note">
                {importedSetCount
                  ? `${importedSetCount} imported set${importedSetCount === 1 ? "" : "s"} available`
                  : "No imported sets available"}
              </p>
            </div>
            <div>
              <span className="overview-current-set-cell-label">Current</span>
              <strong>{activeSetCount}</strong>
              <p className="inline-note">
                {activeSetCount ? `${activeSetCount} saved set${activeSetCount === 1 ? "" : "s"} active` : activeSection.summary}
              </p>
            </div>
          </div>
        </article>
        {mode === "sets" ? (
          <ContextsPanel snapshot={snapshot} settings={settings} />
        ) : (
          <WorkspacesPanel
            snapshot={snapshot}
            settings={settings}
            onOpenContexts={onOpenContexts}
          />
        )}
      </div>
    </SectionCard>
  );
}
