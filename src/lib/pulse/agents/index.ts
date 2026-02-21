/**
 * Kyro Agent Manager
 * Autonomous agent lifecycle and coordination
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  Agent,
  AgentType,
  AgentStatus,
  AgentHealth,
  AgentConfig,
  Task,
  ResourceUsage,
} from '@/types/pulse';
import { EventEmitter } from 'events';

// ============================================
// AGENT REGISTRY
// ============================================

class AgentRegistry {
  private agents: Map<string, Agent> = new Map();
  private nameToId: Map<string, string> = new Map();
  private emitter = new EventEmitter();

  register(agent: Agent): void {
    this.agents.set(agent.id, agent);
    this.nameToId.set(agent.name, agent.id);
    this.emitter.emit('registered', agent);
  }

  unregister(agentId: string): boolean {
    const agent = this.agents.get(agentId);
    if (!agent) return false;

    this.agents.delete(agentId);
    this.nameToId.delete(agent.name);
    this.emitter.emit('unregistered', agent);
    return true;
  }

  get(agentId: string): Agent | undefined {
    return this.agents.get(agentId);
  }

  getByName(name: string): Agent | undefined {
    const id = this.nameToId.get(name);
    return id ? this.agents.get(id) : undefined;
  }

  getAll(): Agent[] {
    return Array.from(this.agents.values());
  }

  getByStatus(status: AgentStatus): Agent[] {
    return this.getAll().filter((a) => a.status === status);
  }

  getByHealth(health: AgentHealth): Agent[] {
    return this.getAll().filter((a) => a.health === health);
  }

  update(agentId: string, updates: Partial<Agent>): Agent | undefined {
    const agent = this.agents.get(agentId);
    if (!agent) return undefined;

    const updated = { ...agent, ...updates };
    this.agents.set(agentId, updated);
    this.emitter.emit('updated', { previous: agent, current: updated });
    return updated;
  }

  onRegistered(callback: (agent: Agent) => void): () => void {
    this.emitter.on('registered', callback);
    return () => this.emitter.off('registered', callback);
  }

  onUpdated(callback: (data: { previous: Agent; current: Agent }) => void): () => void {
    this.emitter.on('updated', callback);
    return () => this.emitter.off('updated', callback);
  }
}

// ============================================
// AGENT HEALTH MONITOR
// ============================================

interface HealthCheckResult {
  agentId: string;
  status: AgentHealth;
  latency: number;
  issues: string[];
}

class AgentHealthMonitor {
  private registry: AgentRegistry;
  private checkInterval: NodeJS.Timeout | null = null;
  private heartbeatTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private emitter = new EventEmitter();
  private heartbeatInterval: number = 30000; // 30 seconds

  constructor(registry: AgentRegistry) {
    this.registry = registry;
  }

  start(intervalMs: number = 10000): void {
    this.heartbeatInterval = intervalMs;
    this.checkInterval = setInterval(() => {
      this.checkAllAgents();
    }, intervalMs);
  }

  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.heartbeatTimeouts.forEach((timeout) => clearTimeout(timeout));
    this.heartbeatTimeouts.clear();
  }

  private async checkAllAgents(): Promise<void> {
    const agents = this.registry.getAll();

    for (const agent of agents) {
      const result = await this.checkAgentHealth(agent);
      this.processHealthResult(agent, result);
    }
  }

  private async checkAgentHealth(agent: Agent): Promise<HealthCheckResult> {
    const issues: string[] = [];
    let status: AgentHealth = 'healthy';

    const startTime = Date.now();

    // Check heartbeat
    if (agent.lastHeartbeat) {
      const timeSinceLastHeartbeat = Date.now() - agent.lastHeartbeat.getTime();
      if (timeSinceLastHeartbeat > this.heartbeatInterval * 3) {
        status = 'unhealthy';
        issues.push('Heartbeat timeout');
      } else if (timeSinceLastHeartbeat > this.heartbeatInterval * 2) {
        status = 'degraded';
        issues.push('Heartbeat delayed');
      }
    } else {
      // No heartbeat yet
      if (agent.status !== 'idle') {
        status = 'degraded';
        issues.push('No heartbeat received');
      }
    }

    // Check failure rate
    const totalTasks = agent.successCount + agent.failureCount;
    if (totalTasks > 10) {
      const failureRate = agent.failureCount / totalTasks;
      if (failureRate > 0.5) {
        status = 'unhealthy';
        issues.push(`High failure rate: ${(failureRate * 100).toFixed(1)}%`);
      } else if (failureRate > 0.25) {
        if (status !== 'unhealthy') {
          status = 'degraded';
        }
        issues.push(`Elevated failure rate: ${(failureRate * 100).toFixed(1)}%`);
      }
    }

    // Check last error
    if (agent.lastError) {
      issues.push(`Last error: ${agent.lastError.substring(0, 50)}`);
    }

    return {
      agentId: agent.id,
      status,
      latency: Date.now() - startTime,
      issues,
    };
  }

  private processHealthResult(agent: Agent, result: HealthCheckResult): void {
    if (agent.health !== result.status) {
      this.registry.update(agent.id, { health: result.status });
      this.emitter.emit('healthChange', { agent, result });

      if (result.status === 'unhealthy') {
        this.emitter.emit('unhealthy', { agent, result });
      }
    }
  }

  recordHeartbeat(agentId: string): void {
    const agent = this.registry.get(agentId);
    if (!agent) return;

    this.registry.update(agentId, { lastHeartbeat: new Date() });

    // Clear existing timeout
    const existingTimeout = this.heartbeatTimeouts.get(agentId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Set new timeout
    const timeout = setTimeout(() => {
      const currentAgent = this.registry.get(agentId);
      if (currentAgent && currentAgent.health !== 'unhealthy') {
        this.registry.update(agentId, { health: 'unhealthy' });
        this.emitter.emit('healthChange', {
          agent: this.registry.get(agentId)!,
          result: {
            agentId,
            status: 'unhealthy',
            latency: 0,
            issues: ['Heartbeat timeout'],
          },
        });
      }
    }, this.heartbeatInterval * 3);

    this.heartbeatTimeouts.set(agentId, timeout);
  }

  onHealthChange(callback: (data: { agent: Agent; result: HealthCheckResult }) => void): () => void {
    this.emitter.on('healthChange', callback);
    return () => this.emitter.off('healthChange', callback);
  }

  onUnhealthy(callback: (data: { agent: Agent; result: HealthCheckResult }) => void): () => void {
    this.emitter.on('unhealthy', callback);
    return () => this.emitter.off('unhealthy', callback);
  }
}

// ============================================
// AGENT COORDINATOR
// ============================================

interface TaskAssignment {
  taskId: string;
  agentId: string;
  assignedAt: Date;
  priority: number;
}

class AgentCoordinator {
  private registry: AgentRegistry;
  private assignments: Map<string, TaskAssignment> = new Map();
  private taskQueue: Array<{ task: Task; priority: number }> = [];
  private emitter = new EventEmitter();

  constructor(registry: AgentRegistry) {
    this.registry = registry;
  }

  enqueueTask(task: Task): void {
    this.taskQueue.push({ task, priority: task.priority });
    this.taskQueue.sort((a, b) => b.priority - a.priority);
    this.emitter.emit('taskQueued', task);
    this.tryAssignTasks();
  }

  private tryAssignTasks(): void {
    while (this.taskQueue.length > 0) {
      const availableAgent = this.findAvailableAgent();
      if (!availableAgent) break;

      const { task } = this.taskQueue.shift()!;
      this.assignTask(task, availableAgent);
    }
  }

  private findAvailableAgent(): Agent | undefined {
    const agents = this.registry.getByStatus('idle');
    // Filter healthy agents
    const healthyAgents = agents.filter(
      (a) => a.health === 'healthy' || a.health === 'degraded'
    );

    if (healthyAgents.length === 0) return undefined;

    // Select agent with lowest task count
    return healthyAgents.reduce((best, current) =>
      current.taskCount < best.taskCount ? current : best
    );
  }

  private assignTask(task: Task, agent: Agent): void {
    const assignment: TaskAssignment = {
      taskId: task.id,
      agentId: agent.id,
      assignedAt: new Date(),
      priority: task.priority,
    };

    this.assignments.set(task.id, assignment);

    // Update agent status
    this.registry.update(agent.id, {
      status: 'executing',
      currentTask: task.id,
      taskCount: agent.taskCount + 1,
    });

    this.emitter.emit('taskAssigned', { task, agent, assignment });
  }

  completeTask(taskId: string, success: boolean): void {
    const assignment = this.assignments.get(taskId);
    if (!assignment) return;

    const agent = this.registry.get(assignment.agentId);
    if (!agent) return;

    this.registry.update(agent.id, {
      status: 'idle',
      currentTask: undefined,
      successCount: success ? agent.successCount + 1 : agent.successCount,
      failureCount: success ? agent.failureCount : agent.failureCount + 1,
    });

    this.assignments.delete(taskId);
    this.emitter.emit('taskCompleted', { taskId, agentId: agent.id, success });

    // Try to assign more tasks
    this.tryAssignTasks();
  }

  getAssignment(taskId: string): TaskAssignment | undefined {
    return this.assignments.get(taskId);
  }

  getAgentAssignments(agentId: string): TaskAssignment[] {
    return Array.from(this.assignments.values()).filter((a) => a.agentId === agentId);
  }

  getQueueLength(): number {
    return this.taskQueue.length;
  }

  onTaskQueued(callback: (task: Task) => void): () => void {
    this.emitter.on('taskQueued', callback);
    return () => this.emitter.off('taskQueued', callback);
  }

  onTaskAssigned(callback: (data: { task: Task; agent: Agent; assignment: TaskAssignment }) => void): () => void {
    this.emitter.on('taskAssigned', callback);
    return () => this.emitter.off('taskAssigned', callback);
  }

  onTaskCompleted(callback: (data: { taskId: string; agentId: string; success: boolean }) => void): () => void {
    this.emitter.on('taskCompleted', callback);
    return () => this.emitter.off('taskCompleted', callback);
  }
}

// ============================================
// AGENT MANAGER
// ============================================

export class AgentManager {
  private registry: AgentRegistry;
  private healthMonitor: AgentHealthMonitor;
  private coordinator: AgentCoordinator;
  private emitter = new EventEmitter();

  constructor() {
    this.registry = new AgentRegistry();
    this.healthMonitor = new AgentHealthMonitor(this.registry);
    this.coordinator = new AgentCoordinator(this.registry);

    // Forward events
    this.registry.onRegistered((agent) => this.emitter.emit('registered', agent));
    this.registry.onUpdated((data) => this.emitter.emit('updated', data));
    this.healthMonitor.onHealthChange((data) => this.emitter.emit('healthChange', data));
    this.healthMonitor.onUnhealthy((data) => this.emitter.emit('unhealthy', data));
    this.coordinator.onTaskQueued((task) => this.emitter.emit('taskQueued', task));
    this.coordinator.onTaskAssigned((data) => this.emitter.emit('taskAssigned', data));
    this.coordinator.onTaskCompleted((data) => this.emitter.emit('taskCompleted', data));
  }

  // ============================================
  // LIFECYCLE
  // ============================================

  start(): void {
    this.healthMonitor.start();
  }

  stop(): void {
    this.healthMonitor.stop();
  }

  // ============================================
  // AGENT OPERATIONS
  // ============================================

  spawn(name: string, type: AgentType, config?: Partial<AgentConfig>): Agent {
    const existingAgent = this.registry.getByName(name);
    if (existingAgent) {
      throw new Error(`Agent '${name}' already exists`);
    }

    const defaultConfig: AgentConfig = {
      maxConcurrentTasks: 1,
      heartbeatInterval: 30000,
      taskTimeout: 60000,
      retryPolicy: {
        maxRetries: 3,
        backoffMultiplier: 2,
        initialDelay: 1000,
        maxDelay: 30000,
      },
    };

    const agent: Agent = {
      id: uuidv4(),
      name,
      type,
      config: { ...defaultConfig, ...config },
      status: 'idle',
      health: 'healthy',
      taskCount: 0,
      successCount: 0,
      failureCount: 0,
      state: {},
    };

    this.registry.register(agent);
    this.emitter.emit('spawned', agent);

    return agent;
  }

  terminate(agentId: string): { success: boolean; error?: string } {
    const agent = this.registry.get(agentId);
    if (!agent) {
      return { success: false, error: 'Agent not found' };
    }

    if (agent.status === 'executing') {
      return { success: false, error: 'Cannot terminate agent while executing task' };
    }

    this.registry.unregister(agentId);
    this.emitter.emit('terminated', agent);

    return { success: true };
  }

  // ============================================
  // STATE MANAGEMENT
  // ============================================

  updateStatus(agentId: string, status: AgentStatus): Agent | undefined {
    const agent = this.registry.get(agentId);
    if (!agent) return undefined;

    const updated = this.registry.update(agentId, { status });
    this.emitter.emit('statusChange', { agent: updated!, previousStatus: agent.status });
    return updated;
  }

  updateState(agentId: string, state: Record<string, unknown>): Agent | undefined {
    return this.registry.update(agentId, { state });
  }

  recordHeartbeat(agentId: string): void {
    this.healthMonitor.recordHeartbeat(agentId);
  }

  recordError(agentId: string, error: string): Agent | undefined {
    return this.registry.update(agentId, { lastError: error });
  }

  // ============================================
  // TASK COORDINATION
  // ============================================

  submitTask(task: Task): void {
    this.coordinator.enqueueTask(task);
  }

  completeTask(taskId: string, success: boolean): void {
    this.coordinator.completeTask(taskId, success);
  }

  getTaskAssignment(taskId: string) {
    return this.coordinator.getAssignment(taskId);
  }

  // ============================================
  // QUERY OPERATIONS
  // ============================================

  get(agentId: string): Agent | undefined {
    return this.registry.get(agentId);
  }

  getByName(name: string): Agent | undefined {
    return this.registry.getByName(name);
  }

  getAll(): Agent[] {
    return this.registry.getAll();
  }

  getByStatus(status: AgentStatus): Agent[] {
    return this.registry.getByStatus(status);
  }

  getByHealth(health: AgentHealth): Agent[] {
    return this.registry.getByHealth(health);
  }

  getIdle(): Agent[] {
    return this.getByStatus('idle');
  }

  // ============================================
  // STATISTICS
  // ============================================

  getStats() {
    const agents = this.registry.getAll();

    return {
      total: agents.length,
      idle: agents.filter((a) => a.status === 'idle').length,
      executing: agents.filter((a) => a.status === 'executing').length,
      planning: agents.filter((a) => a.status === 'planning').length,
      waiting: agents.filter((a) => a.status === 'waiting').length,
      error: agents.filter((a) => a.status === 'error').length,
      healthy: agents.filter((a) => a.health === 'healthy').length,
      degraded: agents.filter((a) => a.health === 'degraded').length,
      unhealthy: agents.filter((a) => a.health === 'unhealthy').length,
      totalTasks: agents.reduce((sum, a) => sum + a.taskCount, 0),
      totalSuccesses: agents.reduce((sum, a) => sum + a.successCount, 0),
      totalFailures: agents.reduce((sum, a) => sum + a.failureCount, 0),
      queueLength: this.coordinator.getQueueLength(),
    };
  }

  // ============================================
  // EVENTS
  // ============================================

  onSpawned(callback: (agent: Agent) => void): () => void {
    this.emitter.on('spawned', callback);
    return () => this.emitter.off('spawned', callback);
  }

  onTerminated(callback: (agent: Agent) => void): () => void {
    this.emitter.on('terminated', callback);
    return () => this.emitter.off('terminated', callback);
  }

  onStatusChange(callback: (data: { agent: Agent; previousStatus: string }) => void): () => void {
    this.emitter.on('statusChange', callback);
    return () => this.emitter.off('statusChange', callback);
  }

  onHealthChange(callback: (data: { agent: Agent; result: HealthCheckResult }) => void): () => void {
    this.emitter.on('healthChange', callback);
    return () => this.emitter.off('healthChange', callback);
  }

  onTaskAssigned(callback: (data: { task: Task; agent: Agent; assignment: TaskAssignment }) => void): () => void {
    this.emitter.on('taskAssigned', callback);
    return () => this.emitter.off('taskAssigned', callback);
  }

  onTaskCompleted(callback: (data: { taskId: string; agentId: string; success: boolean }) => void): () => void {
    this.emitter.on('taskCompleted', callback);
    return () => this.emitter.off('taskCompleted', callback);
  }
}

export type { HealthCheckResult, TaskAssignment };
export const getAgentManager = (): AgentManager => new AgentManager();
