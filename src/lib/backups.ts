export type BackupLike = {
  backup_id: string;
  created_at?: string | null;
};

export function compareBackupsNewestFirst(left: BackupLike, right: BackupLike) {
  const leftSortKey = backupSortKey(left.created_at ?? left.backup_id);
  const rightSortKey = backupSortKey(right.created_at ?? right.backup_id);
  return rightSortKey.localeCompare(leftSortKey);
}

function backupSortKey(value: string) {
  const isoDate = Date.parse(value);
  if (!Number.isNaN(isoDate)) {
    return new Date(isoDate).toISOString();
  }
  return value;
}
