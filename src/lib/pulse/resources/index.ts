/**
 * Kyro Resource Governance System
 * Monitors and controls system resources
 */

import type { ResourceBudget, ResourceUsage, Metric } from '@/types/pulse';
import { EventEmitter } from 'events';

// ============================================
// SYSTEM RESOURCE MONITOR
// ============================================

interface SystemResourceSnapshot {
  timestamp: Date;
  cpu: {
    usage: number;
    loadAverage: number[];
  };
  memory: {
    total: number;
    used: number;
    free: number;
    percentage: number;
  };
  process: {
    cpu: number;
    memory: number;
  };
}

class SystemResourceMonitor {
  private snapshots: SystemResourceSnapshot[] = [];
  private maxSnapshots: number = 1000;
  private interval: NodeJS.Timeout | null = null;
  private emitter = new EventEmitter();

  start(intervalMs: number = 1000): void {
    if (this.interval) return;

    this.interval = setInterval(() => {
      this.collectSnapshot();
    }, intervalMs);

    // Collect initial snapshot
    this.collectSnapshot();
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  private collectSnapshot(): void {
    const snapshot: SystemResourceSnapshot = {
      timestamp: new Date(),
      cpu: {
        usage: this.simulateCpuUsage(),
        loadAverage: this.simulateLoadAverage(),
      },
      memory: {
        total: 16384, // 16 GB simulated
        used: Math.random() * 4000 + 4000, // 4-8 GB
        free: 0,
        percentage: 0,
      },
      process: {
        cpu: Math.random() * 20 + 5, // 5-25% CPU
        memory: Math.random() * 300 + 100, // 100-400 MB
      },
    };

    snapshot.memory.free = snapshot.memory.total - snapshot.memory.used;
    snapshot.memory.percentage = (snapshot.memory.used / snapshot.memory.total) * 100;

    this.snapshots.push(snapshot);

    // Trim old snapshots
    if (this.snapshots.length > this.maxSnapshots) {
      this.snapshots.shift();
    }

    this.emitter.emit('snapshot', snapshot);

    // Check for resource pressure
    this.checkResourcePressure(snapshot);
  }

  private simulateCpuUsage(): number {
    // Simulate CPU usage with some variance
    return Math.random() * 40 + 20; // 20-60%
  }

  private simulateLoadAverage(): number[] {
    return [
      Math.random() * 2 + 0.5,
      Math.random() * 2 + 0.5,
      Math.random() * 2 + 0.5,
    ];
  }

  private checkResourcePressure(snapshot: SystemResourceSnapshot): void {
    // CPU pressure
    if (snapshot.cpu.usage > 80) {
      this.emitter.emit('pressure', {
        type: 'cpu',
        severity: snapshot.cpu.usage > 90 ? 'critical' : 'high',
        value: snapshot.cpu.usage,
        threshold: 80,
      });
    }

    // Memory pressure
    if (snapshot.memory.percentage > 80) {
      this.emitter.emit('pressure', {
        type: 'memory',
        severity: snapshot.memory.percentage > 90 ? 'critical' : 'high',
        value: snapshot.memory.percentage,
        threshold: 80,
      });
    }
  }

  getLatestSnapshot(): SystemResourceSnapshot | undefined {
    return this.snapshots[this.snapshots.length - 1];
  }

  getSnapshots(count?: number): SystemResourceSnapshot[] {
    if (count) {
      return this.snapshots.slice(-count);
    }
    return [...this.snapshots];
  }

  getAggregatedStats(durationMs: number = 60000): {
    avgCpu: number;
    maxCpu: number;
    avgMemory: number;
    maxMemory: number;
    snapshotCount: number;
  } {
    const cutoff = new Date(Date.now() - durationMs);
    const relevantSnapshots = this.snapshots.filter(s => s.timestamp >= cutoff);

    if (relevantSnapshots.length === 0) {
      return { avgCpu: 0, maxCpu: 0, avgMemory: 0, maxMemory: 0, snapshotCount: 0 };
    }

    const cpuValues = relevantSnapshots.map(s => s.cpu.usage);
    const memoryValues = relevantSnapshots.map(s => s.memory.percentage);

    return {
      avgCpu: cpuValues.reduce((a, b) => a + b, 0) / cpuValues.length,
      maxCpu: Math.max(...cpuValues),
      avgMemory: memoryValues.reduce((a, b) => a + b, 0) / memoryValues.length,
      maxMemory: Math.max(...memoryValues),
      snapshotCount: relevantSnapshots.length,
    };
  }

  onSnapshot(callback: (snapshot: SystemResourceSnapshot) => void): () => void {
    this.emitter.on('snapshot', callback);
    return () => this.emitter.off('snapshot', callback);
  }

  onPressure(callback: (data: { type: string; severity: string; value: number; threshold: number }) => void): () => void {
    this.emitter.on('pressure', callback);
    return () => this.emitter.off('pressure', callback);
  }
}

// ============================================
// ADAPTIVE BEHAVIOR CONTROLLER
// ============================================

type AdaptationAction =
  | 'unload_idle_modules'
  | 'pause_background_tasks'
  | 'downgrade_model'
  | 'reduce_concurrency'
  | 'throttle_requests';

interface AdaptationRule {
  condition: (snapshot: SystemResourceSnapshot) => boolean;
  actions: AdaptationAction[];
  cooldown: number; // ms
  lastTriggered?: number;
}

class AdaptiveBehaviorController {
  private rules: AdaptationRule[] = [];
  private emitter = new EventEmitter();
  private actionHandlers: Map<AdaptationAction, () => Promise<void>> = new Map();

  constructor() {
    this.defineDefaultRules();
  }

  private defineDefaultRules(): void {
    this.rules = [
      {
        condition: (s) => s.cpu.usage > 85,
        actions: ['reduce_concurrency', 'throttle_requests'],
        cooldown: 30000,
      },
      {
        condition: (s) => s.memory.percentage > 85,
        actions: ['unload_idle_modules', 'reduce_concurrency'],
        cooldown: 30000,
      },
      {
        condition: (s) => s.cpu.usage > 95 || s.memory.percentage > 95,
        actions: ['unload_idle_modules', 'pause_background_tasks', 'downgrade_model', 'reduce_concurrency'],
        cooldown: 60000,
      },
    ];
  }

  registerActionHandler(action: AdaptationAction, handler: () => Promise<void>): void {
    this.actionHandlers.set(action, handler);
  }

  async evaluate(snapshot: SystemResourceSnapshot): Promise<AdaptationAction[]> {
    const triggeredActions: AdaptationAction[] = [];
    const now = Date.now();

    for (const rule of this.rules) {
      // Check cooldown
      if (rule.lastTriggered && now - rule.lastTriggered < rule.cooldown) {
        continue;
      }

      // Check condition
      if (rule.condition(snapshot)) {
        rule.lastTriggered = now;

        for (const action of rule.actions) {
          if (!triggeredActions.includes(action)) {
            triggeredActions.push(action);

            // Execute handler if registered
            const handler = this.actionHandlers.get(action);
            if (handler) {
              try {
                await handler();
              } catch (error) {
                console.error(`Failed to execute adaptation action ${action}:`, error);
              }
            }

            this.emitter.emit('adaptation', { action, reason: 'resource_pressure' });
          }
        }
      }
    }

    return triggeredActions;
  }

  onAdaptation(callback: (data: { action: AdaptationAction; reason: string }) => void): () => void {
    this.emitter.on('adaptation', callback);
    return () => this.emitter.off('adaptation', callback);
  }
}

// ============================================
// BUDGET MANAGER
// ============================================

class BudgetManager {
  private budgets: Map<string, ResourceBudget> = new Map();
  private emitter = new EventEmitter();

  setBudget(entityType: string, entityId: string, budget: Partial<ResourceBudget>): ResourceBudget {
    const key = `${entityType}:${entityId}`;
    const existing = this.budgets.get(key) || {
      cpuLimit: 100,
      memoryLimit: 512,
      timeLimit: 30000,
      priority: 5,
    };

    const updated = { ...existing, ...budget };
    this.budgets.set(key, updated);

    this.emitter.emit('budgetUpdated', { entityType, entityId, budget: updated });
    return updated;
  }

  getBudget(entityType: string, entityId: string): ResourceBudget | undefined {
    return this.budgets.get(`${entityType}:${entityId}`);
  }

  removeBudget(entityType: string, entityId: string): boolean {
    const key = `${entityType}:${entityId}`;
    const existed = this.budgets.delete(key);
    if (existed) {
      this.emitter.emit('budgetRemoved', { entityType, entityId });
    }
    return existed;
  }

  getAllBudgets(): { entityType: string; entityId: string; budget: ResourceBudget }[] {
    const result: { entityType: string; entityId: string; budget: ResourceBudget }[] = [];
    for (const [key, budget] of this.budgets) {
      const [entityType, entityId] = key.split(':');
      result.push({ entityType, entityId, budget });
    }
    return result;
  }

  onBudgetUpdated(callback: (data: { entityType: string; entityId: string; budget: ResourceBudget }) => void): () => void {
    this.emitter.on('budgetUpdated', callback);
    return () => this.emitter.off('budgetUpdated', callback);
  }

  onBudgetRemoved(callback: (data: { entityType: string; entityId: string }) => void): () => void {
    this.emitter.on('budgetRemoved', callback);
    return () => this.emitter.off('budgetRemoved', callback);
  }
}

// ============================================
// RESOURCE GOVERNANCE
// ============================================

export class ResourceGovernance {
  private monitor: SystemResourceMonitor;
  private adaptiveController: AdaptiveBehaviorController;
  private budgetManager: BudgetManager;
  private emitter = new EventEmitter();

  constructor() {
    this.monitor = new SystemResourceMonitor();
    this.adaptiveController = new AdaptiveBehaviorController();
    this.budgetManager = new BudgetManager();

    // Connect monitor to adaptive controller
    this.monitor.onSnapshot(async (snapshot) => {
      const actions = await this.adaptiveController.evaluate(snapshot);
      if (actions.length > 0) {
        this.emitter.emit('adaptations', { snapshot, actions });
      }
    });

    this.monitor.onPressure((data) => {
      this.emitter.emit('pressure', data);
    });
  }

  start(monitoringIntervalMs: number = 1000): void {
    this.monitor.start(monitoringIntervalMs);
  }

  stop(): void {
    this.monitor.stop();
  }

  // ============================================
  // MONITORING
  // ============================================

  getCurrentResources(): SystemResourceSnapshot | undefined {
    return this.monitor.getLatestSnapshot();
  }

  getResourceHistory(count?: number): SystemResourceSnapshot[] {
    return this.monitor.getSnapshots(count);
  }

  getAggregatedStats(durationMs?: number) {
    return this.monitor.getAggregatedStats(durationMs);
  }

  // ============================================
  // ADAPTIVE BEHAVIOR
  // ============================================

  registerAdaptationHandler(action: AdaptationAction, handler: () => Promise<void>): void {
    this.adaptiveController.registerActionHandler(action, handler);
  }

  // ============================================
  // BUDGET MANAGEMENT
  // ============================================

  setBudget(entityType: string, entityId: string, budget: Partial<ResourceBudget>): ResourceBudget {
    return this.budgetManager.setBudget(entityType, entityId, budget);
  }

  getBudget(entityType: string, entityId: string): ResourceBudget | undefined {
    return this.budgetManager.getBudget(entityType, entityId);
  }

  removeBudget(entityType: string, entityId: string): boolean {
    return this.budgetManager.removeBudget(entityType, entityId);
  }

  getAllBudgets(): { entityType: string; entityId: string; budget: ResourceBudget }[] {
    return this.budgetManager.getAllBudgets();
  }

  // ============================================
  // EVENTS
  // ============================================

  onAdaptation(callback: (data: { snapshot: SystemResourceSnapshot; actions: AdaptationAction[] }) => void): () => void {
    this.emitter.on('adaptations', callback);
    return () => this.emitter.off('adaptations', callback);
  }

  onPressure(callback: (data: { type: string; severity: string; value: number; threshold: number }) => void): () => void {
    this.emitter.on('pressure', callback);
    return () => this.emitter.off('pressure', callback);
  }

  onSnapshot(callback: (snapshot: SystemResourceSnapshot) => void): () => void {
    this.monitor.onSnapshot(callback);
  }

  onBudgetUpdated(callback: (data: { entityType: string; entityId: string; budget: ResourceBudget }) => void): () => void {
    this.budgetManager.onBudgetUpdated(callback);
  }
}

export type { AdaptationAction, SystemResourceSnapshot };
export const getResourceGovernance = (): ResourceGovernance => new ResourceGovernance();
