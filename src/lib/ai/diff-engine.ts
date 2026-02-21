/**
 * Kyro IDE - Diff Engine
 * 
 * A powerful diff generation and patch application engine for multi-file AI editing.
 * Generates unified diffs, applies patches, handles conflicts gracefully,
 * and supports partial applies.
 * 
 * Similar to how Continue.dev handles multi-file edits with Monaco's edit operations API.
 */

// ============================================================================
// TYPES
// ============================================================================

export interface DiffLine {
  oldLineNumber: number | null;
  newLineNumber: number | null;
  type: 'added' | 'removed' | 'unchanged';
  content: string;
}

export interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  header: string;
  lines: DiffLine[];
}

export interface FileDiff {
  oldPath: string;
  newPath: string;
  oldContent: string;
  newContent: string;
  hunks: DiffHunk[];
  status: 'added' | 'removed' | 'modified' | 'renamed' | 'unchanged';
}

export interface PatchResult {
  success: boolean;
  appliedLines: number;
  rejectedLines: number;
  conflicts: ConflictInfo[];
  result?: string;
}

export interface ConflictInfo {
  lineNumber: number;
  oldContent: string;
  newContent: string;
  existingContent: string;
  type: 'content-mismatch' | 'already-modified' | 'range-invalid';
}

export interface EditOperation {
  startLine: number;
  endLine: number;
  startColumn?: number;
  endColumn?: number;
  oldContent: string;
  newContent: string;
}

export interface LineRange {
  start: number;
  end: number;
}

// ============================================================================
// DIFF ENGINE CLASS
// ============================================================================

export class DiffEngine {
  /**
   * Generate a unified diff between old and new content
   */
  generateDiff(oldContent: string, newContent: string, oldPath: string, newPath?: string): FileDiff {
    const oldLines = oldContent.split('\n');
    const newLines = newContent.split('\n');
    
    // Check if file is new or deleted
    if (!oldContent && newContent) {
      return {
        oldPath,
        newPath: newPath || oldPath,
        oldContent,
        newContent,
        hunks: [this.createHunk(0, 0, 1, newLines.length, newLines.map((line, i) => ({
          oldLineNumber: null,
          newLineNumber: i + 1,
          type: 'added' as const,
          content: line
        })))],
        status: 'added'
      };
    }
    
    if (oldContent && !newContent) {
      return {
        oldPath,
        newPath: newPath || oldPath,
        oldContent,
        newContent,
        hunks: [this.createHunk(1, oldLines.length, 0, 0, oldLines.map((line, i) => ({
          oldLineNumber: i + 1,
          newLineNumber: null,
          type: 'removed' as const,
          content: line
        })))],
        status: 'removed'
      };
    }
    
    // Compute LCS-based diff
    const diff = this.computeLCSDiff(oldLines, newLines);
    const hunks = this.groupIntoHunks(diff, oldLines, newLines);
    
    // Determine status
    let status: FileDiff['status'] = 'unchanged';
    const hasChanges = hunks.some(h => h.lines.some(l => l.type !== 'unchanged'));
    if (hasChanges) {
      status = oldPath !== (newPath || oldPath) ? 'renamed' : 'modified';
    }
    
    return {
      oldPath,
      newPath: newPath || oldPath,
      oldContent,
      newContent,
      hunks,
      status
    };
  }

  /**
   * Generate unified diff format string
   */
  generateUnifiedDiff(fileDiff: FileDiff): string {
    const lines: string[] = [];
    
    // Header
    lines.push(`--- a/${fileDiff.oldPath}`);
    lines.push(`+++ b/${fileDiff.newPath}`);
    
    // Hunks
    for (const hunk of fileDiff.hunks) {
      lines.push(hunk.header);
      for (const line of hunk.lines) {
        const prefix = line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' ';
        lines.push(`${prefix}${line.content}`);
      }
    }
    
    return lines.join('\n');
  }

  /**
   * Apply a patch to content
   */
  applyPatch(content: string, fileDiff: FileDiff, options?: { partial?: boolean }): PatchResult {
    const result: PatchResult = {
      success: true,
      appliedLines: 0,
      rejectedLines: 0,
      conflicts: []
    };
    
    if (fileDiff.status === 'added') {
      result.result = fileDiff.newContent;
      result.appliedLines = fileDiff.newContent.split('\n').length;
      return result;
    }
    
    if (fileDiff.status === 'removed') {
      result.result = '';
      result.appliedLines = fileDiff.oldContent.split('\n').length;
      return result;
    }
    
    // Apply hunks in reverse order to maintain line numbers
    const sortedHunks = [...fileDiff.hunks].sort((a, b) => b.oldStart - a.oldStart);
    let currentContent = content;
    
    for (const hunk of sortedHunks) {
      const lines = currentContent.split('\n');
      const hunkResult = this.applyHunkToLines(lines, hunk);
      
      if (hunkResult.success) {
        currentContent = hunkResult.lines.join('\n');
        result.appliedLines += hunkResult.appliedLines;
      } else {
        result.conflicts.push(...hunkResult.conflicts);
        result.rejectedLines += hunk.lines.filter(l => l.type !== 'unchanged').length;
        
        if (!options?.partial) {
          result.success = false;
          return result;
        }
      }
    }
    
    result.result = currentContent;
    return result;
  }

  /**
   * Apply individual edit operation
   */
  applyEditOperation(content: string, operation: EditOperation): { success: boolean; result?: string; error?: string } {
    const lines = content.split('\n');
    
    // Validate line range
    if (operation.startLine < 1 || operation.endLine > lines.length + 1) {
      return { success: false, error: 'Invalid line range' };
    }
    
    // Check old content match
    const oldLines = lines.slice(operation.startLine - 1, operation.endLine);
    const expectedOldLines = operation.oldContent.split('\n');
    
    // Allow for partial match (trailing newline differences)
    const oldContentMatch = this.contentMatches(oldLines.join('\n'), operation.oldContent);
    
    if (!oldContentMatch) {
      return { 
        success: false, 
        error: `Content mismatch at lines ${operation.startLine}-${operation.endLine}` 
      };
    }
    
    // Apply the edit
    const newLines = operation.newContent.split('\n');
    lines.splice(operation.startLine - 1, operation.endLine - operation.startLine + 1, ...newLines);
    
    return { success: true, result: lines.join('\n') };
  }

  /**
   * Create edit operations from diff
   */
  createEditOperations(fileDiff: FileDiff): EditOperation[] {
    const operations: EditOperation[] = [];
    
    for (const hunk of fileDiff.hunks) {
      let currentOldLine = hunk.oldStart;
      const removedLines: string[] = [];
      const addedLines: string[] = [];
      let removeStart = currentOldLine;
      
      for (const line of hunk.lines) {
        if (line.type === 'removed') {
          if (addedLines.length > 0) {
            // Flush pending add operation
            operations.push({
              startLine: removeStart,
              endLine: removeStart - 1,
              oldContent: '',
              newContent: addedLines.join('\n')
            });
            addedLines.length = 0;
          }
          removedLines.push(line.content);
          currentOldLine++;
        } else if (line.type === 'added') {
          if (removedLines.length > 0) {
            // Flush pending remove/add operation
            operations.push({
              startLine: removeStart,
              endLine: removeStart + removedLines.length - 1,
              oldContent: removedLines.join('\n'),
              newContent: addedLines.join('\n')
            });
            removedLines.length = 0;
            addedLines.length = 0;
            removeStart = currentOldLine;
          }
          addedLines.push(line.content);
        } else {
          // Unchanged line - flush any pending operations
          if (removedLines.length > 0 || addedLines.length > 0) {
            operations.push({
              startLine: removeStart,
              endLine: removeStart + removedLines.length - 1,
              oldContent: removedLines.join('\n'),
              newContent: addedLines.join('\n')
            });
            removedLines.length = 0;
            addedLines.length = 0;
          }
          removeStart = currentOldLine + 1;
          currentOldLine++;
        }
      }
      
      // Flush any remaining operations
      if (removedLines.length > 0 || addedLines.length > 0) {
        operations.push({
          startLine: removeStart,
          endLine: removeStart + removedLines.length - 1,
          oldContent: removedLines.join('\n'),
          newContent: addedLines.join('\n')
        });
      }
    }
    
    return operations;
  }

  /**
   * Detect conflicts between diffs
   */
  detectConflicts(diffs: FileDiff[]): Map<string, ConflictInfo[]> {
    const conflicts = new Map<string, ConflictInfo[]>();
    
    // Group diffs by file
    const fileDiffs = new Map<string, FileDiff[]>();
    for (const diff of diffs) {
      const path = diff.newPath;
      if (!fileDiffs.has(path)) {
        fileDiffs.set(path, []);
      }
      fileDiffs.get(path)!.push(diff);
    }
    
    // Check for overlapping edits
    for (const [path, fileDiffList] of fileDiffs) {
      if (fileDiffList.length <= 1) continue;
      
      const ranges: { start: number; end: number; diffIndex: number }[] = [];
      
      for (let i = 0; i < fileDiffList.length; i++) {
        const diff = fileDiffList[i];
        for (const hunk of diff.hunks) {
          ranges.push({
            start: hunk.oldStart,
            end: hunk.oldStart + hunk.oldLines,
            diffIndex: i
          });
        }
      }
      
      // Sort by start position
      ranges.sort((a, b) => a.start - b.start);
      
      // Check for overlaps
      const fileConflicts: ConflictInfo[] = [];
      for (let i = 0; i < ranges.length - 1; i++) {
        if (ranges[i].end > ranges[i + 1].start) {
          fileConflicts.push({
            lineNumber: ranges[i + 1].start,
            oldContent: '',
            newContent: '',
            existingContent: '',
            type: 'already-modified'
          });
        }
      }
      
      if (fileConflicts.length > 0) {
        conflicts.set(path, fileConflicts);
      }
    }
    
    return conflicts;
  }

  /**
   * Merge multiple diffs for the same file
   */
  mergeDiffs(diffs: FileDiff[]): FileDiff | null {
    if (diffs.length === 0) return null;
    if (diffs.length === 1) return diffs[0];
    
    // Sort by old start position
    const allHunks = diffs.flatMap(d => d.hunks);
    allHunks.sort((a, b) => a.oldStart - b.oldStart);
    
    // Check for conflicts
    for (let i = 0; i < allHunks.length - 1; i++) {
      const current = allHunks[i];
      const next = allHunks[i + 1];
      
      if (current.oldStart + current.oldLines > next.oldStart) {
        // Conflict detected - cannot merge
        return null;
      }
    }
    
    // Merge hunks
    return {
      oldPath: diffs[0].oldPath,
      newPath: diffs[0].newPath,
      oldContent: diffs[0].oldContent,
      newContent: diffs.map(d => d.newContent).join('\n'),
      hunks: allHunks,
      status: 'modified'
    };
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  private computeLCSDiff(oldLines: string[], newLines: string[]): Array<{ 
    type: 'added' | 'removed' | 'unchanged'; 
    oldIndex?: number; 
    newIndex?: number;
    content: string;
  }> {
    // Build LCS matrix
    const lcs: number[][] = [];
    for (let i = 0; i <= oldLines.length; i++) {
      lcs[i] = [];
      for (let j = 0; j <= newLines.length; j++) {
        if (i === 0 || j === 0) {
          lcs[i][j] = 0;
        } else if (oldLines[i - 1] === newLines[j - 1]) {
          lcs[i][j] = lcs[i - 1][j - 1] + 1;
        } else {
          lcs[i][j] = Math.max(lcs[i - 1][j], lcs[i][j - 1]);
        }
      }
    }
    
    // Backtrack to generate diff
    const diff: Array<{ 
      type: 'added' | 'removed' | 'unchanged'; 
      oldIndex?: number; 
      newIndex?: number;
      content: string;
    }> = [];
    
    let i = oldLines.length;
    let j = newLines.length;
    
    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
        diff.unshift({
          type: 'unchanged',
          oldIndex: i - 1,
          newIndex: j - 1,
          content: oldLines[i - 1]
        });
        i--;
        j--;
      } else if (j > 0 && (i === 0 || lcs[i][j - 1] >= lcs[i - 1][j])) {
        diff.unshift({
          type: 'added',
          newIndex: j - 1,
          content: newLines[j - 1]
        });
        j--;
      } else if (i > 0) {
        diff.unshift({
          type: 'removed',
          oldIndex: i - 1,
          content: oldLines[i - 1]
        });
        i--;
      }
    }
    
    return diff;
  }

  private groupIntoHunks(
    diff: Array<{ type: 'added' | 'removed' | 'unchanged'; oldIndex?: number; newIndex?: number; content: string }>,
    oldLines: string[],
    newLines: string[]
  ): DiffHunk[] {
    const hunks: DiffHunk[] = [];
    const contextLines = 3;
    
    // Find positions of changes
    const changePositions = diff
      .map((d, i) => d.type !== 'unchanged' ? i : -1)
      .filter(i => i >= 0);
    
    if (changePositions.length === 0) {
      return [];
    }
    
    // Group changes into hunks
    let hunkStart = Math.max(0, changePositions[0] - contextLines);
    let hunkEnd = Math.min(diff.length - 1, changePositions[changePositions.length - 1] + contextLines);
    
    let oldLineNum = 1;
    let newLineNum = 1;
    let hunkOldStart = 0;
    let hunkNewStart = 0;
    
    let currentHunk: DiffHunk | null = null;
    
    for (let i = 0; i < diff.length; i++) {
      const item = diff[i];
      
      if (i === hunkStart) {
        hunkOldStart = oldLineNum;
        hunkNewStart = newLineNum;
      }
      
      if (i >= hunkStart && i <= hunkEnd) {
        if (!currentHunk) {
          currentHunk = {
            oldStart: hunkOldStart,
            oldLines: 0,
            newStart: hunkNewStart,
            newLines: 0,
            header: '',
            lines: []
          };
        }
        
        const line: DiffLine = {
          oldLineNumber: item.type === 'removed' || item.type === 'unchanged' ? oldLineNum : null,
          newLineNumber: item.type === 'added' || item.type === 'unchanged' ? newLineNum : null,
          type: item.type,
          content: item.content
        };
        
        currentHunk.lines.push(line);
        
        if (item.type === 'removed') {
          currentHunk.oldLines++;
          oldLineNum++;
        } else if (item.type === 'added') {
          currentHunk.newLines++;
          newLineNum++;
        } else {
          currentHunk.oldLines++;
          currentHunk.newLines++;
          oldLineNum++;
          newLineNum++;
        }
      } else {
        if (item.type === 'removed') {
          oldLineNum++;
        } else if (item.type === 'added') {
          newLineNum++;
        } else {
          oldLineNum++;
          newLineNum++;
        }
      }
    }
    
    if (currentHunk) {
      currentHunk.header = this.createHunkHeader(
        currentHunk.oldStart,
        currentHunk.oldLines,
        currentHunk.newStart,
        currentHunk.newLines
      );
      hunks.push(currentHunk);
    }
    
    return hunks;
  }

  private createHunk(oldStart: number, oldLines: number, newStart: number, newLines: number, lines: DiffLine[]): DiffHunk {
    return {
      oldStart,
      oldLines,
      newStart,
      newLines,
      header: this.createHunkHeader(oldStart, oldLines, newStart, newLines),
      lines
    };
  }

  private createHunkHeader(oldStart: number, oldLines: number, newStart: number, newLines: number): string {
    const oldPart = oldLines > 0 ? `${oldStart},${oldLines}` : `${oldStart}`;
    const newPart = newLines > 0 ? `${newStart},${newLines}` : `${newStart}`;
    return `@@ -${oldPart} +${newPart} @@`;
  }

  private applyHunkToLines(
    lines: string[],
    hunk: DiffHunk
  ): { success: boolean; lines: string[]; appliedLines: number; conflicts: ConflictInfo[] } {
    const conflicts: ConflictInfo[] = [];
    let appliedLines = 0;
    
    // Apply changes
    let currentOldLine = hunk.oldStart - 1;
    const newLines: string[] = [];
    
    for (const line of hunk.lines) {
      if (line.type === 'removed') {
        if (lines[currentOldLine] !== line.content) {
          conflicts.push({
            lineNumber: currentOldLine + 1,
            oldContent: line.content,
            newContent: '',
            existingContent: lines[currentOldLine] || '',
            type: 'content-mismatch'
          });
        }
        currentOldLine++;
        appliedLines++;
      } else if (line.type === 'added') {
        newLines.push(line.content);
        appliedLines++;
      } else {
        // Unchanged - copy from original
        if (currentOldLine < lines.length) {
          newLines.push(lines[currentOldLine]);
        }
        currentOldLine++;
      }
    }
    
    // Replace the hunk range with new lines
    const result = [...lines];
    result.splice(hunk.oldStart - 1, hunk.oldLines, ...newLines);
    
    return {
      success: conflicts.length === 0,
      lines: result,
      appliedLines,
      conflicts
    };
  }

  private contentMatches(actual: string, expected: string): boolean {
    // Normalize line endings and trailing whitespace
    const normalize = (s: string) => s.replace(/\r\n/g, '\n').trim();
    return normalize(actual) === normalize(expected);
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Create a diff engine instance
 */
export function createDiffEngine(): DiffEngine {
  return new DiffEngine();
}

/**
 * Quick diff between two strings
 */
export function quickDiff(oldContent: string, newContent: string, path: string): FileDiff {
  const engine = new DiffEngine();
  return engine.generateDiff(oldContent, newContent, path);
}

/**
 * Quick patch application
 */
export function quickPatch(content: string, fileDiff: FileDiff): PatchResult {
  const engine = new DiffEngine();
  return engine.applyPatch(content, fileDiff);
}

// Export singleton
export const diffEngine = new DiffEngine();
