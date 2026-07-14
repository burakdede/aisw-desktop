import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { SFEllipsisCircle } from "sf-symbols-lib/monochrome/SFEllipsisCircle";
import { AnchoredMenu } from "../../../components/AnchoredMenu";
import { DialogSurface } from "../../../components/DialogSurface";
import { KeyValueGrid } from "../../../components/KeyValueGrid";
import { SearchField } from "../../../components/SearchField";
import { SplitView } from "../../../components/SplitView";
import { ToolBrand } from "../../../components/ToolBrand";
import { listBackups, openAppDataFolder } from "../../../lib/client";
import { compareBackupsNewestFirst, type BackupLike } from "../../../lib/backups";
import { toolProfileDisplayLabel } from "../../../lib/profile-display";
import { AppBootstrap, AppSnapshot, DesktopSettings, type BackupEntry } from "../../../lib/schemas";
import { toolDisplayName } from "../../../lib/tool-display";
import { titleCase } from "../../../lib/utils";
import { resolveStateModeRequest } from "../../shared/state-modes";
import { useDesktopActions } from "../../shared/useDesktopActions";
import { useMutationAwareQueryEnabled } from "../../shared/mutationQueue";

type ToolFilter = "all" | "claude" | "codex" | "gemini";
type DateFilter = "newest" | "oldest";
const BACKUPS_COMPACT_BREAKPOINT = 800;

function measuredPaneWidth(element: HTMLDivElement | null) {
  if (!element) {
    return typeof window !== "undefined" ? window.innerWidth : BACKUPS_COMPACT_BREAKPOINT;
  }

  const width = element.getBoundingClientRect().width;
  if (width > 0) {
    return width;
  }

  return typeof window !== "undefined" ? window.innerWidth : BACKUPS_COMPACT_BREAKPOINT;
}

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
  const [compactLayout, setCompactLayout] = useState(false);
  const [compactInspectorOpen, setCompactInspectorOpen] = useState(false);
  const [pendingRestore, setPendingRestore] = useState<{
    backupId: string;
    mode: "files" | "activate";
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
    if (selectedBackupId && filteredBackups.some((entry) => entry.backup_id === selectedBackupId)) {
      return;
    }
    setSelectedBackupId(filteredBackups[0]?.backup_id ?? null);
  }, [filteredBackups, selectedBackupId]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const updateLayout = () => {
      setCompactLayout(measuredPaneWidth(rootRef.current) < BACKUPS_COMPACT_BREAKPOINT);
    };

    updateLayout();
    const observer =
      typeof ResizeObserver === "function"
        ? new ResizeObserver(() => {
            updateLayout();
          })
        : null;

    if (rootRef.current) {
      observer?.observe(rootRef.current);
    }
    window.addEventListener("resize", updateLayout);

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", updateLayout);
    };
  }, []);

  useEffect(() => {
    if (!rootRef.current) {
      return;
    }

    setCompactLayout(measuredPaneWidth(rootRef.current) < BACKUPS_COMPACT_BREAKPOINT);
  });

  useEffect(() => {
    if (!compactLayout) {
      setCompactInspectorOpen(false);
    }
  }, [compactLayout]);

  const selectedBackup =
    filteredBackups.find((entry) => entry.backup_id === selectedBackupId) ?? filteredBackups[0] ?? null;
  const selectedTarget = selectedBackup
    ? resolveBackupTarget(selectedBackup.tool, selectedBackup.profile)
    : null;
  const selectedProfileLabel =
    selectedBackup && selectedTarget
      ? toolProfileDisplayLabel(settings, snapshot, selectedTarget.tool, selectedTarget.profile)
      : null;
  const selectedReason = selectedBackup ? backupReasonLabel(selectedBackup) : null;
  const selectedContains = selectedBackup ? backupContainsLabel(selectedBackup) : null;
  const selectedCreated = selectedBackup
    ? formatBackupInspectorTimestamp(selectedBackup.created_at ?? selectedBackup.backup_id)
    : null;
  const selectedToolLabel = selectedTarget ? toolDisplayName(selectedTarget.tool) : null;
  const selectedTitle = selectedProfileLabel ?? "No backup selected";
  const selectedSubtitle = selectedToolLabel ? `${selectedToolLabel} backup` : "";
  const showInspector = !compactLayout || compactInspectorOpen;
  const showTable = !compactLayout || !compactInspectorOpen;

  const restoreSheetEntry = pendingRestore
    ? filteredBackups.find((entry) => entry.backup_id === pendingRestore.backupId) ??
      sortedBackups.find((entry) => entry.backup_id === pendingRestore.backupId) ??
      null
    : null;
  const restoreSheetTarget = restoreSheetEntry
    ? resolveBackupTarget(restoreSheetEntry.tool, restoreSheetEntry.profile)
    : null;
  const restoreSheetLabel =
    restoreSheetEntry && restoreSheetTarget
      ? toolProfileDisplayLabel(
          settings,
          snapshot,
          restoreSheetTarget.tool,
          restoreSheetTarget.profile,
        )
      : null;
  const restoreSheetToolLabel = restoreSheetTarget
    ? toolDisplayName(restoreSheetTarget.tool)
    : null;

  async function copyBackupId(backupId: string) {
    if (!navigator.clipboard?.writeText) {
      setCopyMessage(`Clipboard access is unavailable. Copy backup id ${backupId} manually.`);
      return;
    }
    await navigator.clipboard.writeText(backupId);
    setCopyMessage(`Copied backup ID.`);
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
                          selectedBackup?.backup_id === entry.backup_id
                            ? "backups-table-row-selected"
                            : ""
                        }`}
                        aria-label={`Inspect backup for ${toolDisplayName(target.tool)} ${profileLabel}`}
                        aria-pressed={selectedBackup?.backup_id === entry.backup_id}
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
            {selectedBackup && selectedTarget && selectedProfileLabel && selectedCreated && selectedContains ? (
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
                    <h3>{selectedTitle}</h3>
                    <p className="inline-note">{selectedSubtitle}</p>
                  </div>
                  <div className="backups-inspector-header-actions">
                    <button
                      className="primary-button"
                      type="button"
                      disabled={mutationLock.isBusy}
                      onClick={() =>
                        setPendingRestore({
                          backupId: selectedBackup.backup_id,
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
                                backupId: selectedBackup.backup_id,
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
                              onOpenProfiles(selectedTarget.tool, selectedTarget.profile);
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
                              void copyBackupId(selectedBackup.backup_id);
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
                      { label: "Created", value: selectedCreated },
                      { label: "Reason", value: selectedReason ?? "Created restore point" },
                      { label: "Contains", value: selectedContains },
                    ]}
                  />
                  <section className="backups-inspector-section">
                    <p className="overview-current-set-cell-label">Backup ID</p>
                    <div className="backups-id-row">
                      <code>{selectedBackup.backup_id}</code>
                      <button
                        className="ghost-button"
                        type="button"
                        onClick={() => void copyBackupId(selectedBackup.backup_id)}
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

      {restoreSheetEntry && restoreSheetTarget && restoreSheetLabel && restoreSheetToolLabel ? (
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
                  ? `Restore “${restoreSheetLabel}”?`
                  : `Restore and Activate “${restoreSheetLabel}”?`}
              </h3>
              <p className="inline-note">
                {pendingRestore?.mode === "files"
                  ? `This replaces the stored ${restoreSheetToolLabel} profile files with the selected restore point.`
                  : `AI Switch will restore the stored files and then activate ${restoreSheetLabel} for ${restoreSheetToolLabel}.`}
              </p>
            </div>
          </div>
          <KeyValueGrid
            rows={[
              { label: "Profile", value: restoreSheetLabel },
              {
                label: "Tool",
                value: <ToolBrand tool={restoreSheetTarget.tool} className="tool-brand-inline" logoSize={16} />,
              },
              {
                label: "Created",
                value: formatBackupInspectorTimestamp(
                  restoreSheetEntry.created_at ?? restoreSheetEntry.backup_id,
                ),
              },
            ]}
          />
          <p className="inline-note">
            {pendingRestore?.mode === "files"
              ? `The active ${restoreSheetToolLabel} account will not change until you activate the profile.`
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
                    restoreSheetEntry,
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

function resolveBackupTarget(tool: string, profile: string) {
  if (profile.includes("/")) {
    const [resolvedTool, resolvedProfile] = profile.split("/", 2);
    if (resolvedTool && resolvedProfile) {
      return { tool: resolvedTool, profile: resolvedProfile };
    }
  }
  return { tool, profile };
}

function filterBackups(
  backups: BackupEntry[],
  toolFilter: ToolFilter,
  search: string,
  settings: DesktopSettings,
  snapshot: AppSnapshot,
) {
  const normalizedQuery = search.trim().toLowerCase();

  return backups.filter((entry) => {
    const target = resolveBackupTarget(entry.tool, entry.profile);
    if (toolFilter !== "all" && target.tool !== toolFilter) {
      return false;
    }
    if (!normalizedQuery) {
      return true;
    }
    const profileLabel = toolProfileDisplayLabel(
      settings,
      snapshot,
      target.tool,
      target.profile,
    );
    return [
      entry.backup_id,
      toolDisplayName(target.tool),
      target.profile,
      profileLabel,
      backupReasonLabel(entry),
    ]
      .join(" ")
      .toLowerCase()
      .includes(normalizedQuery);
  });
}

function sortBackups(left: BackupEntry, right: BackupEntry, mode: DateFilter) {
  return mode === "newest"
    ? compareBackupsNewestFirst(left, right)
    : compareBackupsNewestFirst(right, left);
}

function backupReasonLabel(entry: BackupEntry) {
  const normalized = entry.backup_id.toLowerCase();
  if (normalized.includes("before-switch")) {
    return "Before profile switch";
  }
  if (normalized.includes("switch")) {
    return "Before profile switch";
  }
  if (normalized.includes("remove")) {
    return "Before removal";
  }
  if (normalized.includes("rename")) {
    return "Before rename";
  }
  return "Created restore point";
}

function backupContainsLabel(entry: BackupEntry) {
  const target = resolveBackupTarget(entry.tool, entry.profile);
  if (target.tool === "gemini") {
    return "Profile data snapshot";
  }
  return "Profile files and config snapshot";
}

function formatBackupInspectorTimestamp(value: string) {
  const date = backupDate(value);
  if (!date) {
    return "Date Unavailable";
  }
  return formatFriendlyInspectorDate(date);
}

function formatBackupListTimestamp(value: string) {
  const date = backupDate(value);
  if (!date) {
    return "Date Unavailable";
  }

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfEntry = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round(
    (startOfToday.getTime() - startOfEntry.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (diffDays === 0) {
    return `Today, ${new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
    }).format(date)}`;
  }

  if (diffDays === 1) {
    return `Yesterday, ${new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
    }).format(date)}`;
  }

  return `${new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: now.getFullYear() === date.getFullYear() ? undefined : "numeric",
  }).format(date)}`;
}

function backupDate(value: string) {
  const isoDate = Date.parse(value);
  if (!Number.isNaN(isoDate)) {
    return new Date(isoDate);
  }

  const compactMatch = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/);
  if (!compactMatch) {
    return null;
  }

  const [, year, month, day, hour, minute, second] = compactMatch;
  const date = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}Z`);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
}

function formatFriendlyInspectorDate(date: Date) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfEntry = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round(
    (startOfToday.getTime() - startOfEntry.getTime()) / (1000 * 60 * 60 * 24),
  );

  const timeLabel = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);

  if (diffDays === 0) {
    return `Today at ${timeLabel}`;
  }

  if (diffDays === 1) {
    return `Yesterday at ${timeLabel}`;
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function sortKey(entry: BackupLike) {
  return entry.created_at ?? entry.backup_id;
}
