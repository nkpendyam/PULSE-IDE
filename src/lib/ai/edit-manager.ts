/**
 * Kyro IDE - Edit Manager
 * 
 * Manages AI-generated edits across multiple files with atomic operations,
 * undo/redo support, and conflict detection with user changes.
 * 
 * Inspired by Continue.dev's approach to multi-file edits with Monaco's edit operations API.
 */

import { DiffEngine, FileDiff, EditOperation, ConflictInfo, PatchResult } from './diff-engine';

// ============================================================================
// TYPES
// ============================================================================

export type EditStatus = 'pending' | 'applied' | 'rejected' | 'conflict' | 'rolled-back';

export interface PendingEdit {
  id: string;
  fileId: string;
  filePath: string;
  operation: EditOperation;
  diff: FileDiff;
  status: EditStatus;
  timestamp: Date;
  source: 'ai' | 'user';
  agentId?: string;
  description?: string;
  conflicts?: ConflictInfo[];
}

export interface EditBatch {
  id: string;
  edits: PendingEdit[];
  status: 'pending' | 'applying' | 'applied' | 'partial' | 'failed' | 'rolled-back';
  timestamp: Date;
  description?: string;
  atomic: boolean;
}

export interface FileSnapshot {
  content: string;
  version: number;
  timestamp: Date;
  editId?: string;
}

export interface UndoStackEntry {
  id: string;
  type: 'batch' | 'single';
  edits: PendingEdit[];
  snapshots: Map<string, FileSnapshot>;
  timestamp: Date;
  description?: string;
}

export interface EditManagerConfig {
  maxUndoHistory: number;
  autoConflictDetection: boolean;
  atomicOperations: boolean;
}

export interface ConflictResolution {
  editId: string;
  action: 'accept' | 'reject' | 'merge';
  mergedContent?: string;
}

export interface EditEvent {
  type: 'edit-pending' | 'edit-applied' | 'edit-rejected' | 'batch-started' | 'batch-completed' | 'conflict-detected' | 'undo' | 'redo';
  payload: unknown;
  timestamp: Date;
}

type EditEventListener = (event: EditEvent) => void;

// ============================================================================
// EDIT MANAGER CLASS
// ============================================================================

export class EditManager {
  private diffEngine: DiffEngine;
  private pendingEdits: Map<string, PendingEdit> = new Map();
  private editBatches: Map<string, EditBatch> = new Map();
  private undoStack: UndoStackEntry[] = [];
  private redoStack: UndoStackEntry[] = [];
  private fileSnapshots: Map<string, FileSnapshot[]> = new Map();
  private currentFileVersions: Map<string, number> = new Map();
  private listeners: Set<EditEventListener> = new Set();
  private config: EditManagerConfig;

  constructor(config?: Partial<EditManagerConfig>) {
    this.diffEngine = new DiffEngine();
    this.config = {
      maxUndoHistory: config?.maxUndoHistory ?? 50,
      autoConflictDetection: config?.autoConflictDetection ?? true,
      atomicOperations: config?.atomicOperations ?? true
    };
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  /**
   * Register a file with the edit manager
   */
  registerFile(fileId: string, content: string): void {
    this.currentFileVersions.set(fileId, 1);
    this.fileSnapshots.set(fileId, [{
      content,
      version: 1,
      timestamp: new Date()
    }]);
  }

  /**
   * Update file content (from user edit)
   */
  updateFileContent(fileId: string, content: string): void {
    const currentVersion = this.currentFileVersions.get(fileId) ?? 0;
    const newVersion = currentVersion + 1;
    this.currentFileVersions.set(fileId, newVersion);
    
    const snapshots = this.fileSnapshots.get(fileId) ?? [];
    snapshots.push({
      content,
      version: newVersion,
      timestamp: new Date()
    });
    
    // Keep only last 10 snapshots per file
    if (snapshots.length > 10) {
      snapshots.shift();
    }
    
    this.fileSnapshots.set(fileId, snapshots);
    
    // Check for conflicts with pending edits
    if (this.config.autoConflictDetection) {
      this.detectUserConflicts(fileId, content);
    }
  }

  /**
   * Create a pending edit from AI suggestion
   */
  createPendingEdit(
    fileId: string,
    filePath: string,
    oldContent: string,
    newContent: string,
    options?: {
      agentId?: string;
      description?: string;
      source?: 'ai' | 'user';
    }
  ): PendingEdit {
    const diff = this.diffEngine.generateDiff(oldContent, newContent, filePath);
    const operations = this.diffEngine.createEditOperations(diff);
    
    const edit: PendingEdit = {
      id: this.generateId(),
      fileId,
      filePath,
      operation: operations[0] ?? {
        startLine: 1,
        endLine: oldContent.split('\n').length,
        oldContent,
        newContent
      },
      diff,
      status: 'pending',
      timestamp: new Date(),
      source: options?.source ?? 'ai',
      agentId: options?.agentId,
      description: options?.description
    };
    
    this.pendingEdits.set(edit.id, edit);
    this.emit({ type: 'edit-pending', payload: edit, timestamp: new Date() });
    
    return edit;
  }

  /**
   * Create a batch of edits for atomic application
   */
  createEditBatch(
    edits: Array<{
      fileId: string;
      filePath: string;
      oldContent: string;
      newContent: string;
      description?: string;
    }>,
    options?: {
      description?: string;
      atomic?: boolean;
    }
  ): EditBatch {
    const pendingEdits: PendingEdit[] = edits.map(edit => 
      this.createPendingEdit(edit.fileId, edit.filePath, edit.oldContent, edit.newContent, {
        description: edit.description
      })
    );
    
    const batch: EditBatch = {
      id: this.generateId(),
      edits: pendingEdits,
      status: 'pending',
      timestamp: new Date(),
      description: options?.description,
      atomic: options?.atomic ?? this.config.atomicOperations
    };
    
    this.editBatches.set(batch.id, batch);
    
    return batch;
  }

  /**
   * Apply a single pending edit
   */
  applyEdit(editId: string, currentContent: string): PatchResult {
    const edit = this.pendingEdits.get(editId);
    if (!edit) {
      return {
        success: false,
        appliedLines: 0,
        rejectedLines: 0,
        conflicts: [{
          lineNumber: 0,
          oldContent: '',
          newContent: '',
          existingContent: '',
          type: 'range-invalid'
        }]
      };
    }
    
    // Create snapshot for undo
    this.createSnapshot([edit]);
    
    // Apply the patch
    const result = this.diffEngine.applyPatch(currentContent, edit.diff);
    
    if (result.success) {
      edit.status = 'applied';
      this.emit({ type: 'edit-applied', payload: edit, timestamp: new Date() });
    } else {
      edit.status = 'conflict';
      edit.conflicts = result.conflicts;
      this.emit({ type: 'conflict-detected', payload: { edit, conflicts: result.conflicts }, timestamp: new Date() });
    }
    
    return result;
  }

  /**
   * Apply a batch of edits atomically
   */
  applyBatch(batchId: string, getfileContent: (fileId: string) => string): Map<string, PatchResult> {
    const batch = this.editBatches.get(batchId);
    if (!batch) {
      return new Map();
    }
    
    batch.status = 'applying';
    this.emit({ type: 'batch-started', payload: batch, timestamp: new Date() });
    
    const results = new Map<string, PatchResult>();
    const appliedEdits: PendingEdit[] = [];
    const failedEdits: PendingEdit[] = [];
    
    // Create snapshots for all files in batch
    this.createSnapshot(batch.edits);
    
    // Apply each edit
    for (const edit of batch.edits) {
      const content = getfileContent(edit.fileId);
      const result = this.applyEdit(edit.id, content);
      results.set(edit.fileId, result);
      
      if (result.success) {
        appliedEdits.push(edit);
      } else {
        failedEdits.push(edit);
        if (batch.atomic) {
          // Rollback all applied edits
          this.rollbackEdits(appliedEdits);
          batch.status = 'failed';
          this.emit({ type: 'batch-completed', payload: batch, timestamp: new Date() });
          return results;
        }
      }
    }
    
    // Determine final batch status
    if (failedEdits.length === 0) {
      batch.status = 'applied';
    } else if (appliedEdits.length > 0) {
      batch.status = 'partial';
    } else {
      batch.status = 'failed';
    }
    
    this.emit({ type: 'batch-completed', payload: batch, timestamp: new Date() });
    return results;
  }

  /**
   * Reject a pending edit
   */
  rejectEdit(editId: string): boolean {
    const edit = this.pendingEdits.get(editId);
    if (!edit) return false;
    
    edit.status = 'rejected';
    this.emit({ type: 'edit-rejected', payload: edit, timestamp: new Date() });
    return true;
  }

  /**
   * Resolve a conflict
   */
  resolveConflict(resolution: ConflictResolution, currentContent: string): PatchResult {
    const edit = this.pendingEdits.get(resolution.editId);
    if (!edit || edit.status !== 'conflict') {
      return {
        success: false,
        appliedLines: 0,
        rejectedLines: 0,
        conflicts: []
      };
    }
    
    if (resolution.action === 'reject') {
      edit.status = 'rejected';
      return { success: true, appliedLines: 0, rejectedLines: 0, conflicts: [], result: currentContent };
    }
    
    if (resolution.action === 'merge' && resolution.mergedContent) {
      // Create new diff with merged content
      const mergedDiff = this.diffEngine.generateDiff(currentContent, resolution.mergedContent, edit.filePath);
      const result = this.diffEngine.applyPatch(currentContent, mergedDiff);
      
      if (result.success) {
        edit.status = 'applied';
        edit.diff = mergedDiff;
      }
      
      return result;
    }
    
    // Accept - try to apply anyway
    const result = this.diffEngine.applyPatch(currentContent, edit.diff, { partial: true });
    
    if (result.success || result.result) {
      edit.status = 'applied';
    }
    
    return result;
  }

  /**
   * Undo last edit or batch
   */
  undo(): UndoStackEntry | null {
    if (this.undoStack.length === 0) return null;
    
    const entry = this.undoStack.pop()!;
    
    // Restore snapshots
    for (const [fileId, snapshot] of entry.snapshots) {
      const edit = entry.edits.find(e => e.fileId === fileId);
      if (edit) {
        edit.status = 'rolled-back';
      }
    }
    
    // Add to redo stack
    this.redoStack.push(entry);
    
    // Limit redo stack size
    if (this.redoStack.length > this.config.maxUndoHistory) {
      this.redoStack.shift();
    }
    
    this.emit({ type: 'undo', payload: entry, timestamp: new Date() });
    return entry;
  }

  /**
   * Redo last undone edit or batch
   */
  redo(): UndoStackEntry | null {
    if (this.redoStack.length === 0) return null;
    
    const entry = this.redoStack.pop()!;
    
    // Mark edits as applied again
    for (const edit of entry.edits) {
      edit.status = 'applied';
    }
    
    // Add back to undo stack
    this.undoStack.push(entry);
    
    this.emit({ type: 'redo', payload: entry, timestamp: new Date() });
    return entry;
  }

  /**
   * Get all pending edits for a file
   */
  getPendingEditsForFile(fileId: string): PendingEdit[] {
    return Array.from(this.pendingEdits.values())
      .filter(e => e.fileId === fileId && e.status === 'pending');
  }

  /**
   * Get all pending edits
   */
  getAllPendingEdits(): PendingEdit[] {
    return Array.from(this.pendingEdits.values())
      .filter(e => e.status === 'pending');
  }

  /**
   * Get edit by ID
   */
  getEdit(editId: string): PendingEdit | undefined {
    return this.pendingEdits.get(editId);
  }

  /**
   * Get batch by ID
   */
  getBatch(batchId: string): EditBatch | undefined {
    return this.editBatches.get(batchId);
  }

  /**
   * Check if there are pending edits
   */
  hasPendingEdits(): boolean {
    return this.pendingEdits.size > 0 && 
           Array.from(this.pendingEdits.values()).some(e => e.status === 'pending');
  }

  /**
   * Check if undo is available
   */
  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  /**
   * Check if redo is available
   */
  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /**
   * Get undo history
   */
  getUndoHistory(): UndoStackEntry[] {
    return [...this.undoStack];
  }

  /**
   * Subscribe to edit events
   */
  subscribe(listener: EditEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Clear all pending edits
   */
  clearPendingEdits(): void {
    for (const edit of this.pendingEdits.values()) {
      if (edit.status === 'pending') {
        edit.status = 'rejected';
      }
    }
  }

  /**
   * Get file snapshot
   */
  getFileSnapshot(fileId: string, version?: number): FileSnapshot | undefined {
    const snapshots = this.fileSnapshots.get(fileId);
    if (!snapshots) return undefined;
    
    if (version) {
      return snapshots.find(s => s.version === version);
    }
    
    return snapshots[snapshots.length - 1];
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  private createSnapshot(edits: PendingEdit[]): void {
    const snapshots = new Map<string, FileSnapshot>();
    
    for (const edit of edits) {
      const snapshot = this.getFileSnapshot(edit.fileId);
      if (snapshot) {
        snapshots.set(edit.fileId, { ...snapshot, editId: edit.id });
      }
    }
    
    const entry: UndoStackEntry = {
      id: this.generateId(),
      type: edits.length > 1 ? 'batch' : 'single',
      edits: [...edits],
      snapshots,
      timestamp: new Date(),
      description: edits.length > 1 ? `Batch of ${edits.length} edits` : edits[0]?.description
    };
    
    this.undoStack.push(entry);
    
    // Limit undo stack size
    if (this.undoStack.length > this.config.maxUndoHistory) {
      this.undoStack.shift();
    }
    
    // Clear redo stack on new action
    this.redoStack = [];
  }

  private rollbackEdits(edits: PendingEdit[]): void {
    for (const edit of edits) {
      edit.status = 'rolled-back';
    }
  }

  private detectUserConflicts(fileId: string, newContent: string): void {
    const pendingEdits = this.getPendingEditsForFile(fileId);
    
    for (const edit of pendingEdits) {
      // Check if the user's changes overlap with pending edit
      const snapshot = this.getFileSnapshot(fileId);
      if (!snapshot) continue;
      
      // Generate diff between snapshot and new content
      const userDiff = this.diffEngine.generateDiff(snapshot.content, newContent, edit.filePath);
      
      // Check for overlapping line ranges
      for (const userHunk of userDiff.hunks) {
        for (const pendingHunk of edit.diff.hunks) {
          if (this.rangesOverlap(
            userHunk.oldStart, userHunk.oldStart + userHunk.oldLines,
            pendingHunk.oldStart, pendingHunk.oldStart + pendingHunk.oldLines
          )) {
            edit.status = 'conflict';
            edit.conflicts = edit.conflicts ?? [];
            edit.conflicts.push({
              lineNumber: userHunk.oldStart,
              oldContent: '',
              newContent: '',
              existingContent: newContent.split('\n')[userHunk.oldStart - 1] ?? '',
              type: 'already-modified'
            });
            
            this.emit({ 
              type: 'conflict-detected', 
              payload: { edit, reason: 'user-modified' }, 
              timestamp: new Date() 
            });
          }
        }
      }
    }
  }

  private rangesOverlap(start1: number, end1: number, start2: number, end2: number): boolean {
    return start1 < end2 && start2 < end1;
  }

  private emit(event: EditEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (error) {
        console.error('Edit event listener error:', error);
      }
    }
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Create an edit manager instance
 */
export function createEditManager(config?: Partial<EditManagerConfig>): EditManager {
  return new EditManager(config);
}

// Export singleton
export const editManager = new EditManager();
