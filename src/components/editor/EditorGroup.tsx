'use client';

import React, { useRef, useCallback, useEffect, useState } from 'react';
import Editor, { OnMount, OnChange, Monaco } from '@monaco-editor/react';
import { useKyroStore, EditorGroup as EditorGroupType, EditorTab, SplitDirection } from '@/store/kyroStore';
import { X, Pin, GripVertical, SplitSquareHorizontal, SplitSquareVertical, ChevronDown } from 'lucide-react';

// Generate unique ID
const generateId = () => `group-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// Single Editor Instance with Tabs
interface EditorPaneProps {
  groupId: string;
  isActive: boolean;
  onFocus: () => void;
}

function EditorPane({ groupId, isActive, onFocus }: EditorPaneProps) {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  
  const {
    editorGroups,
    activeGroupId,
    updateFileContent,
    setCursorPosition,
    settings,
    setEditorOptions,
    addTabToGroup,
    removeTabFromGroup,
    setActiveTabInGroup,
    setDraggedTab,
    draggedTab,
    moveTabBetweenGroups,
    createEditorGroup,
    setSplitDirection,
    splitDirection,
    minimapVisible,
    minimapScale,
    pushCursorOperation,
    popCursorOperation,
    saveEditorViewState,
  } = useKyroStore();
  
  const group = editorGroups.find(g => g.id === groupId);
  const activeTab = group && group.activeTabIndex >= 0 ? group.tabs[group.activeTabIndex] : null;
  const [isDragOver, setIsDragOver] = useState(false);
  
  // Editor options
  const editorOptions = settings?.editorOptions;
  
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
        { token: 'function', foreground: 'DCDCAA' },
        { token: 'variable', foreground: '9CDCFE' },
      ],
      colors: {
        'editor.background': '#0D1117',
        'editor.foreground': '#C9D1D9',
        'editor.lineHighlightBackground': '#161B22',
        'editor.selectionBackground': '#264F78',
        'editorCursor.foreground': '#58A6FF',
        'editorLineNumber.foreground': '#484F58',
        'editorLineNumber.activeForeground': '#C9D1D9',
        'minimap.background': '#0D111780',
      }
    });
    
    monaco.editor.setTheme('kyro-dark');
    
    // Setup multi-cursor shortcuts
    setupMultiCursorShortcuts(editor, monaco);
    
    // Track cursor position
    editor.onDidChangeCursorPosition((e) => {
      setCursorPosition(e.position.lineNumber, e.position.column);
    });
    
    // Track selections for multi-cursor history
    editor.onDidChangeCursorSelection((e) => {
      const selections = editor.getSelections();
      if (selections && selections.length > 1) {
        pushCursorOperation({
          type: 'add',
          selections: selections.map(s => ({
            startLine: s.startLineNumber,
            startCol: s.startColumn,
            endLine: s.endLineNumber,
            endCol: s.endColumn
          }))
        });
      }
    });
    
    // Focus handling
    editor.onDidFocusEditorWidget(() => {
      onFocus();
    });
    
    // Save view state on blur
    editor.onDidBlurEditorWidget(() => {
      const viewState = editor.saveViewState();
      if (viewState) {
        saveEditorViewState(groupId, viewState);
      }
    });
    
    editor.focus();
  };
  
  // Setup multi-cursor shortcuts
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
    
    // Ctrl+U - Undo last cursor operation
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyU, () => {
      const lastOp = popCursorOperation();
      if (lastOp) {
        const selections = lastOp.selections.map(s => 
          new monaco.Selection(s.startLine, s.startCol, s.endLine, s.endCol)
        );
        editor.setSelections(selections);
      }
    });
    
    // Ctrl+Alt+Up - Add cursor above
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.UpArrow, () => {
      editor.getAction('editor.action.insertCursorAbove')?.run();
    });
    
    // Ctrl+Alt+Down - Add cursor below
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.DownArrow, () => {
      editor.getAction('editor.action.insertCursorBelow')?.run();
    });
    
    // Ctrl+\ - Split editor horizontally
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Backslash, () => {
      if (splitDirection === 'none') {
        const newGroupId = createEditorGroup();
        if (activeTab) {
          addTabToGroup(newGroupId, { ...activeTab });
        }
        setSplitDirection('vertical');
      }
    });
    
    // Ctrl+Shift+\ - Split editor vertically
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.Backslash, () => {
      if (splitDirection === 'none') {
        const newGroupId = createEditorGroup();
        if (activeTab) {
          addTabToGroup(newGroupId, { ...activeTab });
        }
        setSplitDirection('horizontal');
      }
    });
    
    // Alt+Click for multi-cursor is handled by Monaco's multicursor modifier
    
  }, [splitDirection, activeTab, createEditorGroup, addTabToGroup, setSplitDirection, popCursorOperation, pushCursorOperation]);
  
  // Handle content change
  const handleEditorChange: OnChange = (value) => {
    if (activeTab && value !== undefined) {
      updateFileContent(activeTab.path, value);
    }
  };
  
  // Tab drag handlers
  const handleTabDragStart = (e: React.DragEvent, tabIndex: number) => {
    e.dataTransfer.setData('text/plain', JSON.stringify({ groupId, tabIndex }));
    setDraggedTab({ groupId, tabIndex });
  };
  
  const handleTabDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };
  
  const handleTabDragLeave = () => {
    setIsDragOver(false);
  };
  
  const handleTabDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    try {
      const data = JSON.parse(e.dataTransfer.getData('text/plain'));
      if (data.groupId !== groupId) {
        moveTabBetweenGroups(data.groupId, data.tabIndex, groupId, group?.tabs.length || 0);
      }
    } catch {
      // Invalid drop data
    }
    
    setDraggedTab(null);
  };
  
  // Close tab
  const handleCloseTab = (tabIndex: number, e: React.MouseEvent) => {
    e.stopPropagation();
    removeTabFromGroup(groupId, tabIndex);
  };
  
  // Get file name from path
  const getFileName = (path: string) => {
    return path.split('/').pop() || path;
  };
  
  if (!group) return null;
  
  const editorOptionsFinal: monaco.editor.IStandaloneEditorConstructionOptions = {
    fontSize: editorOptions?.fontSize || 14,
    fontFamily: editorOptions?.fontFamily || 'JetBrains Mono, Fira Code, monospace',
    minimap: { 
      enabled: minimapVisible && groupId === activeGroupId, 
      scale: minimapScale, 
      showSlider: 'mouseover' 
    },
    scrollBeyondLastLine: false,
    wordWrap: editorOptions?.wordWrap || 'on',
    automaticLayout: true,
    folding: true,
    foldingStrategy: 'auto',
    bracketPairColorization: { enabled: editorOptions?.bracketPairColorization ?? true },
    stickyScroll: { enabled: editorOptions?.stickyScroll ?? true },
    inlineSuggest: { enabled: editorOptions?.inlineSuggest ?? true },
    quickSuggestions: { other: true, comments: false, strings: true },
    multicursor: {
      modifier: 'alt',
      pasteOverCursor: 'spread'
    },
    lineNumbers: editorOptions?.lineNumbers || 'on',
    renderWhitespace: editorOptions?.renderWhitespace || 'selection',
    cursorBlinking: 'smooth',
    cursorSmoothCaretAnimation: 'on',
    cursorWidth: 2,
    smoothScrolling: true,
    padding: { top: 8, bottom: 8 },
    scrollbar: {
      vertical: 'auto',
      horizontal: 'auto',
      verticalScrollbarSize: 10,
      horizontalScrollbarSize: 10,
    },
  };
  
  return (
    <div 
      className={`flex flex-col h-full bg-[#0d1117] ${isActive ? 'ring-1 ring-[#58a6ff]' : ''} ${isDragOver ? 'bg-[#1f6feb20]' : ''}`}
      onClick={onFocus}
      onDragOver={handleTabDragOver}
      onDragLeave={handleTabDragLeave}
      onDrop={handleTabDrop}
    >
      {/* Tab Bar */}
      <div className="flex items-center h-9 bg-[#161b22] border-b border-[#30363d] overflow-x-auto scrollbar-thin">
        {group.tabs.map((tab, index) => (
          <div
            key={tab.path}
            className={`flex items-center gap-1 px-3 h-full border-r border-[#30363d] cursor-pointer select-none group
              ${index === group.activeTabIndex ? 'bg-[#0d1117] text-[#c9d1d9]' : 'text-[#8b949e] hover:bg-[#21262d]'}
              ${draggedTab?.groupId === groupId && draggedTab?.tabIndex === index ? 'opacity-50' : ''}`}
            onClick={() => setActiveTabInGroup(groupId, index)}
            draggable
            onDragStart={(e) => handleTabDragStart(e, index)}
          >
            <GripVertical className="w-3 h-3 opacity-0 group-hover:opacity-100 cursor-grab" />
            {tab.isPinned && <Pin className="w-3 h-3 text-[#58a6ff]" />}
            <span className="text-sm truncate max-w-[120px]">{getFileName(tab.path)}</span>
            {tab.isDirty && <span className="w-2 h-2 rounded-full bg-[#f0883e]" />}
            <button
              className="ml-1 p-0.5 rounded hover:bg-[#30363d] opacity-0 group-hover:opacity-100"
              onClick={(e) => handleCloseTab(index, e)}
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
      
      {/* Editor */}
      <div className="flex-1 overflow-hidden">
        {activeTab ? (
          <Editor
            height="100%"
            language={activeTab.language}
            value={activeTab.content}
            onChange={handleEditorChange}
            onMount={handleEditorMount}
            options={editorOptionsFinal}
            loading={
              <div className="flex items-center justify-center h-full bg-[#0d1117]">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#58a6ff]" />
              </div>
            }
          />
        ) : (
          <div className="flex items-center justify-center h-full text-[#8b949e]">
            <div className="text-center">
              <p className="text-sm">No file open</p>
              <p className="text-xs mt-1">Select a file from the sidebar</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Main EditorGroup component managing split panes
export function EditorGroup() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [splitPosition, setSplitPosition] = useState(50);
  const [isResizing, setIsResizing] = useState(false);
  
  const {
    editorGroups,
    activeGroupId,
    setActiveGroup,
    splitDirection,
    closeEditorGroup,
  } = useKyroStore();
  
  // Handle resize
  const handleMouseDown = useCallback(() => {
    setIsResizing(true);
  }, []);
  
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing || !containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const newPosition = splitDirection === 'vertical'
      ? ((e.clientX - rect.left) / rect.width) * 100
      : ((e.clientY - rect.top) / rect.height) * 100;
    
    setSplitPosition(Math.min(80, Math.max(20, newPosition)));
  }, [isResizing, splitDirection]);
  
  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);
  
  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isResizing, handleMouseMove, handleMouseUp]);
  
  // Get groups in display order
  const groups = editorGroups.slice(0, splitDirection === 'none' ? 1 : 2);
  
  if (splitDirection === 'none' || groups.length === 1) {
    return (
      <div ref={containerRef} className="h-full w-full">
        <EditorPane
          groupId={groups[0].id}
          isActive={groups[0].id === activeGroupId}
          onFocus={() => setActiveGroup(groups[0].id)}
        />
      </div>
    );
  }
  
  const containerStyle = splitDirection === 'vertical'
    ? { flexDirection: 'row' as const }
    : { flexDirection: 'column' as const };
  
  const firstPaneStyle = splitDirection === 'vertical'
    ? { width: `${splitPosition}%` }
    : { height: `${splitPosition}%` };
  
  const secondPaneStyle = splitDirection === 'vertical'
    ? { width: `${100 - splitPosition}%` }
    : { height: `${100 - splitPosition}%` };
  
  return (
    <div ref={containerRef} className="h-full w-full flex" style={containerStyle}>
      {/* First Pane */}
      <div style={firstPaneStyle} className="overflow-hidden">
        <EditorPane
          groupId={groups[0].id}
          isActive={groups[0].id === activeGroupId}
          onFocus={() => setActiveGroup(groups[0].id)}
        />
      </div>
      
      {/* Resizer */}
      <div
        className={`
          ${splitDirection === 'vertical' ? 'w-1 cursor-col-resize' : 'h-1 cursor-row-resize'}
          bg-[#30363d] hover:bg-[#58a6ff] transition-colors flex-shrink-0
          ${isResizing ? 'bg-[#58a6ff]' : ''}
        `}
        onMouseDown={handleMouseDown}
      >
        {/* Resize handle indicator */}
        <div className={`absolute ${splitDirection === 'vertical' ? 'top-1/2 -translate-y-1/2' : 'left-1/2 -translate-x-1/2'}`}>
          <ChevronDown className={`w-4 h-4 text-[#8b949e] ${splitDirection === 'vertical' ? 'rotate-[-90deg]' : ''}`} />
        </div>
      </div>
      
      {/* Second Pane */}
      <div style={secondPaneStyle} className="overflow-hidden">
        <EditorPane
          groupId={groups[1].id}
          isActive={groups[1].id === activeGroupId}
          onFocus={() => setActiveGroup(groups[1].id)}
        />
      </div>
    </div>
  );
}

// Split Pane Controls Component
export function SplitPaneControls() {
  const {
    splitDirection,
    setSplitDirection,
    editorGroups,
    createEditorGroup,
    addTabToGroup,
    closeEditorGroup,
    minimapVisible,
    setMinimapVisible,
  } = useKyroStore();
  
  const activeGroup = editorGroups.find(g => g.id === useKyroStore.getState().activeGroupId);
  const activeTab = activeGroup && activeGroup.activeTabIndex >= 0 
    ? activeGroup.tabs[activeGroup.activeTabIndex] 
    : null;
  
  const handleSplitVertical = () => {
    if (splitDirection === 'none') {
      const newGroupId = createEditorGroup();
      if (activeTab) {
        addTabToGroup(newGroupId, { ...activeTab });
      }
      setSplitDirection('vertical');
    } else {
      closeEditorGroup(editorGroups[1].id);
      setSplitDirection('none');
    }
  };
  
  const handleSplitHorizontal = () => {
    if (splitDirection === 'none') {
      const newGroupId = createEditorGroup();
      if (activeTab) {
        addTabToGroup(newGroupId, { ...activeTab });
      }
      setSplitDirection('horizontal');
    } else {
      closeEditorGroup(editorGroups[1].id);
      setSplitDirection('none');
    }
  };
  
  return (
    <div className="flex items-center gap-1 px-2">
      <button
        onClick={handleSplitVertical}
        className={`p-1.5 rounded hover:bg-[#21262d] ${splitDirection === 'vertical' ? 'text-[#58a6ff]' : 'text-[#8b949e]'}`}
        title="Split Editor Vertically (Ctrl+\\)"
      >
        <SplitSquareVertical className="w-4 h-4" />
      </button>
      <button
        onClick={handleSplitHorizontal}
        className={`p-1.5 rounded hover:bg-[#21262d] ${splitDirection === 'horizontal' ? 'text-[#58a6ff]' : 'text-[#8b949e]'}`}
        title="Split Editor Horizontally (Ctrl+Shift+\\)"
      >
        <SplitSquareHorizontal className="w-4 h-4" />
      </button>
      <div className="w-px h-4 bg-[#30363d] mx-1" />
      <button
        onClick={() => setMinimapVisible(!minimapVisible)}
        className={`p-1.5 rounded hover:bg-[#21262d] ${minimapVisible ? 'text-[#58a6ff]' : 'text-[#8b949e]'}`}
        title="Toggle Minimap"
      >
        <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="1" y="1" width="14" height="14" rx="1" />
          <rect x="2" y="2" width="3" height="1" fill="currentColor" opacity="0.5" />
          <rect x="2" y="4" width="4" height="0.5" fill="currentColor" opacity="0.3" />
          <rect x="2" y="5.5" width="2" height="0.5" fill="currentColor" opacity="0.3" />
          <rect x="2" y="7" width="5" height="0.5" fill="currentColor" opacity="0.3" />
          <rect x="2" y="8.5" width="3" height="0.5" fill="currentColor" opacity="0.3" />
          <rect x="2" y="10" width="4" height="0.5" fill="currentColor" opacity="0.3" />
        </svg>
      </button>
    </div>
  );
}

export default EditorGroup;
