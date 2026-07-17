import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { ButtonRow } from "../../../components/ButtonRow";
import {
  DIALOG_FOCUS_SELECTORS,
  DIALOG_SURFACE_CLASS_NAMES,
  DialogSurface,
} from "../../../components/DialogSurface";
import { KeyValueGrid } from "../../../components/KeyValueGrid";
import { OverflowMenuButton } from "../../../components/OverflowMenuButton";
import { PaneInspectorHeader } from "../../../components/PaneInspectorHeader";
import { SearchField } from "../../../components/SearchField";
import { SheetFooter } from "../../../components/SheetFooter";
import { SheetHeader } from "../../../components/SheetHeader";
import { SplitView } from "../../../components/SplitView";
import { ToolBrand } from "../../../components/ToolBrand";
import { useCompactInspectorLayout } from "../../../components/useCompactInspectorLayout";
import { listBackups, openAppDataFolder } from "../../../lib/client";
import {
  backupTimestampValue,
  backupReasonLabel,
  formatBackupInspectorTimestamp,
  formatBackupListTimestamp,
  resolveBackupTarget,
} from "../../../lib/backups";
import { DESKTOP_QUERY_KEYS } from "../../../lib/desktop-query-keys";
import { PANEL_COMPACT_BREAKPOINT } from "../../../lib/layout";
import { nullishToNull } from "../../../lib/parse-guards";
import { findSnapshotToolStatus, toolProfileDisplayLabel } from "../../../lib/profile-display";
import { AppBootstrap, AppSnapshot, DesktopSettings, type BackupEntry } from "../../../lib/schemas";
import { toolDisplayName } from "../../../lib/tool-display";
import { resolveStateModeRequest } from "../../shared/state-modes";
import { useDesktopActions } from "../../shared/useDesktopActions";
import { useMutationAwareQueryEnabled } from "../../shared/mutationQueue";
import {
  BACKUPS_DATE_FILTER_OPTIONS,
  DEFAULT_BACKUPS_DATE_FILTER,
  DEFAULT_BACKUPS_TOOL_FILTER,
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
  const backups = useQuery({
    queryKey: DESKTOP_QUERY_KEYS.backups,
    queryFn: listBackups,
    enabled: readEnabled,
  });
  const { restoreBackupMutation, useProfileMutation, mutationLock } = useDesktopActions();
  const [toolFilter, setToolFilter] = useState<ToolFilter>(DEFAULT_BACKUPS_TOOL_FILTER);
  const [dateFilter, setDateFilter] = useState<DateFilter>(DEFAULT_BACKUPS_DATE_FILTER);
  const [search, setSearch] = useState("");
  const [selectedBackupId, setSelectedBackupId] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState("");
  const [toolbarMenuOpen, setToolbarMenuOpen] = useState(false);
  const [inspectorMenuOpen, setInspectorMenuOpen] = useState(false);
  const toolbarMenuAnchorRef = useRef<HTMLButtonElement | null>(null);
  const inspectorMenuAnchorRef = useRef<HTMLButtonElement | null>(null);
  const {
    compactLayout,
    setCompactInspectorOpen,
    showPrimary: showTable,
    showInspector,
  } = useCompactInspectorLayout(rootRef, PANEL_COMPACT_BREAKPOINT);
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

  const selectedInspector = buildBackupInspectorState(
    selectedBackupId,
    filteredBackups,
    settings,
    snapshot,
  );
  const emptyState = buildBackupsEmptyState(backups.isLoading);

  const restoreSheet = buildRestoreSheetState(
    nullishToNull(pendingRestore?.backupId),
    nullishToNull(pendingRestore?.mode),
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
    const preferredStateMode = nullishToNull(
      findSnapshotToolStatus(snapshot, target.tool)?.state_mode,
    );

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
        <OverflowMenuButton
          open={toolbarMenuOpen}
          anchorRef={toolbarMenuAnchorRef}
          variant="toolbar"
          containerClassName="backups-toolbar-menu-wrap"
          triggerAriaLabel={BACKUPS_PANEL_COPY.toolbarMenuMoreAriaLabel}
          menuAriaLabel={BACKUPS_PANEL_COPY.toolbarMenuAriaLabel}
          items={[
            {
              key: "refresh",
              label: BACKUPS_PANEL_COPY.refreshLabel,
              onSelect: () => {
                setToolbarMenuOpen(false);
                void backups.refetch();
              },
            },
          ]}
          onToggle={() => setToolbarMenuOpen((open) => !open)}
        />
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
                    const createdAt = backupTimestampValue(entry);
                    const createdLabel = formatBackupListTimestamp(createdAt);
                    const createdDetail = formatBackupInspectorTimestamp(createdAt);
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
                          <ToolBrand
                            tool={target.tool}
                            variant="compact"
                            shortName
                          />
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
                <PaneInspectorHeader
                  className="backups-pane-header backups-inspector-header"
                  title={selectedInspector.title}
                  backLabel={compactLayout ? BACKUPS_PANEL_COPY.inspector.backLabel : undefined}
                  backButtonClassName="backups-inspector-back"
                  onBack={compactLayout ? () => setCompactInspectorOpen(false) : undefined}
                  supporting={<p className="inline-note">{selectedInspector.subtitle}</p>}
                  trailing={<div className="backups-inspector-header-actions">
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
                    <OverflowMenuButton
                      open={inspectorMenuOpen}
                      anchorRef={inspectorMenuAnchorRef}
                      variant="toolbar"
                      containerClassName="backups-toolbar-menu-wrap"
                      triggerAriaLabel={BACKUPS_PANEL_COPY.inspector.menuAriaLabel}
                      menuAriaLabel={BACKUPS_PANEL_COPY.inspector.menuAriaLabel}
                      containmentSelector=".backups-inspector-surface"
                      items={[
                        {
                          key: "restore-activate",
                          label: BACKUPS_PANEL_COPY.inspector.restoreAndActivateLabel,
                          disabled: mutationLock.isBusy,
                          onSelect: () => {
                            setInspectorMenuOpen(false);
                            setPendingRestore({
                              backupId: selectedInspector.entry.backup_id,
                              mode: "activate",
                            });
                          },
                        },
                        {
                          key: "open-profile",
                          label: BACKUPS_PANEL_COPY.inspector.openProfileLabel,
                          onSelect: () => {
                            setInspectorMenuOpen(false);
                            onOpenProfiles(
                              selectedInspector.target.tool,
                              selectedInspector.target.profile,
                            );
                          },
                        },
                        {
                          key: "copy-backup-id",
                          label: BACKUPS_PANEL_COPY.inspector.copyBackupIdLabel,
                          onSelect: () => {
                            setInspectorMenuOpen(false);
                            void copyBackupId(selectedInspector.entry.backup_id);
                          },
                        },
                        {
                          key: "reveal-backup-folder",
                          label: BACKUPS_PANEL_COPY.inspector.revealBackupFolderLabel,
                          onSelect: () => {
                            setInspectorMenuOpen(false);
                            void revealBackupFolder();
                          },
                        },
                      ]}
                      onToggle={() => setInspectorMenuOpen((open) => !open)}
                    />
                  </div>}
                />

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
          className={DIALOG_SURFACE_CLASS_NAMES.sheet}
          initialFocusSelector={DIALOG_FOCUS_SELECTORS.action}
          onClose={() => setPendingRestore(null)}
        >
          <SheetHeader
            kicker={restoreSheet.kicker}
            title={restoreSheet.heading}
            detail={restoreSheet.detail}
          />
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
                    variant="inline"
                  />
                ),
              },
              {
                label: BACKUPS_PANEL_COPY.restoreSheet.createdLabel,
                value: formatBackupInspectorTimestamp(backupTimestampValue(restoreSheet.entry)),
              },
            ]}
          />
          <p className="inline-note">{restoreSheet.followup}</p>
          <SheetFooter>
            <ButtonRow>
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
            </ButtonRow>
          </SheetFooter>
        </DialogSurface>
      ) : null}
    </div>
  );
}
