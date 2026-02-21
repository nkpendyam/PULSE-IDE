// Kyro IDE - Command Palette & Keyboard Shortcuts
// Quick access to all IDE features (like VS Code's Ctrl+Shift+P)

import { EventEmitter } from 'events';

// ============================================================================
// TYPES
// ============================================================================

export interface Command {
  id: string;
  title: string;
  category?: string;
  description?: string;
  icon?: string;
  shortcut?: string;
  aliases?: string[];
  handler: () => Promise<void> | void;
  when?: () => boolean;
}

export interface Shortcut {
  key: string;
  command: string;
  when?: string;
  args?: unknown;
}

export interface CommandPaletteState {
  visible: boolean;
  query: string;
  results: Command[];
  selectedIndex: number;
  recent: string[];
}

// ============================================================================
// COMMAND REGISTRY
// ============================================================================

export class CommandRegistry extends EventEmitter {
  private commands: Map<string, Command> = new Map();
  private shortcuts: Map<string, string[]> = new Map(); // key -> command IDs
  private recentCommands: string[] = [];
  private maxRecent: number = 20;

  constructor() {
    super();
    this.initializeBuiltinCommands();
  }

  // Initialize built-in commands
  private initializeBuiltinCommands(): void {
    // File commands
    this.registerCommand({
      id: 'file.new',
      title: 'New File',
      category: 'File',
      shortcut: 'Ctrl+N',
      handler: () => this.emit('action', 'file.new')
    });

    this.registerCommand({
      id: 'file.open',
      title: 'Open File',
      category: 'File',
      shortcut: 'Ctrl+O',
      handler: () => this.emit('action', 'file.open')
    });

    this.registerCommand({
      id: 'file.save',
      title: 'Save',
      category: 'File',
      shortcut: 'Ctrl+S',
      handler: () => this.emit('action', 'file.save')
    });

    this.registerCommand({
      id: 'file.saveAll',
      title: 'Save All',
      category: 'File',
      shortcut: 'Ctrl+Shift+S',
      handler: () => this.emit('action', 'file.saveAll')
    });

    this.registerCommand({
      id: 'file.close',
      title: 'Close File',
      category: 'File',
      shortcut: 'Ctrl+W',
      handler: () => this.emit('action', 'file.close')
    });

    // Edit commands
    this.registerCommand({
      id: 'edit.undo',
      title: 'Undo',
      category: 'Edit',
      shortcut: 'Ctrl+Z',
      handler: () => this.emit('action', 'edit.undo')
    });

    this.registerCommand({
      id: 'edit.redo',
      title: 'Redo',
      category: 'Edit',
      shortcut: 'Ctrl+Y',
      handler: () => this.emit('action', 'edit.redo')
    });

    this.registerCommand({
      id: 'edit.find',
      title: 'Find',
      category: 'Edit',
      shortcut: 'Ctrl+F',
      handler: () => this.emit('action', 'edit.find')
    });

    this.registerCommand({
      id: 'edit.replace',
      title: 'Find and Replace',
      category: 'Edit',
      shortcut: 'Ctrl+H',
      handler: () => this.emit('action', 'edit.replace')
    });

    this.registerCommand({
      id: 'edit.format',
      title: 'Format Document',
      category: 'Edit',
      shortcut: 'Shift+Alt+F',
      handler: () => this.emit('action', 'edit.format')
    });

    // Navigation commands
    this.registerCommand({
      id: 'nav.goToLine',
      title: 'Go to Line',
      category: 'Navigation',
      shortcut: 'Ctrl+G',
      handler: () => this.emit('action', 'nav.goToLine')
    });

    this.registerCommand({
      id: 'nav.goToSymbol',
      title: 'Go to Symbol',
      category: 'Navigation',
      shortcut: 'Ctrl+Shift+O',
      handler: () => this.emit('action', 'nav.goToSymbol')
    });

    this.registerCommand({
      id: 'nav.goToFile',
      title: 'Go to File',
      category: 'Navigation',
      shortcut: 'Ctrl+P',
      handler: () => this.emit('action', 'nav.goToFile')
    });

    // AI commands
    this.registerCommand({
      id: 'ai.chat',
      title: 'Open AI Chat',
      category: 'AI',
      shortcut: 'Ctrl+I',
      handler: () => this.emit('action', 'ai.chat')
    });

    this.registerCommand({
      id: 'ai.explain',
      title: 'Explain Code',
      category: 'AI',
      shortcut: 'Ctrl+Shift+E',
      handler: () => this.emit('action', 'ai.explain')
    });

    this.registerCommand({
      id: 'ai.refactor',
      title: 'AI Refactor',
      category: 'AI',
      shortcut: 'Ctrl+Shift+R',
      handler: () => this.emit('action', 'ai.refactor')
    });

    this.registerCommand({
      id: 'ai.fix',
      title: 'AI Fix',
      category: 'AI',
      shortcut: 'Ctrl+Shift+F',
      handler: () => this.emit('action', 'ai.fix')
    });

    this.registerCommand({
      id: 'ai.generateTests',
      title: 'Generate Tests',
      category: 'AI',
      shortcut: 'Ctrl+Shift+T',
      handler: () => this.emit('action', 'ai.generateTests')
    });

    this.registerCommand({
      id: 'ai.optimize',
      title: 'Optimize Code',
      category: 'AI',
      handler: () => this.emit('action', 'ai.optimize')
    });

    this.registerCommand({
      id: 'ai.review',
      title: 'AI Code Review',
      category: 'AI',
      handler: () => this.emit('action', 'ai.review')
    });

    this.registerCommand({
      id: 'ai.document',
      title: 'Generate Documentation',
      category: 'AI',
      handler: () => this.emit('action', 'ai.document')
    });

    // Git commands
    this.registerCommand({
      id: 'git.commit',
      title: 'Git Commit',
      category: 'Git',
      shortcut: 'Ctrl+Shift+G C',
      handler: () => this.emit('action', 'git.commit')
    });

    this.registerCommand({
      id: 'git.push',
      title: 'Git Push',
      category: 'Git',
      handler: () => this.emit('action', 'git.push')
    });

    this.registerCommand({
      id: 'git.pull',
      title: 'Git Pull',
      category: 'Git',
      handler: () => this.emit('action', 'git.pull')
    });

    this.registerCommand({
      id: 'git.status',
      title: 'Git Status',
      category: 'Git',
      handler: () => this.emit('action', 'git.status')
    });

    // Terminal commands
    this.registerCommand({
      id: 'terminal.new',
      title: 'New Terminal',
      category: 'Terminal',
      shortcut: 'Ctrl+`',
      handler: () => this.emit('action', 'terminal.new')
    });

    this.registerCommand({
      id: 'terminal.split',
      title: 'Split Terminal',
      category: 'Terminal',
      handler: () => this.emit('action', 'terminal.split')
    });

    // View commands
    this.registerCommand({
      id: 'view.commandPalette',
      title: 'Show Command Palette',
      category: 'View',
      shortcut: 'Ctrl+Shift+P',
      handler: () => this.emit('action', 'view.commandPalette')
    });

    this.registerCommand({
      id: 'view.explorer',
      title: 'Show Explorer',
      category: 'View',
      shortcut: 'Ctrl+Shift+E',
      handler: () => this.emit('action', 'view.explorer')
    });

    this.registerCommand({
      id: 'view.search',
      title: 'Show Search',
      category: 'View',
      shortcut: 'Ctrl+Shift+F',
      handler: () => this.emit('action', 'view.search')
    });

    this.registerCommand({
      id: 'view.git',
      title: 'Show Git Panel',
      category: 'View',
      handler: () => this.emit('action', 'view.git')
    });

    this.registerCommand({
      id: 'view.agents',
      title: 'Show AI Agents',
      category: 'View',
      handler: () => this.emit('action', 'view.agents')
    });

    this.registerCommand({
      id: 'view.memories',
      title: 'Show Memories Panel',
      category: 'View',
      handler: () => this.emit('action', 'view.memories')
    });

    this.registerCommand({
      id: 'view.mcp',
      title: 'Show MCP Servers',
      category: 'View',
      handler: () => this.emit('action', 'view.mcp')
    });

    // Settings commands
    this.registerCommand({
      id: 'settings.open',
      title: 'Open Settings',
      category: 'Settings',
      shortcut: 'Ctrl+,',
      handler: () => this.emit('action', 'settings.open')
    });

    this.registerCommand({
      id: 'settings.shortcuts',
      title: 'Keyboard Shortcuts',
      category: 'Settings',
      shortcut: 'Ctrl+K Ctrl+S',
      handler: () => this.emit('action', 'settings.shortcuts')
    });

    this.registerCommand({
      id: 'settings.rules',
      title: 'Edit .pulserules',
      category: 'Settings',
      handler: () => this.emit('action', 'settings.rules')
    });

    // MCP commands
    this.registerCommand({
      id: 'mcp.addServer',
      title: 'Add MCP Server',
      category: 'MCP',
      handler: () => this.emit('action', 'mcp.addServer')
    });

    this.registerCommand({
      id: 'mcp.listServers',
      title: 'List MCP Servers',
      category: 'MCP',
      handler: () => this.emit('action', 'mcp.listServers')
    });

    // Model commands
    this.registerCommand({
      id: 'model.select',
      title: 'Select Model',
      category: 'AI',
      handler: () => this.emit('action', 'model.select')
    });

    this.registerCommand({
      id: 'model.pull',
      title: 'Pull Model',
      category: 'AI',
      handler: () => this.emit('action', 'model.pull')
    });
  }

  // Register a command
  registerCommand(command: Command): void {
    this.commands.set(command.id, command);

    if (command.shortcut) {
      const normalized = this.normalizeShortcut(command.shortcut);
      if (!this.shortcuts.has(normalized)) {
        this.shortcuts.set(normalized, []);
      }
      this.shortcuts.get(normalized)!.push(command.id);
    }

    this.emit('command:registered', command);
  }

  // Unregister a command
  unregisterCommand(id: string): boolean {
    const command = this.commands.get(id);
    if (!command) return false;

    this.commands.delete(id);

    if (command.shortcut) {
      const normalized = this.normalizeShortcut(command.shortcut);
      const ids = this.shortcuts.get(normalized);
      if (ids) {
        const index = ids.indexOf(id);
        if (index > -1) ids.splice(index, 1);
      }
    }

    this.emit('command:unregistered', id);
    return true;
  }

  // Execute a command
  async executeCommand(id: string): Promise<void> {
    const command = this.commands.get(id);
    if (!command) {
      throw new Error(`Command ${id} not found`);
    }

    if (command.when && !command.when()) {
      throw new Error(`Command ${id} is not available in current context`);
    }

    // Add to recent
    this.addToRecent(id);

    await command.handler();
    this.emit('command:executed', id);
  }

  // Handle keyboard shortcut
  handleShortcut(event: KeyboardEvent): boolean {
    const shortcut = this.eventToShortcut(event);
    const commandIds = this.shortcuts.get(shortcut);

    if (commandIds && commandIds.length > 0) {
      // Execute first available command
      for (const id of commandIds) {
        const command = this.commands.get(id);
        if (command && (!command.when || command.when())) {
          this.executeCommand(id);
          return true;
        }
      }
    }

    return false;
  }

  // Search commands
  searchCommands(query: string): Command[] {
    const queryLower = query.toLowerCase();
    const results: Array<{ command: Command; score: number }> = [];

    for (const command of this.commands.values()) {
      let score = 0;

      // Exact ID match
      if (command.id.toLowerCase() === queryLower) {
        score = 100;
      }
      // Title contains query
      else if (command.title.toLowerCase().includes(queryLower)) {
        score = 50;
      }
      // Category contains query
      else if (command.category?.toLowerCase().includes(queryLower)) {
        score = 30;
      }
      // Alias match
      else if (command.aliases?.some(a => a.toLowerCase().includes(queryLower))) {
        score = 25;
      }
      // Fuzzy match
      else if (this.fuzzyMatch(queryLower, command.title.toLowerCase())) {
        score = 10;
      }

      // Boost recent commands
      if (this.recentCommands.includes(command.id)) {
        score += 15;
      }

      if (score > 0) {
        results.push({ command, score });
      }
    }

    return results
      .sort((a, b) => b.score - a.score)
      .map(r => r.command);
  }

  // Get all commands
  getAllCommands(): Command[] {
    return Array.from(this.commands.values());
  }

  // Get commands by category
  getCommandsByCategory(category: string): Command[] {
    return this.getAllCommands().filter(c => c.category === category);
  }

  // Get recent commands
  getRecentCommands(limit: number = 10): Command[] {
    return this.recentCommands
      .slice(0, limit)
      .map(id => this.commands.get(id))
      .filter((c): c is Command => c !== undefined);
  }

  // Add to recent
  private addToRecent(id: string): void {
    const index = this.recentCommands.indexOf(id);
    if (index > -1) {
      this.recentCommands.splice(index, 1);
    }
    this.recentCommands.unshift(id);
    if (this.recentCommands.length > this.maxRecent) {
      this.recentCommands = this.recentCommands.slice(0, this.maxRecent);
    }
  }

  // Normalize shortcut string
  private normalizeShortcut(shortcut: string): string {
    return shortcut
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/ctrl/g, 'ctrl')
      .replace(/shift/g, 'shift')
      .replace(/alt/g, 'alt')
      .replace(/meta/g, 'meta');
  }

  // Convert keyboard event to shortcut string
  private eventToShortcut(event: KeyboardEvent): string {
    const parts: string[] = [];
    if (event.ctrlKey) parts.push('ctrl');
    if (event.shiftKey) parts.push('shift');
    if (event.altKey) parts.push('alt');
    if (event.metaKey) parts.push('meta');
    parts.push(event.key.toLowerCase());
    return parts.join('+');
  }

  // Fuzzy match
  private fuzzyMatch(query: string, text: string): boolean {
    let queryIndex = 0;
    for (const char of text) {
      if (queryIndex < query.length && char === query[queryIndex]) {
        queryIndex++;
      }
    }
    return queryIndex === query.length;
  }
}

// Singleton
let commandRegistryInstance: CommandRegistry | null = null;

export function getCommandRegistry(): CommandRegistry {
  if (!commandRegistryInstance) {
    commandRegistryInstance = new CommandRegistry();
  }
  return commandRegistryInstance;
}
