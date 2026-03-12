'use client';

/**
 * Edit Prediction Provider
 * 
 * Extends ghost text to predict the user's NEXT likely edit location
 * and content. Uses recent edit history to anticipate what comes next.
 * Think: "Tab Tab Tab" to apply a series of predicted edits.
 */

import { useCallback, useRef, useEffect, useState } from 'react';
import type * as monaco from 'monaco-editor';

export interface EditPrediction {
  id: string;
  range: { startLine: number; startColumn: number; endLine: number; endColumn: number };
  newText: string;
  confidence: number;
  type: 'insert' | 'replace' | 'delete';
  reason: string;
}

interface EditHistoryEntry {
  timestamp: number;
  file: string;
  range: { startLine: number; startColumn: number; endLine: number; endColumn: number };
  oldText: string;
  newText: string;
}

/**
 * Analyze recent edits and predict the next likely edit.
 * Uses pattern matching on recent edit history.
 */
function predictFromHistory(
  history: EditHistoryEntry[],
  currentFile: string,
  currentContent: string
): EditPrediction | null {
  if (history.length < 2) return null;

  // Get recent edits in current file
  const fileEdits = history.filter(h => h.file === currentFile).slice(-10);
  if (fileEdits.length < 2) return null;

  // Pattern: repeated similar edits (e.g., renaming across a file)
  const lastTwo = fileEdits.slice(-2);
  const [prev, last] = lastTwo;

  // Check if both edits are replacements of the same text
  if (prev.oldText === last.oldText && prev.newText === last.newText) {
    // Search for next occurrence
    const lines = currentContent.split('\n');
    const searchFrom = last.range.endLine;
    
    for (let i = searchFrom; i < lines.length; i++) {
      const col = lines[i].indexOf(prev.oldText);
      if (col !== -1) {
        return {
          id: `pred-${Date.now()}`,
          range: {
            startLine: i + 1,
            startColumn: col + 1,
            endLine: i + 1,
            endColumn: col + 1 + prev.oldText.length,
          },
          newText: prev.newText,
          confidence: 0.85,
          type: 'replace',
          reason: `Rename "${prev.oldText}" → "${prev.newText}" (pattern detected)`,
        };
      }
    }
  }

  // Pattern: sequential insertions (e.g., adding imports one by one)
  if (prev.newText.length > 0 && last.newText.length > 0 &&
      prev.range.startLine + 1 === last.range.startLine) {
    // They edited consecutive lines — predict next line will get similar edit
    return {
      id: `pred-${Date.now()}`,
      range: {
        startLine: last.range.endLine + 1,
        startColumn: last.range.startColumn,
        endLine: last.range.endLine + 1,
        endColumn: last.range.startColumn,
      },
      newText: last.newText,
      confidence: 0.6,
      type: 'insert',
      reason: 'Sequential insertion pattern',
    };
  }

  return null;
}

export function useEditPrediction(
  editor: monaco.editor.IStandaloneCodeEditor | null,
  monacoInstance: typeof import('monaco-editor') | null,
  currentFile: string,
  enabled: boolean = true
) {
  const [prediction, setPrediction] = useState<EditPrediction | null>(null);
  const [showPrediction, setShowPrediction] = useState(false);
  const historyRef = useRef<EditHistoryEntry[]>([]);
  const decorationsRef = useRef<string[]>([]);

  // Track edits
  useEffect(() => {
    if (!editor || !enabled) return;

    const disposable = editor.onDidChangeModelContent((e) => {
      for (const change of e.changes) {
        historyRef.current.push({
          timestamp: Date.now(),
          file: currentFile,
          range: {
            startLine: change.range.startLineNumber,
            startColumn: change.range.startColumn,
            endLine: change.range.endLineNumber,
            endColumn: change.range.endColumn,
          },
          oldText: change.text ? '' : '', // Monaco doesn't give us old text easily
          newText: change.text,
        });

        // Keep last 50 edits
        if (historyRef.current.length > 50) {
          historyRef.current = historyRef.current.slice(-50);
        }
      }

      // After each edit, try to predict next one
      const model = editor.getModel();
      if (!model) return;
      
      const pred = predictFromHistory(
        historyRef.current,
        currentFile,
        model.getValue()
      );
      
      setPrediction(pred);
      setShowPrediction(!!pred);
    });

    return () => disposable.dispose();
  }, [editor, currentFile, enabled]);

  // Show prediction decoration in editor
  useEffect(() => {
    if (!editor || !monacoInstance || !prediction || !showPrediction) {
      // Clear decorations
      if (editor) {
        editor.deltaDecorations(decorationsRef.current, []);
        decorationsRef.current = [];
      }
      return;
    }

    const { range, newText, confidence } = prediction;

    // Add a subtle highlight at the predicted edit location
    const newDecorations = editor.deltaDecorations(decorationsRef.current, [
      {
        range: new monacoInstance.Range(
          range.startLine,
          range.startColumn,
          range.endLine,
          range.endColumn
        ),
        options: {
          className: confidence > 0.7 ? 'edit-prediction-high' : 'edit-prediction-low',
          glyphMarginClassName: 'edit-prediction-glyph',
          hoverMessage: {
            value: `**Edit Prediction** (${Math.round(confidence * 100)}%)\n\nPress **Tab** to accept: \`${newText}\`\n\n_${prediction.reason}_`
          },
          after: {
            content: ` → ${newText.length > 20 ? newText.slice(0, 20) + '...' : newText}`,
            inlineClassName: 'edit-prediction-ghost',
          },
        },
      },
    ]);

    decorationsRef.current = newDecorations;
  }, [editor, monacoInstance, prediction, showPrediction]);

  // Accept prediction with Tab
  const acceptPrediction = useCallback(() => {
    if (!editor || !monacoInstance || !prediction) return false;
    
    const model = editor.getModel();
    if (!model) return false;

    const { range, newText } = prediction;

    // Apply the edit
    model.pushEditOperations(
      [],
      [{
        range: new monacoInstance.Range(
          range.startLine,
          range.startColumn,
          range.endLine,
          range.endColumn
        ),
        text: newText,
      }],
      () => null
    );

    // Move cursor to end of edit
    const endPos = model.getPositionAt(
      model.getOffsetAt(new monacoInstance.Position(range.startLine, range.startColumn)) + newText.length
    );
    editor.setPosition(endPos);

    // Clear prediction and decorations
    setPrediction(null);
    setShowPrediction(false);
    editor.deltaDecorations(decorationsRef.current, []);
    decorationsRef.current = [];

    return true;
  }, [editor, monacoInstance, prediction]);

  // Dismiss prediction with Escape
  const dismissPrediction = useCallback(() => {
    setPrediction(null);
    setShowPrediction(false);
    if (editor) {
      editor.deltaDecorations(decorationsRef.current, []);
      decorationsRef.current = [];
    }
  }, [editor]);

  return {
    prediction,
    showPrediction,
    acceptPrediction,
    dismissPrediction,
  };
}
