/**
 * Kyro Module Manager
 * Module loading, lifecycle management, and registry
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  Module,
  ModuleManifest,
  ModuleStatus,
  ModuleDependency,
  ResourceUsage,
} from '@/types/pulse';
import { EventEmitter } from 'events';

// ============================================
// MODULE REGISTRY
// ============================================

class ModuleRegistry {
  private modules: Map<string, Module> = new Map();
  private nameToId: Map<string, string> = new Map();
  private emitter = new EventEmitter();

  register(mod: Module): void {
    this.modules.set(mod.id, mod);
    this.nameToId.set(mod.name, mod.id);
    this.emitter.emit('registered', mod);
  }

  unregister(moduleId: string): boolean {
    const mod = this.modules.get(moduleId);
    if (!mod) return false;

    this.modules.delete(moduleId);
    this.nameToId.delete(mod.name);
    this.emitter.emit('unregistered', mod);
    return true;
  }

  get(moduleId: string): Module | undefined {
    return this.modules.get(moduleId);
  }

  getByName(name: string): Module | undefined {
    const id = this.nameToId.get(name);
    return id ? this.modules.get(id) : undefined;
  }

  getAll(): Module[] {
    return Array.from(this.modules.values());
  }

  getByStatus(status: ModuleStatus): Module[] {
    return this.getAll().filter((m) => m.status === status);
  }

  getEnabled(): Module[] {
    return this.getAll().filter((m) => m.isEnabled);
  }

  update(moduleId: string, updates: Partial<Module>): Module | undefined {
    const mod = this.modules.get(moduleId);
    if (!mod) return undefined;

    const updated = { ...mod, ...updates };
    this.modules.set(moduleId, updated);
    this.emitter.emit('updated', { previous: mod, current: updated });
    return updated;
  }

  onRegistered(callback: (mod: Module) => void): () => void {
    this.emitter.on('registered', callback);
    return () => this.emitter.off('registered', callback);
  }

  onUnregistered(callback: (mod: Module) => void): () => void {
    this.emitter.on('unregistered', callback);
    return () => this.emitter.off('unregistered', callback);
  }

  onUpdated(callback: (data: { previous: Module; current: Module }) => void): () => void {
    this.emitter.on('updated', callback);
    return () => this.emitter.off('updated', callback);
  }
}

// ============================================
// MODULE LOADER
// ============================================

interface LoadResult {
  success: boolean;
  module?: Module;
  error?: string;
}

class ModuleLoader {
  private registry: ModuleRegistry;
  private emitter = new EventEmitter();

  constructor(registry: ModuleRegistry) {
    this.registry = registry;
  }

  async loadFromManifest(manifest: ModuleManifest, sourcePath: string): Promise<LoadResult> {
    try {
      // Validate manifest
      const validation = this.validateManifest(manifest);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      // Check if already loaded
      const existing = this.registry.getByName(manifest.name);
      if (existing) {
        return { success: false, error: `Module '${manifest.name}' is already loaded` };
      }

      // Check dependencies
      const depCheck = this.checkDependencies(manifest.dependencies);
      if (!depCheck.satisfied) {
        return { success: false, error: `Missing dependencies: ${depCheck.missing.join(', ')}` };
      }

      // Create module instance
      const mod: Module = {
        id: uuidv4(),
        name: manifest.name,
        version: manifest.version,
        description: manifest.description,
        entryPoint: sourcePath,
        manifest,
        permissions: manifest.permissions,
        dependencies: manifest.dependencies.map((d) => d.name),
        status: 'loading',
        isEnabled: true,
        resourceUsage: { cpu: 0, memory: 0, time: 0, peak: { cpu: 0, memory: 0 } },
      };

      // Register module
      this.registry.register(mod);

      // Simulate loading process
      await this.simulateLoad(mod);

      return { success: true, module: mod };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  private validateManifest(manifest: ModuleManifest): { valid: boolean; error?: string } {
    if (!manifest.name || typeof manifest.name !== 'string') {
      return { valid: false, error: 'Module name is required' };
    }

    if (!manifest.version || typeof manifest.version !== 'string') {
      return { valid: false, error: 'Module version is required' };
    }

    if (!manifest.entryPoint || typeof manifest.entryPoint !== 'string') {
      return { valid: false, error: 'Module entry point is required' };
    }

    if (!manifest.runtimeVersion) {
      return { valid: false, error: 'Runtime version compatibility must be specified' };
    }

    // Check runtime version compatibility
    const runtimeVersion = '1.0.0';
    if (!this.isVersionCompatible(manifest.runtimeVersion, runtimeVersion)) {
      return { valid: false, error: `Incompatible runtime version: ${manifest.runtimeVersion}` };
    }

    return { valid: true };
  }

  private isVersionCompatible(required: string, actual: string): boolean {
    // Simple semver check - major version must match
    const [requiredMajor] = required.split('.');
    const [actualMajor] = actual.split('.');
    return requiredMajor === actualMajor;
  }

  private checkDependencies(dependencies: ModuleDependency[]): {
    satisfied: boolean;
    missing: string[];
  } {
    const missing: string[] = [];

    for (const dep of dependencies) {
      if (dep.optional) continue;

      const mod = this.registry.getByName(dep.name);
      if (!mod) {
        missing.push(dep.name);
        continue;
      }

      if (dep.version && !this.isVersionCompatible(dep.version, mod.version)) {
        missing.push(`${dep.name}@${dep.version}`);
      }
    }

    return { satisfied: missing.length === 0, missing };
  }

  private async simulateLoad(mod: Module): Promise<void> {
    // Simulate loading time
    await new Promise((resolve) => setTimeout(resolve, 100 + Math.random() * 200));

    // Update status
    this.registry.update(mod.id, { status: 'active', loadedAt: new Date() });

    this.emitter.emit('loaded', mod);
  }

  async unload(moduleId: string): Promise<{ success: boolean; error?: string }> {
    const mod = this.registry.get(moduleId);
    if (!mod) {
      return { success: false, error: 'Module not found' };
    }

    // Check if other modules depend on this one
    const dependents = this.registry.getAll().filter((m) =>
      m.dependencies.includes(mod.name) && m.status === 'active'
    );

    if (dependents.length > 0) {
      return {
        success: false,
        error: `Cannot unload: modules [${dependents.map((d) => d.name).join(', ')}] depend on this module`,
      };
    }

    // Update status
    this.registry.update(moduleId, { status: 'unloaded' });
    this.emitter.emit('unloaded', mod);

    return { success: true };
  }

  async reload(moduleId: string): Promise<LoadResult> {
    const mod = this.registry.get(moduleId);
    if (!mod) {
      return { success: false, error: 'Module not found' };
    }

    // Unload
    await this.unload(moduleId);

    // Reload
    return this.loadFromManifest(mod.manifest, mod.entryPoint);
  }

  onLoaded(callback: (mod: Module) => void): () => void {
    this.emitter.on('loaded', callback);
    return () => this.emitter.off('loaded', callback);
  }

  onUnloaded(callback: (mod: Module) => void): () => void {
    this.emitter.on('unloaded', callback);
    return () => this.emitter.off('unloaded', callback);
  }
}

// ============================================
// MODULE MANAGER
// ============================================

export class ModuleManager {
  private registry: ModuleRegistry;
  private loader: ModuleLoader;
  private emitter = new EventEmitter();

  constructor() {
    this.registry = new ModuleRegistry();
    this.loader = new ModuleLoader(this.registry);

    // Forward events
    this.registry.onRegistered((mod) => this.emitter.emit('registered', mod));
    this.registry.onUnregistered((mod) => this.emitter.emit('unregistered', mod));
    this.registry.onUpdated((data) => this.emitter.emit('updated', data));
    this.loader.onLoaded((mod) => this.emitter.emit('loaded', mod));
    this.loader.onUnloaded((mod) => this.emitter.emit('unloaded', mod));
  }

  // ============================================
  // MODULE OPERATIONS
  // ============================================

  async install(manifest: ModuleManifest, sourcePath: string) {
    const result = await this.loader.loadFromManifest(manifest, sourcePath);

    if (result.success) {
      this.emitter.emit('installed', result.module);
    } else {
      this.emitter.emit('installFailed', { manifest, error: result.error });
    }

    return result;
  }

  async uninstall(moduleId: string) {
    const mod = this.registry.get(moduleId);
    if (!mod) {
      return { success: false, error: 'Module not found' };
    }

    // Unload first
    await this.loader.unload(moduleId);

    // Remove from registry
    const removed = this.registry.unregister(moduleId);

    if (removed) {
      this.emitter.emit('uninstalled', mod);
    }

    return { success: removed };
  }

  async enable(moduleId: string) {
    const mod = this.registry.get(moduleId);
    if (!mod) {
      return { success: false, error: 'Module not found' };
    }

    if (mod.isEnabled) {
      return { success: true, module: mod };
    }

    const updated = this.registry.update(moduleId, { isEnabled: true, status: 'active' });
    this.emitter.emit('enabled', updated);

    return { success: true, module: updated };
  }

  async disable(moduleId: string) {
    const mod = this.registry.get(moduleId);
    if (!mod) {
      return { success: false, error: 'Module not found' };
    }

    if (!mod.isEnabled) {
      return { success: true, module: mod };
    }

    const updated = this.registry.update(moduleId, { isEnabled: false, status: 'unloaded' });
    this.emitter.emit('disabled', updated);

    return { success: true, module: updated };
  }

  async reload(moduleId: string) {
    const result = await this.loader.reload(moduleId);

    if (result.success) {
      this.emitter.emit('reloaded', result.module);
    }

    return result;
  }

  // ============================================
  // QUERY OPERATIONS
  // ============================================

  get(moduleId: string): Module | undefined {
    return this.registry.get(moduleId);
  }

  getByName(name: string): Module | undefined {
    return this.registry.getByName(name);
  }

  getAll(): Module[] {
    return this.registry.getAll();
  }

  getByStatus(status: ModuleStatus): Module[] {
    return this.registry.getByStatus(status);
  }

  getActive(): Module[] {
    return this.getByStatus('active');
  }

  // ============================================
  // STATISTICS
  // ============================================

  getStats() {
    const modules = this.registry.getAll();

    return {
      total: modules.length,
      active: modules.filter((m) => m.status === 'active').length,
      loaded: modules.filter((m) => m.status === 'loaded' || m.status === 'active').length,
      error: modules.filter((m) => m.status === 'error').length,
      enabled: modules.filter((m) => m.isEnabled).length,
    };
  }

  getResourceUsage(): { totalCpu: number; totalMemory: number; byModule: Map<string, ResourceUsage> } {
    let totalCpu = 0;
    let totalMemory = 0;
    const byModule = new Map<string, ResourceUsage>();

    for (const mod of this.registry.getAll()) {
      if (mod.status === 'active') {
        totalCpu += mod.resourceUsage.cpu;
        totalMemory += mod.resourceUsage.memory;
        byModule.set(mod.id, mod.resourceUsage);
      }
    }

    return { totalCpu, totalMemory, byModule };
  }

  // ============================================
  // EVENTS
  // ============================================

  onRegistered(callback: (mod: Module) => void): () => void {
    this.emitter.on('registered', callback);
    return () => this.emitter.off('registered', callback);
  }

  onUnregistered(callback: (mod: Module) => void): () => void {
    this.emitter.on('unregistered', callback);
    return () => this.emitter.off('unregistered', callback);
  }

  onLoaded(callback: (mod: Module) => void): () => void {
    this.emitter.on('loaded', callback);
    return () => this.emitter.off('loaded', callback);
  }

  onUnloaded(callback: (mod: Module) => void): () => void {
    this.emitter.on('unloaded', callback);
    return () => this.emitter.off('unloaded', callback);
  }

  onInstalled(callback: (mod: Module) => void): () => void {
    this.emitter.on('installed', callback);
    return () => this.emitter.off('installed', callback);
  }

  onUninstalled(callback: (mod: Module) => void): () => void {
    this.emitter.on('uninstalled', callback);
    return () => this.emitter.off('uninstalled', callback);
  }

  onEnabled(callback: (mod: Module) => void): () => void {
    this.emitter.on('enabled', callback);
    return () => this.emitter.off('enabled', callback);
  }

  onDisabled(callback: (mod: Module) => void): () => void {
    this.emitter.on('disabled', callback);
    return () => this.emitter.off('disabled', callback);
  }
}

export const getModuleManager = (): ModuleManager => new ModuleManager();
