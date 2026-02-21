// Kyro IDE - Settings Store
// Zustand-based state management for application settings

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// ============================================================================
// TYPES
// ============================================================================

export interface Keybinding {
  id: string;
  command: string;
  key: string;
  when?: string;
}

export interface Snippet {
  id: string;
  prefix: string;
  body: string;
  description: string;
  scope?: string;
}

export interface EditorSettings {
  fontSize: number;
  fontFamily: string;
  lineHeight: number;
  tabSize: number;
  insertSpaces: boolean;
  wordWrap: 'on' | 'off' | 'bounded';
  minimap: boolean;
  lineNumbers: 'on' | 'off' | 'relative';
  bracketPairColorization: boolean;
  cursorBlinking: 'blink' | 'smooth' | 'phase' | 'expand' | 'solid';
  smoothScrolling: boolean;
  fontLigatures: boolean;
  stickyScroll: boolean;
  inlayHints: 'on' | 'off' | 'click';
  codeLens: boolean;
  folding: boolean;
  formatOnPaste: boolean;
  formatOnType: boolean;
}

export interface AISettings {
  defaultModel: string;
  fallbackModel: string;
  ollamaHost: string;
  temperature: number;
  topP: number;
  maxTokens: number;
  streamingEnabled: boolean;
  inlineCompletionEnabled: boolean;
  codebaseIndexingEnabled: boolean;
  rulesFile: string;
  memoryLimitGB: number;
  autoUnloadModels: boolean;
}

export interface InlineCompletionSettings {
  enabled: boolean;
  debounceDelay: number;
  maxTokens: number;
  model: string;
  temperature: number;
  triggerOnSpace: boolean;
  triggerOnNewline: boolean;
  minPrefixLength: number;
  showLoadingIndicator: boolean;
  multilineThreshold: number;
  respectComments: boolean;
  showSuggestionSource: boolean;
  autoAcceptOnExactMatch: boolean;
}

export interface TerminalSettings {
  fontSize: number;
  fontFamily: string;
  cursorStyle: 'block' | 'underline' | 'bar';
  cursorBlink: boolean;
  scrollback: number;
  shell: string;
  enableGpuAcceleration: boolean;
}

export interface UISettings {
  theme: 'light' | 'dark' | 'system';
  sidebarPosition: 'left' | 'right';
  panelPosition: 'bottom' | 'right';
  statusBarVisible: boolean;
  breadcrumbsEnabled: boolean;
  zoomLevel: number;
}

export interface Settings {
  editor: EditorSettings;
  ai: AISettings;
  inlineCompletion: InlineCompletionSettings;
  terminal: TerminalSettings;
  ui: UISettings;
  keybindings: Keybinding[];
  snippets: Snippet[];
  recentProjects: string[];
  recentFiles: string[];
}

// ============================================================================
// DEFAULT SETTINGS
// ============================================================================

const defaultSettings: Settings = {
  editor: {
    fontSize: 14,
    fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
    lineHeight: 22,
    tabSize: 2,
    insertSpaces: true,
    wordWrap: 'on',
    minimap: true,
    lineNumbers: 'on',
    bracketPairColorization: true,
    cursorBlinking: 'smooth',
    smoothScrolling: true,
    fontLigatures: true,
    stickyScroll: true,
    inlayHints: 'on',
    codeLens: true,
    folding: true,
    formatOnPaste: true,
    formatOnType: true,
  },
  ai: {
    defaultModel: 'llama3.2',
    fallbackModel: 'claude-3-haiku',
    ollamaHost: 'http://localhost:11434',
    temperature: 0.7,
    topP: 0.9,
    maxTokens: 4096,
    streamingEnabled: true,
    inlineCompletionEnabled: true,
    codebaseIndexingEnabled: true,
    rulesFile: '.pulserules',
    memoryLimitGB: 16,
    autoUnloadModels: true,
  },
  inlineCompletion: {
    enabled: true,
    debounceDelay: 300,
    maxTokens: 150,
    model: 'llama3.2',
    temperature: 0.2,
    triggerOnSpace: true,
    triggerOnNewline: true,
    minPrefixLength: 3,
    showLoadingIndicator: true,
    multilineThreshold: 50,
    respectComments: true,
    showSuggestionSource: true,
    autoAcceptOnExactMatch: false,
  },
  terminal: {
    fontSize: 14,
    fontFamily: "'JetBrains Mono', monospace",
    cursorStyle: 'block',
    cursorBlink: true,
    scrollback: 10000,
    shell: process.platform === 'win32' ? 'cmd.exe' : '/bin/bash',
    enableGpuAcceleration: true,
  },
  ui: {
    theme: 'dark',
    sidebarPosition: 'left',
    panelPosition: 'bottom',
    statusBarVisible: true,
    breadcrumbsEnabled: true,
    zoomLevel: 0,
  },
  keybindings: [
    { id: 'save', command: 'workbench.action.files.save', key: 'Ctrl+S' },
    { id: 'open', command: 'workbench.action.files.openFile', key: 'Ctrl+O' },
    { id: 'new', command: 'workbench.action.files.newFile', key: 'Ctrl+N' },
    { id: 'close', command: 'workbench.action.closeActiveEditor', key: 'Ctrl+W' },
    { id: 'find', command: 'actions.find', key: 'Ctrl+F' },
    { id: 'replace', command: 'editor.action.startFindReplaceAction', key: 'Ctrl+H' },
    { id: 'globalSearch', command: 'workbench.action.findInFiles', key: 'Ctrl+Shift+F' },
    { id: 'commandPalette', command: 'workbench.action.showCommands', key: 'Ctrl+Shift+P' },
    { id: 'quickOpen', command: 'workbench.action.quickOpen', key: 'Ctrl+P' },
    { id: 'terminal', command: 'workbench.action.terminal.toggleTerminal', key: 'Ctrl+`' },
    { id: 'sidebar', command: 'workbench.action.toggleSidebarVisibility', key: 'Ctrl+B' },
    { id: 'format', command: 'editor.action.formatDocument', key: 'Shift+Alt+F' },
    { id: 'definition', command: 'editor.action.revealDefinition', key: 'F12' },
    { id: 'references', command: 'editor.action.references', key: 'Shift+F12' },
    { id: 'rename', command: 'editor.action.rename', key: 'F2' },
    { id: 'comment', command: 'editor.action.commentLine', key: 'Ctrl+/' },
    { id: 'aiChat', command: 'pulse.ai.openChat', key: 'Ctrl+Shift+I' },
    { id: 'aiComplete', command: 'pulse.ai.inlineComplete', key: 'Ctrl+Space' },
  ],
  snippets: [
    { id: 'log', prefix: 'log', body: 'console.log($1);', description: 'Log to console' },
    { id: 'clg', prefix: 'clg', body: 'console.log({ $1: $1 });', description: 'Log variable' },
    { id: 'rfc', prefix: 'rfc', body: `import React from 'react';\n\nexport const $1 = () => {\n  return (\n    <div>\n      $2\n    </div>\n  );\n};`, description: 'React component', scope: 'typescriptreact' },
    { id: 'useState', prefix: 'useState', body: 'const [$1, set$2] = React.useState<$3>($4);', description: 'useState hook', scope: 'typescriptreact' },
    { id: 'useEffect', prefix: 'useEffect', body: `React.useEffect(() => {\n  $1\n  return () => {\n    $2\n  };\n}, [$3]);`, description: 'useEffect hook', scope: 'typescriptreact' },
  ],
  recentProjects: [],
  recentFiles: [],
};

// ============================================================================
// SETTINGS STORE
// ============================================================================

interface SettingsStore {
  settings: Settings;
  
  getEditorSettings: () => EditorSettings;
  getAISettings: () => AISettings;
  getInlineCompletionSettings: () => InlineCompletionSettings;
  getTerminalSettings: () => TerminalSettings;
  getUISettings: () => UISettings;
  
  updateEditorSettings: (settings: Partial<EditorSettings>) => void;
  updateAISettings: (settings: Partial<AISettings>) => void;
  updateInlineCompletionSettings: (settings: Partial<InlineCompletionSettings>) => void;
  updateTerminalSettings: (settings: Partial<TerminalSettings>) => void;
  updateUISettings: (settings: Partial<UISettings>) => void;
  
  addKeybinding: (kb: Keybinding) => void;
  removeKeybinding: (id: string) => void;
  
  addSnippet: (snippet: Snippet) => void;
  removeSnippet: (id: string) => void;
  
  addRecentProject: (path: string) => void;
  addRecentFile: (path: string) => void;
  
  resetSettings: () => void;
  exportSettings: () => string;
  importSettings: (json: string) => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set, get) => ({
      settings: defaultSettings,
      
      getEditorSettings: () => get().settings.editor,
      getAISettings: () => get().settings.ai,
      getInlineCompletionSettings: () => get().settings.inlineCompletion,
      getTerminalSettings: () => get().settings.terminal,
      getUISettings: () => get().settings.ui,
      
      updateEditorSettings: (newSettings) =>
        set((state) => ({
          settings: {
            ...state.settings,
            editor: { ...state.settings.editor, ...newSettings },
          },
        })),
      
      updateAISettings: (newSettings) =>
        set((state) => ({
          settings: {
            ...state.settings,
            ai: { ...state.settings.ai, ...newSettings },
          },
        })),
      
      updateInlineCompletionSettings: (newSettings) =>
        set((state) => ({
          settings: {
            ...state.settings,
            inlineCompletion: { ...state.settings.inlineCompletion, ...newSettings },
          },
        })),
      
      updateTerminalSettings: (newSettings) =>
        set((state) => ({
          settings: {
            ...state.settings,
            terminal: { ...state.settings.terminal, ...newSettings },
          },
        })),
      
      updateUISettings: (newSettings) =>
        set((state) => ({
          settings: {
            ...state.settings,
            ui: { ...state.settings.ui, ...newSettings },
          },
        })),
      
      addKeybinding: (kb) =>
        set((state) => ({
          settings: {
            ...state.settings,
            keybindings: [...state.settings.keybindings, kb],
          },
        })),
      
      removeKeybinding: (id) =>
        set((state) => ({
          settings: {
            ...state.settings,
            keybindings: state.settings.keybindings.filter((kb) => kb.id !== id),
          },
        })),
      
      addSnippet: (snippet) =>
        set((state) => ({
          settings: {
            ...state.settings,
            snippets: [...state.settings.snippets, snippet],
          },
        })),
      
      removeSnippet: (id) =>
        set((state) => ({
          settings: {
            ...state.settings,
            snippets: state.settings.snippets.filter((s) => s.id !== id),
          },
        })),
      
      addRecentProject: (path) =>
        set((state) => ({
          settings: {
            ...state.settings,
            recentProjects: [path, ...state.settings.recentProjects.filter((p) => p !== path)].slice(0, 20),
          },
        })),
      
      addRecentFile: (path) =>
        set((state) => ({
          settings: {
            ...state.settings,
            recentFiles: [path, ...state.settings.recentFiles.filter((p) => p !== path)].slice(0, 20),
          },
        })),
      
      resetSettings: () => set({ settings: defaultSettings }),
      
      exportSettings: () => JSON.stringify(get().settings, null, 2),
      
      importSettings: (json) => {
        try {
          const imported = JSON.parse(json);
          set({ settings: { ...defaultSettings, ...imported } });
        } catch (e) {
          console.error('Failed to import settings:', e);
        }
      },
    }),
    {
      name: 'kyro-ide-settings',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ settings: state.settings }),
    }
  )
);

export { defaultSettings };
