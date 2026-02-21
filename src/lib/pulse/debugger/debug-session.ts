/**
 * Kyro IDE Debug Session Manager
 * 
 * Comprehensive debug session management with lifecycle control,
 * thread management, exception handling, and Debug Adapter Protocol support.
 * 
 * Features:
 * - Session lifecycle (start, pause, resume, stop)
 * - Multi-thread debugging support
 * - Exception handling and breakpoints
 * - Debug Adapter Protocol (DAP) implementation
 * - Session state persistence and restoration
 */

import type {
  SourceLocation,
  CallStackFrame,
  Scope,
} from './visual-debugger';

// ============================================================================
// TYPES
// ============================================================================

export type SessionState = 
  | 'initializing'
  | 'configured'
  | 'launching'
  | 'running'
  | 'paused'
  | 'stepping'
  | 'stopping'
  | 'stopped'
  | 'error';

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

export type ExceptionBreakMode = 
  | 'never'
  | 'always'
  | 'unhandled'
  | 'userUnhandled';

export interface DebugSession {
  id: string;
  name: string;
  type: string;
  request: 'launch' | 'attach';
  state: SessionState;
  configuration: DebugConfiguration;
  capabilities: DebugAdapterCapabilities;
  threads: Map<number, Thread>;
  activeThreadId: number | null;
  startedAt?: Date;
  endedAt?: Date;
  exitCode?: number;
  error?: string;
  variablesReference: number;
  variablesMap: Map<number, VariablesContainer>;
}

export interface DebugConfiguration {
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

export interface Thread {
  id: number;
  name: string;
  state: ThreadState;
  frames: CallStackFrame[];
  currentFrameIndex: number;
  stoppedReason?: StopReason;
  stoppedDescription?: string;
}

export type ThreadState = 'running' | 'paused' | 'stepping';

export interface ExceptionInfo {
  exceptionId: string;
  description?: string;
  breakMode: ExceptionBreakMode;
  details?: ExceptionDetails;
}

export interface ExceptionDetails {
  message: string;
  typeName?: string;
  fullTypeName?: string;
  evaluateName?: string;
  stackTrace?: string;
  innerException?: ExceptionDetails[];
}

export interface VariablesContainer {
  id: number;
  name: string;
  type: 'scope' | 'variable' | 'watch';
  variables: DebugVariable[];
  parentReference?: number;
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

export interface DebugAdapterCapabilities {
  supportsConfigurationDoneRequest: boolean;
  supportsFunctionBreakpoints: boolean;
  supportsConditionalBreakpoints: boolean;
  supportsHitConditionalBreakpoints: boolean;
  supportsEvaluateForHovers: boolean;
  supportsStepBack: boolean;
  supportsSetVariable: boolean;
  supportsRestartFrame: boolean;
  supportsGotoTargetsRequest: boolean;
  supportsStepInTargetsRequest: boolean;
  supportsCompletionsRequest: boolean;
  supportsModulesRequest: boolean;
  supportsExceptionOptions: boolean;
  supportsValueFormattingOptions: boolean;
  supportsExceptionInfoRequest: boolean;
  supportTerminateDebuggee: boolean;
  supportsDelayedStackTraceLoading: boolean;
  supportsLoadedSourcesRequest: boolean;
  supportsLogPoints: boolean;
  supportsTerminateThreadsRequest: boolean;
  supportsSetExpression: boolean;
  supportsTerminateRequest: boolean;
  supportsDataBreakpoints: boolean;
  supportsReadMemoryRequest: boolean;
  supportsDisassembleRequest: boolean;
  supportsCancelRequest: boolean;
  supportsBreakpointLocationsRequest: boolean;
  supportsClipboardContext: boolean;
  supportsSteppingGranularity: boolean;
  supportsInstructionBreakpoints: boolean;
  supportsExceptionFilterOptions: boolean;
}

export interface StoppedEvent {
  reason: StopReason;
  description?: string;
  threadId?: number;
  preserveFocusHint?: boolean;
  text?: string;
  allThreadsStopped?: boolean;
  hitBreakpointIds?: number[];
}

export interface ContinuedEvent {
  threadId?: number;
  allThreadsContinued?: boolean;
}

export interface ThreadEvent {
  reason: 'started' | 'exited';
  threadId: number;
}

export interface OutputEvent {
  category: 'console' | 'stdout' | 'stderr' | 'telemetry' | string;
  output: string;
  group?: 'start' | 'startCollapsed' | 'end';
  variablesReference?: number;
  source?: SourceLocation;
  line?: number;
  column?: number;
  data?: unknown;
}

export interface BreakpointEvent {
  reason: 'changed' | 'new' | 'removed' | string;
  breakpoint: DebugProtocolBreakpoint;
}

export interface DebugProtocolBreakpoint {
  id?: number;
  verified: boolean;
  message?: string;
  source?: SourceInfo;
  line?: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
  instructionReference?: string;
  offset?: number;
}

export interface SourceInfo {
  name?: string;
  path?: string;
  sourceReference?: number;
  presentationHint?: 'normal' | 'emphasize' | 'deemphasize';
  origin?: string;
  sources?: SourceInfo[];
  adapterData?: unknown;
  checksums?: Checksum[];
}

export interface Checksum {
  algorithm: 'MD5' | 'SHA1' | 'SHA256' | 'timestamp';
  checksum: string;
}

export interface ModuleEvent {
  reason: 'new' | 'changed' | 'removed';
  module: ModuleInfo;
}

export interface ModuleInfo {
  id: number | string;
  name: string;
  path?: string;
  isOptimized?: boolean;
  isUserCode?: boolean;
  version?: string;
  symbolStatus?: string;
  symbolFilePath?: string;
  dateTimeStamp?: string;
  addressRange?: string;
}

export interface LoadedSourceEvent {
  reason: 'new' | 'changed' | 'removed';
  source: SourceInfo;
}

// ============================================================================
// DAP MESSAGE TYPES
// ============================================================================

export interface DAPRequest {
  seq: number;
  type: 'request';
  command: string;
  arguments?: unknown;
}

export interface DAPResponse {
  seq: number;
  type: 'response';
  request_seq: number;
  success: boolean;
  command: string;
  message?: string;
  body?: unknown;
}

export interface DAPEvent {
  seq: number;
  type: 'event';
  event: string;
  body?: unknown;
}

export type DAPMessage = DAPRequest | DAPResponse | DAPEvent;

// ============================================================================
// DEBUG SESSION MANAGER
// ============================================================================

export class DebugSessionManager {
  private sessions: Map<string, DebugSession> = new Map();
  private activeSessionId: string | null = null;
  private messageSeq: number = 0;
  private pendingRequests: Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }> = new Map();
  private eventListeners: Map<string, Set<(event: unknown) => void>> = new Map();
  private nextVariablesReference: number = 1000;

  /**
   * Create a new debug session
   */
  async createSession(configuration: DebugConfiguration): Promise<DebugSession> {
    const id = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const session: DebugSession = {
      id,
      name: configuration.name,
      type: configuration.type,
      request: configuration.request,
      state: 'initializing',
      configuration,
      capabilities: this.getDefaultCapabilities(),
      threads: new Map(),
      activeThreadId: null,
      variablesReference: 1,
      variablesMap: new Map(),
    };

    this.sessions.set(id, session);

    try {
      // Initialize the debug adapter
      await this.initializeAdapter(session);

      // Launch or attach
      if (configuration.request === 'launch') {
        await this.launchSession(session);
      } else {
        await this.attachSession(session);
      }

      this.activeSessionId = id;
      this.emitEvent('sessionCreated', { session });

      return session;
    } catch (error) {
      session.state = 'error';
      session.error = (error as Error).message;
      throw error;
    }
  }

  /**
   * Initialize debug adapter
   */
  private async initializeAdapter(session: DebugSession): Promise<void> {
    // Send initialize request
    const response = await this.sendRequest(session, 'initialize', {
      clientID: 'kyro-ide',
      clientName: 'Kyro IDE',
      adapterID: session.type,
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

    // Update capabilities from response
    if (response.body) {
      session.capabilities = {
        ...this.getDefaultCapabilities(),
        ...(response.body as DebugAdapterCapabilities),
      };
    }

    session.state = 'configured';
  }

  /**
   * Launch debug session
   */
  private async launchSession(session: DebugSession): Promise<void> {
    session.state = 'launching';

    await this.sendRequest(session, 'launch', session.configuration);
    
    // Configuration done
    if (session.capabilities.supportsConfigurationDoneRequest) {
      await this.sendRequest(session, 'configurationDone', {});
    }

    session.state = 'running';
    session.startedAt = new Date();
  }

  /**
   * Attach to running process
   */
  private async attachSession(session: DebugSession): Promise<void> {
    session.state = 'launching';

    await this.sendRequest(session, 'attach', session.configuration);
    
    if (session.capabilities.supportsConfigurationDoneRequest) {
      await this.sendRequest(session, 'configurationDone', {});
    }

    session.state = 'running';
    session.startedAt = new Date();
  }

  /**
   * Terminate debug session
   */
  async terminateSession(sessionId: string, force: boolean = false): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.state = 'stopping';

    try {
      if (session.capabilities.supportTerminateRequest && !force) {
        await this.sendRequest(session, 'terminate', { restart: false });
      } else {
        await this.sendRequest(session, 'disconnect', { 
          restart: false,
          terminateDebuggee: session.capabilities.supportTerminateDebuggee,
        });
      }
    } catch {
      // Ignore errors during termination
    }

    session.state = 'stopped';
    session.endedAt = new Date();
    
    this.emitEvent('sessionTerminated', { session });
    
    if (this.activeSessionId === sessionId) {
      this.activeSessionId = null;
    }
  }

  /**
   * Get active session
   */
  getActiveSession(): DebugSession | null {
    if (!this.activeSessionId) return null;
    return this.sessions.get(this.activeSessionId) || null;
  }

  /**
   * Get all sessions
   */
  getSessions(): DebugSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Get session by ID
   */
  getSession(id: string): DebugSession | undefined {
    return this.sessions.get(id);
  }

  /**
   * Set active session
   */
  setActiveSession(id: string): boolean {
    if (this.sessions.has(id)) {
      this.activeSessionId = id;
      return true;
    }
    return false;
  }

  // ============================================================================
  // THREAD MANAGEMENT
  // ============================================================================

  /**
   * Get all threads in session
   */
  getThreads(sessionId: string): Thread[] {
    const session = this.sessions.get(sessionId);
    if (!session) return [];
    return Array.from(session.threads.values());
  }

  /**
   * Get active thread
   */
  getActiveThread(sessionId: string): Thread | null {
    const session = this.sessions.get(sessionId);
    if (!session || session.activeThreadId === null) return null;
    return session.threads.get(session.activeThreadId) || null;
  }

  /**
   * Set active thread
   */
  async setActiveThread(sessionId: string, threadId: number): Promise<Thread | null> {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    session.activeThreadId = threadId;
    const thread = session.threads.get(threadId);
    
    if (thread && thread.frames.length === 0) {
      await this.refreshCallStack(sessionId, threadId);
    }

    return thread;
  }

  /**
   * Continue execution
   */
  async continue(sessionId: string, threadId?: number, singleThread: boolean = false): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const tid = threadId ?? session.activeThreadId ?? 1;

    await this.sendRequest(session, 'continue', {
      threadId: tid,
      singleThread,
    });

    // Update thread state
    const thread = session.threads.get(tid);
    if (thread) {
      thread.state = 'running';
      thread.stoppedReason = undefined;
      thread.stoppedDescription = undefined;
    }

    session.state = 'running';
    this.emitEvent('continued', { sessionId, threadId: tid });
  }

  /**
   * Pause execution
   */
  async pause(sessionId: string, threadId?: number): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const tid = threadId ?? session.activeThreadId ?? 1;

    await this.sendRequest(session, 'pause', {
      threadId: tid,
    });
  }

  /**
   * Step over
   */
  async stepOver(sessionId: string, threadId?: number): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const tid = threadId ?? session.activeThreadId ?? 1;

    session.state = 'stepping';
    await this.sendRequest(session, 'next', {
      threadId: tid,
      granularity: session.capabilities.supportsSteppingGranularity ? 'statement' : undefined,
    });
  }

  /**
   * Step into
   */
  async stepInto(sessionId: string, threadId?: number): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const tid = threadId ?? session.activeThreadId ?? 1;

    session.state = 'stepping';
    await this.sendRequest(session, 'stepIn', {
      threadId: tid,
      targetId: undefined,
      granularity: session.capabilities.supportsSteppingGranularity ? 'statement' : undefined,
    });
  }

  /**
   * Step out
   */
  async stepOut(sessionId: string, threadId?: number): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const tid = threadId ?? session.activeThreadId ?? 1;

    session.state = 'stepping';
    await this.sendRequest(session, 'stepOut', {
      threadId: tid,
      granularity: session.capabilities.supportsSteppingGranularity ? 'statement' : undefined,
    });
  }

  /**
   * Step back (reverse debugging)
   */
  async stepBack(sessionId: string, threadId?: number): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session || !session.capabilities.supportsStepBack) return;

    const tid = threadId ?? session.activeThreadId ?? 1;

    session.state = 'stepping';
    await this.sendRequest(session, 'stepBack', {
      threadId: tid,
      granularity: session.capabilities.supportsSteppingGranularity ? 'statement' : undefined,
    });
  }

  /**
   * Run to cursor
   */
  async runToCursor(sessionId: string, location: SourceLocation): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    await this.sendRequest(session, 'goto', {
      threadId: session.activeThreadId ?? 1,
      targetId: `${location.file}:${location.line}`,
    });
  }

  /**
   * Restart session
   */
  async restart(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    await this.sendRequest(session, 'restart', {
      arguments: session.configuration,
    });

    session.state = 'running';
    session.threads.clear();
    session.activeThreadId = null;
  }

  // ============================================================================
  // CALL STACK MANAGEMENT
  // ============================================================================

  /**
   * Refresh call stack for thread
   */
  async refreshCallStack(sessionId: string, threadId: number): Promise<CallStackFrame[]> {
    const session = this.sessions.get(sessionId);
    if (!session) return [];

    const response = await this.sendRequest(session, 'stackTrace', {
      threadId,
      startFrame: 0,
      levels: 20,
      format: { parameters: true, parameterTypes: true, parameterNames: true, line: true, module: true },
    });

    const frames: CallStackFrame[] = [];
    const body = response.body as { stackFrames: DAPStackFrame[] };

    for (const frame of body.stackFrames) {
      const callFrame: CallStackFrame = {
        id: `frame-${frame.id}`,
        name: frame.name,
        displayName: frame.name,
        location: {
          file: frame.source?.path || '',
          line: frame.line,
          column: frame.column,
        },
        line: frame.line,
        column: frame.column,
        scopeChain: [],
        locals: new Map(),
        arguments: [],
        isPaused: false,
        canRestart: session.capabilities.supportsRestartFrame,
        instructionPointer: frame.instructionPointerReference,
      };

      if (frame.source) {
        callFrame.source = {
          path: frame.source.path || '',
          mimeType: 'text/javascript',
          lines: 0,
        };
      }

      frames.push(callFrame);
    }

    // Update thread
    const thread = session.threads.get(threadId);
    if (thread) {
      thread.frames = frames;
      thread.currentFrameIndex = 0;
    }

    return frames;
  }

  /**
   * Get scopes for frame
   */
  async getScopes(sessionId: string, frameId: number): Promise<Scope[]> {
    const session = this.sessions.get(sessionId);
    if (!session) return [];

    const response = await this.sendRequest(session, 'scopes', {
      frameId,
    });

    const body = response.body as { scopes: DAPScope[] };
    const scopes: Scope[] = [];

    for (const dapScope of body.scopes) {
      const scope: Scope = {
        type: this.mapScopeType(dapScope.presentationHint),
        name: dapScope.name,
        object: {
          type: 'object',
          value: {},
          displayValue: dapScope.name,
          isTruncated: false,
        },
        variables: new Map(),
        startLocation: dapScope.line ? {
          file: '',
          line: dapScope.line,
          column: dapScope.column || 0,
        } : undefined,
        endLocation: dapScope.endLine ? {
          file: '',
          line: dapScope.endLine,
          column: dapScope.endColumn || 0,
        } : undefined,
      };

      // Store variables reference
      const containerId = this.allocateVariablesReference(session);
      session.variablesMap.set(containerId, {
        id: containerId,
        name: dapScope.name,
        type: 'scope',
        variablesReference: dapScope.variablesReference,
        parentReference: dapScope.variablesReference,
      });

      // Load variables
      const variables = await this.getVariables(sessionId, dapScope.variablesReference);
      for (const variable of variables) {
        scope.variables.set(variable.name, {
          id: `var-${variable.name}-${Date.now()}`,
          expression: variable.name,
          name: variable.name,
          value: {
            type: (variable.type as 'string') || 'object',
            value: variable.value,
            displayValue: variable.value,
            isTruncated: false,
          },
          type: variable.type || 'unknown',
          scope: scope.type,
          path: variable.name,
          isExpanded: false,
          hasChildren: (variable.namedVariables || 0) + (variable.indexedVariables || 0) > 0,
          children: [],
          isEnabled: true,
          updateCount: 0,
          valueChanges: [],
        });
      }

      scopes.push(scope);
    }

    return scopes;
  }

  /**
   * Get variables for container
   */
  async getVariables(sessionId: string, variablesReference: number): Promise<DebugVariable[]> {
    const session = this.sessions.get(sessionId);
    if (!session) return [];

    const response = await this.sendRequest(session, 'variables', {
      variablesReference,
    });

    const body = response.body as { variables: DAPVariable[] };
    
    return body.variables.map(v => ({
      name: v.name,
      value: v.value,
      type: v.type,
      evaluateName: v.evaluateName,
      variablesReference: v.variablesReference,
      namedVariables: v.namedVariables,
      indexedVariables: v.indexedVariables,
      memoryReference: v.memoryReference,
      presentationHint: v.presentationHint ? {
        kind: v.presentationHint.kind,
        attributes: v.presentationHint.attributes,
        visibility: v.presentationHint.visibility,
      } : undefined,
    }));
  }

  // ============================================================================
  // EXCEPTION HANDLING
  // ============================================================================

  /**
   * Set exception break mode
   */
  async setExceptionBreakpoints(
    sessionId: string,
    filters: string[],
    filterOptions?: { filterId: string; condition?: string }[]
  ): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    await this.sendRequest(session, 'setExceptionBreakpoints', {
      filters,
      filterOptions: session.capabilities.supportsExceptionFilterOptions ? filterOptions : undefined,
    });
  }

  /**
   * Get exception info
   */
  async getExceptionInfo(sessionId: string, threadId: number): Promise<ExceptionInfo | null> {
    const session = this.sessions.get(sessionId);
    if (!session || !session.capabilities.supportsExceptionInfoRequest) return null;

    const response = await this.sendRequest(session, 'exceptionInfo', {
      threadId,
    });

    const body = response.body as ExceptionInfo;
    return body;
  }

  // ============================================================================
  // EVALUATION
  // ============================================================================

  /**
   * Evaluate expression
   */
  async evaluate(
    sessionId: string,
    expression: string,
    frameId?: number,
    context: 'watch' | 'repl' | 'hover' | 'clipboard' = 'watch'
  ): Promise<{ result: string; variablesReference: number; type?: string }> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');

    const response = await this.sendRequest(session, 'evaluate', {
      expression,
      frameId,
      context: session.capabilities.supportsClipboardContext ? context : (context === 'clipboard' ? 'watch' : context),
      format: { hex: false },
    });

    const body = response.body as { result: string; variablesReference: number; type?: string };
    return body;
  }

  /**
   * Set variable value
   */
  async setVariable(
    sessionId: string,
    variablesReference: number,
    name: string,
    value: string
  ): Promise<{ value: string; type?: string; variablesReference?: number }> {
    const session = this.sessions.get(sessionId);
    if (!session || !session.capabilities.supportsSetVariable) {
      throw new Error('Set variable not supported');
    }

    const response = await this.sendRequest(session, 'setVariable', {
      variablesReference,
      name,
      value,
    });

    const body = response.body as { value: string; type?: string; variablesReference?: number };
    return body;
  }

  /**
   * Set expression (alternative to setVariable)
   */
  async setExpression(
    sessionId: string,
    expression: string,
    value: string,
    frameId?: number
  ): Promise<{ value: string; type?: string; variablesReference?: number }> {
    const session = this.sessions.get(sessionId);
    if (!session || !session.capabilities.supportsSetExpression) {
      throw new Error('Set expression not supported');
    }

    const response = await this.sendRequest(session, 'setExpression', {
      expression,
      value,
      frameId,
    });

    const body = response.body as { value: string; type?: string; variablesReference?: number };
    return body;
  }

  // ============================================================================
  // DAP COMMUNICATION
  // ============================================================================

  /**
   * Send DAP request
   */
  private async sendRequest(session: DebugSession, command: string, args?: unknown): Promise<DAPResponse> {
    const seq = ++this.messageSeq;
    
    const request: DAPRequest = {
      seq,
      type: 'request',
      command,
      arguments: args,
    };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(seq, { resolve, reject });
      
      // In a real implementation, this would send to the debug adapter
      // For now, we simulate the response
      this.simulateResponse(session, request).then(response => {
        this.pendingRequests.delete(seq);
        resolve(response);
      }).catch(error => {
        this.pendingRequests.delete(seq);
        reject(error);
      });
    });
  }

  /**
   * Simulate DAP response (placeholder for actual debug adapter communication)
   */
  private async simulateResponse(session: DebugSession, request: DAPRequest): Promise<DAPResponse> {
    // This would be replaced by actual debug adapter communication
    // For now, return simulated responses
    
    const responses: Record<string, () => DAPResponse> = {
      initialize: () => ({
        seq: ++this.messageSeq,
        type: 'response',
        request_seq: request.seq,
        success: true,
        command: 'initialize',
        body: this.getDefaultCapabilities(),
      }),
      launch: () => ({
        seq: ++this.messageSeq,
        type: 'response',
        request_seq: request.seq,
        success: true,
        command: 'launch',
      }),
      attach: () => ({
        seq: ++this.messageSeq,
        type: 'response',
        request_seq: request.seq,
        success: true,
        command: 'attach',
      }),
      configurationDone: () => ({
        seq: ++this.messageSeq,
        type: 'response',
        request_seq: request.seq,
        success: true,
        command: 'configurationDone',
      }),
      continue: () => {
        // Emit continued event
        setTimeout(() => {
          this.handleEvent(session, {
            seq: ++this.messageSeq,
            type: 'event',
            event: 'continued',
            body: { threadId: 1, allThreadsContinued: true },
          });
        }, 10);

        return {
          seq: ++this.messageSeq,
          type: 'response',
          request_seq: request.seq,
          success: true,
          command: 'continue',
          body: { allThreadsContinued: true },
        };
      },
      pause: () => ({
        seq: ++this.messageSeq,
        type: 'response',
        request_seq: request.seq,
        success: true,
        command: 'pause',
      }),
      next: () => ({
        seq: ++this.messageSeq,
        type: 'response',
        request_seq: request.seq,
        success: true,
        command: 'next',
      }),
      stepIn: () => ({
        seq: ++this.messageSeq,
        type: 'response',
        request_seq: request.seq,
        success: true,
        command: 'stepIn',
      }),
      stepOut: () => ({
        seq: ++this.messageSeq,
        type: 'response',
        request_seq: request.seq,
        success: true,
        command: 'stepOut',
      }),
      stackTrace: () => ({
        seq: ++this.messageSeq,
        type: 'response',
        request_seq: request.seq,
        success: true,
        command: 'stackTrace',
        body: { stackFrames: [] },
      }),
      scopes: () => ({
        seq: ++this.messageSeq,
        type: 'response',
        request_seq: request.seq,
        success: true,
        command: 'scopes',
        body: { scopes: [] },
      }),
      variables: () => ({
        seq: ++this.messageSeq,
        type: 'response',
        request_seq: request.seq,
        success: true,
        command: 'variables',
        body: { variables: [] },
      }),
      evaluate: () => ({
        seq: ++this.messageSeq,
        type: 'response',
        request_seq: request.seq,
        success: true,
        command: 'evaluate',
        body: { result: 'undefined', variablesReference: 0 },
      }),
      disconnect: () => ({
        seq: ++this.messageSeq,
        type: 'response',
        request_seq: request.seq,
        success: true,
        command: 'disconnect',
      }),
      terminate: () => ({
        seq: ++this.messageSeq,
        type: 'response',
        request_seq: request.seq,
        success: true,
        command: 'terminate',
      }),
    };

    const handler = responses[request.command];
    if (handler) {
      return handler();
    }

    return {
      seq: ++this.messageSeq,
      type: 'response',
      request_seq: request.seq,
      success: false,
      command: request.command,
      message: `Unknown command: ${request.command}`,
    };
  }

  /**
   * Handle DAP event
   */
  handleEvent(session: DebugSession, event: DAPEvent): void {
    switch (event.event) {
      case 'stopped':
        this.handleStoppedEvent(session, event.body as StoppedEvent);
        break;
      case 'continued':
        this.handleContinuedEvent(session, event.body as ContinuedEvent);
        break;
      case 'thread':
        this.handleThreadEvent(session, event.body as ThreadEvent);
        break;
      case 'output':
        this.emitEvent('output', { sessionId: session.id, ...event.body as OutputEvent });
        break;
      case 'breakpoint':
        this.emitEvent('breakpoint', { sessionId: session.id, ...event.body as BreakpointEvent });
        break;
      case 'terminated':
        this.handleTerminatedEvent(session);
        break;
      case 'exited':
        session.exitCode = (event.body as { exitCode?: number }).exitCode;
        session.state = 'stopped';
        session.endedAt = new Date();
        break;
      case 'module':
        this.emitEvent('module', { sessionId: session.id, ...event.body as ModuleEvent });
        break;
      case 'loadedSource':
        this.emitEvent('loadedSource', { sessionId: session.id, ...event.body as LoadedSourceEvent });
        break;
    }
  }

  /**
   * Handle stopped event
   */
  private handleStoppedEvent(session: DebugSession, event: StoppedEvent): void {
    session.state = 'paused';

    const threadId = event.threadId ?? 1;
    let thread = session.threads.get(threadId);

    if (!thread) {
      thread = {
        id: threadId,
        name: `Thread ${threadId}`,
        state: 'paused',
        frames: [],
        currentFrameIndex: 0,
        stoppedReason: event.reason,
        stoppedDescription: event.description,
      };
      session.threads.set(threadId, thread);
    } else {
      thread.state = 'paused';
      thread.stoppedReason = event.reason;
      thread.stoppedDescription = event.description;
    }

    if (event.allThreadsStopped) {
      session.threads.forEach(t => {
        t.state = 'paused';
      });
    }

    session.activeThreadId = threadId;

    this.emitEvent('stopped', {
      sessionId: session.id,
      reason: event.reason,
      threadId,
      description: event.description,
      hitBreakpointIds: event.hitBreakpointIds,
    });
  }

  /**
   * Handle continued event
   */
  private handleContinuedEvent(session: DebugSession, event: ContinuedEvent): void {
    const threadId = event.threadId ?? 1;
    const thread = session.threads.get(threadId);

    if (thread) {
      thread.state = 'running';
      thread.stoppedReason = undefined;
      thread.stoppedDescription = undefined;
    }

    if (event.allThreadsContinued) {
      session.threads.forEach(t => {
        t.state = 'running';
      });
      session.state = 'running';
    }

    this.emitEvent('continued', { sessionId: session.id, threadId });
  }

  /**
   * Handle thread event
   */
  private handleThreadEvent(session: DebugSession, event: ThreadEvent): void {
    if (event.reason === 'started') {
      session.threads.set(event.threadId, {
        id: event.threadId,
        name: `Thread ${event.threadId}`,
        state: 'running',
        frames: [],
        currentFrameIndex: 0,
      });
    } else {
      session.threads.delete(event.threadId);
    }

    this.emitEvent('thread', { sessionId: session.id, ...event });
  }

  /**
   * Handle terminated event
   */
  private handleTerminatedEvent(session: DebugSession): void {
    session.state = 'stopped';
    session.endedAt = new Date();
    
    this.emitEvent('terminated', { sessionId: session.id });
  }

  // ============================================================================
  // EVENT HANDLING
  // ============================================================================

  /**
   * Subscribe to debug events
   */
  on(event: string, callback: (data: unknown) => void): () => void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);
    return () => this.eventListeners.get(event)?.delete(callback);
  }

  /**
   * Emit event
   */
  private emitEvent(event: string, data: unknown): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }

  // ============================================================================
  // UTILITIES
  // ============================================================================

  /**
   * Get default capabilities
   */
  private getDefaultCapabilities(): DebugAdapterCapabilities {
    return {
      supportsConfigurationDoneRequest: true,
      supportsFunctionBreakpoints: false,
      supportsConditionalBreakpoints: true,
      supportsHitConditionalBreakpoints: true,
      supportsEvaluateForHovers: true,
      supportsStepBack: false,
      supportsSetVariable: true,
      supportsRestartFrame: false,
      supportsGotoTargetsRequest: false,
      supportsStepInTargetsRequest: false,
      supportsCompletionsRequest: false,
      supportsModulesRequest: false,
      supportsExceptionOptions: true,
      supportsValueFormattingOptions: true,
      supportsExceptionInfoRequest: true,
      supportTerminateDebuggee: true,
      supportsDelayedStackTraceLoading: false,
      supportsLoadedSourcesRequest: false,
      supportsLogPoints: true,
      supportsTerminateThreadsRequest: false,
      supportsSetExpression: true,
      supportsTerminateRequest: true,
      supportsDataBreakpoints: false,
      supportsReadMemoryRequest: false,
      supportsDisassembleRequest: false,
      supportsCancelRequest: true,
      supportsBreakpointLocationsRequest: false,
      supportsClipboardContext: false,
      supportsSteppingGranularity: true,
      supportsInstructionBreakpoints: false,
      supportsExceptionFilterOptions: true,
    };
  }

  /**
   * Map scope presentation hint to scope type
   */
  private mapScopeType(hint?: string): Scope['type'] {
    const map: Record<string, Scope['type']> = {
      'local': 'local',
      'global': 'global',
      'closure': 'closure',
      'arguments': 'local',
      'registers': 'local',
      'returnValue': 'local',
    };
    return map[hint || 'local'] || 'local';
  }

  /**
   * Allocate variables reference
   */
  private allocateVariablesReference(session: DebugSession): number {
    return session.variablesReference++;
  }

  /**
   * Clear all sessions
   */
  async clearAll(): Promise<void> {
    for (const session of this.sessions.values()) {
      try {
        await this.terminateSession(session.id, true);
      } catch {
        // Ignore errors
      }
    }
    this.sessions.clear();
    this.activeSessionId = null;
  }
}

// ============================================================================
// DAP TYPES (Additional)
// ============================================================================

interface DAPStackFrame {
  id: number;
  name: string;
  source?: {
    name?: string;
    path?: string;
    sourceReference?: number;
    presentationHint?: string;
    origin?: string;
  };
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
  instructionPointerReference?: string;
  moduleId?: number | string;
  presentationHint?: 'normal' | 'label' | 'subtle';
}

interface DAPScope {
  name: string;
  presentationHint?: 'arguments' | 'locals' | 'registers' | string;
  variablesReference: number;
  namedVariables?: number;
  indexedVariables?: number;
  expensive: boolean;
  source?: {
    name?: string;
    path?: string;
  };
  line?: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
}

interface DAPVariable {
  name: string;
  value: string;
  type?: string;
  presentationHint?: {
    kind?: string;
    attributes?: string[];
    visibility?: string;
  };
  evaluateName?: string;
  variablesReference: number;
  namedVariables?: number;
  indexedVariables?: number;
  memoryReference?: string;
}

// Export singleton instance
export const debugSessionManager = new DebugSessionManager();
