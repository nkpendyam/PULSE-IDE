'use client';

import React, {
  useState, useEffect, useRef, useCallback, useMemo,
} from 'react';
import { Monitor, Trash2, Copy, Lock, Unlock, ChevronDown } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogLine {
  id: number;
  timestamp: string;
  level: LogLevel;
  message: string;
}

type ChannelName = 'Build' | 'Test' | 'Lint' | 'Extension Host' | 'AI';

const CHANNELS: ChannelName[] = ['Build', 'Test', 'Lint', 'Extension Host', 'AI'];
const MAX_LINES = 2000;
let _lineId = 0;

function makeId() { return ++_lineId; }

function now() {
  return new Date().toLocaleTimeString('en-US', { hour12: false });
}

function levelClass(level: LogLevel) {
  switch (level) {
    case 'error': return 'text-[#f85149]';
    case 'warn':  return 'text-[#d29922]';
    case 'debug': return 'text-[#484f58]';
    default:      return 'text-[#c9d1d9]';
  }
}

function levelTag(level: LogLevel) {
  switch (level) {
    case 'error': return <span className="text-[#f85149] opacity-80">[ERR]</span>;
    case 'warn':  return <span className="text-[#d29922] opacity-80">[WRN]</span>;
    case 'debug': return <span className="text-[#484f58]">[DBG]</span>;
    default:      return <span className="text-[#3fb950] opacity-60">[INF]</span>;
  }
}

// ── Demo seed data ─────────────────────────────────────────────────────────────

function seedLines(channel: ChannelName): LogLine[] {
  const seeds: Record<ChannelName, Array<[LogLevel, string]>> = {
    Build: [
      ['info',  '> next build'],
      ['info',  'Compiled successfully in 4.2s'],
      ['warn',  'Warning: Image with src "/logo.png" is unoptimized'],
      ['info',  'Route (app)  ○  /  — 2.4 kB'],
      ['debug', 'webpack cache written to .next/cache'],
    ],
    Test: [
      ['info',  'Running test suite with vitest'],
      ['info',  'PASS  src/components/editor/Editor.test.tsx (14 tests)'],
      ['warn',  'Snapshot outdated: src/__snapshots__/sidebar.snap'],
      ['error', 'FAIL  src/components/git/GitPanel.test.tsx — 1 test failed'],
      ['info',  'Test Suites: 1 failed, 12 passed, 13 total'],
    ],
    Lint: [
      ['info',  'ESLint running on 87 files…'],
      ['warn',  'src/components/editor/EditorPane.tsx:42:5 — no-unused-vars: "ref" is defined but never used'],
      ['warn',  'src/store/kyroStore.ts:118:3 — @typescript-eslint/no-explicit-any'],
      ['error', 'src/api/auth.ts:9:1 — import/order: imports out of order'],
      ['info',  'ESLint: 1 error, 2 warnings found'],
    ],
    'Extension Host': [
      ['info',  'Extension host started (pid 18342)'],
      ['debug', 'Activating extension: kyro.git-lens'],
      ['info',  'Extension kyro.git-lens activated in 82ms'],
      ['warn',  'Extension kyro.legacy-pack: deprecated API usage detected'],
      ['debug', 'IPC channel established on port 49823'],
    ],
    AI: [
      ['info',  'AI provider: openai (gpt-4o)'],
      ['debug', 'Token budget: 128000 context, 4096 completion'],
      ['info',  'Completion stream started for inline edit request'],
      ['info',  'Tokens used: 1342 prompt + 89 completion = 1431 total'],
      ['debug', 'Stream finished in 1.8s'],
    ],
  };
  return seeds[channel].map(([level, message]) => ({
    id: makeId(),
    timestamp: now(),
    level,
    message,
  }));
}

// ── Output log event type ──────────────────────────────────────────────────────

interface OutputLogPayload {
  channel: string;
  message: string;
  level: LogLevel;
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function OutputPanel() {
  const [activeChannel, setActiveChannel] = useState<ChannelName>('Build');
  const [channelLogs, setChannelLogs] = useState<Record<ChannelName, LogLine[]>>(() => {
    const init = {} as Record<ChannelName, LogLine[]>;
    CHANNELS.forEach(ch => { init[ch] = seedLines(ch); });
    return init;
  });
  const [scrollLocked, setScrollLocked] = useState(true);
  const logRef = useRef<HTMLDivElement>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const currentLogs = useMemo(
    () => channelLogs[activeChannel] ?? [],
    [channelLogs, activeChannel],
  );

  // Auto-scroll
  useEffect(() => {
    if (scrollLocked && logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [currentLogs, scrollLocked]);

  // Listen for kyro:output-log events
  useEffect(() => {
    function handler(e: Event) {
      const { channel, message, level } = (e as CustomEvent<OutputLogPayload>).detail;
      const ch = CHANNELS.find(c => c.toLowerCase() === channel?.toLowerCase()) ?? 'Build';
      const line: LogLine = { id: makeId(), timestamp: now(), level: level ?? 'info', message };
      setChannelLogs(prev => {
        const existing = prev[ch] ?? [];
        const updated = [...existing, line].slice(-MAX_LINES);
        return { ...prev, [ch]: updated };
      });
    }
    window.addEventListener('kyro:output-log', handler);
    return () => window.removeEventListener('kyro:output-log', handler);
  }, []);

  const handleScroll = useCallback(() => {
    if (!logRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = logRef.current;
    const atBottom = scrollHeight - scrollTop - clientHeight < 20;
    if (!atBottom) setScrollLocked(false);
  }, []);

  function clearChannel() {
    setChannelLogs(prev => ({ ...prev, [activeChannel]: [] }));
  }

  function copyAll() {
    const text = currentLogs
      .map(l => `[${l.timestamp}] [${l.level.toUpperCase()}] ${l.message}`)
      .join('\n');
    navigator.clipboard.writeText(text).catch(() => {});
  }

  return (
    <div className="flex flex-col h-full bg-[#0d1117] text-[#c9d1d9]">
      {/* Header toolbar */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-[#30363d] shrink-0">
        <Monitor size={14} className="text-[#58a6ff] shrink-0" />
        <span className="text-xs font-semibold uppercase tracking-wide shrink-0">Output</span>

        {/* Channel selector */}
        <div className="relative ml-1">
          <button
            onClick={() => setDropdownOpen(v => !v)}
            className="flex items-center gap-1.5 bg-[#161b22] border border-[#30363d] rounded px-2 py-0.5 text-xs hover:border-[#484f58] transition-colors min-w-[110px] justify-between"
          >
            {activeChannel}
            <ChevronDown size={10} />
          </button>
          {dropdownOpen && (
            <div className="absolute left-0 top-full mt-1 bg-[#161b22] border border-[#30363d] rounded shadow-lg z-50 min-w-[130px]">
              {CHANNELS.map(ch => (
                <button
                  key={ch}
                  onClick={() => { setActiveChannel(ch); setDropdownOpen(false); }}
                  className={`block w-full text-left px-3 py-1.5 text-xs hover:bg-[#21262d] transition-colors ${
                    ch === activeChannel ? 'text-[#58a6ff]' : 'text-[#c9d1d9]'
                  }`}
                >
                  {ch}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1" />

        {/* Actions */}
        <button
          onClick={() => setScrollLocked(v => !v)}
          title={scrollLocked ? 'Unlock scroll' : 'Lock scroll (auto-scroll)'}
          className={`p-1 rounded transition-colors ${
            scrollLocked
              ? 'text-[#58a6ff] bg-[#58a6ff]/10'
              : 'text-[#8b949e] hover:text-[#c9d1d9] hover:bg-[#21262d]'
          }`}
        >
          {scrollLocked ? <Lock size={12} /> : <Unlock size={12} />}
        </button>
        <button
          onClick={copyAll}
          title="Copy all"
          className="p-1 rounded text-[#8b949e] hover:text-[#c9d1d9] hover:bg-[#21262d] transition-colors"
        >
          <Copy size={12} />
        </button>
        <button
          onClick={clearChannel}
          title="Clear channel"
          className="p-1 rounded text-[#8b949e] hover:text-[#f85149] hover:bg-[#f85149]/10 transition-colors"
        >
          <Trash2 size={12} />
        </button>
      </div>

      {/* Log area */}
      <div
        ref={logRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-2 font-mono text-[11px] leading-relaxed space-y-px"
        onClick={() => setDropdownOpen(false)}
      >
        {currentLogs.length === 0 ? (
          <div className="flex items-center justify-center h-16 text-[#484f58] italic text-xs">
            No output in this channel.
          </div>
        ) : (
          currentLogs.map(line => (
            <div key={line.id} className={`flex gap-2 ${levelClass(line.level)}`}>
              <span className="text-[#484f58] select-none shrink-0">{line.timestamp}</span>
              <span className="shrink-0">{levelTag(line.level)}</span>
              <span className="whitespace-pre-wrap break-all">{line.message}</span>
            </div>
          ))
        )}
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between px-3 py-1 border-t border-[#30363d] shrink-0 bg-[#161b22]">
        <span className="text-[10px] text-[#484f58]">
          {activeChannel} — {currentLogs.length} line{currentLogs.length !== 1 ? 's' : ''}
          {currentLogs.length >= MAX_LINES && (
            <span className="ml-1 text-[#d29922]">(buffer full — oldest lines dropped)</span>
          )}
        </span>
        <span className="text-[10px] text-[#484f58]">
          {scrollLocked ? '↓ Auto-scroll on' : 'Auto-scroll off'}
        </span>
      </div>
    </div>
  );
}
