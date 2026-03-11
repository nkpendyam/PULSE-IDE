'use client';

import React, { useRef, useCallback, useEffect } from 'react';
import type * as monaco from 'monaco-editor';
import Editor, { OnMount, OnChange, Monaco } from '@monaco-editor/react';
import { invoke } from '@tauri-apps/api/core';
import { useKyroStore } from '@/store/kyroStore';
import { toast } from 'sonner';

export interface MonacoEditorProps {
  value: string;
  language: string;
  onChange: (value: string) => void;
  onSave?: () => void;
  path?: string;
  readOnly?: boolean;
}

/**
 * MonacoEditor Component
 * 
 * A Monaco editor wrapper with:
 * - Syntax highlighting for all languages
 * - File open/save functionality
 * - Keyboard shortcuts (Cmd+S/Ctrl+S for save)
 * - Integration with Tauri file system
 */
export function MonacoEditor({
  value,
  language,
  onChange,
  onSave,
  path,
  readOnly = false
}: MonacoEditorProps) {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const { setCursorPosition, settings } = useKyroStore();

  // Save file handler
  const handleSave = useCallback(async () => {
    if (!path) {
      toast.error('No file path specified');
      return;
    }

    try {
      await invoke('write_file', {
        path,
        content: value
      });
      
      toast.success('File saved successfully');
      
      // Call onSave callback if provided
      if (onSave) {
        onSave();
      }
    } catch (error) {
      console.error('Failed to save file:', error);
      toast.error(`Failed to save file: ${error}`);
    }
  }, [path, value, onSave]);

  // Setup keyboard shortcuts
  const setupKeyboardShortcuts = useCallback((editor: monaco.editor.IStandaloneCodeEditor, monaco: Monaco) => {
    // Cmd+S (Mac) / Ctrl+S (Windows/Linux) - Save file
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      handleSave();
    });

    // Cmd+Shift+S - Save As (future implementation)
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyS, () => {
      // TODO: Implement Save As dialog
      toast.info('Save As not yet implemented');
    });

    // Cmd+W - Close file
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyW, () => {
      // Emit event to close current file
      window.dispatchEvent(new CustomEvent('kyro:close-file', { detail: { path } }));
    });

    // Cmd+P - Quick open file
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyP, () => {
      window.dispatchEvent(new CustomEvent('kyro:quick-open'));
    });

    // Cmd+Shift+P - Command palette
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyP, () => {
      window.dispatchEvent(new CustomEvent('kyro:command-palette'));
    });

    // Cmd+F - Find
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyF, () => {
      editor.getAction('actions.find')?.run();
    });

    // Cmd+H - Replace
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyH, () => {
      editor.getAction('editor.action.startFindReplaceAction')?.run();
    });

    // Cmd+G - Go to line
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyG, () => {
      editor.getAction('editor.action.gotoLine')?.run();
    });

    // Cmd+/ - Toggle line comment
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Slash, () => {
      editor.getAction('editor.action.commentLine')?.run();
    });

    // Cmd+Shift+/ - Toggle block comment
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.Slash, () => {
      editor.getAction('editor.action.blockComment')?.run();
    });

    // Alt+Shift+F - Format document
    editor.addCommand(monaco.KeyMod.Alt | monaco.KeyMod.Shift | monaco.KeyCode.KeyF, () => {
      editor.getAction('editor.action.formatDocument')?.run();
    });

    // F2 - Rename symbol
    editor.addCommand(monaco.KeyCode.F2, () => {
      editor.getAction('editor.action.rename')?.run();
    });

    // F12 - Go to definition
    editor.addCommand(monaco.KeyCode.F12, () => {
      editor.getAction('editor.action.revealDefinition')?.run();
    });

    // Shift+F12 - Find all references
    editor.addCommand(monaco.KeyMod.Shift | monaco.KeyCode.F12, () => {
      editor.getAction('editor.action.goToReferences')?.run();
    });

    // Cmd+D - Add selection to next find match
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyD, () => {
      editor.getAction('editor.action.addSelectionToNextFindMatch')?.run();
    });

    // Cmd+K Cmd+C - Add line comment
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK, () => {
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyC, () => {
        editor.getAction('editor.action.addCommentLine')?.run();
      });
    });

    // Cmd+K Cmd+U - Remove line comment
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK, () => {
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyU, () => {
        editor.getAction('editor.action.removeCommentLine')?.run();
      });
    });
  }, [handleSave, path]);

  // Handle editor mount
  const handleEditorMount: OnMount = useCallback((editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Define custom Kyro theme
    monaco.editor.defineTheme('kyro-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '6A9955', fontStyle: 'italic' },
        { token: 'keyword', foreground: '569CD6', fontStyle: 'bold' },
        { token: 'keyword.control', foreground: 'C586C0' },
        { token: 'string', foreground: 'CE9178' },
        { token: 'number', foreground: 'B5CEA8' },
        { token: 'regexp', foreground: 'D16969' },
        { token: 'type', foreground: '4EC9B0' },
        { token: 'class', foreground: '4EC9B0' },
        { token: 'function', foreground: 'DCDCAA' },
        { token: 'variable', foreground: '9CDCFE' },
        { token: 'constant', foreground: '4FC1FF' },
        { token: 'operator', foreground: 'D4D4D4' },
        { token: 'delimiter', foreground: 'D4D4D4' },
        { token: 'tag', foreground: '569CD6' },
        { token: 'attribute.name', foreground: '9CDCFE' },
        { token: 'attribute.value', foreground: 'CE9178' },
      ],
      colors: {
        'editor.background': '#0D1117',
        'editor.foreground': '#C9D1D9',
        'editor.lineHighlightBackground': '#161B22',
        'editor.selectionBackground': '#264F78',
        'editorCursor.foreground': '#58A6FF',
        'editorLineNumber.foreground': '#484F58',
        'editorLineNumber.activeForeground': '#C9D1D9',
        'editorIndentGuide.background': '#21262D',
        'editorIndentGuide.activeBackground': '#30363D',
        'editorWhitespace.foreground': '#484F5844',
      }
    });

    monaco.editor.setTheme('kyro-dark');

    // Setup keyboard shortcuts
    setupKeyboardShortcuts(editor, monaco);

    // Track cursor position
    editor.onDidChangeCursorPosition((e) => {
      setCursorPosition(e.position.lineNumber, e.position.column);
    });

    // Focus editor
    editor.focus();
  }, [setupKeyboardShortcuts, setCursorPosition]);

  // Handle content change
  const handleEditorChange: OnChange = useCallback((value) => {
    if (value !== undefined) {
      onChange(value);
    }
  }, [onChange]);

  // Register additional language support
  useEffect(() => {
    if (!monacoRef.current) return;

    const monaco = monacoRef.current;

    // Register Svelte
    if (!monaco.languages.getLanguages().some(l => l.id === 'svelte')) {
      monaco.languages.register({ id: 'svelte' });
      monaco.languages.setMonarchTokensProvider('svelte', {
        tokenizer: {
          root: [
            [/<script[^>]*>/, 'tag', '@script'],
            [/<style[^>]*>/, 'tag', '@style'],
            [/<[a-zA-Z][\w:]*/, 'tag', '@tag'],
            [/\{[#/:@]/, 'delimiter.bracket', '@svelte'],
          ],
          script: [
            [/<\/script>/, 'tag', '@pop'],
            [/./, 'source.js'],
          ],
          style: [
            [/<\/style>/, 'tag', '@pop'],
            [/./, 'source.css'],
          ],
          tag: [
            [/>/, 'tag', '@pop'],
            [/[\w-]+/, 'attribute.name'],
            [/=/, 'delimiter'],
            [/"[^"]*"/, 'string'],
            [/'[^']*'/, 'string'],
          ],
          svelte: [
            [/}/, 'delimiter.bracket', '@pop'],
            [/./, 'source.js'],
          ],
        }
      });
    }

    // Register Vue
    if (!monaco.languages.getLanguages().some(l => l.id === 'vue')) {
      monaco.languages.register({ id: 'vue' });
      monaco.languages.setMonarchTokensProvider('vue', {
        tokenizer: {
          root: [
            [/<template>/, 'tag', '@template'],
            [/<script[^>]*>/, 'tag', '@script'],
            [/<style[^>]*>/, 'tag', '@style'],
          ],
          template: [
            [/<\/template>/, 'tag', '@pop'],
            [/<[a-zA-Z][\w:]*/, 'tag', '@tag'],
            [/\{\{/, 'delimiter.bracket', '@expression'],
          ],
          script: [
            [/<\/script>/, 'tag', '@pop'],
            [/./, 'source.js'],
          ],
          style: [
            [/<\/style>/, 'tag', '@pop'],
            [/./, 'source.css'],
          ],
          tag: [
            [/>/, 'tag', '@pop'],
            [/[\w-]+/, 'attribute.name'],
            [/=/, 'delimiter'],
            [/"[^"]*"/, 'string'],
          ],
          expression: [
            [/}}/, 'delimiter.bracket', '@pop'],
            [/./, 'source.js'],
          ],
        }
      });
    }

    // Register TOML
    if (!monaco.languages.getLanguages().some(l => l.id === 'toml')) {
      monaco.languages.register({ id: 'toml' });
      monaco.languages.setMonarchTokensProvider('toml', {
        tokenizer: {
          root: [
            [/\[.*\]/, 'type'],
            [/#.*$/, 'comment'],
            [/\w+(?=\s*=)/, 'variable'],
            [/=/, 'delimiter'],
            [/"[^"]*"/, 'string'],
            [/'[^']*'/, 'string'],
            [/\d+/, 'number'],
            [/true|false/, 'constant'],
          ]
        }
      });
    }
  }, []);

  // Get editor options from settings or use defaults
  const editorOptions: monaco.editor.IStandaloneEditorConstructionOptions = {
    fontSize: settings?.editorOptions?.fontSize || 14,
    fontFamily: settings?.editorOptions?.fontFamily || 'JetBrains Mono, Fira Code, Consolas, monospace',
    minimap: { 
      enabled: settings?.editorOptions?.minimap !== false,
      showSlider: 'mouseover'
    },
    scrollBeyondLastLine: false,
    wordWrap: settings?.editorOptions?.wordWrap || 'on',
    automaticLayout: true,
    tabSize: 2,
    insertSpaces: true,
    lineNumbers: settings?.editorOptions?.lineNumbers || 'on',
    renderWhitespace: settings?.editorOptions?.renderWhitespace || 'selection',
    bracketPairColorization: { 
      enabled: settings?.editorOptions?.bracketPairColorization !== false 
    },
    guides: {
      bracketPairs: true,
      indentation: true,
    },
    stickyScroll: { 
      enabled: settings?.editorOptions?.stickyScroll !== false 
    },
    inlineSuggest: { 
      enabled: settings?.editorOptions?.inlineSuggest !== false 
    },
    quickSuggestions: {
      other: true,
      comments: false,
      strings: true
    },
    suggestOnTriggerCharacters: true,
    acceptSuggestionOnEnter: 'on',
    tabCompletion: 'on',
    wordBasedSuggestions: 'allDocuments',
    parameterHints: { enabled: true },
    formatOnPaste: true,
    formatOnType: true,
    autoIndent: 'full',
    folding: true,
    foldingStrategy: 'auto',
    showFoldingControls: 'mouseover',
    matchBrackets: 'always',
    renderLineHighlight: 'all',
    cursorBlinking: 'smooth',
    cursorSmoothCaretAnimation: 'on',
    smoothScrolling: true,
    mouseWheelZoom: true,
    links: true,
    colorDecorators: true,
    dragAndDrop: true,
    readOnly,
    padding: { top: 16, bottom: 16 },
    scrollbar: {
      vertical: 'auto',
      horizontal: 'auto',
      useShadows: false,
      verticalScrollbarSize: 12,
      horizontalScrollbarSize: 12,
    },
  };

  return (
    <div className="h-full w-full">
      <Editor
        height="100%"
        language={language}
        value={value}
        onChange={handleEditorChange}
        onMount={handleEditorMount}
        options={editorOptions}
        theme="kyro-dark"
        loading={
          <div className="flex items-center justify-center h-full bg-[#0d1117]">
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#58a6ff]"></div>
              <p className="text-sm text-[#8b949e]">Loading editor...</p>
            </div>
          </div>
        }
      />
    </div>
  );
}
