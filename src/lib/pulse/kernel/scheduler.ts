// Kyro Task Scheduler
// Manages task scheduling with monotonic clock and priority handling

import type { Task, TaskPriority, TaskStatus, ResourceBudget } from '@/types/pulse';
import { v4 as uuidv4 } from 'uuid';

export interface ScheduledTask extends Task {
  scheduledTick: number;
  dependencies: string[];
}

export class Scheduler {
  private monotonicClock = 0;
  private taskQueue: ScheduledTask[] = [];
  private completedTasks: Map<string, Task> = new Map();
  private tickInterval: NodeJS.Timeout | null = null;
  private tickCallbacks: Array<(tick: number) => void> = [];
  private maxQueueSize = 1000;

  constructor(maxQueueSize = 1000) {
    this.maxQueueSize = maxQueueSize;
  }

  // Get current tick
  getTick(): number {
    return this.monotonicClock;
  }

  // Advance clock by one tick
  tick(): number {
    this.monotonicClock++;
    this.processScheduledTasks();
    this.notifyTickCallbacks();
    return this.monotonicClock;
  }

  // Start automatic ticking
  startTicking(intervalMs = 100): void {
    if (this.tickInterval) return;
    this.tickInterval = setInterval(() => this.tick(), intervalMs);
  }

  // Stop automatic ticking
  stopTicking(): void {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
  }

  // Subscribe to tick events
  onTick(callback: (tick: number) => void): () => void {
    this.tickCallbacks.push(callback);
    return () => {
      const index = this.tickCallbacks.indexOf(callback);
      if (index > -1) {
        this.tickCallbacks.splice(index, 1);
      }
    };
  }

  private notifyTickCallbacks(): void {
    for (const callback of this.tickCallbacks) {
      try {
        callback(this.monotonicClock);
      } catch (error) {
        console.error('Tick callback error:', error);
      }
    }
  }

  // Create a new task
  createTask(
    name: string,
    type: Task['type'],
    sourceId: string,
    sourceType: Task['sourceType'],
    payload: Record<string, unknown>,
    options: {
      priority?: TaskPriority;
      dependencies?: string[];
      timeout?: number;
      maxRetries?: number;
      resourceBudget?: ResourceBudget;
      scheduledAt?: Date;
    } = {}
  ): ScheduledTask {
    return {
      id: uuidv4(),
      name,
      type,
      sourceId,
      sourceType,
      payload,
      priority: options.priority || { level: 5 },
      status: 'pending',
      dependencies: options.dependencies || [],
      timeout: options.timeout || 30000,
      maxRetries: options.maxRetries || 3,
      retryCount: 0,
      scheduledAt: options.scheduledAt,
      scheduledTick: this.monotonicClock,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  // Schedule a task
  schedule(task: ScheduledTask): boolean {
    if (this.taskQueue.length >= this.maxQueueSize) {
      console.error('Task queue overflow, dropping task:', task.name);
      return false;
    }

    // Check if dependencies are met
    const pendingDeps = task.dependencies.filter(
      depId => !this.completedTasks.has(depId)
    );

    if (pendingDeps.length > 0) {
      task.status = 'pending';
    }

    // Insert based on priority
    const taskPriority = task.priority.level + (task.priority.boost || 0);
    let inserted = false;

    for (let i = 0; i < this.taskQueue.length; i++) {
      const queuePriority = this.taskQueue[i].priority.level + 
        (this.taskQueue[i].priority.boost || 0);
      if (taskPriority > queuePriority) {
        this.taskQueue.splice(i, 0, task);
        inserted = true;
        break;
      }
    }

    if (!inserted) {
      this.taskQueue.push(task);
    }

    return true;
  }

  // Process scheduled tasks
  private processScheduledTasks(): void {
    const readyTasks = this.taskQueue.filter(task => {
      // Check dependencies
      const pendingDeps = task.dependencies.filter(
        depId => !this.completedTasks.has(depId)
      );
      return pendingDeps.length === 0 && task.status === 'pending';
    });

    for (const task of readyTasks) {
      task.status = 'running';
      task.startedAt = new Date();
    }
  }

  // Get next ready task
  getNextTask(): ScheduledTask | undefined {
    const readyIndex = this.taskQueue.findIndex(
      task => task.status === 'running' || 
        (task.status === 'pending' && this.areDependenciesMet(task))
    );

    if (readyIndex > -1) {
      const task = this.taskQueue[readyIndex];
      if (task.status === 'pending') {
        task.status = 'running';
        task.startedAt = new Date();
      }
      return task;
    }

    return undefined;
  }

  // Check if task dependencies are met
  private areDependenciesMet(task: ScheduledTask): boolean {
    return task.dependencies.every(depId => this.completedTasks.has(depId));
  }

  // Mark task as completed
  completeTask(taskId: string, result?: Record<string, unknown>): void {
    const taskIndex = this.taskQueue.findIndex(t => t.id === taskId);
    if (taskIndex > -1) {
      const task = this.taskQueue.splice(taskIndex, 1)[0];
      task.status = 'completed';
      task.completedAt = new Date();
      task.result = result;
      task.updatedAt = new Date();
      this.completedTasks.set(taskId, task);
    }
  }

  // Mark task as failed
  failTask(taskId: string, error: string): void {
    const taskIndex = this.taskQueue.findIndex(t => t.id === taskId);
    if (taskIndex > -1) {
      const task = this.taskQueue[taskIndex];
      task.retryCount++;
      task.error = error;
      task.updatedAt = new Date();

      if (task.retryCount >= task.maxRetries) {
        task.status = 'failed';
        this.taskQueue.splice(taskIndex, 1);
        this.completedTasks.set(taskId, task);
      } else {
        task.status = 'pending';
      }
    }
  }

  // Cancel a task
  cancelTask(taskId: string): boolean {
    const taskIndex = this.taskQueue.findIndex(t => t.id === taskId);
    if (taskIndex > -1) {
      const task = this.taskQueue.splice(taskIndex, 1)[0];
      task.status = 'cancelled';
      task.updatedAt = new Date();
      this.completedTasks.set(taskId, task);
      return true;
    }
    return false;
  }

  // Get queue stats
  getStats(): {
    queueLength: number;
    pending: number;
    running: number;
    completed: number;
  } {
    return {
      queueLength: this.taskQueue.length,
      pending: this.taskQueue.filter(t => t.status === 'pending').length,
      running: this.taskQueue.filter(t => t.status === 'running').length,
      completed: this.completedTasks.size,
    };
  }

  // Get queue snapshot
  getQueueSnapshot(): ScheduledTask[] {
    return [...this.taskQueue];
  }

  // Clear completed tasks
  clearCompleted(): void {
    this.completedTasks.clear();
  }
}

// Singleton instance
let schedulerInstance: Scheduler | null = null;

export function getScheduler(): Scheduler {
  if (!schedulerInstance) {
    schedulerInstance = new Scheduler();
  }
  return schedulerInstance;
}

export function resetScheduler(): void {
  if (schedulerInstance) {
    schedulerInstance.stopTicking();
  }
  schedulerInstance = null;
}
