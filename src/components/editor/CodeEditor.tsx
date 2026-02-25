'use client';

import React, { useRef, useState, useCallback, useEffect } from 'react';
import Editor, { OnMount, OnChange, Monaco } from '@monaco-editor/react';
import { useKyroStore } from '@/store/kyroStore';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useGhostTextProvider } from './GhostTextProvider';

// Extended editor options for full IDE experience
interface EditorOptions {
  minimap: boolean;
  stickyScroll: boolean;
  bracketPairColorization: boolean;
  inlineSuggest: boolean;
  ghostText: boolean;
  wordWrap: 'on' | 'off' | 'bounded';
  fontSize: number;
  fontFamily: string;
  lineNumbers: 'on' | 'off' | 'relative';
  renderWhitespace: 'none' | 'boundary' | 'selection' | 'all';
  guides: {
    bracketPairs: boolean;
    indentation: boolean;
  };
}

// Ghost text state for AI autocomplete
interface GhostTextState {
  text: string;
  position: { line: number; column: number };
  visible: boolean;
}

export function CodeEditor() {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const [ghostText, setGhostText] = useState<GhostTextState>({ text: '', position: { line: 0, column: 0 }, visible: false });
  const [splitEditor, setSplitEditor] = useState<'none' | 'horizontal' | 'vertical'>('none');
  const secondEditorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);

  const {
    openFiles, activeFileIndex, updateFileContent, setCursorPosition,
    settings, setEditorOptions
  } = useKyroStore();

  const currentFile = activeFileIndex >= 0 ? openFiles[activeFileIndex] : null;

  // Initialize ghost text provider with streaming
  const { currentCompletion, isProcessing: isGhostTextProcessing } = useGhostTextProvider(
    editorRef.current,
    monacoRef.current,
    currentFile?.language || 'plaintext',
    { enabled: editorOptions.ghostText, debounceMs: 300, maxTokens: 100 }
  );

  // Default editor options
  const defaultOptions: EditorOptions = {
    minimap: true,
    stickyScroll: true,
    bracketPairColorization: true,
    inlineSuggest: true,
    ghostText: true,
    wordWrap: 'on',
    fontSize: 14,
    fontFamily: 'JetBrains Mono, Fira Code, monospace',
    lineNumbers: 'on',
    renderWhitespace: 'selection',
    guides: { bracketPairs: true, indentation: true }
  };

  const editorOptions = settings?.editorOptions || defaultOptions;

  // Handle multi-cursor editing shortcuts
  const setupMultiCursorShortcuts = useCallback((editor: monaco.editor.IStandaloneCodeEditor, monaco: Monaco) => {
    // Ctrl+D - Add cursor to next occurrence
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyD, () => {
      editor.getAction('editor.action.addSelectionToNextFindMatch')?.run();
    });

    // Ctrl+Shift+D - Add cursor to previous occurrence
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyD, () => {
      editor.getAction('editor.action.addSelectionToPreviousFindMatch')?.run();
    });

    // Ctrl+Shift+L - Select all occurrences
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyL, () => {
      editor.getAction('editor.action.selectHighlights')?.run();
    });

    // Alt+Click already works for adding cursors in Monaco

    // Ctrl+Alt+Up - Add cursor above
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.UpArrow, () => {
      editor.getAction('editor.action.insertCursorAbove')?.run();
    });

    // Ctrl+Alt+Down - Add cursor below
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.DownArrow, () => {
      editor.getAction('editor.action.insertCursorBelow')?.run();
    });

    // Column selection mode toggle (Shift+Alt+drag already works)
    editor.addCommand(monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyC, () => {
      const columnSelection = editor.getOption(monaco.editor.EditorOption.columnSelection);
      editor.updateOptions({ columnSelection: !columnSelection });
    });

    // Ctrl+/ - Toggle line comment
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Slash, () => {
      editor.getAction('editor.action.commentLine')?.run();
    });

    // Ctrl+Shift+/ - Toggle block comment
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.Slash, () => {
      editor.getAction('editor.action.blockComment')?.run();
    });

    // Ctrl+Shift+K - Delete line
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyK, () => {
      editor.getAction('editor.action.deleteLines')?.run();
    });

    // Alt+Up - Move line up
    editor.addCommand(monaco.KeyMod.Alt | monaco.KeyCode.UpArrow, () => {
      editor.getAction('editor.action.moveLinesUpAction')?.run();
    });

    // Alt+Down - Move line down
    editor.addCommand(monaco.KeyMod.Alt | monaco.KeyCode.DownArrow, () => {
      editor.getAction('editor.action.moveLinesDownAction')?.run();
    });

    // Ctrl+Shift+Enter - Insert line above
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.Enter, () => {
      editor.getAction('editor.action.insertLineBefore')?.run();
    });

    // Ctrl+Enter - Insert line below
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      editor.getAction('editor.action.insertLineAfter')?.run();
    });

    // Ctrl+[ - Outdent
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.BracketLeft, () => {
      editor.getAction('editor.action.outdent')?.run();
    });

    // Ctrl+] - Indent
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.BracketRight, () => {
      editor.getAction('editor.action.indent')?.run();
    });

    // F2 - Rename symbol
    editor.addCommand(monaco.KeyCode.F2, () => {
      editor.getAction('editor.action.rename')?.run();
    });

    // F12 - Go to definition
    editor.addCommand(monaco.KeyCode.F12, () => {
      editor.getAction('editor.action.goToDeclaration')?.run();
    });

    // Shift+F12 - Go to references
    editor.addCommand(monaco.KeyMod.Shift | monaco.KeyCode.F12, () => {
      editor.getAction('editor.action.goToReferences')?.run();
    });

    // Ctrl+Shift+F12 - Peek references
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.F12, () => {
      editor.getAction('editor.action.peekReferences')?.run();
    });

    // Alt+F12 - Peek definition
    editor.addCommand(monaco.KeyMod.Alt | monaco.KeyCode.F12, () => {
      editor.getAction('editor.action.peekDefinition')?.run();
    });

    // Ctrl+K Ctrl+I - Show hover
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK, () => {
      // Chained command - show hover
      editor.getAction('editor.action.showHover')?.run();
    });

    // Ctrl+M - Toggle tab focus mode
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyM, () => {
      editor.getAction('editor.action.toggleTabFocusMode')?.run();
    });

    // F1 or Ctrl+Shift+P - Command palette
    editor.addCommand(monaco.KeyCode.F1, () => {
      editor.getAction('editor.action.quickCommand')?.run();
    });

    // Ctrl+P - Quick open file
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyP, () => {
      editor.getAction('editor.action.quickOutline')?.run();
    });

    // Ctrl+G - Go to line
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyG, () => {
      editor.getAction('editor.action.gotoLine')?.run();
    });

    // Format document
    editor.addCommand(monaco.KeyMod.Alt | monaco.KeyMod.Shift | monaco.KeyCode.KeyF, () => {
      editor.getAction('editor.action.formatDocument')?.run();
    });

    // Expand/shrink selection
    editor.addCommand(monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.RightArrow, () => {
      editor.getAction('editor.action.smartSelect.expand')?.run();
    });
    editor.addCommand(monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.LeftArrow, () => {
      editor.getAction('editor.action.smartSelect.shrink')?.run();
    });

    // Trigger inline chat (Ctrl+K)
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK, () => {
      const selection = editor.getSelection();
      if (selection) {
        // Emit event for inline chat
        window.dispatchEvent(new CustomEvent('kyro:inline-chat', {
          detail: {
            position: editor.getPosition(),
            selection: selection,
            text: editor.getModel()?.getValueInRange(selection)
          }
        }));
      }
    });
  }, []);

  // Ghost text AI completion
  const fetchGhostTextCompletion = useCallback(async (editor: monaco.editor.IStandaloneCodeEditor, position: monaco.Position) => {
    const model = editor.getModel();
    if (!model) return;

    const textUntilPosition = model.getValueInRange({
      startLineNumber: 1,
      startColumn: 1,
      endLineNumber: position.lineNumber,
      endColumn: position.column
    });

    try {
      // Get AI completion from backend
      const completion = await invoke<string>('ai_code_completion', {
        code: textUntilPosition,
        language: currentFile?.language || 'plaintext',
        maxTokens: 100
      });

      if (completion && completion.trim()) {
        setGhostText({
          text: completion,
          position: { line: position.lineNumber, column: position.column },
          visible: true
        });
      }
    } catch (error) {
      console.log('Ghost text completion error:', error);
    }
  }, [currentFile]);

  // Accept ghost text
  const acceptGhostText = useCallback(() => {
    if (!editorRef.current || !ghostText.visible) return;

    const editor = editorRef.current;
    const position = editor.getPosition();
    if (!position) return;

    // Insert ghost text at cursor
    editor.executeEdits('ghost-text', [{
      range: new monacoRef.current!.Range(
        position.lineNumber,
        position.column,
        position.lineNumber,
        position.column
      ),
      text: ghostText.text
    }]);

    setGhostText({ text: '', position: { line: 0, column: 0 }, visible: false });
  }, [ghostText]);

  // Handle editor mount
  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Define custom theme
    monaco.editor.defineTheme('kyro-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '6A9955', fontStyle: 'italic' },
        { token: 'keyword', foreground: '569CD6' },
        { token: 'keyword.control', foreground: 'C586C0' },
        { token: 'string', foreground: 'CE9178' },
        { token: 'string.escape', foreground: 'D7BA7D' },
        { token: 'number', foreground: 'B5CEA8' },
        { token: 'constant', foreground: '4FC1FF' },
        { token: 'type', foreground: '4EC9B0' },
        { token: 'class', foreground: '4EC9B0' },
        { token: 'interface', foreground: '4EC9B0' },
        { token: 'struct', foreground: '4EC9B0' },
        { token: 'enum', foreground: '4EC9B0' },
        { token: 'function', foreground: 'DCDCAA' },
        { token: 'method', foreground: 'DCDCAA' },
        { token: 'variable', foreground: '9CDCFE' },
        { token: 'variable.parameter', foreground: '9CDCFE' },
        { token: 'variable.property', foreground: '9CDCFE' },
        { token: 'operator', foreground: 'D4D4D4' },
        { token: 'delimiter', foreground: 'D4D4D4' },
        { token: 'delimiter.bracket', foreground: 'FFD700' },
        { token: 'tag', foreground: '569CD6' },
        { token: 'attribute.name', foreground: '9CDCFE' },
        { token: 'attribute.value', foreground: 'CE9178' },
      ],
      colors: {
        'editor.background': '#0D1117',
        'editor.foreground': '#C9D1D9',
        'editor.lineHighlightBackground': '#161B22',
        'editor.selectionBackground': '#264F78',
        'editor.selectionHighlightBackground': '#3A3D4166',
        'editor.inactiveSelectionBackground': '#264F7855',
        'editorGutter.background': '#0D1117',
        'editorLineNumber.foreground': '#484F58',
        'editorLineNumber.activeForeground': '#C9D1D9',
        'editorCursor.foreground': '#58A6FF',
        'editorWhitespace.foreground': '#484F5844',
        'editorIndentGuide.background': '#21262D',
        'editorIndentGuide.activeBackground': '#30363D',
        'editorBracketMatch.background': '#3FB95040',
        'editorBracketMatch.border': '#3FB950',
        'editorOverviewRuler.border': '#30363D',
        'editorRuler.foreground': '#30363D',
        'editorWidget.background': '#161B22',
        'editorWidget.border': '#30363D',
        'editorSuggestWidget.background': '#161B22',
        'editorSuggestWidget.border': '#30363D',
        'editorSuggestWidget.selectedBackground': '#21262D',
        'editorHoverWidget.background': '#161B22',
        'editorHoverWidget.border': '#30363D',
        'minimap.background': '#0D111780',
        'minimap.selectionHighlight': '#264F78',
        'minimapSlider.background': '#58A6FF20',
        'minimapSlider.hoverBackground': '#58A6FF40',
        'scrollbarSlider.background': '#484F5820',
        'scrollbarSlider.hoverBackground': '#484F5840',
        'scrollbarSlider.activeBackground': '#484F5880',
      }
    });

    monaco.editor.setTheme('kyro-dark');

    // Setup all keyboard shortcuts
    setupMultiCursorShortcuts(editor, monaco);

    // Track cursor position
    editor.onDidChangeCursorPosition((e) => {
      setCursorPosition(e.position.lineNumber, e.position.column);

      // Hide ghost text on cursor movement (unless it's right after suggestion)
      if (ghostText.visible && e.reason !== monaco.editor.CursorChangeReason.RecoverFromMarkers) {
        setGhostText({ text: '', position: { line: 0, column: 0 }, visible: false });
      }
    });

    // Setup ghost text trigger on typing
    let ghostTextTimeout: ReturnType<typeof setTimeout>;
    editor.onDidChangeModelContent((e) => {
      clearTimeout(ghostTextTimeout);
      ghostTextTimeout = setTimeout(() => {
        const position = editor.getPosition();
        if (position) {
          fetchGhostTextCompletion(editor, position);
        }
      }, 300); // Debounce
    });

    // Listen for inline chat events
    const handleInlineChat = (e: CustomEvent) => {
      console.log('Inline chat triggered:', e.detail);
    };
    window.addEventListener('kyro:inline-chat', handleInlineChat as EventListener);

    // Focus editor
    editor.focus();

    return () => {
      window.removeEventListener('kyro:inline-chat', handleInlineChat as EventListener);
    };
  };

  // Handle content change
  const handleEditorChange: OnChange = (value) => {
    if (currentFile && value !== undefined) {
      updateFileContent(currentFile.path, value);
    }
  };

  // Split editor toggle
  const toggleSplitEditor = useCallback((direction: 'horizontal' | 'vertical' | 'none') => {
    setSplitEditor(direction);
  }, []);

  // Register additional languages
  useEffect(() => {
    if (!monacoRef.current) return;

    // These are extra languages Monaco might not have built-in
    const monaco = monacoRef.current;

    // Svelte
    monaco.languages.register({ id: 'svelte' });
    monaco.languages.setMonarchTokensProvider('svelte', {
      tokenizer: {
        root: [
          [/<\w+/, 'tag'],
          [/<\/\w+/, 'tag'],
          [/\w+=/, 'attribute.name'],
          [/"[^"]*"/, 'string'],
          [/'[^']*'/, 'string'],
          [/\{[^}]*\}/, 'delimiter.bracket'],
        ]
      }
    });

    // Vue
    monaco.languages.register({ id: 'vue' });
    monaco.languages.setMonarchTokensProvider('vue', {
      tokenizer: {
        root: [
          [/<template>/, 'tag'],
          [/<script>/, 'tag'],
          [/<style>/, 'tag'],
          [/<\/template>/, 'tag'],
          [/<\/script>/, 'tag'],
          [/<\/style>/, 'tag'],
        ]
      }
    });

    // TOML
    monaco.languages.register({ id: 'toml' });
    monaco.languages.setMonarchTokensProvider('toml', {
      tokenizer: {
        root: [
          [/\[.*\]/, 'type'],
          [/\w+/, 'variable'],
          [/=.*/, 'delimiter'],
          [/"[^"]*"/, 'string'],
          [/'[^']*'/, 'string'],
          [/#.*/, 'comment'],
        ]
      }
    });

  }, []);

  if (!currentFile) return null;

  const editorOptions_final: monaco.editor.IStandaloneEditorConstructionOptions = {
    fontSize: editorOptions.fontSize,
    fontFamily: editorOptions.fontFamily,
    minimap: { enabled: editorOptions.minimap, scale: 1, showSlider: 'mouseover' },
    scrollBeyondLastLine: false,
    wordWrap: editorOptions.wordWrap,
    automaticLayout: true,
    folding: true,
    foldingStrategy: 'auto',
    foldingHighlight: true,
    showFoldingControls: 'mouseover',
    bracketPairColorization: { enabled: editorOptions.bracketPairColorization },
    guides: editorOptions.guides,
    stickyScroll: { enabled: editorOptions.stickyScroll },
    inlineSuggest: { enabled: editorOptions.inlineSuggest },
    quickSuggestions: {
      other: true,
      comments: false,
      strings: true
    },
    suggestOnTriggerCharacters: true,
    acceptSuggestionOnEnter: 'on',
    tabCompletion: 'on',
    wordBasedSuggestions: 'allDocuments',
    parameterHints: { enabled: true, cycle: true },
    formatOnPaste: true,
    formatOnType: true,
    autoIndent: 'full',
    smartSelect: { selectLeadingAndTrailingWhitespace: true },
    multicursor: {
      modifier: 'alt',
      pasteOverCursor: 'spread'
    },
    lineNumbers: editorOptions.lineNumbers,
    renderWhitespace: editorOptions.renderWhitespace,
    renderLineHighlight: 'all',
    cursorBlinking: 'smooth',
    cursorSmoothCaretAnimation: 'on',
    cursorWidth: 2,
    roundedSelection: true,
    smoothScrolling: true,
    padding: { top: 16, bottom: 16 },
    overviewRulerLanes: 3,
    overviewRulerBorder: true,
    hideCursorInOverviewRuler: false,
    overviewRulerPosition: 'right',
    scrollbar: {
      vertical: 'auto',
      horizontal: 'auto',
      verticalScrollbarSize: 12,
      horizontalScrollbarSize: 12,
      useShadows: false
    },
    find: {
      addExtraSpaceOnTop: false,
      autoFindInSelection: 'multiline',
      seedSearchStringFromSelection: 'selection'
    },
    links: true,
    colorDecorators: true,
    dragAndDrop: true,
    dropIntoEditor: { enabled: true },
    linkedEditing: true,
    mouseWheelZoom: true,
    accessibilitySupport: 'auto',
    ariaLabel: 'Code Editor',
    screenReaderAnnounceInlineSuggestion: true,
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Ghost text overlay */}
      {ghostText.visible && (
        <div
          className="absolute z-50 pointer-events-none text-[#8b949e80] italic"
          style={{
            top: ghostText.position.line * 19 + 'px',
            left: ghostText.position.column * 8 + 'px'
          }}
        >
          {ghostText.text}
          <span className="text-[#58a6ff] text-xs ml-2">(Tab to accept)</span>
        </div>
      )}

      {/* Main editor or split view */}
      <div className={`flex-1 flex ${splitEditor === 'vertical' ? 'flex-row' : 'flex-col'} overflow-hidden`}>
        {/* Primary editor */}
        <div className={`flex-1 overflow-hidden ${splitEditor !== 'none' ? 'border-r border-[#30363d]' : ''}`}>
          <Editor
            height="100%"
            language={currentFile.language}
            value={currentFile.content}
            onChange={handleEditorChange}
            onMount={handleEditorMount}
            options={editorOptions_final}
            loading={
              <div className="flex items-center justify-center h-full bg-[#0d1117]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#58a6ff]"></div>
              </div>
            }
          />
        </div>

        {/* Split editor */}
        {splitEditor !== 'none' && (
          <div className="flex-1 overflow-hidden">
            <Editor
              height="100%"
              language={currentFile.language}
              value={currentFile.content}
              onChange={handleEditorChange}
              onMount={(editor, monaco) => {
                secondEditorRef.current = editor;
                monaco.editor.setTheme('kyro-dark');
              }}
              options={{
                ...editorOptions_final,
                minimap: { enabled: false } // Hide minimap in split view
              }}
            />
          </div>
        )}
      </div>

      {/* Editor toolbar */}
      <div className="h-8 bg-[#161b22] border-t border-[#30363d] flex items-center px-2 text-xs text-[#8b949e]">
        <button
          onClick={() => toggleSplitEditor(splitEditor === 'none' ? 'vertical' : 'none')}
          className={`px-2 py-1 rounded hover:bg-[#21262d] ${splitEditor !== 'none' ? 'text-[#58a6ff]' : ''}`}
          title="Split Editor"
        >
          Split
        </button>
        <span className="mx-2">|</span>
        <button
          onClick={() => {
            if (editorRef.current) {
              editorRef.current.updateOptions({ minimap: { enabled: !editorOptions.minimap } });
              setEditorOptions({ ...editorOptions, minimap: !editorOptions.minimap });
            }
          }}
          className={`px-2 py-1 rounded hover:bg-[#21262d] ${editorOptions.minimap ? 'text-[#58a6ff]' : ''}`}
          title="Toggle Minimap"
        >
          Minimap
        </button>
        <span className="mx-2">|</span>
        <button
          onClick={() => {
            if (editorRef.current) {
              editorRef.current.updateOptions({ stickyScroll: { enabled: !editorOptions.stickyScroll } });
              setEditorOptions({ ...editorOptions, stickyScroll: !editorOptions.stickyScroll });
            }
          }}
          className={`px-2 py-1 rounded hover:bg-[#21262d] ${editorOptions.stickyScroll ? 'text-[#58a6ff]' : ''}`}
          title="Toggle Sticky Scroll"
        >
          Sticky
        </button>
        <span className="mx-2">|</span>
        <button
          onClick={() => {
            if (editorRef.current) {
              const newWrap = editorOptions.wordWrap === 'on' ? 'off' : 'on';
              editorRef.current.updateOptions({ wordWrap: newWrap });
              setEditorOptions({ ...editorOptions, wordWrap: newWrap });
            }
          }}
          className={`px-2 py-1 rounded hover:bg-[#21262d] ${editorOptions.wordWrap === 'on' ? 'text-[#58a6ff]' : ''}`}
          title="Toggle Word Wrap"
        >
          Wrap
        </button>
      </div>
    </div>
  );
}
