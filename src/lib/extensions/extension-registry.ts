/**
 * Kyro IDE Extension Registry
 * Tracks installed extensions and their metadata
 */

import type { Extension, ExtensionContributions } from './extension-manager';
import { db } from '@/lib/db';

// ============================================================================
// TYPES
// ============================================================================

export interface ExtensionRegistryEntry {
  /** Unique extension identifier */
  id: string;
  /** Extension name */
  name: string;
  /** Publisher name */
  publisher: string;
  /** Version string */
  version: string;
  /** Display name */
  displayName: string;
  /** Description */
  description: string;
  /** Categories */
  categories: string[];
  /** Keywords */
  keywords: string[];
  /** Extension icon URL or path */
  icon?: string;
  /** README URL or path */
  readme?: string;
  /** Changelog URL or path */
  changelog?: string;
  /** License */
  license?: string;
  /** Repository URL */
  repository?: {
    type: string;
    url: string;
  };
  /** Bugs URL */
  bugs?: {
    url: string;
  };
  /** Homepage */
  homepage?: string;
  /** Author information */
  author?: {
    name: string;
    email?: string;
    url?: string;
  };
  /** Contributors */
  contributors?: Array<{
    name: string;
    email?: string;
    url?: string;
  }>;
  /** Main entry point */
  main?: string;
  /** Browser entry point */
  browser?: string;
  /** Activation events */
  activationEvents: string[];
  /** Extension kind */
  extensionKind?: ('ui' | 'workspace')[];
  /** Engine version requirement */
  engines: {
    kyro: string;
    vscode?: string;
  };
  /** Dependencies */
  dependencies?: string[];
  /** Dev dependencies */
  devDependencies?: string[];
  /** Extension capabilities */
  capabilities?: {
    virtualWorkspaces?: boolean;
    untrustedWorkspaces?: {
      supported: boolean | 'limited';
      description?: string;
      restrictedConfigurations?: string[];
    };
  };
  /** Contribution points */
  contributes?: ExtensionContributions;
  /** Installation state */
  installed: boolean;
  /** Enabled state */
  enabled: boolean;
  /** Installation timestamp */
  installedAt?: Date;
  /** Update timestamp */
  updatedAt?: Date;
  /** Installation path */
  installPath?: string;
  /** Source of installation */
  installSource: 'builtin' | 'marketplace' | 'local' | 'git' | 'unknown';
  /** Whether extension is outdated */
  isOutdated?: boolean;
  /** Available update version */
  availableVersion?: string;
  /** Download count */
  downloadCount?: number;
  /** Rating */
  rating?: number;
  /** Rating count */
  ratingCount?: number;
}

export interface ExtensionQueryOptions {
  /** Filter by publisher */
  publisher?: string;
  /** Filter by name */
  name?: string;
  /** Filter by category */
  category?: string;
  /** Filter by enabled state */
  enabled?: boolean;
  /** Filter by installed state */
  installed?: boolean;
  /** Search query */
  search?: string;
  /** Sort by */
  sortBy?: 'name' | 'publisher' | 'downloadCount' | 'rating' | 'installedAt' | 'updatedAt';
  /** Sort direction */
  sortOrder?: 'asc' | 'desc';
  /** Offset */
  offset?: number;
  /** Limit */
  limit?: number;
}

export interface ExtensionQueryResult {
  extensions: ExtensionRegistryEntry[];
  total: number;
  hasMore: boolean;
}

export interface ExtensionStats {
  totalExtensions: number;
  installedExtensions: number;
  enabledExtensions: number;
  disabledExtensions: number;
  builtinExtensions: number;
  marketplaceExtensions: number;
  localExtensions: number;
  updatesAvailable: number;
}

export interface ExtensionCategory {
  id: string;
  name: string;
  description: string;
  icon?: string;
  extensionCount: number;
}

// ============================================================================
// EXTENSION REGISTRY
// ============================================================================

class ExtensionRegistry {
  private extensions: Map<string, ExtensionRegistryEntry> = new Map();
  private categories: ExtensionCategory[] = [
    { id: 'programming-languages', name: 'Programming Languages', description: 'Language support, syntax highlighting, etc.', extensionCount: 0 },
    { id: 'snippets', name: 'Snippets', description: 'Code snippets for various languages', extensionCount: 0 },
    { id: 'linters', name: 'Linters', description: 'Code linting and analysis tools', extensionCount: 0 },
    { id: 'debuggers', name: 'Debuggers', description: 'Debugging support for languages', extensionCount: 0 },
    { id: 'formatters', name: 'Formatters', description: 'Code formatting tools', extensionCount: 0 },
    { id: 'keymaps', name: 'Keymaps', description: 'Keyboard shortcut customizations', extensionCount: 0 },
    { id: 'themes', name: 'Themes', description: 'Color themes and icon themes', extensionCount: 0 },
    { id: 'scm-providers', name: 'SCM Providers', description: 'Source control management integrations', extensionCount: 0 },
    { id: 'other', name: 'Other', description: 'Other extensions', extensionCount: 0 },
    { id: 'education', name: 'Education', description: 'Educational tools and tutorials', extensionCount: 0 },
    { id: 'testing', name: 'Testing', description: 'Testing frameworks and tools', extensionCount: 0 },
    { id: 'data-science', name: 'Data Science', description: 'Data science and machine learning tools', extensionCount: 0 },
    { id: 'visualization', name: 'Visualization', description: 'Data visualization tools', extensionCount: 0 },
    { id: 'notebooks', name: 'Notebooks', description: 'Notebook support and extensions', extensionCount: 0 },
  ];

  private initialized: boolean = false;

  constructor() {
    this.initializeBuiltInExtensions();
  }

  /**
   * Initialize built-in extensions
   */
  private initializeBuiltInExtensions(): void {
    const builtInExtensions: ExtensionRegistryEntry[] = [
      {
        id: 'kyro.typescript',
        name: 'typescript',
        publisher: 'kyro',
        version: '1.0.0',
        displayName: 'TypeScript Language Features',
        description: 'Rich language support for TypeScript and JavaScript',
        categories: ['Programming Languages'],
        keywords: ['typescript', 'javascript', 'language', 'intellisense'],
        activationEvents: ['onLanguage:typescript', 'onLanguage:javascript', 'onLanguage:typescriptreact', 'onLanguage:javascriptreact'],
        engines: { kyro: '>=1.0.0', vscode: '^1.60.0' },
        installed: true,
        enabled: true,
        installSource: 'builtin',
        contributes: {
          languages: [
            { id: 'typescript', extensions: ['.ts'], aliases: ['TypeScript', 'ts'], filenames: [], configuration: './language-configuration.json' },
            { id: 'javascript', extensions: ['.js'], aliases: ['JavaScript', 'js'], filenames: [], configuration: './language-configuration.json' },
            { id: 'typescriptreact', extensions: ['.tsx'], aliases: ['TypeScript React', 'tsx'], filenames: [] },
            { id: 'javascriptreact', extensions: ['.jsx'], aliases: ['JavaScript React', 'jsx'], filenames: [] },
          ],
          configuration: {
            title: 'TypeScript',
            properties: {
              'typescript.tsdk': { type: 'string', description: 'Path to the TypeScript SDK', default: '' },
              'typescript.enablePromptUseWorkspaceTsdk': { type: 'boolean', description: 'Prompt to use workspace TypeScript version', default: true },
              'typescript.format.enable': { type: 'boolean', description: 'Enable TypeScript formatting', default: true },
              'typescript.format.insertSpaceAfterCommaDelimiter': { type: 'boolean', description: 'Insert space after comma', default: true },
              'typescript.format.insertSpaceAfterSemicolonInForStatements': { type: 'boolean', description: 'Insert space after semicolon in for statements', default: true },
              'typescript.suggest.enabled': { type: 'boolean', description: 'Enable suggestions', default: true },
              'typescript.suggest.completeFunctionCalls': { type: 'boolean', description: 'Complete function calls', default: true },
              'javascript.format.enable': { type: 'boolean', description: 'Enable JavaScript formatting', default: true },
              'javascript.suggest.enabled': { type: 'boolean', description: 'Enable JavaScript suggestions', default: true },
            },
          },
        },
      },
      {
        id: 'kyro.python',
        name: 'python',
        publisher: 'kyro',
        version: '1.0.0',
        displayName: 'Python',
        description: 'IntelliSense (Pylance), linting, debugging, formatting, and more for Python',
        categories: ['Programming Languages', 'Debuggers', 'Linters', 'Formatters'],
        keywords: ['python', 'django', 'flask', 'fastapi'],
        activationEvents: ['onLanguage:python', 'workspaceContains:*.py', 'workspaceContains:requirements.txt'],
        engines: { kyro: '>=1.0.0', vscode: '^1.60.0' },
        installed: true,
        enabled: true,
        installSource: 'builtin',
        contributes: {
          languages: [
            { id: 'python', extensions: ['.py', '.pyw'], aliases: ['Python'], filenames: [] },
          ],
          debuggers: [
            { type: 'python', label: 'Python', program: 'python', runtime: 'python' },
          ],
          configuration: {
            title: 'Python',
            properties: {
              'python.defaultInterpreterPath': { type: 'string', description: 'Default Python interpreter path', default: 'python' },
              'python.terminal.activateEnvironment': { type: 'boolean', description: 'Activate Python environment in terminal', default: true },
              'python.formatting.provider': { type: 'string', description: 'Formatting provider', enum: ['autopep8', 'black', 'yapf', 'none'], default: 'autopep8' },
              'python.linting.enabled': { type: 'boolean', description: 'Enable linting', default: true },
              'python.analysis.typeCheckingMode': { type: 'string', description: 'Type checking mode', enum: ['off', 'basic', 'strict'], default: 'basic' },
            },
          },
        },
      },
      {
        id: 'kyro.rust',
        name: 'rust',
        publisher: 'kyro',
        version: '1.0.0',
        displayName: 'Rust',
        description: 'Rust language support - syntax highlighting, completion, and more',
        categories: ['Programming Languages'],
        keywords: ['rust', 'cargo', 'rust-analyzer'],
        activationEvents: ['onLanguage:rust', 'workspaceContains:Cargo.toml'],
        engines: { kyro: '>=1.0.0', vscode: '^1.60.0' },
        installed: true,
        enabled: true,
        installSource: 'builtin',
        contributes: {
          languages: [
            { id: 'rust', extensions: ['.rs'], aliases: ['Rust'], filenames: [] },
          ],
          configuration: {
            title: 'Rust',
            properties: {
              'rust-analyzer.server.path': { type: 'string', description: 'Path to rust-analyzer server' },
              'rust-analyzer.cargo.autoreload': { type: 'boolean', description: 'Auto reload cargo workspace', default: true },
              'rust-analyzer.checkOnSave.enable': { type: 'boolean', description: 'Check on save', default: true },
              'rust-analyzer.completion.addCallArgumentSnippets': { type: 'boolean', description: 'Add call argument snippets', default: true },
            },
          },
        },
      },
      {
        id: 'kyro.go',
        name: 'go',
        publisher: 'kyro',
        version: '1.0.0',
        displayName: 'Go',
        description: 'Rich Go language support for Visual Studio Code',
        categories: ['Programming Languages', 'Debuggers'],
        keywords: ['go', 'golang', 'gopls'],
        activationEvents: ['onLanguage:go', 'workspaceContains:*.go', 'workspaceContains:go.mod'],
        engines: { kyro: '>=1.0.0', vscode: '^1.60.0' },
        installed: true,
        enabled: true,
        installSource: 'builtin',
        contributes: {
          languages: [
            { id: 'go', extensions: ['.go'], aliases: ['Go'], filenames: [] },
          ],
          debuggers: [
            { type: 'go', label: 'Go', program: 'go', runtime: 'go' },
          ],
          configuration: {
            title: 'Go',
            properties: {
              'go.gopath': { type: 'string', description: 'GOPATH' },
              'go.toolsManagement.autoUpdate': { type: 'boolean', description: 'Auto update Go tools', default: true },
              'go.useLanguageServer': { type: 'boolean', description: 'Use gopls language server', default: true },
              'go.lintOnSave': { type: 'string', description: 'Lint on save', enum: ['file', 'package', 'workspace', 'off'], default: 'package' },
            },
          },
        },
      },
      {
        id: 'kyro.git',
        name: 'git',
        publisher: 'kyro',
        version: '1.0.0',
        displayName: 'Git',
        description: 'Git source control integration',
        categories: ['SCM Providers'],
        keywords: ['git', 'scm', 'source control', 'version control'],
        activationEvents: ['onLanguage:*', 'workspaceContains:.git'],
        engines: { kyro: '>=1.0.0', vscode: '^1.60.0' },
        installed: true,
        enabled: true,
        installSource: 'builtin',
        contributes: {
          commands: [
            { command: 'git.commit', title: 'Commit', category: 'Git', icon: 'check' },
            { command: 'git.push', title: 'Push', category: 'Git', icon: 'cloud-upload' },
            { command: 'git.pull', title: 'Pull', category: 'Git', icon: 'cloud-download' },
            { command: 'git.clone', title: 'Clone', category: 'Git', icon: 'repo-clone' },
            { command: 'git.fetch', title: 'Fetch', category: 'Git', icon: 'refresh' },
            { command: 'git.branch', title: 'Create Branch', category: 'Git', icon: 'git-branch' },
            { command: 'git.checkout', title: 'Checkout to...', category: 'Git', icon: 'git-branch' },
            { command: 'git.merge', title: 'Merge Branch', category: 'Git', icon: 'git-merge' },
            { command: 'git.stash', title: 'Stash', category: 'Git', icon: 'inbox' },
            { command: 'git.stashPop', title: 'Pop Stash', category: 'Git', icon: 'outbox' },
            { command: 'git.stage', title: 'Stage Changes', category: 'Git', icon: 'plus' },
            { command: 'git.unstage', title: 'Unstage Changes', category: 'Git', icon: 'minus' },
            { command: 'git.revert', title: 'Revert Changes', category: 'Git', icon: 'discard' },
            { command: 'git.viewHistory', title: 'View History', category: 'Git', icon: 'history' },
            { command: 'git.viewDiff', title: 'View Diff', category: 'Git', icon: 'diff' },
          ],
          menus: {
            'scm/title': [
              { command: 'git.commit', group: 'navigation' },
              { command: 'git.push', group: 'navigation' },
              { command: 'git.pull', group: 'navigation' },
            ],
          },
          configuration: {
            title: 'Git',
            properties: {
              'git.enabled': { type: 'boolean', description: 'Enable Git integration', default: true },
              'git.path': { type: 'string', description: 'Path to Git executable' },
              'git.autorefresh': { type: 'boolean', description: 'Auto refresh', default: true },
              'git.autofetch': { type: 'boolean', description: 'Auto fetch', default: true },
              'git.confirmSync': { type: 'boolean', description: 'Confirm before sync', default: true },
              'git.enableSmartCommit': { type: 'boolean', description: 'Enable smart commit', default: false },
            },
          },
        },
      },
      {
        id: 'kyro.terminal',
        name: 'terminal',
        publisher: 'kyro',
        version: '1.0.0',
        displayName: 'Terminal',
        description: 'Integrated terminal support',
        categories: ['Other'],
        keywords: ['terminal', 'shell', 'bash', 'zsh', 'powershell'],
        activationEvents: ['*'],
        engines: { kyro: '>=1.0.0', vscode: '^1.60.0' },
        installed: true,
        enabled: true,
        installSource: 'builtin',
        contributes: {
          commands: [
            { command: 'terminal.new', title: 'New Terminal', category: 'Terminal', icon: 'terminal' },
            { command: 'terminal.split', title: 'Split Terminal', category: 'Terminal', icon: 'split-horizontal' },
            { command: 'terminal.focus', title: 'Focus Terminal', category: 'Terminal' },
            { command: 'terminal.kill', title: 'Kill Terminal', category: 'Terminal', icon: 'trash' },
            { command: 'terminal.clear', title: 'Clear Terminal', category: 'Terminal', icon: 'clear-all' },
            { command: 'terminal.rename', title: 'Rename Terminal', category: 'Terminal' },
          ],
          configuration: {
            title: 'Terminal',
            properties: {
              'terminal.integrated.defaultProfile.linux': { type: 'string', description: 'Default terminal profile on Linux', default: 'bash' },
              'terminal.integrated.defaultProfile.macOS': { type: 'string', description: 'Default terminal profile on macOS', default: 'zsh' },
              'terminal.integrated.defaultProfile.windows': { type: 'string', description: 'Default terminal profile on Windows', default: 'PowerShell' },
              'terminal.integrated.fontSize': { type: 'number', description: 'Terminal font size', default: 14 },
              'terminal.integrated.fontFamily': { type: 'string', description: 'Terminal font family', default: 'monospace' },
              'terminal.integrated.scrollback': { type: 'number', description: 'Scrollback buffer size', default: 1000 },
              'terminal.integrated.cursorStyle': { type: 'string', description: 'Cursor style', enum: ['block', 'line', 'underline'], default: 'block' },
            },
          },
        },
      },
      {
        id: 'kyro.json',
        name: 'json',
        publisher: 'kyro',
        version: '1.0.0',
        displayName: 'JSON',
        description: 'JSON language support',
        categories: ['Programming Languages'],
        keywords: ['json'],
        activationEvents: ['onLanguage:json', 'onLanguage:jsonc'],
        engines: { kyro: '>=1.0.0', vscode: '^1.60.0' },
        installed: true,
        enabled: true,
        installSource: 'builtin',
        contributes: {
          languages: [
            { id: 'json', extensions: ['.json'], aliases: ['JSON'], filenames: ['package.json', 'tsconfig.json', 'jsconfig.json'] },
            { id: 'jsonc', extensions: ['.jsonc'], aliases: ['JSON with Comments'], filenames: [] },
          ],
          configuration: {
            title: 'JSON',
            properties: {
              'json.format.enable': { type: 'boolean', description: 'Enable JSON formatting', default: true },
              'json.schemaDownload.enable': { type: 'boolean', description: 'Enable schema download', default: true },
              'json.maxItemsComputed': { type: 'number', description: 'Max items to compute', default: 5000 },
            },
          },
        },
      },
      {
        id: 'kyro.html',
        name: 'html',
        publisher: 'kyro',
        version: '1.0.0',
        displayName: 'HTML',
        description: 'HTML language support',
        categories: ['Programming Languages'],
        keywords: ['html', 'web'],
        activationEvents: ['onLanguage:html', 'onLanguage:handlebars', 'onLanguage:razor'],
        engines: { kyro: '>=1.0.0', vscode: '^1.60.0' },
        installed: true,
        enabled: true,
        installSource: 'builtin',
        contributes: {
          languages: [
            { id: 'html', extensions: ['.html', '.htm'], aliases: ['HTML'], filenames: [] },
          ],
          configuration: {
            title: 'HTML',
            properties: {
              'html.format.enable': { type: 'boolean', description: 'Enable HTML formatting', default: true },
              'html.format.wrapLineLength': { type: 'number', description: 'Wrap line length', default: 120 },
              'html.format.wrapAttributes': { type: 'string', description: 'Wrap attributes', enum: ['auto', 'force', 'force-aligned', 'force-expand-multiline', 'aligned-multiple', 'preserve', 'preserve-aligned'], default: 'auto' },
              'html.autoClosingTags': { type: 'boolean', description: 'Auto closing tags', default: true },
              'html.suggest.html5': { type: 'boolean', description: 'Suggest HTML5 tags', default: true },
            },
          },
        },
      },
      {
        id: 'kyro.css',
        name: 'css',
        publisher: 'kyro',
        version: '1.0.0',
        displayName: 'CSS',
        description: 'CSS language support',
        categories: ['Programming Languages'],
        keywords: ['css', 'stylesheet'],
        activationEvents: ['onLanguage:css', 'onLanguage:scss', 'onLanguage:less'],
        engines: { kyro: '>=1.0.0', vscode: '^1.60.0' },
        installed: true,
        enabled: true,
        installSource: 'builtin',
        contributes: {
          languages: [
            { id: 'css', extensions: ['.css'], aliases: ['CSS'], filenames: [] },
            { id: 'scss', extensions: ['.scss'], aliases: ['SCSS'], filenames: [] },
            { id: 'less', extensions: ['.less'], aliases: ['Less'], filenames: [] },
          ],
          configuration: {
            title: 'CSS',
            properties: {
              'css.format.enable': { type: 'boolean', description: 'Enable CSS formatting', default: true },
              'css.lint.compatibleVendorPrefixes': { type: 'string', description: 'Lint compatible vendor prefixes', enum: ['ignore', 'warning', 'error'], default: 'warning' },
              'css.validate': { type: 'boolean', description: 'Enable CSS validation', default: true },
            },
          },
        },
      },
      {
        id: 'kyro.markdown',
        name: 'markdown',
        publisher: 'kyro',
        version: '1.0.0',
        displayName: 'Markdown',
        description: 'Markdown language support',
        categories: ['Programming Languages'],
        keywords: ['markdown', 'md'],
        activationEvents: ['onLanguage:markdown'],
        engines: { kyro: '>=1.0.0', vscode: '^1.60.0' },
        installed: true,
        enabled: true,
        installSource: 'builtin',
        contributes: {
          languages: [
            { id: 'markdown', extensions: ['.md', '.markdown'], aliases: ['Markdown'], filenames: [] },
          ],
          commands: [
            { command: 'markdown.preview', title: 'Preview', category: 'Markdown', icon: 'preview' },
            { command: 'markdown.previewSide', title: 'Preview to Side', category: 'Markdown', icon: 'open-preview' },
            { command: 'markdown.exportPdf', title: 'Export PDF', category: 'Markdown', icon: 'file-pdf' },
          ],
          configuration: {
            title: 'Markdown',
            properties: {
              'markdown.preview.fontSize': { type: 'number', description: 'Preview font size', default: 14 },
              'markdown.preview.lineHeight': { type: 'number', description: 'Preview line height', default: 1.6 },
              'markdown.preview.scrollPreviewWithEditor': { type: 'boolean', description: 'Sync preview with editor', default: true },
              'markdown.preview.breaks': { type: 'boolean', description: 'Convert newlines to line breaks', default: false },
            },
          },
        },
      },
      {
        id: 'kyro.yaml',
        name: 'yaml',
        publisher: 'kyro',
        version: '1.0.0',
        displayName: 'YAML',
        description: 'YAML language support',
        categories: ['Programming Languages'],
        keywords: ['yaml', 'yml', 'kubernetes', 'docker-compose'],
        activationEvents: ['onLanguage:yaml', 'workspaceContains:*.yaml', 'workspaceContains:*.yml'],
        engines: { kyro: '>=1.0.0', vscode: '^1.60.0' },
        installed: true,
        enabled: true,
        installSource: 'builtin',
        contributes: {
          languages: [
            { id: 'yaml', extensions: ['.yaml', '.yml'], aliases: ['YAML'], filenames: [] },
          ],
          configuration: {
            title: 'YAML',
            properties: {
              'yaml.format.enable': { type: 'boolean', description: 'Enable YAML formatting', default: true },
              'yaml.format.singleQuote': { type: 'boolean', description: 'Use single quotes', default: false },
              'yaml.format.printWidth': { type: 'number', description: 'Print width', default: 80 },
              'yaml.validate': { type: 'boolean', description: 'Enable YAML validation', default: true },
              'yaml.suggest.triggerSuggestOnOpen': { type: 'boolean', description: 'Trigger suggestions on open', default: true },
            },
          },
        },
      },
    ];

    // Register built-in extensions
    for (const ext of builtInExtensions) {
      this.extensions.set(ext.id, ext);
    }

    this.initialized = true;
  }

  /**
   * Register an extension
   */
  register(extension: ExtensionRegistryEntry): void {
    this.extensions.set(extension.id, {
      ...extension,
      installedAt: extension.installedAt || new Date(),
      updatedAt: extension.updatedAt || new Date(),
    });
  }

  /**
   * Unregister an extension
   */
  unregister(extensionId: string): void {
    this.extensions.delete(extensionId);
  }

  /**
   * Get extension by ID
   */
  getExtension(extensionId: string): ExtensionRegistryEntry | undefined {
    return this.extensions.get(extensionId);
  }

  /**
   * Check if extension is registered
   */
  hasExtension(extensionId: string): boolean {
    return this.extensions.has(extensionId);
  }

  /**
   * Get all extensions
   */
  getAllExtensions(): ExtensionRegistryEntry[] {
    return Array.from(this.extensions.values());
  }

  /**
   * Query extensions with filters
   */
  queryExtensions(options: ExtensionQueryOptions): ExtensionQueryResult {
    let results = Array.from(this.extensions.values());

    // Apply filters
    if (options.publisher) {
      results = results.filter(e => e.publisher.toLowerCase().includes(options.publisher!.toLowerCase()));
    }

    if (options.name) {
      results = results.filter(e => e.name.toLowerCase().includes(options.name!.toLowerCase()));
    }

    if (options.category) {
      results = results.filter(e => e.categories.some(c => c.toLowerCase().includes(options.category!.toLowerCase())));
    }

    if (options.enabled !== undefined) {
      results = results.filter(e => e.enabled === options.enabled);
    }

    if (options.installed !== undefined) {
      results = results.filter(e => e.installed === options.installed);
    }

    if (options.search) {
      const searchLower = options.search.toLowerCase();
      results = results.filter(e =>
        e.name.toLowerCase().includes(searchLower) ||
        e.displayName.toLowerCase().includes(searchLower) ||
        e.description.toLowerCase().includes(searchLower) ||
        e.publisher.toLowerCase().includes(searchLower) ||
        e.keywords.some(k => k.toLowerCase().includes(searchLower))
      );
    }

    // Apply sorting
    const sortBy = options.sortBy || 'name';
    const sortOrder = options.sortOrder || 'asc';
    results.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'publisher':
          comparison = a.publisher.localeCompare(b.publisher);
          break;
        case 'downloadCount':
          comparison = (a.downloadCount || 0) - (b.downloadCount || 0);
          break;
        case 'rating':
          comparison = (a.rating || 0) - (b.rating || 0);
          break;
        case 'installedAt':
          comparison = (a.installedAt?.getTime() || 0) - (b.installedAt?.getTime() || 0);
          break;
        case 'updatedAt':
          comparison = (a.updatedAt?.getTime() || 0) - (b.updatedAt?.getTime() || 0);
          break;
      }
      return sortOrder === 'desc' ? -comparison : comparison;
    });

    const total = results.length;
    const offset = options.offset || 0;
    const limit = options.limit || 50;

    return {
      extensions: results.slice(offset, offset + limit),
      total,
      hasMore: offset + limit < total,
    };
  }

  /**
   * Get extension statistics
   */
  getStats(): ExtensionStats {
    const all = Array.from(this.extensions.values());
    return {
      totalExtensions: all.length,
      installedExtensions: all.filter(e => e.installed).length,
      enabledExtensions: all.filter(e => e.enabled).length,
      disabledExtensions: all.filter(e => !e.enabled).length,
      builtinExtensions: all.filter(e => e.installSource === 'builtin').length,
      marketplaceExtensions: all.filter(e => e.installSource === 'marketplace').length,
      localExtensions: all.filter(e => e.installSource === 'local').length,
      updatesAvailable: all.filter(e => e.isOutdated).length,
    };
  }

  /**
   * Get all categories
   */
  getCategories(): ExtensionCategory[] {
    const all = Array.from(this.extensions.values());
    
    return this.categories.map(cat => ({
      ...cat,
      extensionCount: all.filter(e => 
        e.categories.some(c => c.toLowerCase() === cat.name.toLowerCase() || c.toLowerCase() === cat.id.toLowerCase())
      ).length,
    }));
  }

  /**
   * Update extension enabled state
   */
  setEnabled(extensionId: string, enabled: boolean): void {
    const ext = this.extensions.get(extensionId);
    if (ext) {
      ext.enabled = enabled;
      ext.updatedAt = new Date();
    }
  }

  /**
   * Update extension installed state
   */
  setInstalled(extensionId: string, installed: boolean): void {
    const ext = this.extensions.get(extensionId);
    if (ext) {
      ext.installed = installed;
      if (installed) {
        ext.installedAt = new Date();
      }
      ext.updatedAt = new Date();
    }
  }

  /**
   * Update extension version
   */
  updateVersion(extensionId: string, version: string): void {
    const ext = this.extensions.get(extensionId);
    if (ext) {
      ext.version = version;
      ext.updatedAt = new Date();
      ext.isOutdated = false;
      ext.availableVersion = undefined;
    }
  }

  /**
   * Mark extension as outdated
   */
  markOutdated(extensionId: string, availableVersion: string): void {
    const ext = this.extensions.get(extensionId);
    if (ext) {
      ext.isOutdated = true;
      ext.availableVersion = availableVersion;
    }
  }

  /**
   * Get extensions by publisher
   */
  getExtensionsByPublisher(publisher: string): ExtensionRegistryEntry[] {
    return Array.from(this.extensions.values()).filter(e => 
      e.publisher.toLowerCase() === publisher.toLowerCase()
    );
  }

  /**
   * Get extensions by category
   */
  getExtensionsByCategory(category: string): ExtensionRegistryEntry[] {
    return Array.from(this.extensions.values()).filter(e =>
      e.categories.some(c => c.toLowerCase() === category.toLowerCase())
    );
  }

  /**
   * Get enabled extensions
   */
  getEnabledExtensions(): ExtensionRegistryEntry[] {
    return Array.from(this.extensions.values()).filter(e => e.enabled);
  }

  /**
   * Get installed extensions
   */
  getInstalledExtensions(): ExtensionRegistryEntry[] {
    return Array.from(this.extensions.values()).filter(e => e.installed);
  }

  /**
   * Search extensions
   */
  searchExtensions(query: string): ExtensionRegistryEntry[] {
    const queryLower = query.toLowerCase();
    return Array.from(this.extensions.values()).filter(e =>
      e.name.toLowerCase().includes(queryLower) ||
      e.displayName.toLowerCase().includes(queryLower) ||
      e.description.toLowerCase().includes(queryLower) ||
      e.publisher.toLowerCase().includes(queryLower) ||
      e.keywords.some(k => k.toLowerCase().includes(queryLower))
    );
  }

  /**
   * Export registry to JSON
   */
  export(): string {
    return JSON.stringify({
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      extensions: Array.from(this.extensions.values()),
    }, null, 2);
  }

  /**
   * Import registry from JSON
   */
  import(json: string): void {
    try {
      const data = JSON.parse(json);
      if (data.extensions && Array.isArray(data.extensions)) {
        for (const ext of data.extensions) {
          this.extensions.set(ext.id, ext);
        }
      }
    } catch (error) {
      console.error('Failed to import extension registry:', error);
    }
  }

  /**
   * Clear all extensions (except built-in)
   */
  clear(): void {
    const builtin = Array.from(this.extensions.values()).filter(e => e.installSource === 'builtin');
    this.extensions.clear();
    for (const ext of builtin) {
      this.extensions.set(ext.id, ext);
    }
  }
}

// Singleton instance
export const extensionRegistry = new ExtensionRegistry();

// Export class for testing
export { ExtensionRegistry };
