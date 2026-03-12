'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
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
import { AuthModal } from '@/components/auth/AuthModal';
import { CollaborationPanel } from '@/components/collaboration/CollaborationPanel';
import ExtensionMarketplace from '@/components/extensions/UnifiedMarketplace';
import { FirstRunExperience } from '@/components/onboarding/FirstRunExperience';
import { Breadcrumbs } from '@/components/navigation/Breadcrumbs';
import { UpdatePanel } from '@/components/update/UpdatePanel';
import { PluginManager } from '@/components/plugins/PluginManager';
import { RagPanel } from '@/components/rag/RagPanel';
import { LspPanel } from '@/components/lsp/LspPanel';
import { HardwareInfoPanel } from '@/components/llm/HardwareInfoPanel';
import { SymbolOutline } from '@/components/sidebar/SymbolOutline';
import { AgentStreamPanel } from '@/components/agents/AgentStreamPanel';
import { TestRunnerPanel } from '@/components/testing/TestRunnerPanel';
import { BrowserPreview } from '@/components/browser/BrowserPreview';
import { SymbolSearch } from '@/components/search/SymbolSearch';
import { DiffViewer } from '@/components/git/DiffViewer';
import { InlineChat } from '@/components/chat/InlineChat';
import { ModelSelector } from '@/components/chat/ModelSelector';
import { TerminalAI } from '@/components/terminal/TerminalAI';
import { ProjectRules } from '@/components/settings/ProjectRules';
import { useEditPrediction } from '@/components/editor/EditPredictionProvider';
import { AgentAutopilotPanel } from '@/components/agents/AgentAutopilotPanel';
import { ConversationCheckpoints, Checkpoint } from '@/components/chat/ConversationCheckpoints';
import { RemoteDevContainers } from '@/components/remote/RemoteDevContainers';
import { KeybindingManager } from '@/lib/keybindings';
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
  Users,
  Puzzle,
  Database,
  Cpu,
  Download,
  FileCode,
  User,
  PlayCircle,
  Globe,
  Zap,
  BookOpen,
  Shield,
  Monitor,
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
type SidebarPanel = 'explorer' | 'search' | 'git' | 'debug' | 'mission' | 'settings' | 'extensions' | 'collaboration' | 'plugins' | 'rag' | 'lsp' | 'llm' | 'update' | 'symbols' | 'agent-stream' | 'testing' | 'browser' | 'rules' | 'autopilot' | 'remote';

// Fallback file tree (used when Tauri is not available)
const fallbackFileTree: FileNode = {
  name: 'kyro-project',
  path: '/kyro-project',
  is_directory: true,
  children: [
    {
      name: 'src',
      path: '/kyro-project/src',
      is_directory: true,
      children: [
        { name: 'App.tsx', path: '/kyro-project/src/App.tsx', is_directory: false, extension: 'tsx' },
      ]
    },
    { name: 'package.json', path: '/kyro-project/package.json', is_directory: false, extension: 'json' },
  ]
};

// Main IDE Page
export default function Home() {
  const [viewMode, setViewMode] = useState<'editor' | 'mission'>('editor');
  const [activePanel, setActivePanel] = useState<SidebarPanel>('explorer');
  const [showChat, setShowChat] = useState(true);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [fileTreeKey, setFileTreeKey] = useState(0);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showFirstRun, setShowFirstRun] = useState(false);
  const [showSymbolSearch, setShowSymbolSearch] = useState(false);
  const [showInlineChat, setShowInlineChat] = useState(false);
  const [showDiffViewer, setShowDiffViewer] = useState(false);
  const [diffFile, setDiffFile] = useState<string>('');
  const editorRef = useRef<unknown>(null);
  const monacoRef = useRef<typeof import('monaco-editor') | null>(null);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);

  const {
    openFiles,
    activeFileIndex,
    setFileTree,
    openFile,
    setEditorContent,
    setCursorPosition,
    setGitStatus,
    autopilotMode,
    setAutopilotMode,
    isAgentRunning,
    setAgentRunning,
    chatMessages,
  } = useKyroStore();

  // Initialize: try Tauri file tree, fall back to mock data
  React.useEffect(() => {
    async function loadInitialTree() {
      if (typeof window !== 'undefined' && window.__TAURI__) {
        try {
          const tree = await window.__TAURI__.core.invoke<FileNode>('get_file_tree', { path: '.', maxDepth: 5 });
          setFileTree(tree);
          return;
        } catch {
          // Tauri not available, use mock
        }
      }
      setFileTree(fallbackFileTree);
    }
    loadInitialTree();

    // Try loading git status from Tauri
    if (typeof window !== 'undefined' && window.__TAURI__) {
      window.__TAURI__.core.invoke<{ branch: string; ahead: number; behind: number; staged: { path: string; status: string }[]; unstaged: { path: string; status: string }[]; untracked: string[] }>('git_status', { path: '.' })
        .then(status => setGitStatus(status))
        .catch(() => { /* Tauri not available */ });
    }

    // Check first run
    if (typeof window !== 'undefined' && !localStorage.getItem('kyro-first-run-done')) {
      setShowFirstRun(true);
    }
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
      }
    } catch (error) {
      console.error('Failed to save file:', error);
    }
  }, [currentFile]);

  // Setup global keyboard shortcuts via KeybindingManager
  React.useEffect(() => {
    const km = new KeybindingManager();

    const commandHandlers: Record<string, () => void> = {
      'workbench.action.files.save': handleSaveFile,
      'workbench.action.showCommands': () => setShowCommandPalette(prev => !prev),
      'workbench.action.toggleSidebarVisibility': () => setShowChat(prev => !prev),
      'workbench.action.showAllSymbols': () => setShowSymbolSearch(prev => !prev),
      'editor.action.inlineChat': () => setShowInlineChat(prev => !prev),
      'workbench.view.explorer': () => setActivePanel('explorer'),
      'workbench.view.scm': () => setActivePanel('git'),
      'workbench.view.debug': () => setActivePanel('debug'),
      'workbench.view.extensions': () => setActivePanel('extensions'),
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const command = km.findMatchingCommand(e);
      if (command && commandHandlers[command]) {
        e.preventDefault();
        commandHandlers[command]();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSaveFile]);

  // Listen for navigation events from CommandPalette
  React.useEffect(() => {
    const handleNavigate = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.panel) {
        setActivePanel(detail.panel as SidebarPanel);
      }
    };
    window.addEventListener('kyro:navigate', handleNavigate);
    return () => window.removeEventListener('kyro:navigate', handleNavigate);
  }, []);

  const refreshFileTree = useCallback(async () => {
    setFileTreeKey(prev => prev + 1);
    if (typeof window !== 'undefined' && window.__TAURI__) {
      try {
        const tree = await window.__TAURI__.core.invoke<FileNode>('get_file_tree', { path: '.', maxDepth: 5 });
        setFileTree(tree);
      } catch {
        // Tauri unavailable, keep existing tree
      }
    }
  }, [setFileTree]);

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
        // Fallback when Tauri is not available
        const content = '// Open this project in Kyro IDE desktop for full file access';
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
      const content = '// Failed to load file — check console for details';
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

  const handleEditorMount = useCallback((editor: unknown, monaco: unknown) => {
    editorRef.current = editor;
    monacoRef.current = monaco as typeof import('monaco-editor');
    const monacoEditor = editor as {
      onDidChangeCursorPosition: (callback: (e: { position: { lineNumber: number; column: number } }) => void) => void;
    };
    monacoEditor.onDidChangeCursorPosition((e) => {
      setCursorPosition(e.position.lineNumber, e.position.column);
    });
  }, [setCursorPosition]);

  // Edit Prediction hook — predicts next edit location and provides Tab-to-accept
  const { acceptPrediction } = useEditPrediction(
    editorRef.current as import('monaco-editor').editor.IStandaloneCodeEditor | null,
    monacoRef.current,
    currentFile?.path || '',
    true
  );

  // Checkpoint management
  const handleCreateCheckpoint = useCallback((label?: string) => {
    const snapshot = new Map<string, string>();
    openFiles.forEach(f => snapshot.set(f.path, f.content));
    const cp: Checkpoint = {
      id: `cp-${Date.now()}`,
      label: label || `Checkpoint ${checkpoints.length + 1}`,
      timestamp: Date.now(),
      messageIndex: chatMessages.length,
      fileSnapshots: snapshot,
      description: `${openFiles.length} files`,
      isAutomatic: !label,
    };
    setCheckpoints(prev => [...prev, cp]);
  }, [openFiles, chatMessages.length, checkpoints.length]);

  const handleRestoreCheckpoint = useCallback((id: string) => {
    const cp = checkpoints.find(c => c.id === id);
    if (cp) {
      cp.fileSnapshots.forEach((content, path) => {
        const existing = openFiles.find(f => f.path === path);
        if (existing) {
          setEditorContent(content);
        }
      });
    }
  }, [checkpoints, openFiles, setEditorContent]);

  const handleDeleteCheckpoint = useCallback((id: string) => {
    setCheckpoints(prev => prev.filter(c => c.id !== id));
  }, []);

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
            onClick={() => setShowAuthModal(true)}
            className="p-1.5 rounded transition-colors text-[#8b949e] hover:text-[#c9d1d9]"
            title="Account"
          >
            <User size={16} />
          </button>
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
              { id: 'collaboration' as SidebarPanel, icon: Users, label: 'Collaboration' },
              { id: 'plugins' as SidebarPanel, icon: Puzzle, label: 'Plugins' },
              { id: 'rag' as SidebarPanel, icon: Database, label: 'RAG Search' },
              { id: 'lsp' as SidebarPanel, icon: FileCode, label: 'Language Server' },
              { id: 'llm' as SidebarPanel, icon: Cpu, label: 'LLM / Hardware' },
              { id: 'update' as SidebarPanel, icon: Download, label: 'Updates' },
              { id: 'symbols' as SidebarPanel, icon: Code2, label: 'Symbol Outline' },
              { id: 'agent-stream' as SidebarPanel, icon: Zap, label: 'Agent Stream' },
              { id: 'testing' as SidebarPanel, icon: PlayCircle, label: 'Test Runner' },
              { id: 'browser' as SidebarPanel, icon: Globe, label: 'Browser Preview' },
              { id: 'rules' as SidebarPanel, icon: BookOpen, label: 'Project Rules' },
              { id: 'autopilot' as SidebarPanel, icon: Shield, label: 'Agent Autopilot' },
              { id: 'remote' as SidebarPanel, icon: Monitor, label: 'Remote / Containers' },
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
                {activePanel === 'collaboration' && 'Collaboration'}
                {activePanel === 'plugins' && 'Plugins'}
                {activePanel === 'rag' && 'RAG Search'}
                {activePanel === 'lsp' && 'Language Server'}
                {activePanel === 'llm' && 'LLM / Hardware'}
                {activePanel === 'update' && 'Updates'}
                {activePanel === 'symbols' && 'Symbol Outline'}
                {activePanel === 'agent-stream' && 'Agent Stream'}
                {activePanel === 'testing' && 'Test Runner'}
                {activePanel === 'browser' && 'Browser Preview'}
                {activePanel === 'rules' && 'Project Rules'}
                {activePanel === 'autopilot' && 'Agent Autopilot'}
                {activePanel === 'remote' && 'Remote / Containers'}
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
                  {fallbackFileTree.children?.map((child) => (
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
                <ExtensionMarketplace />
              )}
              {activePanel === 'settings' && (
                <SettingsPanel />
              )}
              {activePanel === 'collaboration' && (
                <CollaborationPanel />
              )}
              {activePanel === 'plugins' && (
                <PluginManager />
              )}
              {activePanel === 'rag' && (
                <RagPanel />
              )}
              {activePanel === 'lsp' && (
                <LspPanel />
              )}
              {activePanel === 'llm' && (
                <HardwareInfoPanel />
              )}
              {activePanel === 'update' && (
                <UpdatePanel />
              )}
              {activePanel === 'symbols' && (
                <SymbolOutline />
              )}
              {activePanel === 'agent-stream' && (
                <AgentStreamPanel />
              )}
              {activePanel === 'testing' && (
                <TestRunnerPanel />
              )}
              {activePanel === 'browser' && (
                <BrowserPreview />
              )}
              {activePanel === 'rules' && (
                <ProjectRules projectPath={useKyroStore.getState().projectPath} />
              )}
              {activePanel === 'autopilot' && (
                <AgentAutopilotPanel
                  permissionLevel={autopilotMode}
                  onPermissionChange={setAutopilotMode}
                  isRunning={isAgentRunning}
                  onToggleRunning={() => setAgentRunning(!isAgentRunning)}
                />
              )}
              {activePanel === 'remote' && (
                <RemoteDevContainers projectPath={useKyroStore.getState().projectPath || '.'} />
              )}
            </div>
          </div>

          {/* Main Editor Area */}
          <div className="flex-1 flex flex-col min-w-0">
            <TabBar />
            {currentFile && <Breadcrumbs />}
            <div className="flex-1 flex overflow-hidden">
              <div className="flex-1 relative">
                {currentFile ? (
                  <Editor
                    height="100%"
                    language={currentFile.language}
                    value={currentFile.content}
                    theme="vs-dark"
                    onChange={handleEditorChange}
                    onMount={(editor, monaco) => {
                      handleEditorMount(editor, monaco);
                    }}
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
                    <p className="text-xs">Select a file from the explorer or press Ctrl+P</p>
                  </div>
                )}
                {/* Inline Chat Overlay */}
                <InlineChat
                  isOpen={showInlineChat}
                  onClose={() => setShowInlineChat(false)}
                  position={null}
                  selection={null}
                  onAccept={(newText) => {
                    if (currentFile) setEditorContent(newText);
                    setShowInlineChat(false);
                  }}
                  onReject={() => setShowInlineChat(false)}
                />
              </div>

              {/* AI Chat Sidebar */}
              {showChat && (
                <div className="w-80 border-l border-[#30363d] flex flex-col">
                  <div className="flex items-center justify-between px-3 py-1.5 bg-[#161b22] border-b border-[#30363d]">
                    <span className="text-xs font-medium text-[#8b949e]">AI Chat</span>
                    <ModelSelector />
                  </div>
                  <ConversationCheckpoints
                    checkpoints={checkpoints}
                    onCreateCheckpoint={handleCreateCheckpoint}
                    onRestoreCheckpoint={handleRestoreCheckpoint}
                    onDeleteCheckpoint={handleDeleteCheckpoint}
                    currentMessageIndex={chatMessages.length}
                  />
                  <AIChatSidebar />
                </div>
              )}
            </div>

            {/* Terminal Panel */}
            <div className="h-40 border-t border-[#30363d]">
              <TerminalAI
                terminalOutput={useKyroStore.getState().terminalOutput}
                onSendToChat={(msg) => {
                  useKyroStore.getState().addChatMessage({
                    id: `msg-${Date.now()}`,
                    role: 'user',
                    content: msg,
                    timestamp: new Date(),
                  });
                }}
              />
              <TerminalPanel />
            </div>
          </div>
        </div>
      )}

      {/* Status Bar */}
      <StatusBar />

      {/* Modals */}
      {showAuthModal && (
        <AuthModal onClose={() => setShowAuthModal(false)} />
      )}
      {showFirstRun && (
        <FirstRunExperience onComplete={() => {
          setShowFirstRun(false);
          if (typeof window !== 'undefined') {
            localStorage.setItem('kyro-first-run-done', 'true');
          }
        }} />
      )}
      {showSymbolSearch && (
        <SymbolSearch isOpen={showSymbolSearch} onClose={() => setShowSymbolSearch(false)} />
      )}
      {showDiffViewer && (
        <DiffViewer filePath={diffFile} mode="inline" />
      )}
    </div>
  );
}
