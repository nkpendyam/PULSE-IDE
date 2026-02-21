/**
 * Kyro IDE - Multi-File Editor
 * 
 * Coordinates edits across multiple files, maintains file relationships,
 * updates imports/references when renaming, and tracks edit history.
 * 
 * Similar to how Continue.dev handles multi-file edits with Monaco's edit operations API.
 */

import { DiffEngine, FileDiff, EditOperation, DiffHunk } from './diff-engine';
import { EditManager, PendingEdit, EditBatch } from './edit-manager';

// ============================================================================
// TYPES
// ============================================================================

export interface FileInfo {
  id: string;
  path: string;
  content: string;
  language: string;
  version: number;
  isDirty: boolean;
  lastModified: Date;
}

export interface FileRelationship {
  sourceId: string;
  targetId: string;
  type: 'import' | 'export' | 'reference' | 'extend' | 'implement';
  sourceLine?: number;
  targetSymbol?: string;
}

export interface MultiFileEdit {
  id: string;
  files: Map<string, FileEdit>;
  relationships: FileRelationship[];
  timestamp: Date;
  description?: string;
  status: 'pending' | 'applying' | 'applied' | 'partial' | 'failed';
}

export interface FileEdit {
  fileId: string;
  filePath: string;
  oldContent: string;
  newContent: string;
  diff: FileDiff;
  operations: EditOperation[];
  status: 'pending' | 'applied' | 'failed' | 'skipped';
  error?: string;
}

export interface RenameOperation {
  oldName: string;
  newName: string;
  type: 'file' | 'symbol' | 'variable' | 'function' | 'class' | 'interface';
  affectedFiles: string[];
}

export interface ImportUpdate {
  filePath: string;
  oldImport: string;
  newImport: string;
  line: number;
}

export interface ReferenceUpdate {
  filePath: string;
  oldReference: string;
  newReference: string;
  line: number;
  column: number;
}

export interface EditContext {
  workspaceRoot: string;
  openFiles: Map<string, FileInfo>;
  relationships: FileRelationship[];
}

export interface MultiFileEditResult {
  success: boolean;
  appliedFiles: string[];
  failedFiles: string[];
  skippedFiles: string[];
  errors: Map<string, string>;
  updatedImports: ImportUpdate[];
  updatedReferences: ReferenceUpdate[];
}

// ============================================================================
// MULTI-FILE EDITOR CLASS
// ============================================================================

export class MultiFileEditor {
  private diffEngine: DiffEngine;
  private editManager: EditManager;
  private files: Map<string, FileInfo> = new Map();
  private relationships: FileRelationship[] = [];
  private editHistory: MultiFileEdit[] = [];
  private maxHistorySize: number;

  constructor(options?: { maxHistorySize?: number }) {
    this.diffEngine = new DiffEngine();
    this.editManager = new EditManager();
    this.maxHistorySize = options?.maxHistorySize ?? 100;
  }

  // ============================================================================
  // FILE MANAGEMENT
  // ============================================================================

  /**
   * Register a file with the editor
   */
  registerFile(file: FileInfo): void {
    this.files.set(file.id, file);
    this.editManager.registerFile(file.id, file.content);
  }

  /**
   * Update file content
   */
  updateFileContent(fileId: string, content: string): void {
    const file = this.files.get(fileId);
    if (!file) return;
    
    file.content = content;
    file.version++;
    file.isDirty = true;
    file.lastModified = new Date();
    
    this.editManager.updateFileContent(fileId, content);
  }

  /**
   * Get file info
   */
  getFile(fileId: string): FileInfo | undefined {
    return this.files.get(fileId);
  }

  /**
   * Get all registered files
   */
  getAllFiles(): FileInfo[] {
    return Array.from(this.files.values());
  }

  /**
   * Add a relationship between files
   */
  addRelationship(relationship: FileRelationship): void {
    this.relationships.push(relationship);
  }

  /**
   * Get relationships for a file
   */
  getRelationships(fileId: string): FileRelationship[] {
    return this.relationships.filter(
      r => r.sourceId === fileId || r.targetId === fileId
    );
  }

  // ============================================================================
  // MULTI-FILE EDIT OPERATIONS
  // ============================================================================

  /**
   * Create a multi-file edit from a set of file changes
   */
  createMultiFileEdit(
    changes: Array<{
      fileId: string;
      newContent: string;
      description?: string;
    }>,
    options?: {
      description?: string;
      updateImports?: boolean;
    }
  ): MultiFileEdit {
    const fileEdits = new Map<string, FileEdit>();
    const affectedRelationships: FileRelationship[] = [];
    
    for (const change of changes) {
      const file = this.files.get(change.fileId);
      if (!file) continue;
      
      const diff = this.diffEngine.generateDiff(file.content, change.newContent, file.path);
      const operations = this.diffEngine.createEditOperations(diff);
      
      fileEdits.set(change.fileId, {
        fileId: change.fileId,
        filePath: file.path,
        oldContent: file.content,
        newContent: change.newContent,
        diff,
        operations,
        status: 'pending'
      });
      
      // Find affected relationships
      const rels = this.getRelationships(change.fileId);
      affectedRelationships.push(...rels);
    }
    
    const multiEdit: MultiFileEdit = {
      id: this.generateId(),
      files: fileEdits,
      relationships: affectedRelationships,
      timestamp: new Date(),
      description: options?.description,
      status: 'pending'
    };
    
    this.editHistory.push(multiEdit);
    this.limitHistory();
    
    return multiEdit;
  }

  /**
   * Apply a multi-file edit
   */
  applyMultiFileEdit(
    editId: string,
    applyContent: (fileId: string, content: string) => boolean
  ): MultiFileEditResult {
    const edit = this.editHistory.find(e => e.id === editId);
    if (!edit) {
      return {
        success: false,
        appliedFiles: [],
        failedFiles: [],
        skippedFiles: [],
        errors: new Map([['global', 'Edit not found']]),
        updatedImports: [],
        updatedReferences: []
      };
    }
    
    edit.status = 'applying';
    
    const result: MultiFileEditResult = {
      success: true,
      appliedFiles: [],
      failedFiles: [],
      skippedFiles: [],
      errors: new Map(),
      updatedImports: [],
      updatedReferences: []
    };
    
    // Apply edits in dependency order
    const orderedEdits = this.orderEditsByDependency(edit.files);
    
    for (const fileEdit of orderedEdits) {
      try {
        const success = applyContent(fileEdit.fileId, fileEdit.newContent);
        
        if (success) {
          fileEdit.status = 'applied';
          result.appliedFiles.push(fileEdit.fileId);
          
          // Update internal state
          this.updateFileContent(fileEdit.fileId, fileEdit.newContent);
        } else {
          fileEdit.status = 'failed';
          fileEdit.error = 'Apply failed';
          result.failedFiles.push(fileEdit.fileId);
          result.errors.set(fileEdit.fileId, 'Apply failed');
          result.success = false;
        }
      } catch (error) {
        fileEdit.status = 'failed';
        fileEdit.error = error instanceof Error ? error.message : 'Unknown error';
        result.failedFiles.push(fileEdit.fileId);
        result.errors.set(fileEdit.fileId, fileEdit.error);
        result.success = false;
      }
    }
    
    // Update status
    if (result.failedFiles.length === 0) {
      edit.status = 'applied';
    } else if (result.appliedFiles.length > 0) {
      edit.status = 'partial';
    } else {
      edit.status = 'failed';
    }
    
    return result;
  }

  /**
   * Rename a symbol across multiple files
   */
  renameSymbol(
    symbolName: string,
    newName: string,
    options?: {
      type?: RenameOperation['type'];
      scope?: 'file' | 'workspace';
    }
  ): MultiFileEdit {
    const changes: Array<{ fileId: string; newContent: string }> = [];
    
    // Find all references to the symbol
    for (const file of this.files.values()) {
      const updated = this.renameInFile(file.content, symbolName, newName, file.language);
      
      if (updated !== file.content) {
        changes.push({
          fileId: file.id,
          newContent: updated
        });
      }
    }
    
    return this.createMultiFileEdit(changes, {
      description: `Rename ${symbolName} to ${newName}`,
      updateImports: true
    });
  }

  /**
   * Update imports when a file is renamed or moved
   */
  updateImportsForRename(
    oldPath: string,
    newPath: string
  ): ImportUpdate[] {
    const updates: ImportUpdate[] = [];
    
    for (const file of this.files.values()) {
      const importUpdates = this.findImportUpdates(file.content, oldPath, newPath, file.path);
      updates.push(...importUpdates);
    }
    
    return updates;
  }

  /**
   * Create edits for import updates
   */
  createImportUpdateEdits(updates: ImportUpdate[]): MultiFileEdit {
    const changes: Array<{ fileId: string; newContent: string }> = [];
    const groupedUpdates = new Map<string, ImportUpdate[]>();
    
    // Group updates by file
    for (const update of updates) {
      const file = Array.from(this.files.values()).find(f => f.path === update.filePath);
      if (!file) continue;
      
      if (!groupedUpdates.has(file.id)) {
        groupedUpdates.set(file.id, []);
      }
      groupedUpdates.get(file.id)!.push(update);
    }
    
    // Apply updates to each file
    for (const [fileId, fileUpdates] of groupedUpdates) {
      const file = this.files.get(fileId);
      if (!file) continue;
      
      let content = file.content;
      for (const update of fileUpdates) {
        content = this.replaceImport(content, update.oldImport, update.newImport);
      }
      
      changes.push({ fileId, newContent: content });
    }
    
    return this.createMultiFileEdit(changes, {
      description: 'Update imports'
    });
  }

  /**
   * Get edit history
   */
  getEditHistory(): MultiFileEdit[] {
    return [...this.editHistory];
  }

  /**
   * Get pending edits
   */
  getPendingEdits(): MultiFileEdit[] {
    return this.editHistory.filter(e => e.status === 'pending');
  }

  // ============================================================================
  // ATOMIC OPERATIONS
  // ============================================================================

  /**
   * Apply edits atomically (all or nothing)
   */
  async applyAtomic(
    edits: Array<{ fileId: string; newContent: string }>,
    applyContent: (fileId: string, content: string) => Promise<boolean>
  ): Promise<MultiFileEditResult> {
    const multiEdit = this.createMultiFileEdit(edits.map(e => ({
      fileId: e.fileId,
      newContent: e.newContent
    })), { description: 'Atomic operation' });
    
    // Create backup of all affected files
    const backups = new Map<string, string>();
    for (const edit of multiEdit.files.values()) {
      backups.set(edit.fileId, edit.oldContent);
    }
    
    // Apply all edits
    const results: MultiFileEditResult = {
      success: true,
      appliedFiles: [],
      failedFiles: [],
      skippedFiles: [],
      errors: new Map(),
      updatedImports: [],
      updatedReferences: []
    };
    
    for (const edit of multiEdit.files.values()) {
      try {
        const success = await applyContent(edit.fileId, edit.newContent);
        if (success) {
          edit.status = 'applied';
          results.appliedFiles.push(edit.fileId);
        } else {
          throw new Error('Apply failed');
        }
      } catch (error) {
        edit.status = 'failed';
        edit.error = error instanceof Error ? error.message : 'Unknown error';
        results.failedFiles.push(edit.fileId);
        results.errors.set(edit.fileId, edit.error);
        
        // Rollback all changes
        for (const [fileId, backup] of backups) {
          await applyContent(fileId, backup);
        }
        
        results.appliedFiles = [];
        results.success = false;
        multiEdit.status = 'failed';
        
        return results;
      }
    }
    
    multiEdit.status = 'applied';
    return results;
  }

  // ============================================================================
  // CONFLICT DETECTION
  // ============================================================================

  /**
   * Detect conflicts between multiple edits
   */
  detectEditConflicts(edits: MultiFileEdit[]): Map<string, string[]> {
    const conflicts = new Map<string, string[]>();
    
    // Group edits by file
    const editsByFile = new Map<string, MultiFileEdit[]>();
    
    for (const edit of edits) {
      for (const fileEdit of edit.files.values()) {
        if (!editsByFile.has(fileEdit.fileId)) {
          editsByFile.set(fileEdit.fileId, []);
        }
        editsByFile.get(fileEdit.fileId)!.push(edit);
      }
    }
    
    // Check for overlapping line ranges
    for (const [fileId, fileEdits] of editsByFile) {
      if (fileEdits.length <= 1) continue;
      
      const ranges: Array<{ start: number; end: number; editId: string }> = [];
      
      for (const edit of fileEdits) {
        const fileEdit = edit.files.get(fileId);
        if (!fileEdit) continue;
        
        for (const hunk of fileEdit.diff.hunks) {
          ranges.push({
            start: hunk.oldStart,
            end: hunk.oldStart + hunk.oldLines,
            editId: edit.id
          });
        }
      }
      
      // Check for overlaps
      const fileConflicts: string[] = [];
      for (let i = 0; i < ranges.length; i++) {
        for (let j = i + 1; j < ranges.length; j++) {
          if (this.rangesOverlap(ranges[i], ranges[j])) {
            fileConflicts.push(`Edit ${ranges[i].editId} conflicts with ${ranges[j].editId}`);
          }
        }
      }
      
      if (fileConflicts.length > 0) {
        conflicts.set(fileId, fileConflicts);
      }
    }
    
    return conflicts;
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  private limitHistory(): void {
    if (this.editHistory.length > this.maxHistorySize) {
      this.editHistory.shift();
    }
  }

  private orderEditsByDependency(edits: Map<string, FileEdit>): FileEdit[] {
    // Simple ordering: process files that are imported before files that import them
    const ordered: FileEdit[] = [];
    const processed = new Set<string>();
    
    // Build dependency graph
    const dependencies = new Map<string, Set<string>>();
    for (const edit of edits.values()) {
      const deps = new Set<string>();
      for (const rel of this.relationships) {
        if (rel.targetId === edit.fileId && rel.type === 'import') {
          deps.add(rel.sourceId);
        }
      }
      dependencies.set(edit.fileId, deps);
    }
    
    // Topological sort
    const visit = (fileId: string) => {
      if (processed.has(fileId)) return;
      processed.add(fileId);
      
      const deps = dependencies.get(fileId);
      if (deps) {
        for (const dep of deps) {
          visit(dep);
        }
      }
      
      const edit = edits.get(fileId);
      if (edit) {
        ordered.push(edit);
      }
    };
    
    for (const fileId of edits.keys()) {
      visit(fileId);
    }
    
    return ordered;
  }

  private renameInFile(content: string, oldName: string, newName: string, language: string): string {
    // Simple string-based rename with word boundary awareness
    const lines = content.split('\n');
    
    return lines.map((line, index) => {
      // Skip import/export lines for symbol renames
      if (line.trim().startsWith('import ') || line.trim().startsWith('export ')) {
        return line;
      }
      
      // Replace whole word matches
      const regex = new RegExp(`\\b${this.escapeRegex(oldName)}\\b`, 'g');
      return line.replace(regex, newName);
    }).join('\n');
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private findImportUpdates(
    content: string,
    oldPath: string,
    newPath: string,
    currentFilePath: string
  ): ImportUpdate[] {
    const updates: ImportUpdate[] = [];
    const lines = content.split('\n');
    
    const oldImportPath = this.getRelativeImportPath(currentFilePath, oldPath);
    const newImportPath = this.getRelativeImportPath(currentFilePath, newPath);
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes(oldImportPath)) {
        updates.push({
          filePath: currentFilePath,
          oldImport: oldImportPath,
          newImport: newImportPath,
          line: i + 1
        });
      }
    }
    
    return updates;
  }

  private getRelativeImportPath(fromPath: string, toPath: string): string {
    // Simplified - would need proper path resolution
    const fromDir = fromPath.substring(0, fromPath.lastIndexOf('/'));
    if (toPath.startsWith(fromDir)) {
      return './' + toPath.substring(fromDir.length + 1);
    }
    return toPath;
  }

  private replaceImport(content: string, oldImport: string, newImport: string): string {
    return content.replace(oldImport, newImport);
  }

  private rangesOverlap(
    a: { start: number; end: number },
    b: { start: number; end: number }
  ): boolean {
    return a.start < b.end && b.start < a.end;
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Create a multi-file editor instance
 */
export function createMultiFileEditor(options?: { maxHistorySize?: number }): MultiFileEditor {
  return new MultiFileEditor(options);
}

// Export singleton
export const multiFileEditor = new MultiFileEditor();
