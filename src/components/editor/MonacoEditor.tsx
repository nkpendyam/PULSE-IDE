// Kyro IDE - Monaco Editor Component
'use client';

import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import Editor, { OnMount, BeforeMount, OnChange } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { useSettingsStore } from '@/lib/stores/settings';
import { cn } from '@/lib/utils';

// ============================================================================
// TYPES
// ============================================================================

export interface MonacoEditorProps {
  value?: string;
  language?: string;
  path?: string;
  onChange?: (value: string) => void;
  onSave?: (value: string) => void;
  onCursorChange?: (position: { line: number; column: number }) => void;
  className?: string;
  readOnly?: boolean;
  minimap?: boolean;
  lineNumbers?: 'on' | 'off' | 'relative';
  wordWrap?: 'on' | 'off' | 'bounded';
  fontSize?: number;
  theme?: 'vs-dark' | 'vs-light' | 'hc-black';
  options?: editor.IStandaloneEditorConstructionOptions;
  onMount?: (ed: editor.IStandaloneCodeEditor) => void;
}

// ============================================================================
// LANGUAGE MAPPING
// ============================================================================

const extensionToLanguage: Record<string, string> = {
  'js': 'javascript', 'jsx': 'javascript', 'ts': 'typescript', 'tsx': 'typescript',
  'html': 'html', 'css': 'css', 'scss': 'scss', 'less': 'less',
  'json': 'json', 'yaml': 'yaml', 'yml': 'yaml', 'xml': 'xml',
  'py': 'python', 'rb': 'ruby', 'go': 'go', 'rs': 'rust',
  'java': 'java', 'kt': 'kotlin', 'swift': 'swift',
  'c': 'c', 'cpp': 'cpp', 'h': 'c', 'hpp': 'cpp',
  'cs': 'csharp', 'php': 'php', 'sh': 'shell', 'bash': 'shell',
  'md': 'markdown', 'sql': 'sql', 'vue': 'vue',
};

function getLanguageFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  return extensionToLanguage[ext] || 'plaintext';
}

// ============================================================================
// MONACO EDITOR COMPONENT
// ============================================================================

export function MonacoEditor({
  value = '',
  language,
  path,
  onChange,
  onSave,
  onCursorChange,
  className,
  readOnly = false,
  minimap,
  lineNumbers,
  wordWrap,
  fontSize,
  theme = 'vs-dark',
  options = {},
  onMount,
}: MonacoEditorProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof import('monaco-editor') | null>(null);
  const settings = useSettingsStore((s) => s.settings);
  
  const detectedLanguage = useMemo(() => {
    if (language) return language;
    if (path) return getLanguageFromPath(path);
    return 'plaintext';
  }, [language, path]);
  
  const handleMount: OnMount = useCallback((ed, monaco) => {
    editorRef.current = ed;
    monacoRef.current = monaco;
    
    // Keybindings
    ed.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      onSave?.(ed.getValue());
    });
    
    // Cursor tracking
    ed.onDidChangeCursorPosition((e) => {
      onCursorChange?.({ line: e.position.lineNumber, column: e.position.column });
    });
    
    configureMonaco(monaco);
    onMount?.(ed);
  }, [onSave, onCursorChange, onMount]);
  
  const handleChange: OnChange = useCallback((val) => {
    onChange?.(val ?? '');
  }, [onChange]);
  
  const handleBeforeMount: BeforeMount = useCallback((monaco) => {
    // Custom dark theme
    monaco.editor.defineTheme('pulse-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '6A9955', fontStyle: 'italic' },
        { token: 'keyword', foreground: 'C586C0' },
        { token: 'string', foreground: 'CE9178' },
        { token: 'number', foreground: 'B5CEA8' },
        { token: 'type', foreground: '4EC9B0' },
        { token: 'function', foreground: 'DCDCAA' },
      ],
      colors: {
        'editor.background': '#0d1117',
        'editor.foreground': '#c9d1d9',
        'editor.lineHighlightBackground': '#161b22',
        'editorLineNumber.foreground': '#484f58',
        'editorLineNumber.activeForeground': '#c9d1d9',
        'editorCursor.foreground': '#58a6ff',
        'editor.selectionBackground': '#264f78',
      },
    });
    
    // TypeScript config
    monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
      target: monaco.languages.typescript.ScriptTarget.ES2022,
      module: monaco.languages.typescript.ModuleKind.ESNext,
      jsx: monaco.languages.typescript.JsxEmit.ReactJSX,
      allowNonTsExtensions: true,
      allowJs: true,
      strict: true,
      noEmit: true,
      esModuleInterop: true,
    });
  }, []);
  
  const editorOptions: editor.IStandaloneEditorConstructionOptions = useMemo(() => ({
    readOnly,
    fontSize: fontSize ?? settings.editor.fontSize,
    fontFamily: settings.editor.fontFamily,
    lineHeight: settings.editor.lineHeight,
    fontLigatures: settings.editor.fontLigatures,
    minimap: { enabled: minimap ?? settings.editor.minimap },
    lineNumbers: lineNumbers ?? settings.editor.lineNumbers,
    wordWrap: wordWrap ?? settings.editor.wordWrap,
    bracketPairColorization: { enabled: settings.editor.bracketPairColorization },
    guides: { indentation: true, bracketPairs: true, highlightActiveIndentation: true },
    cursorBlinking: settings.editor.cursorBlinking,
    cursorSmoothCaretAnimation: 'on',
    smoothScrolling: settings.editor.smoothScrolling,
    suggestOnTriggerCharacters: true,
    quickSuggestions: { other: true, comments: false, strings: false },
    parameterHints: { enabled: true, cycle: true },
    folding: settings.editor.folding,
    codeLens: settings.editor.codeLens,
    stickyScroll: { enabled: settings.editor.stickyScroll },
    formatOnPaste: settings.editor.formatOnPaste,
    formatOnType: settings.editor.formatOnType,
    automaticLayout: true,
    scrollBeyondLastLine: false,
    ...options,
  }), [readOnly, fontSize, minimap, lineNumbers, wordWrap, settings.editor, options]);
  
  return (
    <div className={cn('h-full w-full', className)}>
      <Editor
        height="100%"
        language={detectedLanguage}
        value={value}
        theme={theme === 'vs-dark' ? 'pulse-dark' : theme}
        beforeMount={handleBeforeMount}
        onMount={handleMount}
        onChange={handleChange}
        options={editorOptions}
        loading={
          <div className="flex items-center justify-center h-full bg-[#0d1117]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        }
      />
    </div>
  );
}

// ============================================================================
// MONACO CONFIGURATION
// ============================================================================

function configureMonaco(monaco: typeof import('monaco-editor')) {
  // AI inline completion provider
  monaco.languages.registerInlineCompletionProvider('*', {
    provideInlineCompletions: async () => ({ items: [] }),
    freeInlineCompletions: () => {},
  });
  
  // AI code action provider
  monaco.languages.registerCodeActionProvider('*', {
    provideCodeActions: async (model, range, context) => {
      const actions: monaco.languages.CodeAction[] = [];
      if (context.markers.length > 0) {
        actions.push({
          title: '🤖 AI: Fix this issue',
          kind: 'quickfix',
          diagnostics: context.markers,
          edit: { edits: [] },
          isPreferred: false,
        });
      }
      return { actions, dispose: () => {} };
    },
  });
  
  // Hover provider for AI explanations
  monaco.languages.registerHoverProvider('*', {
    provideHover: async (model, position) => {
      const word = model.getWordAtPosition(position);
      if (!word) return null;
      return {
        contents: [
          { value: `**${word.word}**` },
          { value: 'Press `Ctrl+Shift+E` for AI explanation' },
        ],
      };
    },
  });
}

export default MonacoEditor;
