/**
 * Kyro IDE - Extension Host
 * Manages extension lifecycle, loading, and execution
 */

import { EventEmitter } from 'events';

// ============================================================================
// TYPES
// ============================================================================

export interface ExtensionManifest {
  name: string;
  version: string;
  displayName?: string;
  description?: string;
  publisher: string;
  main?: string;
  activationEvents?: string[];
  contributes?: ExtensionContributions;
  dependencies?: Record<string, string>;
  extensionDependencies?: string[];
  engines?: { vscode?: string; kyroIde?: string };
  categories?: string[];
  keywords?: string[];
  icon?: string;
  readme?: string;
  changelog?: string;
  license?: string;
}

export interface ExtensionContributions {
  commands?: Array<{
    command: string;
    title: string;
    category?: string;
    icon?: string;
    keybinding?: string;
  }>;
  menus?: Record<string, Array<{
    command: string;
    group?: string;
    when?: string;
  }>>;
  languages?: Array<{
    id: string;
    extensions?: string[];
    aliases?: string[];
    filenames?: string[];
    firstLine?: string;
    configuration?: string;
  }>;
  grammars?: Array<{
    language: string;
    scopeName: string;
    path: string;
  }>;
  themes?: Array<{
    label: string;
    uiTheme?: string;
    path: string;
  }>;
  keybindings?: Array<{
    command: string;
    key: string;
    when?: string;
  }>;
  configuration?: {
    title: string;
    properties: Record<string, {
      type: string;
      default?: unknown;
      description: string;
      enum?: string[];
    }>;
  };
}

export interface Extension {
  id: string;
  manifest: ExtensionManifest;
  path: string;
  status: 'inactive' | 'activating' | 'active' | 'failed';
  error?: string;
  activatedAt?: Date;
  exports?: unknown;
}

export interface ExtensionContext {
  subscriptions: Array<{ dispose: () => void }>;
  extensionPath: string;
  globalState: Map<string, unknown>;
  workspaceState: Map<string, unknown>;
  logPath: string;
  storagePath: string;
}

export type ActivationFunction = (context: ExtensionContext) => unknown | Promise<unknown>;
export type DeactivationFunction = () => void | Promise<void>;

// ============================================================================
// EXTENSION HOST
// ============================================================================

class ExtensionHost extends EventEmitter {
  private extensions: Map<string, Extension> = new Map();
  private activationQueue: string[] = [];
  private isActivating = false;
  private context: ExtensionContext;

  constructor() {
    super();
    this.context = {
      subscriptions: [],
      extensionPath: '',
      globalState: new Map(),
      workspaceState: new Map(),
      logPath: '/logs',
      storagePath: '/storage',
    };
  }

  // Register an extension
  registerExtension(manifest: ExtensionManifest, path: string): Extension {
    const id = `${manifest.publisher}.${manifest.name}`;
    
    const extension: Extension = {
      id,
      manifest,
      path,
      status: 'inactive',
    };

    this.extensions.set(id, extension);
    this.emit('registered', extension);

    // Auto-activate if needed
    if (this.shouldAutoActivate(manifest)) {
      this.queueActivation(id);
    }

    return extension;
  }

  // Check if extension should auto-activate
  private shouldAutoActivate(manifest: ExtensionManifest): boolean {
    if (!manifest.activationEvents || manifest.activationEvents.length === 0) {
      return true; // Activate on startup if no events specified
    }

    return manifest.activationEvents.some(event => {
      if (event === 'onStartupFinished') return true;
      if (event.startsWith('onLanguage:')) return true; // Will activate when language is used
      if (event.startsWith('onCommand:')) return false; // Activate on command
      if (event.startsWith('workspaceContains:')) return false; // Will activate when file matches
      if (event.startsWith('onFileSystem:')) return false;
      return false;
    });
  }

  // Queue extension for activation
  queueActivation(id: string): void {
    if (!this.activationQueue.includes(id)) {
      this.activationQueue.push(id);
      this.processQueue();
    }
  }

  // Process activation queue
  private async processQueue(): Promise<void> {
    if (this.isActivating || this.activationQueue.length === 0) return;

    this.isActivating = true;

    while (this.activationQueue.length > 0) {
      const id = this.activationQueue.shift()!;
      await this.activateExtension(id);
    }

    this.isActivating = false;
  }

  // Activate an extension
  async activateExtension(id: string): Promise<boolean> {
    const extension = this.extensions.get(id);
    if (!extension || extension.status === 'active') return false;

    extension.status = 'activating';
    this.emit('activating', extension);

    try {
      // Check dependencies
      const deps = extension.manifest.extensionDependencies || [];
      for (const depId of deps) {
        const dep = this.extensions.get(depId);
        if (!dep || dep.status !== 'active') {
          throw new Error(`Dependency ${depId} is not available`);
        }
      }

      // Load and execute extension
      const mainPath = extension.manifest.main || 'index.js';
      const fullPath = `${extension.path}/${mainPath}`;

      // In browser environment, we need to load the extension differently
      // This would typically be done via dynamic import or a custom loader
      const activate = await this.loadExtensionModule(fullPath);

      if (typeof activate === 'function') {
        const context: ExtensionContext = {
          ...this.context,
          extensionPath: extension.path,
        };

        extension.exports = await activate(context);
      }

      extension.status = 'active';
      extension.activatedAt = new Date();
      this.emit('activated', extension);

      return true;
    } catch (error) {
      extension.status = 'failed';
      extension.error = error instanceof Error ? error.message : 'Unknown error';
      this.emit('failed', { extension, error });
      return false;
    }
  }

  // Load extension module (browser-compatible)
  private async loadExtensionModule(path: string): Promise<ActivationFunction | null> {
    // In a real implementation, this would use a module loader
    // For now, return null as extensions need to be pre-loaded
    console.log(`Loading extension module from: ${path}`);
    return null;
  }

  // Deactivate an extension
  async deactivateExtension(id: string): Promise<boolean> {
    const extension = this.extensions.get(id);
    if (!extension || extension.status !== 'active') return false;

    try {
      // Check if other extensions depend on this one
      for (const [extId, ext] of this.extensions) {
        if (ext.manifest.extensionDependencies?.includes(id) && ext.status === 'active') {
          await this.deactivateExtension(extId);
        }
      }

      // Call deactivate if available
      if (extension.exports && typeof (extension.exports as any).deactivate === 'function') {
        await (extension.exports as any).deactivate();
      }

      extension.status = 'inactive';
      extension.activatedAt = undefined;
      this.emit('deactivated', extension);

      return true;
    } catch (error) {
      extension.error = error instanceof Error ? error.message : 'Unknown error';
      this.emit('error', { extension, error });
      return false;
    }
  }

  // Unregister an extension
  async unregisterExtension(id: string): Promise<boolean> {
    const extension = this.extensions.get(id);
    if (!extension) return false;

    if (extension.status === 'active') {
      await this.deactivateExtension(id);
    }

    this.extensions.delete(id);
    this.emit('unregistered', extension);
    return true;
  }

  // Get extension by ID
  getExtension(id: string): Extension | undefined {
    return this.extensions.get(id);
  }

  // Get all extensions
  getAllExtensions(): Extension[] {
    return Array.from(this.extensions.values());
  }

  // Get active extensions
  getActiveExtensions(): Extension[] {
    return this.getAllExtensions().filter(e => e.status === 'active');
  }

  // Get extension contributions
  getContributions(): ExtensionContributions {
    const contributions: ExtensionContributions = {
      commands: [],
      languages: [],
      grammars: [],
      themes: [],
      keybindings: [],
    };

    for (const extension of this.getActiveExtensions()) {
      const extContrib = extension.manifest.contributes;
      if (extContrib) {
        if (extContrib.commands) contributions.commands?.push(...extContrib.commands);
        if (extContrib.languages) contributions.languages?.push(...extContrib.languages);
        if (extContrib.grammars) contributions.grammars?.push(...extContrib.grammars);
        if (extContrib.themes) contributions.themes?.push(...extContrib.themes);
        if (extContrib.keybindings) contributions.keybindings?.push(...extContrib.keybindings);
      }
    }

    return contributions;
  }

  // Activate by event
  activateByEvent(event: string): Promise<void[]> {
    const toActivate: string[] = [];

    for (const [id, extension] of this.extensions) {
      if (extension.status !== 'inactive') continue;

      const events = extension.manifest.activationEvents || [];
      if (events.some(e => {
        if (e === event) return true;
        if (e.startsWith('onLanguage:') && event.startsWith('onLanguage:')) {
          return e.slice('onLanguage:'.length) === event.slice('onLanguage:'.length);
        }
        if (e.startsWith('onCommand:') && event.startsWith('onCommand:')) {
          return e.slice('onCommand:'.length) === event.slice('onCommand:'.length);
        }
        return false;
      })) {
        toActivate.push(id);
      }
    }

    return Promise.all(toActivate.map(id => this.activateExtension(id)));
  }

  // Dispose all extensions
  async dispose(): Promise<void> {
    const activeExtensions = this.getActiveExtensions();
    for (const extension of activeExtensions.reverse()) {
      await this.deactivateExtension(extension.id);
    }
    this.extensions.clear();
    this.emit('disposed');
  }
}

// Export singleton
export const extensionHost = new ExtensionHost();
