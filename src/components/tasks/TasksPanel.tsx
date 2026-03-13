'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play, Square, Plus, Trash2, Terminal, ChevronDown, ChevronUp,
  Loader2, CheckCircle2, XCircle, Circle,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────

type TaskStatus = 'idle' | 'running' | 'success' | 'error';

interface Task {
  id: string;
  name: string;
  command: string;
  isCustom: boolean;
}

interface TaskRun {
  taskId: string;
  status: TaskStatus;
  logs: string[];
  exitCode?: number;
  startedAt?: number;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const DEMO_TASKS: Task[] = [
  { id: 'build', name: 'build', command: 'npm run build', isCustom: false },
  { id: 'dev', name: 'dev', command: 'npm run dev', isCustom: false },
  { id: 'test', name: 'test', command: 'npm run test', isCustom: false },
  { id: 'lint', name: 'lint', command: 'npm run lint', isCustom: false },
  { id: 'typecheck', name: 'typecheck', command: 'npm run typecheck', isCustom: false },
];

const LS_CUSTOM_KEY = 'kyro-custom-tasks';

function loadCustomTasks(): Task[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(LS_CUSTOM_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function saveCustomTasks(tasks: Task[]) {
  localStorage.setItem(LS_CUSTOM_KEY, JSON.stringify(tasks));
}

async function invokeCommand(command: string): Promise<string> {
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const result = await invoke<string>('run_terminal_command', { command });
    return result ?? '';
  } catch {
    return '';
  }
}

function StatusDot({ status }: { status: TaskStatus }) {
  if (status === 'running') {
    return <Loader2 size={12} className="text-yellow-400 animate-spin" />;
  }
  if (status === 'success') {
    return <CheckCircle2 size={12} className="text-[#3fb950]" />;
  }
  if (status === 'error') {
    return <XCircle size={12} className="text-[#f85149]" />;
  }
  return <Circle size={12} className="text-[#484f58]" />;
}

// ── Task Row ───────────────────────────────────────────────────────────────────

interface TaskRowProps {
  task: Task;
  run: TaskRun | undefined;
  onRun: (task: Task) => void;
  onStop: (taskId: string) => void;
  onDelete: (taskId: string) => void;
  onClearLog: (taskId: string) => void;
}

function TaskRow({ task, run, onRun, onStop, onDelete, onClearLog }: TaskRowProps) {
  const [expanded, setExpanded] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const status: TaskStatus = run?.status ?? 'idle';

  useEffect(() => {
    if (expanded && logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [run?.logs, expanded]);

  useEffect(() => {
    if (run && run.status === 'running') setExpanded(true);
  }, [run?.status]);

  return (
    <div className="border-b border-[#21262d] last:border-0">
      <div className="flex items-center gap-2 px-3 py-2 hover:bg-[#161b22] transition-colors">
        <StatusDot status={status} />
        <div className="flex-1 min-w-0">
          <span className="text-sm text-[#c9d1d9] font-medium">{task.name}</span>
          <span className="ml-2 text-xs text-[#484f58] font-mono">{task.command}</span>
        </div>
        {run && run.status !== 'idle' && (
          <button
            onClick={() => setExpanded(v => !v)}
            className="p-1 rounded text-[#8b949e] hover:text-[#c9d1d9] hover:bg-[#21262d]"
            title={expanded ? 'Collapse logs' : 'Expand logs'}
          >
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        )}
        {status === 'running' ? (
          <button
            onClick={() => onStop(task.id)}
            className="flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-[#f85149]/20 hover:bg-[#f85149]/30 text-[#f85149] border border-[#f85149]/30 transition-colors"
          >
            <Square size={10} />
            Stop
          </button>
        ) : (
          <button
            onClick={() => onRun(task)}
            className="flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-[#238636]/20 hover:bg-[#238636]/40 text-[#3fb950] border border-[#238636]/30 transition-colors"
          >
            <Play size={10} />
            Run
          </button>
        )}
        {task.isCustom && (
          <button
            onClick={() => onDelete(task.id)}
            className="p-1 rounded text-[#484f58] hover:text-[#f85149] hover:bg-[#f85149]/10 transition-colors"
            title="Remove task"
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>
      {expanded && run && (
        <div className="mx-3 mb-2 rounded border border-[#30363d] overflow-hidden">
          <div className="flex items-center justify-between px-2 py-1 bg-[#161b22] border-b border-[#30363d]">
            <span className="text-[10px] text-[#8b949e] font-mono">
              {status === 'running' ? 'Running…' : `Exited with code ${run.exitCode ?? 0}`}
            </span>
            <button
              onClick={() => onClearLog(task.id)}
              className="text-[10px] text-[#484f58] hover:text-[#8b949e]"
            >
              Clear
            </button>
          </div>
          <div
            ref={logRef}
            className="max-h-40 overflow-y-auto p-2 bg-[#0d1117] font-mono text-[11px] text-[#8b949e] space-y-0.5"
          >
            {run.logs.length === 0 ? (
              <span className="text-[#484f58] italic">No output yet…</span>
            ) : (
              run.logs.map((line, i) => (
                <div key={i} className="whitespace-pre-wrap break-all leading-relaxed">{line}</div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function TasksPanel() {
  const [npmTasks, setNpmTasks] = useState<Task[]>(DEMO_TASKS);
  const [customTasks, setCustomTasks] = useState<Task[]>([]);
  const [runs, setRuns] = useState<Record<string, TaskRun>>({});
  const [newName, setNewName] = useState('');
  const [newCommand, setNewCommand] = useState('');
  const abortRefs = useRef<Record<string, boolean>>({});

  // Load custom tasks and try to parse package.json scripts
  useEffect(() => {
    setCustomTasks(loadCustomTasks());
    (async () => {
      const output = await invokeCommand('cat package.json');
      if (!output) return;
      try {
        const pkg = JSON.parse(output);
        const scripts: Record<string, string> = pkg.scripts ?? {};
        const tasks: Task[] = Object.entries(scripts).map(([name]) => ({
          id: name,
          name,
          command: `npm run ${name}`,
          isCustom: false,
        }));
        if (tasks.length > 0) setNpmTasks(tasks);
      } catch {
        /* keep demo tasks */
      }
    })();
  }, []);

  const allTasks = [...npmTasks, ...customTasks];
  const runningCount = Object.values(runs).filter(r => r.status === 'running').length;

  function setRunState(taskId: string, updater: (prev: TaskRun) => TaskRun) {
    setRuns(prev => {
      const current: TaskRun = prev[taskId] ?? { taskId, status: 'idle', logs: [] };
      return { ...prev, [taskId]: updater(current) };
    });
  }

  const handleRun = useCallback(async (task: Task) => {
    if (runs[task.id]?.status === 'running') return;
    abortRefs.current[task.id] = false;
    setRunState(task.id, () => ({
      taskId: task.id,
      status: 'running',
      logs: [`$ ${task.command}`],
      startedAt: Date.now(),
    }));

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const output = await invoke<string>('run_terminal_command', { command: task.command });
      if (abortRefs.current[task.id]) return;
      const lines = (output ?? '').split('\n').filter(Boolean);
      setRunState(task.id, prev => ({
        ...prev,
        status: 'success',
        logs: [...prev.logs, ...lines, `✓ Completed in ${((Date.now() - (prev.startedAt ?? 0)) / 1000).toFixed(1)}s`],
        exitCode: 0,
      }));
    } catch (err: unknown) {
      if (abortRefs.current[task.id]) return;
      const msg = err instanceof Error ? err.message : String(err);
      // Tauri not available — simulate a short run with mock output
      const mockLines = [
        `[mock] Running: ${task.command}`,
        `[mock] Tauri not available – showing simulated output`,
        `[mock] Done.`,
      ];
      setRunState(task.id, prev => ({
        ...prev,
        status: msg.includes('not found') || msg.includes('exit') ? 'error' : 'success',
        logs: [...prev.logs, ...mockLines],
        exitCode: 0,
      }));
    }
  }, [runs]);

  function handleStop(taskId: string) {
    abortRefs.current[taskId] = true;
    setRunState(taskId, prev => ({ ...prev, status: 'idle', exitCode: undefined }));
  }

  function handleClearLog(taskId: string) {
    setRunState(taskId, prev => ({ ...prev, logs: [], status: 'idle', exitCode: undefined }));
  }

  function handleDeleteCustom(taskId: string) {
    const updated = customTasks.filter(t => t.id !== taskId);
    setCustomTasks(updated);
    saveCustomTasks(updated);
  }

  function handleAddCustom() {
    if (!newName.trim() || !newCommand.trim()) return;
    const task: Task = {
      id: `custom-${Date.now()}`,
      name: newName.trim(),
      command: newCommand.trim(),
      isCustom: true,
    };
    const updated = [...customTasks, task];
    setCustomTasks(updated);
    saveCustomTasks(updated);
    setNewName('');
    setNewCommand('');
  }

  function handleClearAll() {
    setRuns(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(k => {
        if (next[k].status !== 'running') delete next[k];
      });
      return next;
    });
  }

  const inputCls =
    'bg-[#161b22] border border-[#30363d] rounded px-2 py-1.5 text-xs text-[#c9d1d9] placeholder-[#484f58] focus:outline-none focus:border-[#58a6ff]';

  return (
    <div className="flex flex-col h-full bg-[#0d1117] text-[#c9d1d9]">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#30363d] shrink-0">
        <div className="flex items-center gap-2">
          <Terminal size={14} className="text-[#58a6ff]" />
          <span className="text-xs font-semibold uppercase tracking-wide">Tasks</span>
          {runningCount > 0 && (
            <span className="bg-yellow-500/20 text-yellow-400 text-[10px] px-1.5 py-0.5 rounded-full border border-yellow-400/20">
              {runningCount} running
            </span>
          )}
        </div>
        <button
          onClick={handleClearAll}
          className="text-xs px-2 py-1 rounded text-[#8b949e] hover:text-[#c9d1d9] hover:bg-[#21262d] transition-colors"
        >
          Clear done
        </button>
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto">
        {allTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-24 text-[#484f58]">
            <Terminal size={20} className="opacity-40 mb-1" />
            <p className="text-xs">No tasks found.</p>
          </div>
        ) : (
          allTasks.map(task => (
            <TaskRow
              key={task.id}
              task={task}
              run={runs[task.id]}
              onRun={handleRun}
              onStop={handleStop}
              onDelete={handleDeleteCustom}
              onClearLog={handleClearLog}
            />
          ))
        )}
      </div>

      {/* Add custom task */}
      <div className="border-t border-[#30363d] px-3 py-2 shrink-0 space-y-2">
        <span className="text-[10px] text-[#8b949e] font-semibold uppercase tracking-wide">Add Custom Task</span>
        <div className="flex gap-2">
          <input
            className={`${inputCls} flex-[0.4]`}
            placeholder="Name"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddCustom()}
          />
          <input
            className={`${inputCls} flex-1`}
            placeholder="Command"
            value={newCommand}
            onChange={e => setNewCommand(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddCustom()}
          />
          <button
            onClick={handleAddCustom}
            disabled={!newName.trim() || !newCommand.trim()}
            className="px-2 py-1.5 rounded bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] text-[#c9d1d9] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="Add task"
          >
            <Plus size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}
