/**
 * PULSE - Programmable Intelligent Runtime Platform
 * Main platform integration module
 */

import { PulseRuntimeKernel, getKernel } from './kernel';
import { ExecutionEngine, getExecutionEngine } from './execution';
import { ResourceGovernance, getResourceGovernance } from './resources';
import { StorageManager, getStorage } from './storage';
import { ModuleManager, getModuleManager } from './modules';
import { AgentManager, getAgentManager } from './agents';
import { ModelManager, getModelManager } from './models';
import { SecurityManager, getSecurityManager } from './security';
import { ObservabilityManager, getObservability } from './observability';
import { RecoveryManager, getRecoveryManager } from './recovery';
import type {
  KernelStatus,
  Event,
  Task,
  Module,
  Agent,
  ModelProvider,
  ChatRequest,
  ChatResponse,
  ResourceBudget,
  Permission,
  Policy,
} from '@/types/pulse';

// ============================================
// PULSE PLATFORM
// ============================================

export class PulsePlatform {
  private static instance: PulsePlatform | null = null;
  private initialized: boolean = false;

  // Core components
  public readonly kernel: PulseRuntimeKernel;
  public readonly execution: ExecutionEngine;
  public readonly resources: ResourceGovernance;
  public readonly storage: StorageManager;
  public readonly modules: ModuleManager;
  public readonly agents: AgentManager;
  public readonly models: ModelManager;
  public readonly security: SecurityManager;
  public readonly observability: ObservabilityManager;
  public readonly recovery: RecoveryManager;

  private constructor() {
    this.kernel = getKernel();
    this.execution = getExecutionEngine();
    this.resources = getResourceGovernance();
    this.storage = getStorage();
    this.modules = getModuleManager();
    this.agents = getAgentManager();
    this.models = getModelManager();
    this.security = getSecurityManager();
    this.observability = getObservability();
    this.recovery = getRecoveryManager();

    this.setupIntegration();
  }

  static getInstance(): PulsePlatform {
    if (!PulsePlatform.instance) {
      PulsePlatform.instance = new PulsePlatform();
    }
    return PulsePlatform.instance;
  }

  private setupIntegration(): void {
    // Connect kernel events to observability
    this.kernel.onLog((log) => {
      this.observability.log.log(log.level as any, log.message, {
        category: log.category as any,
        metadata: log.metadata,
      });
    });

    // Connect resources to adaptive behavior
    this.resources.onPressure((data) => {
      this.observability.log.warn(`Resource pressure detected: ${data.type}`, {
        metadata: data,
      });
    });

    this.resources.onAdaptation((data) => {
      this.observability.log.info(`Adaptive action triggered: ${data.actions.join(', ')}`, {
        metadata: { snapshot: data.snapshot },
      });
    });

    // Connect agents to recovery
    this.agents.onHealthChange((data) => {
      if (data.result.status === 'unhealthy') {
        this.recovery.detectFailure({
          entityId: data.agent.id,
          entityType: 'agent',
          failureType: 'timeout',
          severity: 'high',
          message: `Agent ${data.agent.name} is unhealthy: ${data.result.issues.join(', ')}`,
        });
      }
    });

    // Connect security to audit
    this.security.onAudit((log) => {
      this.observability.log.security(
        `${log.action} by ${log.entityType}:${log.entityId}`,
        { permission: log.permission, resource: log.resource },
        log.outcome === 'allowed'
      );
    });

    // Connect model operations
    this.models.onCompletion((data) => {
      this.observability.metric.latency(data.latency);
      this.observability.log.debug(`Model completion: ${data.model}`, {
        metadata: { tokens: data.tokensUsed },
      });
    });

    // Connect recovery to logging
    this.recovery.onFailure((record) => {
      this.observability.log.error(`Failure detected: ${record.failureType}`, {
        metadata: { entityId: record.entityId, severity: record.severity },
      });
    });

    this.recovery.onRecovery((data) => {
      this.observability.log.info(`Recovery ${data.success ? 'succeeded' : 'failed'}: ${data.action}`, {
        metadata: { record: data.record },
      });
    });
  }

  // ============================================
  // INITIALIZATION
  // ============================================

  async initialize(): Promise<void> {
    if (this.initialized) return;

    this.observability.log.info('Initializing PULSE platform...');

    try {
      // Initialize model manager (loads default providers)
      await this.models.initialize();

      // Start resource monitoring
      this.resources.start(5000);

      // Start agent health monitoring
      this.agents.start();

      // Initialize kernel
      await this.kernel.initialize();

      // Create checkpoint for initial state
      this.recovery.saveState('kernel', 'main', {
        state: this.kernel.getState(),
        clock: this.kernel.getClock(),
      });

      this.initialized = true;
      this.observability.log.info('PULSE platform initialized successfully');
    } catch (error) {
      this.observability.log.critical('Failed to initialize PULSE platform', {
        metadata: { error: error instanceof Error ? error.message : String(error) },
      });
      throw error;
    }
  }

  // ============================================
  // KERNEL OPERATIONS
  // ============================================

  getStatus(): KernelStatus {
    return this.kernel.getStatus();
  }

  getState() {
    return this.kernel.getState();
  }

  async pause(): Promise<boolean> {
    const result = await this.kernel.pause();
    if (result) {
      this.observability.log.info('Platform paused');
    }
    return result;
  }

  async resume(): Promise<boolean> {
    const result = await this.kernel.resume();
    if (result) {
      this.observability.log.info('Platform resumed');
    }
    return result;
  }

  async shutdown(): Promise<void> {
    this.observability.log.info('Shutting down PULSE platform...');
    await this.kernel.shutdown();
    this.resources.stop();
    this.agents.stop();
    this.observability.log.info('Platform shutdown complete');
  }

  // ============================================
  // EVENT OPERATIONS
  // ============================================

  submitEvent(event: Omit<Event, 'id' | 'timestamp' | 'status' | 'retryCount'>): Event {
    return this.kernel.submitEvent(
      event.eventType,
      event.sourceId,
      event.sourceType,
      event.payload,
      event.executionContext,
      event.priority
    );
  }

  subscribeToEvent(eventType: string, handler: (event: Event) => Promise<void>): () => void {
    return this.kernel.subscribe(eventType as any, handler);
  }

  // ============================================
  // TASK OPERATIONS
  // ============================================

  submitTask(task: Omit<Task, 'id'>, executor: () => Promise<unknown>): string {
    const fullTask: Task = {
      ...task,
      id: this.kernel.generateId(),
    };

    this.kernel.scheduleTask(fullTask, executor);
    this.observability.log.taskStart(fullTask.id, fullTask.name);

    return fullTask.id;
  }

  cancelTask(taskId: string): boolean {
    return this.kernel.cancelTask(taskId);
  }

  // ============================================
  // MODULE OPERATIONS
  // ============================================

  async installModule(manifest: any, sourcePath: string) {
    return this.modules.install(manifest, sourcePath);
  }

  async uninstallModule(moduleId: string) {
    return this.modules.uninstall(moduleId);
  }

  getModules(): Module[] {
    return this.modules.getAll();
  }

  // ============================================
  // AGENT OPERATIONS
  // ============================================

  spawnAgent(name: string, type: any, config?: any): Agent {
    return this.agents.spawn(name, type, config);
  }

  terminateAgent(agentId: string) {
    return this.agents.terminate(agentId);
  }

  getAgents(): Agent[] {
    return this.agents.getAll();
  }

  // ============================================
  // MODEL OPERATIONS
  // ============================================

  async chat(request: ChatRequest): Promise<ChatResponse> {
    return this.models.chat(request);
  }

  async generateImage(prompt: string, size?: any): Promise<string> {
    return this.models.generateImage(prompt, size);
  }

  getModelProviders(): ModelProvider[] {
    return this.models.getProviders();
  }

  // ============================================
  // RESOURCE OPERATIONS
  // ============================================

  getCurrentResources() {
    return this.resources.getCurrentResources();
  }

  setResourceBudget(entityType: string, entityId: string, budget: Partial<ResourceBudget>) {
    return this.resources.setBudget(entityType, entityId, budget);
  }

  // ============================================
  // SECURITY OPERATIONS
  // ============================================

  checkPermission(entityType: 'module' | 'agent' | 'user', entityId: string, permission: string) {
    return this.security.checkPermission(entityType, entityId, permission);
  }

  registerPolicy(policy: Policy) {
    this.security.registerPolicy(policy);
  }

  getAuditLogs(limit?: number) {
    return this.security.getAuditLogs(limit);
  }

  // ============================================
  // OBSERVABILITY
  // ============================================

  getLogs(limit?: number, filters?: any) {
    return this.observability.log.getLogs(limit, filters);
  }

  getMetrics(limit?: number, filters?: any) {
    return this.observability.metric.getMetrics(limit, filters);
  }

  getDashboardData() {
    return this.observability.getDashboardData();
  }

  // ============================================
  // RECOVERY OPERATIONS
  // ============================================

  getFailures(limit?: number) {
    return this.recovery.getFailures(limit);
  }

  getCheckpoints() {
    return this.recovery.getCheckpoints();
  }

  // ============================================
  // COMPREHENSIVE STATUS
  // ============================================

  getComprehensiveStatus() {
    return {
      kernel: this.kernel.getStatus(),
      events: this.kernel.getEventStats(),
      tasks: this.kernel.getTaskStats(),
      modules: this.modules.getStats(),
      agents: this.agents.getStats(),
      models: this.models.getStats(),
      resources: this.resources.getAggregatedStats(),
      security: this.security.getAuditStats(),
      observability: this.observability.getDashboardData(),
      recovery: this.recovery.getStats(),
    };
  }
}

// Export singleton getter
export const getPulse = (): PulsePlatform => PulsePlatform.getInstance();

// Export all types
export * from '@/types/pulse';

// Export all component getters
export { getKernel } from './kernel';
export { getExecutionEngine } from './execution';
export { getResourceGovernance } from './resources';
export { getStorage } from './storage';
export { getModuleManager } from './modules';
export { getAgentManager } from './agents';
export { getModelManager } from './models';
export { getSecurityManager } from './security';
export { getObservability } from './observability';
export { getRecoveryManager } from './recovery';

// Export premium IDE features
export * from './debugger';
export * from './analysis';
export * from './collab';
export * from './testing';
export * from './remote';
export * from './semantic';
export * from './pico';

// Export profiler module
export * from './profiler';

// Export database module
export * from './database';

// Export AI completion
export {
  CompletionValidator,
  CompletionProvider,
  FullLineCompletion,
  InlineCompletionProvider,
  inlineCompletionProvider,
  type CompletionContext,
  type RawCompletion,
  type ValidatedCompletion,
  type CompletionKind,
  type ValidationError,
  type CompletionOptions,
} from './ai/completion';
