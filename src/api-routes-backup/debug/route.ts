/**
 * Kyro IDE Debug API Route
 * 
 * API endpoints for DAP (Debug Adapter Protocol) operations
 */

import { NextRequest, NextResponse } from 'next/server';

// ============================================================================
// TYPES
// ============================================================================

interface DebugSessionRequest {
  action: 'create' | 'terminate' | 'restart' | 'status';
  config?: {
    type: string;
    name: string;
    request: 'launch' | 'attach';
    program?: string;
    args?: string[];
    cwd?: string;
    env?: Record<string, string>;
    stopOnEntry?: boolean;
    noDebug?: boolean;
  };
  sessionId?: string;
}

interface DebugControlRequest {
  action: 'continue' | 'pause' | 'stepOver' | 'stepInto' | 'stepOut' | 'stepBack';
  sessionId?: string;
  threadId?: number;
}

interface BreakpointRequest {
  action: 'set' | 'remove' | 'toggle' | 'list';
  sessionId?: string;
  breakpoint?: {
    source: { path: string; name?: string };
    line: number;
    column?: number;
    condition?: string;
    hitCondition?: string;
    logMessage?: string;
  };
  breakpointId?: string;
}

interface EvaluateRequest {
  expression: string;
  frameId?: number;
  context?: 'watch' | 'repl' | 'hover' | 'clipboard';
  sessionId?: string;
}

interface VariablesRequest {
  variablesReference: number;
  start?: number;
  count?: number;
  sessionId?: string;
}

// ============================================================================
// SIMULATED DEBUG STATE (for demo purposes)
// ============================================================================

interface SimulatedSession {
  id: string;
  name: string;
  type: string;
  state: 'running' | 'paused' | 'stopped';
  currentLine: number;
  threads: Array<{ id: number; name: string; state: string }>;
  callStack: Array<{ id: number; name: string; file: string; line: number; column: number }>;
  variables: Map<number, Array<{ name: string; value: string; type: string; variablesReference: number }>>;
  breakpoints: Array<{ id: string; path: string; line: number; enabled: boolean; verified: boolean }>;
  output: Array<{ type: string; message: string; timestamp: Date }>;
}

const simulatedSessions = new Map<string, SimulatedSession>();
let breakpointCounter = 0;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function createSimulatedSession(config: DebugSessionRequest['config']): SimulatedSession {
  const id = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  const session: SimulatedSession = {
    id,
    name: config?.name || 'Debug Session',
    type: config?.type || 'node',
    state: config?.stopOnEntry ? 'paused' : 'running',
    currentLine: 1,
    threads: [
      { id: 1, name: 'Main Thread', state: config?.stopOnEntry ? 'paused' : 'running' },
    ],
    callStack: [
      { id: 1, name: 'processData', file: 'app.ts', line: 42, column: 5 },
      { id: 2, name: 'handleClick', file: 'components/Button.tsx', line: 15, column: 3 },
      { id: 3, name: 'onClick', file: 'components/Form.tsx', line: 28, column: 7 },
    ],
    variables: new Map([
      [1000, [
        { name: 'user', value: '{ name: "John", age: 30 }', type: 'Object', variablesReference: 1001 },
        { name: 'items', value: 'Array(3)', type: 'Array', variablesReference: 1002 },
        { name: 'count', value: '42', type: 'number', variablesReference: 0 },
        { name: 'isActive', value: 'true', type: 'boolean', variablesReference: 0 },
      ]],
      [1001, [
        { name: 'name', value: '"John"', type: 'string', variablesReference: 0 },
        { name: 'age', value: '30', type: 'number', variablesReference: 0 },
      ]],
      [1002, [
        { name: '0', value: '"apple"', type: 'string', variablesReference: 0 },
        { name: '1', value: '"banana"', type: 'string', variablesReference: 0 },
        { name: '2', value: '"orange"', type: 'string', variablesReference: 0 },
        { name: 'length', value: '3', type: 'number', variablesReference: 0 },
      ]],
      [2000, []], // Global scope
    ]),
    breakpoints: [],
    output: [
      { type: 'info', message: `Debug session started: ${config?.name || 'Debug Session'}`, timestamp: new Date() },
    ],
  };

  simulatedSessions.set(id, session);
  return session;
}

function evaluateExpression(expression: string, _sessionId: string): { result: string; type: string; error?: string } {
  // Simulated expression evaluation
  const simulatedValues: Record<string, { result: string; type: string }> = {
    'user.name': { result: '"John"', type: 'string' },
    'user.age': { result: '30', type: 'number' },
    'items.length': { result: '3', type: 'number' },
    'count': { result: '42', type: 'number' },
    'isActive': { result: 'true', type: 'boolean' },
    'items[0]': { result: '"apple"', type: 'string' },
  };

  if (expression in simulatedValues) {
    return simulatedValues[expression];
  }

  // Try to evaluate simple expressions
  try {
    // Check for simple math
    if (/^\d+\s*[\+\-\*\/]\s*\d+$/.test(expression)) {
      const result = eval(expression);
      return { result: String(result), type: 'number' };
    }
    
    // Check for comparison
    if (/^\d+\s*[<>=!]=?\s*\d+$/.test(expression)) {
      const result = eval(expression);
      return { result: String(result), type: 'boolean' };
    }

    return { result: 'undefined', type: 'undefined' };
  } catch {
    return { result: 'Error: Cannot evaluate expression', type: 'error', error: 'Evaluation failed' };
  }
}

// ============================================================================
// API HANDLERS
// ============================================================================

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  switch (action) {
    case 'sessions':
      return NextResponse.json({
        sessions: Array.from(simulatedSessions.values()).map(s => ({
          id: s.id,
          name: s.name,
          type: s.type,
          state: s.state,
          threads: s.threads,
        })),
      });

    case 'threads': {
      const sessionId = searchParams.get('sessionId');
      if (!sessionId) {
        return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
      }
      const session = simulatedSessions.get(sessionId);
      if (!session) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      }
      return NextResponse.json({ threads: session.threads });
    }

    case 'stackTrace': {
      const sessionId = searchParams.get('sessionId');
      if (!sessionId) {
        return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
      }
      const session = simulatedSessions.get(sessionId);
      if (!session) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      }
      return NextResponse.json({ stackFrames: session.callStack, totalFrames: session.callStack.length });
    }

    case 'scopes': {
      const sessionId = searchParams.get('sessionId');
      if (!sessionId) {
        return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
      }
      return NextResponse.json({
        scopes: [
          { name: 'Local', presentationHint: 'locals', variablesReference: 1000, namedVariables: 4, expensive: false },
          { name: 'Global', presentationHint: 'globals', variablesReference: 2000, namedVariables: 0, expensive: true },
        ],
      });
    }

    case 'variables': {
      const sessionId = searchParams.get('sessionId');
      const variablesReference = parseInt(searchParams.get('variablesReference') || '1000', 10);
      
      if (!sessionId) {
        return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
      }
      const session = simulatedSessions.get(sessionId);
      if (!session) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      }
      
      const variables = session.variables.get(variablesReference) || [];
      return NextResponse.json({ variables });
    }

    case 'breakpoints': {
      const sessionId = searchParams.get('sessionId');
      if (!sessionId) {
        return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
      }
      const session = simulatedSessions.get(sessionId);
      if (!session) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      }
      return NextResponse.json({ breakpoints: session.breakpoints });
    }

    case 'output': {
      const sessionId = searchParams.get('sessionId');
      if (!sessionId) {
        return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
      }
      const session = simulatedSessions.get(sessionId);
      if (!session) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      }
      return NextResponse.json({ output: session.output });
    }

    case 'capabilities':
      return NextResponse.json({
        capabilities: {
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
        },
      });

    default:
      return NextResponse.json({
        status: 'ok',
        endpoints: [
          'GET ?action=sessions',
          'GET ?action=threads&sessionId=...',
          'GET ?action=stackTrace&sessionId=...',
          'GET ?action=scopes&sessionId=...',
          'GET ?action=variables&sessionId=...&variablesReference=...',
          'GET ?action=breakpoints&sessionId=...',
          'GET ?action=output&sessionId=...',
          'GET ?action=capabilities',
          'POST with { action: "create" | "terminate" | "restart" | "status", ... }',
          'POST with { action: "continue" | "pause" | "stepOver" | "stepInto" | "stepOut" }',
          'POST with { action: "setBreakpoint" | "removeBreakpoint" | "toggleBreakpoint" }',
          'POST with { action: "evaluate", expression: "..." }',
        ],
      });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    // Session management
    if (['create', 'terminate', 'restart', 'status'].includes(action)) {
      return handleSessionAction(body as DebugSessionRequest);
    }

    // Execution control
    if (['continue', 'pause', 'stepOver', 'stepInto', 'stepOut', 'stepBack'].includes(action)) {
      return handleControlAction(body as DebugControlRequest);
    }

    // Breakpoint management
    if (['set', 'remove', 'toggle', 'list'].includes(action)) {
      return handleBreakpointAction(body as BreakpointRequest);
    }

    // Expression evaluation
    if (action === 'evaluate') {
      return handleEvaluateAction(body as EvaluateRequest);
    }

    // Variable operations
    if (action === 'setVariable') {
      const { sessionId, variablesReference, name, value } = body;
      const session = simulatedSessions.get(sessionId);
      if (!session) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      }
      
      const vars = session.variables.get(variablesReference);
      if (vars) {
        const existingVar = vars.find(v => v.name === name);
        if (existingVar) {
          existingVar.value = value;
          return NextResponse.json({ success: true, value });
        }
      }
      
      return NextResponse.json({ error: 'Variable not found' }, { status: 404 });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('Debug API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: (error as Error).message },
      { status: 500 }
    );
  }
}

// ============================================================================
// ACTION HANDLERS
// ============================================================================

function handleSessionAction(body: DebugSessionRequest) {
  switch (body.action) {
    case 'create': {
      const session = createSimulatedSession(body.config);
      return NextResponse.json({
        success: true,
        session: {
          id: session.id,
          name: session.name,
          type: session.type,
          state: session.state,
          threads: session.threads,
        },
      });
    }

    case 'terminate': {
      const { sessionId } = body;
      if (!sessionId) {
        return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
      }
      
      const session = simulatedSessions.get(sessionId);
      if (!session) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      }
      
      session.state = 'stopped';
      session.output.push({ type: 'info', message: 'Debug session terminated', timestamp: new Date() });
      
      return NextResponse.json({ success: true });
    }

    case 'restart': {
      const { sessionId } = body;
      if (!sessionId) {
        return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
      }
      
      const session = simulatedSessions.get(sessionId);
      if (!session) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      }
      
      session.state = 'running';
      session.currentLine = 1;
      session.output.push({ type: 'info', message: 'Debug session restarted', timestamp: new Date() });
      
      return NextResponse.json({ success: true });
    }

    case 'status': {
      const { sessionId } = body;
      if (!sessionId) {
        return NextResponse.json({ sessions: Array.from(simulatedSessions.keys()) });
      }
      
      const session = simulatedSessions.get(sessionId);
      if (!session) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      }
      
      return NextResponse.json({
        id: session.id,
        name: session.name,
        type: session.type,
        state: session.state,
        currentLine: session.currentLine,
        threads: session.threads,
      });
    }

    default:
      return NextResponse.json({ error: 'Unknown session action' }, { status: 400 });
  }
}

function handleControlAction(body: DebugControlRequest) {
  const { action, sessionId, threadId } = body;
  
  // Find or create default session
  let session: SimulatedSession | undefined;
  if (sessionId) {
    session = simulatedSessions.get(sessionId);
  } else if (simulatedSessions.size > 0) {
    session = Array.from(simulatedSessions.values())[0];
  }
  
  if (!session) {
    // Create a default session if none exists
    session = createSimulatedSession({
      type: 'node',
      name: 'Default Session',
      request: 'launch',
    });
  }

  const tid = threadId || 1;

  switch (action) {
    case 'continue':
      session.state = 'running';
      session.threads.find(t => t.id === tid)!.state = 'running';
      session.output.push({ type: 'info', message: 'Execution continued', timestamp: new Date() });
      break;

    case 'pause':
      session.state = 'paused';
      session.threads.find(t => t.id === tid)!.state = 'paused';
      session.output.push({ type: 'info', message: 'Execution paused', timestamp: new Date() });
      break;

    case 'stepOver':
      session.state = 'paused';
      session.currentLine++;
      session.output.push({ type: 'info', message: `Stepped over to line ${session.currentLine}`, timestamp: new Date() });
      break;

    case 'stepInto':
      session.state = 'paused';
      session.currentLine++;
      session.output.push({ type: 'info', message: `Stepped into at line ${session.currentLine}`, timestamp: new Date() });
      break;

    case 'stepOut':
      session.state = 'paused';
      // Simulate returning from current frame
      if (session.callStack.length > 1) {
        session.callStack.shift();
      }
      session.output.push({ type: 'info', message: 'Stepped out', timestamp: new Date() });
      break;

    case 'stepBack':
      session.state = 'paused';
      session.currentLine = Math.max(1, session.currentLine - 1);
      session.output.push({ type: 'info', message: `Stepped back to line ${session.currentLine}`, timestamp: new Date() });
      break;
  }

  return NextResponse.json({
    success: true,
    state: session.state,
    currentLine: session.currentLine,
  });
}

function handleBreakpointAction(body: BreakpointRequest) {
  const { action, sessionId, breakpoint, breakpointId } = body;
  
  // Find session
  let session: SimulatedSession | undefined;
  if (sessionId) {
    session = simulatedSessions.get(sessionId);
  } else if (simulatedSessions.size > 0) {
    session = Array.from(simulatedSessions.values())[0];
  }
  
  if (!session && action !== 'list') {
    // Create a default session if none exists
    session = createSimulatedSession({
      type: 'node',
      name: 'Default Session',
      request: 'launch',
    });
  }

  switch (action) {
    case 'set': {
      if (!breakpoint) {
        return NextResponse.json({ error: 'breakpoint required' }, { status: 400 });
      }
      
      const id = `bp-${++breakpointCounter}`;
      const bp = {
        id,
        path: breakpoint.source.path,
        line: breakpoint.line,
        enabled: true,
        verified: true,
        condition: breakpoint.condition,
        hitCondition: breakpoint.hitCondition,
        logMessage: breakpoint.logMessage,
      };
      
      session!.breakpoints.push(bp);
      session!.output.push({
        type: 'info',
        message: `Breakpoint set at ${bp.path}:${bp.line}`,
        timestamp: new Date(),
      });
      
      return NextResponse.json({ success: true, breakpoint: bp });
    }

    case 'remove': {
      if (!breakpointId) {
        return NextResponse.json({ error: 'breakpointId required' }, { status: 400 });
      }
      
      const index = session!.breakpoints.findIndex(bp => bp.id === breakpointId);
      if (index >= 0) {
        const removed = session!.breakpoints.splice(index, 1)[0];
        session!.output.push({
          type: 'info',
          message: `Breakpoint removed at ${removed.path}:${removed.line}`,
          timestamp: new Date(),
        });
        return NextResponse.json({ success: true });
      }
      
      return NextResponse.json({ error: 'Breakpoint not found' }, { status: 404 });
    }

    case 'toggle': {
      if (!breakpointId) {
        return NextResponse.json({ error: 'breakpointId required' }, { status: 400 });
      }
      
      const bp = session!.breakpoints.find(b => b.id === breakpointId);
      if (bp) {
        bp.enabled = !bp.enabled;
        return NextResponse.json({ success: true, enabled: bp.enabled });
      }
      
      return NextResponse.json({ error: 'Breakpoint not found' }, { status: 404 });
    }

    case 'list':
      return NextResponse.json({ breakpoints: session?.breakpoints || [] });

    default:
      return NextResponse.json({ error: 'Unknown breakpoint action' }, { status: 400 });
  }
}

function handleEvaluateAction(body: EvaluateRequest) {
  const { expression, sessionId } = body;
  
  // Find session
  let session: SimulatedSession | undefined;
  if (sessionId) {
    session = simulatedSessions.get(sessionId);
  } else if (simulatedSessions.size > 0) {
    session = Array.from(simulatedSessions.values())[0];
  }
  
  if (!session) {
    return NextResponse.json({ error: 'No active session' }, { status: 400 });
  }
  
  const result = evaluateExpression(expression, session.id);
  
  session.output.push({
    type: result.error ? 'error' : 'result',
    message: `${expression} = ${result.result}`,
    timestamp: new Date(),
  });
  
  return NextResponse.json({
    success: !result.error,
    result: result.result,
    type: result.type,
    error: result.error,
  });
}
