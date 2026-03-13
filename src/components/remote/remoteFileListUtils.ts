export interface RemoteFileListEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size?: number;
}

export type RemoteSortField = 'name' | 'size' | 'type';
export type RemoteSortDirection = 'asc' | 'desc';

export function filterAndSortRemoteFiles(
  entries: RemoteFileListEntry[],
  query: string,
  sortField: RemoteSortField,
  sortDirection: RemoteSortDirection
): RemoteFileListEntry[] {
  const lowered = query.trim().toLowerCase();
  const filtered = lowered
    ? entries.filter((entry) => (
      entry.name.toLowerCase().includes(lowered)
      || entry.path.toLowerCase().includes(lowered)
    ))
    : [...entries];

  filtered.sort((left, right) => {
    let result = 0;
    if (sortField === 'name') {
      result = left.name.localeCompare(right.name);
    } else if (sortField === 'size') {
      const leftSize = typeof left.size === 'number' ? left.size : -1;
      const rightSize = typeof right.size === 'number' ? right.size : -1;
      result = leftSize - rightSize;
    } else {
      const leftType = left.isDirectory ? 'directory' : 'file';
      const rightType = right.isDirectory ? 'directory' : 'file';
      result = leftType.localeCompare(rightType);
      if (result === 0) {
        result = left.name.localeCompare(right.name);
      }
    }

    return sortDirection === 'asc' ? result : -result;
  });

  return filtered;
}

export function parseRemoteErrorClass(errorMessage: string): string | null {
  const match = errorMessage.match(/^\[([a-z_]+)\]\s*/i);
  return match?.[1] ?? null;
}
