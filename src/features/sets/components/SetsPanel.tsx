import { useState } from "react";
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
      <article className="diagnostic-card desktop-pane-intro desktop-pane-mode-card">
        <div>
          <h3>Sets and project rules</h3>
          <p className="inline-note">
            Save reusable switching combinations, then map folders or remotes to the right set with minimal navigation.
          </p>
        </div>
        <SegmentedControl
          ariaLabel="Sets sections"
          options={[
            { value: "sets", label: "Sets" },
            { value: "rules", label: "Project rules" },
          ]}
          value={mode}
          onChange={setMode}
        />
      </article>

      {mode === "sets" ? (
        <ContextsPanel snapshot={snapshot} settings={settings} />
      ) : (
        <WorkspacesPanel snapshot={snapshot} settings={settings} onOpenContexts={onOpenContexts} />
      )}
    </div>
  );
}
