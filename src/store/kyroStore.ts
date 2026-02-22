import { create } from 'zustand';

export interface FileNode { name: string; path: string; isDirectory: boolean; children?: FileNode[]; extension?: string; size?: number; }
export interface OpenFile { path: string; content: string; language: string; isDirty: boolean; }
export interface ChatMessage { id: string; role: 'user' | 'assistant'; content: string; timestamp: Date; }
export interface ModelInfo { name: string; size: string; modified_at: string; }
export interface GitStatus { branch: string; ahead: number; behind: number; staged: Array<{ path: string; status: string }>; unstaged: Array<{ path: string; status: string }>; untracked: string[]; }

interface KyroState {
  projectPath: string | null; fileTree: FileNode | null; openFiles: OpenFile[]; activeFileIndex: number;
  editorContent: string; cursorPosition: { line: number; column: number }; selectedText: string;
  isOllamaRunning: boolean; models: ModelInfo[]; selectedModel: string; chatMessages: ChatMessage[]; isAiLoading: boolean;
  terminalOutput: string; gitStatus: GitStatus | null;
  sidebarWidth: number; chatWidth: number; showChat: boolean; showTerminal: boolean; terminalHeight: number;
  setProjectPath: (path: string | null) => void; setFileTree: (tree: FileNode | null) => void;
  openFile: (file: OpenFile) => void; closeFile: (path: string) => void; setActiveFile: (index: number) => void; updateFileContent: (path: string, content: string) => void;
  setEditorContent: (content: string) => void; setCursorPosition: (line: number, column: number) => void; setSelectedText: (text: string) => void;
  setOllamaStatus: (running: boolean) => void; setModels: (models: ModelInfo[]) => void; setSelectedModel: (model: string) => void;
  addChatMessage: (message: ChatMessage) => void; clearChatMessages: () => void; setAiLoading: (loading: boolean) => void;
  setTerminalOutput: (output: string) => void; appendTerminalOutput: (output: string) => void; setGitStatus: (status: GitStatus | null) => void;
  setSidebarWidth: (width: number) => void; setChatWidth: (width: number) => void; toggleChat: () => void; toggleTerminal: () => void; setTerminalHeight: (height: number) => void;
}

export const useKyroStore = create<KyroState>((set, get) => ({
  projectPath: null, fileTree: null, openFiles: [], activeFileIndex: -1, editorContent: '', cursorPosition: { line: 1, column: 1 }, selectedText: '',
  isOllamaRunning: false, models: [], selectedModel: 'codellama:7b', chatMessages: [], isAiLoading: false, terminalOutput: '', gitStatus: null,
  sidebarWidth: 260, chatWidth: 400, showChat: true, showTerminal: true, terminalHeight: 200,
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
  setSidebarWidth: (width) => set({ sidebarWidth: width }), setChatWidth: (width) => set({ chatWidth: width }), toggleChat: () => set(state => ({ showChat: !state.showChat })), toggleTerminal: () => set(state => ({ showTerminal: !state.showTerminal })), setTerminalHeight: (height) => set({ terminalHeight: height }),
}));
