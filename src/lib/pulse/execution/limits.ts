// Kyro Resource Limits
// Defines and manages resource limits for tasks

import type { ResourceBudget } from '@/types/pulse';

export interface ResourceUsage {
  cpu: number; // percentage
  memory: number; // MB
  time: number; // ms
  network?: number; // bytes
}

export interface LimitViolation {
  type: 'cpu' | 'memory' | 'time' | 'network';
  current: number;
  limit: number;
  exceeded: number;
}

export const DEFAULT_BUDGETS: Record<string, ResourceBudget> = {
  default: {
    cpuLimit: 100,
    memoryLimit: 512,
    timeLimit: 30000,
  },
  computation: {
    cpuLimit: 200,
    memoryLimit: 1024,
    timeLimit: 60000,
  },
  io: {
    cpuLimit: 50,
    memoryLimit: 256,
    timeLimit: 60000,
  },
  agent: {
    cpuLimit: 100,
    memoryLimit: 512,
    timeLimit: 120000,
  },
  model: {
    cpuLimit: 50,
    memoryLimit: 256,
    timeLimit: 60000,
  },
};

export class ResourceLimiter {
  private budgets: Map<string, ResourceBudget> = new Map();
  private usage: Map<string, ResourceUsage> = new Map();
  private listeners: Array<(taskId: string, violation: LimitViolation) => void> = [];

  constructor() {
    // Initialize with default budgets
    for (const [name, budget] of Object.entries(DEFAULT_BUDGETS)) {
      this.budgets.set(name, budget);
    }
  }

  // Set budget for a task
  setBudget(taskId: string, budget: ResourceBudget): void {
    this.budgets.set(taskId, budget);
  }

  // Get budget for a task
  getBudget(taskId: string): ResourceBudget | undefined {
    return this.budgets.get(taskId);
  }

  // Get budget by task type
  getBudgetByType(taskType: string): ResourceBudget {
    return this.budgets.get(taskType) || DEFAULT_BUDGETS.default;
  }

  // Start tracking resource usage for a task
  startTracking(taskId: string, budget?: ResourceBudget): void {
    if (budget) {
      this.setBudget(taskId, budget);
    }
    
    this.usage.set(taskId, {
      cpu: 0,
      memory: 0,
      time: Date.now(),
    });
  }

  // Update resource usage
  updateUsage(taskId: string, usage: Partial<ResourceUsage>): LimitViolation[] {
    const current = this.usage.get(taskId) || {
      cpu: 0,
      memory: 0,
      time: Date.now(),
    };

    const updated: ResourceUsage = {
      ...current,
      ...usage,
    };

    if (usage.time !== undefined) {
      updated.time = Date.now() - (current.time as number);
    }

    this.usage.set(taskId, updated);

    return this.checkLimits(taskId, updated);
  }

  // Check if usage exceeds limits
  checkLimits(taskId: string, usage: ResourceUsage): LimitViolation[] {
    const budget = this.getBudget(taskId) || DEFAULT_BUDGETS.default;
    const violations: LimitViolation[] = [];

    if (usage.cpu > budget.cpuLimit) {
      violations.push({
        type: 'cpu',
        current: usage.cpu,
        limit: budget.cpuLimit,
        exceeded: usage.cpu - budget.cpuLimit,
      });
    }

    if (usage.memory > budget.memoryLimit) {
      violations.push({
        type: 'memory',
        current: usage.memory,
        limit: budget.memoryLimit,
        exceeded: usage.memory - budget.memoryLimit,
      });
    }

    if (usage.time > budget.timeLimit) {
      violations.push({
        type: 'time',
        current: usage.time,
        limit: budget.timeLimit,
        exceeded: usage.time - budget.timeLimit,
      });
    }

    if (usage.network !== undefined && budget.networkLimit && usage.network > budget.networkLimit) {
      violations.push({
        type: 'network',
        current: usage.network,
        limit: budget.networkLimit,
        exceeded: usage.network - budget.networkLimit,
      });
    }

    // Notify listeners of violations
    for (const violation of violations) {
      for (const listener of this.listeners) {
        try {
          listener(taskId, violation);
        } catch (error) {
          console.error('Resource limit listener error:', error);
        }
      }
    }

    return violations;
  }

  // Stop tracking and get final usage
  stopTracking(taskId: string): ResourceUsage | undefined {
    const usage = this.usage.get(taskId);
    this.usage.delete(taskId);
    this.budgets.delete(taskId);
    return usage;
  }

  // Get current usage
  getUsage(taskId: string): ResourceUsage | undefined {
    return this.usage.get(taskId);
  }

  // Subscribe to limit violations
  onViolation(listener: (taskId: string, violation: LimitViolation) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  // Get all active tasks being tracked
  getActiveTasks(): string[] {
    return Array.from(this.usage.keys());
  }

  // Clear all tracking
  clear(): void {
    this.usage.clear();
    this.budgets.clear();
    
    // Re-initialize default budgets
    for (const [name, budget] of Object.entries(DEFAULT_BUDGETS)) {
      this.budgets.set(name, budget);
    }
  }
}

// Singleton instance
let limiterInstance: ResourceLimiter | null = null;

export function getResourceLimiter(): ResourceLimiter {
  if (!limiterInstance) {
    limiterInstance = new ResourceLimiter();
  }
  return limiterInstance;
}

export function resetResourceLimiter(): void {
  limiterInstance = null;
}
