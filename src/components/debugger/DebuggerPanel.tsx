'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Play,
  Pause,
  ArrowDownToLine,
  SkipForward,
  ArrowUpFromLine,
  Square,
  Plus,
  Trash2,
  RefreshCw,
  ChevronRight,
  ChevronDown,
  Pencil,
  Terminal,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// TYPES
// ============================================================================

interface Variable {
  name: string;
  value: string;
  type: string;
  variablesReference: number;
  expandable: boolean;
  children?: Variable[];
  isLoading?: boolean;
}

interface StackFrame {
  id: number;
  name: string;
  source?: { name?: string; path?: string };
  line: number;
  column: number;
}

interface Breakpoint {
  id: string;
  source?: { path: string; name?: string };
  line: number;
  enabled: boolean;
  verified: boolean;
  condition?: string;
  hitCondition?: string;
  logMessage?: string;
}

interface WatchExpression {
  id: string;
  expression: string;
  value: string;
  type: string;
  error?: string;
}

interface DebugSession {
  id: string;
  name: string;
  type: string;
  state: 'running' | 'paused' | 'stopped' | 'stepping';
}

interface ConsoleMessage {
  id: string;
  type: 'info' | 'error' | 'result' | 'input';
  message: string;
  timestamp: Date;
}

// ============================================================================
// DAP CLIENT HOOK
// ============================================================================

function useDAPClient() {
  const [session, setSession] = useState<DebugSession | null>(null);
  const [threads, setThreads] = useState<Array<{ id: number; name: string; state: string }>>([]);
  const [activeThreadId, setActiveThreadId] = useState<number>(1);
  const [callStack, setCallStack] = useState<StackFrame[]>([]);
  const [variables, setVariables] = useState<Map<number, Variable[]>>(new Map());
  const [breakpoints, setBreakpoints] = useState<Breakpoint[]>([]);
  const [watchExpressions, setWatchExpressions] = useState<WatchExpression[]>([]);
  const [consoleMessages, setConsoleMessages] = useState<ConsoleMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create a new debug session
  const createSession = useCallback(async (config: {
    type: string;
    name: string;
    request: 'launch' | 'attach';
    program?: string;
    stopOnEntry?: boolean;
  }) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/debug', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          config: {
            ...config,
            type: config.type || 'node',
            name: config.name || 'Debug Session',
            request: config.request || 'launch',
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create session');
      }

      setSession({
        id: data.session.id,
        name: data.session.name,
        type: data.session.type,
        state: data.session.state,
      });

      addConsoleMessage('info', `Debug session started: ${data.session.name}`);
      return data.session;
    } catch (err) {
      const message = (err as Error).message;
      setError(message);
      addConsoleMessage('error', `Failed to create session: ${message}`);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Terminate session
  const terminateSession = useCallback(async () => {
    if (!session) return;

    try {
      await fetch('/api/debug', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'terminate',
          sessionId: session.id,
        }),
      });

      addConsoleMessage('info', 'Debug session terminated');
      setSession(null);
      setCallStack([]);
      setVariables(new Map());
      setThreads([]);
    } catch (err) {
      addConsoleMessage('error', `Failed to terminate: ${(err as Error).message}`);
    }
  }, [session]);

  // Fetch threads
  const fetchThreads = useCallback(async () => {
    if (!session) return;

    try {
      const response = await fetch(`/api/debug?action=threads&sessionId=${session.id}`);
      const data = await response.json();
      setThreads(data.threads || []);
    } catch (err) {
      console.error('Failed to fetch threads:', err);
    }
  }, [session]);

  // Fetch call stack
  const fetchCallStack = useCallback(async (threadId?: number) => {
    if (!session) return;

    const tid = threadId || activeThreadId;

    try {
      const response = await fetch(`/api/debug?action=stackTrace&sessionId=${session.id}`);
      const data = await response.json();
      setCallStack(data.stackFrames || []);
    } catch (err) {
      console.error('Failed to fetch call stack:', err);
    }
  }, [session, activeThreadId]);

  // Fetch variables
  const fetchVariables = useCallback(async (variablesReference: number): Promise<Variable[]> => {
    if (!session) return [];

    try {
      const response = await fetch(
        `/api/debug?action=variables&sessionId=${session.id}&variablesReference=${variablesReference}`
      );
      const data = await response.json();
      
      const vars: Variable[] = (data.variables || []).map((v: { name: string; value: string; type?: string; variablesReference?: number }) => ({
        name: v.name,
        value: v.value,
        type: v.type || 'unknown',
        variablesReference: v.variablesReference || 0,
        expandable: (v.variablesReference || 0) > 0,
      }));

      setVariables(prev => new Map(prev).set(variablesReference, vars));
      return vars;
    } catch (err) {
      console.error('Failed to fetch variables:', err);
      return [];
    }
  }, [session]);

  // Execution control
  const continueExecution = useCallback(async () => {
    if (!session) return;
    setIsLoading(true);

    try {
      const response = await fetch('/api/debug', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'continue',
          sessionId: session.id,
          threadId: activeThreadId,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setSession(prev => prev ? { ...prev, state: 'running' } : null);
        addConsoleMessage('info', 'Execution continued');
      }
    } catch (err) {
      addConsoleMessage('error', `Continue failed: ${(err as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  }, [session, activeThreadId]);

  const pauseExecution = useCallback(async () => {
    if (!session) return;
    setIsLoading(true);

    try {
      const response = await fetch('/api/debug', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'pause',
          sessionId: session.id,
          threadId: activeThreadId,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setSession(prev => prev ? { ...prev, state: 'paused' } : null);
        addConsoleMessage('info', 'Execution paused');
        fetchCallStack();
        fetchVariables(1000);
      }
    } catch (err) {
      addConsoleMessage('error', `Pause failed: ${(err as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  }, [session, activeThreadId, fetchCallStack, fetchVariables]);

  const stepOver = useCallback(async () => {
    if (!session) return;
    setIsLoading(true);

    try {
      const response = await fetch('/api/debug', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'stepOver',
          sessionId: session.id,
          threadId: activeThreadId,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setSession(prev => prev ? { ...prev, state: 'paused' } : null);
        addConsoleMessage('info', `Stepped over to line ${data.currentLine}`);
        fetchCallStack();
        fetchVariables(1000);
      }
    } catch (err) {
      addConsoleMessage('error', `Step over failed: ${(err as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  }, [session, activeThreadId, fetchCallStack, fetchVariables]);

  const stepInto = useCallback(async () => {
    if (!session) return;
    setIsLoading(true);

    try {
      const response = await fetch('/api/debug', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'stepInto',
          sessionId: session.id,
          threadId: activeThreadId,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setSession(prev => prev ? { ...prev, state: 'paused' } : null);
        addConsoleMessage('info', `Stepped into at line ${data.currentLine}`);
        fetchCallStack();
        fetchVariables(1000);
      }
    } catch (err) {
      addConsoleMessage('error', `Step into failed: ${(err as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  }, [session, activeThreadId, fetchCallStack, fetchVariables]);

  const stepOut = useCallback(async () => {
    if (!session) return;
    setIsLoading(true);

    try {
      const response = await fetch('/api/debug', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'stepOut',
          sessionId: session.id,
          threadId: activeThreadId,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setSession(prev => prev ? { ...prev, state: 'paused' } : null);
        addConsoleMessage('info', 'Stepped out');
        fetchCallStack();
        fetchVariables(1000);
      }
    } catch (err) {
      addConsoleMessage('error', `Step out failed: ${(err as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  }, [session, activeThreadId, fetchCallStack, fetchVariables]);

  // Breakpoint management
  const setBreakpoint = useCallback(async (path: string, line: number, options?: {
    condition?: string;
    hitCondition?: string;
    logMessage?: string;
  }) => {
    try {
      const response = await fetch('/api/debug', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'set',
          sessionId: session?.id,
          breakpoint: {
            source: { path },
            line,
            ...options,
          },
        }),
      });

      const data = await response.json();
      if (data.success) {
        setBreakpoints(prev => [...prev, data.breakpoint]);
        addConsoleMessage('info', `Breakpoint set at ${path}:${line}`);
      }
      return data.breakpoint;
    } catch (err) {
      addConsoleMessage('error', `Failed to set breakpoint: ${(err as Error).message}`);
      throw err;
    }
  }, [session]);

  const toggleBreakpoint = useCallback(async (breakpointId: string) => {
    try {
      const response = await fetch('/api/debug', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'toggle',
          sessionId: session?.id,
          breakpointId,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setBreakpoints(prev =>
          prev.map(bp => (bp.id === breakpointId ? { ...bp, enabled: data.enabled } : bp))
        );
      }
    } catch (err) {
      addConsoleMessage('error', `Failed to toggle breakpoint: ${(err as Error).message}`);
    }
  }, [session]);

  const removeBreakpoint = useCallback(async (breakpointId: string) => {
    try {
      const response = await fetch('/api/debug', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'remove',
          sessionId: session?.id,
          breakpointId,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setBreakpoints(prev => prev.filter(bp => bp.id !== breakpointId));
      }
    } catch (err) {
      addConsoleMessage('error', `Failed to remove breakpoint: ${(err as Error).message}`);
    }
  }, [session]);

  // Expression evaluation
  const evaluateExpression = useCallback(async (expression: string): Promise<{ result: string; type: string; error?: string }> => {
    try {
      const response = await fetch('/api/debug', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'evaluate',
          expression,
          sessionId: session?.id,
        }),
      });

      const data = await response.json();
      return {
        result: data.result,
        type: data.type,
        error: data.error,
      };
    } catch (err) {
      return {
        result: 'Error',
        type: 'error',
        error: (err as Error).message,
      };
    }
  }, [session]);

  // Add watch expression
  const addWatchExpression = useCallback(async (expression: string) => {
    const id = `watch-${Date.now()}`;
    
    // Add immediately with loading state
    setWatchExpressions(prev => [
      ...prev,
      { id, expression, value: '...', type: 'loading' },
    ]);

    // Evaluate
    const result = await evaluateExpression(expression);
    
    setWatchExpressions(prev =>
      prev.map(w =>
        w.id === id
          ? { ...w, value: result.result, type: result.type, error: result.error }
          : w
      )
    );
  }, [evaluateExpression]);

  const removeWatchExpression = useCallback((id: string) => {
    setWatchExpressions(prev => prev.filter(w => w.id !== id));
  }, []);

  // Console management
  const addConsoleMessage = useCallback((type: ConsoleMessage['type'], message: string) => {
    setConsoleMessages(prev => [
      ...prev.slice(-99), // Keep last 100 messages
      { id: `msg-${Date.now()}`, type, message, timestamp: new Date() },
    ]);
  }, []);

  // Initialize with a default session
  useEffect(() => {
    if (!session) {
      createSession({
        type: 'node',
        name: 'Debug Session',
        request: 'launch',
        stopOnEntry: true,
      }).then(() => {
        // Fetch initial data
        setTimeout(() => {
          fetchCallStack();
          fetchVariables(1000);
        }, 100);
      }).catch(console.error);
    }
  }, [session, createSession, fetchCallStack, fetchVariables]);

  // Refresh data when session state changes
  useEffect(() => {
    if (session?.state === 'paused') {
      fetchThreads();
      fetchCallStack();
      fetchVariables(1000);
    }
  }, [session?.state, fetchThreads, fetchCallStack, fetchVariables]);

  return {
    session,
    threads,
    activeThreadId,
    callStack,
    variables,
    breakpoints,
    watchExpressions,
    consoleMessages,
    isLoading,
    error,
    createSession,
    terminateSession,
    setActiveThreadId,
    continueExecution,
    pauseExecution,
    stepOver,
    stepInto,
    stepOut,
    setBreakpoint,
    toggleBreakpoint,
    removeBreakpoint,
    addWatchExpression,
    removeWatchExpression,
    evaluateExpression,
    addConsoleMessage,
    fetchVariables,
  };
}

// ============================================================================
// VARIABLE TREE COMPONENT
// ============================================================================

function VariableTree({
  variable,
  depth = 0,
  onExpand,
  expandedVars,
  toggleExpand,
}: {
  variable: Variable;
  depth?: number;
  onExpand: (ref: number) => Promise<Variable[]>;
  expandedVars: Set<string>;
  toggleExpand: (id: string, ref: number) => void;
}) {
  const [children, setChildren] = useState<Variable[]>(variable.children || []);
  const [isLoading, setIsLoading] = useState(false);
  const expanded = expandedVars.has(`${variable.name}-${depth}`);

  const handleExpand = async () => {
    if (variable.expandable && !expanded) {
      toggleExpand(`${variable.name}-${depth}`, variable.variablesReference);
      setIsLoading(true);
      const newChildren = await onExpand(variable.variablesReference);
      setChildren(newChildren);
      setIsLoading(false);
    } else {
      toggleExpand(`${variable.name}-${depth}`, variable.variablesReference);
    }
  };

  return (
    <div className="font-mono text-sm">
      <div
        className={cn(
          'flex items-center gap-1 py-0.5 px-1 hover:bg-accent rounded cursor-pointer',
          depth > 0 && 'ml-4'
        )}
        onClick={handleExpand}
      >
        {variable.expandable ? (
          isLoading ? (
            <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
          ) : expanded ? (
            <ChevronDown className="h-3 w-3 shrink-0" />
          ) : (
            <ChevronRight className="h-3 w-3 shrink-0" />
          )
        ) : (
          <span className="w-3" />
        )}
        <span className="text-blue-500 dark:text-blue-400">{variable.name}</span>
        <span className="text-muted-foreground">:</span>
        <span className="text-green-600 dark:text-green-400">{variable.type}</span>
        <span className="text-muted-foreground mx-1">=</span>
        <span className="text-orange-600 dark:text-orange-400 truncate">
          {variable.value}
        </span>
      </div>
      {expanded && children.length > 0 && (
        <div>
          {children.map((child, i) => (
            <VariableTree
              key={`${child.name}-${i}`}
              variable={child}
              depth={depth + 1}
              onExpand={onExpand}
              expandedVars={expandedVars}
              toggleExpand={toggleExpand}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// WATCH EXPRESSIONS COMPONENT
// ============================================================================

function WatchExpressionsPanel({
  expressions,
  onAdd,
  onRemove,
  isLoading,
}: {
  expressions: WatchExpression[];
  onAdd: (expression: string) => void;
  onRemove: (id: string) => void;
  isLoading: boolean;
}) {
  const [newExpression, setNewExpression] = useState('');

  const handleAdd = () => {
    if (newExpression.trim()) {
      onAdd(newExpression.trim());
      setNewExpression('');
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          placeholder="Add watch expression..."
          value={newExpression}
          onChange={(e) => setNewExpression(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          className="h-8 text-sm"
        />
        <Button size="sm" variant="outline" onClick={handleAdd} disabled={isLoading}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <div className="space-y-1">
        {expressions.map((exp) => (
          <div
            key={exp.id}
            className={cn(
              'flex items-center justify-between p-1 hover:bg-accent rounded font-mono text-sm',
              exp.error && 'text-red-500'
            )}
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className="text-blue-500 truncate">{exp.expression}</span>
              <span className="text-muted-foreground">=</span>
              <span className={cn('text-orange-600 truncate', exp.error && 'text-red-500')}>
                {exp.error || exp.value}
              </span>
              <Badge variant="outline" className="text-xs shrink-0">{exp.type}</Badge>
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 shrink-0"
              onClick={() => onRemove(exp.id)}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// CALL STACK COMPONENT
// ============================================================================

function CallStackPanel({
  frames,
  activeThreadId,
  threads,
  onThreadChange,
}: {
  frames: StackFrame[];
  activeThreadId: number;
  threads: Array<{ id: number; name: string; state: string }>;
  onThreadChange: (id: number) => void;
}) {
  return (
    <div className="space-y-2">
      {threads.length > 1 && (
        <div className="flex gap-2 mb-2">
          <select
            value={activeThreadId}
            onChange={(e) => onThreadChange(parseInt(e.target.value, 10))}
            className="text-xs bg-background border rounded px-2 py-1"
          >
            {threads.map(t => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.state})
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="space-y-1">
        {frames.length === 0 ? (
          <div className="text-sm text-muted-foreground p-2">No call stack available</div>
        ) : (
          frames.map((frame, index) => (
            <div
              key={frame.id}
              className={cn(
                'flex items-center gap-2 p-2 text-sm hover:bg-accent rounded cursor-pointer',
                index === 0 && 'bg-accent'
              )}
            >
              <Badge variant={index === 0 ? 'default' : 'outline'} className="text-xs">
                {index + 1}
              </Badge>
              <span className="font-medium">{frame.name}</span>
              <span className="text-muted-foreground truncate">
                {frame.source?.name || 'unknown'}:{frame.line}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ============================================================================
// BREAKPOINTS PANEL
// ============================================================================

function BreakpointsPanel({
  breakpoints,
  onToggle,
  onRemove,
}: {
  breakpoints: Breakpoint[];
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="space-y-2">
      {breakpoints.length === 0 ? (
        <div className="text-sm text-muted-foreground p-2">No breakpoints set</div>
      ) : (
        breakpoints.map((bp) => (
          <div
            key={bp.id}
            className={cn(
              'flex items-center gap-2 p-2 text-sm hover:bg-accent rounded',
              !bp.enabled && 'opacity-50'
            )}
          >
            <input
              type="checkbox"
              checked={bp.enabled}
              onChange={() => onToggle(bp.id)}
              className="h-4 w-4"
            />
            <div className="flex-1">
              <div className="flex items-center gap-1">
                {bp.verified ? (
                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                ) : (
                  <AlertCircle className="h-3 w-3 text-yellow-500" />
                )}
                <span className="font-mono">
                  {bp.source?.path?.split('/').pop()}:{bp.line}
                </span>
              </div>
              {bp.condition && (
                <div className="text-xs text-muted-foreground">if: {bp.condition}</div>
              )}
              {bp.logMessage && (
                <div className="text-xs text-muted-foreground">log: {bp.logMessage}</div>
              )}
            </div>
            <Button size="icon" variant="ghost" className="h-6 w-6">
              <Pencil className="h-3 w-3" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              onClick={() => onRemove(bp.id)}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        ))
      )}
    </div>
  );
}

// ============================================================================
// DEBUG CONSOLE COMPONENT
// ============================================================================

function DebugConsole({
  messages,
  onEvaluate,
}: {
  messages: ConsoleMessage[];
  onEvaluate: (expression: string) => Promise<{ result: string; type: string; error?: string }>;
}) {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      const result = await onEvaluate(input.trim());
      console.log('Evaluated:', result);
      setInput('');
    }
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1" ref={scrollRef}>
        <div className="p-2 space-y-1">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                'text-sm font-mono',
                msg.type === 'error' && 'text-red-500',
                msg.type === 'info' && 'text-blue-500',
                msg.type === 'result' && 'text-green-600',
                msg.type === 'input' && 'text-muted-foreground'
              )}
            >
              <span className="text-muted-foreground mr-2">
                [{msg.timestamp.toLocaleTimeString()}]
              </span>
              {msg.message}
            </div>
          ))}
        </div>
      </ScrollArea>
      <form onSubmit={handleSubmit} className="p-2 border-t">
        <div className="flex gap-2">
          <span className="text-muted-foreground font-mono">&gt;</span>
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Evaluate expression..."
            className="h-8 text-sm font-mono border-0 shadow-none focus-visible:ring-0 px-0"
          />
        </div>
      </form>
    </div>
  );
}

// ============================================================================
// MAIN DEBUGGER PANEL
// ============================================================================

export function DebuggerPanel() {
  const {
    session,
    threads,
    activeThreadId,
    callStack,
    variables,
    breakpoints,
    watchExpressions,
    consoleMessages,
    isLoading,
    terminateSession,
    setActiveThreadId,
    continueExecution,
    pauseExecution,
    stepOver,
    stepInto,
    stepOut,
    toggleBreakpoint,
    removeBreakpoint,
    addWatchExpression,
    removeWatchExpression,
    evaluateExpression,
    fetchVariables,
  } = useDAPClient();

  const [activeTab, setActiveTab] = useState('variables');
  const [expandedVars, setExpandedVars] = useState<Set<string>>(new Set());

  const isPaused = session?.state === 'paused';
  const isRunning = session?.state === 'running';

  const toggleVarExpand = useCallback((id: string, _ref: number) => {
    setExpandedVars(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const localVariables = variables.get(1000) || [];

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="py-3 px-4 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-medium">Visual Debugger</CardTitle>
            {session && (
              <Badge variant={isPaused ? 'default' : 'outline'} className="text-xs">
                {session.state}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            {isRunning ? (
              <Button size="sm" variant="outline" onClick={pauseExecution} disabled={isLoading}>
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pause className="h-4 w-4" />}
              </Button>
            ) : (
              <Button size="sm" variant={isPaused ? 'default' : 'outline'} onClick={continueExecution} disabled={isLoading || !isPaused}>
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              </Button>
            )}
            <Button size="sm" variant="outline" disabled={!isPaused || isLoading} onClick={stepOver}>
              <SkipForward className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="outline" disabled={!isPaused || isLoading} onClick={stepInto}>
              <ArrowDownToLine className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="outline" disabled={!isPaused || isLoading} onClick={stepOut}>
              <ArrowUpFromLine className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="outline" onClick={terminateSession} disabled={!session}>
              <Square className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="outline" disabled={!isPaused || isLoading}>
              <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 p-0 overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          <TabsList className="w-full justify-start rounded-none border-b px-2">
            <TabsTrigger value="variables" className="text-xs">Variables</TabsTrigger>
            <TabsTrigger value="watch" className="text-xs">Watch</TabsTrigger>
            <TabsTrigger value="callstack" className="text-xs">Call Stack</TabsTrigger>
            <TabsTrigger value="breakpoints" className="text-xs">Breakpoints</TabsTrigger>
            <TabsTrigger value="console" className="text-xs">
              <Terminal className="h-3 w-3 mr-1" />
              Console
            </TabsTrigger>
          </TabsList>
          <ScrollArea className="flex-1">
            <TabsContent value="variables" className="p-2 m-0">
              <Accordion type="multiple" defaultValue={['local']}>
                <AccordionItem value="local">
                  <AccordionTrigger className="text-xs py-2">Local</AccordionTrigger>
                  <AccordionContent>
                    {localVariables.length === 0 ? (
                      <div className="text-sm text-muted-foreground">No local variables</div>
                    ) : (
                      localVariables.map((v, i) => (
                        <VariableTree
                          key={`${v.name}-${i}`}
                          variable={v}
                          onExpand={fetchVariables}
                          expandedVars={expandedVars}
                          toggleExpand={toggleVarExpand}
                        />
                      ))
                    )}
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="global">
                  <AccordionTrigger className="text-xs py-2">Global</AccordionTrigger>
                  <AccordionContent>
                    <div className="text-sm text-muted-foreground">No global variables</div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </TabsContent>
            <TabsContent value="watch" className="p-2 m-0">
              <WatchExpressionsPanel
                expressions={watchExpressions}
                onAdd={addWatchExpression}
                onRemove={removeWatchExpression}
                isLoading={isLoading}
              />
            </TabsContent>
            <TabsContent value="callstack" className="p-2 m-0">
              <CallStackPanel
                frames={callStack}
                activeThreadId={activeThreadId}
                threads={threads}
                onThreadChange={setActiveThreadId}
              />
            </TabsContent>
            <TabsContent value="breakpoints" className="p-2 m-0">
              <BreakpointsPanel
                breakpoints={breakpoints}
                onToggle={toggleBreakpoint}
                onRemove={removeBreakpoint}
              />
            </TabsContent>
            <TabsContent value="console" className="p-0 m-0 h-64">
              <DebugConsole messages={consoleMessages} onEvaluate={evaluateExpression} />
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </CardContent>
    </Card>
  );
}

export default DebuggerPanel;
