/**
 * Kyro - Programmable Intelligent Runtime Platform
 * Core Type Definitions
 */

// ============================================
// KERNEL TYPES
// ============================================

export type KernelState = 'init' | 'active' | 'paused' | 'shutdown';

export interface KernelStatus {
  state: KernelState;
  monotonicClock: number;
  uptime: number;
  version: string;
  lastHeartbeat: Date;
  queueLength: number;
  activeTasks: number;
  loadedModules: number;
  activeAgents: number;
}

export interface SystemConfiguration {
  key: string;
  value: string;
  category: string;
  description?: string;
  isSecret: boolean;
}

// ============================================
// EVENT TYPES
// ============================================

export type EventType =
  | 'kernel:init'
  | 'kernel:state_change'
  | 'kernel:shutdown'
  | 'task:create'
  | 'task:start'
  | 'task:complete'
  | 'task:fail'
  | 'task:cancel'
  | 'module:load'
  | 'module:unload'
  | 'module:error'
  | 'agent:spawn'
  | 'agent:heartbeat'
  | 'agent:error'
  | 'model:request'
  | 'model:response'
  | 'security:permission_request'
  | 'security:violation'
  | 'recovery:failure'
  | 'recovery:restore'
  | 'user:command'
  | 'system:alert';

export type EventPriority = 'critical' | 'high' | 'normal' | 'low';

export type EventStatus = 'pending' | 'processing' | 'processed' | 'failed';

export type SourceType = 'kernel' | 'module' | 'agent' | 'user' | 'system';

export interface Event<T = unknown> {
  id: string;
  timestamp: Date;
  eventType: EventType;
  sourceId: string;
  sourceType: SourceType;
  priority: EventPriority;
  payload: T;
  executionContext: ExecutionContext;
  status: EventStatus;
  processedAt?: Date;
  result?: unknown;
  retryCount: number;
}

export interface ExecutionContext {
  parentId?: string;
  sessionId?: string;
  correlationId?: string;
  metadata?: Record<string, unknown>;
}

export interface EventQueueStats {
  pending: number;
  processing: number;
  processed: number;
  failed: number;
  totalProcessed: number;
  averageLatency: number;
}

// ============================================
// TASK TYPES
// ============================================

export type TaskType = 'computation' | 'io' | 'agent' | 'model' | 'system';

export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface Task<T = unknown, R = unknown> {
  id: string;
  name: string;
  description?: string;
  type: TaskType;
  priority: number;
  status: TaskStatus;
  payload: T;
  result?: R;
  error?: string;
  sourceId: string;
  sourceType: SourceType;
  dependencies: string[];
  scheduledAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  timeout: number;
  retryCount: number;
  maxRetries: number;
  resourceBudget: ResourceBudget;
}

export interface TaskQueueStats {
  pending: number;
  running: number;
  completed: number;
  failed: number;
  cancelled: number;
  averageWaitTime: number;
  averageExecutionTime: number;
}

// ============================================
// MODULE TYPES
// ============================================

export type ModuleStatus = 'unloaded' | 'loading' | 'loaded' | 'active' | 'error';

export interface ModuleManifest {
  name: string;
  version: string;
  description?: string;
  entryPoint: string;
  runtimeVersion: string;
  permissions: string[];
  dependencies: ModuleDependency[];
  provides: string[];
  config?: Record<string, unknown>;
}

export interface ModuleDependency {
  name: string;
  version?: string;
  optional?: boolean;
}

export interface Module {
  id: string;
  name: string;
  version: string;
  description?: string;
  entryPoint: string;
  manifest: ModuleManifest;
  permissions: string[];
  dependencies: string[];
  status: ModuleStatus;
  isEnabled: boolean;
  loadedAt?: Date;
  lastError?: string;
  resourceUsage: ResourceUsage;
}

// ============================================
// AGENT TYPES
// ============================================

export type AgentType = 'reactive' | 'deliberative' | 'hybrid';

export type AgentStatus = 'idle' | 'planning' | 'executing' | 'waiting' | 'error';

export type AgentHealth = 'healthy' | 'degraded' | 'unhealthy';

export interface AgentConfig {
  maxConcurrentTasks: number;
  heartbeatInterval: number;
  taskTimeout: number;
  retryPolicy: RetryPolicy;
}

export interface RetryPolicy {
  maxRetries: number;
  backoffMultiplier: number;
  initialDelay: number;
  maxDelay: number;
}

export interface Agent {
  id: string;
  name: string;
  type: AgentType;
  description?: string;
  config: AgentConfig;
  status: AgentStatus;
  health: AgentHealth;
  lastHeartbeat?: Date;
  lastError?: string;
  taskCount: number;
  successCount: number;
  failureCount: number;
  currentTask?: string;
  state: Record<string, unknown>;
}

// ============================================
// MODEL TYPES
// ============================================

export type ModelProviderType = 'local' | 'api' | 'hybrid';

export type ModelProviderStatus = 'available' | 'busy' | 'error' | 'offline';

export type ModelType = 'chat' | 'completion' | 'embedding' | 'image';

export interface ModelCapabilities {
  types: ModelType[];
  maxTokens: number;
  streaming: boolean;
  functionCalling: boolean;
  vision: boolean;
}

export interface ModelProvider {
  id: string;
  name: string;
  type: ModelProviderType;
  provider: string;
  config: Record<string, unknown>;
  capabilities: ModelCapabilities;
  status: ModelProviderStatus;
  priority: number;
  latency: number;
  costPerToken?: number;
  isEnabled: boolean;
  lastUsed?: Date;
  requestCount: number;
  errorCount: number;
}

export interface ModelRequest {
  id: string;
  providerId: string;
  modelType: ModelType;
  prompt: string;
  response?: string;
  tokensUsed: number;
  latency: number;
  status: 'success' | 'error' | 'timeout';
  errorMessage?: string;
  complexity?: number;
  routedBy?: string;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface ChatResponse {
  content: string;
  tokensUsed: number;
  latency: number;
  provider: string;
  model: string;
}

// ============================================
// RESOURCE TYPES
// ============================================

export interface ResourceBudget {
  cpuLimit: number; // percentage
  memoryLimit: number; // MB
  timeLimit: number; // ms
  priority: number;
}

export interface ResourceUsage {
  cpu: number; // current usage percentage
  memory: number; // current usage MB
  time: number; // execution time ms
  peak: {
    cpu: number;
    memory: number;
  };
}

export interface SystemResources {
  cpu: {
    usage: number;
    cores: number;
    loadAverage: number[];
  };
  memory: {
    total: number;
    used: number;
    free: number;
    percentage: number;
  };
  uptime: number;
}

// ============================================
// SECURITY TYPES
// ============================================

export type PermissionCategory = 'system' | 'storage' | 'network' | 'model' | 'agent';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface Permission {
  id: string;
  name: string;
  description?: string;
  category: PermissionCategory;
  riskLevel: RiskLevel;
  isEnabled: boolean;
}

export interface Policy {
  id: string;
  name: string;
  description?: string;
  entityType: 'module' | 'agent' | 'user';
  entityId?: string;
  permissions: string[];
  constraints?: Record<string, unknown>;
  priority: number;
  isEnabled: boolean;
}

export type AuditAction = 'grant' | 'revoke' | 'deny' | 'access';

export type AuditOutcome = 'allowed' | 'denied' | 'error';

export interface AuditLog {
  id: string;
  timestamp: Date;
  action: AuditAction;
  entityType: 'module' | 'agent' | 'user';
  entityId: string;
  permission?: string;
  resource?: string;
  outcome: AuditOutcome;
  reason?: string;
  metadata?: Record<string, unknown>;
}

// ============================================
// LOGGING TYPES
// ============================================

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'critical';

export type LogCategory = 'system' | 'event' | 'task' | 'security' | 'model' | 'agent';

export interface LogEntry {
  id: string;
  timestamp: Date;
  level: LogLevel;
  message: string;
  sourceId?: string;
  sourceType?: SourceType;
  category?: LogCategory;
  metadata?: Record<string, unknown>;
  duration?: number;
  outcome?: 'success' | 'failure' | 'partial';
}

// ============================================
// METRIC TYPES
// ============================================

export type MetricType =
  | 'cpu'
  | 'memory'
  | 'latency'
  | 'queue_length'
  | 'throughput'
  | 'error_rate'
  | 'cache_hit'
  | 'model_latency'
  | 'task_duration';

export interface Metric {
  id: string;
  timestamp: Date;
  metricType: MetricType;
  value: number;
  unit: string;
  sourceId?: string;
  sourceType?: SourceType;
  tags?: Record<string, string>;
}

export interface MetricsSnapshot {
  timestamp: Date;
  cpu: number;
  memory: number;
  latency: number;
  queueLength: number;
  throughput: number;
  errorRate: number;
  activeTasks: number;
  activeAgents: number;
  loadedModules: number;
}

// ============================================
// MEMORY TYPES
// ============================================

export type MemoryType = 'fact' | 'rule' | 'procedure' | 'context';

export interface MemoryRecord {
  id: string;
  key: string;
  value: unknown;
  type: MemoryType;
  source?: string;
  importance: number;
  accessCount: number;
  lastAccessed?: Date;
  expiresAt?: Date;
  tags: string[];
}

// ============================================
// RECOVERY TYPES
// ============================================

export type FailureType = 'crash' | 'timeout' | 'resource_exhaustion' | 'error';

export type Severity = 'low' | 'medium' | 'high' | 'critical';

export type RecoveryAction = 'restart' | 'reload' | 'skip' | 'escalate';

export type RecoveryStatus = 'pending' | 'recovered' | 'failed';

export interface FailureRecord {
  id: string;
  timestamp: Date;
  entityType: 'module' | 'agent' | 'task';
  entityId: string;
  failureType: FailureType;
  severity: Severity;
  message?: string;
  stackTrace?: string;
  recoveryAction?: RecoveryAction;
  recoveredAt?: Date;
  recoveryStatus: RecoveryStatus;
}

export interface Checkpoint {
  id: string;
  entityType: 'kernel' | 'module' | 'agent';
  entityId: string;
  state: Record<string, unknown>;
  version: number;
}

// ============================================
// API RESPONSE TYPES
// ============================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: Date;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// ============================================
// UTILITY TYPES
// ============================================

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type EventCallback<T = unknown> = (event: Event<T>) => void | Promise<void>;

export type TaskExecutor<T = unknown, R = unknown> = (task: Task<T, R>) => Promise<R>;
