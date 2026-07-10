import { useState } from "react";
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
    <div className="stack-list">
      <div className="segmented-control" role="tablist" aria-label="Sets sections">
        <button
          type="button"
          className={mode === "sets" ? "segmented-control-button segmented-control-button-active" : "segmented-control-button"}
          aria-selected={mode === "sets"}
          onClick={() => setMode("sets")}
        >
          Sets
        </button>
        <button
          type="button"
          className={mode === "rules" ? "segmented-control-button segmented-control-button-active" : "segmented-control-button"}
          aria-selected={mode === "rules"}
          onClick={() => setMode("rules")}
        >
          Project rules
        </button>
      </div>

      {mode === "sets" ? (
        <ContextsPanel snapshot={snapshot} settings={settings} />
      ) : (
        <WorkspacesPanel snapshot={snapshot} settings={settings} onOpenContexts={onOpenContexts} />
      )}
    </div>
  );
}
