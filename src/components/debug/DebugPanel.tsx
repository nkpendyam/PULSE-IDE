'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { 
  Play, Pause, StepInto, StepOver, StepOut, Square, 
  RefreshCw, Circle, CircleDot, Plus, Minus, ChevronRight, ChevronDown,
  Bug, Settings, File, Terminal
} from 'lucide-react';
import { useKyroStore } from '@/store/kyroStore';

interface Breakpoint {
  id: string;
  file: string;
  line: number;
  enabled: boolean;
  condition?: string;
  hitCount?: number;
  logMessage?: string;
}

interface StackFrame {
  id: number;
  name: string;
  file: string;
  line: number;
  column: number;
}

interface Variable {
  name: string;
  value: string;
  type: string;
  children?: Variable[];
}

interface DebugSession {
  id: string;
  status: 'idle' | 'running' | 'paused' | 'stopped';
  currentFrame?: StackFrame;
  callStack: StackFrame[];
  variables: Variable[];
  threads: Array<{ id: number; name: string; stopped: boolean }>;
}

interface DebugPanelProps {
  className?: string;
}

export function DebugPanel({ className = '' }: DebugPanelProps) {
  const [session, setSession] = useState<DebugSession>({
    id: '',
    status: 'idle',
    callStack: [],
    variables: [],
    threads: []
  });
  const [breakpoints, setBreakpoints] = useState<Breakpoint[]>([]);
  const [expandedVariables, setExpandedVariables] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'variables' | 'callstack' | 'breakpoints'>('variables');
  const [isLoading, setIsLoading] = useState(false);

  const { projectPath, openFile } = useKyroStore();

  // Start debugging
  const startDebug = useCallback(async () => {
    if (!projectPath) return;

    setIsLoading(true);
    try {
      const debugSession = await invoke<DebugSession>('debug_start', {
        projectPath,
        configuration: {
          type: 'auto', // Auto-detect based on project
          request: 'launch',
          name: 'Debug'
        }
      });
      setSession(debugSession);
    } catch (error) {
      console.error('Failed to start debug session:', error);
    } finally {
      setIsLoading(false);
    }
  }, [projectPath]);

  // Stop debugging
  const stopDebug = useCallback(async () => {
    try {
      await invoke('debug_stop', { sessionId: session.id });
      setSession(prev => ({ ...prev, status: 'stopped' }));
    } catch (error) {
      console.error('Failed to stop debug session:', error);
    }
  }, [session.id]);

  // Continue execution
  const continueDebug = useCallback(async () => {
    try {
      const result = await invoke<DebugSession>('debug_continue', { sessionId: session.id });
      setSession(result);
    } catch (error) {
      console.error('Failed to continue:', error);
    }
  }, [session.id]);

  // Pause execution
  const pauseDebug = useCallback(async () => {
    try {
      const result = await invoke<DebugSession>('debug_pause', { sessionId: session.id });
      setSession(result);
    } catch (error) {
      console.error('Failed to pause:', error);
    }
  }, [session.id]);

  // Step over
  const stepOver = useCallback(async () => {
    try {
      const result = await invoke<DebugSession>('debug_step_over', { sessionId: session.id });
      setSession(result);
    } catch (error) {
      console.error('Failed to step over:', error);
    }
  }, [session.id]);

  // Step into
  const stepInto = useCallback(async () => {
    try {
      const result = await invoke<DebugSession>('debug_step_into', { sessionId: session.id });
      setSession(result);
    } catch (error) {
      console.error('Failed to step into:', error);
    }
  }, [session.id]);

  // Step out
  const stepOut = useCallback(async () => {
    try {
      const result = await invoke<DebugSession>('debug_step_out', { sessionId: session.id });
      setSession(result);
    } catch (error) {
      console.error('Failed to step out:', error);
    }
  }, [session.id]);

  // Toggle breakpoint
  const toggleBreakpoint = useCallback(async (file: string, line: number) => {
    const existing = breakpoints.find(b => b.file === file && b.line === line);
    
    if (existing) {
      setBreakpoints(prev => prev.filter(b => b.id !== existing.id));
      await invoke('debug_remove_breakpoint', { sessionId: session.id, breakpointId: existing.id });
    } else {
      const bp: Breakpoint = {
        id: `${file}:${line}`,
        file,
        line,
        enabled: true
      };
      setBreakpoints(prev => [...prev, bp]);
      await invoke('debug_add_breakpoint', { 
        sessionId: session.id, 
        breakpoint: bp 
      });
    }
  }, [breakpoints, session.id]);

  // Set breakpoint condition
  const setBreakpointCondition = useCallback(async (bp: Breakpoint, condition: string) => {
    setBreakpoints(prev => prev.map(b => 
      b.id === bp.id ? { ...b, condition } : b
    ));
    await invoke('debug_set_breakpoint_condition', {
      sessionId: session.id,
      breakpointId: bp.id,
      condition
    });
  }, [session.id]);

  // Toggle expand variable
  const toggleVariable = (path: string) => {
    setExpandedVariables(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  // Render variable recursively
  const renderVariable = (variable: Variable, path: string = '', depth: number = 0) => {
    const hasChildren = variable.children && variable.children.length > 0;
    const isExpanded = expandedVariables.has(path + variable.name);

    return (
      <div key={path + variable.name}>
        <div 
          className="flex items-center py-0.5 px-2 hover:bg-[#21262d] cursor-pointer"
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
          onClick={() => hasChildren && toggleVariable(path + variable.name)}
        >
          {hasChildren ? (
            isExpanded ? <ChevronDown size={12} className="text-[#8b949e] mr-1" /> 
                       : <ChevronRight size={12} className="text-[#8b949e] mr-1" />
          ) : (
            <span className="w-3 mr-1" />
          )}
          <span className="text-[#79c0ff] text-xs">{variable.name}</span>
          <span className="text-[#8b949e] text-xs mx-1">=</span>
          <span className="text-[#a5d6ff] text-xs truncate">{variable.value}</span>
          <span className="text-[#6e7681] text-xs ml-auto">{variable.type}</span>
        </div>
        {hasChildren && isExpanded && (
          <div>
            {variable.children!.map(child => 
              renderVariable(child, path + variable.name + '.', depth + 1)
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`flex flex-col h-full bg-[#0d1117] ${className}`}>
      {/* Debug toolbar */}
      <div className="flex items-center gap-1 px-2 py-1 bg-[#161b22] border-b border-[#30363d]">
        {session.status === 'idle' || session.status === 'stopped' ? (
          <button
            onClick={startDebug}
            disabled={!projectPath || isLoading}
            className="p-1.5 rounded hover:bg-[#21262d] disabled:opacity-50 disabled:cursor-not-allowed"
            title="Start Debugging (F5)"
          >
            <Play size={14} className="text-[#3fb950]" />
          </button>
        ) : (
          <>
            {session.status === 'paused' ? (
              <button onClick={continueDebug} className="p-1.5 rounded hover:bg-[#21262d]" title="Continue (F5)">
                <Play size={14} className="text-[#3fb950]" />
              </button>
            ) : (
              <button onClick={pauseDebug} className="p-1.5 rounded hover:bg-[#21262d]" title="Pause">
                <Pause size={14} className="text-[#d29922]" />
              </button>
            )}
            <button onClick={stepOver} className="p-1.5 rounded hover:bg-[#21262d]" title="Step Over (F10)">
              <StepOver size={14} className="text-[#8b949e]" />
            </button>
            <button onClick={stepInto} className="p-1.5 rounded hover:bg-[#21262d]" title="Step Into (F11)">
              <StepInto size={14} className="text-[#8b949e]" />
            </button>
            <button onClick={stepOut} className="p-1.5 rounded hover:bg-[#21262d]" title="Step Out (Shift+F11)">
              <StepOut size={14} className="text-[#8b949e]" />
            </button>
            <button onClick={stopDebug} className="p-1.5 rounded hover:bg-[#21262d]" title="Stop (Shift+F5)">
              <Square size={14} className="text-[#f85149]" />
            </button>
          </>
        )}
        <div className="flex-1" />
        <button className="p-1.5 rounded hover:bg-[#21262d]" title="Settings">
          <Settings size={14} className="text-[#8b949e]" />
        </button>
      </div>

      {/* Status */}
      {session.status !== 'idle' && (
        <div className="flex items-center gap-2 px-3 py-1 text-xs border-b border-[#30363d]">
          <span className={`w-2 h-2 rounded-full ${
            session.status === 'running' ? 'bg-[#3fb950]' :
            session.status === 'paused' ? 'bg-[#d29922]' :
            'bg-[#f85149]'
          }`} />
          <span className="text-[#8b949e] capitalize">{session.status}</span>
          {session.currentFrame && (
            <span className="text-[#c9d1d9]">
              {session.currentFrame.name} at {session.currentFrame.file.split('/').pop()}:{session.currentFrame.line}
            </span>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-[#30363d]">
        {(['variables', 'callstack', 'breakpoints'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 text-xs capitalize ${
              activeTab === tab 
                ? 'text-[#c9d1d9] border-b-2 border-[#58a6ff]' 
                : 'text-[#8b949e] hover:text-[#c9d1d9]'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'variables' && (
          <div>
            {session.variables.length === 0 ? (
              <div className="p-4 text-center text-xs text-[#8b949e]">
                {session.status === 'idle' ? 'Start debugging to see variables' : 'No variables'}
              </div>
            ) : (
              session.variables.map(v => renderVariable(v))
            )}
          </div>
        )}

        {activeTab === 'callstack' && (
          <div>
            {session.callStack.length === 0 ? (
              <div className="p-4 text-center text-xs text-[#8b949e]">No call stack</div>
            ) : (
              session.callStack.map((frame, index) => (
                <div
                  key={frame.id}
                  onClick={() => {
                    openFile({ path: frame.file, content: '', language: '', isDirty: false });
                  }}
                  className={`flex items-center px-2 py-1 cursor-pointer hover:bg-[#21262d] ${
                    index === 0 ? 'bg-[#21262d]' : ''
                  }`}
                >
                  <span className="text-xs text-[#c9d1d9]">{frame.name}</span>
                  <span className="text-xs text-[#8b949e] ml-auto">
                    {frame.file.split('/').pop()}:{frame.line}
                  </span>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'breakpoints' && (
          <div>
            {breakpoints.length === 0 ? (
              <div className="p-4 text-center text-xs text-[#8b949e]">
                No breakpoints. Click in the gutter to add.
              </div>
            ) : (
              breakpoints.map(bp => (
                <div
                  key={bp.id}
                  className="flex items-center px-2 py-1 hover:bg-[#21262d]"
                >
                  <input
                    type="checkbox"
                    checked={bp.enabled}
                    onChange={() => setBreakpoints(prev => 
                      prev.map(b => b.id === bp.id ? { ...b, enabled: !b.enabled } : b)
                    )}
                    className="mr-2"
                  />
                  <CircleDot size={12} className="text-[#f85149] mr-2" />
                  <span className="text-xs text-[#c9d1d9] flex-1 truncate">
                    {bp.file.split('/').pop()}:{bp.line}
                  </span>
                  {bp.condition && (
                    <span className="text-xs text-[#d29922]" title={`Condition: ${bp.condition}`}>
                      if
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Debug console component
export function DebugConsole() {
  const [output, setOutput] = useState<Array<{ type: 'stdout' | 'stderr' | 'command'; text: string }>>([]);
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const executeCommand = async () => {
    if (!input.trim()) return;

    setOutput(prev => [...prev, { type: 'command', text: `> ${input}` }]);
    setHistory(prev => [...prev, input]);
    setHistoryIndex(-1);

    try {
      const result = await invoke<string>('debug_evaluate', { expression: input });
      setOutput(prev => [...prev, { type: 'stdout', text: result }]);
    } catch (error) {
      setOutput(prev => [...prev, { type: 'stderr', text: String(error) }]);
    }

    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      executeCommand();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length > 0) {
        const newIndex = historyIndex < history.length - 1 ? historyIndex + 1 : historyIndex;
        setHistoryIndex(newIndex);
        setInput(history[history.length - 1 - newIndex] || '');
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setInput(history[history.length - 1 - newIndex] || '');
      } else {
        setHistoryIndex(-1);
        setInput('');
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0d1117]">
      <div className="flex items-center px-2 py-1 bg-[#161b22] border-b border-[#30363d]">
        <Terminal size={14} className="text-[#8b949e] mr-2" />
        <span className="text-xs text-[#8b949e]">Debug Console</span>
      </div>
      
      <div className="flex-1 overflow-auto font-mono text-xs p-2">
        {output.map((item, index) => (
          <div
            key={index}
            className={`whitespace-pre-wrap ${
              item.type === 'stderr' ? 'text-[#f85149]' :
              item.type === 'command' ? 'text-[#58a6ff]' :
              'text-[#c9d1d9]'
            }`}
          >
            {item.text}
          </div>
        ))}
      </div>

      <div className="border-t border-[#30363d]">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Evaluate expression..."
          className="w-full px-2 py-1.5 bg-transparent text-[#c9d1d9] text-xs outline-none font-mono"
        />
      </div>
    </div>
  );
}
