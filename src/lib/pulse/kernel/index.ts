/**
 * Kyro Runtime Kernel
 * Central authority for the intelligent runtime platform
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  KernelState,
  KernelStatus,
  Event,
  EventType,
  EventPriority,
  EventStatus,
  SourceType,
  ExecutionContext,
  Task,
  TaskStatus,
} from '@/types/pulse';
import { EventEmitter } from 'events';

// ============================================
// KERNEL STATE MACHINE
// ============================================

interface StateTransition {
  from: KernelState;
  to: KernelState;
  condition?: () => boolean | Promise<boolean>;
  action?: () => void | Promise<void>;
}

class KernelStateMachine {
  private currentState: KernelState = 'init';
  private transitions: StateTransition[] = [];
  private stateHistory: { state: KernelState; timestamp: Date }[] = [];
  private emitter = new EventEmitter();

  constructor() {
    this.defineTransitions();
  }

  private defineTransitions(): void {
    this.transitions = [
      { from: 'init', to: 'active' },
      { from: 'active', to: 'paused' },
      { from: 'paused', to: 'active' },
      { from: 'active', to: 'shutdown' },
      { from: 'paused', to: 'shutdown' },
      { from: 'shutdown', to: 'init' }, // For restart
    ];
  }

  getState(): KernelState {
    return this.currentState;
  }

  async transition(to: KernelState): Promise<boolean> {
    const validTransition = this.transitions.find(
      (t) => t.from === this.currentState && t.to === to
    );

    if (!validTransition) {
      console.error(`Invalid state transition: ${this.currentState} -> ${to}`);
      return false;
    }

    // Check condition if exists
    if (validTransition.condition && !(await validTransition.condition())) {
      return false;
    }

    const previousState = this.currentState;
    this.currentState = to;
    this.stateHistory.push({ state: to, timestamp: new Date() });

    // Execute action if exists
    if (validTransition.action) {
      await validTransition.action();
    }

    this.emitter.emit('stateChange', { from: previousState, to });
    return true;
  }

  canTransitionTo(to: KernelState): boolean {
    return this.transitions.some(
      (t) => t.from === this.currentState && t.to === to
    );
  }

  getHistory(): { state: KernelState; timestamp: Date }[] {
    return [...this.stateHistory];
  }

  onStateChange(callback: (change: { from: KernelState; to: KernelState }) => void): void {
    this.emitter.on('stateChange', callback);
  }

  removeListener(callback: (change: { from: KernelState; to: KernelState }) => void): void {
    this.emitter.off('stateChange', callback);
  }
}

// ============================================
// MONOTONIC CLOCK
// ============================================

class MonotonicClock {
  private startTime: number;
  private pausedAt: number | null = null;
  private totalPausedTime: number = 0;

  constructor() {
    this.startTime = Date.now();
  }

  now(): number {
    if (this.pausedAt !== null) {
      return this.pausedAt - this.startTime - this.totalPausedTime;
    }
    return Date.now() - this.startTime - this.totalPausedTime;
  }

  pause(): void {
    if (this.pausedAt === null) {
      this.pausedAt = Date.now();
    }
  }

  resume(): void {
    if (this.pausedAt !== null) {
      this.totalPausedTime += Date.now() - this.pausedAt;
      this.pausedAt = null;
    }
  }

  reset(): void {
    this.startTime = Date.now();
    this.pausedAt = null;
    this.totalPausedTime = 0;
  }
}

// ============================================
// EVENT ROUTER
// ============================================

interface QueuedEvent {
  event: Event;
  priority: EventPriority;
  timestamp: number;
}

const PRIORITY_VALUES: Record<EventPriority, number> = {
  critical: 4,
  high: 3,
  normal: 2,
  low: 1,
};

class EventRouter {
  private queue: QueuedEvent[] = [];
  private processing: Map<string, Event> = new Map();
  private handlers: Map<EventType, Set<(event: Event) => Promise<void>>> = new Map();
  private processedCount: number = 0;
  private failedCount: number = 0;
  private totalLatency: number = 0;
  private isProcessing: boolean = false;
  private emitter = new EventEmitter();

  constructor() {
    this.startProcessing();
  }

  private startProcessing(): void {
    this.isProcessing = true;
    this.processLoop();
  }

  private async processLoop(): Promise<void> {
    while (this.isProcessing) {
      if (this.queue.length > 0) {
        await this.processNext();
      }
      // Small delay to prevent busy-waiting
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }

  private async processNext(): Promise<void> {
    // Sort by priority (higher first), then by timestamp (older first)
    this.queue.sort((a, b) => {
      const priorityDiff = PRIORITY_VALUES[b.priority] - PRIORITY_VALUES[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return a.timestamp - b.timestamp;
    });

    const item = this.queue.shift();
    if (!item) return;

    const { event } = item;
    this.processing.set(event.id, event);

    const startTime = Date.now();
    try {
      event.status = 'processing';
      const handlers = this.handlers.get(event.eventType) || new Set();

      for (const handler of handlers) {
        await handler(event);
      }

      event.status = 'processed';
      event.processedAt = new Date();
      this.processedCount++;

      const latency = Date.now() - startTime;
      this.totalLatency += latency;

      this.emitter.emit('eventProcessed', { event, latency });
    } catch (error) {
      event.status = 'failed';
      event.retryCount++;
      this.failedCount++;

      this.emitter.emit('eventFailed', { event, error });
    }

    this.processing.delete(event.id);
  }

  submit<T = unknown>(
    eventType: EventType,
    sourceId: string,
    sourceType: SourceType,
    payload: T,
    context?: ExecutionContext,
    priority: EventPriority = 'normal'
  ): Event<T> {
    const event: Event<T> = {
      id: uuidv4(),
      timestamp: new Date(),
      eventType,
      sourceId,
      sourceType,
      priority,
      payload,
      executionContext: context || {},
      status: 'pending',
      retryCount: 0,
    };

    this.queue.push({
      event,
      priority,
      timestamp: Date.now(),
    });

    this.emitter.emit('eventSubmitted', event);
    return event;
  }

  subscribe<T = unknown>(
    eventType: EventType,
    handler: (event: Event<T>) => Promise<void>
  ): () => void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    const handlers = this.handlers.get(eventType)!;
    handlers.add(handler as (event: Event) => Promise<void>);

    return () => {
      handlers.delete(handler as (event: Event) => Promise<void>);
    };
  }

  getQueueLength(): number {
    return this.queue.length;
  }

  getProcessingCount(): number {
    return this.processing.size;
  }

  getStats() {
    return {
      pending: this.queue.length,
      processing: this.processing.size,
      processed: this.processedCount,
      failed: this.failedCount,
      totalProcessed: this.processedCount + this.failedCount,
      averageLatency: this.processedCount > 0 ? this.totalLatency / this.processedCount : 0,
    };
  }

  onEventSubmitted(callback: (event: Event) => void): void {
    this.emitter.on('eventSubmitted', callback);
  }

  onEventProcessed(callback: (data: { event: Event; latency: number }) => void): void {
    this.emitter.on('eventProcessed', callback);
  }

  onEventFailed(callback: (data: { event: Event; error: unknown }) => void): void {
    this.emitter.on('eventFailed', callback);
  }

  stop(): void {
    this.isProcessing = false;
  }
}

// ============================================
// TASK SCHEDULER
// ============================================

interface ScheduledTask {
  task: Task;
  execute: () => Promise<unknown>;
}

class TaskScheduler {
  private taskQueue: ScheduledTask[] = [];
  private runningTasks: Map<string, Task> = new Map();
  private completedTasks: Task[] = [];
  private maxConcurrency: number = 4;
  private emitter = new EventEmitter();
  private totalWaitTime: number = 0;
  private totalExecutionTime: number = 0;
  private completedCount: number = 0;

  schedule<T = unknown, R = unknown>(
    task: Task<T, R>,
    execute: () => Promise<R>
  ): void {
    // Check dependencies
    const pendingDeps = task.dependencies.filter(
      (depId) => !this.completedTasks.some((t) => t.id === depId)
    );

    if (pendingDeps.length > 0) {
      // Delay task until dependencies complete
      const unsubscribers: (() => void)[] = [];

      for (const depId of pendingDeps) {
        const unsubscribe = this.onTaskComplete((completedTask) => {
          if (completedTask.id === depId) {
            // Re-check dependencies
            const stillPending = task.dependencies.filter(
              (id) => !this.completedTasks.some((t) => t.id === id)
            );

            if (stillPending.length === 0) {
              this.addToQueue({ task, execute });
            }

            unsubscribers.forEach((unsub) => unsub());
          }
        });
        unsubscribers.push(unsubscribe);
      }
    } else {
      this.addToQueue({ task, execute });
    }
  }

  private addToQueue(scheduledTask: ScheduledTask): void {
    this.taskQueue.push(scheduledTask);
    this.taskQueue.sort((a, b) => b.task.priority - a.task.priority);
    this.emitter.emit('taskScheduled', scheduledTask.task);
    this.tryExecuteNext();
  }

  private async tryExecuteNext(): Promise<void> {
    while (this.runningTasks.size < this.maxConcurrency && this.taskQueue.length > 0) {
      const scheduled = this.taskQueue.shift();
      if (!scheduled) break;

      this.executeTask(scheduled);
    }
  }

  private async executeTask(scheduled: ScheduledTask): Promise<void> {
    const { task, execute } = scheduled;
    task.status = 'running';
    task.startedAt = new Date();
    this.runningTasks.set(task.id, task);

    const waitTime = Date.now() - new Date(task.scheduledAt || task.startedAt).getTime();
    this.totalWaitTime += waitTime;

    this.emitter.emit('taskStarted', task);

    try {
      // Set timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Task timeout')), task.timeout);
      });

      const result = await Promise.race([execute(), timeoutPromise]);
      task.result = result;
      task.status = 'completed';
      task.completedAt = new Date();

      const executionTime = task.completedAt.getTime() - task.startedAt.getTime();
      this.totalExecutionTime += executionTime;
      this.completedCount++;

      this.emitter.emit('taskComplete', { task, executionTime });
    } catch (error) {
      task.status = 'failed';
      task.error = error instanceof Error ? error.message : String(error);
      task.retryCount++;

      if (task.retryCount < task.maxRetries) {
        // Re-schedule for retry
        task.status = 'pending';
        setTimeout(() => {
          this.addToQueue({ task, execute });
        }, 1000 * task.retryCount); // Exponential backoff
      } else {
        this.emitter.emit('taskFailed', { task, error });
      }
    }

    this.runningTasks.delete(task.id);
    if (task.status === 'completed') {
      this.completedTasks.push(task);
    }

    this.tryExecuteNext();
  }

  cancel(taskId: string): boolean {
    // Check running tasks
    const runningTask = this.runningTasks.get(taskId);
    if (runningTask) {
      runningTask.status = 'cancelled';
      this.runningTasks.delete(taskId);
      this.emitter.emit('taskCancelled', runningTask);
      return true;
    }

    // Check queue
    const index = this.taskQueue.findIndex((st) => st.task.id === taskId);
    if (index !== -1) {
      const [removed] = this.taskQueue.splice(index, 1);
      removed.task.status = 'cancelled';
      this.emitter.emit('taskCancelled', removed.task);
      return true;
    }

    return false;
  }

  getQueueStats() {
    return {
      pending: this.taskQueue.length,
      running: this.runningTasks.size,
      completed: this.completedTasks.length,
      averageWaitTime: this.completedCount > 0 ? this.totalWaitTime / this.completedCount : 0,
      averageExecutionTime: this.completedCount > 0 ? this.totalExecutionTime / this.completedCount : 0,
    };
  }

  onTaskScheduled(callback: (task: Task) => void): () => void {
    this.emitter.on('taskScheduled', callback);
    return () => this.emitter.off('taskScheduled', callback);
  }

  onTaskStarted(callback: (task: Task) => void): () => void {
    this.emitter.on('taskStarted', callback);
    return () => this.emitter.off('taskStarted', callback);
  }

  onTaskComplete(callback: (data: { task: Task; executionTime: number }) => void): () => void {
    this.emitter.on('taskComplete', callback);
    return () => this.emitter.off('taskComplete', callback);
  }

  onTaskFailed(callback: (data: { task: Task; error: unknown }) => void): () => void {
    this.emitter.on('taskFailed', callback);
    return () => this.emitter.off('taskFailed', callback);
  }

  onTaskCancelled(callback: (task: Task) => void): () => void {
    this.emitter.on('taskCancelled', callback);
    return () => this.emitter.off('taskCancelled', callback);
  }

  setMaxConcurrency(max: number): void {
    this.maxConcurrency = max;
    this.tryExecuteNext();
  }
}

// ============================================
// DEPENDENCY RESOLVER
// ============================================

interface DependencyNode {
  id: string;
  dependencies: string[];
  version?: string;
}

class DependencyResolver {
  private nodes: Map<string, DependencyNode> = new Map();

  register(node: DependencyNode): void {
    this.nodes.set(node.id, node);
  }

  unregister(id: string): void {
    this.nodes.delete(id);
  }

  resolve(id: string): { resolved: string[]; missing: string[]; circular: boolean } {
    const resolved: string[] = [];
    const missing: string[] = [];
    const visiting = new Set<string>();
    const visited = new Set<string>();

    const visit = (nodeId: string): boolean => {
      if (visited.has(nodeId)) return true;
      if (visiting.has(nodeId)) return false; // Circular dependency

      const node = this.nodes.get(nodeId);
      if (!node) {
        missing.push(nodeId);
        return true;
      }

      visiting.add(nodeId);

      for (const dep of node.dependencies) {
        if (!visit(dep)) {
          return false;
        }
      }

      visiting.delete(nodeId);
      visited.add(nodeId);
      resolved.push(nodeId);
      return true;
    };

    const noCircular = visit(id);
    return { resolved, missing, circular: !noCircular };
  }

  canLoad(id: string): { canLoad: boolean; reason?: string } {
    const { missing, circular } = this.resolve(id);

    if (circular) {
      return { canLoad: false, reason: 'Circular dependency detected' };
    }

    if (missing.length > 0) {
      return { canLoad: false, reason: `Missing dependencies: ${missing.join(', ')}` };
    }

    return { canLoad: true };
  }

  getLoadOrder(): string[] {
    const order: string[] = [];
    const visited = new Set<string>();

    const visit = (id: string) => {
      if (visited.has(id)) return;
      visited.add(id);

      const node = this.nodes.get(id);
      if (node) {
        for (const dep of node.dependencies) {
          visit(dep);
        }
        order.push(id);
      }
    };

    for (const id of this.nodes.keys()) {
      visit(id);
    }

    return order;
  }
}

// ============================================
// RUNTIME KERNEL
// ============================================

export class PulseRuntimeKernel {
  private static instance: PulseRuntimeKernel | null = null;
  private stateMachine: KernelStateMachine;
  private clock: MonotonicClock;
  private eventRouter: EventRouter;
  private taskScheduler: TaskScheduler;
  private dependencyResolver: DependencyResolver;
  private startTime: number;
  private emitter = new EventEmitter();

  private constructor() {
    this.stateMachine = new KernelStateMachine();
    this.clock = new MonotonicClock();
    this.eventRouter = new EventRouter();
    this.taskScheduler = new TaskScheduler();
    this.dependencyResolver = new DependencyResolver();
    this.startTime = Date.now();

    this.setupInternalHandlers();
  }

  static getInstance(): PulseRuntimeKernel {
    if (!PulseRuntimeKernel.instance) {
      PulseRuntimeKernel.instance = new PulseRuntimeKernel();
    }
    return PulseRuntimeKernel.instance;
  }

  private setupInternalHandlers(): void {
    // Handle state changes
    this.stateMachine.onStateChange(({ from, to }) => {
      this.eventRouter.submit(
        'kernel:state_change',
        'kernel',
        'system',
        { from, to },
        {},
        'critical'
      );

      if (to === 'paused') {
        this.clock.pause();
      } else if (to === 'active' && from === 'paused') {
        this.clock.resume();
      }
    });

    // Log all events
    this.eventRouter.onEventProcessed(({ event, latency }) => {
      this.emitter.emit('log', {
        level: 'debug' as const,
        message: `Event processed: ${event.eventType}`,
        category: 'event' as const,
        metadata: { eventId: event.id, latency },
      });
    });
  }

  // ============================================
  // LIFECYCLE CONTROL
  // ============================================

  async initialize(): Promise<void> {
    await this.stateMachine.transition('active');
    this.eventRouter.submit('kernel:init', 'kernel', 'system', {
      timestamp: new Date(),
    }, {}, 'critical');
  }

  async pause(): Promise<boolean> {
    return this.stateMachine.transition('paused');
  }

  async resume(): Promise<boolean> {
    return this.stateMachine.transition('active');
  }

  async shutdown(): Promise<void> {
    await this.stateMachine.transition('shutdown');
    this.eventRouter.stop();
    this.eventRouter.submit('kernel:shutdown', 'kernel', 'system', {
      timestamp: new Date(),
    }, {}, 'critical');
  }

  getState(): KernelState {
    return this.stateMachine.getState();
  }

  canTransitionTo(state: KernelState): boolean {
    return this.stateMachine.canTransitionTo(state);
  }

  // ============================================
  // EVENT MANAGEMENT
  // ============================================

  submitEvent<T = unknown>(
    eventType: EventType,
    sourceId: string,
    sourceType: SourceType,
    payload: T,
    context?: ExecutionContext,
    priority: EventPriority = 'normal'
  ): Event<T> {
    return this.eventRouter.submit(eventType, sourceId, sourceType, payload, context, priority);
  }

  subscribe<T = unknown>(
    eventType: EventType,
    handler: (event: Event<T>) => Promise<void>
  ): () => void {
    return this.eventRouter.subscribe(eventType, handler);
  }

  getEventStats() {
    return this.eventRouter.getStats();
  }

  // ============================================
  // TASK MANAGEMENT
  // ============================================

  scheduleTask<T = unknown, R = unknown>(
    task: Task<T, R>,
    execute: () => Promise<R>
  ): void {
    this.taskScheduler.schedule(task, execute);
  }

  cancelTask(taskId: string): boolean {
    return this.taskScheduler.cancel(taskId);
  }

  getTaskStats() {
    return this.taskScheduler.getQueueStats();
  }

  setMaxConcurrency(max: number): void {
    this.taskScheduler.setMaxConcurrency(max);
  }

  // ============================================
  // DEPENDENCY MANAGEMENT
  // ============================================

  registerDependency(node: { id: string; dependencies: string[]; version?: string }): void {
    this.dependencyResolver.register(node);
  }

  canLoad(id: string): { canLoad: boolean; reason?: string } {
    return this.dependencyResolver.canLoad(id);
  }

  getLoadOrder(): string[] {
    return this.dependencyResolver.getLoadOrder();
  }

  // ============================================
  // STATUS & MONITORING
  // ============================================

  getStatus(): KernelStatus {
    return {
      state: this.stateMachine.getState(),
      monotonicClock: this.clock.now(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      version: '1.0.0',
      lastHeartbeat: new Date(),
      queueLength: this.eventRouter.getQueueLength(),
      activeTasks: this.taskScheduler.getQueueStats().running,
      loadedModules: 0,
      activeAgents: 0,
    };
  }

  getClock(): number {
    return this.clock.now();
  }

  onLog(callback: (log: { level: string; message: string; category?: string; metadata?: unknown }) => void): () => void {
    this.emitter.on('log', callback);
    return () => this.emitter.off('log', callback);
  }

  // ============================================
  // UTILITY
  // ============================================

  generateId(): string {
    return uuidv4();
  }
}

// Export singleton getter
export const getKernel = (): PulseRuntimeKernel => PulseRuntimeKernel.getInstance();
