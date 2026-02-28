'use client';

import React, { useState, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import { useKyroStore, FileNode, OpenFile } from '@/store/kyroStore';
import { AgentManagerPanel } from '@/components/agent-manager/AgentManagerPanel';
import {
  Files,
  Search,
  GitBranch,
  Bug,
  Rocket,
  Settings,
  ChevronRight,
  ChevronDown,
  File,
  Folder,
  FolderOpen,
  X,
  Circle,
  Send,
  Trash2,
  Sparkles,
  Terminal,
  Layout,
  Code2,
  Bot,
  Zap,
  Clock,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

// Mock file tree data
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
            { name: 'Modal.tsx', path: '/kyro-project/src/components/Modal.tsx', is_directory: false, extension: 'tsx' },
          ]
        },
        {
          name: 'hooks',
          path: '/kyro-project/src/hooks',
          is_directory: true,
          children: [
            { name: 'useAuth.ts', path: '/kyro-project/src/hooks/useAuth.ts', is_directory: false, extension: 'ts' },
            { name: 'useApi.ts', path: '/kyro-project/src/hooks/useApi.ts', is_directory: false, extension: 'ts' },
          ]
        },
        {
          name: 'utils',
          path: '/kyro-project/src/utils',
          is_directory: true,
          children: [
            { name: 'helpers.ts', path: '/kyro-project/src/utils/helpers.ts', is_directory: false, extension: 'ts' },
            { name: 'constants.ts', path: '/kyro-project/src/utils/constants.ts', is_directory: false, extension: 'ts' },
          ]
        },
        { name: 'App.tsx', path: '/kyro-project/src/App.tsx', is_directory: false, extension: 'tsx' },
        { name: 'main.tsx', path: '/kyro-project/src/main.tsx', is_directory: false, extension: 'tsx' },
        { name: 'index.css', path: '/kyro-project/src/index.css', is_directory: false, extension: 'css' },
      ]
    },
    {
      name: 'tests',
      path: '/kyro-project/tests',
      is_directory: true,
      children: [
        { name: 'App.test.tsx', path: '/kyro-project/tests/App.test.tsx', is_directory: false, extension: 'tsx' },
        { name: 'utils.test.ts', path: '/kyro-project/tests/utils.test.ts', is_directory: false, extension: 'ts' },
      ]
    },
    { name: 'package.json', path: '/kyro-project/package.json', is_directory: false, extension: 'json' },
    { name: 'tsconfig.json', path: '/kyro-project/tsconfig.json', is_directory: false, extension: 'json' },
    { name: 'README.md', path: '/kyro-project/README.md', is_directory: false, extension: 'md' },
  ]
};

// Sample file contents
const sampleFileContents: Record<string, string> = {
  '/kyro-project/src/App.tsx': `import React from 'react';
import { Button } from './components/Button';
import { Card } from './components/Card';

export function App() {
  const [count, setCount] = React.useState(0);

  return (
    <div className="app">
      <Card title="Welcome to Kyro IDE">
        <p>Build amazing applications with AI assistance</p>
        <Button onClick={() => setCount(c => c + 1)}>
          Clicked {count} times
        </Button>
      </Card>
    </div>
  );
}

export default App;`,
  '/kyro-project/src/components/Button.tsx': `import React from 'react';

interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
}

export function Button({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  disabled = false
}: ButtonProps) {
  const baseStyles = 'rounded font-medium transition-colors';
  
  const variantStyles = {
    primary: 'bg-blue-500 hover:bg-blue-600 text-white',
    secondary: 'bg-gray-200 hover:bg-gray-300 text-gray-800',
    danger: 'bg-red-500 hover:bg-red-600 text-white'
  };

  const sizeStyles = {
    sm: 'px-2 py-1 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg'
  };

  return (
    <button
      className={\`\${baseStyles} \${variantStyles[variant]} \${sizeStyles[size]}\`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}`,
  '/kyro-project/src/hooks/useAuth.ts': `import { useState, useCallback } from 'react';

interface User {
  id: string;
  email: string;
  name: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: false,
    error: null
  });

  const login = useCallback(async (email: string, password: string) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      // Simulate API call
      const user: User = {
        id: '1',
        email,
        name: email.split('@')[0]
      };
      
      setState({
        user,
        isAuthenticated: true,
        isLoading: false,
        error: null
      });
      
      return user;
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Login failed'
      }));
      throw error;
    }
  }, []);

  const logout = useCallback(() => {
    setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null
    });
  }, []);

  return {
    ...state,
    login,
    logout
  };
}`,
  '/kyro-project/package.json': `{
  "name": "kyro-project",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "typescript": "^5.0.0",
    "vite": "^4.4.0",
    "vitest": "^0.34.0"
  }
}`,
  '/kyro-project/README.md': `# Kyro Project

A modern web application built with React and TypeScript.

## Features

- 🚀 Fast development with Vite
- 📦 Optimized production builds
- 🎨 Tailwind CSS for styling
- 🧪 Vitest for testing
- 🔧 TypeScript for type safety

## Getting Started

\`\`\`bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
\`\`\`

## Project Structure

\`\`\`
src/
  components/   # Reusable UI components
  hooks/        # Custom React hooks
  utils/        # Utility functions
  App.tsx       # Main application component
  main.tsx      # Entry point
\`\`\`

## License

MIT`,
};

// Mock AI responses
const mockAiResponses = [
  "I can help you with that! Looking at your code, I suggest adding error handling to the `login` function in `useAuth.ts`. You could use a try-catch block to handle network errors gracefully.",
  "The `Button` component looks good! You might want to add keyboard accessibility by including `onKeyDown` handler for Enter and Space keys.",
  "I notice you're using TypeScript. Consider adding more specific types for your API responses to improve type safety.",
  "For better performance, you could memoize the `Button` component using `React.memo` if it receives the same props frequently.",
  "The project structure is clean and organized. Consider adding a `types/` directory for shared TypeScript interfaces.",
];

type SidebarPanel = 'explorer' | 'search' | 'git' | 'debug' | 'mission' | 'settings';

// File Tree Component
function FileTreeItem({ node, level, onFileClick }: { node: FileNode; level: number; onFileClick: (path: string) => void }) {
  const [isExpanded, setIsExpanded] = useState(level < 2);
  const { openFiles } = useKyroStore();
  const isOpen = openFiles.some(f => f.path === node.path);

  const getFileIcon = (name: string, isDir: boolean) => {
    if (isDir) return null;
    const ext = name.split('.').pop()?.toLowerCase();
    const iconMap: Record<string, string> = {
      'rs': '🦀', 'py': '🐍', 'js': '📜', 'ts': '📘', 'tsx': '⚛️',
      'go': '🔵', 'java': '☕', 'html': '🌐', 'css': '🎨', 'json': '📋', 'md': '📝'
    };
    return iconMap[ext || ''] || null;
  };

  if (node.name.startsWith('.')) return null;

  const icon = getFileIcon(node.name, node.is_directory);
  const paddingLeft = level * 12 + 8;

  return (
    <div className="select-none">
      <div
        className={`flex items-center gap-1 py-1 px-1 cursor-pointer hover:bg-[#21262d] rounded ${isOpen ? 'bg-[#1f6feb33]' : ''}`}
        style={{ paddingLeft }}
        onClick={() => node.is_directory ? setIsExpanded(!isExpanded) : onFileClick(node.path)}
      >
        {node.is_directory && (
          <span className="text-[#8b949e]">
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </span>
        )}
        {icon ? (
          <span className="text-xs">{icon}</span>
        ) : node.is_directory ? (
          isExpanded ? <FolderOpen size={14} className="text-[#54aeff]" /> : <Folder size={14} className="text-[#54aeff]" />
        ) : (
          <File size={14} className="text-[#8b949e]" />
        )}
        <span className={`text-xs truncate ${node.is_directory ? 'font-medium' : ''}`}>{node.name}</span>
      </div>
      {node.is_directory && isExpanded && node.children && (
        <div>
          {node.children.map((child) => (
            <FileTreeItem key={child.path} node={child} level={level + 1} onFileClick={onFileClick} />
          ))}
        </div>
      )}
    </div>
  );
}

// Tab Component
function TabBar() {
  const { openFiles, activeFileIndex, setActiveFile, closeFile } = useKyroStore();
  if (openFiles.length === 0) return null;

  const getExtensionIcon = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    const iconMap: Record<string, { icon: string; color: string }> = {
      'ts': { icon: 'TS', color: 'text-[#3178c6]' },
      'tsx': { icon: 'TX', color: 'text-[#3178c6]' },
      'js': { icon: 'JS', color: 'text-[#f7df1e]' },
      'py': { icon: 'PY', color: 'text-[#3776ab]' },
      'rs': { icon: 'RS', color: 'text-[#dea584]' },
      'go': { icon: 'GO', color: 'text-[#00add8]' },
      'json': { icon: 'JN', color: 'text-[#cbcb41]' },
      'md': { icon: 'MD', color: 'text-[#083fa1]' },
    };
    return iconMap[ext || ''] || { icon: ext?.toUpperCase()?.slice(0, 2) || '?', color: 'text-[#8b949e]' };
  };

  return (
    <div className="h-9 bg-[#0d1117] border-b border-[#30363d] flex items-center overflow-x-auto">
      {openFiles.map((file, index) => {
        const isActive = index === activeFileIndex;
        const extInfo = getExtensionIcon(file.path);
        const filename = file.path.split('/').pop() || file.path;
        return (
          <div
            key={file.path}
            className={`h-full flex items-center gap-2 px-3 border-r border-[#30363d] cursor-pointer min-w-0 max-w-[180px] ${isActive ? 'bg-[#0d1117] border-b-2 border-b-[#58a6ff]' : 'bg-[#161b22] hover:bg-[#21262d]'}`}
            onClick={() => setActiveFile(index)}
          >
            <span className={`text-[10px] font-bold ${extInfo.color}`}>{extInfo.icon}</span>
            <span className="text-xs truncate flex-1">{filename}</span>
            {file.isDirty ? (
              <button
                onClick={(e) => { e.stopPropagation(); closeFile(file.path); }}
                className="text-[#8b949e] hover:text-[#c9d1d9]"
              >
                <Circle size={8} fill="currentColor" />
              </button>
            ) : (
              <button
                onClick={(e) => { e.stopPropagation(); closeFile(file.path); }}
                className="text-[#8b949e] hover:text-[#c9d1d9]"
              >
                <X size={14} />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

// AI Chat Panel
function AIChatPanel() {
  const [input, setInput] = useState('');
  const { chatMessages, addChatMessage, clearChatMessages, isAiLoading, setAiLoading } = useKyroStore();

  const handleSend = useCallback(() => {
    if (!input.trim() || isAiLoading) return;

    const userMessage = input.trim();
    setInput('');
    addChatMessage({
      id: Date.now().toString(),
      role: 'user',
      content: userMessage,
      timestamp: new Date()
    });
    setAiLoading(true);

    // Mock AI response
    setTimeout(() => {
      const response = mockAiResponses[Math.floor(Math.random() * mockAiResponses.length)];
      addChatMessage({
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
        timestamp: new Date()
      });
      setAiLoading(false);
    }, 1000 + Math.random() * 1000);
  }, [input, isAiLoading, addChatMessage, setAiLoading]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0d1117]">
      <div className="h-9 bg-[#161b22] border-b border-[#30363d] flex items-center px-3 justify-between">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-purple-400" />
          <span className="text-xs font-medium">AI Assistant</span>
        </div>
        <button
          onClick={clearChatMessages}
          className="p-1 hover:bg-[#21262d] rounded text-[#8b949e] hover:text-[#c9d1d9]"
          title="Clear chat"
        >
          <Trash2 size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {chatMessages.length === 0 && (
          <div className="text-center py-8">
            <div className="text-4xl mb-2">🤖</div>
            <p className="text-sm text-[#8b949e] mb-2">AI Assistant Ready</p>
            <p className="text-xs text-[#8b949e]">Ask me anything about your code!</p>
          </div>
        )}

        {chatMessages.map((message) => (
          <div key={message.id} className={`flex gap-2 ${message.role === 'user' ? 'justify-end' : ''}`}>
            {message.role === 'assistant' && (
              <div className="w-6 h-6 rounded bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                <Bot className="w-3 h-3 text-purple-400" />
              </div>
            )}
            <div className={`max-w-[85%] rounded-lg p-3 text-sm ${message.role === 'user' ? 'bg-[#1f6feb] text-white' : 'bg-[#21262d] text-[#c9d1d9]'}`}>
              <div className="whitespace-pre-wrap break-words">{message.content}</div>
            </div>
          </div>
        ))}

        {isAiLoading && (
          <div className="flex gap-2">
            <div className="w-6 h-6 rounded bg-purple-500/20 flex items-center justify-center flex-shrink-0">
              <Bot className="w-3 h-3 text-purple-400" />
            </div>
            <div className="bg-[#21262d] rounded-lg p-3">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-[#8b949e] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-[#8b949e] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-[#8b949e] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="p-3 border-t border-[#30363d]">
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your code..."
            disabled={isAiLoading}
            className="flex-1 bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-[#58a6ff] disabled:opacity-50"
            rows={2}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isAiLoading}
            className="px-3 bg-[#238636] hover:bg-[#2ea043] disabled:bg-[#21262d] disabled:text-[#8b949e] rounded-lg text-white transition-colors"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

// Status Bar
function StatusBar() {
  const { cursorPosition, openFiles, activeFileIndex, gitStatus } = useKyroStore();
  const currentFile = activeFileIndex >= 0 ? openFiles[activeFileIndex] : null;

  return (
    <div className="h-6 bg-[#161b22] border-t border-[#30363d] flex items-center justify-between px-3 text-xs text-[#8b949e]">
      <div className="flex items-center gap-4">
        <span className="flex items-center gap-1">
          <GitBranch size={12} /> {gitStatus?.branch || 'main'}
        </span>
        {gitStatus && (
          <>
            {gitStatus.ahead > 0 && <span className="text-green-400">↑{gitStatus.ahead}</span>}
            {gitStatus.behind > 0 && <span className="text-orange-400">↓{gitStatus.behind}</span>}
          </>
        )}
        <span className="flex items-center gap-1">
          <AlertCircle size={12} className="text-green-400" /> 0
          <CheckCircle2 size={12} className="text-yellow-400 ml-2" /> 0
        </span>
      </div>
      <div className="flex items-center gap-4">
        {currentFile && (
          <span className="flex items-center gap-1">
            <Code2 size={12} /> {currentFile.language}
          </span>
        )}
        <span>Ln {cursorPosition.line}, Col {cursorPosition.column}</span>
        <span className="flex items-center gap-1">
          <Zap size={12} className="text-yellow-400" /> AI Ready
        </span>
        <span className="flex items-center gap-1">
          <Clock size={12} /> {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  );
}

// Main IDE Page
export default function Home() {
  const [viewMode, setViewMode] = useState<'editor' | 'mission'>('editor');
  const [activePanel, setActivePanel] = useState<SidebarPanel>('explorer');
  const [showChat, setShowChat] = useState(true);

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
      unstaged: [{ path: 'src/components/Button.tsx', status: 'modified' }],
      untracked: ['tests/new-test.ts']
    });
  }, [setFileTree, setGitStatus]);

  const handleFileClick = useCallback((path: string) => {
    const content = sampleFileContents[path] || '// File content would be loaded here';
    const ext = path.split('.').pop()?.toLowerCase() || 'txt';
    const languageMap: Record<string, string> = {
      'ts': 'typescript',
      'tsx': 'typescript',
      'js': 'javascript',
      'jsx': 'javascript',
      'py': 'python',
      'rs': 'rust',
      'go': 'go',
      'json': 'json',
      'md': 'markdown',
      'css': 'css',
      'html': 'html'
    };

    const file: OpenFile = {
      path,
      content,
      language: languageMap[ext] || 'plaintext',
      isDirty: false
    };

    openFile(file);
  }, [openFile]);

  const handleEditorChange = useCallback((value: string | undefined) => {
    if (value !== undefined) {
      setEditorContent(value);
    }
  }, [setEditorContent]);

  const handleEditorMount = useCallback((editor: unknown) => {
    // Cast to Monaco editor type
    const monacoEditor = editor as {
      onDidChangeCursorPosition: (callback: (e: { position: { lineNumber: number; column: number } }) => void) => void;
    };
    monacoEditor.onDidChangeCursorPosition((e) => {
      setCursorPosition(e.position.lineNumber, e.position.column);
    });
  }, [setCursorPosition]);

  const currentFile = activeFileIndex >= 0 ? openFiles[activeFileIndex] : null;

  return (
    <div className="h-screen flex flex-col bg-[#0d1117] text-[#c9d1d9] overflow-hidden">
      {/* Header with View Toggle */}
      <div className="h-10 bg-[#161b22] border-b border-[#30363d] flex items-center justify-between px-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
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
              { id: 'explorer' as const, icon: Files, label: 'Explorer' },
              { id: 'search' as const, icon: Search, label: 'Search' },
              { id: 'git' as const, icon: GitBranch, label: 'Source Control' },
              { id: 'debug' as const, icon: Bug, label: 'Debug' },
              { id: 'mission' as const, icon: Rocket, label: 'Mission Control' },
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
                    <FileTreeItem key={child.path} node={child} level={0} onFileClick={handleFileClick} />
                  ))}
                </div>
              )}
              {activePanel === 'search' && (
                <div className="p-3">
                  <input
                    type="text"
                    placeholder="Search files..."
                    className="w-full bg-[#0d1117] border border-[#30363d] rounded px-2 py-1 text-xs focus:outline-none focus:border-[#58a6ff]"
                  />
                  <p className="text-xs text-[#8b949e] mt-3 text-center">
                    Type to search across all files
                  </p>
                </div>
              )}
              {activePanel === 'git' && (
                <div className="p-2">
                  <div className="mb-2">
                    <div className="text-xs text-[#8b949e] mb-1 px-1">Staged Changes</div>
                    <div className="bg-[#161b22] rounded p-1 text-xs">
                      <div className="flex items-center gap-1 p-1 hover:bg-[#21262d] rounded cursor-pointer">
                        <span className="text-green-400">M</span>
                        <span>src/App.tsx</span>
                      </div>
                    </div>
                  </div>
                  <div className="mb-2">
                    <div className="text-xs text-[#8b949e] mb-1 px-1">Changes</div>
                    <div className="bg-[#161b22] rounded p-1 text-xs">
                      <div className="flex items-center gap-1 p-1 hover:bg-[#21262d] rounded cursor-pointer">
                        <span className="text-yellow-400">M</span>
                        <span>src/components/Button.tsx</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-[#8b949e] mb-1 px-1">Untracked</div>
                    <div className="bg-[#161b22] rounded p-1 text-xs">
                      <div className="flex items-center gap-1 p-1 hover:bg-[#21262d] rounded cursor-pointer">
                        <span className="text-[#8b949e]">U</span>
                        <span>tests/new-test.ts</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {activePanel === 'debug' && (
                <div className="p-3 text-center">
                  <Bug size={24} className="mx-auto text-[#8b949e] mb-2" />
                  <p className="text-xs text-[#8b949e]">No active debug session</p>
                  <button className="mt-2 px-3 py-1 bg-[#238636] hover:bg-[#2ea043] rounded text-xs text-white">
                    Start Debugging
                  </button>
                </div>
              )}
              {activePanel === 'settings' && (
                <div className="p-3">
                  <div className="text-xs space-y-3">
                    <div>
                      <label className="block text-[#8b949e] mb-1">Theme</label>
                      <select className="w-full bg-[#161b22] border border-[#30363d] rounded px-2 py-1 text-xs">
                        <option>Dark (Default)</option>
                        <option>Light</option>
                        <option>High Contrast</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[#8b949e] mb-1">Font Size</label>
                      <input
                        type="number"
                        defaultValue={14}
                        className="w-full bg-[#161b22] border border-[#30363d] rounded px-2 py-1 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[#8b949e] mb-1">Tab Size</label>
                      <input
                        type="number"
                        defaultValue={2}
                        className="w-full bg-[#161b22] border border-[#30363d] rounded px-2 py-1 text-xs"
                      />
                    </div>
                  </div>
                </div>
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
                      renderWhitespace: 'selection',
                      bracketPairColorization: { enabled: true },
                    }}
                  />
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-[#8b949e]">
                    <Layout size={48} className="mb-4 opacity-50" />
                    <p className="text-lg mb-2">No file open</p>
                    <p className="text-xs">Select a file from the explorer to start editing</p>
                  </div>
                )}
              </div>

              {/* AI Chat Panel */}
              {showChat && (
                <div className="w-80 border-l border-[#30363d] flex flex-col">
                  <AIChatPanel />
                </div>
              )}
            </div>

            {/* Terminal Panel */}
            <div className="h-40 bg-[#0d1117] border-t border-[#30363d]">
              <div className="h-8 bg-[#161b22] border-b border-[#30363d] flex items-center px-3">
                <Terminal size={14} className="mr-2 text-[#8b949e]" />
                <span className="text-xs text-[#8b949e]">Terminal</span>
              </div>
              <div className="p-2 font-mono text-xs text-[#c9d1d9]">
                <div className="text-[#8b949e]">$ npm run dev</div>
                <div className="text-green-400">✓ Ready in 1.2s</div>
                <div className="text-[#8b949e]">→ Local: http://localhost:3000</div>
                <div className="mt-1 text-[#8b949e]">$ <span className="animate-pulse">_</span></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Status Bar */}
      <StatusBar />
    </div>
  );
}
