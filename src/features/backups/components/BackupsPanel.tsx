import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { SFEllipsisCircle } from "sf-symbols-lib/monochrome/SFEllipsisCircle";
import { AnchoredMenu } from "../../../components/AnchoredMenu";
import { DialogSurface } from "../../../components/DialogSurface";
import { KeyValueGrid } from "../../../components/KeyValueGrid";
import { SearchField } from "../../../components/SearchField";
import { SplitView } from "../../../components/SplitView";
import { ToolBrand } from "../../../components/ToolBrand";
import { useCompactLayout } from "../../../components/useCompactLayout";
import { listBackups, openAppDataFolder } from "../../../lib/client";
import {
  backupReasonLabel,
  formatBackupInspectorTimestamp,
  formatBackupListTimestamp,
  resolveBackupTarget,
} from "../../../lib/backups";
import { PANEL_COMPACT_BREAKPOINT } from "../../../lib/layout";
import { toolProfileDisplayLabel } from "../../../lib/profile-display";
import { AppBootstrap, AppSnapshot, DesktopSettings, type BackupEntry } from "../../../lib/schemas";
import { toolDisplayName } from "../../../lib/tool-display";
import { resolveStateModeRequest } from "../../shared/state-modes";
import { useDesktopActions } from "../../shared/useDesktopActions";
import { useMutationAwareQueryEnabled } from "../../shared/mutationQueue";
import {
  BACKUPS_DATE_FILTER_OPTIONS,
  BACKUPS_PANEL_COPY,
  BACKUPS_TOOL_FILTER_OPTIONS,
  backupIdCopyMessage,
  backupRowAriaLabel,
  buildBackupsEmptyState,
  buildBackupInspectorState,
  buildRestoreSheetState,
  filterBackups,
  normalizeBackupsDateFilter,
  normalizeBackupsToolFilter,
  resolveSelectedBackupId,
  sortBackups,
  type DateFilter,
  type PendingRestoreMode,
  type ToolFilter,
} from "../backups-panel-display";

export function BackupsPanel({
  snapshot,
  settings,
  toolCapabilities,
  onOpenProfiles,
}: {
  snapshot: AppSnapshot;
  settings: DesktopSettings;
  toolCapabilities: NonNullable<AppBootstrap["runtime_status"]["capabilities"]>["tools"];
  onOpenProfiles: (tool: string, expandedProfile?: string | null) => void;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const readEnabled = useMutationAwareQueryEnabled();
  const backups = useQuery({ queryKey: ["backups"], queryFn: listBackups, enabled: readEnabled });
  const { restoreBackupMutation, useProfileMutation, mutationLock } = useDesktopActions();
  const [toolFilter, setToolFilter] = useState<ToolFilter>("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("newest");
  const [search, setSearch] = useState("");
  const [selectedBackupId, setSelectedBackupId] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState("");
  const [toolbarMenuOpen, setToolbarMenuOpen] = useState(false);
  const [inspectorMenuOpen, setInspectorMenuOpen] = useState(false);
  const toolbarMenuAnchorRef = useRef<HTMLButtonElement | null>(null);
  const inspectorMenuAnchorRef = useRef<HTMLButtonElement | null>(null);
  const compactLayout = useCompactLayout(rootRef, PANEL_COMPACT_BREAKPOINT);
  const [compactInspectorOpen, setCompactInspectorOpen] = useState(false);
  const [pendingRestore, setPendingRestore] = useState<{
    backupId: string;
    mode: PendingRestoreMode;
  } | null>(null);

  const sortedBackups = useMemo(
    () => [...(backups.data ?? [])].sort((left, right) => sortBackups(left, right, dateFilter)),
    [backups.data, dateFilter],
  );
  const filteredBackups = useMemo(
    () => filterBackups(sortedBackups, toolFilter, search, settings, snapshot),
    [search, settings, snapshot, sortedBackups, toolFilter],
  );

  useEffect(() => {
    const nextBackupId = resolveSelectedBackupId(selectedBackupId, filteredBackups);
    if (nextBackupId !== selectedBackupId) {
      setSelectedBackupId(nextBackupId);
    }
  }, [filteredBackups, selectedBackupId]);

  useEffect(() => {
    if (!compactLayout) {
      setCompactInspectorOpen(false);
    }
  }, [compactLayout]);

  const selectedInspector = buildBackupInspectorState(
    selectedBackupId,
    filteredBackups,
    settings,
    snapshot,
  );
  const emptyState = buildBackupsEmptyState(backups.isLoading);
  const showInspector = !compactLayout || compactInspectorOpen;
  const showTable = !compactLayout || !compactInspectorOpen;

  const restoreSheet = buildRestoreSheetState(
    pendingRestore?.backupId ?? null,
    pendingRestore?.mode ?? null,
    filteredBackups,
    sortedBackups,
    settings,
    snapshot,
  );

  async function copyBackupId(backupId: string) {
    if (!navigator.clipboard?.writeText) {
      setCopyMessage(backupIdCopyMessage(false, backupId));
      return;
    }
    await navigator.clipboard.writeText(backupId);
    setCopyMessage(backupIdCopyMessage(true, backupId));
  }

  async function revealBackupFolder() {
    await openAppDataFolder();
  }

  function confirmRestore(entry: BackupEntry, mode: "files" | "activate") {
    const target = resolveBackupTarget(entry.tool, entry.profile);
    const profileLabel = toolProfileDisplayLabel(settings, snapshot, target.tool, target.profile);
    const preferredStateMode =
      snapshot.statuses.find((status) => status.tool === target.tool)?.state_mode ?? null;

    restoreBackupMutation.mutate(entry.backup_id, {
      onSuccess: () => {
        setPendingRestore(null);
        if (mode === "activate") {
          useProfileMutation.mutate({
            tool: target.tool,
            profile: target.profile,
            stateMode: resolveStateModeRequest(
              target.tool,
              toolCapabilities,
              preferredStateMode,
            ),
            label: profileLabel,
          });
        }
      },
    });
  }

  return (
    <div ref={rootRef} className="backups-screen screen-content">
      <div
        className="backups-filter-row"
        role="toolbar"
        aria-label={BACKUPS_PANEL_COPY.toolbarAriaLabel}
      >
        <label className="visually-hidden" htmlFor="backups-tool-filter">
          {BACKUPS_PANEL_COPY.toolFilterLabel}
        </label>
        <select
          id="backups-tool-filter"
          aria-label={BACKUPS_PANEL_COPY.toolFilterLabel}
          value={toolFilter}
          onChange={(event) => setToolFilter(normalizeBackupsToolFilter(event.target.value, toolFilter))}
        >
          {BACKUPS_TOOL_FILTER_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <label className="visually-hidden" htmlFor="backups-date-filter">
          {BACKUPS_PANEL_COPY.dateFilterLabel}
        </label>
        <select
          id="backups-date-filter"
          aria-label={BACKUPS_PANEL_COPY.dateFilterLabel}
          value={dateFilter}
          onChange={(event) => setDateFilter(normalizeBackupsDateFilter(event.target.value, dateFilter))}
        >
          {BACKUPS_DATE_FILTER_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <SearchField
          ariaLabel={BACKUPS_PANEL_COPY.searchAriaLabel}
          ariaControls="backups-table"
          placeholder={BACKUPS_PANEL_COPY.searchPlaceholder}
          value={search}
          onChange={setSearch}
          className="search-field backups-search-field"
        />
        <div className="backups-toolbar-menu-wrap">
          <button
            ref={toolbarMenuAnchorRef}
            className="ghost-button icon-button"
            type="button"
            aria-haspopup="menu"
            aria-expanded={toolbarMenuOpen}
            aria-label={BACKUPS_PANEL_COPY.toolbarMenuMoreAriaLabel}
            onClick={() => setToolbarMenuOpen((open) => !open)}
          >
            <SFEllipsisCircle aria-hidden="true" focusable="false" size={16} />
          </button>
          {toolbarMenuOpen ? (
            <AnchoredMenu
              anchorRef={toolbarMenuAnchorRef}
              className="profile-row-actions-menu"
              role="menu"
              aria-label={BACKUPS_PANEL_COPY.toolbarMenuAriaLabel}
            >
              <button
                className="ghost-button"
                role="menuitem"
                type="button"
                onClick={() => {
                  setToolbarMenuOpen(false);
                  void backups.refetch();
                }}
              >
                {BACKUPS_PANEL_COPY.refreshLabel}
              </button>
            </AnchoredMenu>
          ) : null}
        </div>
      </div>

      <SplitView
        className="backups-master-detail"
        primaryClassName="backups-table-pane"
        secondaryClassName="backups-inspector-pane"
        primary={showTable ? (
          <section className="backups-pane">
            {filteredBackups.length ? (
              <div className="backups-table-wrap">
                <div className="backups-table-header" aria-hidden="true">
                  <span>{BACKUPS_PANEL_COPY.columns.created}</span>
                  <span>{BACKUPS_PANEL_COPY.columns.tool}</span>
                  <span>{BACKUPS_PANEL_COPY.columns.profile}</span>
                  <span className="backups-table-reason">{BACKUPS_PANEL_COPY.columns.reason}</span>
                </div>
                <div
                  className="backups-table-body"
                  role="list"
                  id="backups-table"
                  aria-label={BACKUPS_PANEL_COPY.tableAriaLabel}
                >
                  {filteredBackups.map((entry) => {
                    const target = resolveBackupTarget(entry.tool, entry.profile);
                    const toolLabel = toolDisplayName(target.tool);
                    const profileLabel = toolProfileDisplayLabel(
                      settings,
                      snapshot,
                      target.tool,
                      target.profile,
                    );
                    const createdLabel = formatBackupListTimestamp(entry.created_at ?? entry.backup_id);
                    const createdDetail = formatBackupInspectorTimestamp(
                      entry.created_at ?? entry.backup_id,
                    );
                    const reasonLabel = backupReasonLabel(entry);

                    return (
                      <button
                        key={entry.backup_id}
                        type="button"
                        role="listitem"
                        className={`backups-table-row ${
                          selectedInspector?.entry.backup_id === entry.backup_id
                            ? "backups-table-row-selected"
                            : ""
                        }`}
                        aria-label={backupRowAriaLabel(toolLabel, profileLabel)}
                        aria-pressed={selectedInspector?.entry.backup_id === entry.backup_id}
                        onClick={() => {
                          setSelectedBackupId(entry.backup_id);
                          setCopyMessage("");
                          setInspectorMenuOpen(false);
                          if (compactLayout) {
                            setCompactInspectorOpen(true);
                          }
                        }}
                      >
                        <span title={createdDetail}>{createdLabel}</span>
                        <span>
                          <ToolBrand tool={target.tool} className="tool-brand-compact" logoSize={16} shortName />
                        </span>
                        <span>{profileLabel}</span>
                        <span className="backups-table-reason">{reasonLabel}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="backups-empty-state">
                <h3>{emptyState.heading}</h3>
                <p className="inline-note">{emptyState.detail}</p>
              </div>
            )}
          </section>
        ) : null}
        secondary={showInspector ? (
          <aside className="backups-pane backups-inspector-surface">
            {selectedInspector ? (
              <>
                <header className="backups-pane-header backups-inspector-header">
                  <div>
                    {compactLayout ? (
                      <button
                        className="ghost-button backups-inspector-back"
                        type="button"
                        onClick={() => setCompactInspectorOpen(false)}
                      >
                        {BACKUPS_PANEL_COPY.inspector.backLabel}
                      </button>
                    ) : null}
                    <h3>{selectedInspector.title}</h3>
                    <p className="inline-note">{selectedInspector.subtitle}</p>
                  </div>
                  <div className="backups-inspector-header-actions">
                    <button
                      className="primary-button"
                      type="button"
                      disabled={mutationLock.isBusy}
                      onClick={() =>
                        setPendingRestore({
                          backupId: selectedInspector.entry.backup_id,
                          mode: "files",
                        })
                      }
                    >
                      {BACKUPS_PANEL_COPY.inspector.restoreLabel}
                    </button>
                    <div className="backups-toolbar-menu-wrap">
                      <button
                        ref={inspectorMenuAnchorRef}
                        className="ghost-button icon-button"
                        type="button"
                        aria-haspopup="menu"
                        aria-expanded={inspectorMenuOpen}
                        aria-label={BACKUPS_PANEL_COPY.inspector.menuAriaLabel}
                        onClick={() => setInspectorMenuOpen((open) => !open)}
                      >
                        <SFEllipsisCircle aria-hidden="true" focusable="false" size={16} />
                      </button>
                      {inspectorMenuOpen ? (
                        <AnchoredMenu
                          anchorRef={inspectorMenuAnchorRef}
                          className="profile-row-actions-menu"
                          align="start"
                          containmentSelector=".backups-inspector-surface"
                          role="menu"
                          aria-label={BACKUPS_PANEL_COPY.inspector.menuAriaLabel}
                        >
                          <button
                            className="ghost-button"
                            role="menuitem"
                            type="button"
                            disabled={mutationLock.isBusy}
                            onClick={() => {
                              setInspectorMenuOpen(false);
                              setPendingRestore({
                                backupId: selectedInspector.entry.backup_id,
                                mode: "activate",
                              });
                            }}
                          >
                            {BACKUPS_PANEL_COPY.inspector.restoreAndActivateLabel}
                          </button>
                          <button
                            className="ghost-button"
                            role="menuitem"
                            type="button"
                            onClick={() => {
                              setInspectorMenuOpen(false);
                              onOpenProfiles(
                                selectedInspector.target.tool,
                                selectedInspector.target.profile,
                              );
                            }}
                          >
                            {BACKUPS_PANEL_COPY.inspector.openProfileLabel}
                          </button>
                          <button
                            className="ghost-button"
                            role="menuitem"
                            type="button"
                            onClick={() => {
                              setInspectorMenuOpen(false);
                              void copyBackupId(selectedInspector.entry.backup_id);
                            }}
                          >
                            {BACKUPS_PANEL_COPY.inspector.copyBackupIdLabel}
                          </button>
                          <button
                            className="ghost-button"
                            role="menuitem"
                            type="button"
                            onClick={() => {
                              setInspectorMenuOpen(false);
                              void revealBackupFolder();
                            }}
                          >
                            {BACKUPS_PANEL_COPY.inspector.revealBackupFolderLabel}
                          </button>
                        </AnchoredMenu>
                      ) : null}
                    </div>
                  </div>
                </header>

                <div className="backups-inspector-content">
                  <KeyValueGrid
                    variant="plain"
                    rows={[
                      {
                        label: BACKUPS_PANEL_COPY.inspector.infoLabels.created,
                        value: selectedInspector.created,
                      },
                      {
                        label: BACKUPS_PANEL_COPY.inspector.infoLabels.reason,
                        value:
                          selectedInspector.reason ??
                          BACKUPS_PANEL_COPY.inspector.reasonFallback,
                      },
                      {
                        label: BACKUPS_PANEL_COPY.inspector.infoLabels.contains,
                        value:
                          selectedInspector.contains ??
                          BACKUPS_PANEL_COPY.inspector.containsFallback,
                      },
                    ]}
                  />
                  <section className="backups-inspector-section">
                    <p className="overview-current-set-cell-label">
                      {BACKUPS_PANEL_COPY.inspector.infoLabels.backupId}
                    </p>
                    <div className="backups-id-row">
                      <code>{selectedInspector.entry.backup_id}</code>
                      <button
                        className="ghost-button"
                        type="button"
                        onClick={() => void copyBackupId(selectedInspector.entry.backup_id)}
                      >
                        {BACKUPS_PANEL_COPY.inspector.copyLabel}
                      </button>
                    </div>
                  </section>
                  {copyMessage ? <p className="inline-note">{copyMessage}</p> : null}
                </div>
              </>
            ) : (
              <div className="backups-empty-state backups-empty-state-compact">
                <h3>{BACKUPS_PANEL_COPY.emptyStates.unselected.heading}</h3>
                <p className="inline-note">{BACKUPS_PANEL_COPY.emptyStates.unselected.detail}</p>
              </div>
            )}
          </aside>
        ) : null}
      />

      {restoreSheet ? (
        <DialogSurface
          ariaLabel={BACKUPS_PANEL_COPY.restoreSheet.ariaLabel}
          className="quick-switch-palette profile-sheet"
          initialFocusSelector="button:not([disabled])"
          onClose={() => setPendingRestore(null)}
        >
          <div className="quick-switch-header">
            <div>
              <p className="card-kicker">{restoreSheet.kicker}</p>
              <h3>{restoreSheet.heading}</h3>
              <p className="inline-note">{restoreSheet.detail}</p>
            </div>
          </div>
          <KeyValueGrid
            rows={[
              {
                label: BACKUPS_PANEL_COPY.restoreSheet.profileLabel,
                value: restoreSheet.profileLabel,
              },
              {
                label: BACKUPS_PANEL_COPY.restoreSheet.toolLabel,
                value: (
                  <ToolBrand
                    tool={restoreSheet.target.tool}
                    className="tool-brand-inline"
                    logoSize={16}
                  />
                ),
              },
              {
                label: BACKUPS_PANEL_COPY.restoreSheet.createdLabel,
                value: formatBackupInspectorTimestamp(
                  restoreSheet.entry.created_at ?? restoreSheet.entry.backup_id,
                ),
              },
            ]}
          />
          <p className="inline-note">{restoreSheet.followup}</p>
          <footer className="quick-switch-footer">
            <div className="button-row">
              <button
                className="ghost-button"
                type="button"
                onClick={() => setPendingRestore(null)}
              >
                {BACKUPS_PANEL_COPY.restoreSheet.cancelLabel}
              </button>
              <button
                className="primary-button"
                type="button"
                disabled={mutationLock.isBusy}
                onClick={() =>
                  confirmRestore(
                    restoreSheet.entry,
                    pendingRestore?.mode === "activate" ? "activate" : "files",
                  )
                }
              >
                {restoreSheet.confirmLabel}
              </button>
            </div>
          </footer>
        </DialogSurface>
      ) : null}
    </div>
  );
}
