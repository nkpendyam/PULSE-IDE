import { create } from 'zustand';

export interface FileNode { name: string; path: string; is_directory: boolean; children?: FileNode[]; extension?: string; size?: number; }
export interface OpenFile { path: string; content: string; language: string; isDirty: boolean; isPinned?: boolean; isPreview?: boolean; }
export interface ChatMessage { id: string; role: 'user' | 'assistant'; content: string; timestamp: Date; }
export interface ModelInfo { name: string; size: string; modified_at: string; }

// Embedded LLM types
export interface HardwareInfo {
  gpu_name: string | null;
  vram_gb: number;
  ram_gb: number;
  cpu_cores: number;
  backend: string;
  memory_tier: string;
  recommended_model: string;
}

export interface LocalModelInfo {
  name: string;
  size_mb: number;
  downloaded: boolean;
  loaded: boolean;
  quantization: string;
  min_memory_tier: string;
}

export interface CompletionOptions {
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  top_k?: number;
  stop_sequences?: string[];
  stream?: boolean;
}

export interface InferenceResponse {
  text: string;
  tokens_generated: number;
  time_to_first_token_ms: number;
  total_time_ms: number;
  tokens_per_second: number;
  model: string;
  from_cache: boolean;
  memory_used: number;
}

export interface GitStatus { branch: string; ahead: number; behind: number; staged: Array<{ path: string; status: string }>; unstaged: Array<{ path: string; status: string }>; untracked: string[]; }

// Editor settings
export interface EditorSettings {
  fontSize: number;
  fontFamily: string;
  tabSize: number;
  wordWrap: 'on' | 'off' | 'bounded';
  minimap: boolean;
  lineNumbers: 'on' | 'off' | 'relative';
  renderWhitespace: 'none' | 'boundary' | 'selection' | 'all';
  bracketPairColorization: boolean;
  stickyScroll: boolean;
  inlineSuggest: boolean;
  formatOnSave: boolean;
  autoSave: 'off' | 'afterDelay' | 'onFocusChange';
}

// Scope info for breadcrumbs
export interface ScopeInfo {
  name: string;
  kind: 'function' | 'class' | 'method' | 'interface' | 'struct' | 'enum';
  line: number;
}

// Search result
export interface SearchResult {
  file: string;
  line: number;
  column: number;
  text: string;
  context: string;
}

// Debug state
export interface DebugBreakpoint {
  id: string;
  file: string;
  line: number;
  enabled: boolean;
  condition?: string;
}

interface KyroState {
  projectPath: string | null; fileTree: FileNode | null; openFiles: OpenFile[]; activeFileIndex: number;
  editorContent: string; cursorPosition: { line: number; column: number }; selectedText: string;
  isOllamaRunning: boolean; models: ModelInfo[]; selectedModel: string; chatMessages: ChatMessage[]; isAiLoading: boolean;
  terminalOutput: string; gitStatus: GitStatus | null; supportedLanguages: string[];
  sidebarWidth: number; chatWidth: number; showChat: boolean; showTerminal: boolean; terminalHeight: number;
  
  // Embedded LLM state
  hardwareInfo: HardwareInfo | null;
  localModels: LocalModelInfo[];
  isEmbeddedLLMReady: boolean;
  isEmbeddedLLMLoading: boolean;
  selectedLocalModel: string;
  inferenceStats: { totalTokens: number; totalTime: number; avgTokensPerSecond: number };
  
  // New state
  settings: { editorOptions: EditorSettings; theme: string; keybindings: string; };
  currentScope: ScopeInfo | null;
  searchResults: SearchResult[];
  isSearching: boolean;
  breakpoints: DebugBreakpoint[];
  commandPaletteOpen: boolean;
  symbolSearchOpen: boolean;
  globalSearchOpen: boolean;
  inlineChatOpen: boolean;
  inlineChatPosition: { x: number; y: number } | null;
  recentCommands: string[];
  recentFiles: string[];
  
  setProjectPath: (path: string | null) => void; setFileTree: (tree: FileNode | null) => void;
  openFile: (file: OpenFile) => void; closeFile: (path: string) => void; setActiveFile: (index: number) => void; updateFileContent: (path: string, content: string) => void;
  setEditorContent: (content: string) => void; setCursorPosition: (line: number, column: number) => void; setSelectedText: (text: string) => void;
  setOllamaStatus: (running: boolean) => void; setModels: (models: ModelInfo[]) => void; setSelectedModel: (model: string) => void;
  addChatMessage: (message: ChatMessage) => void; clearChatMessages: () => void; setAiLoading: (loading: boolean) => void;
  setTerminalOutput: (output: string) => void; appendTerminalOutput: (output: string) => void; setGitStatus: (status: GitStatus | null) => void;
  setSupportedLanguages: (languages: string[]) => void;
  setSidebarWidth: (width: number) => void; setChatWidth: (width: number) => void; toggleChat: () => void; toggleTerminal: () => void; setTerminalHeight: (height: number) => void;
  
  // Embedded LLM actions
  setHardwareInfo: (info: HardwareInfo) => void;
  setLocalModels: (models: LocalModelInfo[]) => void;
  setEmbeddedLLMReady: (ready: boolean) => void;
  setEmbeddedLLMLoading: (loading: boolean) => void;
  setSelectedLocalModel: (model: string) => void;
  updateInferenceStats: (tokens: number, timeMs: number) => void;
  
  // New actions
  setEditorOptions: (options: Partial<EditorSettings>) => void;
  setTheme: (theme: string) => void;
  setKeybindings: (scheme: string) => void;
  setCurrentScope: (scope: ScopeInfo | null) => void;
  setSearchResults: (results: SearchResult[]) => void;
  setIsSearching: (searching: boolean) => void;
  addBreakpoint: (breakpoint: DebugBreakpoint) => void;
  removeBreakpoint: (id: string) => void;
  toggleBreakpoint: (id: string) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setSymbolSearchOpen: (open: boolean) => void;
  setGlobalSearchOpen: (open: boolean) => void;
  setInlineChatOpen: (open: boolean, position?: { x: number; y: number } | null) => void;
  addRecentCommand: (command: string) => void;
  addRecentFile: (path: string) => void;
  pinFile: (path: string) => void;
  unpinFile: (path: string) => void;
}

export const useKyroStore = create<KyroState>((set, get) => ({
  projectPath: null, fileTree: null, openFiles: [], activeFileIndex: -1, editorContent: '', cursorPosition: { line: 1, column: 1 }, selectedText: '',
  isOllamaRunning: false, models: [], selectedModel: 'codellama:7b', chatMessages: [], isAiLoading: false, terminalOutput: '', gitStatus: null, supportedLanguages: [],
  sidebarWidth: 260, chatWidth: 400, showChat: true, showTerminal: true, terminalHeight: 200,
  
  // Embedded LLM initial state
  hardwareInfo: null,
  localModels: [],
  isEmbeddedLLMReady: false,
  isEmbeddedLLMLoading: false,
  selectedLocalModel: 'qwen3-4b-q4_k_m',
  inferenceStats: { totalTokens: 0, totalTime: 0, avgTokensPerSecond: 0 },
  
  // New state defaults
  settings: {
    editorOptions: {
      fontSize: 14,
      fontFamily: 'JetBrains Mono, Fira Code, monospace',
      tabSize: 4,
      wordWrap: 'on',
      minimap: true,
      lineNumbers: 'on',
      renderWhitespace: 'selection',
      bracketPairColorization: true,
      stickyScroll: true,
      inlineSuggest: true,
      formatOnSave: true,
      autoSave: 'afterDelay'
    },
    theme: 'kro-dark',
    keybindings: 'vscode'
  },
  currentScope: null,
  searchResults: [],
  isSearching: false,
  breakpoints: [],
  commandPaletteOpen: false,
  symbolSearchOpen: false,
  globalSearchOpen: false,
  inlineChatOpen: false,
  inlineChatPosition: null,
  recentCommands: [],
  recentFiles: [],
  
  setProjectPath: (path) => set({ projectPath: path }), setFileTree: (tree) => set({ fileTree: tree }),
  openFile: (file) => {
    const { openFiles } = get();
    const existingIndex = openFiles.findIndex(f => f.path === file.path);
    if (existingIndex >= 0) { set({ activeFileIndex: existingIndex, editorContent: file.content }); }
    else { set({ openFiles: [...openFiles, file], activeFileIndex: openFiles.length, editorContent: file.content }); }
  },
  closeFile: (path) => {
    const { openFiles, activeFileIndex } = get();
    const newFiles = openFiles.filter(f => f.path !== path);
    let newIndex = activeFileIndex;
    if (newFiles.length === 0) newIndex = -1;
    else if (activeFileIndex >= newFiles.length) newIndex = newFiles.length - 1;
    set({ openFiles: newFiles, activeFileIndex: newIndex, editorContent: newIndex >= 0 ? newFiles[newIndex].content : '' });
  },
  setActiveFile: (index) => { const { openFiles } = get(); if (index >= 0 && index < openFiles.length) set({ activeFileIndex: index, editorContent: openFiles[index].content }); },
  updateFileContent: (path, content) => { const { openFiles, activeFileIndex } = get(); const newFiles = openFiles.map(f => f.path === path ? { ...f, content, isDirty: true } : f); set({ openFiles: newFiles }); if (activeFileIndex >= 0 && newFiles[activeFileIndex]?.path === path) set({ editorContent: content }); },
  setEditorContent: (content) => set({ editorContent: content }), setCursorPosition: (line, column) => set({ cursorPosition: { line, column } }), setSelectedText: (text) => set({ selectedText: text }),
  setOllamaStatus: (running) => set({ isOllamaRunning: running }), setModels: (models) => set({ models }), setSelectedModel: (model) => set({ selectedModel: model }),
  addChatMessage: (message) => set(state => ({ chatMessages: [...state.chatMessages, message] })), clearChatMessages: () => set({ chatMessages: [] }), setAiLoading: (loading) => set({ isAiLoading: loading }),
  setTerminalOutput: (output) => set({ terminalOutput: output }), appendTerminalOutput: (output) => set(state => ({ terminalOutput: state.terminalOutput + output })), setGitStatus: (status) => set({ gitStatus: status }),
  setSupportedLanguages: (languages) => set({ supportedLanguages: languages }),
  setSidebarWidth: (width) => set({ sidebarWidth: width }), setChatWidth: (width) => set({ chatWidth: width }), toggleChat: () => set(state => ({ showChat: !state.showChat })), toggleTerminal: () => set(state => ({ showTerminal: !state.showTerminal })), setTerminalHeight: (height) => set({ terminalHeight: height }),
  
  // Embedded LLM actions
  setHardwareInfo: (info) => set({ hardwareInfo: info }),
  setLocalModels: (models) => set({ localModels: models }),
  setEmbeddedLLMReady: (ready) => set({ isEmbeddedLLMReady: ready }),
  setEmbeddedLLMLoading: (loading) => set({ isEmbeddedLLMLoading: loading }),
  setSelectedLocalModel: (model) => set({ selectedLocalModel: model }),
  updateInferenceStats: (tokens, timeMs) => set(state => {
    const newTotalTokens = state.inferenceStats.totalTokens + tokens;
    const newTotalTime = state.inferenceStats.totalTime + timeMs;
    return {
      inferenceStats: {
        totalTokens: newTotalTokens,
        totalTime: newTotalTime,
        avgTokensPerSecond: newTotalTime > 0 ? (newTotalTokens / (newTotalTime / 1000)) : 0
      }
    };
  }),
  
  // New actions
  setEditorOptions: (options) => set(state => ({
    settings: { ...state.settings, editorOptions: { ...state.settings.editorOptions, ...options } }
  })),
  setTheme: (theme) => set(state => ({ settings: { ...state.settings, theme } })),
  setKeybindings: (keybindings) => set(state => ({ settings: { ...state.settings, keybindings } })),
  setCurrentScope: (scope) => set({ currentScope: scope }),
  setSearchResults: (results) => set({ searchResults: results }),
  setIsSearching: (searching) => set({ isSearching: searching }),
  addBreakpoint: (breakpoint) => set(state => ({ breakpoints: [...state.breakpoints, breakpoint] })),
  removeBreakpoint: (id) => set(state => ({ breakpoints: state.breakpoints.filter(b => b.id !== id) })),
  toggleBreakpoint: (id) => set(state => ({
    breakpoints: state.breakpoints.map(b => b.id === id ? { ...b, enabled: !b.enabled } : b)
  })),
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
  setSymbolSearchOpen: (open) => set({ symbolSearchOpen: open }),
  setGlobalSearchOpen: (open) => set({ globalSearchOpen: open }),
  setInlineChatOpen: (open, position) => set({ inlineChatOpen: open, inlineChatPosition: position || null }),
  addRecentCommand: (command) => set(state => ({
    recentCommands: [command, ...state.recentCommands.filter(c => c !== command)].slice(0, 20)
  })),
  addRecentFile: (path) => set(state => ({
    recentFiles: [path, ...state.recentFiles.filter(f => f !== path)].slice(0, 20)
  })),
  pinFile: (path) => set(state => ({
    openFiles: state.openFiles.map(f => f.path === path ? { ...f, isPinned: true } : f)
  })),
  unpinFile: (path) => set(state => ({
    openFiles: state.openFiles.map(f => f.path === path ? { ...f, isPinned: false } : f)
  })),
}));
