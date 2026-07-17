import { DIALOG_FOCUS_SELECTORS, DIALOG_SURFACE_CLASS_NAMES, DialogSurface } from "./DialogSurface";
import { ButtonRow } from "./ButtonRow";
import { SheetHeader } from "./SheetHeader";
import { ToolBrand } from "./ToolBrand";
import {
  HELP_SHEET_ACTIONS,
  HELP_SHEET_COPY,
  HELP_SHEET_SHORTCUTS,
  HELP_SHEET_SUPPORTED_TOOLS,
} from "./help-sheet-display";

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

  const actionHandlers = {
    profiles: onOpenProfiles,
    diagnostics: onOpenDiagnostics,
    settings: onOpenSettings,
  } as const;

  return (
    <DialogSurface
      ariaLabel={HELP_SHEET_COPY.dialogAriaLabel}
      className={DIALOG_SURFACE_CLASS_NAMES.sheet}
      initialFocusSelector={DIALOG_FOCUS_SELECTORS.action}
      onClose={onClose}
    >
      <SheetHeader
        kicker={HELP_SHEET_COPY.kicker}
        title={HELP_SHEET_COPY.heading}
        detail={HELP_SHEET_COPY.intro}
        actions={
          <button className="ghost-button" type="button" onClick={onClose}>
            {HELP_SHEET_COPY.closeLabel}
          </button>
        }
      />

      <div className="stack-list">
        <article className="diagnostic-card">
          <div className="desktop-pane-section-header">
            <div>
              <p className="card-kicker">{HELP_SHEET_COPY.supportedToolsKicker}</p>
              <h4>{HELP_SHEET_COPY.supportedToolsHeading}</h4>
            </div>
          </div>
          <div className="tool-brand-list" aria-label={HELP_SHEET_COPY.supportedToolsAriaLabel}>
            {HELP_SHEET_SUPPORTED_TOOLS.map((tool) => (
              <ToolBrand
                key={tool}
                tool={tool}
                variant="inlineSection"
              />
            ))}
          </div>
          <p className="inline-note">{HELP_SHEET_COPY.supportedToolsPrimaryNote}</p>
          <p className="inline-note">{HELP_SHEET_COPY.supportedToolsSecondaryNote}</p>
        </article>

        <article className="diagnostic-card">
          <div className="desktop-pane-section-header">
            <div>
              <p className="card-kicker">{HELP_SHEET_COPY.shortcutsKicker}</p>
              <h4>{HELP_SHEET_COPY.shortcutsHeading}</h4>
            </div>
          </div>
          <div className="settings-summary-grid">
            {HELP_SHEET_SHORTCUTS.map((item) => (
              <div key={`${item.label}-${item.shortcut}`}>
                <span className="overview-current-set-cell-label">{item.label}</span>
                <strong>{item.shortcut}</strong>
              </div>
            ))}
          </div>
        </article>

        <article className="diagnostic-card">
          <div className="desktop-pane-section-header">
            <div>
              <p className="card-kicker">{HELP_SHEET_COPY.nextStepsKicker}</p>
              <h4>{HELP_SHEET_COPY.nextStepsHeading}</h4>
            </div>
          </div>
          <p className="inline-note">{HELP_SHEET_COPY.nextStepsNote}</p>
          <ButtonRow>
            {HELP_SHEET_ACTIONS.map((action) => (
              <button
                key={action.id}
                className="ghost-button"
                type="button"
                onClick={() => {
                  onClose();
                  actionHandlers[action.id]();
                }}
              >
                {action.label}
              </button>
            ))}
          </ButtonRow>
        </article>
      </div>
    </DialogSurface>
  );
}
