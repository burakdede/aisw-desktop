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
  backupIdCopyMessage,
  buildBackupInspectorState,
  buildRestoreSheetState,
  filterBackups,
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
  const showInspector = !compactLayout || compactInspectorOpen;
  const showTable = !compactLayout || !compactInspectorOpen;

  const restoreSheet = buildRestoreSheetState(
    pendingRestore?.backupId ?? null,
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
      <div className="backups-filter-row" role="toolbar" aria-label="Backups filters">
        <label className="visually-hidden" htmlFor="backups-tool-filter">
          Tool
        </label>
        <select
          id="backups-tool-filter"
          aria-label="Tool"
          value={toolFilter}
          onChange={(event) => setToolFilter(event.target.value as ToolFilter)}
        >
          <option value="all">All tools</option>
          <option value="claude">Claude</option>
          <option value="codex">Codex</option>
          <option value="gemini">Gemini</option>
        </select>
        <label className="visually-hidden" htmlFor="backups-date-filter">
          Date
        </label>
        <select
          id="backups-date-filter"
          aria-label="Date"
          value={dateFilter}
          onChange={(event) => setDateFilter(event.target.value as DateFilter)}
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
        </select>
        <SearchField
          ariaLabel="Search backups"
          ariaControls="backups-table"
          placeholder="Search backups…"
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
            aria-label="Backups more actions"
            onClick={() => setToolbarMenuOpen((open) => !open)}
          >
            <SFEllipsisCircle aria-hidden="true" focusable="false" size={16} />
          </button>
          {toolbarMenuOpen ? (
            <AnchoredMenu
              anchorRef={toolbarMenuAnchorRef}
              className="profile-row-actions-menu"
              role="menu"
              aria-label="Backups actions"
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
                Refresh
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
                  <span>Created</span>
                  <span>Tool</span>
                  <span>Profile</span>
                  <span className="backups-table-reason">Reason</span>
                </div>
                <div className="backups-table-body" role="list" id="backups-table" aria-label="Backups list">
                  {filteredBackups.map((entry) => {
                    const target = resolveBackupTarget(entry.tool, entry.profile);
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
                        aria-label={`Inspect backup for ${toolDisplayName(target.tool)} ${profileLabel}`}
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
                <h3>{backups.isLoading ? "Loading backups…" : "No backups found"}</h3>
                <p className="inline-note">
                  {backups.isLoading
                    ? "Loading local restore points."
                    : "Restore points appear here automatically before AI Switch changes a saved profile."}
                </p>
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
                        Back
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
                      Restore…
                    </button>
                    <div className="backups-toolbar-menu-wrap">
                      <button
                        ref={inspectorMenuAnchorRef}
                        className="ghost-button icon-button"
                        type="button"
                        aria-haspopup="menu"
                        aria-expanded={inspectorMenuOpen}
                        aria-label="Backup actions"
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
                          aria-label="Backup actions"
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
                            Restore and Activate…
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
                            Open Profile
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
                            Copy Backup ID
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
                            Reveal Backup Folder
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
                      { label: "Created", value: selectedInspector.created },
                      {
                        label: "Reason",
                        value: selectedInspector.reason ?? "Created restore point",
                      },
                      { label: "Contains", value: selectedInspector.contains ?? "Profile files" },
                    ]}
                  />
                  <section className="backups-inspector-section">
                    <p className="overview-current-set-cell-label">Backup ID</p>
                    <div className="backups-id-row">
                      <code>{selectedInspector.entry.backup_id}</code>
                      <button
                        className="ghost-button"
                        type="button"
                        onClick={() => void copyBackupId(selectedInspector.entry.backup_id)}
                      >
                        Copy
                      </button>
                    </div>
                  </section>
                  {copyMessage ? <p className="inline-note">{copyMessage}</p> : null}
                </div>
              </>
            ) : (
              <div className="backups-empty-state backups-empty-state-compact">
                <h3>No backup selected</h3>
                <p className="inline-note">
                  Choose a restore point to inspect its contents and restore options.
                </p>
              </div>
            )}
          </aside>
        ) : null}
      />

      {restoreSheet ? (
        <DialogSurface
          ariaLabel="Restore Backup"
          className="quick-switch-palette profile-sheet"
          initialFocusSelector="button:not([disabled])"
          onClose={() => setPendingRestore(null)}
        >
          <div className="quick-switch-header">
            <div>
              <p className="card-kicker">Restore point</p>
              <h3>
                {pendingRestore?.mode === "files"
                  ? `Restore “${restoreSheet.profileLabel}”?`
                  : `Restore and Activate “${restoreSheet.profileLabel}”?`}
              </h3>
              <p className="inline-note">
                {pendingRestore?.mode === "files"
                  ? `This replaces the stored ${restoreSheet.toolLabel} profile files with the selected restore point.`
                  : `AI Switch will restore the stored files and then activate ${restoreSheet.profileLabel} for ${restoreSheet.toolLabel}.`}
              </p>
            </div>
          </div>
          <KeyValueGrid
            rows={[
              { label: "Profile", value: restoreSheet.profileLabel },
              {
                label: "Tool",
                value: (
                  <ToolBrand
                    tool={restoreSheet.target.tool}
                    className="tool-brand-inline"
                    logoSize={16}
                  />
                ),
              },
              {
                label: "Created",
                value: formatBackupInspectorTimestamp(
                  restoreSheet.entry.created_at ?? restoreSheet.entry.backup_id,
                ),
              },
            ]}
          />
          <p className="inline-note">
            {pendingRestore?.mode === "files"
              ? `The active ${restoreSheet.toolLabel} account will not change until you activate the profile.`
              : `This restores the files first and only then switches the live profile.`}
          </p>
          <footer className="quick-switch-footer">
            <div className="button-row">
              <button className="ghost-button" type="button" onClick={() => setPendingRestore(null)}>
                Cancel
              </button>
              <button
                className={
                  pendingRestore?.mode === "files" ? "primary-button" : "primary-button"
                }
                type="button"
                disabled={mutationLock.isBusy}
                onClick={() =>
                  confirmRestore(
                    restoreSheet.entry,
                    pendingRestore?.mode === "activate" ? "activate" : "files",
                  )
                }
              >
                {pendingRestore?.mode === "files"
                  ? "Restore Files"
                  : "Restore and Activate"}
              </button>
            </div>
          </footer>
        </DialogSurface>
      ) : null}
    </div>
  );
}
