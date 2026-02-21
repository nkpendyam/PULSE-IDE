// Kyro IDE - Developer SDK
// Plugin architecture and extensibility API

import { Plugin, Command, View } from '@/types/ide';
import { EventEmitter } from 'events';

// ============================================================================
// SDK TYPES
// ============================================================================

interface SDKContext {
  version: string;
  ide: {
    getVersion: () => string;
    getActiveFile: () => string | null;
    openFile: (path: string) => Promise<void>;
    saveFile: (path: string, content: string) => Promise<void>;
    closeFile: (path: string) => Promise<void>;
  };
  editor: {
    getText: () => string;
    setText: (text: string) => void;
    getSelection: () => { start: number; end: number };
    setSelection: (start: number, end: number) => void;
    insertText: (text: string) => void;
  };
  ai: {
    chat: (message: string, options?: ChatOptions) => Promise<string>;
    complete: (prompt: string) => Promise<string>;
    analyze: (code: string) => Promise<AnalysisResult>;
  };
  terminal: {
    execute: (command: string) => Promise<ExecuteResult>;
    create: (name: string) => Promise<string>;
    destroy: (id: string) => void;
  };
  files: {
    read: (path: string) => Promise<string>;
    write: (path: string, content: string) => Promise<void>;
    exists: (path: string) => Promise<boolean>;
    list: (path: string) => Promise<string[]>;
    delete: (path: string) => Promise<void>;
    watch: (path: string, callback: (event: FileWatchEvent) => void) => () => void;
  };
  ui: {
    showMessage: (message: string, type?: 'info' | 'warning' | 'error') => void;
    showInput: (prompt: string, defaultValue?: string) => Promise<string | undefined>;
    showConfirm: (message: string) => Promise<boolean>;
    showQuickPick: (items: string[], options?: QuickPickOptions) => Promise<string | undefined>;
  };
}

interface ChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  context?: string[];
}

interface AnalysisResult {
  issues: Array<{
    severity: 'error' | 'warning' | 'info';
    message: string;
    line: number;
    column: number;
  }>;
  suggestions: string[];
  summary: string;
}

interface ExecuteResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

interface FileWatchEvent {
  type: 'create' | 'change' | 'delete';
  path: string;
}

interface QuickPickOptions {
  placeholder?: string;
  canPickMany?: boolean;
}

type CommandHandler = (ctx: SDKContext) => void | Promise<void>;
type ViewRenderer = (ctx: SDKContext) => React.ReactNode;

// ============================================================================
// PLUGIN SDK
// ============================================================================

export class PluginSDK extends EventEmitter {
  private plugins: Map<string, Plugin> = new Map();
  private commands: Map<string, { handler: CommandHandler; plugin: string }> = new Map();
  private views: Map<string, { renderer: ViewRenderer; plugin: string }> = new Map();
  private context: SDKContext;
  private hooks: Map<string, Set<(...args: unknown[]) => void>> = new Map();

  constructor() {
    super();
    this.context = this.createContext();
  }

  // Create SDK context
  private createContext(): SDKContext {
    return {
      version: '1.0.0',
      ide: {
        getVersion: () => '1.0.0',
        getActiveFile: () => null,
        openFile: async (path: string) => {
          this.emit('file:open', path);
        },
        saveFile: async (path: string, content: string) => {
          this.emit('file:save', { path, content });
        },
        closeFile: async (path: string) => {
          this.emit('file:close', path);
        }
      },
      editor: {
        getText: () => '',
        setText: (text: string) => {
          this.emit('editor:setText', text);
        },
        getSelection: () => ({ start: 0, end: 0 }),
        setSelection: (start: number, end: number) => {
          this.emit('editor:setSelection', { start, end });
        },
        insertText: (text: string) => {
          this.emit('editor:insert', text);
        }
      },
      ai: {
        chat: async (message: string, options?: ChatOptions) => {
          this.emit('ai:chat', { message, options });
          return 'AI response placeholder';
        },
        complete: async (prompt: string) => {
          this.emit('ai:complete', prompt);
          return 'Completion placeholder';
        },
        analyze: async (code: string) => {
          this.emit('ai:analyze', code);
          return {
            issues: [],
            suggestions: [],
            summary: 'Analysis placeholder'
          };
        }
      },
      terminal: {
        execute: async (command: string) => {
          this.emit('terminal:execute', command);
          return { stdout: '', stderr: '', exitCode: 0 };
        },
        create: async (name: string) => {
          const id = `terminal-${Date.now()}`;
          this.emit('terminal:create', { id, name });
          return id;
        },
        destroy: (id: string) => {
          this.emit('terminal:destroy', id);
        }
      },
      files: {
        read: async (path: string) => {
          this.emit('file:read', path);
          return '';
        },
        write: async (path: string, content: string) => {
          this.emit('file:write', { path, content });
        },
        exists: async (path: string) => {
          this.emit('file:exists', path);
          return false;
        },
        list: async (path: string) => {
          this.emit('file:list', path);
          return [];
        },
        delete: async (path: string) => {
          this.emit('file:delete', path);
        },
        watch: (path: string, callback: (event: FileWatchEvent) => void) => {
          const handler = (event: FileWatchEvent) => callback(event);
          this.on('file:watch', handler);
          return () => this.off('file:watch', handler);
        }
      },
      ui: {
        showMessage: (message: string, type: 'info' | 'warning' | 'error' = 'info') => {
          this.emit('ui:message', { message, type });
        },
        showInput: async (prompt: string, defaultValue?: string) => {
          this.emit('ui:input', { prompt, defaultValue });
          return undefined;
        },
        showConfirm: async (message: string) => {
          this.emit('ui:confirm', message);
          return false;
        },
        showQuickPick: async (items: string[], options?: QuickPickOptions) => {
          this.emit('ui:quickpick', { items, options });
          return undefined;
        }
      }
    };
  }

  // Register a plugin
  registerPlugin(plugin: Plugin): boolean {
    if (this.plugins.has(plugin.id)) {
      console.warn(`Plugin ${plugin.id} is already registered`);
      return false;
    }

    // Register commands
    plugin.commands.forEach(cmd => {
      this.commands.set(cmd.id, { handler: cmd.handler, plugin: plugin.id });
    });

    // Register views
    plugin.views.forEach(view => {
      this.views.set(view.id, { renderer: view.render, plugin: plugin.id });
    });

    this.plugins.set(plugin.id, plugin);
    this.emit('plugin:registered', plugin);
    return true;
  }

  // Unregister a plugin
  unregisterPlugin(pluginId: string): boolean {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) return false;

    // Remove commands
    plugin.commands.forEach(cmd => {
      this.commands.delete(cmd.id);
    });

    // Remove views
    plugin.views.forEach(view => {
      this.views.delete(view.id);
    });

    this.plugins.delete(pluginId);
    this.emit('plugin:unregistered', pluginId);
    return true;
  }

  // Get all plugins
  getPlugins(): Plugin[] {
    return Array.from(this.plugins.values());
  }

  // Get plugin by ID
  getPlugin(id: string): Plugin | undefined {
    return this.plugins.get(id);
  }

  // Execute a command
  async executeCommand(commandId: string): Promise<void> {
    const cmd = this.commands.get(commandId);
    if (!cmd) {
      throw new Error(`Command ${commandId} not found`);
    }

    try {
      await cmd.handler(this.context);
      this.emit('command:executed', { commandId, plugin: cmd.plugin });
    } catch (error) {
      this.emit('command:error', { commandId, plugin: cmd.plugin, error });
      throw error;
    }
  }

  // Get all commands
  getCommands(): Array<Command & { plugin: string }> {
    return Array.from(this.commands.entries()).map(([id, { handler, plugin }]) => {
      const pluginObj = this.plugins.get(plugin);
      const cmd = pluginObj?.commands.find(c => c.id === id);
      return { id, ...cmd!, plugin };
    });
  }

  // Render a view
  renderView(viewId: string): React.ReactNode {
    const view = this.views.get(viewId);
    if (!view) return null;
    return view.renderer(this.context);
  }

  // Get all views
  getViews(): Array<{ id: string; type: string; title: string; plugin: string }> {
    return Array.from(this.views.entries()).map(([id, { plugin }]) => {
      const pluginObj = this.plugins.get(plugin);
      const view = pluginObj?.views.find(v => v.id === id);
      return { id, type: view?.type || 'panel', title: view?.title || '', plugin };
    });
  }

  // Register a hook
  registerHook(event: string, callback: (...args: unknown[]) => void): () => void {
    if (!this.hooks.has(event)) {
      this.hooks.set(event, new Set());
    }
    this.hooks.get(event)!.add(callback);
    
    return () => {
      this.hooks.get(event)?.delete(callback);
    };
  }

  // Trigger a hook
  triggerHook(event: string, ...args: unknown[]): void {
    const callbacks = this.hooks.get(event);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(...args);
        } catch (error) {
          console.error(`Hook error for ${event}:`, error);
        }
      });
    }
  }

  // Enable a plugin
  enablePlugin(pluginId: string): boolean {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) return false;
    plugin.enabled = true;
    this.emit('plugin:enabled', pluginId);
    return true;
  }

  // Disable a plugin
  disablePlugin(pluginId: string): boolean {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) return false;
    plugin.enabled = false;
    this.emit('plugin:disabled', pluginId);
    return true;
  }

  // Get SDK context
  getContext(): SDKContext {
    return this.context;
  }

  // Update context (for IDE integration)
  updateContext(updates: Partial<SDKContext>): void {
    this.context = { ...this.context, ...updates };
  }
}

// ============================================================================
// BUILT-IN PLUGINS
// ============================================================================

export const BUILTIN_PLUGINS: Plugin[] = [
  {
    id: 'pulse.core',
    name: 'PULSE Core',
    version: '1.0.0',
    description: 'Core functionality for Kyro IDE',
    author: 'PULSE Team',
    enabled: true,
    entry: 'builtin://core',
    commands: [
      {
        id: 'pulse.newFile',
        title: 'New File',
        category: 'File',
        keybinding: 'Ctrl+N',
        handler: async (ctx) => {
          ctx.ui.showMessage('Creating new file...');
        }
      },
      {
        id: 'pulse.save',
        title: 'Save',
        category: 'File',
        keybinding: 'Ctrl+S',
        handler: async (ctx) => {
          ctx.ui.showMessage('File saved');
        }
      },
      {
        id: 'pulse.format',
        title: 'Format Document',
        category: 'Edit',
        keybinding: 'Shift+Alt+F',
        handler: async (ctx) => {
          ctx.ui.showMessage('Formatting document...');
        }
      },
      {
        id: 'pulse.aiExplain',
        title: 'Explain Code',
        category: 'AI',
        keybinding: 'Ctrl+Shift+E',
        handler: async (ctx) => {
          const code = ctx.editor.getText();
          const explanation = await ctx.ai.analyze(code);
          ctx.ui.showMessage(explanation.summary);
        }
      },
      {
        id: 'pulse.aiRefactor',
        title: 'AI Refactor',
        category: 'AI',
        keybinding: 'Ctrl+Shift+R',
        handler: async (ctx) => {
          const code = ctx.editor.getText();
          const result = await ctx.ai.complete(`Refactor this code:\n\n${code}`);
          ctx.editor.setText(result);
        }
      },
      {
        id: 'pulse.runTests',
        title: 'Run Tests',
        category: 'Test',
        keybinding: 'Ctrl+Shift+T',
        handler: async (ctx) => {
          const result = await ctx.terminal.execute('npm test');
          ctx.ui.showMessage(`Tests completed with exit code ${result.exitCode}`);
        }
      }
    ],
    views: []
  },
  {
    id: 'pulse.git',
    name: 'Git Integration',
    version: '1.0.0',
    description: 'Git version control integration',
    author: 'PULSE Team',
    enabled: true,
    entry: 'builtin://git',
    commands: [
      {
        id: 'git.commit',
        title: 'Commit',
        category: 'Git',
        handler: async (ctx) => {
          const message = await ctx.ui.showInput('Commit message');
          if (message) {
            await ctx.terminal.execute(`git commit -m "${message}"`);
            ctx.ui.showMessage('Changes committed');
          }
        }
      },
      {
        id: 'git.push',
        title: 'Push',
        category: 'Git',
        handler: async (ctx) => {
          await ctx.terminal.execute('git push');
          ctx.ui.showMessage('Changes pushed');
        }
      },
      {
        id: 'git.pull',
        title: 'Pull',
        category: 'Git',
        handler: async (ctx) => {
          await ctx.terminal.execute('git pull');
          ctx.ui.showMessage('Changes pulled');
        }
      }
    ],
    views: []
  },
  {
    id: 'pulse.terminal',
    name: 'Terminal',
    version: '1.0.0',
    description: 'Integrated terminal',
    author: 'PULSE Team',
    enabled: true,
    entry: 'builtin://terminal',
    commands: [
      {
        id: 'terminal.new',
        title: 'New Terminal',
        category: 'Terminal',
        keybinding: 'Ctrl+`',
        handler: async (ctx) => {
          await ctx.terminal.create('Terminal');
        }
      },
      {
        id: 'terminal.clear',
        title: 'Clear Terminal',
        category: 'Terminal',
        handler: async (ctx) => {
          ctx.ui.showMessage('Terminal cleared');
        }
      }
    ],
    views: []
  }
];

// Singleton instance
let pluginSDKInstance: PluginSDK | null = null;

export function getPluginSDK(): PluginSDK {
  if (!pluginSDKInstance) {
    pluginSDKInstance = new PluginSDK();
    // Register built-in plugins
    BUILTIN_PLUGINS.forEach(plugin => {
      pluginSDKInstance.registerPlugin(plugin);
    });
  }
  return pluginSDKInstance;
}
