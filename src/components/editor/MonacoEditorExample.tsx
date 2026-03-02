'use client';

import React, { useState, useCallback } from 'react';
import { MonacoEditor } from './MonacoEditor';
import { readFile, writeFile } from '@/lib/fileOperations';
import { toast } from 'sonner';

/**
 * Example usage of MonacoEditor component
 * 
 * This demonstrates:
 * - Loading a file from the file system
 * - Editing the file content
 * - Saving with Cmd+S / Ctrl+S
 * - Handling file changes
 */
export function MonacoEditorExample() {
  const [filePath, setFilePath] = useState<string>('');
  const [fileContent, setFileContent] = useState<string>('');
  const [language, setLanguage] = useState<string>('typescript');
  const [isDirty, setIsDirty] = useState<boolean>(false);

  // Load file from file system
  const handleLoadFile = useCallback(async (path: string) => {
    try {
      const file = await readFile(path);
      setFilePath(file.path);
      setFileContent(file.content);
      setLanguage(file.language);
      setIsDirty(false);
      toast.success(`Loaded ${path}`);
    } catch (error) {
      toast.error(`Failed to load file: ${error}`);
    }
  }, []);

  // Handle content change
  const handleContentChange = useCallback((value: string) => {
    setFileContent(value);
    setIsDirty(true);
  }, []);

  // Save file
  const handleSave = useCallback(async () => {
    if (!filePath) {
      toast.error('No file loaded');
      return;
    }

    try {
      await writeFile(filePath, fileContent);
      setIsDirty(false);
      toast.success('File saved successfully');
    } catch (error) {
      toast.error(`Failed to save file: ${error}`);
    }
  }, [filePath, fileContent]);

  return (
    <div className="h-screen flex flex-col bg-[#0d1117]">
      {/* Header */}
      <div className="h-12 bg-[#161b22] border-b border-[#30363d] flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold text-[#c9d1d9]">Monaco Editor Example</h1>
          {filePath && (
            <span className="text-xs text-[#8b949e]">
              {filePath}
              {isDirty && <span className="text-[#f85149] ml-1">●</span>}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleLoadFile('/path/to/file.ts')}
            className="px-3 py-1 bg-[#21262d] hover:bg-[#30363d] rounded text-xs text-[#c9d1d9] transition-colors"
          >
            Load File
          </button>
          <button
            onClick={handleSave}
            disabled={!isDirty}
            className="px-3 py-1 bg-[#238636] hover:bg-[#2ea043] disabled:bg-[#21262d] disabled:text-[#8b949e] rounded text-xs text-white transition-colors"
          >
            Save (Cmd+S)
          </button>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-hidden">
        {filePath ? (
          <MonacoEditor
            value={fileContent}
            language={language}
            onChange={handleContentChange}
            onSave={handleSave}
            path={filePath}
          />
        ) : (
          <div className="h-full flex items-center justify-center text-[#8b949e]">
            <div className="text-center">
              <p className="text-lg mb-2">No file loaded</p>
              <p className="text-xs">Click "Load File" to open a file</p>
            </div>
          </div>
        )}
      </div>

      {/* Status Bar */}
      <div className="h-6 bg-[#161b22] border-t border-[#30363d] flex items-center justify-between px-3 text-xs text-[#8b949e]">
        <div className="flex items-center gap-4">
          <span>Language: {language}</span>
          {isDirty && <span className="text-[#f85149]">● Unsaved changes</span>}
        </div>
        <div className="flex items-center gap-4">
          <span>Press Cmd+S (Mac) or Ctrl+S (Windows/Linux) to save</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Simple example with inline content
 */
export function SimpleMonacoExample() {
  const [code, setCode] = useState(`function hello() {
  console.log("Hello from Monaco Editor!");
  return "Welcome to Kyro IDE";
}

hello();`);

  return (
    <div className="h-96 border border-[#30363d] rounded-lg overflow-hidden">
      <MonacoEditor
        value={code}
        language="typescript"
        onChange={setCode}
      />
    </div>
  );
}

/**
 * Example with multiple files (tabs)
 */
export function MultiFileMonacoExample() {
  const [files, setFiles] = useState([
    { path: 'app.ts', content: 'console.log("App");', language: 'typescript' },
    { path: 'utils.ts', content: 'export function util() {}', language: 'typescript' },
    { path: 'styles.css', content: 'body { margin: 0; }', language: 'css' },
  ]);
  const [activeIndex, setActiveIndex] = useState(0);

  const handleContentChange = useCallback((value: string) => {
    setFiles(prev => prev.map((f, i) => 
      i === activeIndex ? { ...f, content: value } : f
    ));
  }, [activeIndex]);

  const currentFile = files[activeIndex];

  return (
    <div className="h-screen flex flex-col bg-[#0d1117]">
      {/* Tabs */}
      <div className="h-9 bg-[#0d1117] border-b border-[#30363d] flex items-center overflow-x-auto">
        {files.map((file, index) => (
          <button
            key={file.path}
            onClick={() => setActiveIndex(index)}
            className={`h-full px-3 border-r border-[#30363d] text-xs transition-colors ${
              index === activeIndex
                ? 'bg-[#0d1117] text-[#c9d1d9] border-b-2 border-b-[#58a6ff]'
                : 'bg-[#161b22] text-[#8b949e] hover:bg-[#21262d]'
            }`}
          >
            {file.path}
          </button>
        ))}
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-hidden">
        <MonacoEditor
          value={currentFile.content}
          language={currentFile.language}
          onChange={handleContentChange}
          path={currentFile.path}
        />
      </div>
    </div>
  );
}
