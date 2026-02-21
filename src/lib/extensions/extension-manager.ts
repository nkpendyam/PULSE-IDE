/**
 * Kyro IDE Extension System
 * Plugin architecture for extending IDE functionality
 */

export interface Extension {
  id: string;
  name: string;
  version: string;
  publisher: string;
  displayName: string;
  description: string;
  categories: string[];
  keywords?: string[];
  activationEvents?: string[];
  main?: string;
  contributes?: ExtensionContributions;
  enabled: boolean;
  installed: boolean;
}

export interface ExtensionContributions {
  commands?: CommandContribution[];
  menus?: MenuContribution[];
  keybindings?: KeybindingContribution[];
  languages?: LanguageContribution[];
  debuggers?: DebuggerContribution[];
  themes?: ThemeContribution[];
  icons?: IconContribution[];
  snippets?: SnippetContribution[];
  configuration?: ConfigurationContribution;
}

export interface CommandContribution {
  command: string;
  title: string;
  category?: string;
  icon?: string;
  when?: string;
}

export interface MenuContribution {
  id: string;
  items: { command: string; group?: string; when?: string }[];
}

export interface KeybindingContribution {
  command: string;
  key: string;
  mac?: string;
  linux?: string;
  win?: string;
  when?: string;
}

export interface LanguageContribution {
  id: string;
  extensions: string[];
  aliases?: string[];
  filenames?: string[];
  configuration?: string;
}

export interface DebuggerContribution {
  type: string;
  label: string;
  program?: string;
  runtime?: string;
  configurationAttributes?: Record<string, unknown>;
  initialConfigurations?: unknown[];
}

export interface ThemeContribution {
  id: string;
  label: string;
  uiTheme: 'vs' | 'vs-dark' | 'hc-black';
  path: string;
}

export interface IconContribution {
  id: string;
  label: string;
  path: string;
}

export interface SnippetContribution {
  language: string;
  path: string;
}

export interface ConfigurationContribution {
  title: string;
  properties: Record<string, {
    type: string;
    default?: unknown;
    description: string;
    enum?: string[];
  }>;
}

export interface ExtensionAPI {
  commands: {
    registerCommand(command: string, callback: (...args: unknown[]) => unknown): void;
    executeCommand(command: string, ...args: unknown[]): Promise<unknown>;
    getCommands(): string[];
  };
  workspace: {
    getWorkspaceFolders(): { uri: string; name: string; index: number }[];
    getConfiguration(section?: string): Record<string, unknown>;
    onDidChangeConfiguration: (listener: () => void) => void;
  };
  window: {
    showInformationMessage(message: string): Promise<void>;
    showWarningMessage(message: string): Promise<void>;
    showErrorMessage(message: string): Promise<void>;
    showInputBox(options: { prompt?: string; value?: string }): Promise<string | undefined>;
    showQuickPick(items: string[]): Promise<string | undefined>;
    createOutputChannel(name: string): { append(value: string): void; show(): void };
    createTerminal(name: string, shellPath?: string): { sendText(text: string): void; show(): void };
  };
  languages: {
    registerCompletionItemProvider(language: string, provider: unknown): void;
    registerHoverProvider(language: string, provider: unknown): void;
    registerDefinitionProvider(language: string, provider: unknown): void;
  };
}

type ExtensionActivationHandler = (api: ExtensionAPI) => void | Promise<void>;

// ============================================================================
// EXTENSION MANAGER
// ============================================================================

class ExtensionManager {
  private extensions: Map<string, Extension> = new Map();
  private activationHandlers: Map<string, ExtensionActivationHandler> = new Map();
  private commands: Map<string, (...args: unknown[]) => unknown> = new Map();
  private outputChannels: Map<string, { append: (v: string) => void; show: () => void }> = new Map();
  private terminals: Map<string, { sendText: (t: string) => void; show: () => void }> = new Map();

  /**
   * Register an extension
   */
  register(extension: Extension, activationHandler?: ExtensionActivationHandler): void {
    this.extensions.set(extension.id, extension);
    if (activationHandler) {
      this.activationHandlers.set(extension.id, activationHandler);
    }
  }

  /**
   * Activate an extension
   */
  async activate(extensionId: string): Promise<void> {
    const extension = this.extensions.get(extensionId);
    if (!extension || !extension.enabled) return;

    const handler = this.activationHandlers.get(extensionId);
    if (handler) {
      await handler(this.getAPI());
    }

    // Register contributed commands
    if (extension.contributes?.commands) {
      for (const cmd of extension.contributes.commands) {
        this.commands.set(cmd.command, () => console.log(`Executed: ${cmd.command}`));
      }
    }
  }

  /**
   * Deactivate an extension
   */
  deactivate(extensionId: string): void {
    const extension = this.extensions.get(extensionId);
    if (!extension) return;

    // Remove contributed commands
    if (extension.contributes?.commands) {
      for (const cmd of extension.contributes.commands) {
        this.commands.delete(cmd.command);
      }
    }
  }

  /**
   * Enable/disable extension
   */
  setEnabled(extensionId: string, enabled: boolean): void {
    const ext = this.extensions.get(extensionId);
    if (ext) {
      ext.enabled = enabled;
      if (enabled) this.activate(extensionId);
      else this.deactivate(extensionId);
    }
  }

  /**
   * Get all extensions
   */
  getExtensions(): Extension[] {
    return Array.from(this.extensions.values());
  }

  /**
   * Get extension by ID
   */
  getExtension(id: string): Extension | undefined {
    return this.extensions.get(id);
  }

  /**
   * Execute command
   */
  async executeCommand(command: string, ...args: unknown[]): Promise<unknown> {
    const handler = this.commands.get(command);
    if (handler) return handler(...args);
    throw new Error(`Command not found: ${command}`);
  }

  /**
   * Get all commands
   */
  getCommands(): string[] {
    return Array.from(this.commands.keys());
  }

  /**
   * Register command
   */
  registerCommand(command: string, handler: (...args: unknown[]) => unknown): void {
    this.commands.set(command, handler);
  }

  /**
   * Get extension API
   */
  private getAPI(): ExtensionAPI {
    return {
      commands: {
        registerCommand: (cmd, cb) => this.commands.set(cmd, cb),
        executeCommand: (cmd, ...args) => this.executeCommand(cmd, ...args),
        getCommands: () => Array.from(this.commands.keys()),
      },
      workspace: {
        getWorkspaceFolders: () => [],
        getConfiguration: () => ({}),
        onDidChangeConfiguration: () => {},
      },
      window: {
        showInformationMessage: async (msg) => console.log('[INFO]', msg),
        showWarningMessage: async (msg) => console.warn('[WARN]', msg),
        showErrorMessage: async (msg) => console.error('[ERROR]', msg),
        showInputBox: async (opts) => opts.value || '',
        showQuickPick: async (items) => items[0],
        createOutputChannel: (name) => {
          const channel = { append: (v: string) => console.log(`[${name}]`, v), show: () => {} };
          this.outputChannels.set(name, channel);
          return channel;
        },
        createTerminal: (name, shell) => {
          const term = { sendText: (t: string) => console.log(`[${name}]`, t), show: () => {} };
          this.terminals.set(name, term);
          return term;
        },
      },
      languages: {
        registerCompletionItemProvider: () => {},
        registerHoverProvider: () => {},
        registerDefinitionProvider: () => {},
      },
    };
  }
}

// Singleton
export const extensionManager = new ExtensionManager();

// ============================================================================
// BUILT-IN EXTENSIONS
// ============================================================================

export const builtInExtensions: Extension[] = [
  {
    id: 'kyro.typescript',
    name: 'typescript',
    version: '1.0.0',
    publisher: 'kyro',
    displayName: 'TypeScript Language Features',
    description: 'TypeScript and JavaScript language support',
    categories: ['Programming Languages'],
    enabled: true,
    installed: true,
    contributes: {
      languages: [{ id: 'typescript', extensions: ['.ts', '.tsx'], aliases: ['TypeScript', 'tsx'] }],
      configuration: {
        title: 'TypeScript',
        properties: {
          'typescript.tsdk': { type: 'string', description: 'Path to TypeScript SDK' },
          'typescript.format.enable': { type: 'boolean', default: true, description: 'Enable formatting' },
        },
      },
    },
  },
  {
    id: 'kyro.python',
    name: 'python',
    version: '1.0.0',
    publisher: 'kyro',
    displayName: 'Python Language Features',
    description: 'Python language support',
    categories: ['Programming Languages'],
    enabled: true,
    installed: true,
    contributes: {
      languages: [{ id: 'python', extensions: ['.py', '.pyw'], aliases: ['Python'] }],
      debuggers: [{ type: 'python', label: 'Python', program: 'python' }],
    },
  },
  {
    id: 'kyro.rust',
    name: 'rust',
    version: '1.0.0',
    publisher: 'kyro',
    displayName: 'Rust Language Features',
    description: 'Rust language support',
    categories: ['Programming Languages'],
    enabled: true,
    installed: true,
    contributes: {
      languages: [{ id: 'rust', extensions: ['.rs'], aliases: ['Rust'] }],
    },
  },
  {
    id: 'kyro.go',
    name: 'go',
    version: '1.0.0',
    publisher: 'kyro',
    displayName: 'Go Language Features',
    description: 'Go language support',
    categories: ['Programming Languages'],
    enabled: true,
    installed: true,
    contributes: {
      languages: [{ id: 'go', extensions: ['.go'], aliases: ['Go'] }],
    },
  },
  {
    id: 'kyro.git',
    name: 'git',
    version: '1.0.0',
    publisher: 'kyro',
    displayName: 'Git Integration',
    description: 'Git source control integration',
    categories: ['SCM Providers'],
    enabled: true,
    installed: true,
    contributes: {
      commands: [
        { command: 'git.commit', title: 'Commit', category: 'Git' },
        { command: 'git.push', title: 'Push', category: 'Git' },
        { command: 'git.pull', title: 'Pull', category: 'Git' },
        { command: 'git.clone', title: 'Clone', category: 'Git' },
      ],
    },
  },
  {
    id: 'kyro.terminal',
    name: 'terminal',
    version: '1.0.0',
    publisher: 'kyro',
    displayName: 'Terminal',
    description: 'Integrated terminal support',
    categories: ['Other'],
    enabled: true,
    installed: true,
    contributes: {
      commands: [
        { command: 'terminal.new', title: 'New Terminal', category: 'Terminal' },
        { command: 'terminal.split', title: 'Split Terminal', category: 'Terminal' },
      ],
    },
  },
];

// Register built-in extensions
for (const ext of builtInExtensions) {
  extensionManager.register(ext);
}
