'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useKyroStore } from '@/store/kyroStore';
import {
  Search, File, GitBranch, Settings, Terminal, Code, Braces,
  Sparkles, Users, Puzzle, Bot, Download, FolderOpen, Save,
  Redo, Undo, Copy, Scissors, Clipboard, RefreshCw
} from 'lucide-react';

// Command interface
interface Command {
  id: string;
  label: string;
  description?: string;
  shortcut?: string;
  icon?: React.ReactNode;
  category: 'editor' | 'file' | 'git' | 'ai' | 'navigation' | 'settings' | 'view';
  action: () => void | Promise<void>;
}

// Fuzzy search implementation
function fuzzyMatch(text: string, query: string): { score: number; matches: number[] } {
  const textLower = text.toLowerCase();
  const queryLower = query.toLowerCase();
  let score = 0;
  let lastIndex = -1;
  const matches: number[] = [];

  for (let i = 0; i < queryLower.length; i++) {
    const char = queryLower[i];
    const index = textLower.indexOf(char, lastIndex + 1);

    if (index === -1) {
      return { score: 0, matches: [] };
    }

    matches.push(index);

    // Score based on position and consecutiveness
    if (index === lastIndex + 1) {
      score += 10; // Consecutive match bonus
    } else if (index === 0 || textLower[index - 1] === ' ') {
      score += 8; // Word start bonus
    } else {
      score += 1;
    }

    lastIndex = index;
  }

  return { score, matches };
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentCommands, setRecentCommands] = useState<string[]>([]);

  const {
    projectPath, setProjectPath, setFileTree, showTerminal,
    setShowTerminal, showChat, setShowChat, sidebarWidth, setSidebarWidth
  } = useKyroStore();

  // Define all available commands
  const commands: Command[] = useMemo(() => [
    // File commands
    {
      id: 'file.openFolder',
      label: 'Open Folder',
      description: 'Open a project folder',
      shortcut: 'Ctrl+K Ctrl+O',
      icon: <FolderOpen size={16} />,
      category: 'file',
      action: async () => {
        const { open } = await import('@tauri-apps/plugin-dialog');
        const selected = await open({ directory: true, multiple: false });
        if (selected && typeof selected === 'string') {
          setProjectPath(selected);
          const tree = await invoke('get_file_tree', { path: selected, maxDepth: 5 });
          setFileTree(tree);
        }
      }
    },
    {
      id: 'file.save',
      label: 'Save File',
      description: 'Save the current file',
      shortcut: 'Ctrl+S',
      icon: <Save size={16} />,
      category: 'file',
      action: () => console.log('Save file')
    },
    {
      id: 'file.saveAll',
      label: 'Save All Files',
      description: 'Save all open files',
      shortcut: 'Ctrl+Shift+S',
      icon: <Save size={16} />,
      category: 'file',
      action: () => console.log('Save all')
    },
    // Editor commands
    {
      id: 'editor.undo',
      label: 'Undo',
      description: 'Undo the last action',
      shortcut: 'Ctrl+Z',
      icon: <Undo size={16} />,
      category: 'editor',
      action: () => document.execCommand('undo')
    },
    {
      id: 'editor.redo',
      label: 'Redo',
      description: 'Redo the last undone action',
      shortcut: 'Ctrl+Y',
      icon: <Redo size={16} />,
      category: 'editor',
      action: () => document.execCommand('redo')
    },
    {
      id: 'editor.format',
      label: 'Format Document',
      description: 'Format the current document',
      shortcut: 'Shift+Alt+F',
      icon: <Braces size={16} />,
      category: 'editor',
      action: () => console.log('Format')
    },
    // Navigation commands
    {
      id: 'nav.goToLine',
      label: 'Go to Line...',
      description: 'Navigate to a specific line number',
      shortcut: 'Ctrl+G',
      icon: <Code size={16} />,
      category: 'navigation',
      action: () => console.log('Go to line')
    },
    {
      id: 'nav.goToFile',
      label: 'Go to File...',
      description: 'Quick file navigation',
      shortcut: 'Ctrl+P',
      icon: <File size={16} />,
      category: 'navigation',
      action: () => console.log('Go to file')
    },
    {
      id: 'nav.goToSymbol',
      label: 'Go to Symbol in Workspace',
      description: 'Search for symbols across the project',
      shortcut: 'Ctrl+T',
      icon: <Braces size={16} />,
      category: 'navigation',
      action: () => console.log('Go to symbol')
    },
    // Git commands
    {
      id: 'git.commit',
      label: 'Git: Commit',
      description: 'Commit staged changes',
      icon: <GitBranch size={16} />,
      category: 'git',
      action: async () => {
        if (projectPath) {
          await invoke('git_commit', { path: projectPath, message: 'Update' });
        }
      }
    },
    // AI commands
    {
      id: 'ai.explainCode',
      label: 'AI: Explain Code',
      description: 'Explain the selected code',
      shortcut: 'Ctrl+Shift+E',
      icon: <Sparkles size={16} />,
      category: 'ai',
      action: () => setShowChat(true)
    },
    {
      id: 'ai.chat',
      label: 'Open AI Chat',
      description: 'Open the AI chat panel',
      shortcut: 'Ctrl+I',
      icon: <Bot size={16} />,
      category: 'ai',
      action: () => setShowChat(!showChat)
    },
    // View commands
    {
      id: 'view.terminal',
      label: 'Toggle Terminal',
      description: 'Show or hide the integrated terminal',
      shortcut: 'Ctrl+`',
      icon: <Terminal size={16} />,
      category: 'view',
      action: () => setShowTerminal(!showTerminal)
    },
    {
      id: 'view.sidebar',
      label: 'Toggle Sidebar',
      description: 'Show or hide the sidebar',
      shortcut: 'Ctrl+B',
      icon: <FolderOpen size={16} />,
      category: 'view',
      action: () => setSidebarWidth(sidebarWidth > 0 ? 0 : 250)
    },
    // Settings
    {
      id: 'settings.open',
      label: 'Open Settings',
      description: 'Open the settings panel',
      shortcut: 'Ctrl+,',
      icon: <Settings size={16} />,
      category: 'settings',
      action: () => console.log('Open settings')
    },
    // Update
    {
      id: 'update.check',
      label: 'Check for Updates',
      description: 'Check for KRO IDE updates',
      icon: <Download size={16} />,
      category: 'view',
      action: async () => {
        const update = await invoke('check_for_updates');
        console.log('Update check:', update);
      }
    },
    {
      id: 'refresh',
      label: 'Refresh Explorer',
      description: 'Refresh the file explorer',
      shortcut: 'Ctrl+R',
      icon: <RefreshCw size={16} />,
      category: 'file',
      action: async () => {
        if (projectPath) {
          const tree = await invoke('get_file_tree', { path: projectPath, maxDepth: 5 });
          setFileTree(tree);
        }
      }
    }
  ], [projectPath, setProjectPath, setFileTree, showTerminal, setShowTerminal, showChat, setShowChat, sidebarWidth, setSidebarWidth]);

  // Filter commands based on query
  const filteredCommands = useMemo(() => {
    if (!query.trim()) {
      const recent = recentCommands
        .map(id => commands.find(c => c.id === id))
        .filter(Boolean) as Command[];
      const others = commands.filter(c => !recentCommands.includes(c.id));
      return [...recent, ...others];
    }

    const results = commands
      .map(cmd => {
        const labelMatch = fuzzyMatch(cmd.label, query);
        const descMatch = cmd.description ? fuzzyMatch(cmd.description, query) : { score: 0, matches: [] };
        const score = Math.max(labelMatch.score, descMatch.score);
        return { command: cmd, score };
      })
      .filter(r => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(r => r.command);

    return results;
  }, [commands, query, recentCommands]);

  // Execute command
  const executeCommand = useCallback((command: Command) => {
    setRecentCommands(prev => {
      const filtered = prev.filter(id => id !== command.id);
      return [command.id, ...filtered].slice(0, 10);
    });
    command.action();
    onClose();
    setQuery('');
  }, [onClose]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => Math.min(prev + 1, filteredCommands.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredCommands[selectedIndex]) {
            executeCommand(filteredCommands[selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredCommands, selectedIndex, executeCommand, onClose]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  if (!isOpen) return null;

  const categoryColors: Record<string, string> = {
    file: 'text-[#3fb950]',
    editor: 'text-[#58a6ff]',
    git: 'text-[#f85149]',
    ai: 'text-[#a371f7]',
    navigation: 'text-[#79c0ff]',
    settings: 'text-[#8b949e]',
    view: 'text-[#d29922]'
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10%] bg-black/50" onClick={onClose}>
      <div className="w-[600px] max-h-[400px] bg-[#161b22] rounded-lg border border-[#30363d] shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center px-4 py-3 border-b border-[#30363d]">
          <Search size={18} className="text-[#8b949e] mr-3" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or search..."
            className="flex-1 bg-transparent text-[#c9d1d9] placeholder-[#8b949e] outline-none text-sm"
            autoFocus
          />
          <kbd className="px-2 py-1 text-xs bg-[#21262d] rounded text-[#8b949e]">Esc</kbd>
        </div>

        <div className="max-h-[320px] overflow-y-auto">
          {filteredCommands.length === 0 ? (
            <div className="px-4 py-8 text-center text-[#8b949e]">No commands found</div>
          ) : (
            filteredCommands.map((command, index) => (
              <div
                key={command.id}
                onClick={() => executeCommand(command)}
                className={`flex items-center px-4 py-2 cursor-pointer ${
                  index === selectedIndex ? 'bg-[#21262d]' : 'hover:bg-[#21262d]'
                }`}
              >
                <span className={`${categoryColors[command.category]} mr-3`}>{command.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-[#c9d1d9]">{command.label}</div>
                  {command.description && (
                    <div className="text-xs text-[#8b949e] truncate">{command.description}</div>
                  )}
                </div>
                {command.shortcut && (
                  <kbd className="px-2 py-0.5 text-xs bg-[#0d1117] border border-[#30363d] rounded text-[#8b949e] ml-2">
                    {command.shortcut}
                  </kbd>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
