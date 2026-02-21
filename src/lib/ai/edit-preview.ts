/**
 * Kyro IDE - Edit Preview
 * 
 * Shows diff preview before applying, highlights changed lines,
 * allows accepting/rejecting individual changes, and shows affected files.
 * 
 * Similar to how Continue.dev handles multi-file edit previews.
 */

import { DiffEngine, FileDiff, DiffLine, DiffHunk } from './diff-engine';
import { PendingEdit, EditBatch } from './edit-manager';
import { MultiFileEdit, FileEdit } from './multi-file-editor';

// ============================================================================
// TYPES
// ============================================================================

export interface PreviewLine {
  lineNumber: number;
  type: 'added' | 'removed' | 'unchanged' | 'context';
  oldContent: string;
  newContent: string;
  isSelected: boolean;
  isAcceptable: boolean;
  isRejectable: boolean;
  changeId: string;
  hunkId: string;
}

export interface PreviewHunk {
  id: string;
  header: string;
  startLine: number;
  endLine: number;
  lines: PreviewLine[];
  additions: number;
  deletions: number;
  isExpanded: boolean;
  isAccepted: boolean;
  isRejected: boolean;
}

export interface PreviewFile {
  id: string;
  path: string;
  status: 'added' | 'removed' | 'modified' | 'renamed' | 'unchanged';
  hunks: PreviewHunk[];
  totalAdditions: number;
  totalDeletions: number;
  isAccepted: boolean;
  isRejected: boolean;
  isExpanded: boolean;
  content: {
    old: string;
    new: string;
  };
}

export interface EditPreview {
  id: string;
  files: PreviewFile[];
  totalFiles: number;
  totalAdditions: number;
  totalDeletions: number;
  status: 'pending' | 'partial' | 'accepted' | 'rejected';
  canApply: boolean;
  timestamp: Date;
  description?: string;
}

export interface ChangeDecision {
  fileId: string;
  hunkId: string;
  changeId: string;
  action: 'accept' | 'reject';
}

export interface PreviewOptions {
  contextLines: number;
  showUnchanged: boolean;
  highlightSyntax: boolean;
  groupByFile: boolean;
}

export type PreviewEventType = 
  | 'preview-created'
  | 'change-accepted'
  | 'change-rejected'
  | 'hunk-accepted'
  | 'hunk-rejected'
  | 'file-accepted'
  | 'file-rejected'
  | 'preview-applied';

export interface PreviewEvent {
  type: PreviewEventType;
  payload: unknown;
  timestamp: Date;
}

type PreviewEventListener = (event: PreviewEvent) => void;

// ============================================================================
// EDIT PREVIEW CLASS
// ============================================================================

export class EditPreviewManager {
  private diffEngine: DiffEngine;
  private previews: Map<string, EditPreview> = new Map();
  private decisions: Map<string, ChangeDecision[]> = new Map();
  private listeners: Set<PreviewEventListener> = new Set();
  private options: PreviewOptions;

  constructor(options?: Partial<PreviewOptions>) {
    this.diffEngine = new DiffEngine();
    this.options = {
      contextLines: options?.contextLines ?? 3,
      showUnchanged: options?.showUnchanged ?? false,
      highlightSyntax: options?.highlightSyntax ?? true,
      groupByFile: options?.groupByFile ?? true
    };
  }

  // ============================================================================
  // PREVIEW CREATION
  // ============================================================================

  /**
   * Create preview from a pending edit
   */
  createPreviewFromEdit(edit: PendingEdit): EditPreview {
    const previewFile = this.createPreviewFile(edit.diff, edit.fileId, edit.filePath);
    
    const preview: EditPreview = {
      id: this.generateId(),
      files: [previewFile],
      totalFiles: 1,
      totalAdditions: previewFile.totalAdditions,
      totalDeletions: previewFile.totalDeletions,
      status: 'pending',
      canApply: true,
      timestamp: new Date(),
      description: edit.description
    };
    
    this.previews.set(preview.id, preview);
    this.decisions.set(preview.id, []);
    this.emit({ type: 'preview-created', payload: preview, timestamp: new Date() });
    
    return preview;
  }

  /**
   * Create preview from an edit batch
   */
  createPreviewFromBatch(batch: EditBatch): EditPreview {
    const files: PreviewFile[] = [];
    let totalAdditions = 0;
    let totalDeletions = 0;
    
    for (const edit of batch.edits) {
      const previewFile = this.createPreviewFile(edit.diff, edit.fileId, edit.filePath);
      files.push(previewFile);
      totalAdditions += previewFile.totalAdditions;
      totalDeletions += previewFile.totalDeletions;
    }
    
    const preview: EditPreview = {
      id: this.generateId(),
      files,
      totalFiles: files.length,
      totalAdditions,
      totalDeletions,
      status: 'pending',
      canApply: true,
      timestamp: new Date(),
      description: batch.description
    };
    
    this.previews.set(preview.id, preview);
    this.decisions.set(preview.id, []);
    this.emit({ type: 'preview-created', payload: preview, timestamp: new Date() });
    
    return preview;
  }

  /**
   * Create preview from multi-file edit
   */
  createPreviewFromMultiFileEdit(edit: MultiFileEdit): EditPreview {
    const files: PreviewFile[] = [];
    let totalAdditions = 0;
    let totalDeletions = 0;
    
    for (const fileEdit of edit.files.values()) {
      const previewFile = this.createPreviewFile(
        fileEdit.diff,
        fileEdit.fileId,
        fileEdit.filePath
      );
      files.push(previewFile);
      totalAdditions += previewFile.totalAdditions;
      totalDeletions += previewFile.totalDeletions;
    }
    
    const preview: EditPreview = {
      id: this.generateId(),
      files,
      totalFiles: files.length,
      totalAdditions,
      totalDeletions,
      status: 'pending',
      canApply: true,
      timestamp: new Date(),
      description: edit.description
    };
    
    this.previews.set(preview.id, preview);
    this.decisions.set(preview.id, []);
    this.emit({ type: 'preview-created', payload: preview, timestamp: new Date() });
    
    return preview;
  }

  /**
   * Create preview from file diffs
   */
  createPreviewFromDiffs(
    diffs: Array<{ diff: FileDiff; fileId: string; filePath: string }>,
    description?: string
  ): EditPreview {
    const files: PreviewFile[] = [];
    let totalAdditions = 0;
    let totalDeletions = 0;
    
    for (const { diff, fileId, filePath } of diffs) {
      const previewFile = this.createPreviewFile(diff, fileId, filePath);
      files.push(previewFile);
      totalAdditions += previewFile.totalAdditions;
      totalDeletions += previewFile.totalDeletions;
    }
    
    const preview: EditPreview = {
      id: this.generateId(),
      files,
      totalFiles: files.length,
      totalAdditions,
      totalDeletions,
      status: 'pending',
      canApply: true,
      timestamp: new Date(),
      description
    };
    
    this.previews.set(preview.id, preview);
    this.decisions.set(preview.id, []);
    this.emit({ type: 'preview-created', payload: preview, timestamp: new Date() });
    
    return preview;
  }

  // ============================================================================
  // DECISION MANAGEMENT
  // ============================================================================

  /**
   * Accept a specific change
   */
  acceptChange(previewId: string, fileId: string, hunkId: string, changeId: string): boolean {
    const preview = this.previews.get(previewId);
    if (!preview) return false;
    
    // Add decision
    const decisions = this.decisions.get(previewId) ?? [];
    decisions.push({ fileId, hunkId, changeId, action: 'accept' });
    this.decisions.set(previewId, decisions);
    
    // Update preview
    this.updatePreviewStatus(preview);
    
    this.emit({
      type: 'change-accepted',
      payload: { previewId, fileId, hunkId, changeId },
      timestamp: new Date()
    });
    
    return true;
  }

  /**
   * Reject a specific change
   */
  rejectChange(previewId: string, fileId: string, hunkId: string, changeId: string): boolean {
    const preview = this.previews.get(previewId);
    if (!preview) return false;
    
    // Add decision
    const decisions = this.decisions.get(previewId) ?? [];
    decisions.push({ fileId, hunkId, changeId, action: 'reject' });
    this.decisions.set(previewId, decisions);
    
    // Update preview
    this.updatePreviewStatus(preview);
    
    this.emit({
      type: 'change-rejected',
      payload: { previewId, fileId, hunkId, changeId },
      timestamp: new Date()
    });
    
    return true;
  }

  /**
   * Accept all changes in a hunk
   */
  acceptHunk(previewId: string, fileId: string, hunkId: string): boolean {
    const preview = this.previews.get(previewId);
    if (!preview) return false;
    
    const file = preview.files.find(f => f.id === fileId);
    if (!file) return false;
    
    const hunk = file.hunks.find(h => h.id === hunkId);
    if (!hunk) return false;
    
    hunk.isAccepted = true;
    hunk.isRejected = false;
    
    for (const line of hunk.lines) {
      if (line.type === 'added' || line.type === 'removed') {
        line.isSelected = true;
        this.acceptChange(previewId, fileId, hunkId, line.changeId);
      }
    }
    
    this.updatePreviewStatus(preview);
    
    this.emit({
      type: 'hunk-accepted',
      payload: { previewId, fileId, hunkId },
      timestamp: new Date()
    });
    
    return true;
  }

  /**
   * Reject all changes in a hunk
   */
  rejectHunk(previewId: string, fileId: string, hunkId: string): boolean {
    const preview = this.previews.get(previewId);
    if (!preview) return false;
    
    const file = preview.files.find(f => f.id === fileId);
    if (!file) return false;
    
    const hunk = file.hunks.find(h => h.id === hunkId);
    if (!hunk) return false;
    
    hunk.isAccepted = false;
    hunk.isRejected = true;
    
    for (const line of hunk.lines) {
      if (line.type === 'added' || line.type === 'removed') {
        line.isSelected = false;
        this.rejectChange(previewId, fileId, hunkId, line.changeId);
      }
    }
    
    this.updatePreviewStatus(preview);
    
    this.emit({
      type: 'hunk-rejected',
      payload: { previewId, fileId, hunkId },
      timestamp: new Date()
    });
    
    return true;
  }

  /**
   * Accept all changes in a file
   */
  acceptFile(previewId: string, fileId: string): boolean {
    const preview = this.previews.get(previewId);
    if (!preview) return false;
    
    const file = preview.files.find(f => f.id === fileId);
    if (!file) return false;
    
    file.isAccepted = true;
    file.isRejected = false;
    
    for (const hunk of file.hunks) {
      this.acceptHunk(previewId, fileId, hunk.id);
    }
    
    this.updatePreviewStatus(preview);
    
    this.emit({
      type: 'file-accepted',
      payload: { previewId, fileId },
      timestamp: new Date()
    });
    
    return true;
  }

  /**
   * Reject all changes in a file
   */
  rejectFile(previewId: string, fileId: string): boolean {
    const preview = this.previews.get(previewId);
    if (!preview) return false;
    
    const file = preview.files.find(f => f.id === fileId);
    if (!file) return false;
    
    file.isAccepted = false;
    file.isRejected = true;
    
    for (const hunk of file.hunks) {
      this.rejectHunk(previewId, fileId, hunk.id);
    }
    
    this.updatePreviewStatus(preview);
    
    this.emit({
      type: 'file-rejected',
      payload: { previewId, fileId },
      timestamp: new Date()
    });
    
    return true;
  }

  /**
   * Accept all changes
   */
  acceptAll(previewId: string): boolean {
    const preview = this.previews.get(previewId);
    if (!preview) return false;
    
    for (const file of preview.files) {
      this.acceptFile(previewId, file.id);
    }
    
    return true;
  }

  /**
   * Reject all changes
   */
  rejectAll(previewId: string): boolean {
    const preview = this.previews.get(previewId);
    if (!preview) return false;
    
    for (const file of preview.files) {
      this.rejectFile(previewId, file.id);
    }
    
    return true;
  }

  // ============================================================================
  // PREVIEW RETRIEVAL
  // ============================================================================

  /**
   * Get preview by ID
   */
  getPreview(previewId: string): EditPreview | undefined {
    return this.previews.get(previewId);
  }

  /**
   * Get decisions for a preview
   */
  getDecisions(previewId: string): ChangeDecision[] {
    return this.decisions.get(previewId) ?? [];
  }

  /**
   * Get resulting content after applying decisions
   */
  getResultingContent(previewId: string, fileId: string): string | undefined {
    const preview = this.previews.get(previewId);
    if (!preview) return undefined;
    
    const file = preview.files.find(f => f.id === fileId);
    if (!file) return undefined;
    
    const decisions = this.getDecisions(previewId);
    const fileDecisions = decisions.filter(d => d.fileId === fileId);
    
    // Start with original content
    let content = file.content.old;
    
    // Apply accepted changes
    for (const hunk of file.hunks) {
      const hunkDecisions = fileDecisions.filter(d => d.hunkId === hunk.id);
      const acceptedChanges = hunkDecisions.filter(d => d.action === 'accept');
      
      if (acceptedChanges.length > 0) {
        // Apply the changes for this hunk
        content = this.applyHunkDecisions(content, hunk, hunkDecisions);
      }
    }
    
    return content;
  }

  /**
   * Get all accepted changes
   */
  getAcceptedChanges(previewId: string): ChangeDecision[] {
    const decisions = this.decisions.get(previewId) ?? [];
    return decisions.filter(d => d.action === 'accept');
  }

  /**
   * Get all rejected changes
   */
  getRejectedChanges(previewId: string): ChangeDecision[] {
    const decisions = this.decisions.get(previewId) ?? [];
    return decisions.filter(d => d.action === 'reject');
  }

  // ============================================================================
  // EVENT HANDLING
  // ============================================================================

  /**
   * Subscribe to preview events
   */
  subscribe(listener: PreviewEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  private createPreviewFile(diff: FileDiff, fileId: string, filePath: string): PreviewFile {
    const hunks: PreviewHunk[] = [];
    let totalAdditions = 0;
    let totalDeletions = 0;
    
    for (let i = 0; i < diff.hunks.length; i++) {
      const hunk = diff.hunks[i];
      const previewHunk = this.createPreviewHunk(hunk, i);
      hunks.push(previewHunk);
      totalAdditions += previewHunk.additions;
      totalDeletions += previewHunk.deletions;
    }
    
    return {
      id: fileId,
      path: filePath,
      status: diff.status,
      hunks,
      totalAdditions,
      totalDeletions,
      isAccepted: false,
      isRejected: false,
      isExpanded: true,
      content: {
        old: diff.oldContent,
        new: diff.newContent
      }
    };
  }

  private createPreviewHunk(hunk: DiffHunk, index: number): PreviewHunk {
    const lines: PreviewLine[] = [];
    let additions = 0;
    let deletions = 0;
    
    let changeCounter = 0;
    
    for (const line of hunk.lines) {
      const isChange = line.type === 'added' || line.type === 'removed';
      
      if (isChange) {
        if (line.type === 'added') additions++;
        if (line.type === 'removed') deletions++;
        changeCounter++;
      }
      
      lines.push({
        lineNumber: line.oldLineNumber ?? line.newLineNumber ?? 0,
        type: line.type as 'added' | 'removed' | 'unchanged',
        oldContent: line.type === 'removed' || line.type === 'unchanged' ? line.content : '',
        newContent: line.type === 'added' || line.type === 'unchanged' ? line.content : '',
        isSelected: isChange, // Default to selected
        isAcceptable: isChange,
        isRejectable: isChange,
        changeId: isChange ? `change-${index}-${changeCounter}` : '',
        hunkId: `hunk-${index}`
      });
    }
    
    return {
      id: `hunk-${index}`,
      header: hunk.header,
      startLine: hunk.oldStart,
      endLine: hunk.oldStart + hunk.oldLines,
      lines,
      additions,
      deletions,
      isExpanded: true,
      isAccepted: false,
      isRejected: false
    };
  }

  private updatePreviewStatus(preview: EditPreview): void {
    const decisions = this.decisions.get(preview.id) ?? [];
    
    let allAccepted = true;
    let allRejected = true;
    let anyDecided = false;
    
    for (const file of preview.files) {
      for (const hunk of file.hunks) {
        for (const line of hunk.lines) {
          if (!line.isAcceptable) continue;
          
          const decision = decisions.find(
            d => d.fileId === file.id && d.hunkId === hunk.id && d.changeId === line.changeId
          );
          
          if (decision) {
            anyDecided = true;
            if (decision.action !== 'accept') allAccepted = false;
            if (decision.action !== 'reject') allRejected = false;
          } else {
            allAccepted = false;
            allRejected = false;
          }
        }
      }
    }
    
    if (!anyDecided) {
      preview.status = 'pending';
    } else if (allAccepted) {
      preview.status = 'accepted';
    } else if (allRejected) {
      preview.status = 'rejected';
    } else {
      preview.status = 'partial';
    }
    
    preview.canApply = decisions.some(d => d.action === 'accept');
  }

  private applyHunkDecisions(
    content: string,
    hunk: PreviewHunk,
    decisions: ChangeDecision[]
  ): string {
    const lines = content.split('\n');
    const acceptedIds = new Set(
      decisions.filter(d => d.action === 'accept').map(d => d.changeId)
    );
    
    let lineOffset = 0;
    
    for (const line of hunk.lines) {
      if (line.type === 'removed') {
        if (acceptedIds.has(line.changeId)) {
          // Remove this line
          const index = hunk.startLine + lineOffset - 1;
          if (index >= 0 && index < lines.length) {
            lines.splice(index, 1);
            lineOffset--;
          }
        } else {
          lineOffset++;
        }
      } else if (line.type === 'added') {
        if (acceptedIds.has(line.changeId)) {
          // Add this line
          const index = hunk.startLine + lineOffset - 1;
          if (index >= 0) {
            lines.splice(index, 0, line.newContent);
            lineOffset++;
          }
        }
      } else {
        lineOffset++;
      }
    }
    
    return lines.join('\n');
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  private emit(event: PreviewEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (error) {
        console.error('Preview event listener error:', error);
      }
    }
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Create an edit preview manager instance
 */
export function createEditPreviewManager(options?: Partial<PreviewOptions>): EditPreviewManager {
  return new EditPreviewManager(options);
}

// Export singleton
export const editPreviewManager = new EditPreviewManager();
