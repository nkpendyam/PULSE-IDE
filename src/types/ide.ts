// Kyro IDE - Type Definitions
// World-class open-source AI IDE

// ============================================================================
// FILE SYSTEM TYPES
// ============================================================================

export interface FileNode {
  id: string;
  name: string;
  type: 'file' | 'folder';
  path: string;
  children?: FileNode[];
  content?: string;
  language?: string;
  isOpen?: boolean;
  isModified?: boolean;
  size?: number;
  lastModified?: Date;
}

export interface OpenFile {
  id: string;
  path: string;
  name: string;
  content: string;
  language: string;
  isModified: boolean;
  cursorPosition?: { line: number; column: number };
  scrollPosition?: { top: number; left: number };
  viewState?: unknown;
}

export interface FileOperation {
  type: 'create' | 'delete' | 'rename' | 'move' | 'copy';
  path: string;
  targetPath?: string;
  content?: string;
  timestamp: Date;
}

// ============================================================================
// EDITOR TYPES
// ============================================================================

export interface EditorTab {
  id: string;
  fileId: string;
  path: string;
  name: string;
  language: string;
  isModified: boolean;
  isActive: boolean;
  isPinned: boolean;
}

export interface EditorState {
  tabs: EditorTab[];
  activeTabId: string | null;
  splitView: boolean;
  secondaryActiveTabId: string | null;
}

export interface TextEdit {
  range: {
    startLine: number;
    startColumn: number;
    endLine: number;
    endColumn: number;
  };
  newText: string;
  oldText?: string;
  source: 'user' | 'ai' | 'system';
  agentId?: string;
}

export interface Selection {
  start: { line: number; column: number };
  end: { line: number; column: number };
}

// ============================================================================
// AI AGENT TYPES
// ============================================================================

export type AgentRole = 
  | 'architect'      // System design and architecture decisions
  | 'coder'          // Code generation and modification
  | 'reviewer'       // Code review and quality assurance
  | 'debugger'       // Bug detection and fixing
  | 'optimizer'      // Performance optimization
  | 'documenter'     // Documentation generation
  | 'tester'         // Test generation and execution
  | 'refactorer'     // Code refactoring
  | 'security'       // Security analysis
  | 'researcher';    // Research and information gathering

export interface Agent {
  id: string;
  name: string;
  role: AgentRole;
  description: string;
  icon: string;
  capabilities: string[];
  modelPreference?: string;
  isActive: boolean;
  status: 'idle' | 'thinking' | 'working' | 'waiting' | 'error';
  currentTask?: string;
  lastActivity?: Date;
  metrics: {
    tasksCompleted: number;
    successRate: number;
    avgResponseTime: number;
    tokensUsed: number;
  };
}

export interface AgentMessage {
  id: string;
  agentId: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: Date;
  metadata?: {
    model?: string;
    tokens?: number;
    latency?: number;
    filesReferenced?: string[];
    toolsUsed?: string[];
  };
  codeBlocks?: CodeBlock[];
  actions?: AgentAction[];
}

export interface CodeBlock {
  id: string;
  language: string;
  code: string;
  filename?: string;
  lineStart?: number;
  lineEnd?: number;
  action: 'create' | 'modify' | 'delete' | 'reference';
}

export interface AgentAction {
  id: string;
  type: 'file_edit' | 'file_create' | 'file_delete' | 'command' | 'search' | 'tool_use';
  description: string;
  status: 'pending' | 'approved' | 'rejected' | 'completed' | 'failed';
  params: Record<string, unknown>;
  result?: unknown;
  requiresApproval: boolean;
}

export interface AgentSession {
  id: string;
  agentId: string;
  messages: AgentMessage[];
  context: ConversationContext;
  startTime: Date;
  endTime?: Date;
  status: 'active' | 'completed' | 'cancelled' | 'error';
  summary?: string;
}

// ============================================================================
// CONTEXT ENGINE TYPES
// ============================================================================

export interface CodeSymbol {
  id: string;
  name: string;
  type: 'function' | 'class' | 'interface' | 'variable' | 'constant' | 'import' | 'export';
  path: string;
  lineStart: number;
  lineEnd: number;
  signature?: string;
  documentation?: string;
  references: string[];
  dependencies: string[];
}

export interface CodeContext {
  symbols: CodeSymbol[];
  imports: string[];
  exports: string[];
  dependencies: string[];
  relatedFiles: string[];
  summary?: string;
}

export interface ConversationContext {
  files: string[];
  symbols: string[];
  codeSnippets: CodeSnippet[];
  searchResults: SearchResult[];
  projectInfo: ProjectInfo;
}

export interface CodeSnippet {
  path: string;
  code: string;
  language: string;
  lineStart: number;
  lineEnd: number;
  relevance: number;
  reason: string;
}

export interface SearchResult {
  type: 'file' | 'symbol' | 'snippet' | 'doc';
  path: string;
  content: string;
  score: number;
  highlights: { start: number; end: number }[];
}

export interface ProjectInfo {
  name: string;
  rootPath: string;
  language: string;
  framework?: string;
  structure: string;
  dependencies: Record<string, string>;
  gitBranch?: string;
  gitStatus?: GitStatus;
}

export interface GitStatus {
  branch: string;
  ahead: number;
  behind: number;
  staged: string[];
  modified: string[];
  untracked: string[];
}

// ============================================================================
// MODEL GATEWAY TYPES
// ============================================================================

export type ModelProvider = 'ollama' | 'openai' | 'anthropic' | 'google' | 'local' | 'custom';

export interface Model {
  id: string;
  name: string;
  provider: ModelProvider;
  type: 'chat' | 'completion' | 'embedding';
  contextWindow: number;
  maxTokens: number;
  supportsVision: boolean;
  supportsTools: boolean;
  supportsStreaming: boolean;
  isLocal: boolean;
  isUncensored: boolean;
  size?: number; // Model size in GB
  ram?: number; // RAM requirement in GB
  status: 'available' | 'loading' | 'unavailable' | 'error';
  metrics?: ModelMetrics;
}

export interface ModelMetrics {
  requestsTotal: number;
  tokensTotal: number;
  avgLatency: number;
  lastUsed?: Date;
}

export interface ModelConfig {
  temperature: number;
  topP: number;
  topK: number;
  maxTokens: number;
  stopSequences: string[];
  systemPrompt?: string;
  frequencyPenalty: number;
  presencePenalty: number;
}

export interface ModelRequest {
  id: string;
  model: string;
  messages: Message[];
  config: ModelConfig;
  tools?: Tool[];
  stream: boolean;
  metadata?: Record<string, unknown>;
}

export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | MessageContent[];
  name?: string;
  toolCallId?: string;
}

export interface MessageContent {
  type: 'text' | 'image' | 'code';
  text?: string;
  imageUrl?: string;
  code?: string;
  language?: string;
}

export interface ModelResponse {
  id: string;
  requestId: string;
  model: string;
  content: string;
  toolCalls?: ToolCall[];
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  latency: number;
  finishReason: 'stop' | 'length' | 'tool_call' | 'error';
}

export interface Tool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

// ============================================================================
// POLICY ENGINE TYPES
// ============================================================================

export type PolicyMode = 'off' | 'review' | 'agent' | 'strict';

export interface Policy {
  id: string;
  name: string;
  description: string;
  mode: PolicyMode;
  rules: PolicyRule[];
  enabled: boolean;
  priority: number;
}

export interface PolicyRule {
  id: string;
  type: 'allow' | 'deny' | 'ask';
  resource: 'file' | 'command' | 'network' | 'model' | 'tool';
  pattern: string;
  action?: string;
  message?: string;
}

export interface PolicyDecision {
  allowed: boolean;
  reason: string;
  rule?: PolicyRule;
  requiresApproval: boolean;
  modifications?: Record<string, unknown>;
}

// ============================================================================
// DETERMINISTIC REPLAY TYPES
// ============================================================================

export interface ReplaySession {
  id: string;
  seed: number;
  events: ReplayEvent[];
  modelVersions: Record<string, string>;
  startTime: Date;
  endTime?: Date;
  checksum: string;
}

export interface ReplayEvent {
  id: string;
  type: string;
  timestamp: number;
  data: unknown;
  hash: string;
}

// ============================================================================
// TERMINAL TYPES
// ============================================================================

export interface TerminalSession {
  id: string;
  name: string;
  type: 'bash' | 'python' | 'node' | 'custom';
  cwd: string;
  history: string[];
  output: TerminalLine[];
  status: 'running' | 'exited' | 'error';
  pid?: number;
}

export interface TerminalLine {
  id: string;
  type: 'input' | 'output' | 'error' | 'info';
  content: string;
  timestamp: Date;
}

// ============================================================================
// WORKSPACE TYPES
// ============================================================================

export interface Workspace {
  id: string;
  name: string;
  path: string;
  isOpen: boolean;
  settings: WorkspaceSettings;
  layout: WorkspaceLayout;
  recentFiles: string[];
  pinnedFiles: string[];
}

export interface WorkspaceSettings {
  theme: 'light' | 'dark' | 'system';
  fontSize: number;
  fontFamily: string;
  tabSize: number;
  wordWrap: boolean;
  minimap: boolean;
  lineNumbers: boolean;
  autoSave: boolean;
  autoSaveDelay: number;
  formatOnSave: boolean;
  lintOnSave: boolean;
  defaultModel: string;
  agentMode: PolicyMode;
}

export interface WorkspaceLayout {
  sidebarVisible: boolean;
  sidebarWidth: number;
  sidebarActiveTab: 'explorer' | 'search' | 'git' | 'extensions' | 'agents';
  panelVisible: boolean;
  panelHeight: number;
  panelActiveTab: 'terminal' | 'chat' | 'output' | 'problems';
  rightPanelVisible: boolean;
  rightPanelWidth: number;
}

// ============================================================================
// SDK TYPES
// ============================================================================

export interface Plugin {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  enabled: boolean;
  entry: string;
  commands: Command[];
  views: View[];
  languageServers?: LanguageServer[];
}

export interface Command {
  id: string;
  title: string;
  category?: string;
  icon?: string;
  keybinding?: string;
  handler: () => void | Promise<void>;
}

export interface View {
  id: string;
  type: 'sidebar' | 'panel' | 'editor';
  title: string;
  icon?: string;
  render: () => React.ReactNode;
}

export interface LanguageServer {
  id: string;
  language: string;
  command: string;
  args: string[];
}

// ============================================================================
// EVENT TYPES
// ============================================================================

export type IDEEventType =
  | 'file_opened'
  | 'file_closed'
  | 'file_saved'
  | 'file_modified'
  | 'editor_changed'
  | 'selection_changed'
  | 'cursor_moved'
  | 'agent_started'
  | 'agent_completed'
  | 'agent_error'
  | 'model_changed'
  | 'model_loading'
  | 'model_error'
  | 'terminal_created'
  | 'terminal_closed'
  | 'command_executed'
  | 'settings_changed'
  | 'layout_changed'
  | 'plugin_enabled'
  | 'plugin_disabled';

export interface IDEEvent {
  id: string;
  type: IDEEventType;
  timestamp: Date;
  data: Record<string, unknown>;
  source: string;
}
