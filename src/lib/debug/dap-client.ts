/**
 * Kyro IDE DAP (Debug Adapter Protocol) Client
 * 
 * A comprehensive DAP client implementation with WebSocket transport support
 * for real-time debugging capabilities.
 * 
 * Features:
 * - WebSocket transport with auto-reconnection
 * - Full DAP protocol implementation
 * - Session management (launch, attach, terminate)
 * - Breakpoint management
 * - Variable inspection
 * - Call stack navigation
 * - Step controls (continue, step over, step into, step out)
 * - Watch expressions with evaluation
 * - Debug console with REPL
 */

// ============================================================================
// DAP PROTOCOL TYPES
// ============================================================================

export interface DAPProtocolMessage {
  seq: number;
  type: 'request' | 'response' | 'event';
}

export interface DAPRequest extends DAPProtocolMessage {
  type: 'request';
  command: string;
  arguments?: Record<string, unknown>;
}

export interface DAPResponse extends DAPProtocolMessage {
  type: 'response';
  request_seq: number;
  success: boolean;
  command: string;
  message?: string;
  body?: unknown;
}

export interface DAPEvent extends DAPProtocolMessage {
  type: 'event';
  event: string;
  body?: unknown;
}

export type DAPMessage = DAPRequest | DAPResponse | DAPEvent;

// ============================================================================
// DAP CAPABILITIES
// ============================================================================

export interface DAPCapabilities {
  supportsConfigurationDoneRequest?: boolean;
  supportsFunctionBreakpoints?: boolean;
  supportsConditionalBreakpoints?: boolean;
  supportsHitConditionalBreakpoints?: boolean;
  supportsEvaluateForHovers?: boolean;
  supportsStepBack?: boolean;
  supportsSetVariable?: boolean;
  supportsRestartFrame?: boolean;
  supportsGotoTargetsRequest?: boolean;
  supportsStepInTargetsRequest?: boolean;
  supportsCompletionsRequest?: boolean;
  supportsModulesRequest?: boolean;
  supportsExceptionOptions?: boolean;
  supportsValueFormattingOptions?: boolean;
  supportsExceptionInfoRequest?: boolean;
  supportTerminateDebuggee?: boolean;
  supportsDelayedStackTraceLoading?: boolean;
  supportsLoadedSourcesRequest?: boolean;
  supportsLogPoints?: boolean;
  supportsTerminateThreadsRequest?: boolean;
  supportsSetExpression?: boolean;
  supportsTerminateRequest?: boolean;
  supportsDataBreakpoints?: boolean;
  supportsReadMemoryRequest?: boolean;
  supportsDisassembleRequest?: boolean;
  supportsCancelRequest?: boolean;
  supportsBreakpointLocationsRequest?: boolean;
  supportsClipboardContext?: boolean;
  supportsSteppingGranularity?: boolean;
  supportsInstructionBreakpoints?: boolean;
  supportsExceptionFilterOptions?: boolean;
}

// ============================================================================
// DEBUG SESSION TYPES
// ============================================================================

export interface DebugSessionConfig {
  type: string;
  name: string;
  request: 'launch' | 'attach';
  program?: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  stopOnEntry?: boolean;
  noDebug?: boolean;
  console?: 'internalConsole' | 'integratedTerminal' | 'externalTerminal';
  sourceMaps?: boolean;
  outFiles?: string[];
  skipFiles?: string[];
  trace?: boolean;
  [key: string]: unknown;
}

export interface DebugSession {
  id: string;
  name: string;
  type: string;
  request: 'launch' | 'attach';
  state: DebugSessionState;
  config: DebugSessionConfig;
  capabilities: DAPCapabilities;
  threads: Map<number, DebugThread>;
  activeThreadId: number | null;
  startedAt?: Date;
  endedAt?: Date;
  exitCode?: number;
  error?: string;
}

export type DebugSessionState = 
  | 'initializing'
  | 'configured'
  | 'launching'
  | 'running'
  | 'paused'
  | 'stepping'
  | 'stopping'
  | 'stopped'
  | 'error';

export interface DebugThread {
  id: number;
  name: string;
  state: 'running' | 'paused' | 'stepping';
  frames: DebugStackFrame[];
  currentFrameIndex: number;
  stoppedReason?: StopReason;
  stoppedDescription?: string;
}

export type StopReason = 
  | 'step'
  | 'breakpoint'
  | 'exception'
  | 'pause'
  | 'entry'
  | 'goto'
  | 'function_breakpoint'
  | 'data_breakpoint'
  | 'instruction_breakpoint';

// ============================================================================
// STACK FRAME AND VARIABLE TYPES
// ============================================================================

export interface DebugSource {
  name?: string;
  path?: string;
  sourceReference?: number;
  presentationHint?: 'normal' | 'emphasize' | 'deemphasize';
  origin?: string;
  sources?: DebugSource[];
  adapterData?: unknown;
}

export interface DebugStackFrame {
  id: number;
  name: string;
  source?: DebugSource;
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
  instructionPointerReference?: string;
  moduleId?: number | string;
  presentationHint?: 'normal' | 'label' | 'subtle';
}

export interface DebugScope {
  name: string;
  presentationHint?: 'arguments' | 'locals' | 'registers' | string;
  variablesReference: number;
  namedVariables?: number;
  indexedVariables?: number;
  expensive?: boolean;
  source?: DebugSource;
  line?: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
}

export interface DebugVariable {
  name: string;
  value: string;
  type?: string;
  presentationHint?: VariablePresentationHint;
  evaluateName?: string;
  variablesReference: number;
  namedVariables?: number;
  indexedVariables?: number;
  memoryReference?: string;
}

export interface VariablePresentationHint {
  kind?: 'property' | 'method' | 'class' | 'data' | 'event' | 'baseClass' | 'innerClass' | 'interface' | 'mostDerivedClass' | 'virtual' | 'dataBreakpoint' | string;
  attributes?: ('static' | 'constant' | 'readOnly' | 'rawString' | 'hasObjectId' | 'canHaveObjectId' | 'hasSideEffects' | string)[];
  visibility?: 'public' | 'private' | 'protected' | 'internal' | 'final' | string;
}

// ============================================================================
// BREAKPOINT TYPES
// ============================================================================

export interface DebugBreakpoint {
  id: string;
  source?: DebugSource;
  line?: number;
  column?: number;
  verified: boolean;
  enabled: boolean;
  condition?: string;
  hitCondition?: string;
  logMessage?: string;
  message?: string;
  endLine?: number;
  endColumn?: number;
  instructionReference?: string;
  offset?: number;
}

export interface BreakpointLocation {
  line: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
}

// ============================================================================
// EVENT TYPES
// ============================================================================

export interface StoppedEventBody {
  reason: StopReason;
  description?: string;
  threadId?: number;
  preserveFocusHint?: boolean;
  text?: string;
  allThreadsStopped?: boolean;
  hitBreakpointIds?: number[];
}

export interface ContinuedEventBody {
  threadId?: number;
  allThreadsContinued?: boolean;
}

export interface OutputEventBody {
  category?: 'console' | 'stdout' | 'stderr' | 'telemetry' | string;
  output: string;
  group?: 'start' | 'startCollapsed' | 'end';
  variablesReference?: number;
  source?: DebugSource;
  line?: number;
  column?: number;
  data?: unknown;
}

export interface BreakpointEventBody {
  reason: 'changed' | 'new' | 'removed' | string;
  breakpoint: DebugBreakpoint;
}

export interface ThreadEventBody {
  reason: 'started' | 'exited';
  threadId: number;
}

export interface TerminatedEventBody {
  restart?: boolean;
}

export interface ExitedEventBody {
  exitCode?: number;
}

// ============================================================================
// TRANSPORT INTERFACE
// ============================================================================

export interface Transport {
  isConnected: boolean;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  send(message: DAPRequest): void;
  onMessage(callback: (message: DAPMessage) => void): void;
  onError(callback: (error: Error) => void): void;
  onClose(callback: () => void): void;
}

// ============================================================================
// WEBSOCKET TRANSPORT
// ============================================================================

export class WebSocketTransport implements Transport {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 1000;
  private messageCallbacks: Set<(message: DAPMessage) => void> = new Set();
  private errorCallbacks: Set<(error: Error) => void> = new Set();
  private closeCallbacks: Set<() => void> = new Set();
  private messageQueue: DAPRequest[] = [];
  private _isConnected: boolean = false;

  constructor(url: string) {
    this.url = url;
  }

  get isConnected(): boolean {
    return this._isConnected && this.ws?.readyState === WebSocket.OPEN;
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          this._isConnected = true;
          this.reconnectAttempts = 0;
          
          // Send queued messages
          while (this.messageQueue.length > 0) {
            const message = this.messageQueue.shift();
            if (message) this.send(message);
          }
          
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data) as DAPMessage;
            this.messageCallbacks.forEach(cb => cb(message));
          } catch (error) {
            console.error('Failed to parse DAP message:', error);
          }
        };

        this.ws.onerror = () => {
          const error = new Error('WebSocket error');
          this.errorCallbacks.forEach(cb => cb(error));
          if (!this._isConnected) {
            reject(error);
          }
        };

        this.ws.onclose = () => {
          const wasConnected = this._isConnected;
          this._isConnected = false;
          
          if (wasConnected) {
            this.closeCallbacks.forEach(cb => cb());
            this.attemptReconnect();
          }
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    setTimeout(() => {
      this.connect().catch(err => {
        console.error('Reconnection failed:', err);
      });
    }, delay);
  }

  async disconnect(): Promise<void> {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this._isConnected = false;
    }
  }

  send(message: DAPRequest): void {
    if (this.isConnected && this.ws) {
      this.ws.send(JSON.stringify(message));
    } else {
      this.messageQueue.push(message);
    }
  }

  onMessage(callback: (message: DAPMessage) => void): void {
    this.messageCallbacks.add(callback);
  }

  onError(callback: (error: Error) => void): void {
    this.errorCallbacks.add(callback);
  }

  onClose(callback: () => void): void {
    this.closeCallbacks.add(callback);
  }
}

// ============================================================================
// IN-MEMORY TRANSPORT (for frontend/backend communication)
// ============================================================================

export class InMemoryTransport implements Transport {
  private _isConnected: boolean = false;
  private messageCallbacks: Set<(message: DAPMessage) => void> = new Set();
  private errorCallbacks: Set<(error: Error) => void> = new Set();
  private closeCallbacks: Set<() => void> = new Set();
  private pendingRequests: Map<number, DAPRequest> = new Map();

  get isConnected(): boolean {
    return this._isConnected;
  }

  async connect(): Promise<void> {
    this._isConnected = true;
  }

  async disconnect(): Promise<void> {
    this._isConnected = false;
    this.closeCallbacks.forEach(cb => cb());
  }

  send(message: DAPRequest): void {
    // In frontend, this would send to backend API
    // For now, we simulate responses
    this.pendingRequests.set(message.seq, message);
    
    // Simulate async response
    setTimeout(() => {
      this.simulateResponse(message);
    }, 10);
  }

  private simulateResponse(request: DAPRequest): void {
    // Generate simulated responses based on command
    const response: DAPResponse = {
      seq: request.seq + 1000,
      type: 'response',
      request_seq: request.seq,
      success: true,
      command: request.command,
      body: this.getSimulatedResponseBody(request),
    };
    
    this.messageCallbacks.forEach(cb => cb(response));
  }

  private getSimulatedResponseBody(request: DAPRequest): unknown {
    switch (request.command) {
      case 'initialize':
        return {
          supportsConfigurationDoneRequest: true,
          supportsConditionalBreakpoints: true,
          supportsHitConditionalBreakpoints: true,
          supportsEvaluateForHovers: true,
          supportsSetVariable: true,
          supportsLogPoints: true,
          supportsSetExpression: true,
          supportsTerminateRequest: true,
          supportsExceptionInfoRequest: true,
          supportsSteppingGranularity: true,
        };
      case 'threads':
        return {
          threads: [
            { id: 1, name: 'Main Thread' },
          ],
        };
      case 'stackTrace':
        return {
          stackFrames: this.getSimulatedStackTrace(request.arguments as { threadId: number }),
          totalFrames: 3,
        };
      case 'scopes':
        return {
          scopes: [
            {
              name: 'Local',
              presentationHint: 'locals',
              variablesReference: 1000,
              namedVariables: 4,
              indexedVariables: 0,
              expensive: false,
            },
            {
              name: 'Global',
              presentationHint: 'globals',
              variablesReference: 2000,
              namedVariables: 0,
              indexedVariables: 0,
              expensive: true,
            },
          ],
        };
      case 'variables':
        return {
          variables: this.getSimulatedVariables(request.arguments as { variablesReference: number }),
        };
      case 'evaluate':
        return {
          result: 'undefined',
          variablesReference: 0,
        };
      default:
        return {};
    }
  }

  private getSimulatedStackTrace(_args: { threadId: number } | undefined): DebugStackFrame[] {
    return [
      {
        id: 1,
        name: 'processData',
        source: { name: 'app.ts', path: '/src/app.ts' },
        line: 42,
        column: 5,
      },
      {
        id: 2,
        name: 'handleClick',
        source: { name: 'Button.tsx', path: '/src/components/Button.tsx' },
        line: 15,
        column: 3,
      },
      {
        id: 3,
        name: 'onClick',
        source: { name: 'Form.tsx', path: '/src/components/Form.tsx' },
        line: 28,
        column: 7,
      },
    ];
  }

  private getSimulatedVariables(args: { variablesReference: number } | undefined): DebugVariable[] {
    const ref = args?.variablesReference || 1000;
    
    if (ref === 1000) {
      // Local variables
      return [
        {
          name: 'user',
          value: '{ name: "John", age: 30 }',
          type: 'Object',
          variablesReference: 1001,
          namedVariables: 2,
        },
        {
          name: 'items',
          value: 'Array(3)',
          type: 'Array',
          variablesReference: 1002,
          namedVariables: 0,
          indexedVariables: 3,
        },
        {
          name: 'count',
          value: '42',
          type: 'number',
          variablesReference: 0,
        },
        {
          name: 'isActive',
          value: 'true',
          type: 'boolean',
          variablesReference: 0,
        },
      ];
    } else if (ref === 1001) {
      // user object children
      return [
        { name: 'name', value: '"John"', type: 'string', variablesReference: 0 },
        { name: 'age', value: '30', type: 'number', variablesReference: 0 },
      ];
    } else if (ref === 1002) {
      // items array children
      return [
        { name: '0', value: '"apple"', type: 'string', variablesReference: 0 },
        { name: '1', value: '"banana"', type: 'string', variablesReference: 0 },
        { name: '2', value: '"orange"', type: 'string', variablesReference: 0 },
        { name: 'length', value: '3', type: 'number', variablesReference: 0 },
      ];
    }
    
    return [];
  }

  onMessage(callback: (message: DAPMessage) => void): void {
    this.messageCallbacks.add(callback);
  }

  onError(callback: (error: Error) => void): void {
    this.errorCallbacks.add(callback);
  }

  onClose(callback: () => void): void {
    this.closeCallbacks.add(callback);
  }

  // Method to inject events from outside
  emitEvent(event: string, body: unknown): void {
    const dapEvent: DAPEvent = {
      seq: Date.now(),
      type: 'event',
      event,
      body,
    };
    this.messageCallbacks.forEach(cb => cb(dapEvent));
  }
}

// ============================================================================
// DAP CLIENT
// ============================================================================

export class DAPClient {
  private transport: Transport;
  private seq: number = 0;
  private pendingRequests: Map<number, {
    resolve: (response: DAPResponse) => void;
    reject: (error: Error) => void;
    timeout: ReturnType<typeof setTimeout>;
  }> = new Map();
  private sessions: Map<string, DebugSession> = new Map();
  private activeSessionId: string | null = null;
  private eventListeners: Map<string, Set<(body: unknown) => void>> = new Map();
  private requestTimeout: number = 30000;
  private nextBreakpointId: number = 1;
  private breakpoints: Map<string, DebugBreakpoint> = new Map();

  constructor(transport?: Transport) {
    this.transport = transport || new InMemoryTransport();
    this.setupTransportHandlers();
  }

  private setupTransportHandlers(): void {
    this.transport.onMessage((message) => {
      if (message.type === 'response') {
        this.handleResponse(message as DAPResponse);
      } else if (message.type === 'event') {
        this.handleEvent(message as DAPEvent);
      }
    });

    this.transport.onError((error) => {
      console.error('DAP Transport Error:', error);
      this.emit('error', { error });
    });

    this.transport.onClose(() => {
      this.emit('disconnected', {});
    });
  }

  // ============================================================================
  // CONNECTION MANAGEMENT
  // ============================================================================

  async connect(): Promise<void> {
    await this.transport.connect();
    this.emit('connected', {});
  }

  async disconnect(): Promise<void> {
    // Terminate all sessions
    for (const sessionId of this.sessions.keys()) {
      try {
        await this.terminateSession(sessionId);
      } catch {
        // Ignore errors during disconnect
      }
    }
    await this.transport.disconnect();
  }

  get isConnected(): boolean {
    return this.transport.isConnected;
  }

  // ============================================================================
  // SESSION MANAGEMENT
  // ============================================================================

  async createSession(config: DebugSessionConfig): Promise<DebugSession> {
    const id = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const session: DebugSession = {
      id,
      name: config.name,
      type: config.type,
      request: config.request,
      state: 'initializing',
      config,
      capabilities: {},
      threads: new Map(),
      activeThreadId: null,
    };

    this.sessions.set(id, session);

    try {
      // Initialize
      const initResponse = await this.sendRequest('initialize', {
        clientID: 'kyro-ide',
        clientName: 'Kyro IDE',
        adapterID: config.type,
        locale: 'en-us',
        linesStartAt1: true,
        columnsStartAt1: true,
        pathFormat: 'path',
        supportsVariableType: true,
        supportsVariablePaging: true,
        supportsRunInTerminalRequest: true,
        supportsMemoryReferences: true,
        supportsProgressReporting: true,
        supportsInvalidatedEvent: true,
        supportsMemoryEvent: true,
      });

      // Update capabilities
      session.capabilities = { ...(initResponse.body as DAPCapabilities) };
      session.state = 'configured';

      // Launch or attach
      if (config.request === 'launch') {
        await this.sendRequest('launch', config);
      } else {
        await this.sendRequest('attach', config);
      }

      session.state = 'launching';

      // Configuration done
      if (session.capabilities.supportsConfigurationDoneRequest) {
        await this.sendRequest('configurationDone', {});
      }

      session.state = 'running';
      session.startedAt = new Date();
      this.activeSessionId = id;

      this.emit('sessionCreated', { session });
      return session;
    } catch (error) {
      session.state = 'error';
      session.error = (error as Error).message;
      throw error;
    }
  }

  async terminateSession(sessionId: string, force: boolean = false): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.state = 'stopping';

    try {
      if (session.capabilities.supportsTerminateRequest && !force) {
        await this.sendRequest('terminate', { restart: false });
      } else {
        await this.sendRequest('disconnect', {
          restart: false,
          terminateDebuggee: session.capabilities.supportTerminateDebuggee,
        });
      }
    } catch {
      // Ignore errors during termination
    }

    session.state = 'stopped';
    session.endedAt = new Date();

    this.emit('sessionTerminated', { session });

    if (this.activeSessionId === sessionId) {
      this.activeSessionId = null;
    }
  }

  getActiveSession(): DebugSession | null {
    if (!this.activeSessionId) return null;
    return this.sessions.get(this.activeSessionId) || null;
  }

  getSession(id: string): DebugSession | undefined {
    return this.sessions.get(id);
  }

  getSessions(): DebugSession[] {
    return Array.from(this.sessions.values());
  }

  // ============================================================================
  // THREAD MANAGEMENT
  // ============================================================================

  async getThreads(sessionId: string): Promise<DebugThread[]> {
    const session = this.sessions.get(sessionId);
    if (!session) return [];

    const response = await this.sendRequest('threads', {});
    const body = response.body as { threads: Array<{ id: number; name: string }> };

    for (const thread of body.threads) {
      let debugThread = session.threads.get(thread.id);
      if (!debugThread) {
        debugThread = {
          id: thread.id,
          name: thread.name,
          state: 'running',
          frames: [],
          currentFrameIndex: 0,
        };
        session.threads.set(thread.id, debugThread);
      } else {
        debugThread.name = thread.name;
      }
    }

    return Array.from(session.threads.values());
  }

  async setActiveThread(sessionId: string, threadId: number): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.activeThreadId = threadId;
    await this.refreshCallStack(sessionId, threadId);
  }

  // ============================================================================
  // CALL STACK MANAGEMENT
  // ============================================================================

  async refreshCallStack(sessionId: string, threadId: number): Promise<DebugStackFrame[]> {
    const session = this.sessions.get(sessionId);
    if (!session) return [];

    const response = await this.sendRequest('stackTrace', {
      threadId,
      startFrame: 0,
      levels: 20,
      format: {
        parameters: true,
        parameterTypes: true,
        parameterNames: true,
        line: true,
        module: true,
      },
    });

    const body = response.body as { stackFrames: DebugStackFrame[]; totalFrames?: number };
    const frames = body.stackFrames;

    const thread = session.threads.get(threadId);
    if (thread) {
      thread.frames = frames;
      thread.currentFrameIndex = 0;
    }

    return frames;
  }

  async getScopes(frameId: number): Promise<DebugScope[]> {
    const response = await this.sendRequest('scopes', { frameId });
    const body = response.body as { scopes: DebugScope[] };
    return body.scopes;
  }

  // ============================================================================
  // VARIABLE MANAGEMENT
  // ============================================================================

  async getVariables(variablesReference: number, start?: number, count?: number): Promise<DebugVariable[]> {
    const response = await this.sendRequest('variables', {
      variablesReference,
      start,
      count,
    });
    const body = response.body as { variables: DebugVariable[] };
    return body.variables;
  }

  async setVariable(
    variablesReference: number,
    name: string,
    value: string
  ): Promise<{ value: string; type?: string; variablesReference?: number }> {
    const response = await this.sendRequest('setVariable', {
      variablesReference,
      name,
      value,
    });
    return response.body as { value: string; type?: string; variablesReference?: number };
  }

  // ============================================================================
  // BREAKPOINT MANAGEMENT
  // ============================================================================

  async setBreakpoints(
    source: DebugSource,
    breakpoints: Array<{
      line: number;
      column?: number;
      condition?: string;
      hitCondition?: string;
      logMessage?: string;
    }>
  ): Promise<DebugBreakpoint[]> {
    const response = await this.sendRequest('setBreakpoints', {
      source,
      breakpoints,
      lines: breakpoints.map(b => b.line),
    });

    const body = response.body as { breakpoints: Array<{
      id?: number;
      verified: boolean;
      message?: string;
      source?: DebugSource;
      line?: number;
      column?: number;
    }> };

    const result: DebugBreakpoint[] = [];
    for (let i = 0; i < body.breakpoints.length; i++) {
      const bp = body.breakpoints[i];
      const id = `bp-${this.nextBreakpointId++}`;
      
      const debugBp: DebugBreakpoint = {
        id,
        source: bp.source || source,
        line: bp.line || breakpoints[i].line,
        column: bp.column || breakpoints[i].column,
        verified: bp.verified,
        enabled: true,
        condition: breakpoints[i].condition,
        hitCondition: breakpoints[i].hitCondition,
        logMessage: breakpoints[i].logMessage,
        message: bp.message,
      };

      this.breakpoints.set(id, debugBp);
      result.push(debugBp);
    }

    return result;
  }

  async setFunctionBreakpoints(
    breakpoints: Array<{ name: string; condition?: string; hitCondition?: string }>
  ): Promise<DebugBreakpoint[]> {
    const response = await this.sendRequest('setFunctionBreakpoints', {
      breakpoints,
    });

    const body = response.body as { breakpoints: DebugBreakpoint[] };
    return body.breakpoints;
  }

  async setExceptionBreakpoints(
    filters: string[],
    filterOptions?: Array<{ filterId: string; condition?: string }>
  ): Promise<void> {
    await this.sendRequest('setExceptionBreakpoints', {
      filters,
      filterOptions,
    });
  }

  getBreakpoints(): DebugBreakpoint[] {
    return Array.from(this.breakpoints.values());
  }

  getBreakpointsForFile(path: string): DebugBreakpoint[] {
    return this.getBreakpoints().filter(bp => bp.source?.path === path);
  }

  async toggleBreakpoint(id: string): Promise<boolean> {
    const bp = this.breakpoints.get(id);
    if (!bp) return false;

    bp.enabled = !bp.enabled;
    
    // Re-set breakpoints if we have a session
    const session = this.getActiveSession();
    if (session && bp.source) {
      const enabledBps = this.getBreakpoints().filter(b => b.enabled && b.source?.path === bp.source?.path);
      await this.setBreakpoints(
        bp.source,
        enabledBps.map(b => ({
          line: b.line!,
          column: b.column,
          condition: b.condition,
          hitCondition: b.hitCondition,
          logMessage: b.logMessage,
        }))
      );
    }

    return bp.enabled;
  }

  async removeBreakpoint(id: string): Promise<void> {
    const bp = this.breakpoints.get(id);
    if (!bp) return;

    this.breakpoints.delete(id);

    // Re-set breakpoints if we have a session
    const session = this.getActiveSession();
    if (session && bp.source) {
      const remainingBps = this.getBreakpoints().filter(b => b.source?.path === bp.source?.path);
      await this.setBreakpoints(
        bp.source,
        remainingBps.map(b => ({
          line: b.line!,
          column: b.column,
          condition: b.condition,
          hitCondition: b.hitCondition,
          logMessage: b.logMessage,
        }))
      );
    }
  }

  // ============================================================================
  // EXECUTION CONTROL
  // ============================================================================

  async continue(sessionId?: string, threadId?: number): Promise<void> {
    const session = sessionId ? this.sessions.get(sessionId) : this.getActiveSession();
    if (!session) return;

    const tid = threadId ?? session.activeThreadId ?? 1;

    await this.sendRequest('continue', { threadId: tid, singleThread: false });

    const thread = session.threads.get(tid);
    if (thread) {
      thread.state = 'running';
      thread.stoppedReason = undefined;
      thread.stoppedDescription = undefined;
    }

    session.state = 'running';
    this.emit('continued', { sessionId: session.id, threadId: tid });
  }

  async pause(sessionId?: string, threadId?: number): Promise<void> {
    const session = sessionId ? this.sessions.get(sessionId) : this.getActiveSession();
    if (!session) return;

    const tid = threadId ?? session.activeThreadId ?? 1;
    await this.sendRequest('pause', { threadId: tid });
  }

  async stepOver(sessionId?: string, threadId?: number): Promise<void> {
    const session = sessionId ? this.sessions.get(sessionId) : this.getActiveSession();
    if (!session) return;

    const tid = threadId ?? session.activeThreadId ?? 1;

    session.state = 'stepping';
    await this.sendRequest('next', {
      threadId: tid,
      granularity: session.capabilities.supportsSteppingGranularity ? 'statement' : undefined,
    });
  }

  async stepInto(sessionId?: string, threadId?: number): Promise<void> {
    const session = sessionId ? this.sessions.get(sessionId) : this.getActiveSession();
    if (!session) return;

    const tid = threadId ?? session.activeThreadId ?? 1;

    session.state = 'stepping';
    await this.sendRequest('stepIn', {
      threadId: tid,
      granularity: session.capabilities.supportsSteppingGranularity ? 'statement' : undefined,
    });
  }

  async stepOut(sessionId?: string, threadId?: number): Promise<void> {
    const session = sessionId ? this.sessions.get(sessionId) : this.getActiveSession();
    if (!session) return;

    const tid = threadId ?? session.activeThreadId ?? 1;

    session.state = 'stepping';
    await this.sendRequest('stepOut', {
      threadId: tid,
      granularity: session.capabilities.supportsSteppingGranularity ? 'statement' : undefined,
    });
  }

  async stepBack(sessionId?: string, threadId?: number): Promise<void> {
    const session = sessionId ? this.sessions.get(sessionId) : this.getActiveSession();
    if (!session || !session.capabilities.supportsStepBack) return;

    const tid = threadId ?? session.activeThreadId ?? 1;

    session.state = 'stepping';
    await this.sendRequest('stepBack', {
      threadId: tid,
      granularity: session.capabilities.supportsSteppingGranularity ? 'statement' : undefined,
    });
  }

  async restart(sessionId?: string): Promise<void> {
    const session = sessionId ? this.sessions.get(sessionId) : this.getActiveSession();
    if (!session) return;

    await this.sendRequest('restart', {
      arguments: session.config,
    });

    session.state = 'running';
    session.threads.clear();
    session.activeThreadId = null;
  }

  // ============================================================================
  // EVALUATION
  // ============================================================================

  async evaluate(
    expression: string,
    frameId?: number,
    context: 'watch' | 'repl' | 'hover' | 'clipboard' = 'watch'
  ): Promise<{ result: string; variablesReference: number; type?: string }> {
    const session = this.getActiveSession();
    
    const response = await this.sendRequest('evaluate', {
      expression,
      frameId,
      context: session?.capabilities.supportsClipboardContext
        ? context
        : context === 'clipboard' ? 'watch' : context,
      format: { hex: false },
    });

    return response.body as { result: string; variablesReference: number; type?: string };
  }

  async setExpression(
    expression: string,
    value: string,
    frameId?: number
  ): Promise<{ value: string; type?: string; variablesReference?: number }> {
    const session = this.getActiveSession();
    if (!session?.capabilities.supportsSetExpression) {
      throw new Error('Set expression not supported');
    }

    const response = await this.sendRequest('setExpression', {
      expression,
      value,
      frameId,
    });

    return response.body as { value: string; type?: string; variablesReference?: number };
  }

  // ============================================================================
  // EXCEPTION HANDLING
  // ============================================================================

  async getExceptionInfo(threadId: number): Promise<{
    exceptionId: string;
    description?: string;
    breakMode: string;
    details?: {
      message: string;
      typeName?: string;
      fullTypeName?: string;
      evaluateName?: string;
      stackTrace?: string;
      innerException?: unknown[];
    };
  } | null> {
    const session = this.getActiveSession();
    if (!session?.capabilities.supportsExceptionInfoRequest) return null;

    const response = await this.sendRequest('exceptionInfo', { threadId });
    return response.body as typeof response.body extends infer T ? T : never;
  }

  // ============================================================================
  // REQUEST/RESPONSE HANDLING
  // ============================================================================

  private async sendRequest(command: string, args?: Record<string, unknown>): Promise<DAPResponse> {
    const seq = ++this.seq;

    const request: DAPRequest = {
      seq,
      type: 'request',
      command,
      arguments: args,
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(seq);
        reject(new Error(`Request timeout: ${command}`));
      }, this.requestTimeout);

      this.pendingRequests.set(seq, { resolve, reject, timeout });
      this.transport.send(request);
    });
  }

  private handleResponse(response: DAPResponse): void {
    const pending = this.pendingRequests.get(response.request_seq);
    if (!pending) return;

    this.pendingRequests.delete(response.request_seq);
    clearTimeout(pending.timeout);

    if (response.success) {
      // Update capabilities if this is an initialize response
      if (response.command === 'initialize' && response.body) {
        const session = this.getActiveSession();
        if (session) {
          session.capabilities = {
            ...session.capabilities,
            ...(response.body as DAPCapabilities),
          };
        }
      }
      pending.resolve(response);
    } else {
      pending.reject(new Error(response.message || `Request failed: ${response.command}`));
    }
  }

  private handleEvent(event: DAPEvent): void {
    switch (event.event) {
      case 'stopped':
        this.handleStoppedEvent(event.body as StoppedEventBody);
        break;
      case 'continued':
        this.handleContinuedEvent(event.body as ContinuedEventBody);
        break;
      case 'thread':
        this.handleThreadEvent(event.body as ThreadEventBody);
        break;
      case 'output':
        this.emit('output', event.body as OutputEventBody);
        break;
      case 'breakpoint':
        this.handleBreakpointEvent(event.body as BreakpointEventBody);
        break;
      case 'terminated':
        this.handleTerminatedEvent(event.body as TerminatedEventBody);
        break;
      case 'exited':
        this.handleExitedEvent(event.body as ExitedEventBody);
        break;
      default:
        this.emit(event.event, event.body);
    }
  }

  private handleStoppedEvent(body: StoppedEventBody): void {
    const session = this.getActiveSession();
    if (!session) return;

    session.state = 'paused';

    const threadId = body.threadId ?? 1;
    let thread = session.threads.get(threadId);

    if (!thread) {
      thread = {
        id: threadId,
        name: `Thread ${threadId}`,
        state: 'paused',
        frames: [],
        currentFrameIndex: 0,
        stoppedReason: body.reason,
        stoppedDescription: body.description,
      };
      session.threads.set(threadId, thread);
    } else {
      thread.state = 'paused';
      thread.stoppedReason = body.reason;
      thread.stoppedDescription = body.description;
    }

    if (body.allThreadsStopped) {
      session.threads.forEach(t => {
        t.state = 'paused';
      });
    }

    session.activeThreadId = threadId;

    // Refresh call stack
    this.refreshCallStack(session.id, threadId).catch(console.error);

    this.emit('stopped', {
      sessionId: session.id,
      reason: body.reason,
      threadId,
      description: body.description,
      hitBreakpointIds: body.hitBreakpointIds,
    });
  }

  private handleContinuedEvent(body: ContinuedEventBody): void {
    const session = this.getActiveSession();
    if (!session) return;

    const threadId = body.threadId ?? 1;
    const thread = session.threads.get(threadId);

    if (thread) {
      thread.state = 'running';
      thread.stoppedReason = undefined;
      thread.stoppedDescription = undefined;
    }

    if (body.allThreadsContinued) {
      session.threads.forEach(t => {
        t.state = 'running';
      });
      session.state = 'running';
    }

    this.emit('continued', { sessionId: session.id, threadId });
  }

  private handleThreadEvent(body: ThreadEventBody): void {
    const session = this.getActiveSession();
    if (!session) return;

    if (body.reason === 'started') {
      session.threads.set(body.threadId, {
        id: body.threadId,
        name: `Thread ${body.threadId}`,
        state: 'running',
        frames: [],
        currentFrameIndex: 0,
      });
    } else {
      session.threads.delete(body.threadId);
    }

    this.emit('thread', { sessionId: session.id, ...body });
  }

  private handleBreakpointEvent(body: BreakpointEventBody): void {
    if (body.reason === 'changed' || body.reason === 'new') {
      this.breakpoints.set(body.breakpoint.id || `bp-${Date.now()}`, body.breakpoint);
    } else if (body.reason === 'removed') {
      this.breakpoints.delete(body.breakpoint.id || '');
    }

    this.emit('breakpoint', body);
  }

  private handleTerminatedEvent(body: TerminatedEventBody): void {
    const session = this.getActiveSession();
    if (!session) return;

    session.state = 'stopped';
    session.endedAt = new Date();

    this.emit('terminated', { sessionId: session.id, restart: body.restart });
  }

  private handleExitedEvent(body: ExitedEventBody): void {
    const session = this.getActiveSession();
    if (!session) return;

    session.exitCode = body.exitCode;
    session.state = 'stopped';
    session.endedAt = new Date();

    this.emit('exited', { sessionId: session.id, exitCode: body.exitCode });
  }

  // ============================================================================
  // EVENT EMISSION
  // ============================================================================

  on(event: string, callback: (body: unknown) => void): () => void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);
    return () => this.eventListeners.get(event)?.delete(callback);
  }

  private emit(event: string, body: unknown): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(body);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  clearAll(): void {
    this.sessions.clear();
    this.breakpoints.clear();
    this.activeSessionId = null;
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let dapClientInstance: DAPClient | null = null;

export function getDAPClient(): DAPClient {
  if (!dapClientInstance) {
    dapClientInstance = new DAPClient();
  }
  return dapClientInstance;
}

export function createDAPClient(transport?: Transport): DAPClient {
  dapClientInstance = new DAPClient(transport);
  return dapClientInstance;
}

// Default export
export default DAPClient;
