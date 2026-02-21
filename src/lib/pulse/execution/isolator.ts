// Kyro Task Isolator
// Provides isolated execution context for tasks

import type { Task, TaskResult, ResourceBudget } from '@/types/pulse';
import { ResourceLimiter, getResourceLimiter, type LimitViolation } from './limits';

export interface IsolationContext {
  taskId: string;
  startTime: number;
  memory: {
    heap: number;
    external: number;
  };
  cancelled: boolean;
  cancelReason?: string;
}

export interface IsolationResult {
  success: boolean;
  result?: unknown;
  error?: string;
  resourceUsage: {
    cpu: number;
    memory: number;
    time: number;
  };
  cancelled: boolean;
  cancelReason?: string;
}

export type TaskExecutor = (
  task: Task,
  context: IsolationContext,
  signal: AbortSignal
) => Promise<unknown> | unknown;

export class TaskIsolator {
  private limiter: ResourceLimiter;
  private activeContexts: Map<string, IsolationContext> = new Map();
  private abortControllers: Map<string, AbortController> = new Map();
  private executors: Map<string, TaskExecutor> = new Map();

  constructor() {
    this.limiter = getResourceLimiter();
    
    // Set up limit violation handler
    this.limiter.onViolation((taskId, violation) => {
      if (violation.type === 'memory' || violation.type === 'time') {
        this.cancelTask(taskId, `Resource limit exceeded: ${violation.type}`);
      }
    });
  }

  // Register an executor for a task type
  registerExecutor(taskType: string, executor: TaskExecutor): void {
    this.executors.set(taskType, executor);
  }

  // Execute a task in isolation
  async execute(
    task: Task,
    budget?: ResourceBudget
  ): Promise<IsolationResult> {
    const startTime = Date.now();
    const abortController = new AbortController();
    
    // Create isolation context
    const context: IsolationContext = {
      taskId: task.id,
      startTime,
      memory: { heap: 0, external: 0 },
      cancelled: false,
    };

    this.activeContexts.set(task.id, context);
    this.abortControllers.set(task.id, abortController);

    // Start resource tracking
    this.limiter.startTracking(task.id, budget || this.limiter.getBudgetByType(task.type));

    try {
      // Get executor
      const executor = this.executors.get(task.type) || this.defaultExecutor;
      
      // Execute with timeout
      const timeoutId = setTimeout(() => {
        this.cancelTask(task.id, 'Execution timeout');
      }, task.timeout);

      // Memory monitoring interval
      const memoryInterval = setInterval(() => {
        const memUsage = process.memoryUsage();
        const violations = this.limiter.updateUsage(task.id, {
          memory: Math.round(memUsage.heapUsed / 1024 / 1024),
          cpu: 0, // Would need proper CPU monitoring
        });

        if (violations.length > 0) {
          context.memory.heap = memUsage.heapUsed;
          context.memory.external = memUsage.external;
        }
      }, 100);

      // Execute task
      let result: unknown;
      try {
        result = await executor(task, context, abortController.signal);
      } finally {
        clearTimeout(timeoutId);
        clearInterval(memoryInterval);
      }

      // Get final resource usage
      const usage = this.limiter.stopTracking(task.id);
      
      return {
        success: true,
        result,
        resourceUsage: {
          cpu: usage?.cpu || 0,
          memory: usage?.memory || 0,
          time: Date.now() - startTime,
        },
        cancelled: context.cancelled,
        cancelReason: context.cancelReason,
      };
    } catch (error) {
      this.limiter.stopTracking(task.id);
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      return {
        success: false,
        error: errorMessage,
        resourceUsage: {
          cpu: 0,
          memory: 0,
          time: Date.now() - startTime,
        },
        cancelled: context.cancelled,
        cancelReason: context.cancelReason,
      };
    } finally {
      this.activeContexts.delete(task.id);
      this.abortControllers.delete(task.id);
    }
  }

  // Default executor (just returns the payload)
  private defaultExecutor: TaskExecutor = async (task) => {
    return task.payload;
  };

  // Cancel a running task
  cancelTask(taskId: string, reason: string): void {
    const context = this.activeContexts.get(taskId);
    const controller = this.abortControllers.get(taskId);

    if (context) {
      context.cancelled = true;
      context.cancelReason = reason;
    }

    if (controller) {
      controller.abort(reason);
    }
  }

  // Check if task is cancelled
  isCancelled(taskId: string): boolean {
    return this.activeContexts.get(taskId)?.cancelled || false;
  }

  // Get active task count
  getActiveCount(): number {
    return this.activeContexts.size;
  }

  // Get all active task IDs
  getActiveTasks(): string[] {
    return Array.from(this.activeContexts.keys());
  }

  // Get context for a task
  getContext(taskId: string): IsolationContext | undefined {
    return this.activeContexts.get(taskId);
  }

  // Cancel all tasks
  cancelAll(reason: string): void {
    for (const taskId of this.activeContexts.keys()) {
      this.cancelTask(taskId, reason);
    }
  }

  // Clear all tracking
  clear(): void {
    this.cancelAll('Isolator cleared');
    this.activeContexts.clear();
    this.abortControllers.clear();
  }
}

// Singleton instance
let isolatorInstance: TaskIsolator | null = null;

export function getTaskIsolator(): TaskIsolator {
  if (!isolatorInstance) {
    isolatorInstance = new TaskIsolator();
  }
  return isolatorInstance;
}

export function resetTaskIsolator(): void {
  if (isolatorInstance) {
    isolatorInstance.clear();
  }
  isolatorInstance = null;
}
