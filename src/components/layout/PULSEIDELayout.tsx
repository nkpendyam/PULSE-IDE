'use client';

import React, { useState, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { Files, Search, GitBranch, Bug, Puzzle, Settings } from 'lucide-react';

// Import components
import { ActivityBar, ActivityBarItem } from '@/components/activitybar/ActivityBar';
import { FileExplorer, FileNode } from '@/components/explorer/FileExplorer';
import { TabSystem, Tab } from '@/components/tabs/TabSystem';
import { StatusBar } from '@/components/statusbar/StatusBar';
import { AIChatPanel, ChatMessage } from '@/components/chat/AIChatPanel';
import { ProblemsPanel, Diagnostic } from '@/components/problems/ProblemsPanel';
import { SearchPanel } from '@/components/search/SearchPanel';
import { Settings } from '@/components/settings/Settings';
import { TerminalPanel } from '@/components/terminal/TerminalPanel';
import { CommandPalette } from '@/components/palette/CommandPalette';
import { NotificationProvider, useNotifications } from '@/components/notifications/NotificationSystem';

// Dynamic import for Monaco Editor (SSR safe)
const CodeEditor = dynamic(
  () => import('@/components/editor/CodeEditor').then((mod) => mod.CodeEditor),
  { ssr: false, loading: () => <EditorLoading /> }
);

const EditorLoading = () => (
  <div className="flex items-center justify-center h-full bg-[#1e1e1e]">
    <div className="text-gray-500">Loading editor...</div>
  </div>
);

// Types
interface OpenFile {
  id: string;
  path: string;
  name: string;
  content: string;
  language: string;
  isDirty: boolean;
}

interface PULSEIDELayoutProps {
  initialFiles?: FileNode[];
  initialOpenFiles?: OpenFile[];
  workspaceName?: string;
}

// Sidebar content based on active view
const SidebarContent: React.FC<{
  activeView: string;
  files: FileNode[];
  onFileSelect: (file: FileNode) => void;
  diagnostics: Diagnostic[];
  onDiagnosticClick: (d: Diagnostic) => void;
}> = ({ activeView, files, onFileSelect, diagnostics, onDiagnosticClick }) => {
  switch (activeView) {
    case 'explorer':
      return (
        <FileExplorer
          files={files}
          onFileSelect={onFileSelect}
          workspaceName="PULSE-IDE"
          className="h-full"
        />
      );
    case 'search':
      return <SearchPanel className="h-full" />;
    case 'git':
      return (
        <div className="flex flex-col h-full bg-[#181818] p-4 text-gray-400">
          <h3 className="text-sm font-semibold mb-4">Source Control</h3>
          <p className="text-sm">Git integration coming soon...</p>
        </div>
      );
    case 'debug':
      return (
        <div className="flex flex-col h-full bg-[#181818] p-4 text-gray-400">
          <h3 className="text-sm font-semibold mb-4">Run and Debug</h3>
          <p className="text-sm">Debugging support coming soon...</p>
        </div>
      );
    case 'extensions':
      return (
        <div className="flex flex-col h-full bg-[#181818] p-4 text-gray-400">
          <h3 className="text-sm font-semibold mb-4">Extensions</h3>
          <p className="text-sm">Extension marketplace coming soon...</p>
        </div>
      );
    case 'problems':
      return (
        <ProblemsPanel
          diagnostics={diagnostics}
          onDiagnosticClick={onDiagnosticClick}
          className="h-full"
        />
      );
    case 'settings':
      return <Settings className="h-full" />;
    default:
      return (
        <FileExplorer
          files={files}
          onFileSelect={onFileSelect}
          workspaceName="PULSE-IDE"
          className="h-full"
        />
      );
  }
};

// Main IDE Layout Component
export const PULSEIDELayout: React.FC<PULSEIDELayoutProps> = ({
  initialFiles = [],
  initialOpenFiles = [],
  workspaceName = 'PULSE-IDE',
}) => {
  // State
  const [activeSidebarView, setActiveSidebarView] = useState('explorer');
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const [isPanelVisible, setIsPanelVisible] = useState(true);
  const [panelHeight, setPanelHeight] = useState(200);
  const [isRightPanelVisible, setIsRightPanelVisible] = useState(true);
  const [rightPanelWidth, setRightPanelWidth] = useState(350);
  const [openFiles, setOpenFiles] = useState<OpenFile[]>(initialOpenFiles);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [files, setFiles] = useState<FileNode[]>(initialFiles);
  const [diagnostics, setDiagnostics] = useState<Diagnostic[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [activePanelTab, setActivePanelTab] = useState<'terminal' | 'problems' | 'output'>('terminal');

  // Activity bar items
  const activityItems: ActivityBarItem[] = [
    { id: 'explorer', icon: Files, label: 'Explorer' },
    { id: 'search', icon: Search, label: 'Search' },
    { id: 'git', icon: GitBranch, label: 'Source Control', badge: 3 },
    { id: 'debug', icon: Bug, label: 'Run and Debug' },
    { id: 'extensions', icon: Puzzle, label: 'Extensions' },
  ];

  const bottomActivityItems: ActivityBarItem[] = [
    { id: 'settings', icon: Settings, label: 'Settings' },
  ];

  // Get active file
  const activeFile = useMemo(() => {
    return openFiles.find((f) => f.id === activeFileId) || null;
  }, [openFiles, activeFileId]);

  // Convert files to tabs
  const tabs: Tab[] = useMemo(() => {
    return openFiles.map((file) => ({
      id: file.id,
      title: file.name,
      path: file.path,
      isDirty: file.isDirty,
      language: file.language,
    }));
  }, [openFiles]);

  // Handle file selection from explorer
  const handleFileSelect = useCallback((file: FileNode) => {
    if (file.type === 'file') {
      const existingFile = openFiles.find((f) => f.path === file.path);
      if (existingFile) {
        setActiveFileId(existingFile.id);
      } else {
        // Open new file
        const newFile: OpenFile = {
          id: `file-${Date.now()}`,
          path: file.path,
          name: file.name,
          content: `// Content of ${file.name}\n// TODO: Load actual file content`,
          language: file.name.split('.').pop() || 'plaintext',
          isDirty: false,
        };
        setOpenFiles((prev) => [...prev, newFile]);
        setActiveFileId(newFile.id);
      }
    }
  }, [openFiles]);

  // Handle tab select
  const handleTabSelect = useCallback((tabId: string) => {
    setActiveFileId(tabId);
  }, []);

  // Handle tab close
  const handleTabClose = useCallback((tabId: string) => {
    setOpenFiles((prev) => {
      const filtered = prev.filter((f) => f.id !== tabId);
      if (activeFileId === tabId && filtered.length > 0) {
        const index = prev.findIndex((f) => f.id === tabId);
        const newActiveFile = filtered[Math.min(index, filtered.length - 1)];
        setActiveFileId(newActiveFile.id);
      } else if (filtered.length === 0) {
        setActiveFileId(null);
      }
      return filtered;
    });
  }, [activeFileId]);

  // Handle content change
  const handleContentChange = useCallback((content: string) => {
    if (!activeFileId) return;
    setOpenFiles((prev) =>
      prev.map((f) =>
        f.id === activeFileId ? { ...f, content, isDirty: true } : f
      )
    );
  }, [activeFileId]);

  // Handle save
  const handleSave = useCallback(() => {
    if (!activeFileId) return;
    setOpenFiles((prev) =>
      prev.map((f) =>
        f.id === activeFileId ? { ...f, isDirty: false } : f
      )
    );
  }, [activeFileId]);

  // Handle chat message
  const handleChatMessage = useCallback((message: string) => {
    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: message,
      timestamp: new Date(),
    };
    setChatMessages((prev) => [...prev, userMessage]);

    // Simulate AI response
    setTimeout(() => {
      const aiMessage: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        content: `I received your message: "${message}"\n\nI'm analyzing your request. In a real implementation, this would connect to the PULSE AI system for intelligent code assistance.`,
        timestamp: new Date(),
        model: 'Llama 3.2',
      };
      setChatMessages((prev) => [...prev, aiMessage]);
    }, 1000);
  }, []);

  // Handle diagnostic click
  const handleDiagnosticClick = useCallback((diagnostic: Diagnostic) => {
    // Find and open the file
    const file = openFiles.find((f) => f.path === diagnostic.file);
    if (file) {
      setActiveFileId(file.id);
    }
  }, [openFiles]);

  // Handle sidebar toggle
  const handleSidebarToggle = useCallback(() => {
    setIsSidebarVisible((prev) => !prev);
  }, []);

  // Handle panel toggle
  const handlePanelToggle = useCallback(() => {
    setIsPanelVisible((prev) => !prev);
  }, []);

  // Handle command palette toggle
  const handleCommandPaletteToggle = useCallback(() => {
    setIsCommandPaletteOpen((prev) => !prev);
  }, []);

  return (
    <NotificationProvider>
      <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#1e1e1e] text-gray-200">
        {/* Title Bar (if needed for desktop app) */}
        {/* <TitleBar /> */}

        {/* Main Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Activity Bar */}
          <ActivityBar
            items={activityItems}
            bottomItems={bottomActivityItems}
            activeItem={activeSidebarView}
            onItemSelect={setActiveSidebarView}
          />

          {/* Sidebar */}
          {isSidebarVisible && (
            <div
              className="flex flex-col bg-[#181818] border-r border-[#3c3c3c]"
              style={{ width: sidebarWidth }}
            >
              <SidebarContent
                activeView={activeSidebarView}
                files={files}
                onFileSelect={handleFileSelect}
                diagnostics={diagnostics}
                onDiagnosticClick={handleDiagnosticClick}
              />
            </div>
          )}

          {/* Main Editor Area */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Tabs */}
            <TabSystem
              tabs={tabs}
              activeTabId={activeFileId || undefined}
              onTabSelect={handleTabSelect}
              onTabClose={handleTabClose}
            />

            {/* Editor + Right Panel */}
            <div className="flex-1 flex overflow-hidden">
              {/* Editor */}
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Code Editor */}
                <div className="flex-1 overflow-hidden">
                  {activeFile ? (
                    <CodeEditor
                      value={activeFile.content}
                      language={activeFile.language}
                      onChange={handleContentChange}
                      onSave={handleSave}
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full bg-[#1e1e1e] text-gray-500">
                      <div className="text-center">
                        <h2 className="text-2xl font-bold mb-2">Kyro IDE</h2>
                        <p className="text-sm">Open a file to start editing</p>
                        <button
                          onClick={handleCommandPaletteToggle}
                          className="mt-4 px-4 py-2 bg-[#007acc] hover:bg-[#1a8cdb] rounded text-white text-sm"
                        >
                          Open Command Palette (Ctrl+Shift+P)
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Bottom Panel */}
                {isPanelVisible && (
                  <div
                    className="border-t border-[#3c3c3c] bg-[#1e1e1e]"
                    style={{ height: panelHeight }}
                  >
                    {/* Panel Tabs */}
                    <div className="flex items-center border-b border-[#3c3c3c]">
                      <button
                        onClick={() => setActivePanelTab('terminal')}
                        className={`px-4 py-1 text-sm ${
                          activePanelTab === 'terminal'
                            ? 'text-white border-b-2 border-[#007acc]'
                            : 'text-gray-400 hover:text-gray-200'
                        }`}
                      >
                        Terminal
                      </button>
                      <button
                        onClick={() => setActivePanelTab('problems')}
                        className={`px-4 py-1 text-sm ${
                          activePanelTab === 'problems'
                            ? 'text-white border-b-2 border-[#007acc]'
                            : 'text-gray-400 hover:text-gray-200'
                        }`}
                      >
                        Problems
                      </button>
                      <button
                        onClick={() => setActivePanelTab('output')}
                        className={`px-4 py-1 text-sm ${
                          activePanelTab === 'output'
                            ? 'text-white border-b-2 border-[#007acc]'
                            : 'text-gray-400 hover:text-gray-200'
                        }`}
                      >
                        Output
                      </button>
                    </div>

                    {/* Panel Content */}
                    <div className="h-[calc(100%-32px)] overflow-hidden">
                      {activePanelTab === 'terminal' && <TerminalPanel />}
                      {activePanelTab === 'problems' && (
                        <ProblemsPanel
                          diagnostics={diagnostics}
                          onDiagnosticClick={handleDiagnosticClick}
                        />
                      )}
                      {activePanelTab === 'output' && (
                        <div className="p-4 text-gray-400 text-sm">
                          Output panel coming soon...
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Right Panel (AI Chat) */}
              {isRightPanelVisible && (
                <div
                  className="border-l border-[#3c3c3c]"
                  style={{ width: rightPanelWidth }}
                >
                  <AIChatPanel
                    messages={chatMessages}
                    onSendMessage={handleChatMessage}
                    className="h-full"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Status Bar */}
        <StatusBar
          line={1}
          column={1}
          language={activeFile?.language || 'TypeScript'}
          gitBranch="main"
          errors={diagnostics.filter((d) => d.severity === 'error').length}
          warnings={diagnostics.filter((d) => d.severity === 'warning').length}
          aiModel="Llama 3.2"
          aiStatus="ready"
          memoryUsage={256}
          cpuUsage={12}
        />

        {/* Command Palette */}
        {isCommandPaletteOpen && (
          <CommandPalette
            onClose={() => setIsCommandPaletteOpen(false)}
            onExecute={(command) => {
              setIsCommandPaletteOpen(false);
              // Handle command execution
            }}
          />
        )}
      </div>
    </NotificationProvider>
  );
};

export default PULSEIDELayout;
