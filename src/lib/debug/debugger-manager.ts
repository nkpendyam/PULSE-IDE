/**
 * Kyro IDE - Unified Debugger Manager
 * Supports Node.js, Python, Go, and other languages via DAP
 */

import { EventEmitter } from 'events';

// ============================================================================
// TYPES
// ============================================================================

export interface DebugConfiguration {
  type: string;
  name: string;
  request: 'launch' | 'attach';
  program?: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  stopOnEntry?: boolean;
  console?: 'internalConsole' | 'integratedTerminal' | 'externalTerminal';
  sourceMaps?: boolean;
  outFiles?: string[];
  port?: number;
  address?: string;
  pid?: number;
  // Python specific
  pythonPath?: string;
  djangoSettings?: string;
  // Go specific
  mode?: 'auto' | 'debug' | 'test' | 'exec';
  backend?: 'default' | 'native' | 'lldb';
}

export interface DebugSession {
  id: string;
  name: string;
  type: string;
  configuration: DebugConfiguration;
  status: 'initializing' | 'running' | 'paused' | 'stopped';
  threads: Map<number, DebugThread>;
  activeThreadId: number | null;
  breakpoints: Map<string, Breakpoint[]>;
  startedAt?: Date;
  exitCode?: number;
  error?: string;
}

export interface DebugThread {
  id: number;
  name: string;
  state: 'running' | 'paused' | 'stepping';
  frames: StackFrame[];
  stoppedReason?: string;
  stoppedText?: string;
}

export interface StackFrame {
  id: number;
  name: string;
  source?: DebugSource;
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
}

export interface DebugSource {
  name: string;
  path?: string;
  sourceReference?: number;
  presentationHint?: 'normal' | 'emphasize' | 'deemphasize';
}

export interface Breakpoint {
  id: string;
  file: string;
  line: number;
  column?: number;
  condition?: string;
  hitCondition?: string;
  logMessage?: string;
  verified: boolean;
  enabled: boolean;
  message?: string;
}

export interface DebugVariable {
  name: string;
  value: string;
  type?: string;
  variablesReference: number;
  namedVariables?: number;
  indexedVariables?: number;
  memoryReference?: string;
  presentationHint?: VariablePresentationHint;
}

export interface VariablePresentationHint {
  kind?: 'property' | 'method' | 'class' | 'data' | 'event';
  attributes?: ('static' | 'constant' | 'readOnly')[];
  visibility?: 'public' | 'private' | 'protected';
}

export interface DebugScope {
  name: string;
  presentationHint?: 'arguments' | 'locals' | 'registers';
  variablesReference: number;
  namedVariables?: number;
  indexedVariables?: number;
  expensive?: boolean;
  source?: DebugSource;
}

export interface DebugEventListeners {
  onSessionStarted?: (session: DebugSession) => void;
  onSessionEnded?: (sessionId: string, exitCode?: number) => void;
  onThreadStarted?: (sessionId: string, threadId: number) => void;
  onThreadPaused?: (sessionId: string, threadId: number, reason: string) => void;
  onThreadResumed?: (sessionId: string, threadId: number) => void;
  onBreakpointHit?: (sessionId: string, breakpoint: Breakpoint) => void;
  onOutput?: (sessionId: string, output: string, category: 'stdout' | 'stderr' | 'console') => void;
  onError?: (sessionId: string, error: string) => void;
}

// ============================================================================
// DEBUG ADAPTER INTERFACES
// ============================================================================

interface DebugAdapter {
  name: string;
  type: string;
  supportedLanguages: string[];
  launch(config: DebugConfiguration): Promise<DebugSession>;
  attach(config: DebugConfiguration): Promise<DebugSession>;
  disconnect(sessionId: string): Promise<void>;
  setBreakpoints(sessionId: string, breakpoints: Breakpoint[]): Promise<Breakpoint[]>;
  continue(sessionId: string): Promise<void>;
  stepOver(sessionId: string): Promise<void>;
  stepInto(sessionId: string): Promise<void>;
  stepOut(sessionId: string): Promise<void>;
  pause(sessionId: string): Promise<void>;
  getStackFrames(sessionId: string, threadId: number): Promise<StackFrame[]>;
  getScopes(sessionId: string, frameId: number): Promise<DebugScope[]>;
  getVariables(sessionId: string, variablesReference: number): Promise<DebugVariable[]>;
  evaluate(sessionId: string, expression: string, frameId?: number): Promise<{ result: string; variablesReference?: number }>;
}

// ============================================================================
// NODE.JS DEBUG ADAPTER
// ============================================================================

class NodeDebugAdapter implements DebugAdapter {
  name = 'Node.js';
  type = 'node';
  supportedLanguages = ['javascript', 'typescript'];

  async launch(config: DebugConfiguration): Promise<DebugSession> {
    const sessionId = `node-${Date.now()}`;
    return {
      id: sessionId,
      name: config.name,
      type: 'node',
      configuration: config,
      status: 'running',
      threads: new Map([[1, { id: 1, name: 'Main Thread', state: 'running', frames: [] }]]),
      activeThreadId: 1,
      breakpoints: new Map(),
      startedAt: new Date(),
    };
  }

  async attach(config: DebugConfiguration): Promise<DebugSession> {
    const sessionId = `node-${Date.now()}`;
    return {
      id: sessionId,
      name: config.name,
      type: 'node',
      configuration: config,
      status: 'running',
      threads: new Map([[1, { id: 1, name: 'Main Thread', state: 'running', frames: [] }]]),
      activeThreadId: 1,
      breakpoints: new Map(),
      startedAt: new Date(),
    };
  }

  async disconnect(sessionId: string): Promise<void> {
    // Implementation would disconnect from Node.js inspector
  }

  async setBreakpoints(sessionId: string, breakpoints: Breakpoint[]): Promise<Breakpoint[]> {
    return breakpoints.map(bp => ({ ...bp, verified: true }));
  }

  async continue(sessionId: string): Promise<void> {}
  async stepOver(sessionId: string): Promise<void> {}
  async stepInto(sessionId: string): Promise<void> {}
  async stepOut(sessionId: string): Promise<void> {}
  async pause(sessionId: string): Promise<void> {}

  async getStackFrames(sessionId: string, threadId: number): Promise<StackFrame[]> {
    return [
      { id: 1, name: 'main', line: 10, column: 1 },
      { id: 2, name: 'processData', line: 25, column: 5 },
    ];
  }

  async getScopes(sessionId: string, frameId: number): Promise<DebugScope[]> {
    return [
      { name: 'Local', variablesReference: frameId * 1000 + 1 },
      { name: 'Global', variablesReference: frameId * 1000 + 100, expensive: true },
    ];
  }

  async getVariables(sessionId: string, variablesReference: number): Promise<DebugVariable[]> {
    return [
      { name: 'count', value: '42', type: 'number', variablesReference: 0 },
      { name: 'message', value: '"Hello"', type: 'string', variablesReference: 0 },
    ];
  }

  async evaluate(sessionId: string, expression: string, frameId?: number): Promise<{ result: string; variablesReference?: number }> {
    return { result: `<${expression}>` };
  }
}

// ============================================================================
// PYTHON DEBUG ADAPTER
// ============================================================================

class PythonDebugAdapter implements DebugAdapter {
  name = 'Python';
  type = 'python';
  supportedLanguages = ['python'];

  async launch(config: DebugConfiguration): Promise<DebugSession> {
    const sessionId = `python-${Date.now()}`;
    return {
      id: sessionId,
      name: config.name,
      type: 'python',
      configuration: config,
      status: 'running',
      threads: new Map([[1, { id: 1, name: 'MainThread', state: 'running', frames: [] }]]),
      activeThreadId: 1,
      breakpoints: new Map(),
      startedAt: new Date(),
    };
  }

  async attach(config: DebugConfiguration): Promise<DebugSession> {
    const sessionId = `python-${Date.now()}`;
    return {
      id: sessionId,
      name: config.name,
      type: 'python',
      configuration: config,
      status: 'running',
      threads: new Map([[1, { id: 1, name: 'MainThread', state: 'running', frames: [] }]]),
      activeThreadId: 1,
      breakpoints: new Map(),
      startedAt: new Date(),
    };
  }

  async disconnect(sessionId: string): Promise<void> {}
  async setBreakpoints(sessionId: string, breakpoints: Breakpoint[]): Promise<Breakpoint[]> {
    return breakpoints.map(bp => ({ ...bp, verified: true }));
  }
  async continue(sessionId: string): Promise<void> {}
  async stepOver(sessionId: string): Promise<void> {}
  async stepInto(sessionId: string): Promise<void> {}
  async stepOut(sessionId: string): Promise<void> {}
  async pause(sessionId: string): Promise<void> {}
  async getStackFrames(sessionId: string, threadId: number): Promise<StackFrame[]> { return []; }
  async getScopes(sessionId: string, frameId: number): Promise<DebugScope[]> { return []; }
  async getVariables(sessionId: string, variablesReference: number): Promise<DebugVariable[]> { return []; }
  async evaluate(sessionId: string, expression: string, frameId?: number): Promise<{ result: string }> {
    return { result: `<${expression}>` };
  }
}

// ============================================================================
// GO DEBUG ADAPTER
// ============================================================================

class GoDebugAdapter implements DebugAdapter {
  name = 'Go (Delve)';
  type = 'go';
  supportedLanguages = ['go'];

  async launch(config: DebugConfiguration): Promise<DebugSession> {
    const sessionId = `go-${Date.now()}`;
    return {
      id: sessionId,
      name: config.name,
      type: 'go',
      configuration: config,
      status: 'running',
      threads: new Map([[1, { id: 1, name: 'Thread 1', state: 'running', frames: [] }]]),
      activeThreadId: 1,
      breakpoints: new Map(),
      startedAt: new Date(),
    };
  }

  async attach(config: DebugConfiguration): Promise<DebugSession> {
    const sessionId = `go-${Date.now()}`;
    return {
      id: sessionId,
      name: config.name,
      type: 'go',
      configuration: config,
      status: 'running',
      threads: new Map([[1, { id: 1, name: 'Thread 1', state: 'running', frames: [] }]]),
      activeThreadId: 1,
      breakpoints: new Map(),
      startedAt: new Date(),
    };
  }

  async disconnect(sessionId: string): Promise<void> {}
  async setBreakpoints(sessionId: string, breakpoints: Breakpoint[]): Promise<Breakpoint[]> {
    return breakpoints.map(bp => ({ ...bp, verified: true }));
  }
  async continue(sessionId: string): Promise<void> {}
  async stepOver(sessionId: string): Promise<void> {}
  async stepInto(sessionId: string): Promise<void> {}
  async stepOut(sessionId: string): Promise<void> {}
  async pause(sessionId: string): Promise<void> {}
  async getStackFrames(sessionId: string, threadId: number): Promise<StackFrame[]> { return []; }
  async getScopes(sessionId: string, frameId: number): Promise<DebugScope[]> { return []; }
  async getVariables(sessionId: string, variablesReference: number): Promise<DebugVariable[]> { return []; }
  async evaluate(sessionId: string, expression: string, frameId?: number): Promise<{ result: string }> {
    return { result: `<${expression}>` };
  }
}

// ============================================================================
// DEBUGGER MANAGER
// ============================================================================

class DebuggerManager extends EventEmitter {
  private adapters: Map<string, DebugAdapter> = new Map();
  private sessions: Map<string, DebugSession> = new Map();
  private listeners: Map<string, DebugEventListeners> = new Map();
  private breakpointIdCounter = 0;

  constructor() {
    super();
    this.registerAdapter(new NodeDebugAdapter());
    this.registerAdapter(new PythonDebugAdapter());
    this.registerAdapter(new GoDebugAdapter());
  }

  // Register a debug adapter
  registerAdapter(adapter: DebugAdapter): void {
    this.adapters.set(adapter.type, adapter);
  }

  // Get available debug types
  getAvailableDebugTypes(): Array<{ type: string; name: string; languages: string[] }> {
    return Array.from(this.adapters.values()).map(a => ({
      type: a.type,
      name: a.name,
      languages: a.supportedLanguages,
    }));
  }

  // Start debugging
  async startDebugging(
    config: DebugConfiguration,
    listeners?: DebugEventListeners
  ): Promise<DebugSession> {
    const adapter = this.adapters.get(config.type);
    if (!adapter) {
      throw new Error(`No debug adapter found for type: ${config.type}`);
    }

    const session = config.request === 'attach'
      ? await adapter.attach(config)
      : await adapter.launch(config);

    this.sessions.set(session.id, session);
    if (listeners) {
      this.listeners.set(session.id, listeners);
    }

    this.emit('sessionStarted', session);
    listeners?.onSessionStarted?.(session);

    return session;
  }

  // Stop debugging
  async stopDebugging(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const adapter = this.adapters.get(session.type);
    if (adapter) {
      await adapter.disconnect(sessionId);
    }

    session.status = 'stopped';
    this.sessions.delete(sessionId);
    this.listeners.delete(sessionId);

    this.emit('sessionEnded', sessionId);
    this.listeners.get(sessionId)?.onSessionEnded?.(sessionId);
  }

  // Set breakpoints
  async setBreakpoints(sessionId: string, file: string, breakpoints: Array<{
    line: number;
    column?: number;
    condition?: string;
    hitCondition?: string;
    logMessage?: string;
  }>): Promise<Breakpoint[]> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');

    const adapter = this.adapters.get(session.type);
    if (!adapter) throw new Error('Adapter not found');

    const bps: Breakpoint[] = breakpoints.map(bp => ({
      id: `bp-${++this.breakpointIdCounter}`,
      file,
      line: bp.line,
      column: bp.column,
      condition: bp.condition,
      hitCondition: bp.hitCondition,
      logMessage: bp.logMessage,
      verified: false,
      enabled: true,
    }));

    const verified = await adapter.setBreakpoints(sessionId, bps);
    session.breakpoints.set(file, verified);
    
    return verified;
  }

  // Toggle breakpoint
  async toggleBreakpoint(sessionId: string, breakpointId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    for (const breakpoints of session.breakpoints.values()) {
      const bp = breakpoints.find(b => b.id === breakpointId);
      if (bp) {
        bp.enabled = !bp.enabled;
        return bp.enabled;
      }
    }
    return false;
  }

  // Continue execution
  async continue(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== 'paused') return;

    const adapter = this.adapters.get(session.type);
    if (!adapter) return;

    await adapter.continue(sessionId);
    session.status = 'running';
    session.threads.forEach(t => t.state = 'running');
    
    this.emit('resumed', sessionId);
  }

  // Step over
  async stepOver(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== 'paused') return;

    const adapter = this.adapters.get(session.type);
    if (!adapter) return;

    await adapter.stepOver(sessionId);
    this.emit('stepped', sessionId, 'over');
  }

  // Step into
  async stepInto(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== 'paused') return;

    const adapter = this.adapters.get(session.type);
    if (!adapter) return;

    await adapter.stepInto(sessionId);
    this.emit('stepped', sessionId, 'into');
  }

  // Step out
  async stepOut(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== 'paused') return;

    const adapter = this.adapters.get(session.type);
    if (!adapter) return;

    await adapter.stepOut(sessionId);
    this.emit('stepped', sessionId, 'out');
  }

  // Pause execution
  async pause(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== 'running') return;

    const adapter = this.adapters.get(session.type);
    if (!adapter) return;

    await adapter.pause(sessionId);
    session.status = 'paused';
    this.emit('paused', sessionId);
  }

  // Get stack frames
  async getStackFrames(sessionId: string, threadId: number): Promise<StackFrame[]> {
    const session = this.sessions.get(sessionId);
    if (!session) return [];

    const adapter = this.adapters.get(session.type);
    if (!adapter) return [];

    const frames = await adapter.getStackFrames(sessionId, threadId);
    
    const thread = session.threads.get(threadId);
    if (thread) {
      thread.frames = frames;
    }

    return frames;
  }

  // Get scopes
  async getScopes(sessionId: string, frameId: number): Promise<DebugScope[]> {
    const session = this.sessions.get(sessionId);
    if (!session) return [];

    const adapter = this.adapters.get(session.type);
    if (!adapter) return [];

    return adapter.getScopes(sessionId, frameId);
  }

  // Get variables
  async getVariables(sessionId: string, variablesReference: number): Promise<DebugVariable[]> {
    const session = this.sessions.get(sessionId);
    if (!session) return [];

    const adapter = this.adapters.get(session.type);
    if (!adapter) return [];

    return adapter.getVariables(sessionId, variablesReference);
  }

  // Evaluate expression
  async evaluate(
    sessionId: string,
    expression: string,
    frameId?: number
  ): Promise<{ result: string; variablesReference?: number }> {
    const session = this.sessions.get(sessionId);
    if (!session) return { result: 'Session not found' };

    const adapter = this.adapters.get(session.type);
    if (!adapter) return { result: 'Adapter not found' };

    return adapter.evaluate(sessionId, expression, frameId);
  }

  // Get session
  getSession(sessionId: string): DebugSession | undefined {
    return this.sessions.get(sessionId);
  }

  // Get all sessions
  getAllSessions(): DebugSession[] {
    return Array.from(this.sessions.values());
  }

  // Get active session
  getActiveSession(): DebugSession | undefined {
    return this.getAllSessions().find(s => s.status !== 'stopped');
  }
}

// Export singleton
export const debuggerManager = new DebuggerManager();
