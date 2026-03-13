'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useKyroStore } from '@/store/kyroStore';
import {
  XCircle,
  AlertTriangle,
  Info,
  Wand2,
  X,
  Search,
  Trash2,
} from 'lucide-react';

interface Diagnostic {
  id: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  file: string;
  line: number;
  column: number;
  source?: string;
}

type TabFilter = 'all' | 'errors' | 'warnings' | 'current';

interface ProblemsPanelProps {
  onNavigate?: (file: string, line: number) => void;
}

const DEMO_DIAGNOSTICS: Diagnostic[] = [
  {
    id: '1',
    severity: 'error',
    message: "Type 'string' is not assignable to type 'number'.",
    file: 'src/components/editor/CodeEditor.tsx',
    line: 42,
    column: 14,
    source: 'ts',
  },
  {
    id: '2',
    severity: 'error',
    message: "Cannot find module '@/utils/helpers' or its corresponding type declarations.",
    file: 'src/store/kyroStore.ts',
    line: 7,
    column: 24,
    source: 'ts',
  },
  {
    id: '3',
    severity: 'error',
    message: "Property 'onClose' is missing in type '{}' but required in type 'ModalProps'.",
    file: 'src/components/settings/SettingsPanel.tsx',
    line: 118,
    column: 5,
    source: 'ts',
  },
  {
    id: '4',
    severity: 'warning',
    message: "React Hook useEffect has a missing dependency: 'fetchData'. Either include it or remove the dependency array.",
    file: 'src/components/chat/AIChatPanel.tsx',
    line: 63,
    column: 6,
    source: 'eslint',
  },
  {
    id: '5',
    severity: 'warning',
    message: "'result' is assigned a value but never used.",
    file: 'src/components/terminal/TerminalPanel.tsx',
    line: 29,
    column: 9,
    source: 'ts',
  },
];

function SeverityIcon({ severity }: { severity: Diagnostic['severity'] }) {
  if (severity === 'error') {
    return <XCircle size={14} className="text-[#f85149] shrink-0" />;
  }
  if (severity === 'warning') {
    return <AlertTriangle size={14} className="text-[#d29922] shrink-0" />;
  }
  return <Info size={14} className="text-[#388bfd] shrink-0" />;
}

function truncatePath(filePath: string): string {
  const parts = filePath.split('/');
  if (parts.length <= 3) return filePath;
  return `…/${parts.slice(-2).join('/')}`;
}

export function ProblemsPanel({ onNavigate }: ProblemsPanelProps) {
  const { diagnosticCounts, selectedModel, openFiles, activeFileIndex, addChatMessage } =
    useKyroStore();

  const activeFile = openFiles[activeFileIndex] ?? null;

  const [diagnostics, setDiagnostics] = useState<Diagnostic[]>(DEMO_DIAGNOSTICS);
  const [activeTab, setActiveTab] = useState<TabFilter>('all');
  const [filter, setFilter] = useState('');
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [fixingId, setFixingId] = useState<string | null>(null);

  const loadDiagnostics = useCallback(async () => {
    if (!activeFile) return;
    try {
      const result = await invoke<Diagnostic[]>('get_diagnostics', {
        filePath: activeFile.path,
      });
      if (result && result.length > 0) {
        setDiagnostics(result);
      }
    } catch {
      // Tauri not available or command not found — keep demo data
    }
  }, [activeFile]);

  useEffect(() => {
    loadDiagnostics();
  }, [loadDiagnostics]);

  const filtered = diagnostics.filter((d) => {
    if (activeTab === 'errors' && d.severity !== 'error') return false;
    if (activeTab === 'warnings' && d.severity !== 'warning') return false;
    if (activeTab === 'current' && activeFile && d.file !== activeFile.path) return false;
    if (filter) {
      const q = filter.toLowerCase();
      if (!d.message.toLowerCase().includes(q) && !d.file.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const errorCount = diagnostics.filter((d) => d.severity === 'error').length;
  const warningCount = diagnostics.filter((d) => d.severity === 'warning').length;
  const currentFileCount = activeFile
    ? diagnostics.filter((d) => d.file === activeFile.path).length
    : 0;

  const handleNavigate = (d: Diagnostic) => {
    onNavigate?.(d.file, d.line);
  };

  const handleAiFix = async (e: React.MouseEvent, d: Diagnostic) => {
    e.stopPropagation();
    setFixingId(d.id);

    const errorContext = `// File: ${d.file}\n// Line ${d.line}:${d.column}\n// Error: ${d.message}`;
    const fileLanguage = d.file.endsWith('.ts') || d.file.endsWith('.tsx') ? 'typescript' : 'javascript';

    try {
      await invoke('fix_code', {
        model: selectedModel,
        code: errorContext,
        language: fileLanguage,
        error: d.message,
      });
    } catch {
      // Tauri not available — fall back to chat
      addChatMessage({
        id: Date.now().toString(),
        role: 'user',
        content: `Fix this error: ${d.message} in ${d.file}:${d.line}`,
        timestamp: new Date(),
      });
    } finally {
      setFixingId(null);
    }
  };

  const tabs: { key: TabFilter; label: string; count: number }[] = [
    { key: 'errors', label: 'Errors', count: errorCount },
    { key: 'warnings', label: 'Warnings', count: warningCount },
    { key: 'all', label: 'All', count: diagnostics.length },
    { key: 'current', label: 'Current File', count: currentFileCount },
  ];

  return (
    <div className="flex flex-col h-full bg-[#0d1117] text-[#c9d1d9] text-xs select-none">
      {/* Tab bar */}
      <div className="flex items-center border-b border-[#30363d] bg-[#161b22] shrink-0">
        <div className="flex items-center flex-1 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-2 border-b-2 whitespace-nowrap transition-colors ${
                activeTab === tab.key
                  ? 'border-[#388bfd] text-[#c9d1d9]'
                  : 'border-transparent text-[#8b949e] hover:text-[#c9d1d9]'
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                    tab.key === 'errors'
                      ? 'bg-[#3d1c1c] text-[#f85149]'
                      : tab.key === 'warnings'
                      ? 'bg-[#2d2208] text-[#d29922]'
                      : 'bg-[#21262d] text-[#8b949e]'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        <button
          onClick={() => setDiagnostics([])}
          title="Clear all problems"
          className="flex items-center gap-1 px-3 py-2 text-[#8b949e] hover:text-[#c9d1d9] shrink-0"
        >
          <Trash2 size={13} />
          <span>Clear All</span>
        </button>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-[#30363d] bg-[#0d1117] shrink-0">
        <Search size={12} className="text-[#8b949e] shrink-0" />
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter problems…"
          className="flex-1 bg-transparent outline-none text-[#c9d1d9] placeholder-[#8b949e] text-xs"
        />
        {filter && (
          <button onClick={() => setFilter('')} className="text-[#8b949e] hover:text-[#c9d1d9]">
            <X size={12} />
          </button>
        )}
      </div>

      {/* Problems list */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-[#8b949e]">
            {diagnostics.length === 0 ? (
              <>
                <XCircle size={32} className="opacity-30" />
                <span>No problems detected</span>
              </>
            ) : (
              <>
                <Search size={32} className="opacity-30" />
                <span>No problems match the current filter</span>
              </>
            )}
          </div>
        ) : (
          <ul>
            {filtered.map((d) => (
              <li
                key={d.id}
                onClick={() => handleNavigate(d)}
                onMouseEnter={() => setHoveredId(d.id)}
                onMouseLeave={() => setHoveredId(null)}
                className={`flex items-start gap-2 px-3 py-1.5 cursor-pointer border-b border-[#30363d]/40 transition-colors ${
                  hoveredId === d.id ? 'bg-[#161b22]' : 'bg-transparent'
                }`}
              >
                <SeverityIcon severity={d.severity} />

                <div className="flex-1 min-w-0">
                  <p className="text-[#c9d1d9] leading-snug break-words">{d.message}</p>
                  <div className="flex items-center gap-1 mt-0.5 text-[#8b949e]">
                    {d.source && (
                      <>
                        <span className="px-1 py-0.5 rounded text-[10px] bg-[#21262d]">
                          {d.source}
                        </span>
                        <span className="text-[#30363d]">·</span>
                      </>
                    )}
                    <span title={d.file}>{truncatePath(d.file)}</span>
                    <span className="text-[#30363d]">·</span>
                    <span>
                      {d.line}:{d.column}
                    </span>
                  </div>
                </div>

                <button
                  onClick={(e) => handleAiFix(e, d)}
                  disabled={fixingId === d.id}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium shrink-0 transition-all ${
                    hoveredId === d.id ? 'opacity-100' : 'opacity-0 pointer-events-none'
                  } ${
                    fixingId === d.id
                      ? 'bg-[#1f2937] text-[#8b949e] cursor-not-allowed'
                      : 'bg-[#1f6feb]/20 text-[#388bfd] hover:bg-[#1f6feb]/40 border border-[#1f6feb]/40'
                  }`}
                >
                  <Wand2 size={11} />
                  {fixingId === d.id ? 'Fixing…' : 'AI Fix'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Status bar */}
      <div className="flex items-center gap-3 px-3 py-1 bg-[#161b22] border-t border-[#30363d] text-[#8b949e] shrink-0">
        <span className="flex items-center gap-1">
          <XCircle size={11} className="text-[#f85149]" />
          {diagnosticCounts.errors} errors
        </span>
        <span className="flex items-center gap-1">
          <AlertTriangle size={11} className="text-[#d29922]" />
          {diagnosticCounts.warnings} warnings
        </span>
      </div>
    </div>
  );
}
