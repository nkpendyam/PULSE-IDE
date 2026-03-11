'use client';

import React, { useState, useCallback, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { useKyroStore, FileNode, OpenFile } from '@/store/kyroStore';
import { AgentManagerPanel } from '@/components/agent-manager/AgentManagerPanel';
import { FileTree } from '@/components/sidebar/FileTree';
import { TabBar } from '@/components/tabs/TabBar';
import { StatusBar } from '@/components/statusbar/StatusBar';
import { AIChatSidebar } from '@/components/chat/AIChatSidebar';
import { GlobalSearch } from '@/components/search/GlobalSearch';
import { GitStagingPanel } from '@/components/git/GitStagingPanel';
import { DebugPanel } from '@/components/debug/DebugPanel';
import { SettingsPanel } from '@/components/settings/SettingsPanel';
import { TerminalPanel } from '@/components/terminal/TerminalPanel';
import { CommandPalette } from '@/components/palette/CommandPalette';
import {
  Files,
  Search,
  GitBranch,
  Bug,
  Rocket,
  Settings,
  ChevronDown,
  Folder,
  Bot,
  Code2,
  Layout,
  Blocks,
} from 'lucide-react';

// Tauri invoke for AI commands
declare global {
  interface Window {
    __TAURI__?: {
      core: {
        invoke: <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;
      };
    };
  }
}

// Helper to invoke Tauri commands with fallback
async function invokeTauri<T>(cmd: string, args?: Record<string, unknown>): Promise<T | null> {
  if (typeof window !== 'undefined' && window.__TAURI__) {
    try {
      return await window.__TAURI__.core.invoke<T>(cmd, args);
    } catch (error) {
      console.error(`Tauri command ${cmd} failed:`, error);
      return null;
    }
  }
  return null;
}

// Types for AI responses
type SidebarPanel = 'explorer' | 'search' | 'git' | 'debug' | 'mission' | 'settings' | 'extensions';

// Mock file tree data (for demo mode when Tauri is not available)
const mockFileTree: FileNode = {
  name: 'kyro-project',
  path: '/kyro-project',
  is_directory: true,
  children: [
    {
      name: 'src',
      path: '/kyro-project/src',
      is_directory: true,
      children: [
        {
          name: 'components',
          path: '/kyro-project/src/components',
          is_directory: true,
          children: [
            { name: 'Button.tsx', path: '/kyro-project/src/components/Button.tsx', is_directory: false, extension: 'tsx' },
            { name: 'Card.tsx', path: '/kyro-project/src/components/Card.tsx', is_directory: false, extension: 'tsx' },
          ]
        },
        { name: 'App.tsx', path: '/kyro-project/src/App.tsx', is_directory: false, extension: 'tsx' },
      ]
    },
    { name: 'package.json', path: '/kyro-project/package.json', is_directory: false, extension: 'json' },
  ]
};

// Sample file contents
const sampleFileContents: Record<string, string> = {
  '/kyro-project/src/App.tsx': `import React from 'react';

export function App() {
  const [count, setCount] = React.useState(0);
  return (
    <div className="app">
      <h1>Welcome to Kyro IDE</h1>
      <button onClick={() => setCount(c => c + 1)}>
        Clicked {count} times
      </button>
    </div>
  );
}`,
  '/kyro-project/src/components/Button.tsx': `import React from 'react';

interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
}

export function Button({ children, onClick }: ButtonProps) {
  return (
    <button
      className="px-4 py-2 bg-blue-500 text-white rounded"
      onClick={onClick}
    >
      {children}
    </button>
  );
}`,
};

// Main IDE Page
export default function Home() {
  const [viewMode, setViewMode] = useState<'editor' | 'mission'>('editor');
  const [activePanel, setActivePanel] = useState<SidebarPanel>('explorer');
  const [showChat, setShowChat] = useState(true);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [fileTreeKey, setFileTreeKey] = useState(0);

  const {
    openFiles,
    activeFileIndex,
    setFileTree,
    openFile,
    setEditorContent,
    setCursorPosition,
    setGitStatus
  } = useKyroStore();

  // Initialize mock data
  React.useEffect(() => {
    setFileTree(mockFileTree);
    setGitStatus({
      branch: 'main',
      ahead: 2,
      behind: 0,
      staged: [{ path: 'src/App.tsx', status: 'modified' }],
      unstaged: [],
      untracked: []
    });
  }, [setFileTree, setGitStatus]);

  const currentFile = activeFileIndex >= 0 ? openFiles[activeFileIndex] : null;

  const handleSaveFile = useCallback(async () => {
    if (!currentFile) return;

    try {
      if (typeof window !== 'undefined' && window.__TAURI__) {
        await window.__TAURI__.core.invoke('write_file', {
          path: currentFile.path,
          content: currentFile.content
        });
        console.log('File saved successfully:', currentFile.path);
      }
    } catch (error) {
      console.error('Failed to save file:', error);
    }
  }, [currentFile]);

  // Setup global keyboard shortcuts
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+S (Mac) / Ctrl+S (Windows/Linux) - Save file
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSaveFile();
      }
      // Cmd+Shift+P / Ctrl+Shift+P - Command Palette
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'P') {
        e.preventDefault();
        setShowCommandPalette(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSaveFile]);

  const refreshFileTree = useCallback(() => {
    // Force re-render of file tree by updating key
    setFileTreeKey(prev => prev + 1);
    // In a real app, this would reload the file tree from Tauri
    // await invoke('get_file_tree', { path: projectPath });
  }, []);

  const handleFileClick = useCallback(async (path: string) => {
    try {
      // Try to load file from Tauri
      if (typeof window !== 'undefined' && window.__TAURI__) {
        const fileContent = await window.__TAURI__.core.invoke<{ path: string; content: string; language: string }>('read_file', { path });
        
        const file: OpenFile = {
          path: fileContent.path,
          content: fileContent.content,
          language: fileContent.language,
          isDirty: false
        };
        
        openFile(file);
      } else {
        // Fallback to mock data
        const content = sampleFileContents[path] || '// File content would be loaded here';
        const ext = path.split('.').pop()?.toLowerCase() || 'txt';
        const languageMap: Record<string, string> = {
          'ts': 'typescript',
          'tsx': 'typescript',
          'js': 'javascript',
          'json': 'json',
          'md': 'markdown',
        };

        const file: OpenFile = {
          path,
          content,
          language: languageMap[ext] || 'plaintext',
          isDirty: false
        };

        openFile(file);
      }
    } catch (error) {
      console.error('Failed to load file:', error);
      // Fallback to mock data on error
      const content = sampleFileContents[path] || '// File content would be loaded here';
      const ext = path.split('.').pop()?.toLowerCase() || 'txt';
      const languageMap: Record<string, string> = {
        'ts': 'typescript',
        'tsx': 'typescript',
        'js': 'javascript',
        'json': 'json',
        'md': 'markdown',
      };

      const file: OpenFile = {
        path,
        content,
        language: languageMap[ext] || 'plaintext',
        isDirty: false
      };

      openFile(file);
    }
  }, [openFile]);

  const handleEditorChange = useCallback((value: string | undefined) => {
    if (value !== undefined) {
      setEditorContent(value);
    }
  }, [setEditorContent]);

  const handleEditorMount = useCallback((editor: unknown) => {
    const monacoEditor = editor as {
      onDidChangeCursorPosition: (callback: (e: { position: { lineNumber: number; column: number } }) => void) => void;
    };
    monacoEditor.onDidChangeCursorPosition((e) => {
      setCursorPosition(e.position.lineNumber, e.position.column);
    });
  }, [setCursorPosition]);

  return (
    <div className="h-screen flex flex-col bg-[#0d1117] text-[#c9d1d9] overflow-hidden">
      {/* Command Palette (Ctrl+Shift+P) */}
      <CommandPalette isOpen={showCommandPalette} onClose={() => setShowCommandPalette(false)} />

      {/* Header with View Toggle */}
      <div className="h-10 bg-[#161b22] border-b border-[#30363d] flex items-center justify-between px-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold bg-linear-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
            Kyro IDE
          </span>
          <span className="text-xs text-[#8b949e]">/ kyro-project</span>
        </div>

        <div className="flex items-center gap-2 bg-[#0d1117] rounded-lg p-1">
          <button
            onClick={() => setViewMode('editor')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs transition-colors ${viewMode === 'editor' ? 'bg-[#21262d] text-[#c9d1d9]' : 'text-[#8b949e] hover:text-[#c9d1d9]'}`}
          >
            <Code2 size={14} /> Editor
          </button>
          <button
            onClick={() => setViewMode('mission')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs transition-colors ${viewMode === 'mission' ? 'bg-[#21262d] text-[#c9d1d9]' : 'text-[#8b949e] hover:text-[#c9d1d9]'}`}
          >
            <Rocket size={14} /> Mission Control
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowChat(!showChat)}
            className={`p-1.5 rounded transition-colors ${showChat ? 'bg-[#21262d] text-[#c9d1d9]' : 'text-[#8b949e] hover:text-[#c9d1d9]'}`}
            title="Toggle AI Chat"
          >
            <Bot size={16} />
          </button>
        </div>
      </div>

      {/* Main Content */}
      {viewMode === 'mission' ? (
        <div className="flex-1 overflow-hidden">
          <AgentManagerPanel />
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden">
          {/* Activity Bar */}
          <div className="w-12 bg-[#0d1117] border-r border-[#30363d] flex flex-col items-center py-2">
            {[
              { id: 'explorer' as SidebarPanel, icon: Files, label: 'Explorer' },
              { id: 'search' as SidebarPanel, icon: Search, label: 'Search' },
              { id: 'git' as SidebarPanel, icon: GitBranch, label: 'Source Control' },
              { id: 'debug' as SidebarPanel, icon: Bug, label: 'Debug' },
              { id: 'extensions' as SidebarPanel, icon: Blocks, label: 'Extensions' },
              { id: 'mission' as SidebarPanel, icon: Rocket, label: 'Mission Control' },
            ].map((item) => {
              const Icon = item.icon;
              const isActive = activePanel === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    if (item.id === 'mission') {
                      setViewMode('mission');
                    } else {
                      setActivePanel(item.id);
                    }
                  }}
                  className={`w-10 h-10 flex items-center justify-center rounded mb-1 transition-colors relative ${isActive ? 'text-[#c9d1d9] after:absolute after:right-0 after:top-1/2 after:-translate-y-1/2 after:w-0.5 after:h-6 after:bg-[#58a6ff] after:rounded-l' : 'text-[#8b949e] hover:text-[#c9d1d9]'}`}
                  title={item.label}
                >
                  <Icon size={20} />
                </button>
              );
            })}
            <div className="flex-1" />
            <button
              onClick={() => setActivePanel('settings')}
              className={`w-10 h-10 flex items-center justify-center rounded text-[#8b949e] hover:text-[#c9d1d9] ${activePanel === 'settings' ? 'text-[#c9d1d9]' : ''}`}
              title="Settings"
            >
              <Settings size={20} />
            </button>
          </div>

          {/* Sidebar */}
          <div className="w-60 bg-[#0d1117] border-r border-[#30363d] flex flex-col">
            <div className="h-9 bg-[#161b22] border-b border-[#30363d] flex items-center px-3">
              <span className="text-xs font-medium uppercase tracking-wide text-[#8b949e]">
                {activePanel === 'explorer' && 'Explorer'}
                {activePanel === 'search' && 'Search'}
                {activePanel === 'git' && 'Source Control'}
                {activePanel === 'debug' && 'Debug'}
                {activePanel === 'extensions' && 'Extensions'}
                {activePanel === 'settings' && 'Settings'}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto">
              {activePanel === 'explorer' && (
                <div className="py-1">
                  <div className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-[#8b949e]">
                    <ChevronDown size={12} />
                    <Folder size={12} className="text-[#54aeff]" />
                    <span>KYRO-PROJECT</span>
                  </div>
                  {mockFileTree.children?.map((child) => (
                    <FileTree 
                      key={`${child.path}-${fileTreeKey}`} 
                      node={child} 
                      level={0} 
                      onFileClick={handleFileClick}
                      onRefresh={refreshFileTree}
                    />
                  ))}
                </div>
              )}
              {activePanel === 'search' && (
                <GlobalSearch isOpen={true} onClose={() => setActivePanel('explorer')} />
              )}
              {activePanel === 'git' && (
                <GitStagingPanel projectPath="/kyro-project" onFileSelect={handleFileClick} />
              )}
              {activePanel === 'debug' && (
                <DebugPanel />
              )}
              {activePanel === 'extensions' && (
                <div className="p-2 text-xs text-[#8b949e]">
                  <p className="mb-2">Search and manage extensions</p>
                  <p>Use the Extensions panel for full marketplace</p>
                </div>
              )}
              {activePanel === 'settings' && (
                <SettingsPanel />
              )}
            </div>
          </div>

          {/* Main Editor Area */}
          <div className="flex-1 flex flex-col min-w-0">
            <TabBar />
            <div className="flex-1 flex overflow-hidden">
              <div className="flex-1 relative">
                {currentFile ? (
                  <Editor
                    height="100%"
                    language={currentFile.language}
                    value={currentFile.content}
                    theme="vs-dark"
                    onChange={handleEditorChange}
                    onMount={handleEditorMount}
                    options={{
                      fontSize: 14,
                      fontFamily: 'JetBrains Mono, Fira Code, monospace',
                      minimap: { enabled: true },
                      scrollBeyondLastLine: false,
                      wordWrap: 'on',
                      automaticLayout: true,
                      tabSize: 2,
                      lineNumbers: 'on',
                    }}
                  />
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-[#8b949e]">
                    <Layout size={48} className="mb-4 opacity-50" />
                    <p className="text-lg mb-2">No file open</p>
                    <p className="text-xs">Select a file from the explorer</p>
                  </div>
                )}
              </div>

              {/* AI Chat Sidebar */}
              {showChat && (
                <div className="w-80 border-l border-[#30363d] flex flex-col">
                  <AIChatSidebar />
                </div>
              )}
            </div>

            {/* Terminal Panel */}
            <div className="h-40 border-t border-[#30363d]">
              <TerminalPanel />
            </div>
          </div>
        </div>
      )}

      {/* Status Bar */}
      <StatusBar />
    </div>
  );
}
