// Kyro IDE - Memory Governor
// Efficient model and resource management with memory-aware loading

import { Model } from '@/types/ide';
import { EventEmitter } from 'events';

// ============================================================================
// TYPES
// ============================================================================

interface MemoryState {
  total: number;      // Total system RAM in GB
  available: number;  // Available RAM in GB
  used: number;       // Used RAM in GB
  models: number;     // RAM used by models in GB
  cache: number;      // RAM used by cache in GB
}

interface ModelInstance {
  id: string;
  modelId: string;
  status: 'loading' | 'ready' | 'active' | 'unloading' | 'error';
  memoryUsed: number;  // GB
  lastUsed: Date;
  requestCount: number;
  loadedAt: Date;
}

interface MemoryConfig {
  maxModelMemory: number;    // Max GB for models
  maxCacheMemory: number;    // Max GB for cache
  minAvailableMemory: number; // Min GB to keep free
  swapThreshold: number;     // Swap when available < threshold
  unloadTimeout: number;     // Unload after X minutes of inactivity
}

// ============================================================================
// MEMORY GOVERNOR
// ============================================================================

export class MemoryGovernor extends EventEmitter {
  private models: Map<string, ModelInstance> = new Map();
  private config: MemoryConfig;
  private systemMemory: MemoryState;
  private priorityQueue: Array<{ modelId: string; priority: number }> = [];
  private swapHistory: Array<{ timestamp: Date; modelId: string; reason: string }> = [];

  constructor(config?: Partial<MemoryConfig>) {
    super();
    this.config = {
      maxModelMemory: config?.maxModelMemory || 16,       // 16GB max for models
      maxCacheMemory: config?.maxCacheMemory || 4,         // 4GB for cache
      minAvailableMemory: config?.minAvailableMemory || 2, // Keep 2GB free
      swapThreshold: config?.swapThreshold || 4,           // Swap when < 4GB free
      unloadTimeout: config?.unloadTimeout || 30,          // 30 min inactivity
    };
    this.systemMemory = this.detectSystemMemory();
    this.startMonitoring();
  }

  // Detect system memory
  private detectSystemMemory(): MemoryState {
    // In a real implementation, this would use system APIs
    // For now, assume 32GB system
    const total = 32;
    const used = 8 + Math.random() * 4;
    return {
      total,
      available: total - used,
      used,
      models: 0,
      cache: 0
    };
  }

  // Start memory monitoring
  private startMonitoring(): void {
    setInterval(() => {
      this.updateMemoryState();
      this.checkMemoryPressure();
      this.cleanupInactiveModels();
    }, 5000);
  }

  // Update memory state
  private updateMemoryState(): void {
    let modelsMemory = 0;
    this.models.forEach(instance => {
      if (instance.status === 'ready' || instance.status === 'active') {
        modelsMemory += instance.memoryUsed;
      }
    });

    this.systemMemory.models = modelsMemory;
    this.systemMemory.used = this.systemMemory.total - this.systemMemory.available;
    
    this.emit('memory:updated', this.systemMemory);
  }

  // Check memory pressure and swap if needed
  private checkMemoryPressure(): void {
    if (this.systemMemory.available < this.config.swapThreshold) {
      this.emit('memory:pressure', {
        available: this.systemMemory.available,
        threshold: this.config.swapThreshold
      });
      this.performSwap();
    }
  }

  // Perform memory swap (unload least recently used models)
  private performSwap(): void {
    const sortedModels = Array.from(this.models.values())
      .filter(m => m.status === 'ready')
      .sort((a, b) => a.lastUsed.getTime() - b.lastUsed.getTime());

    let memoryToFree = this.config.minAvailableMemory - this.systemMemory.available;
    
    for (const instance of sortedModels) {
      if (memoryToFree <= 0) break;
      
      this.unloadModel(instance.modelId, 'memory_pressure');
      memoryToFree -= instance.memoryUsed;
    }
  }

  // Cleanup inactive models
  private cleanupInactiveModels(): void {
    const now = Date.now();
    const timeoutMs = this.config.unloadTimeout * 60 * 1000;

    this.models.forEach((instance, modelId) => {
      if (
        instance.status === 'ready' &&
        now - instance.lastUsed.getTime() > timeoutMs
      ) {
        this.unloadModel(modelId, 'inactivity');
      }
    });
  }

  // Request model load
  async requestModel(model: Model, priority: number = 0): Promise<boolean> {
    const modelMemory = model.ram || model.size || 4;
    
    // Check if already loaded
    const existing = this.models.get(model.id);
    if (existing && existing.status === 'ready') {
      existing.lastUsed = new Date();
      existing.requestCount++;
      return true;
    }

    // Check if we have enough memory
    if (!this.canLoad(modelMemory)) {
      // Try to free memory
      await this.freeMemory(modelMemory);
      
      // Check again
      if (!this.canLoad(modelMemory)) {
        this.emit('model:load-failed', {
          modelId: model.id,
          reason: 'insufficient_memory',
          required: modelMemory,
          available: this.systemMemory.available
        });
        return false;
      }
    }

    // Load the model
    return this.loadModel(model, modelMemory, priority);
  }

  // Check if model can be loaded
  private canLoad(requiredMemory: number): boolean {
    const projectedAvailable = this.systemMemory.available - requiredMemory;
    return projectedAvailable >= this.config.minAvailableMemory;
  }

  // Free memory by unloading models
  private async freeMemory(required: number): Promise<void> {
    let freed = 0;
    const sortedModels = Array.from(this.models.values())
      .filter(m => m.status === 'ready')
      .sort((a, b) => a.lastUsed.getTime() - b.lastUsed.getTime());

    for (const instance of sortedModels) {
      if (freed >= required) break;
      
      await this.unloadModel(instance.modelId, 'make_space');
      freed += instance.memoryUsed;
    }

    this.emit('memory:freed', { freed, required });
  }

  // Load a model
  private async loadModel(model: Model, memory: number, priority: number): Promise<boolean> {
    const instance: ModelInstance = {
      id: `instance-${model.id}`,
      modelId: model.id,
      status: 'loading',
      memoryUsed: memory,
      lastUsed: new Date(),
      requestCount: 1,
      loadedAt: new Date()
    };

    this.models.set(model.id, instance);
    this.emit('model:loading', { modelId: model.id, memory });

    try {
      // Simulate loading time
      await new Promise(resolve => setTimeout(resolve, 100));
      
      instance.status = 'ready';
      this.systemMemory.available -= memory;
      this.systemMemory.models += memory;
      
      this.emit('model:loaded', {
        modelId: model.id,
        memory,
        availableMemory: this.systemMemory.available
      });
      
      return true;
    } catch (error) {
      instance.status = 'error';
      this.models.delete(model.id);
      this.emit('model:error', { modelId: model.id, error });
      return false;
    }
  }

  // Unload a model
  async unloadModel(modelId: string, reason: string): Promise<void> {
    const instance = this.models.get(modelId);
    if (!instance) return;

    instance.status = 'unloading';
    this.emit('model:unloading', { modelId: modelId, reason });

    // Simulate unloading
    await new Promise(resolve => setTimeout(resolve, 50));

    this.systemMemory.available += instance.memoryUsed;
    this.systemMemory.models -= instance.memoryUsed;
    this.models.delete(modelId);

    this.swapHistory.push({
      timestamp: new Date(),
      modelId: modelId,
      reason
    });

    this.emit('model:unloaded', {
      modelId: modelId,
      reason,
      memoryFreed: instance.memoryUsed,
      availableMemory: this.systemMemory.available
    });
  }

  // Get memory stats
  getStats(): {
    memory: MemoryState;
    models: ModelInstance[];
    config: MemoryConfig;
    swapHistory: Array<{ timestamp: Date; modelId: string; reason: string }>;
  } {
    return {
      memory: { ...this.systemMemory },
      models: Array.from(this.models.values()),
      config: { ...this.config },
      swapHistory: [...this.swapHistory]
    };
  }

  // Get loaded models
  getLoadedModels(): ModelInstance[] {
    return Array.from(this.models.values()).filter(m => m.status === 'ready');
  }

  // Get model instance
  getModelInstance(modelId: string): ModelInstance | undefined {
    return this.models.get(modelId);
  }

  // Update configuration
  updateConfig(config: Partial<MemoryConfig>): void {
    this.config = { ...this.config, ...config };
    this.emit('config:updated', this.config);
  }

  // Force garbage collection (unload all inactive models)
  async forceGC(): Promise<number> {
    let freed = 0;
    const models = Array.from(this.models.values())
      .filter(m => m.status === 'ready');

    for (const instance of models) {
      freed += instance.memoryUsed;
      await this.unloadModel(instance.modelId, 'force_gc');
    }

    this.emit('gc:complete', { freed });
    return freed;
  }

  // Get memory pressure level
  getPressureLevel(): 'low' | 'medium' | 'high' | 'critical' {
    const availablePercent = (this.systemMemory.available / this.systemMemory.total) * 100;
    
    if (availablePercent > 40) return 'low';
    if (availablePercent > 25) return 'medium';
    if (availablePercent > 10) return 'high';
    return 'critical';
  }

  // Estimate memory needed for model
  estimateMemoryRequirements(models: Model[]): number {
    return models.reduce((total, model) => {
      return total + (model.ram || model.size || 4);
    }, 0);
  }

  // Check if models can be loaded together
  canLoadMultiple(models: Model[]): { canLoad: boolean; availableAfter: number } {
    const totalRequired = this.estimateMemoryRequirements(models);
    const availableAfter = this.systemMemory.available - totalRequired;
    
    return {
      canLoad: availableAfter >= this.config.minAvailableMemory,
      availableAfter: Math.max(0, availableAfter)
    };
  }
}

// Singleton instance
let memoryGovernorInstance: MemoryGovernor | null = null;

export function getMemoryGovernor(): MemoryGovernor {
  if (!memoryGovernorInstance) {
    memoryGovernorInstance = new MemoryGovernor();
  }
  return memoryGovernorInstance;
}
