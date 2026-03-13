'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Play,
  Plus,
  Trash2,
  ChevronDown,
  Loader2,
  CheckCircle,
  XCircle,
  Circle,
  ArrowUp,
  ArrowDown,
  Terminal,
  AlertCircle,
} from 'lucide-react';

let tauriInvoke: ((cmd: string, args?: Record<string, unknown>) => Promise<unknown>) | null = null;
if (typeof window !== 'undefined' && '__TAURI__' in window) {
  import('@tauri-apps/api/core').then((mod) => { tauriInvoke = mod.invoke; }).catch(() => {});
}

type Language = 'javascript' | 'typescript' | 'python' | 'bash';
type CellStatus = 'idle' | 'running' | 'success' | 'error';
type OutputKind = 'text' | 'json' | 'error';

interface CellOutput {
  kind: OutputKind;
  value: string;
}

interface Cell {
  id: string;
  language: Language;
  code: string;
  output: CellOutput | null;
  status: CellStatus;
}

const LANGUAGES: { value: Language; label: string }[] = [
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'python', label: 'Python' },
  { value: 'bash', label: 'Bash' },
];

const INDENT = '  '; // two spaces — matches the textarea tabSize style

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

function makeCell(language: Language = 'javascript'): Cell {
  return { id: uid(), language, code: '', output: null, status: 'idle' };
}

function tryParseJson(value: string): { ok: true; pretty: string } | { ok: false } {
  try {
    const parsed = JSON.parse(value);
    return { ok: true, pretty: JSON.stringify(parsed, null, 2) };
  } catch {
    return { ok: false };
  }
}

async function runJavaScript(code: string): Promise<CellOutput> {
  try {
    // Capture console.log output
    const logs: string[] = [];
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;
    console.log = (...args) => { logs.push(args.map(String).join(' ')); originalLog(...args); };
    console.warn = (...args) => { logs.push('[warn] ' + args.map(String).join(' ')); originalWarn(...args); };
    console.error = (...args) => { logs.push('[error] ' + args.map(String).join(' ')); originalError(...args); };

    let result: unknown;
    try {
      result = await new Function(
        'return (async () => { ' + code + '\n })()'
      )();
    } finally {
      console.log = originalLog;
      console.warn = originalWarn;
      console.error = originalError;
    }

    const parts: string[] = [...logs];
    if (result !== undefined) {
      if (typeof result === 'object' && result !== null) {
        parts.push(JSON.stringify(result, null, 2));
      } else {
        parts.push(String(result));
      }
    }
    const output = parts.join('\n');

    if (!output.trim()) return { kind: 'text', value: '(no output)' };

    const parsed = tryParseJson(output.trim());
    if (parsed.ok) return { kind: 'json', value: parsed.pretty };
    return { kind: 'text', value: output };
  } catch (err) {
    return { kind: 'error', value: err instanceof Error ? err.message : String(err) };
  }
}

async function runShellCommand(language: Language, code: string): Promise<CellOutput> {
  // For Python, use a heredoc-style stdin pipe to avoid shell-quoting issues with
  // arbitrary user code. The Bash cell code is executed as-is via 'bash -s'.
  const command =
    language === 'python'
      ? `python3 - <<'__KYRO_EOF__'\n${code}\n__KYRO_EOF__`
      : `bash -s <<'__KYRO_EOF__'\n${code}\n__KYRO_EOF__`;

  if (!tauriInvoke) {
    return {
      kind: 'text',
      value: `[Not in Tauri] Would run: ${command}`,
    };
  }

  try {
    const result = await tauriInvoke('run_terminal_command', { command }) as { stdout: string; stderr: string; exit_code: number };
    if (result.stderr && result.exit_code !== 0) {
      return { kind: 'error', value: result.stderr || `Process exited with code ${result.exit_code}` };
    }
    const out = result.stdout || result.stderr || '(no output)';
    const parsed = tryParseJson(out.trim());
    if (parsed.ok) return { kind: 'json', value: parsed.pretty };
    return { kind: 'text', value: out };
  } catch (err) {
    return { kind: 'error', value: err instanceof Error ? err.message : String(err) };
  }
}

async function executeCell(cell: Cell): Promise<CellOutput> {
  if (!cell.code.trim()) return { kind: 'text', value: '(empty cell)' };

  if (cell.language === 'javascript' || cell.language === 'typescript') {
    return runJavaScript(cell.code);
  }
  return runShellCommand(cell.language, cell.code);
}

// ─── Sub-components ──────────────────────────────────────────────────────────

interface StatusIconProps {
  status: CellStatus;
}

function StatusIcon({ status }: StatusIconProps) {
  switch (status) {
    case 'running':
      return <Loader2 size={13} className="animate-spin text-[#58a6ff]" />;
    case 'success':
      return <CheckCircle size={13} className="text-[#3fb950]" />;
    case 'error':
      return <XCircle size={13} className="text-red-400" />;
    default:
      return <Circle size={13} className="text-[#484f58]" />;
  }
}

interface LanguageSelectProps {
  value: Language;
  onChange: (l: Language) => void;
}

function LanguageSelect({ value, onChange }: LanguageSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, []);

  const label = LANGUAGES.find((l) => l.value === value)?.label ?? value;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-[#161b22] border border-[#30363d] text-[#8b949e] hover:text-[#c9d1d9] hover:border-[#58a6ff] transition-colors"
      >
        {label}
        <ChevronDown size={11} />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 rounded border border-[#30363d] bg-[#161b22] shadow-xl min-w-[120px]">
          {LANGUAGES.map((l) => (
            <button
              key={l.value}
              onClick={() => { onChange(l.value); setOpen(false); }}
              className={`w-full text-left px-3 py-1.5 text-xs hover:bg-[#21262d] transition-colors ${
                l.value === value ? 'text-[#58a6ff]' : 'text-[#c9d1d9]'
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface OutputBlockProps {
  output: CellOutput;
}

function OutputBlock({ output }: OutputBlockProps) {
  if (output.kind === 'error') {
    return (
      <div className="flex items-start gap-2 px-3 py-2 bg-red-950/30 border-t border-red-900/50 text-red-400 text-xs font-mono whitespace-pre-wrap break-all">
        <AlertCircle size={13} className="mt-0.5 shrink-0" />
        <span>{output.value}</span>
      </div>
    );
  }

  return (
    <div className="px-3 py-2 bg-[#0a0e14] border-t border-[#30363d] text-[#c9d1d9] text-xs font-mono whitespace-pre-wrap break-all">
      {output.kind === 'json' ? (
        <span className="text-[#79c0ff]">{output.value}</span>
      ) : (
        output.value
      )}
    </div>
  );
}

interface CellCardProps {
  cell: Cell;
  index: number;
  total: number;
  onRun: (id: string) => void;
  onCodeChange: (id: string, code: string) => void;
  onLanguageChange: (id: string, lang: Language) => void;
  onDelete: (id: string) => void;
  onAddAbove: (id: string) => void;
  onAddBelow: (id: string) => void;
}

function CellCard({
  cell,
  index,
  total,
  onRun,
  onCodeChange,
  onLanguageChange,
  onDelete,
  onAddAbove,
  onAddBelow,
}: CellCardProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && e.shiftKey) {
        e.preventDefault();
        onRun(cell.id);
      }
      // Basic tab-insertion
      if (e.key === 'Tab') {
        e.preventDefault();
        const el = e.currentTarget;
        const start = el.selectionStart;
        const end = el.selectionEnd;
        const newCode = cell.code.slice(0, start) + INDENT + cell.code.slice(end);
        onCodeChange(cell.id, newCode);
        requestAnimationFrame(() => {
          el.selectionStart = el.selectionEnd = start + INDENT.length;
        });
      }
    },
    [cell.id, cell.code, onRun, onCodeChange]
  );

  return (
    <div className="border border-[#30363d] rounded-lg overflow-hidden bg-[#0d1117] group">
      {/* Cell toolbar */}
      <div className="flex items-center justify-between px-2 py-1.5 bg-[#161b22] border-b border-[#30363d]">
        <div className="flex items-center gap-2">
          <StatusIcon status={cell.status} />
          <span className="text-[#484f58] text-xs">In [{index + 1}]</span>
          <LanguageSelect
            value={cell.language}
            onChange={(lang) => onLanguageChange(cell.id, lang)}
          />
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onAddAbove(cell.id)}
            title="Add cell above"
            className="p-1 rounded text-[#8b949e] hover:text-[#c9d1d9] hover:bg-[#21262d] transition-colors"
          >
            <ArrowUp size={12} />
          </button>
          <button
            onClick={() => onAddBelow(cell.id)}
            title="Add cell below"
            className="p-1 rounded text-[#8b949e] hover:text-[#c9d1d9] hover:bg-[#21262d] transition-colors"
          >
            <ArrowDown size={12} />
          </button>
          {total > 1 && (
            <button
              onClick={() => onDelete(cell.id)}
              title="Delete cell"
              className="p-1 rounded text-[#8b949e] hover:text-red-400 hover:bg-red-900/20 transition-colors"
            >
              <Trash2 size={12} />
            </button>
          )}
          <button
            onClick={() => onRun(cell.id)}
            disabled={cell.status === 'running'}
            title="Run cell (Shift+Enter)"
            className="flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-[#1f6feb] text-white hover:bg-[#388bfd] disabled:opacity-40 disabled:cursor-not-allowed transition-colors ml-1"
          >
            {cell.status === 'running' ? (
              <Loader2 size={11} className="animate-spin" />
            ) : (
              <Play size={11} />
            )}
            Run
          </button>
        </div>
      </div>

      {/* Code editor */}
      <textarea
        ref={textareaRef}
        value={cell.code}
        onChange={(e) => onCodeChange(cell.id, e.target.value)}
        onKeyDown={handleKeyDown}
        spellCheck={false}
        placeholder={`# ${LANGUAGES.find((l) => l.value === cell.language)?.label} code…`}
        className="w-full bg-[#0d1117] text-[#c9d1d9] font-mono text-sm resize-none px-4 py-3 focus:outline-none placeholder-[#484f58] min-h-[80px]"
        style={{ tabSize: 2 }}
        rows={Math.max(3, cell.code.split('\n').length + 1)}
      />

      {/* Output */}
      {cell.output && <OutputBlock output={cell.output} />}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function NotebookPanel() {
  const [cells, setCells] = useState<Cell[]>([makeCell('javascript')]);
  const bottomRef = useRef<HTMLDivElement>(null);

  const updateCell = useCallback((id: string, patch: Partial<Cell>) => {
    setCells((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }, []);

  const runCell = useCallback(async (id: string) => {
    const cell = cells.find((c) => c.id === id);
    if (!cell || cell.status === 'running') return;

    updateCell(id, { status: 'running', output: null });
    const output = await executeCell(cell);
    updateCell(id, { status: output.kind === 'error' ? 'error' : 'success', output });
  }, [cells, updateCell]);

  const handleCodeChange = useCallback((id: string, code: string) => {
    updateCell(id, { code, status: 'idle' });
  }, [updateCell]);

  const handleLanguageChange = useCallback((id: string, language: Language) => {
    updateCell(id, { language, output: null, status: 'idle' });
  }, [updateCell]);

  const handleDelete = useCallback((id: string) => {
    setCells((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const handleAddAbove = useCallback((id: string) => {
    setCells((prev) => {
      const idx = prev.findIndex((c) => c.id === id);
      const lang = prev[idx]?.language ?? 'javascript';
      const next = [...prev];
      next.splice(idx, 0, makeCell(lang));
      return next;
    });
  }, []);

  const handleAddBelow = useCallback((id: string) => {
    setCells((prev) => {
      const idx = prev.findIndex((c) => c.id === id);
      const lang = prev[idx]?.language ?? 'javascript';
      const next = [...prev];
      next.splice(idx + 1, 0, makeCell(lang));
      return next;
    });
    // Scroll to bottom after adding
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    });
  }, []);

  const handleAddCell = useCallback(() => {
    const lastLang = cells[cells.length - 1]?.language ?? 'javascript';
    setCells((prev) => [...prev, makeCell(lastLang)]);
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    });
  }, [cells]);

  const handleRunAll = useCallback(async () => {
    for (const cell of cells) {
      if (!cell.code.trim()) continue;
      updateCell(cell.id, { status: 'running', output: null });
      const output = await executeCell(cell);
      updateCell(cell.id, { status: output.kind === 'error' ? 'error' : 'success', output });
    }
  }, [cells, updateCell]);

  const anyRunning = cells.some((c) => c.status === 'running');

  return (
    <div className="flex flex-col h-full bg-[#0d1117] text-[#c9d1d9] overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#30363d] bg-[#161b22] shrink-0">
        <div className="flex items-center gap-2">
          <Terminal size={16} className="text-[#3fb950]" />
          <span className="font-semibold text-sm">Notebook</span>
          <span className="text-[#8b949e] text-xs">— interactive REPL</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleAddCell}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs text-[#8b949e] hover:text-[#c9d1d9] hover:bg-[#21262d] border border-[#30363d] transition-colors"
          >
            <Plus size={12} />
            Add Cell
          </button>
          <button
            onClick={handleRunAll}
            disabled={anyRunning}
            className="flex items-center gap-1.5 px-3 py-1 rounded text-xs bg-[#1f6feb] text-white hover:bg-[#388bfd] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {anyRunning ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Play size={12} />
            )}
            Run All
          </button>
        </div>
      </div>

      {/* Cells */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {cells.map((cell, index) => (
          <CellCard
            key={cell.id}
            cell={cell}
            index={index}
            total={cells.length}
            onRun={runCell}
            onCodeChange={handleCodeChange}
            onLanguageChange={handleLanguageChange}
            onDelete={handleDelete}
            onAddAbove={handleAddAbove}
            onAddBelow={handleAddBelow}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Footer */}
      <div className="shrink-0 flex items-center gap-4 px-4 py-2 border-t border-[#30363d] bg-[#161b22] text-xs text-[#8b949e]">
        <span>{cells.length} cell{cells.length !== 1 ? 's' : ''}</span>
        <span>Shift+Enter to run · Tab to indent</span>
        {!tauriInvoke && (
          <span className="ml-auto text-[#f0883e]">
            ⚠ Tauri unavailable — JS/TS cells only
          </span>
        )}
      </div>
    </div>
  );
}
