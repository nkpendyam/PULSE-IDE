'use client';

import React, { useState, useEffect, useRef } from 'react';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { Bot, Play, ChevronRight, CheckCircle, XCircle, Loader2, Trash2 } from 'lucide-react';

interface QuestProgressEvent {
  mission_id: string;
  phase: string;
  step_index: number;
  step_total: number;
  step_description: string;
  status: string;
  message: string;
}

interface LogEntry {
  timestamp: string;
  phase: string;
  message: string;
  status: 'running' | 'done' | 'failed';
}

export function AgentStreamPanel() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [currentPhase, setCurrentPhase] = useState<string>('idle');
  const [progressPercent, setProgressPercent] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let unlisten: UnlistenFn | null = null;

    listen<QuestProgressEvent>('quest-progress', (event) => {
      const p = event.payload;
      const now = new Date().toLocaleTimeString();

      setCurrentPhase(p.phase);
      if (p.step_total > 0) {
        setProgressPercent(Math.round((p.step_index / p.step_total) * 100));
      }

      setLogs(prev => [...prev, {
        timestamp: now,
        phase: p.phase,
        message: p.message || p.step_description,
        status: p.status === 'failed' ? 'failed' : p.status === 'done' ? 'done' : 'running',
      }]);
    }).then(fn => { unlisten = fn; });

    return () => { unlisten?.(); };
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [logs]);

  const clearLogs = () => {
    setLogs([]);
    setCurrentPhase('idle');
    setProgressPercent(0);
  };

  const statusIcon = (s: LogEntry['status']) => {
    if (s === 'done') return <CheckCircle size={12} className="text-green-400" />;
    if (s === 'failed') return <XCircle size={12} className="text-red-400" />;
    return <Loader2 size={12} className="text-blue-400 animate-spin" />;
  };

  return (
    <div className="h-full flex flex-col bg-[#0d1117]">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#30363d] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot size={18} className="text-[#8b949e]" />
          <h3 className="text-[#c9d1d9] font-medium text-sm">Agent Stream</h3>
        </div>
        <button onClick={clearLogs} className="text-[#8b949e] hover:text-[#c9d1d9]" title="Clear">
          <Trash2 size={14} />
        </button>
      </div>

      {/* Progress bar */}
      {currentPhase !== 'idle' && (
        <div className="px-4 py-2 border-b border-[#30363d]">
          <div className="flex items-center justify-between text-xs text-[#8b949e] mb-1">
            <span className="capitalize">{currentPhase}</span>
            <span>{progressPercent}%</span>
          </div>
          <div className="w-full h-1.5 bg-[#21262d] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#58a6ff] transition-all duration-300 rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Log stream */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-1 font-mono text-xs">
        {logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-[#8b949e]">
            <Play size={24} className="mb-2 opacity-40" />
            <p>No agent activity yet</p>
            <p className="text-[10px] mt-1">Run a quest from Mission Control to see live progress</p>
          </div>
        ) : (
          logs.map((entry, i) => (
            <div key={i} className="flex items-start gap-2 py-0.5">
              <span className="text-[#484f58] shrink-0">{entry.timestamp}</span>
              {statusIcon(entry.status)}
              <span className="text-[#8b949e]">
                <span className="text-[#58a6ff]">[{entry.phase}]</span>{' '}
                {entry.message}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
