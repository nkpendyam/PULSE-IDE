'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Keyboard, Search, X, Pencil, Check, RotateCcw } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────

type Category =
  | 'Editor'
  | 'Navigation'
  | 'Search'
  | 'Git'
  | 'Terminal'
  | 'AI / Chat'
  | 'Debug'
  | 'View';

interface Keybinding {
  id: string;
  command: string;
  keybinding: string;
  description: string;
  category: Category;
}

// ── Default keybindings ────────────────────────────────────────────────────────

const DEFAULT_KEYBINDINGS: Keybinding[] = [
  // Editor
  { id: 'save',               command: 'Save File',                keybinding: 'Ctrl+S',            description: 'Save the current file',                   category: 'Editor' },
  { id: 'save-all',           command: 'Save All Files',           keybinding: 'Ctrl+Shift+S',      description: 'Save all open files',                     category: 'Editor' },
  { id: 'undo',               command: 'Undo',                     keybinding: 'Ctrl+Z',            description: 'Undo last action',                        category: 'Editor' },
  { id: 'redo',               command: 'Redo',                     keybinding: 'Ctrl+Y',            description: 'Redo last undone action',                 category: 'Editor' },
  { id: 'format',             command: 'Format Document',          keybinding: 'Shift+Alt+F',       description: 'Format the current document',             category: 'Editor' },
  { id: 'select-all',         command: 'Select All',               keybinding: 'Ctrl+A',            description: 'Select all text in editor',               category: 'Editor' },
  { id: 'select-next',        command: 'Select Next Occurrence',   keybinding: 'Ctrl+D',            description: 'Add selection to next occurrence',        category: 'Editor' },
  { id: 'comment-line',       command: 'Toggle Line Comment',      keybinding: 'Ctrl+/',            description: 'Comment or uncomment current line',       category: 'Editor' },
  { id: 'inline-edit',        command: 'AI Inline Edit',           keybinding: 'Ctrl+K',            description: 'Open inline AI edit prompt',              category: 'Editor' },
  { id: 'split-editor',       command: 'Split Editor',             keybinding: 'Ctrl+\\',           description: 'Split editor into two columns',           category: 'Editor' },
  { id: 'close-tab',          command: 'Close Tab',                keybinding: 'Ctrl+W',            description: 'Close the current editor tab',            category: 'Editor' },

  // Navigation
  { id: 'quick-open',         command: 'Quick Open File',          keybinding: 'Ctrl+P',            description: 'Open file quickly by name',               category: 'Navigation' },
  { id: 'command-palette',    command: 'Command Palette',          keybinding: 'Ctrl+Shift+P',      description: 'Open the command palette',                category: 'Navigation' },
  { id: 'go-to-line',         command: 'Go to Line',               keybinding: 'Ctrl+G',            description: 'Jump to a specific line number',          category: 'Navigation' },
  { id: 'go-to-symbol',       command: 'Go to Symbol',             keybinding: 'Ctrl+Shift+O',      description: 'Navigate to a symbol in the file',        category: 'Navigation' },
  { id: 'go-to-definition',   command: 'Go to Definition',         keybinding: 'F12',               description: 'Jump to the definition of a symbol',     category: 'Navigation' },
  { id: 'peek-definition',    command: 'Peek Definition',          keybinding: 'Alt+F12',           description: 'Peek at the definition inline',           category: 'Navigation' },
  { id: 'back',               command: 'Navigate Back',            keybinding: 'Alt+Left',          description: 'Go back in navigation history',           category: 'Navigation' },
  { id: 'forward',            command: 'Navigate Forward',         keybinding: 'Alt+Right',         description: 'Go forward in navigation history',        category: 'Navigation' },

  // Search
  { id: 'find',               command: 'Find',                     keybinding: 'Ctrl+F',            description: 'Find text in current file',               category: 'Search' },
  { id: 'find-replace',       command: 'Find & Replace',           keybinding: 'Ctrl+H',            description: 'Find and replace in current file',        category: 'Search' },
  { id: 'find-in-files',      command: 'Find in Files',            keybinding: 'Ctrl+Shift+F',      description: 'Search across all project files',         category: 'Search' },
  { id: 'replace-in-files',   command: 'Replace in Files',         keybinding: 'Ctrl+Shift+H',      description: 'Replace across all project files',        category: 'Search' },

  // Git
  { id: 'git-commit',         command: 'Git: Commit',              keybinding: 'Ctrl+Enter',        description: 'Commit staged changes',                   category: 'Git' },
  { id: 'git-push',           command: 'Git: Push',                keybinding: 'Ctrl+Shift+G P',    description: 'Push to remote',                         category: 'Git' },
  { id: 'git-pull',           command: 'Git: Pull',                keybinding: 'Ctrl+Shift+G L',    description: 'Pull from remote',                       category: 'Git' },
  { id: 'git-diff',           command: 'Git: Show Diff',           keybinding: 'Ctrl+Shift+G D',    description: 'Show diff for current file',             category: 'Git' },

  // Terminal
  { id: 'toggle-terminal',    command: 'Toggle Terminal',          keybinding: 'Ctrl+`',            description: 'Show or hide the integrated terminal',    category: 'Terminal' },
  { id: 'new-terminal',       command: 'New Terminal',             keybinding: 'Ctrl+Shift+`',      description: 'Open a new terminal instance',            category: 'Terminal' },
  { id: 'kill-terminal',      command: 'Kill Terminal',            keybinding: 'Ctrl+Shift+5',      description: 'Kill the current terminal',               category: 'Terminal' },

  // AI / Chat
  { id: 'ai-chat',            command: 'Open AI Chat',             keybinding: 'Ctrl+L',            description: 'Toggle the AI chat sidebar',              category: 'AI / Chat' },
  { id: 'ai-inline-ask',      command: 'AI Ask Selection',         keybinding: 'Ctrl+Shift+L',      description: 'Ask AI about selected code',              category: 'AI / Chat' },
  { id: 'ai-explain',         command: 'AI Explain Code',          keybinding: 'Ctrl+Alt+E',        description: 'Explain selected code with AI',           category: 'AI / Chat' },
  { id: 'ai-fix',             command: 'AI Fix Error',             keybinding: 'Ctrl+Alt+X',        description: 'Ask AI to fix the current error',         category: 'AI / Chat' },

  // Debug
  { id: 'debug-start',        command: 'Start Debugging',          keybinding: 'F5',                description: 'Start or continue debugging',             category: 'Debug' },
  { id: 'debug-stop',         command: 'Stop Debugging',           keybinding: 'Shift+F5',          description: 'Stop the debugger',                       category: 'Debug' },
  { id: 'debug-step-over',    command: 'Step Over',                keybinding: 'F10',               description: 'Step over the current line',              category: 'Debug' },
  { id: 'debug-step-into',    command: 'Step Into',                keybinding: 'F11',               description: 'Step into a function call',               category: 'Debug' },
  { id: 'debug-breakpoint',   command: 'Toggle Breakpoint',        keybinding: 'F9',                description: 'Add or remove a breakpoint',              category: 'Debug' },

  // View
  { id: 'toggle-sidebar',     command: 'Toggle Sidebar',           keybinding: 'Ctrl+B',            description: 'Show or hide the sidebar',                category: 'View' },
  { id: 'zoom-in',            command: 'Zoom In',                  keybinding: 'Ctrl+=',            description: 'Increase font size',                      category: 'View' },
  { id: 'zoom-out',           command: 'Zoom Out',                 keybinding: 'Ctrl+-',            description: 'Decrease font size',                      category: 'View' },
  { id: 'fullscreen',         command: 'Toggle Full Screen',       keybinding: 'F11',               description: 'Enter or exit full screen',               category: 'View' },
];

const CATEGORIES: Category[] = [
  'Editor', 'Navigation', 'Search', 'Git', 'Terminal', 'AI / Chat', 'Debug', 'View',
];

const LS_KEY = 'kyro-keybindings';

function loadOverrides(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) ?? '{}');
  } catch {
    return {};
  }
}

function saveOverrides(o: Record<string, string>) {
  localStorage.setItem(LS_KEY, JSON.stringify(o));
}

function formatKeyEvent(e: React.KeyboardEvent): string {
  const parts: string[] = [];
  if (e.ctrlKey)  parts.push('Ctrl');
  if (e.metaKey)  parts.push('Meta');
  if (e.altKey)   parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');
  const key = e.key;
  if (!['Control', 'Alt', 'Shift', 'Meta'].includes(key)) {
    parts.push(key.length === 1 ? key.toUpperCase() : key);
  }
  return parts.join('+');
}

// ── Keybinding Row ─────────────────────────────────────────────────────────────

interface RowProps {
  kb: Keybinding;
  override?: string;
  onSave: (id: string, key: string) => void;
  onReset: (id: string) => void;
}

function KeybindingRow({ kb, override, onSave, onReset }: RowProps) {
  const [editing, setEditing] = useState(false);
  const [captured, setCaptured] = useState('');
  const inputRef = useRef<HTMLDivElement>(null);

  const effective = override ?? kb.keybinding;
  const isCustom = !!override;

  function startEdit() {
    setCaptured('');
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    e.preventDefault();
    e.stopPropagation();
    const formatted = formatKeyEvent(e);
    if (formatted) setCaptured(formatted);
  }

  function confirm() {
    if (captured) onSave(kb.id, captured);
    setEditing(false);
  }

  function cancel() {
    setEditing(false);
    setCaptured('');
  }

  return (
    <tr className="border-b border-[#21262d] hover:bg-[#161b22] transition-colors group">
      <td className="px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#c9d1d9]">{kb.command}</span>
          {isCustom && (
            <span className="text-[10px] bg-[#1f6feb]/20 text-[#58a6ff] px-1.5 py-0 rounded border border-[#1f6feb]/30">
              custom
            </span>
          )}
        </div>
        <p className="text-[10px] text-[#484f58] mt-0.5">{kb.description}</p>
      </td>
      <td className="px-3 py-2">
        {editing ? (
          <div className="flex items-center gap-1">
            <div
              ref={inputRef}
              tabIndex={0}
              onKeyDown={handleKeyDown}
              className="font-mono text-xs px-2 py-0.5 rounded bg-[#161b22] border border-[#58a6ff] text-[#58a6ff] min-w-[120px] outline-none cursor-text"
            >
              {captured || <span className="text-[#484f58] italic">Press keys…</span>}
            </div>
            <button onClick={confirm} disabled={!captured}
              className="p-1 rounded text-[#3fb950] hover:bg-[#3fb950]/10 disabled:opacity-40 transition-colors">
              <Check size={12} />
            </button>
            <button onClick={cancel}
              className="p-1 rounded text-[#8b949e] hover:text-[#f85149] hover:bg-[#f85149]/10 transition-colors">
              <X size={12} />
            </button>
          </div>
        ) : (
          <kbd className={`font-mono text-xs px-2 py-0.5 rounded border ${
            isCustom
              ? 'bg-[#1f6feb]/10 border-[#1f6feb]/30 text-[#58a6ff]'
              : 'bg-[#21262d] border-[#30363d] text-[#c9d1d9]'
          }`}>
            {effective}
          </kbd>
        )}
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={startEdit} title="Edit keybinding"
            className="p-1 rounded text-[#8b949e] hover:text-[#58a6ff] hover:bg-[#58a6ff]/10 transition-colors">
            <Pencil size={11} />
          </button>
          {isCustom && (
            <button onClick={() => onReset(kb.id)} title="Reset to default"
              className="p-1 rounded text-[#8b949e] hover:text-[#d29922] hover:bg-[#d29922]/10 transition-colors">
              <RotateCcw size={11} />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function KeybindingsPanel() {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<Category | 'All'>('All');
  const [overrides, setOverrides] = useState<Record<string, string>>({});

  useEffect(() => {
    setOverrides(loadOverrides());
  }, []);

  const filtered = useMemo(() => {
    let list = DEFAULT_KEYBINDINGS;
    if (activeCategory !== 'All') {
      list = list.filter(k => k.category === activeCategory);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        k =>
          k.command.toLowerCase().includes(q) ||
          k.keybinding.toLowerCase().includes(q) ||
          k.description.toLowerCase().includes(q),
      );
    }
    return list;
  }, [search, activeCategory]);

  // Group by category for display
  const grouped = useMemo(() => {
    const groups: Partial<Record<Category, Keybinding[]>> = {};
    filtered.forEach(k => {
      if (!groups[k.category]) groups[k.category] = [];
      groups[k.category]!.push(k);
    });
    return groups;
  }, [filtered]);

  const handleSave = useCallback((id: string, key: string) => {
    const updated = { ...overrides, [id]: key };
    setOverrides(updated);
    saveOverrides(updated);
  }, [overrides]);

  const handleReset = useCallback((id: string) => {
    const updated = { ...overrides };
    delete updated[id];
    setOverrides(updated);
    saveOverrides(updated);
  }, [overrides]);

  function resetAll() {
    setOverrides({});
    saveOverrides({});
  }

  const customCount = Object.keys(overrides).length;

  return (
    <div className="flex flex-col h-full bg-[#0d1117] text-[#c9d1d9]">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#30363d] shrink-0">
        <div className="flex items-center gap-2">
          <Keyboard size={14} className="text-[#58a6ff]" />
          <span className="text-xs font-semibold uppercase tracking-wide">Keybindings</span>
          {customCount > 0 && (
            <span className="text-[10px] bg-[#1f6feb]/20 text-[#58a6ff] px-1.5 py-0.5 rounded-full border border-[#1f6feb]/30">
              {customCount} custom
            </span>
          )}
        </div>
        {customCount > 0 && (
          <button
            onClick={resetAll}
            className="flex items-center gap-1 text-xs px-2 py-1 rounded text-[#d29922] hover:bg-[#d29922]/10 border border-[#d29922]/30 transition-colors"
          >
            <RotateCcw size={11} />
            Reset All
          </button>
        )}
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b border-[#30363d] shrink-0">
        <div className="relative">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-[#484f58]" />
          <input
            className="w-full bg-[#161b22] border border-[#30363d] rounded px-2 py-1 pl-6 text-xs text-[#c9d1d9] placeholder-[#484f58] focus:outline-none focus:border-[#58a6ff]"
            placeholder="Search commands or keybindings…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#484f58] hover:text-[#8b949e]">
              <X size={10} />
            </button>
          )}
        </div>
      </div>

      {/* Category chips */}
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-[#30363d] shrink-0 overflow-x-auto">
        {(['All', ...CATEGORIES] as const).map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`shrink-0 text-[10px] px-2.5 py-1 rounded-full transition-colors border ${
              activeCategory === cat
                ? 'bg-[#1f6feb]/20 text-[#58a6ff] border-[#1f6feb]/40'
                : 'bg-[#161b22] text-[#8b949e] border-[#30363d] hover:border-[#484f58] hover:text-[#c9d1d9]'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-24 text-[#484f58] gap-1">
            <Search size={20} className="opacity-40" />
            <p className="text-xs">No keybindings match your search.</p>
          </div>
        ) : (
          Object.entries(grouped).map(([category, items]) => (
            <div key={category}>
              <div className="px-3 py-1.5 bg-[#161b22] border-b border-[#30363d] sticky top-0 z-10">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-[#8b949e]">{category}</span>
              </div>
              <table className="w-full">
                <tbody>
                  {items!.map(kb => (
                    <KeybindingRow
                      key={kb.id}
                      kb={kb}
                      override={overrides[kb.id]}
                      onSave={handleSave}
                      onReset={handleReset}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-1.5 border-t border-[#30363d] shrink-0 bg-[#161b22]">
        <span className="text-[10px] text-[#484f58]">
          {filtered.length} keybinding{filtered.length !== 1 ? 's' : ''} — click <Pencil size={9} className="inline" /> to edit
        </span>
      </div>
    </div>
  );
}
