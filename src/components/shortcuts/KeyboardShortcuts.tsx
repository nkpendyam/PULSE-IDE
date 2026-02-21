'use client';

import React, { useState, useMemo, useCallback } from 'react';
import {
  Search,
  RefreshCw,
  AlertCircle,
  Check,
  X,
  Edit2,
  Trash2,
  Plus
} from 'lucide-react';

// Types
export interface KeyboardShortcut {
  id: string;
  command: string;
  label: string;
  category: string;
  keybinding?: string;
  when?: string;
  isDefault?: boolean;
}

export interface KeyboardShortcutsEditorProps {
  shortcuts?: KeyboardShortcut[];
  onChange?: (shortcuts: KeyboardShortcut[]) => void;
  onReset?: () => void;
  className?: string;
}

// Default shortcuts
const DEFAULT_SHORTCUTS: KeyboardShortcut[] = [
  // File
  { id: '1', command: 'workbench.action.files.newFile', label: 'New File', category: 'File', keybinding: 'Ctrl+N', isDefault: true },
  { id: '2', command: 'workbench.action.files.openFile', label: 'Open File...', category: 'File', keybinding: 'Ctrl+O', isDefault: true },
  { id: '3', command: 'workbench.action.files.save', label: 'Save', category: 'File', keybinding: 'Ctrl+S', isDefault: true },
  { id: '4', command: 'workbench.action.files.saveAll', label: 'Save All', category: 'File', keybinding: 'Ctrl+K S', isDefault: true },
  { id: '5', command: 'workbench.action.closeActiveEditor', label: 'Close Editor', category: 'File', keybinding: 'Ctrl+W', isDefault: true },
  { id: '6', command: 'workbench.action.closeAllEditors', label: 'Close All Editors', category: 'File', keybinding: 'Ctrl+K Ctrl+W', isDefault: true },

  // Edit
  { id: '7', command: 'editor.action.clipboardCutAction', label: 'Cut', category: 'Edit', keybinding: 'Ctrl+X', isDefault: true },
  { id: '8', command: 'editor.action.clipboardCopyAction', label: 'Copy', category: 'Edit', keybinding: 'Ctrl+C', isDefault: true },
  { id: '9', command: 'editor.action.clipboardPasteAction', label: 'Paste', category: 'Edit', keybinding: 'Ctrl+V', isDefault: true },
  { id: '10', command: 'editor.action.undo', label: 'Undo', category: 'Edit', keybinding: 'Ctrl+Z', isDefault: true },
  { id: '11', command: 'editor.action.redo', label: 'Redo', category: 'Edit', keybinding: 'Ctrl+Y', isDefault: true },
  { id: '12', command: 'editor.action.find', label: 'Find', category: 'Edit', keybinding: 'Ctrl+F', isDefault: true },
  { id: '13', command: 'editor.action.startFindReplaceAction', label: 'Replace', category: 'Edit', keybinding: 'Ctrl+H', isDefault: true },

  // View
  { id: '14', command: 'workbench.action.showCommands', label: 'Command Palette', category: 'View', keybinding: 'Ctrl+Shift+P', isDefault: true },
  { id: '15', command: 'workbench.action.quickOpen', label: 'Quick Open', category: 'View', keybinding: 'Ctrl+P', isDefault: true },
  { id: '16', command: 'workbench.action.toggleSidebar', label: 'Toggle Sidebar', category: 'View', keybinding: 'Ctrl+B', isDefault: true },
  { id: '17', command: 'workbench.action.terminal.toggle', label: 'Toggle Terminal', category: 'View', keybinding: 'Ctrl+`', isDefault: true },
  { id: '18', command: 'workbench.action.togglePanel', label: 'Toggle Panel', category: 'View', keybinding: 'Ctrl+J', isDefault: true },
  { id: '19', command: 'workbench.action.zoomIn', label: 'Zoom In', category: 'View', keybinding: 'Ctrl+=', isDefault: true },
  { id: '20', command: 'workbench.action.zoomOut', label: 'Zoom Out', category: 'View', keybinding: 'Ctrl+-', isDefault: true },

  // Navigation
  { id: '21', command: 'workbench.action.nextEditor', label: 'Next Editor', category: 'Navigation', keybinding: 'Ctrl+Tab', isDefault: true },
  { id: '22', command: 'workbench.action.previousEditor', label: 'Previous Editor', category: 'Navigation', keybinding: 'Ctrl+Shift+Tab', isDefault: true },
  { id: '23', command: 'editor.action.goToDefinition', label: 'Go to Definition', category: 'Navigation', keybinding: 'F12', isDefault: true },
  { id: '24', command: 'editor.action.revealDefinition', label: 'Peek Definition', category: 'Navigation', keybinding: 'Alt+F12', isDefault: true },
  { id: '25', command: 'workbench.action.navigateBack', label: 'Go Back', category: 'Navigation', keybinding: 'Alt+Left', isDefault: true },
  { id: '26', command: 'workbench.action.navigateForward', label: 'Go Forward', category: 'Navigation', keybinding: 'Alt+Right', isDefault: true },
  { id: '27', command: 'workbench.action.gotoLine', label: 'Go to Line...', category: 'Navigation', keybinding: 'Ctrl+G', isDefault: true },

  // AI
  { id: '28', command: 'pulse.ai.chat', label: 'Open AI Chat', category: 'AI', keybinding: 'Ctrl+I', isDefault: true },
  { id: '29', command: 'pulse.ai.complete', label: 'AI Code Complete', category: 'AI', keybinding: 'Ctrl+Space', isDefault: true },
  { id: '30', command: 'pulse.ai.explain', label: 'Explain Code', category: 'AI', keybinding: 'Ctrl+Shift+E', isDefault: true },
  { id: '31', command: 'pulse.ai.fix', label: 'Fix Code', category: 'AI', keybinding: 'Ctrl+Shift+F', isDefault: true },
  { id: '32', command: 'pulse.ai.refactor', label: 'AI Refactor', category: 'AI', keybinding: 'Ctrl+Shift+R', isDefault: true },

  // Debug
  { id: '33', command: 'workbench.action.debug.start', label: 'Start Debugging', category: 'Debug', keybinding: 'F5', isDefault: true },
  { id: '34', command: 'workbench.action.debug.stop', label: 'Stop Debugging', category: 'Debug', keybinding: 'Shift+F5', isDefault: true },
  { id: '35', command: 'workbench.action.debug.continue', label: 'Continue', category: 'Debug', keybinding: 'F5', isDefault: true },
  { id: '36', command: 'workbench.action.debug.stepOver', label: 'Step Over', category: 'Debug', keybinding: 'F10', isDefault: true },
  { id: '37', command: 'workbench.action.debug.stepInto', label: 'Step Into', category: 'Debug', keybinding: 'F11', isDefault: true },
  { id: '38', command: 'workbench.action.debug.stepOut', label: 'Step Out', category: 'Debug', keybinding: 'Shift+F11', isDefault: true },
  { id: '39', command: 'editor.debug.action.toggleBreakpoint', label: 'Toggle Breakpoint', category: 'Debug', keybinding: 'F9', isDefault: true },

  // Git
  { id: '40', command: 'git.commit', label: 'Git Commit', category: 'Git', keybinding: 'Ctrl+Enter', when: 'inGitCommit', isDefault: true },
  { id: '41', command: 'git.push', label: 'Git Push', category: 'Git', isDefault: true },
  { id: '42', command: 'git.pull', label: 'Git Pull', category: 'Git', isDefault: true },
];

// Key Input Component
const KeyInput: React.FC<{
  value: string;
  onChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}> = ({ value, onChange, onCancel, onConfirm }) => {
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (e.key === 'Escape') {
      onCancel();
      return;
    }
    if (e.key === 'Enter') {
      onConfirm();
      return;
    }

    // Build keybinding string
    const parts: string[] = [];
    if (e.ctrlKey) parts.push('Ctrl');
    if (e.shiftKey) parts.push('Shift');
    if (e.altKey) parts.push('Alt');
    if (e.metaKey) parts.push('Meta');

    // Add the main key
    let key = e.key;
    if (key === ' ') key = 'Space';
    if (key.length === 1) key = key.toUpperCase();
    if (!['Control', 'Shift', 'Alt', 'Meta'].includes(key)) {
      parts.push(key);
    }

    if (parts.length > 0) {
      onChange(parts.join('+'));
    }
  };

  return (
    <input
      ref={inputRef}
      type="text"
      value={value}
      onChange={() => {}}
      onKeyDown={handleKeyDown}
      onBlur={onCancel}
      placeholder="Press keys..."
      className="w-32 px-2 py-0.5 bg-[#1e1e1e] border border-[#007acc] rounded text-sm text-white outline-none"
    />
  );
};

// Main Keyboard Shortcuts Editor Component
export const KeyboardShortcutsEditor: React.FC<KeyboardShortcutsEditorProps> = ({
  shortcuts: controlledShortcuts,
  onChange,
  onReset,
  className = '',
}) => {
  const [internalShortcuts, setInternalShortcuts] = useState<KeyboardShortcut[]>(
    controlledShortcuts || DEFAULT_SHORTCUTS
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const shortcuts = controlledShortcuts || internalShortcuts;

  // Get unique categories
  const categories = useMemo(() => {
    const cats = new Set(shortcuts.map((s) => s.category));
    return ['All', ...Array.from(cats)];
  }, [shortcuts]);

  // Filter shortcuts
  const filteredShortcuts = useMemo(() => {
    let filtered = shortcuts;

    if (selectedCategory && selectedCategory !== 'All') {
      filtered = filtered.filter((s) => s.category === selectedCategory);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (s) =>
          s.label.toLowerCase().includes(query) ||
          s.command.toLowerCase().includes(query) ||
          s.keybinding?.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [shortcuts, searchQuery, selectedCategory]);

  // Group by category
  const groupedShortcuts = useMemo(() => {
    const groups: Record<string, KeyboardShortcut[]> = {};
    filteredShortcuts.forEach((s) => {
      if (!groups[s.category]) {
        groups[s.category] = [];
      }
      groups[s.category].push(s);
    });
    return groups;
  }, [filteredShortcuts]);

  // Check for conflicts
  const conflicts = useMemo(() => {
    const keyMap = new Map<string, KeyboardShortcut[]>();
    shortcuts.forEach((s) => {
      if (s.keybinding) {
        if (!keyMap.has(s.keybinding)) {
          keyMap.set(s.keybinding, []);
        }
        keyMap.get(s.keybinding)!.push(s);
      }
    });

    const conflicts = new Set<string>();
    keyMap.forEach((shortcuts, key) => {
      if (shortcuts.length > 1) {
        shortcuts.forEach((s) => conflicts.add(s.id));
      }
    });
    return conflicts;
  }, [shortcuts]);

  // Handle edit
  const handleEdit = useCallback((shortcut: KeyboardShortcut) => {
    setEditingId(shortcut.id);
    setEditingValue(shortcut.keybinding || '');
  }, []);

  // Handle save
  const handleSave = useCallback(() => {
    if (!editingId) return;

    const newShortcuts = shortcuts.map((s) =>
      s.id === editingId ? { ...s, keybinding: editingValue, isDefault: false } : s
    );

    if (onChange) {
      onChange(newShortcuts);
    } else {
      setInternalShortcuts(newShortcuts);
    }

    setEditingId(null);
    setEditingValue('');
  }, [editingId, editingValue, shortcuts, onChange]);

  // Handle clear
  const handleClear = useCallback((id: string) => {
    const newShortcuts = shortcuts.map((s) =>
      s.id === id ? { ...s, keybinding: undefined } : s
    );

    if (onChange) {
      onChange(newShortcuts);
    } else {
      setInternalShortcuts(newShortcuts);
    }
  }, [shortcuts, onChange]);

  // Handle reset
  const handleReset = useCallback(() => {
    if (onReset) {
      onReset();
    } else {
      setInternalShortcuts(DEFAULT_SHORTCUTS);
    }
  }, [onReset]);

  // Handle reset one
  const handleResetOne = useCallback((id: string) => {
    const defaultShortcut = DEFAULT_SHORTCUTS.find((s) => s.id === id);
    if (defaultShortcut) {
      const newShortcuts = shortcuts.map((s) =>
        s.id === id ? { ...defaultShortcut } : s
      );

      if (onChange) {
        onChange(newShortcuts);
      } else {
        setInternalShortcuts(newShortcuts);
      }
    }
  }, [shortcuts, onChange]);

  return (
    <div className={`flex flex-col h-full bg-[#1e1e1e] ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#3c3c3c]">
        <h2 className="text-lg font-semibold text-white">Keyboard Shortcuts</h2>
        <button
          onClick={handleReset}
          className="flex items-center gap-1 px-3 py-1 text-sm text-gray-400 hover:text-white hover:bg-[#3c3c3c] rounded"
        >
          <RefreshCw size={14} />
          Reset All
        </button>
      </div>

      {/* Search and Filter */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-[#3c3c3c]">
        <div className="flex-1 flex items-center bg-[#2d2d2d] rounded px-3 py-1.5">
          <Search size={14} className="text-gray-500" />
          <input
            type="text"
            placeholder="Search shortcuts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent border-none outline-none text-sm text-white placeholder-gray-500 px-2"
          />
        </div>
        <div className="flex items-center gap-1">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat === 'All' ? null : cat)}
              className={`px-2 py-1 text-xs rounded ${
                (cat === 'All' && !selectedCategory) || selectedCategory === cat
                  ? 'bg-[#007acc] text-white'
                  : 'text-gray-400 hover:text-white hover:bg-[#3c3c3c]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Shortcuts List */}
      <div className="flex-1 overflow-y-auto">
        {Object.entries(groupedShortcuts).map(([category, items]) => (
          <div key={category}>
            {/* Category Header */}
            <div className="px-4 py-2 bg-[#252526] text-sm font-medium text-gray-400 sticky top-0 z-10">
              {category}
            </div>

            {/* Items */}
            {items.map((shortcut) => (
              <div
                key={shortcut.id}
                className={`flex items-center justify-between px-4 py-2 hover:bg-[#2a2d2e] ${
                  conflicts.has(shortcut.id) ? 'bg-red-900/10' : ''
                }`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{shortcut.label}</p>
                  <p className="text-xs text-gray-500 truncate">{shortcut.command}</p>
                </div>

                <div className="flex items-center gap-2">
                  {/* Conflict Warning */}
                  {conflicts.has(shortcut.id) && (
                    <span className="text-red-400" title="Keybinding conflict">
                      <AlertCircle size={14} />
                    </span>
                  )}

                  {/* Keybinding */}
                  {editingId === shortcut.id ? (
                    <KeyInput
                      value={editingValue}
                      onChange={setEditingValue}
                      onCancel={() => {
                        setEditingId(null);
                        setEditingValue('');
                      }}
                      onConfirm={handleSave}
                    />
                  ) : shortcut.keybinding ? (
                    <div className="flex items-center gap-1">
                      {shortcut.keybinding.split('+').map((key, i, arr) => (
                        <React.Fragment key={i}>
                          <span className="px-2 py-0.5 bg-[#3c3c3c] rounded text-xs text-gray-300">
                            {key}
                          </span>
                          {i < arr.length - 1 && <span className="text-gray-500">+</span>}
                        </React.Fragment>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-gray-500">Not set</span>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                    {editingId !== shortcut.id && (
                      <button
                        onClick={() => handleEdit(shortcut)}
                        className="p-1 text-gray-400 hover:text-white hover:bg-[#3c3c3c] rounded"
                        title="Edit"
                      >
                        <Edit2 size={12} />
                      </button>
                    )}
                    {shortcut.keybinding && (
                      <button
                        onClick={() => handleClear(shortcut.id)}
                        className="p-1 text-gray-400 hover:text-white hover:bg-[#3c3c3c] rounded"
                        title="Clear"
                      >
                        <X size={12} />
                      </button>
                    )}
                    {!shortcut.isDefault && (
                      <button
                        onClick={() => handleResetOne(shortcut.id)}
                        className="p-1 text-gray-400 hover:text-white hover:bg-[#3c3c3c] rounded"
                        title="Reset to default"
                      >
                        <RefreshCw size={12} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-[#3c3c3c] text-xs text-gray-500">
        <p>Click on a keybinding to edit. Press Enter to confirm, Escape to cancel.</p>
        <p className="mt-1">
          {shortcuts.filter((s) => !s.isDefault).length} customized shortcuts
        </p>
      </div>
    </div>
  );
};

export default KeyboardShortcutsEditor;
