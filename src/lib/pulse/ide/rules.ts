// Kyro IDE - .pulserules System
// Project-specific AI instructions and configuration

import { EventEmitter } from 'events';
import * as path from 'path';

// ============================================================================
// TYPES
// ============================================================================

export interface PulseRules {
  // Core instructions
  instructions?: string;
  
  // Model preferences
  model?: {
    default?: string;
    architect?: string;
    coder?: string;
    reviewer?: string;
    [key: string]: string | undefined;
  };
  
  // Behavior settings
  behavior?: {
    autoSave?: boolean;
    autoFormat?: boolean;
    autoTest?: boolean;
    autoReview?: boolean;
    confirmActions?: boolean;
    verbose?: boolean;
    maxTokens?: number;
    temperature?: number;
  };
  
  // Code style preferences
  style?: {
    language?: string;
    framework?: string;
    tabSize?: number;
    indentStyle?: 'tabs' | 'spaces';
    quotes?: 'single' | 'double';
    semicolons?: boolean;
    trailingComma?: boolean;
    namingConvention?: 'camelCase' | 'snake_case' | 'PascalCase';
    maxLineLength?: number;
  };
  
  // File patterns
  files?: {
    include?: string[];
    exclude?: string[];
    important?: string[];
    readonly?: string[];
  };
  
  // Custom prompts
  prompts?: {
    [name: string]: string;
  };
  
  // Tool permissions
  permissions?: {
    allow?: string[];
    deny?: string[];
    ask?: string[];
  };
  
  // MCP server configurations
  mcp?: {
    servers?: string[];
    autoApprove?: string[];
  };
  
  // Memories to always include
  memories?: string[];
  
  // Hooks
  hooks?: {
    beforeEdit?: string;
    afterEdit?: string;
    beforeCommit?: string;
    afterCommit?: string;
    onFileCreate?: string;
    onFileDelete?: string;
  };
  
  // Agent configuration
  agents?: {
    enabled?: string[];
    disabled?: string[];
    defaultAgent?: string;
  };
  
  // Custom rules
  rules?: string[];
  
  // Project metadata
  project?: {
    name?: string;
    description?: string;
    type?: string;
    technologies?: string[];
  };
}

// ============================================================================
// DEFAULT RULES
// ============================================================================

export const DEFAULT_PULSE_RULES: PulseRules = {
  instructions: 'You are a helpful AI coding assistant. Follow best practices and write clean, maintainable code.',
  model: {
    default: 'llama3.2',
    coder: 'codellama',
    architect: 'llama3.2',
    reviewer: 'llama3.2'
  },
  behavior: {
    autoSave: true,
    autoFormat: true,
    autoTest: false,
    autoReview: false,
    confirmActions: true,
    verbose: false,
    maxTokens: 4096,
    temperature: 0.7
  },
  style: {
    tabSize: 2,
    indentStyle: 'spaces',
    quotes: 'single',
    semicolons: true,
    trailingComma: true,
    namingConvention: 'camelCase',
    maxLineLength: 100
  },
  files: {
    exclude: [
      'node_modules/**',
      '.git/**',
      'dist/**',
      'build/**',
      '*.min.js',
      '*.min.css',
      '.env*',
      'credentials*'
    ],
    readonly: [
      'package-lock.json',
      'yarn.lock',
      'bun.lockb'
    ]
  },
  permissions: {
    allow: [
      'fs.read',
      'fs.list',
      'git.status',
      'git.log',
      'git.diff'
    ],
    ask: [
      'fs.write',
      'fs.delete',
      'git.commit',
      'git.push',
      'shell.execute'
    ],
    deny: [
      'fs.write:.env*',
      'fs.delete:.git/**',
      'shell.execute:rm -rf',
      'shell.execute:format'
    ]
  },
  agents: {
    enabled: ['coder', 'architect', 'reviewer', 'debugger', 'tester']
  }
};

// ============================================================================
// RULES MANAGER
// ============================================================================

export class RulesManager extends EventEmitter {
  private rules: Map<string, PulseRules> = new Map();
  private projectRoot: string | null = null;
  private currentRules: PulseRules = DEFAULT_PULSE_RULES;

  // Set project root and load rules
  async setProjectRoot(root: string): Promise<void> {
    this.projectRoot = root;
    await this.loadRules(root);
  }

  // Load rules from project
  async loadRules(projectPath: string): Promise<PulseRules> {
    const rulesFiles = [
      '.pulserules',
      '.pulserules.json',
      '.pulserules.yaml',
      '.pulserules.yml',
      '.pulse/rules',
      '.pulse/rules.json'
    ];

    let loadedRules: PulseRules | null = null;

    for (const file of rulesFiles) {
      const filePath = path.join(projectPath, file);
      try {
        // Would read from file system
        // const content = await fs.readFile(filePath, 'utf-8');
        // loadedRules = this.parseRules(content, file);
        // break;
      } catch {
        // File doesn't exist, continue
      }
    }

    if (loadedRules) {
      this.currentRules = this.mergeRules(DEFAULT_PULSE_RULES, loadedRules);
    } else {
      this.currentRules = { ...DEFAULT_PULSE_RULES };
    }

    this.rules.set(projectPath, this.currentRules);
    this.emit('rules:loaded', { path: projectPath, rules: this.currentRules });

    return this.currentRules;
  }

  // Parse rules from file content
  private parseRules(content: string, filename: string): PulseRules {
    if (filename.endsWith('.json')) {
      return JSON.parse(content);
    }
    
    // Parse YAML or plain text rules
    if (filename.endsWith('.yaml') || filename.endsWith('.yml')) {
      // Would use YAML parser
      return {};
    }
    
    // Plain text format - each line is a rule
    const lines = content.split('\n');
    const rules: PulseRules = {
      rules: []
    };

    for (const line of lines) {
      const trimmed = line.trim();
      
      // Skip comments and empty lines
      if (!trimmed || trimmed.startsWith('#')) continue;

      // Parse directive
      if (trimmed.startsWith('model:')) {
        if (!rules.model) rules.model = {};
        rules.model.default = trimmed.substring(6).trim();
      } else if (trimmed.startsWith('temperature:')) {
        if (!rules.behavior) rules.behavior = {};
        rules.behavior.temperature = parseFloat(trimmed.substring(12).trim());
      } else if (trimmed.startsWith('max-tokens:')) {
        if (!rules.behavior) rules.behavior = {};
        rules.behavior.maxTokens = parseInt(trimmed.substring(11).trim());
      } else if (trimmed.startsWith('tab-size:')) {
        if (!rules.style) rules.style = {};
        rules.style.tabSize = parseInt(trimmed.substring(9).trim());
      } else if (trimmed.startsWith('indent:')) {
        if (!rules.style) rules.style = {};
        rules.style.indentStyle = trimmed.substring(7).trim() as 'tabs' | 'spaces';
      } else if (trimmed.startsWith('include:')) {
        if (!rules.files) rules.files = {};
        if (!rules.files.include) rules.files.include = [];
        rules.files.include.push(trimmed.substring(8).trim());
      } else if (trimmed.startsWith('exclude:')) {
        if (!rules.files) rules.files = {};
        if (!rules.files.exclude) rules.files.exclude = [];
        rules.files.exclude.push(trimmed.substring(8).trim());
      } else if (trimmed.startsWith('prompt:')) {
        const [name, ...promptParts] = trimmed.substring(7).trim().split(':');
        if (!rules.prompts) rules.prompts = {};
        rules.prompts[name] = promptParts.join(':');
      } else {
        // Regular rule
        if (!rules.rules) rules.rules = [];
        rules.rules.push(trimmed);
      }
    }

    return rules;
  }

  // Merge rules with defaults
  private mergeRules(defaults: PulseRules, overrides: PulseRules): PulseRules {
    return {
      ...defaults,
      ...overrides,
      model: { ...defaults.model, ...overrides.model },
      behavior: { ...defaults.behavior, ...overrides.behavior },
      style: { ...defaults.style, ...overrides.style },
      files: {
        ...defaults.files,
        ...overrides.files,
        include: [...(defaults.files?.include || []), ...(overrides.files?.include || [])],
        exclude: [...(defaults.files?.exclude || []), ...(overrides.files?.exclude || [])],
        important: [...(defaults.files?.important || []), ...(overrides.files?.important || [])],
        readonly: [...(defaults.files?.readonly || []), ...(overrides.files?.readonly || [])]
      },
      prompts: { ...defaults.prompts, ...overrides.prompts },
      permissions: {
        ...defaults.permissions,
        ...overrides.permissions,
        allow: [...(defaults.permissions?.allow || []), ...(overrides.permissions?.allow || [])],
        deny: [...(defaults.permissions?.deny || []), ...(overrides.permissions?.deny || [])],
        ask: [...(defaults.permissions?.ask || []), ...(overrides.permissions?.ask || [])]
      },
      hooks: { ...defaults.hooks, ...overrides.hooks },
      agents: { ...defaults.agents, ...overrides.agents },
      rules: [...(defaults.rules || []), ...(overrides.rules || [])]
    };
  }

  // Get current rules
  getRules(): PulseRules {
    return this.currentRules;
  }

  // Get specific rule value
  getRule<K extends keyof PulseRules>(key: K): PulseRules[K] {
    return this.currentRules[key];
  }

  // Update rules
  updateRules(updates: Partial<PulseRules>): void {
    this.currentRules = this.mergeRules(this.currentRules, updates);
    this.emit('rules:updated', this.currentRules);
  }

  // Save rules to file
  async saveRules(projectPath: string, format: 'json' | 'text' = 'text'): Promise<void> {
    const filename = format === 'json' ? '.pulserules.json' : '.pulserules';
    const filePath = path.join(projectPath, filename);
    
    let content: string;
    if (format === 'json') {
      content = JSON.stringify(this.currentRules, null, 2);
    } else {
      content = this.serializeToText(this.currentRules);
    }

    // Would write to file
    this.emit('rules:saved', { path: filePath, format });
  }

  // Serialize rules to text format
  private serializeToText(rules: PulseRules): string {
    const lines: string[] = [];

    if (rules.instructions) {
      lines.push(`# Instructions`);
      lines.push(rules.instructions);
      lines.push('');
    }

    if (rules.model?.default) {
      lines.push(`model: ${rules.model.default}`);
    }

    if (rules.behavior?.temperature !== undefined) {
      lines.push(`temperature: ${rules.behavior.temperature}`);
    }

    if (rules.behavior?.maxTokens !== undefined) {
      lines.push(`max-tokens: ${rules.behavior.maxTokens}`);
    }

    if (rules.style?.tabSize !== undefined) {
      lines.push(`tab-size: ${rules.style.tabSize}`);
    }

    if (rules.style?.indentStyle) {
      lines.push(`indent: ${rules.style.indentStyle}`);
    }

    if (rules.files?.exclude?.length) {
      lines.push('');
      lines.push('# Excluded files');
      rules.files.exclude.forEach(p => lines.push(`exclude: ${p}`));
    }

    if (rules.rules?.length) {
      lines.push('');
      lines.push('# Custom rules');
      rules.rules.forEach(r => lines.push(r));
    }

    return lines.join('\n');
  }

  // Check if file should be included
  shouldIncludeFile(filePath: string): boolean {
    const rules = this.currentRules;
    
    // Check exclusions
    if (rules.files?.exclude) {
      for (const pattern of rules.files.exclude) {
        if (this.matchPattern(filePath, pattern)) {
          return false;
        }
      }
    }
    
    return true;
  }

  // Check if file is readonly
  isReadonlyFile(filePath: string): boolean {
    const rules = this.currentRules;
    
    if (rules.files?.readonly) {
      for (const pattern of rules.files?.readonly) {
        if (this.matchPattern(filePath, pattern)) {
          return true;
        }
      }
    }
    
    return false;
  }

  // Check permission for action
  checkPermission(action: string): 'allow' | 'deny' | 'ask' {
    const rules = this.currentRules;
    
    if (rules.permissions?.deny) {
      for (const pattern of rules.permissions.deny) {
        if (this.matchPattern(action, pattern)) {
          return 'deny';
        }
      }
    }
    
    if (rules.permissions?.ask) {
      for (const pattern of rules.permissions.ask) {
        if (this.matchPattern(action, pattern)) {
          return 'ask';
        }
      }
    }
    
    if (rules.permissions?.allow) {
      for (const pattern of rules.permissions.allow) {
        if (this.matchPattern(action, pattern)) {
          return 'allow';
        }
      }
    }
    
    return 'ask'; // Default to ask for safety
  }

  // Pattern matching
  private matchPattern(value: string, pattern: string): boolean {
    const regex = new RegExp(
      '^' + pattern
        .replace(/\*\*/g, '.*')
        .replace(/\*/g, '[^/]*')
        .replace(/\./g, '\\.')
        .replace(/\?/g, '.') + '$',
      'i'
    );
    return regex.test(value);
  }

  // Get system prompt from rules
  getSystemPrompt(): string {
    const rules = this.currentRules;
    let prompt = rules.instructions || '';

    // Add style preferences
    if (rules.style) {
      prompt += '\n\n## Code Style Preferences';
      if (rules.style.tabSize) prompt += `\n- Tab size: ${rules.style.tabSize}`;
      if (rules.style.indentStyle) prompt += `\n- Indent using: ${rules.style.indentStyle}`;
      if (rules.style.quotes) prompt += `\n- Quote style: ${rules.style.quotes}`;
      if (rules.style.semicolons !== undefined) prompt += `\n- Semicolons: ${rules.style.semicolons ? 'yes' : 'no'}`;
      if (rules.style.namingConvention) prompt += `\n- Naming: ${rules.style.namingConvention}`;
    }

    // Add custom rules
    if (rules.rules?.length) {
      prompt += '\n\n## Additional Rules';
      rules.rules.forEach(rule => {
        prompt += `\n- ${rule}`;
      });
    }

    return prompt;
  }
}

// Singleton
let rulesManagerInstance: RulesManager | null = null;

export function getRulesManager(): RulesManager {
  if (!rulesManagerInstance) {
    rulesManagerInstance = new RulesManager();
  }
  return rulesManagerInstance;
}
