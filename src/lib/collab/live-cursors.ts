/**
 * Kyro IDE - Live Cursors for Real-time Collaboration
 * Renders remote cursors and selections in Monaco Editor
 */

import * as Monaco from 'monaco-editor';
import { Collaborator, CursorPosition, SelectionRange } from './crdt-engine';

// ============================================================================
// TYPES
// ============================================================================

export interface CursorDecoration {
  collaborator: Collaborator;
  cursorDecoration: string[];
  selectionDecoration: string[];
}

// ============================================================================
// LIVE CURSORS MANAGER
// ============================================================================

export class LiveCursorsManager {
  private editor: Monaco.editor.IStandaloneCodeEditor;
  private decorations: Map<string, CursorDecoration> = new Map();
  private cursorUpdateTimeout: Map<string, NodeJS.Timeout> = new Map();
  private followUser: string | null = null;

  constructor(editor: Monaco.editor.IStandaloneCodeEditor) {
    this.editor = editor;
  }

  // Add or update cursor
  updateCursor(collaborator: Collaborator): void {
    if (!collaborator.cursor) return;

    const existing = this.decorations.get(collaborator.id);
    
    // Create cursor decoration
    const cursorDecorations = this.createCursorDecorations(collaborator);
    
    // Create selection decoration if exists
    const selectionDecorations = collaborator.selection
      ? this.createSelectionDecorations(collaborator)
      : [];

    // Apply decorations
    const allDecorations = [...cursorDecorations, ...selectionDecorations];
    
    const decorationIds = this.editor.deltaDecorations(
      existing?.cursorDecoration || [],
      allDecorations
    );

    this.decorations.set(collaborator.id, {
      collaborator,
      cursorDecoration: decorationIds,
      selectionDecoration: [],
    });

    // Clear after timeout if no updates
    this.setCursorTimeout(collaborator.id);

    // If following this user, scroll to cursor
    if (this.followUser === collaborator.id) {
      this.editor.revealPositionInCenter({
        lineNumber: collaborator.cursor.line,
        column: collaborator.cursor.column,
      });
    }
  }

  // Create cursor decorations
  private createCursorDecorations(collaborator: Collaborator): Monaco.editor.IModelDeltaDecoration[] {
    if (!collaborator.cursor) return [];

    const position = {
      lineNumber: collaborator.cursor.line,
      column: collaborator.cursor.column,
    };

    return [
      {
        range: new Monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column),
        options: {
          className: 'kyro-cursor',
          stickiness: Monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
          hoverMessage: { value: `**${collaborator.name}**` },
          beforeContentClassName: 'kyro-cursor-line',
          afterContentClassName: 'kyro-cursor-label',
        },
      },
    ];
  }

  // Create selection decorations
  private createSelectionDecorations(collaborator: Collaborator): Monaco.editor.IModelDeltaDecoration[] {
    if (!collaborator.selection) return [];

    const { start, end } = collaborator.selection;
    
    return [
      {
        range: new Monaco.Range(start.line, start.column, end.line, end.column),
        options: {
          className: 'kyro-selection',
          stickiness: Monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
          opacity: 0.3,
        },
      },
    ];
  }

  // Set timeout to fade cursor
  private setCursorTimeout(collaboratorId: string): void {
    const existing = this.cursorUpdateTimeout.get(collaboratorId);
    if (existing) {
      clearTimeout(existing);
    }

    const timeout = setTimeout(() => {
      // Fade the cursor after inactivity
      const decoration = this.decorations.get(collaboratorId);
      if (decoration) {
        // Could implement fade animation here
      }
    }, 5000);

    this.cursorUpdateTimeout.set(collaboratorId, timeout);
  }

  // Remove cursor
  removeCursor(collaboratorId: string): void {
    const decoration = this.decorations.get(collaboratorId);
    if (decoration) {
      this.editor.deltaDecorations(decoration.cursorDecoration, []);
      this.decorations.delete(collaboratorId);
    }

    const timeout = this.cursorUpdateTimeout.get(collaboratorId);
    if (timeout) {
      clearTimeout(timeout);
      this.cursorUpdateTimeout.delete(collaboratorId);
    }
  }

  // Follow a user's cursor
  follow(collaboratorId: string): void {
    this.followUser = collaboratorId;
    const decoration = this.decorations.get(collaboratorId);
    if (decoration?.collaborator.cursor) {
      this.editor.revealPositionInCenter({
        lineNumber: decoration.collaborator.cursor.line,
        column: decoration.collaborator.cursor.column,
      });
    }
  }

  // Stop following
  stopFollowing(): void {
    this.followUser = null;
  }

  // Get all visible cursors
  getVisibleCursors(): Collaborator[] {
    return Array.from(this.decorations.values()).map(d => d.collaborator);
  }

  // Dispose all
  dispose(): void {
    for (const [id] of this.decorations) {
      this.removeCursor(id);
    }
    this.decorations.clear();
    this.cursorUpdateTimeout.forEach(t => clearTimeout(t));
    this.cursorUpdateTimeout.clear();
  }
}

// ============================================================================
// CURSOR CSS INJECTOR
// ============================================================================

export function injectCursorStyles(): void {
  if (typeof document === 'undefined') return;
  
  const styleId = 'kyro-cursor-styles';
  if (document.getElementById(styleId)) return;

  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
    .kyro-cursor {
      border-left: 2px solid var(--cursor-color, #4ECDC4);
      animation: kyro-cursor-blink 1s infinite;
    }

    .kyro-cursor-line {
      background-color: var(--cursor-color, #4ECDC4);
      opacity: 0.3;
    }

    .kyro-selection {
      background-color: var(--selection-color, #4ECDC4) !important;
      opacity: 0.3;
    }

    .kyro-cursor-label::after {
      content: attr(data-name);
      position: absolute;
      top: -20px;
      left: 0;
      background-color: var(--cursor-color, #4ECDC4);
      color: white;
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 11px;
      white-space: nowrap;
      pointer-events: none;
    }

    @keyframes kyro-cursor-blink {
      0%, 50% { opacity: 1; }
      51%, 100% { opacity: 0; }
    }
  `;
  
  document.head.appendChild(style);
}
