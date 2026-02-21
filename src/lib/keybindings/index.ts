// Kyro IDE - Keybindings Configuration
// Customizable keyboard shortcuts

export interface Keybinding {
  id: string;
  command: string;
  key: string;
  when?: string;
}

export const DEFAULT_KEYBINDINGS: Keybinding[] = [
  // File
  { id: 'kb.file.new', command: 'file.new', key: 'Ctrl+N' },
  { id: 'kb.file.open', command: 'file.open', key: 'Ctrl+O' },
  { id: 'kb.file.save', command: 'file.save', key: 'Ctrl+S' },
  { id: 'kb.file.saveAll', command: 'file.saveAll', key: 'Ctrl+Shift+S' },
  { id: 'kb.file.close', command: 'file.close', key: 'Ctrl+W' },

  // Edit
  { id: 'kb.edit.undo', command: 'edit.undo', key: 'Ctrl+Z' },
  { id: 'kb.edit.redo', command: 'edit.redo', key: 'Ctrl+Y' },
  { id: 'kb.edit.cut', command: 'edit.cut', key: 'Ctrl+X' },
  { id: 'kb.edit.copy', command: 'edit.copy', key: 'Ctrl+C' },
  { id: 'kb.edit.paste', command: 'edit.paste', key: 'Ctrl+V' },
  { id: 'kb.edit.selectAll', command: 'edit.selectAll', key: 'Ctrl+A' },
  { id: 'kb.edit.find', command: 'edit.find', key: 'Ctrl+F' },
  { id: 'kb.edit.replace', command: 'edit.replace', key: 'Ctrl+H' },
  { id: 'kb.edit.format', command: 'edit.format', key: 'Shift+Alt+F' },

  // Navigation
  { id: 'kb.nav.quickOpen', command: 'nav.quickOpen', key: 'Ctrl+P' },
  { id: 'kb.nav.commandPalette', command: 'nav.commandPalette', key: 'Ctrl+Shift+P' },
  { id: 'kb.nav.gotoLine', command: 'nav.gotoLine', key: 'Ctrl+G' },
  { id: 'kb.nav.gotoSymbol', command: 'nav.gotoSymbol', key: 'Ctrl+Shift+O' },
  { id: 'kb.nav.gotoDefinition', command: 'nav.gotoDefinition', key: 'F12' },
  { id: 'kb.nav.goBack', command: 'nav.goBack', key: 'Alt+Left' },
  { id: 'kb.nav.goForward', command: 'nav.goForward', key: 'Alt+Right' },

  // View
  { id: 'kb.view.explorer', command: 'view.explorer', key: 'Ctrl+Shift+E' },
  { id: 'kb.view.search', command: 'view.search', key: 'Ctrl+Shift+F' },
  { id: 'kb.view.git', command: 'view.git', key: 'Ctrl+Shift+G' },
  { id: 'kb.view.terminal', command: 'view.terminal', key: 'Ctrl+`' },
  { id: 'kb.view.output', command: 'view.output', key: 'Ctrl+Shift+U' },
  { id: 'kb.view.problems', command: 'view.problems', key: 'Ctrl+Shift+M' },
  { id: 'kb.view.toggleSidebar', command: 'view.toggleSidebar', key: 'Ctrl+B' },
  { id: 'kb.view.togglePanel', command: 'view.togglePanel', key: 'Ctrl+J' },

  // Terminal
  { id: 'kb.terminal.new', command: 'terminal.new', key: 'Ctrl+Shift+`' },
  { id: 'kb.terminal.split', command: 'terminal.split', key: 'Ctrl+Shift+5' },
  { id: 'kb.terminal.focusNext', command: 'terminal.focusNext', key: 'Ctrl+PageDown' },
  { id: 'kb.terminal.focusPrev', command: 'terminal.focusPrev', key: 'Ctrl+PageUp' },

  // AI
  { id: 'kb.ai.explain', command: 'ai.explain', key: 'Ctrl+Shift+E' },
  { id: 'kb.ai.refactor', command: 'ai.refactor', key: 'Ctrl+Shift+R' },
  { id: 'kb.ai.fix', command: 'ai.fix', key: 'Ctrl+Shift+F' },
  { id: 'kb.ai.chat', command: 'ai.chat', key: 'Ctrl+L' },

  // Git
  { id: 'kb.git.commit', command: 'git.commit', key: '' },
  { id: 'kb.git.push', command: 'git.push', key: '' },
  { id: 'kb.git.pull', command: 'git.pull', key: '' },

  // Settings
  { id: 'kb.settings.open', command: 'settings.open', key: 'Ctrl+,' },
  { id: 'kb.settings.keybindings', command: 'settings.keybindings', key: 'Ctrl+K Ctrl+S' },
];

// Keybinding presets for different editors
export const KEYBINDING_PRESETS = {
  vscode: DEFAULT_KEYBINDINGS,
  
  jetbrains: DEFAULT_KEYBINDINGS.map(kb => {
    const jetbrainsMappings: Record<string, string> = {
      'Ctrl+Shift+P': 'Ctrl+Shift+A',
      'Ctrl+P': 'Ctrl+Shift+N',
      'Ctrl+G': 'Ctrl+G',
      'Ctrl+B': 'Ctrl+Shift+F12',
      'F12': 'Ctrl+B',
    };
    return {
      ...kb,
      key: jetbrainsMappings[kb.key] || kb.key,
    };
  }),

  vim: DEFAULT_KEYBINDINGS.map(kb => {
    // Vim users typically use command mode
    const vimMappings: Record<string, string> = {
      'Ctrl+S': ':w',
      'Ctrl+F': '/',
      'Ctrl+G': ':',
    };
    return {
      ...kb,
      key: vimMappings[kb.key] || kb.key,
    };
  }),
};

// Parse key string to event
export function parseKeyString(key: string): {
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
  meta: boolean;
  keyName: string;
} | null {
  if (!key) return null;

  const parts = key.split('+').map(p => p.trim().toLowerCase());
  const keyName = parts.pop() || '';

  return {
    ctrl: parts.includes('ctrl'),
    shift: parts.includes('shift'),
    alt: parts.includes('alt'),
    meta: parts.includes('meta') || parts.includes('cmd'),
    keyName,
  };
}

// Check if event matches keybinding
export function matchesKeybinding(
  event: KeyboardEvent,
  keybinding: Keybinding
): boolean {
  const parsed = parseKeyString(keybinding.key);
  if (!parsed) return false;

  const keyMatch = event.key.toLowerCase() === parsed.keyName.toLowerCase() ||
    event.code.toLowerCase() === `key${parsed.keyName}`.toLowerCase();

  return (
    keyMatch &&
    event.ctrlKey === parsed.ctrl &&
    event.shiftKey === parsed.shift &&
    event.altKey === parsed.alt &&
    event.metaKey === parsed.meta
  );
}

// Keybindings manager hook
import { useEffect, useCallback, useState } from 'react';

export function useKeybindings(
  keybindings: Keybinding[] = DEFAULT_KEYBINDINGS,
  handlers: Record<string, () => void>
) {
  const [customKeybindings, setCustomKeybindings] = useState(keybindings);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    for (const kb of customKeybindings) {
      if (matchesKeybinding(event, kb)) {
        const handler = handlers[kb.command];
        if (handler) {
          event.preventDefault();
          handler();
          return;
        }
      }
    }
  }, [customKeybindings, handlers]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const updateKeybinding = useCallback((id: string, newKey: string) => {
    setCustomKeybindings(prev =>
      prev.map(kb => kb.id === id ? { ...kb, key: newKey } : kb)
    );
  }, []);

  const resetKeybindings = useCallback(() => {
    setCustomKeybindings(DEFAULT_KEYBINDINGS);
  }, []);

  return {
    keybindings: customKeybindings,
    updateKeybinding,
    resetKeybindings,
  };
}
