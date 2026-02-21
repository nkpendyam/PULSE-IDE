/**
 * Kyro Execution Engine
 * Isolated task execution with resource limits
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  Task,
  TaskStatus,
  TaskType,
  ResourceBudget,
  ResourceUsage,
  SourceType,
} from '@/types/pulse';
import { EventEmitter } from 'events';

// ============================================
// RESOURCE LIMITER
// ============================================

interface ResourceLimits {
  maxCpu: number; // percentage
  maxMemory: number; // MB
  maxTime: number; // ms
  maxConcurrent: number;
}

class ResourceLimiter {
  private limits: Map<string, ResourceLimits> = new Map();
  private usage: Map<string, ResourceUsage> = new Map();
  private globalLimits: ResourceLimits = {
    maxCpu: 100,
    maxMemory: 2048,
    maxTime: 60000,
    maxConcurrent: 10,
  };

  setLimits(id: string, limits: Partial<ResourceLimits>): void {
    const existing = this.limits.get(id) || { ...this.globalLimits };
    this.limits.set(id, { ...existing, ...limits });
  }

  getLimits(id: string): ResourceLimits {
    return this.limits.get(id) || this.globalLimits;
  }

  startTracking(id: string): void {
    this.usage.set(id, {
      cpu: 0,
      memory: 0,
      time: 0,
      peak: { cpu: 0, memory: 0 },
    });
  }

  updateUsage(id: string, cpu: number, memory: number): void {
    const usage = this.usage.get(id);
    if (usage) {
      usage.cpu = cpu;
      usage.memory = memory;
      usage.time += 100; // Approximate time increment
      usage.peak.cpu = Math.max(usage.peak.cpu, cpu);
      usage.peak.memory = Math.max(usage.peak.memory, memory);
    }
  }

  stopTracking(id: string): ResourceUsage | undefined {
    const usage = this.usage.get(id);
    this.usage.delete(id);
    return usage;
  }

  checkLimits(id: string): { exceeded: boolean; reason?: string } {
    const limits = this.getLimits(id);
    const usage = this.usage.get(id);

    if (!usage) {
      return { exceeded: false };
    }

    if (usage.cpu > limits.maxCpu) {
      return { exceeded: true, reason: `CPU limit exceeded: ${usage.cpu}% > ${limits.maxCpu}%` };
    }

    if (usage.memory > limits.maxMemory) {
      return { exceeded: true, reason: `Memory limit exceeded: ${usage.memory}MB > ${limits.maxMemory}MB` };
    }

    if (usage.time > limits.maxTime) {
      return { exceeded: true, reason: `Time limit exceeded: ${usage.time}ms > ${limits.maxTime}ms` };
    }

    return { exceeded: false };
  }

  getTotalUsage(): { cpu: number; memory: number; count: number } {
    let totalCpu = 0;
    let totalMemory = 0;

    for (const usage of this.usage.values()) {
      totalCpu += usage.cpu;
      totalMemory += usage.memory;
    }

    return {
      cpu: totalCpu,
      memory: totalMemory,
      count: this.usage.size,
    };
  }
}

// ============================================
// TASK ISOLATOR
// ============================================

interface IsolatedExecutionContext {
  id: string;
  task: Task;
  startTime: number;
  status: 'running' | 'completed' | 'failed' | 'timeout' | 'killed';
  result?: unknown;
  error?: string;
}

class TaskIsolator {
  private contexts: Map<string, IsolatedExecutionContext> = new Map();
  private limiter: ResourceLimiter;
  private emitter = new EventEmitter();

  constructor(limiter: ResourceLimiter) {
    this.limiter = limiter;
  }

  async execute<T = unknown, R = unknown>(
    task: Task<T, R>,
    executor: (payload: T) => Promise<R>,
    onProgress?: (progress: number) => void
  ): Promise<R> {
    const contextId = uuidv4();
    const context: IsolatedExecutionContext = {
      id: contextId,
      task,
      startTime: Date.now(),
      status: 'running',
    };

    this.contexts.set(contextId, context);
    this.limiter.startTracking(contextId);

    // Simulate resource monitoring
    const monitorInterval = setInterval(() => {
      // Simulate resource usage (in real implementation, would measure actual usage)
      const cpu = Math.random() * 30 + 10; // 10-40% CPU
      const memory = Math.random() * 100 + 50; // 50-150 MB
      this.limiter.updateUsage(contextId, cpu, memory);

      // Check limits
      const limitCheck = this.limiter.checkLimits(contextId);
      if (limitCheck.exceeded) {
        context.status = 'killed';
        context.error = limitCheck.reason;
        clearInterval(monitorInterval);
        throw new Error(limitCheck.reason);
      }

      // Progress callback
      if (onProgress) {
        const elapsed = Date.now() - context.startTime;
        const progress = Math.min((elapsed / task.timeout) * 100, 99);
        onProgress(progress);
      }
    }, 100);

    try {
      // Execute with timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          context.status = 'timeout';
          reject(new Error(`Task timeout after ${task.timeout}ms`));
        }, task.timeout);
      });

      const result = await Promise.race([
        executor(task.payload),
        timeoutPromise,
      ]) as R;

      context.status = 'completed';
      context.result = result;

      return result;
    } catch (error) {
      context.status = 'failed';
      context.error = error instanceof Error ? error.message : String(error);
      throw error;
    } finally {
      clearInterval(monitorInterval);
      const usage = this.limiter.stopTracking(contextId);
      this.emitter.emit('taskComplete', { context, usage });
      this.contexts.delete(contextId);
    }
  }

  kill(contextId: string): boolean {
    const context = this.contexts.get(contextId);
    if (context && context.status === 'running') {
      context.status = 'killed';
      context.error = 'Task killed by request';
      return true;
    }
    return false;
  }

  getActiveCount(): number {
    return Array.from(this.contexts.values()).filter(
      (c) => c.status === 'running'
    ).length;
  }

  onComplete(callback: (data: { context: IsolatedExecutionContext; usage?: ResourceUsage }) => void): void {
    this.emitter.on('taskComplete', callback);
  }
}

// ============================================
// EXECUTION ENGINE
// ============================================

export class ExecutionEngine {
  private isolator: TaskIsolator;
  private limiter: ResourceLimiter;
  private taskRegistry: Map<string, {
    task: Task;
    executor: (payload: unknown) => Promise<unknown>;
    status: TaskStatus;
  }> = new Map();
  private priorityQueue: string[] = [];
  private emitter = new EventEmitter();
  private isRunning: boolean = false;
  private maxConcurrent: number = 4;
  private activeCount: number = 0;
  private stats = {
    totalExecuted: 0,
    totalSucceeded: 0,
    totalFailed: 0,
    totalTimeouts: 0,
    totalKilled: 0,
  };

  constructor() {
    this.limiter = new ResourceLimiter();
    this.isolator = new TaskIsolator(this.limiter);

    this.isolator.onComplete(({ context, usage }) => {
      const entry = this.taskRegistry.get(context.task.id);
      if (entry) {
        entry.status = context.status === 'completed' ? 'completed' : 'failed';
        this.activeCount--;
        this.stats.totalExecuted++;

        if (context.status === 'completed') {
          this.stats.totalSucceeded++;
        } else if (context.status === 'timeout') {
          this.stats.totalTimeouts++;
        } else if (context.status === 'killed') {
          this.stats.totalKilled++;
        } else {
          this.stats.totalFailed++;
        }

        this.emitter.emit('taskComplete', {
          taskId: context.task.id,
          status: entry.status,
          result: context.result,
          error: context.error,
          usage,
        });
      }
    });
  }

  submit<T = unknown, R = unknown>(
    task: Task<T, R>,
    executor: (payload: T) => Promise<R>,
    budget?: Partial<ResourceBudget>
  ): void {
    // Set resource limits
    if (budget) {
      this.limiter.setLimits(task.id, {
        maxCpu: budget.cpuLimit,
        maxMemory: budget.memoryLimit,
        maxTime: budget.timeLimit,
      });
    }

    // Register task
    this.taskRegistry.set(task.id, {
      task,
      executor: executor as (payload: unknown) => Promise<unknown>,
      status: 'pending',
    });

    // Add to priority queue
    this.priorityQueue.push(task.id);
    this.priorityQueue.sort((a, b) => {
      const taskA = this.taskRegistry.get(a)?.task;
      const taskB = this.taskRegistry.get(b)?.task;
      return (taskB?.priority || 0) - (taskA?.priority || 0);
    });

    this.emitter.emit('taskSubmitted', task);

    // Try to execute
    this.tryExecuteNext();
  }

  private async tryExecuteNext(): Promise<void> {
    while (this.activeCount < this.maxConcurrent && this.priorityQueue.length > 0) {
      const taskId = this.priorityQueue.shift();
      if (!taskId) break;

      const entry = this.taskRegistry.get(taskId);
      if (!entry) continue;

      // Check dependencies
      const depsComplete = entry.task.dependencies.every((depId) => {
        const dep = this.taskRegistry.get(depId);
        return dep?.status === 'completed';
      });

      if (!depsComplete) {
        // Re-queue for later
        this.priorityQueue.push(taskId);
        continue;
      }

      this.executeTask(taskId);
    }
  }

  private async executeTask(taskId: string): Promise<void> {
    const entry = this.taskRegistry.get(taskId);
    if (!entry) return;

    entry.status = 'running';
    this.activeCount++;
    entry.task.status = 'running';
    entry.task.startedAt = new Date();

    this.emitter.emit('taskStarted', entry.task);

    try {
      const result = await this.isolator.execute(
        entry.task,
        entry.executor,
        (progress) => {
          this.emitter.emit('taskProgress', { taskId, progress });
        }
      );

      entry.task.result = result;
      entry.task.status = 'completed';
      entry.task.completedAt = new Date();
    } catch (error) {
      entry.task.error = error instanceof Error ? error.message : String(error);
      entry.task.retryCount++;

      if (entry.task.retryCount < entry.task.maxRetries) {
        // Retry
        entry.status = 'pending';
        entry.task.status = 'pending';
        setTimeout(() => {
          this.priorityQueue.push(taskId);
          this.tryExecuteNext();
        }, 1000 * entry.task.retryCount);
      } else {
        entry.status = 'failed';
        entry.task.status = 'failed';
        this.emitter.emit('taskFailed', { task: entry.task, error });
      }
    }
  }

  cancel(taskId: string): boolean {
    const entry = this.taskRegistry.get(taskId);
    if (!entry) return false;

    if (entry.status === 'pending') {
      // Remove from queue
      const index = this.priorityQueue.indexOf(taskId);
      if (index !== -1) {
        this.priorityQueue.splice(index, 1);
      }
      entry.status = 'cancelled';
      entry.task.status = 'cancelled';
      return true;
    }

    if (entry.status === 'running') {
      // Try to kill
      for (const [contextId, context] of this.isolator['contexts'].entries()) {
        if (context.task.id === taskId) {
          return this.isolator.kill(contextId);
        }
      }
    }

    return false;
  }

  getStats() {
    return {
      ...this.stats,
      active: this.activeCount,
      pending: this.priorityQueue.length,
      registered: this.taskRegistry.size,
    };
  }

  getResourceUsage() {
    return this.limiter.getTotalUsage();
  }

  setMaxConcurrent(max: number): void {
    this.maxConcurrent = max;
    this.tryExecuteNext();
  }

  onTaskSubmitted(callback: (task: Task) => void): () => void {
    this.emitter.on('taskSubmitted', callback);
    return () => this.emitter.off('taskSubmitted', callback);
  }

  onTaskStarted(callback: (task: Task) => void): () => void {
    this.emitter.on('taskStarted', callback);
    return () => this.emitter.off('taskStarted', callback);
  }

  onTaskComplete(callback: (data: { taskId: string; status: string; result?: unknown; error?: string; usage?: ResourceUsage }) => void): () => void {
    this.emitter.on('taskComplete', callback);
    return () => this.emitter.off('taskComplete', callback);
  }

  onTaskFailed(callback: (data: { task: Task; error: unknown }) => void): () => void {
    this.emitter.on('taskFailed', callback);
    return () => this.emitter.off('taskFailed', callback);
  }

  onTaskProgress(callback: (data: { taskId: string; progress: number }) => void): () => void {
    this.emitter.on('taskProgress', callback);
    return () => this.emitter.off('taskProgress', callback);
  }
}

export const getExecutionEngine = (): ExecutionEngine => {
  return new ExecutionEngine();
};
