// Kyro IDE - Hooks System
// Custom automation and event-driven extensibility

import { EventEmitter } from 'events';

// ============================================================================
// TYPES
// ============================================================================

export type HookEvent =
  | 'beforeFileOpen'
  | 'afterFileOpen'
  | 'beforeFileSave'
  | 'afterFileSave'
  | 'beforeFileEdit'
  | 'afterFileEdit'
  | 'beforeFileDelete'
  | 'afterFileDelete'
  | 'beforeGitCommit'
  | 'afterGitCommit'
  | 'beforeGitPush'
  | 'afterGitPush'
  | 'beforeAICall'
  | 'afterAICall'
  | 'beforeAgentStart'
  | 'afterAgentComplete'
  | 'onError'
  | 'onTerminalCommand'
  | 'onSettingsChange';

export interface Hook {
  id: string;
  event: HookEvent;
  name: string;
  description?: string;
  enabled: boolean;
  priority: number;
  handler: HookHandler;
  condition?: HookCondition;
  timeout?: number;
}

export type HookHandler = (context: HookContext) => Promise<HookResult | void>;

export interface HookContext {
  event: HookEvent;
  timestamp: Date;
  data: Record<string, unknown>;
  previousResult?: HookResult;
  abort: () => void;
  skip: () => void;
  modify: (newData: Record<string, unknown>) => void;
}

export interface HookResult {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
  modified?: boolean;
  skipped?: boolean;
  aborted?: boolean;
}

export type HookCondition = (context: HookContext) => boolean;

// ============================================================================
// HOOKS MANAGER
// ============================================================================

export class HooksManager extends EventEmitter {
  private hooks: Map<string, Hook> = new Map();
  private eventHooks: Map<HookEvent, Set<string>> = new Map();
  private executionLog: Array<{
    hookId: string;
    event: HookEvent;
    timestamp: Date;
    result: HookResult | null;
    duration: number;
  }> = [];

  constructor() {
    super();
    this.initializeBuiltInHooks();
  }

  // Initialize built-in hooks
  private initializeBuiltInHooks(): void {
    // Auto-format on save
    this.registerHook({
      event: 'beforeFileSave',
      name: 'Auto-format',
      description: 'Automatically format code before saving',
      enabled: true,
      priority: 100,
      handler: async (ctx) => {
        // Would call formatter
        return { success: true };
      }
    });

    // Auto-save trigger
    this.registerHook({
      event: 'afterFileEdit',
      name: 'Auto-save trigger',
      description: 'Trigger auto-save after inactivity',
      enabled: true,
      priority: 50,
      handler: async (ctx) => {
        // Would trigger auto-save timer
        return { success: true };
      }
    });

    // Log errors
    this.registerHook({
      event: 'onError',
      name: 'Error logger',
      description: 'Log errors to console and file',
      enabled: true,
      priority: 1000,
      handler: async (ctx) => {
        console.error('[Kyro IDE Error]', ctx.data);
        return { success: true };
      }
    });

    // Track AI usage
    this.registerHook({
      event: 'afterAICall',
      name: 'AI usage tracker',
      description: 'Track AI token usage and costs',
      enabled: true,
      priority: 10,
      handler: async (ctx) => {
        // Would track metrics
        return { success: true };
      }
    });
  }

  // Register a hook
  registerHook(config: Omit<Hook, 'id'>): string {
    const id = `hook-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const hook: Hook = {
      ...config,
      id
    };

    this.hooks.set(id, hook);

    // Index by event
    if (!this.eventHooks.has(hook.event)) {
      this.eventHooks.set(hook.event, new Set());
    }
    this.eventHooks.get(hook.event)!.add(id);

    this.emit('hook:registered', hook);
    return id;
  }

  // Unregister a hook
  unregisterHook(id: string): boolean {
    const hook = this.hooks.get(id);
    if (!hook) return false;

    this.hooks.delete(id);
    this.eventHooks.get(hook.event)?.delete(id);

    this.emit('hook:unregistered', id);
    return true;
  }

  // Enable/disable hook
  setHookEnabled(id: string, enabled: boolean): boolean {
    const hook = this.hooks.get(id);
    if (!hook) return false;

    hook.enabled = enabled;
    this.emit('hook:toggle', { id, enabled });
    return true;
  }

  // Get hook by ID
  getHook(id: string): Hook | undefined {
    return this.hooks.get(id);
  }

  // Get all hooks
  getAllHooks(): Hook[] {
    return Array.from(this.hooks.values());
  }

  // Get hooks for event
  getHooksForEvent(event: HookEvent): Hook[] {
    const ids = this.eventHooks.get(event);
    if (!ids) return [];

    return Array.from(ids)
      .map(id => this.hooks.get(id))
      .filter((h): h is Hook => h !== undefined && h.enabled)
      .sort((a, b) => b.priority - a.priority);
  }

  // Execute hooks for an event
  async executeHooks(
    event: HookEvent,
    data: Record<string, unknown>
  ): Promise<{
    results: Array<{ hook: Hook; result: HookResult | null }>;
    aborted: boolean;
    finalData: Record<string, unknown>;
  }> {
    const hooks = this.getHooksForEvent(event);
    const results: Array<{ hook: Hook; result: HookResult | null }> = [];
    
    let currentData = { ...data };
    let aborted = false;

    const context: HookContext = {
      event,
      timestamp: new Date(),
      data: currentData,
      abort: () => { aborted = true; },
      skip: () => {},
      modify: (newData) => { currentData = { ...currentData, ...newData }; }
    };

    for (const hook of hooks) {
      if (aborted) break;

      const startTime = Date.now();

      try {
        // Check condition
        if (hook.condition && !hook.condition(context)) {
          continue;
        }

        // Execute with timeout
        const result = await this.executeWithTimeout(
          hook,
          context,
          hook.timeout || 30000
        );

        results.push({ hook, result });
        this.logExecution(hook, event, result, Date.now() - startTime);

        // Handle result
        if (result) {
          if (result.aborted) {
            aborted = true;
          }
          if (result.modified && result.data) {
            currentData = { ...currentData, ...result.data };
            context.data = currentData;
          }
        }
      } catch (error) {
        const errorResult: HookResult = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
        results.push({ hook, result: errorResult });
        this.logExecution(hook, event, errorResult, Date.now() - startTime);
      }
    }

    return { results, aborted, finalData: currentData };
  }

  // Execute with timeout
  private async executeWithTimeout(
    hook: Hook,
    context: HookContext,
    timeout: number
  ): Promise<HookResult | null> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Hook ${hook.id} timed out`));
      }, timeout);

      hook.handler(context)
        .then(result => {
          clearTimeout(timeoutId);
          resolve(result || null);
        })
        .catch(error => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  // Log execution
  private logExecution(
    hook: Hook,
    event: HookEvent,
    result: HookResult | null,
    duration: number
  ): void {
    this.executionLog.push({
      hookId: hook.id,
      event,
      timestamp: new Date(),
      result,
      duration
    });

    // Keep only last 1000 entries
    if (this.executionLog.length > 1000) {
      this.executionLog = this.executionLog.slice(-1000);
    }
  }

  // Get execution log
  getExecutionLog(): typeof this.executionLog {
    return [...this.executionLog];
  }

  // Clear execution log
  clearExecutionLog(): void {
    this.executionLog = [];
    this.emit('log:cleared');
  }

  // Import hooks configuration
  importConfig(config: Array<Omit<Hook, 'id'>>): string[] {
    return config.map(c => this.registerHook(c));
  }

  // Export hooks configuration
  exportConfig(): Array<Omit<Hook, 'id' | 'handler'>> {
    return this.getAllHooks().map(h => ({
      event: h.event,
      name: h.name,
      description: h.description,
      enabled: h.enabled,
      priority: h.priority,
      condition: h.condition,
      timeout: h.timeout
    }));
  }
}

// ============================================================================
// BUILT-IN HOOK EXAMPLES
// ============================================================================

export const HOOK_EXAMPLES = {
  // Auto-add header to new files
  autoHeader: `
event: afterFileOpen
name: Auto-add header
handler: |
  if (context.data.isNew) {
    const header = \`// \${context.data.fileName}
// Created: \${new Date().toISOString()}

\`;
    context.modify({ prependContent: header });
  }
`,

  // Notify on commit
  notifyCommit: `
event: afterGitCommit
name: Commit notification
handler: |
  console.log('Committed:', context.data.message);
  // Could show notification
`,

  // Auto-test on save
  autoTest: `
event: afterFileSave
name: Run tests on save
condition: context.data.path.includes('__tests__')
handler: |
  // Run tests
  await runTests(context.data.path);
`,

  // Security check
  securityCheck: `
event: beforeFileSave
name: Security check
handler: |
  const content = context.data.content;
  if (content.includes('password') || content.includes('secret')) {
    context.modify({ warning: 'Possible sensitive data detected' });
  }
`
};

// Singleton
let hooksManagerInstance: HooksManager | null = null;

export function getHooksManager(): HooksManager {
  if (!hooksManagerInstance) {
    hooksManagerInstance = new HooksManager();
  }
  return hooksManagerInstance;
}
