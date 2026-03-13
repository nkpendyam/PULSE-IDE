import { describe, expect, it } from 'vitest';
import { filterAndSortRemoteFiles, parseRemoteErrorClass } from '../../../src/components/remote/remoteFileListUtils';

describe('remoteFileListUtils', () => {
  const base = [
    { name: 'src', path: 'src', isDirectory: true },
    { name: 'README.md', path: 'README.md', isDirectory: false, size: 12 },
    { name: 'z.bin', path: 'z.bin', isDirectory: false, size: 1024 },
  ];

  it('filters entries by query', () => {
    const result = filterAndSortRemoteFiles(base, 'read', 'name', 'asc');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('README.md');
  });

  it('sorts entries by size descending', () => {
    const result = filterAndSortRemoteFiles(base, '', 'size', 'desc');
    expect(result[0].name).toBe('z.bin');
  });

  it('parses classified error prefix', () => {
    expect(parseRemoteErrorClass('[permission_denied] Access is denied')).toBe('permission_denied');
    expect(parseRemoteErrorClass('plain error')).toBeNull();
  });
});
