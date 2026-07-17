import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { SFEllipsisCircle } from "sf-symbols-lib/monochrome/SFEllipsisCircle";
import { AnchoredMenu } from "../../../components/AnchoredMenu";
import { DialogSurface } from "../../../components/DialogSurface";
import { KeyValueGrid } from "../../../components/KeyValueGrid";
import { SearchField } from "../../../components/SearchField";
import { SegmentedControl } from "../../../components/SegmentedControl";
import { SplitView } from "../../../components/SplitView";
import { ToolBrand } from "../../../components/ToolBrand";
import { useCompactLayout } from "../../../components/useCompactLayout";
import { exportActivityLog } from "../../../lib/client";
import { DESKTOP_QUERY_KEYS } from "../../../lib/desktop-query-keys";
import { PANEL_COMPACT_BREAKPOINT } from "../../../lib/layout";
import { notifyDesktop } from "../../../lib/notifications";
import {
  clearLastCommandResults,
  useLastCommandResults,
} from "../../shared/lastCommandResult";
import {
  ACTIVITY_FILTER_OPTIONS,
  ACTIVITY_CLEAR_DIALOG,
  ACTIVITY_EMPTY_SELECTION_STATE,
  ACTIVITY_EMPTY_STATE,
  ACTIVITY_INSPECTOR_COPY,
  ACTIVITY_PANEL_COPY,
  ACTIVITY_STATUS_NOTIFICATION,
  ACTIVITY_TOOLBAR_COPY,
  activityEntryAriaLabel,
  activityFooterMessage,
  activityRecordedCommand,
  activityRecordedResult,
  activitySecondaryLine,
  buildActivityInspectorRows,
  buildActivityScopeValue,
  activityStatusLabel,
  activityStatusSymbol,
  buildActivityEntries,
  buildActivityExportBody,
  buildActivityExportMessage,
  activityTrailingLine,
  filterActivity,
  formatActivityTimestamp,
  formatFullActivityTimestamp,
  groupActivityEntries,
  resolveSelectedActivityEntryKey,
  type ActivityEntry,
  type ActivityFilter,
} from "../activity-display";

export function ActivityPanel({
  externalClearSignal = 0,
  externalOpenLogSignal = 0,
}: {
  externalClearSignal?: number;
  externalOpenLogSignal?: number;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const queryClient = useQueryClient();
  const lastCommandResults = useLastCommandResults();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ActivityFilter>("all");
  const [selectedEntryKey, setSelectedEntryKey] = useState<string | null>(null);
  const [clearMessage, setClearMessage] = useState("");
  const [logMessage, setLogMessage] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [pendingClear, setPendingClear] = useState(false);
  const compactLayout = useCompactLayout(rootRef, PANEL_COMPACT_BREAKPOINT);
  const [compactInspectorOpen, setCompactInspectorOpen] = useState(false);
  const menuAnchorRef = useRef<HTMLButtonElement | null>(null);

  const entries = useMemo<ActivityEntry[]>(
    () => buildActivityEntries(lastCommandResults.timeline),
    [lastCommandResults.timeline],
  );

  const filteredEntries = useMemo(
    () => filterActivity(entries, search, filter),
    [entries, filter, search],
  );
  const groupedEntries = useMemo(
    () => groupActivityEntries(filteredEntries),
    [filteredEntries],
  );
  const selectedEntry =
    filteredEntries.find((entry) => entry.key === selectedEntryKey) ?? filteredEntries[0] ?? null;
  const hasEntries = entries.length > 0;
  const footerMessage = clearMessage || logMessage;
  const showList = !compactLayout || !compactInspectorOpen;
  const showInspector = !compactLayout || compactInspectorOpen;

  useEffect(() => {
    const nextEntryKey = resolveSelectedActivityEntryKey(selectedEntryKey, filteredEntries);
    if (nextEntryKey !== selectedEntryKey) {
      setSelectedEntryKey(nextEntryKey);
    }
  }, [filteredEntries, selectedEntryKey]);

  useEffect(() => {
    if (!compactLayout) {
      setCompactInspectorOpen(false);
    }
  }, [compactLayout]);

  useEffect(() => {
    if (externalClearSignal < 1) {
      return;
    }
    applyClear();
  }, [externalClearSignal]);

  useEffect(() => {
    if (externalOpenLogSignal < 1 || !entries.length) {
      return;
    }
    void openActivityLog();
  }, [entries.length, externalOpenLogSignal]);

  async function openActivityLog() {
    await exportActivity(ACTIVITY_STATUS_NOTIFICATION.logOpened);
  }

  async function exportRedactedActivity() {
    await exportActivity(ACTIVITY_STATUS_NOTIFICATION.redactedExported);
  }

  async function exportActivity(notificationTitle: string) {
    if (!entries.length) {
      return;
    }

    const result = await exportActivityLog(buildActivityExportBody(entries));
    const message = buildActivityExportMessage(result.filename);
    setClearMessage("");
    setLogMessage(message);
    await notifyDesktop({
      title: notificationTitle,
      body: message,
    });
  }

  function applyClear() {
    clearLastCommandResults();
    setSelectedEntryKey(null);
    setPendingClear(false);
    setClearMessage(ACTIVITY_STATUS_NOTIFICATION.clearMessage);
    setLogMessage("");
    setMenuOpen(false);
  }

  function refreshActivity() {
    setMenuOpen(false);
    setClearMessage("");
    setLogMessage("");
    setSelectedEntryKey(filteredEntries[0]?.key ?? null);
    void queryClient.invalidateQueries({ queryKey: DESKTOP_QUERY_KEYS.bootstrap });
  }

  return (
    <div ref={rootRef} className="activity-screen screen-content">
      <div className="activity-toolbar-row">
        <SearchField
          className="search-field activity-search-field"
          inputClassName="search-field-input"
          ariaLabel={ACTIVITY_TOOLBAR_COPY.searchAriaLabel}
          placeholder={ACTIVITY_TOOLBAR_COPY.searchPlaceholder}
          value={search}
          onChange={setSearch}
        />
        <SegmentedControl
          ariaLabel={ACTIVITY_TOOLBAR_COPY.filterAriaLabel}
          options={ACTIVITY_FILTER_OPTIONS}
          value={filter}
          onChange={setFilter}
        />
        <div className="activity-toolbar-menu-wrap">
          <button
            ref={menuAnchorRef}
            className="ghost-button icon-button"
            type="button"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label={ACTIVITY_TOOLBAR_COPY.menuAriaLabel}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <SFEllipsisCircle aria-hidden="true" focusable="false" size={16} />
          </button>
          {menuOpen ? (
            <AnchoredMenu
              anchorRef={menuAnchorRef}
              className="profile-row-actions-menu"
              role="menu"
              aria-label={ACTIVITY_TOOLBAR_COPY.menuLabel}
            >
              <button className="ghost-button" role="menuitem" type="button" onClick={refreshActivity}>
                {ACTIVITY_TOOLBAR_COPY.refreshLabel}
              </button>
              <button
                className="ghost-button"
                role="menuitem"
                type="button"
                disabled={!hasEntries}
                onClick={() => {
                  setMenuOpen(false);
                  void openActivityLog();
                }}
              >
                {ACTIVITY_TOOLBAR_COPY.openLogLabel}
              </button>
              <button
                className="ghost-button"
                role="menuitem"
                type="button"
                disabled={!hasEntries}
                onClick={() => {
                  setMenuOpen(false);
                  void exportRedactedActivity();
                }}
              >
                {ACTIVITY_TOOLBAR_COPY.exportLabel}
              </button>
              <div className="menu-divider" aria-hidden="true" />
              <button
                className="ghost-button profile-row-actions-danger"
                role="menuitem"
                type="button"
                disabled={!hasEntries}
                onClick={() => {
                  setMenuOpen(false);
                  setPendingClear(true);
                }}
              >
                {ACTIVITY_TOOLBAR_COPY.clearLabel}
              </button>
            </AnchoredMenu>
          ) : null}
        </div>
      </div>

      <SplitView
        className="activity-master-detail"
        primaryClassName="activity-list-pane"
        secondaryClassName="activity-inspector-pane"
        primary={showList ? (
          <section className="activity-pane">
            <div
              className="activity-list-body"
              aria-label={ACTIVITY_PANEL_COPY.listAriaLabel}
            >
              {groupedEntries.length ? (
                groupedEntries.map((group) => (
                  <section key={group.label} className="activity-group" aria-label={group.label}>
                    <h3 className="activity-group-heading">{group.label}</h3>
                    <div className="activity-group-list">
                      {group.entries.map((entry) => (
                        <button
                          key={entry.key}
                          type="button"
                          className={`activity-event-row ${
                            selectedEntry?.key === entry.key ? "activity-event-row-selected" : ""
                          }`}
                          aria-label={activityEntryAriaLabel(entry)}
                          aria-pressed={selectedEntry?.key === entry.key}
                          onClick={() => {
                            setSelectedEntryKey(entry.key);
                            setClearMessage("");
                            setLogMessage("");
                            if (compactLayout) {
                              setCompactInspectorOpen(true);
                            }
                          }}
                        >
                          <div className="activity-event-time">{formatActivityTimestamp(entry.at)}</div>
                          <div className="activity-event-main">
                            <div className="activity-event-title-row">
                              <span className={`activity-event-status activity-event-status-${entry.status}`}>
                                <span aria-hidden="true">{activityStatusSymbol(entry.status, "row")}</span>
                                <strong>{entry.label}</strong>
                              </span>
                            </div>
                            <p className="activity-event-detail">{activitySecondaryLine(entry)}</p>
                          </div>
                          <div className="activity-event-tail">
                            <span>{activityTrailingLine(entry)}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </section>
                ))
              ) : (
                <div className="activity-empty-state">
                  <h3>{ACTIVITY_EMPTY_STATE.heading}</h3>
                  <p className="inline-note">{ACTIVITY_EMPTY_STATE.detail}</p>
                </div>
              )}
            </div>
          </section>
        ) : null}
        secondary={showInspector ? (
          <aside className="activity-pane activity-inspector-surface">
            {selectedEntry ? (
              <div className="activity-inspector-content">
                <header className="activity-inspector-header">
                  <div>
                    {compactLayout ? (
                      <button
                        className="ghost-button activity-inspector-back"
                        type="button"
                        onClick={() => setCompactInspectorOpen(false)}
                      >
                        {ACTIVITY_PANEL_COPY.backLabel}
                      </button>
                    ) : null}
                    <h3>{selectedEntry.label}</h3>
                    <p className={`activity-inspector-status activity-inspector-status-${selectedEntry.status}`}>
                      <span aria-hidden="true">{activityStatusSymbol(selectedEntry.status, "inspector")}</span>
                      <span>{activityStatusLabel(selectedEntry.status)}</span>
                    </p>
                  </div>
                </header>
                <p className="inline-note activity-inspector-message">{selectedEntry.message}</p>
                <KeyValueGrid
                  variant="plain"
                  rows={[
                    {
                      label: ACTIVITY_INSPECTOR_COPY.scopeLabel,
                      value:
                        selectedEntry.scopeType === "tool" && selectedEntry.scopeTool ? (
                          <ToolBrand
                            tool={selectedEntry.scopeTool}
                            className="tool-brand-inline"
                            logoSize={16}
                          />
                        ) : (
                          buildActivityScopeValue(selectedEntry)
                        ),
                    },
                    ...buildActivityInspectorRows(selectedEntry),
                  ]}
                />
                <details className="activity-disclosure">
                  <summary>{ACTIVITY_INSPECTOR_COPY.commandHeading}</summary>
                  {selectedEntry.command ? <pre>{selectedEntry.command}</pre> : (
                    <p className="inline-note">{activityRecordedCommand(selectedEntry)}</p>
                  )}
                </details>
                <details className="activity-disclosure">
                  <summary>{ACTIVITY_INSPECTOR_COPY.resultHeading}</summary>
                  {selectedEntry.resultSummary ? <pre>{selectedEntry.resultSummary}</pre> : (
                    <p className="inline-note">{activityRecordedResult(selectedEntry)}</p>
                  )}
                </details>
              </div>
            ) : (
              <div className="activity-empty-state activity-empty-state-compact">
                <h3>{ACTIVITY_EMPTY_SELECTION_STATE.heading}</h3>
                <p className="inline-note">{ACTIVITY_EMPTY_SELECTION_STATE.detail}</p>
              </div>
            )}
          </aside>
        ) : null}
      />

      <div className="activity-footer-line">
        <p>{activityFooterMessage(footerMessage)}</p>
      </div>

      {pendingClear ? (
        <DialogSurface
          ariaLabel={ACTIVITY_CLEAR_DIALOG.ariaLabel}
          className="quick-switch-palette profile-sheet"
          initialFocusSelector="button:not([disabled])"
          onClose={() => setPendingClear(false)}
        >
          <div className="quick-switch-header">
            <div>
              <p className="card-kicker">{ACTIVITY_CLEAR_DIALOG.kicker}</p>
              <h3>{ACTIVITY_CLEAR_DIALOG.heading}</h3>
              <p className="inline-note">{ACTIVITY_CLEAR_DIALOG.detail}</p>
            </div>
          </div>
          <footer className="quick-switch-footer">
            <div className="button-row">
              <button className="ghost-button" type="button" onClick={() => setPendingClear(false)}>
                {ACTIVITY_PANEL_COPY.cancelLabel}
              </button>
              <button className="ghost-button danger-button" type="button" onClick={applyClear}>
                {ACTIVITY_CLEAR_DIALOG.confirmLabel}
              </button>
            </div>
          </footer>
        </DialogSurface>
      ) : null}
    </div>
  );
}
