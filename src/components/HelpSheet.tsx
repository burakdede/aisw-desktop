import { useEffect } from "react";

type HelpSheetProps = {
  open: boolean;
  onClose: () => void;
  onOpenProfiles: () => void;
  onOpenDiagnostics: () => void;
  onOpenSettings: () => void;
};

export function HelpSheet({
  open,
  onClose,
  onOpenProfiles,
  onOpenDiagnostics,
  onOpenSettings,
}: HelpSheetProps) {
  useEffect(() => {
    if (!open) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  return (
    <div className="quick-switch-overlay" role="presentation" onClick={onClose}>
      <section
        className="quick-switch-palette profile-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="AI Switch Help"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="quick-switch-header">
          <div>
            <p className="card-kicker">Help</p>
            <h3>AI Switch at a glance</h3>
            <p className="inline-note">
              AI Switch keeps account switching local to this Mac and stays focused on safe profile
              changes, verification, and recovery.
            </p>
          </div>
          <button className="ghost-button" type="button" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="stack-list">
          <article className="diagnostic-card">
            <div className="desktop-pane-section-header">
              <div>
                <p className="card-kicker">What it does</p>
                <h4>Local profile switching</h4>
              </div>
            </div>
            <p className="inline-note">
              Switch Claude Code, Codex CLI, and Gemini CLI profiles from one app.
            </p>
            <p className="inline-note">Credentials stay on this Mac.</p>
            <p className="inline-note">No telemetry, prompt logging, or traffic proxy is used.</p>
            <p className="inline-note">
              The included runtime is the recommended setup for a consistent AI Switch experience.
            </p>
          </article>

          <article className="diagnostic-card">
            <div className="desktop-pane-section-header">
              <div>
                <p className="card-kicker">Shortcuts</p>
                <h4>Fast navigation</h4>
              </div>
            </div>
            <div className="settings-summary-grid">
              <div>
                <span className="overview-current-set-cell-label">Quick Switch</span>
                <strong>⌘K</strong>
              </div>
              <div>
                <span className="overview-current-set-cell-label">Diagnostics</span>
                <strong>⌘4</strong>
              </div>
              <div>
                <span className="overview-current-set-cell-label">Settings</span>
                <strong>⌘,</strong>
              </div>
            </div>
          </article>

          <article className="diagnostic-card">
            <div className="desktop-pane-section-header">
              <div>
                <p className="card-kicker">Next steps</p>
                <h4>Open the right surface</h4>
              </div>
            </div>
            <p className="inline-note">
              Go to Profiles to save or import accounts, Diagnostics to verify switching health, or
              Settings to review runtime and terminal integration.
            </p>
            <div className="button-row">
              <button
                className="ghost-button"
                type="button"
                onClick={() => {
                  onClose();
                  onOpenProfiles();
                }}
              >
                Open Profiles
              </button>
              <button
                className="ghost-button"
                type="button"
                onClick={() => {
                  onClose();
                  onOpenDiagnostics();
                }}
              >
                Open Diagnostics
              </button>
              <button
                className="ghost-button"
                type="button"
                onClick={() => {
                  onClose();
                  onOpenSettings();
                }}
              >
                Open Settings
              </button>
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}
