import { DialogSurface } from "./DialogSurface";

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
  if (!open) {
    return null;
  }

  return (
    <DialogSurface
      ariaLabel="Using AI Switch"
      className="quick-switch-palette profile-sheet"
      initialFocusSelector="button:not([disabled])"
      onClose={onClose}
    >
        <div className="quick-switch-header">
          <div>
            <p className="card-kicker">Help</p>
            <h3>Using AI Switch</h3>
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
              The app-managed runtime is the recommended setup for a consistent AI Switch experience.
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
              Settings to review app setup and terminal integration.
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
    </DialogSurface>
  );
}
