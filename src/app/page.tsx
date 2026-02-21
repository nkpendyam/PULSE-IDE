'use client';

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  ResizablePanelGroup, 
  ResizablePanel, 
  ResizableHandle 
} from '@/components/ui/resizable';
import { 
  Code2, Files, Search, GitBranch, Settings, Terminal, MessageSquare, 
  Bot, Play, Send, Sparkles, Zap, Brain, Shield, Wrench, FileCode,
  Folder, FolderOpen, ChevronRight, ChevronDown, Plus, X,
  PanelLeftClose, PanelLeft, PanelBottomClose, AlertCircle, CheckCircle,
  Crown, Clock, Home
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Agent } from '@/types/ide';
import { AGENT_DEFINITIONS } from '@/lib/pulse/ide/agents';
import { MODEL_DEFINITIONS } from '@/lib/pulse/ide/models';

// Import components
import CodeEditor from '@/components/editor/CodeEditor';
import CommandPalette from '@/components/palette/CommandPalette';
import TerminalManager from '@/components/terminal/TerminalManager';
import SettingsPanel from '@/components/settings/Settings';
import SearchPanel from '@/components/search/SearchPanel';
import PremiumFeaturesPanel from '@/components/premium/PremiumFeaturesPanel';
import TabSystem, { Tab } from '@/components/tabs/TabSystem';
import RecentFiles, { RecentFile } from '@/components/explorer/RecentFiles';
import WorkspacePanel, { WorkspaceSettings, WorkspaceInfo } from '@/components/workspace/WorkspacePanel';
import GitPanel from '@/components/git/GitPanel';

// ============================================================================
// FILE EXPLORER COMPONENT
// ============================================================================

interface FileNode {
  name: string;
  type: 'file' | 'folder';
  path: string;
  children?: FileNode[];
  isOpen?: boolean;
}

const sampleFileTree: FileNode[] = [
  {
    name: 'src',
    type: 'folder',
    path: '/src',
    isOpen: true,
    children: [
      {
        name: 'components',
        type: 'folder',
        path: '/src/components',
        children: [
          { name: 'Button.tsx', type: 'file', path: '/src/components/Button.tsx' },
          { name: 'Card.tsx', type: 'file', path: '/src/components/Card.tsx' },
          { name: 'Input.tsx', type: 'file', path: '/src/components/Input.tsx' },
        ]
      },
      {
        name: 'lib',
        type: 'folder',
        path: '/src/lib',
        children: [
          { name: 'utils.ts', type: 'file', path: '/src/lib/utils.ts' },
          { name: 'api.ts', type: 'file', path: '/src/lib/api.ts' },
        ]
      },
      { name: 'app.tsx', type: 'file', path: '/src/app.tsx' },
    ]
  },
  { name: 'package.json', type: 'file', path: '/package.json' },
  { name: 'tsconfig.json', type: 'file', path: '/tsconfig.json' },
  { name: 'README.md', type: 'file', path: '/README.md' },
];

function FileExplorer({ 
  files, 
  onFileSelect, 
  selectedFile,
  onFileToggle 
}: { 
  files: FileNode[];
  onFileSelect: (file: FileNode) => void;
  selectedFile: string | null;
  onFileToggle: (path: string) => void;
}) {
  const renderNode = (node: FileNode, depth: number = 0) => {
    const isSelected = selectedFile === node.path;
    const isFolder = node.type === 'folder';

    return (
      <div key={node.path}>
        <div
          className={cn(
            'flex items-center gap-1 py-1 px-2 cursor-pointer hover:bg-accent/50 rounded-sm text-sm',
            isSelected && 'bg-accent text-accent-foreground',
            'transition-colors'
          )}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
          onClick={() => {
            if (isFolder) {
              onFileToggle(node.path);
            } else {
              onFileSelect(node);
            }
          }}
        >
          {isFolder ? (
            <>
              {node.isOpen ? (
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-3 w-3 text-muted-foreground" />
              )}
              {node.isOpen ? (
                <FolderOpen className="h-4 w-4 text-yellow-500" />
              ) : (
                <Folder className="h-4 w-4 text-yellow-500" />
              )}
            </>
          ) : (
            <>
              <span className="w-3" />
              <FileCode className="h-4 w-4 text-blue-400" />
            </>
          )}
          <span className="truncate">{node.name}</span>
        </div>
        {isFolder && node.isOpen && node.children && (
          <div>
            {node.children.map(child => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Explorer
        </span>
        <Button variant="ghost" size="icon" className="h-5 w-5">
          <Plus className="h-3 w-3" />
        </Button>
      </div>
      <ScrollArea className="h-[calc(100%-40px)]">
        <div className="py-1">{files.map(file => renderNode(file))}</div>
      </ScrollArea>
    </div>
  );
}

// ============================================================================
// AGENT SIDEBAR COMPONENT
// ============================================================================

function AgentSidebar({ 
  agents, 
  selectedAgent, 
  onAgentSelect 
}: { 
  agents: Agent[];
  selectedAgent: string | null;
  onAgentSelect: (id: string) => void;
}) {
  return (
    <div className="h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          AI Agents
        </span>
        <Badge variant="secondary" className="text-[10px]">
          {agents.filter(a => a.isActive).length} Active
        </Badge>
      </div>
      <ScrollArea className="h-[calc(100%-40px)]">
        <div className="p-2 space-y-1">
          {agents.map(agent => (
            <button
              key={agent.id}
              onClick={() => onAgentSelect(agent.id)}
              className={cn(
                'w-full flex items-center gap-2 p-2 rounded-lg text-left transition-colors',
                selectedAgent === agent.id 
                  ? 'bg-primary/10 border border-primary/20' 
                  : 'hover:bg-accent/50'
              )}
            >
              <span className="text-xl">{agent.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">{agent.name}</span>
                  <span className={cn(
                    'w-2 h-2 rounded-full',
                    agent.status === 'idle' ? 'bg-green-500' :
                    agent.status === 'thinking' ? 'bg-yellow-500 animate-pulse' :
                    'bg-gray-400'
                  )} />
                </div>
                <p className="text-[10px] text-muted-foreground truncate capitalize">
                  {agent.role}
                </p>
              </div>
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

// ============================================================================
// PROBLEMS PANEL
// ============================================================================

function ProblemsPanel() {
  const problems = [
    { file: 'Button.tsx', line: 15, message: 'Missing return type on function', severity: 'warning' },
    { file: 'utils.ts', line: 8, message: 'Unused variable "temp"', severity: 'info' },
  ];

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 px-3 py-2 border-b">
        <AlertCircle className="h-4 w-4 text-yellow-500" />
        <span className="text-sm font-medium">Problems</span>
        <Badge variant="secondary" className="text-[10px]">2</Badge>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {problems.map((p, i) => (
            <div key={i} className="flex items-start gap-2 p-2 rounded hover:bg-accent/50 text-xs">
              {p.severity === 'warning' ? (
                <AlertCircle className="h-4 w-4 text-yellow-500 shrink-0 mt-0.5" />
              ) : (
                <CheckCircle className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
              )}
              <div>
                <span className="text-muted-foreground">{p.file}:{p.line}</span>
                <p className="text-foreground">{p.message}</p>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

// ============================================================================
// AI CHAT PANEL
// ============================================================================

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  agent?: string;
}

function AIChatPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: '1', role: 'assistant', content: '👋 Welcome to Kyro IDE! I can help you with code, debugging, refactoring, and more. What would you like to work on?', agent: 'Coder' }
  ]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [selectedModel, setSelectedModel] = useState('claude-3-sonnet');
  const [error, setError] = useState<string | null>(null);

  const handleSend = useCallback(async () => {
    if (!input.trim() || isStreaming) return;
    
    const userMessage: ChatMessage = { 
      id: Date.now().toString(), 
      role: 'user', 
      content: input, 
      agent: 'User' 
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsStreaming(true);
    setError(null);
    
    // Create a placeholder for the assistant's response
    const assistantMessageId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, { 
      id: assistantMessageId, 
      role: 'assistant', 
      content: '', 
      agent: 'AI'
    }]);

    try {
      const response = await fetch('/api/ide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'chat',
          model: selectedModel,
          messages: [
            {
              role: 'system',
              content: 'You are a helpful AI coding assistant in Kyro IDE. Help users with coding questions, debugging, refactoring, and other programming tasks. Be concise but thorough.'
            },
            ...messages.filter(m => m.role !== 'assistant' || m.content).map(m => ({
              role: m.role,
              content: m.content
            })),
            { role: 'user', content: input }
          ]
        })
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success && data.content) {
        setMessages(prev => prev.map(m => 
          m.id === assistantMessageId 
            ? { ...m, content: data.content }
            : m
        ));
      } else {
        throw new Error(data.error || 'Failed to get response');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      setMessages(prev => prev.map(m => 
        m.id === assistantMessageId 
          ? { ...m, content: `Error: ${errorMessage}` }
          : m
      ));
    } finally {
      setIsStreaming(false);
    }
  }, [input, isStreaming, selectedModel, messages]);

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">AI Assistant</span>
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="text-xs bg-background border rounded px-1.5 py-0.5"
          >
            <optgroup label="Local (Ollama)">
              {MODEL_DEFINITIONS.filter(m => m.isLocal).map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </optgroup>
            <optgroup label="Cloud">
              {MODEL_DEFINITIONS.filter(m => !m.isLocal).map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </optgroup>
          </select>
        </div>
        <Badge variant={isStreaming ? "default" : "secondary"} className="text-[10px]">
          {isStreaming ? 'Thinking...' : 'Ready'}
        </Badge>
      </div>
      
      <ScrollArea className="flex-1 p-3">
        <div className="space-y-4">
          {messages.map(message => (
            <div
              key={message.id}
              className={cn(
                'rounded-lg p-3',
                message.role === 'user' ? 'bg-primary/10 ml-8' : 'bg-muted/50 mr-8'
              )}
            >
              {message.agent && (
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="h-3 w-3 text-primary" />
                  <span className="text-xs font-medium text-primary">{message.agent}</span>
                </div>
              )}
              {message.content === '' && isStreaming ? (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                  <span className="text-sm text-muted-foreground">Thinking...</span>
                </div>
              ) : (
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              )}
            </div>
          ))}
          {error && (
            <div className="rounded-lg p-3 bg-destructive/10 text-destructive text-sm">
              {error}
            </div>
          )}
        </div>
      </ScrollArea>
      
      <div className="p-3 border-t">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="Ask me anything..."
            className="flex-1"
          />
          <Button onClick={handleSend} size="icon" disabled={isStreaming}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN IDE COMPONENT
// ============================================================================

export default function KyroIDE() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarTab, setSidebarTab] = useState<'explorer' | 'agents' | 'search' | 'git' | 'workspace'>('explorer');
  const [panelOpen, setPanelOpen] = useState(true);
  const [panelTab, setPanelTab] = useState<'terminal' | 'chat' | 'problems' | 'settings' | 'premium'>('chat');
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContents, setFileContents] = useState<Record<string, string>>({
    '/src/components/Button.tsx': `import React from 'react';

interface ButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary';
  onClick?: () => void;
}

export function Button({ children, variant = 'primary', onClick }: ButtonProps) {
  return (
    <button
      onClick={onClick}
      className={\`px-4 py-2 rounded font-medium
        \${variant === 'primary' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-800'}
      \`}
    >
      {children}
    </button>
  );
}`,
    '/src/lib/utils.ts': `export function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ');
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}`,
    '/package.json': `{
  "name": "my-project",
  "version": "1.0.0",
  "scripts": {
    "dev": "next dev",
    "build": "next build"
  },
  "dependencies": {
    "react": "^18.2.0",
    "next": "^14.0.0"
  }
}`,
  });
  const [fileTree, setFileTree] = useState<FileNode[]>(sampleFileTree);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Tab system state
  const [openTabs, setOpenTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [modifiedFiles, setModifiedFiles] = useState<Set<string>>(new Set());

  // Recent files state
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>([]);

  // Workspace settings state
  const [workspaceSettings, setWorkspaceSettings] = useState<WorkspaceSettings>({
    fontSize: 14,
    fontFamily: 'JetBrains Mono, Menlo, Monaco, monospace',
    tabSize: 2,
    wordWrap: true,
    minimap: true,
    lineNumbers: 'on',
    autoSave: true,
    autoSaveDelay: 1000,
    formatOnSave: true,
    lintOnSave: false,
    theme: 'dark',
    accentColor: '#3b82f6',
    defaultModel: 'llama3.2',
    agentMode: 'review',
    autoSuggest: true,
    terminalFontSize: 13,
    terminalFontFamily: 'JetBrains Mono, Menlo, Monaco, monospace',
    shell: '/bin/bash',
    excludePatterns: ['node_modules', '.git', 'dist', 'build'],
    showHiddenFiles: false,
    autoReveal: true,
  });

  const agents: Agent[] = useMemo(() => 
    AGENT_DEFINITIONS.map((def, index) => ({
      ...def,
      id: `agent-${def.role}-${index}`,
      status: 'idle' as const,
      metrics: { tasksCompleted: 0, successRate: 1.0, avgResponseTime: 0, tokensUsed: 0 }
    })),
  []);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'P') {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'p' && !e.shiftKey) {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Open file in tab
  const openFileInTab = useCallback((file: FileNode | RecentFile) => {
    const tabId = file.path;
    const existingTab = openTabs.find(t => t.path === file.path);
    
    if (existingTab) {
      setActiveTabId(existingTab.id);
    } else {
      const fileName = file.name;
      const language = fileName.split('.').pop() || 'typescript';
      
      const newTab: Tab = {
        id: tabId,
        title: fileName,
        path: file.path,
        language,
        isDirty: false,
        isPinned: false,
      };
      
      setOpenTabs(prev => [...prev, newTab]);
      setActiveTabId(tabId);
      
      // Add to recent files
      setRecentFiles(prev => {
        const existing = prev.find(f => f.path === file.path);
        if (existing) {
          return prev.map(f => 
            f.path === file.path 
              ? { ...f, lastOpened: new Date(), openCount: f.openCount + 1 }
              : f
          );
        }
        return [{
          id: `recent-${Date.now()}`,
          path: file.path,
          name: fileName,
          language,
          lastOpened: new Date(),
          isPinned: false,
          openCount: 1,
        }, ...prev].slice(0, 20);
      });
    }
    
    setSelectedFile(file.path);
  }, [openTabs]);

  // Handle file select from explorer
  const handleFileSelect = useCallback((file: FileNode) => {
    openFileInTab(file);
  }, [openFileInTab]);

  const handleFileToggle = useCallback((path: string) => {
    const toggleNode = (nodes: FileNode[]): FileNode[] => {
      return nodes.map(node => {
        if (node.path === path) return { ...node, isOpen: !node.isOpen };
        if (node.children) return { ...node, children: toggleNode(node.children) };
        return node;
      });
    };
    setFileTree(toggleNode(fileTree));
  }, [fileTree]);

  // Tab handlers
  const handleTabSelect = useCallback((tabId: string) => {
    setActiveTabId(tabId);
    const tab = openTabs.find(t => t.id === tabId);
    if (tab) {
      setSelectedFile(tab.path);
    }
  }, [openTabs]);

  const handleTabClose = useCallback((tabId: string) => {
    setOpenTabs(prev => {
      const newTabs = prev.filter(t => t.id !== tabId);
      if (activeTabId === tabId && newTabs.length > 0) {
        const index = prev.findIndex(t => t.id === tabId);
        const newActiveTab = newTabs[index] || newTabs[index - 1];
        setActiveTabId(newActiveTab?.id || null);
        if (newActiveTab) {
          setSelectedFile(newActiveTab.path);
        }
      } else if (newTabs.length === 0) {
        setActiveTabId(null);
        setSelectedFile(null);
      }
      return newTabs;
    });
  }, [activeTabId, openTabs]);

  const handleTabPin = useCallback((tabId: string) => {
    setOpenTabs(prev => 
      prev.map(t => t.id === tabId ? { ...t, isPinned: !t.isPinned } : t)
    );
  }, []);

  const handleTabReorder = useCallback((newTabs: Tab[]) => {
    setOpenTabs(newTabs);
  }, []);

  // Recent file handlers
  const handleRecentFileSelect = useCallback((file: RecentFile) => {
    openFileInTab(file);
  }, [openFileInTab]);

  const handleRecentFileRemove = useCallback((fileId: string) => {
    setRecentFiles(prev => prev.filter(f => f.id !== fileId));
  }, []);

  const handleRecentFilePin = useCallback((fileId: string) => {
    setRecentFiles(prev => 
      prev.map(f => f.id === fileId ? { ...f, isPinned: !f.isPinned } : f)
    );
  }, []);

  const handleClearRecentFiles = useCallback(() => {
    setRecentFiles(prev => prev.filter(f => f.isPinned));
  }, []);

  // Command handler
  const handleCommand = useCallback((id: string) => {
    switch (id) {
      case 'settings.open':
        setShowSettings(true);
        break;
      case 'terminal.new':
        setPanelOpen(true);
        setPanelTab('terminal');
        break;
      default:
        console.log('Command:', id);
    }
  }, []);

  // Current content and language
  const currentContent = activeTabId 
    ? fileContents[openTabs.find(t => t.id === activeTabId)?.path || ''] || ''
    : '';
  const language = activeTabId 
    ? openTabs.find(t => t.id === activeTabId)?.language || 'typescript'
    : 'typescript';

  // Handle content change
  const handleContentChange = useCallback((value: string) => {
    if (activeTabId) {
      const tab = openTabs.find(t => t.id === activeTabId);
      if (tab) {
        setFileContents(prev => ({ ...prev, [tab.path]: value }));
        setModifiedFiles(prev => new Set(prev).add(tab.path));
        setOpenTabs(prev => 
          prev.map(t => t.id === activeTabId ? { ...t, isDirty: true } : t)
        );
      }
    }
  }, [activeTabId, openTabs]);

  // Handle save
  const handleSave = useCallback(() => {
    if (activeTabId) {
      const tab = openTabs.find(t => t.id === activeTabId);
      if (tab) {
        setModifiedFiles(prev => {
          const newSet = new Set(prev);
          newSet.delete(tab.path);
          return newSet;
        });
        setOpenTabs(prev => 
          prev.map(t => t.id === activeTabId ? { ...t, isDirty: false } : t)
        );
      }
    }
  }, [activeTabId, openTabs]);

  return (
    <div className="h-screen flex flex-col bg-background text-foreground overflow-hidden">
      {/* Title bar */}
      <div className="flex items-center justify-between h-9 bg-muted/30 border-b px-3 shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <div className="w-3 h-3 rounded-full bg-green-500" />
          </div>
          <Separator orientation="vertical" className="h-4 mx-2" />
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Kyro IDE</span>
          <Badge variant="outline" className="text-[10px]">v2.0</Badge>
        </div>
        <div className="flex items-center gap-1">
          <Badge variant="outline" className="text-[10px] gap-1">
            <Brain className="h-2.5 w-2.5" /> Multi-Agent
          </Badge>
          <Badge variant="outline" className="text-[10px] gap-1">
            <Zap className="h-2.5 w-2.5" /> Local AI
          </Badge>
          <Badge variant="outline" className="text-[10px] gap-1">
            <Shield className="h-2.5 w-2.5" /> Privacy
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {/* Recent Files Dropdown */}
          <RecentFiles
            recentFiles={recentFiles}
            onFileSelect={handleRecentFileSelect}
            onFileRemove={handleRecentFileRemove}
            onPinToggle={handleRecentFilePin}
            onClearAll={handleClearRecentFiles}
            variant="dropdown"
          />
          <Button variant="ghost" size="sm" className="h-6 text-xs">
            <GitBranch className="h-3 w-3 mr-1" /> main
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowSettings(true)}>
            <Settings className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Activity bar */}
        <div className="w-12 bg-muted/20 border-r flex flex-col items-center py-2 gap-1 shrink-0">
          <Button 
            variant={sidebarTab === 'explorer' ? 'secondary' : 'ghost'} 
            size="icon" 
            className="h-9 w-9"
            onClick={() => { setSidebarTab('explorer'); setSidebarOpen(true); }}
          >
            <Files className="h-4 w-4" />
          </Button>
          <Button 
            variant={sidebarTab === 'search' ? 'secondary' : 'ghost'} 
            size="icon" 
            className="h-9 w-9"
            onClick={() => { setSidebarTab('search'); setSidebarOpen(true); }}
          >
            <Search className="h-4 w-4" />
          </Button>
          <Button 
            variant={sidebarTab === 'agents' ? 'secondary' : 'ghost'} 
            size="icon" 
            className="h-9 w-9"
            onClick={() => { setSidebarTab('agents'); setSidebarOpen(true); }}
          >
            <Bot className="h-4 w-4" />
          </Button>
          <Button 
            variant={sidebarTab === 'git' ? 'secondary' : 'ghost'} 
            size="icon" 
            className="h-9 w-9"
            onClick={() => { setSidebarTab('git'); setSidebarOpen(true); }}
          >
            <GitBranch className="h-4 w-4" />
          </Button>
          <Button 
            variant={sidebarTab === 'workspace' ? 'secondary' : 'ghost'} 
            size="icon" 
            className="h-9 w-9"
            onClick={() => { setSidebarTab('workspace'); setSidebarOpen(true); }}
            title="Workspace Settings"
          >
            <Home className="h-4 w-4" />
          </Button>
          <div className="flex-1" />
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setSidebarOpen(!sidebarOpen)}>
            {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
          </Button>
        </div>

        {/* Main panels */}
        <ResizablePanelGroup direction="horizontal" className="flex-1">
          {sidebarOpen && (
            <>
              <ResizablePanel defaultSize={18} minSize={15} maxSize={30}>
                <div className="h-full bg-background border-r">
                  {sidebarTab === 'explorer' && (
                    <FileExplorer 
                      files={fileTree} 
                      onFileSelect={handleFileSelect} 
                      selectedFile={selectedFile} 
                      onFileToggle={handleFileToggle} 
                    />
                  )}
                  {sidebarTab === 'agents' && (
                    <AgentSidebar agents={agents} selectedAgent={null} onAgentSelect={() => {}} />
                  )}
                  {sidebarTab === 'search' && (
                    <SearchPanel />
                  )}
                  {sidebarTab === 'git' && (
                    <GitPanel
                      onFileStage={(path) => console.log('Stage:', path)}
                      onFileUnstage={(path) => console.log('Unstage:', path)}
                      onFileDiscard={(path) => console.log('Discard:', path)}
                      onFileOpen={(path) => console.log('Open:', path)}
                      onCommit={(message) => console.log('Commit:', message)}
                      onPush={() => console.log('Push')}
                      onPull={() => console.log('Pull')}
                      onFetch={() => console.log('Fetch')}
                      onBranchSwitch={(name) => console.log('Switch branch:', name)}
                    />
                  )}
                  {sidebarTab === 'workspace' && (
                    <WorkspacePanel
                      settings={workspaceSettings}
                      onSettingsChange={setWorkspaceSettings}
                    />
                  )}
                </div>
              </ResizablePanel>
              <ResizableHandle />
            </>
          )}

          <ResizablePanel defaultSize={sidebarOpen ? 82 : 100}>
            <ResizablePanelGroup direction="vertical">
              <ResizablePanel defaultSize={panelOpen ? 65 : 100}>
                {/* Tab System */}
                <div className="h-full flex flex-col">
                  <TabSystem
                    tabs={openTabs}
                    activeTabId={activeTabId || undefined}
                    onTabSelect={handleTabSelect}
                    onTabClose={handleTabClose}
                    onTabPin={handleTabPin}
                    onTabReorder={handleTabReorder}
                  />
                  
                  {/* Editor Area */}
                  <div className="flex-1 overflow-hidden">
                    {activeTabId ? (
                      <CodeEditor
                        value={currentContent}
                        language={language}
                        onChange={handleContentChange}
                        onSave={handleSave}
                        fontSize={workspaceSettings.fontSize}
                        minimap={workspaceSettings.minimap}
                        lineNumbers={workspaceSettings.lineNumbers}
                      />
                    ) : (
                      <div className="h-full flex items-center justify-center text-muted-foreground">
                        <div className="text-center">
                          <FileCode className="w-16 h-16 mx-auto mb-4 opacity-50" />
                          <p className="text-lg mb-2">No file open</p>
                          <p className="text-sm">Open a file from the explorer or recent files</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </ResizablePanel>
              
              {panelOpen && (
                <>
                  <ResizableHandle />
                  <ResizablePanel defaultSize={35} minSize={20} maxSize={50}>
                    <Tabs value={panelTab} onValueChange={(v) => setPanelTab(v as typeof panelTab)} className="h-full flex flex-col">
                      <TabsList className="shrink-0 justify-start rounded-none border-b bg-muted/20 h-9 px-2">
                        <TabsTrigger value="chat" className="text-xs data-[state=active]:bg-background">
                          <MessageSquare className="h-3 w-3 mr-1" /> AI Chat
                        </TabsTrigger>
                        <TabsTrigger value="terminal" className="text-xs data-[state=active]:bg-background">
                          <Terminal className="h-3 w-3 mr-1" /> Terminal
                        </TabsTrigger>
                        <TabsTrigger value="problems" className="text-xs data-[state=active]:bg-background">
                          <AlertCircle className="h-3 w-3 mr-1" /> Problems
                        </TabsTrigger>
                        <TabsTrigger value="premium" className="text-xs data-[state=active]:bg-background">
                          <Crown className="h-3 w-3 mr-1" /> Premium
                        </TabsTrigger>
                        <div className="flex-1" />
                        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setPanelOpen(false)}>
                          <PanelBottomClose className="h-3 w-3" />
                        </Button>
                      </TabsList>
                      <div className="flex-1 overflow-hidden">
                        <TabsContent value="chat" className="h-full m-0"><AIChatPanel /></TabsContent>
                        <TabsContent value="terminal" className="h-full m-0">
                        <TerminalManager 
                          fontSize={workspaceSettings.terminalFontSize}
                          fontFamily={workspaceSettings.terminalFontFamily}
                          onCommand={(terminalId, command, exitCode) => {
                            console.log(`Terminal ${terminalId}: ${command} (exit: ${exitCode})`);
                          }}
                        />
                      </TabsContent>
                        <TabsContent value="problems" className="h-full m-0"><ProblemsPanel /></TabsContent>
                        <TabsContent value="premium" className="h-full m-0"><PremiumFeaturesPanel /></TabsContent>
                      </div>
                    </Tabs>
                  </ResizablePanel>
                </>
              )}
            </ResizablePanelGroup>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between h-6 bg-muted/30 border-t px-3 text-[10px] text-muted-foreground shrink-0">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500" /> Ready</span>
          {activeTabId && (
            <span className="text-foreground/60">
              {openTabs.find(t => t.id === activeTabId)?.path}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span>CPU: 8%</span>
          <span>RAM: 1.1GB</span>
          <span>Model: {workspaceSettings.defaultModel}</span>
          <span>Kyro IDE v2.0</span>
        </div>
      </div>

      {/* Command Palette */}
      <CommandPalette 
        open={commandPaletteOpen} 
        onOpenChange={setCommandPaletteOpen}
        onCommand={handleCommand}
      />
    </div>
  );
}
