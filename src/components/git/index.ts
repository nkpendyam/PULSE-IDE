// Git components for Kyro IDE
// Designed for future Tauri backend integration

export { default as DiffViewer } from './DiffViewer';
export { default as MergeConflicts } from './MergeConflicts';
export { default as BlameAnnotations } from './BlameAnnotations';
export { default as FileHistory } from './FileHistory';
export { default as GitPanel } from './GitPanel';

// Export types
export type {
  DiffLine,
  DiffHunk,
  DiffFile,
  DiffViewerProps
} from './DiffViewer';

export type {
  ConflictSection,
  ConflictFile,
  MergeConflictsProps
} from './MergeConflicts';

export type {
  BlameLine,
  BlameAuthor,
  BlameData,
  BlameAnnotationsProps
} from './BlameAnnotations';

export type {
  FileCommit,
  FileVersion,
  FileHistoryData,
  FileHistoryProps
} from './FileHistory';

export type {
  GitStatus,
  GitFile,
  GitCommit,
  GitBranchInfo,
  GitPanelProps
} from './GitPanel';
