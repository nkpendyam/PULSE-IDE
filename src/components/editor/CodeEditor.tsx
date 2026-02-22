'use client';

import React, { useRef } from 'react';
import Editor, { OnMount, OnChange } from '@monaco-editor/react';
import { invoke } from '@tauri-apps/api/core';
import { useKyroStore } from '@/store/kyroStore';

export function CodeEditor() {
  const editorRef = useRef<unknown>(null);
  const { openFiles, activeFileIndex, updateFileContent, setCursorPosition, selectedModel, isAiLoading, addChatMessage, setAiLoading } = useKyroStore();
  const currentFile = activeFileIndex >= 0 ? openFiles[activeFileIndex] : null;
  
  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monaco.editor.defineTheme('kyro-dark', {
      base: 'vs-dark', inherit: true,
      rules: [
        { token: 'comment', foreground: '6A9955', fontStyle: 'italic' },
        { token: 'keyword', foreground: '569CD6' },
        { token: 'string', foreground: 'CE9178' },
      ],
      colors: {
        'editor.background': '#0D1117', 'editor.foreground': '#C9D1D9', 'editor.lineHighlightBackground': '#161B22',
        'editor.selectionBackground': '#264F78', 'editorGutter.background': '#0D1117',
        'editorLineNumber.foreground': '#484F58', 'editorCursor.foreground': '#58A6FF',
      },
    });
    monaco.editor.setTheme('kyro-dark');
    editor.onDidChangeCursorPosition((e) => setCursorPosition(e.position.lineNumber, e.position.column));
    editor.focus();
  };
  
  const handleEditorChange: OnChange = (value) => {
    if (currentFile && value !== undefined) updateFileContent(currentFile.path, value);
  };
  
  if (!currentFile) return null;
  
  return (
    <div className="flex-1 overflow-hidden">
      <Editor height="100%" language={currentFile.language} value={currentFile.content} onChange={handleEditorChange} onMount={handleEditorMount}
        options={{ fontSize: 14, fontFamily: 'JetBrains Mono, Fira Code, monospace', minimap: { enabled: true }, scrollBeyondLastLine: false, wordWrap: 'on', automaticLayout: true, folding: true, bracketPairColorization: { enabled: true }, padding: { top: 16, bottom: 16 } }} />
    </div>
  );
}
