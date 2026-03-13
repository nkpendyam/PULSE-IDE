'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Send,
  Trophy,
  Minus,
  ChevronDown,
  Loader2,
  Clock,
  Hash,
  Bot,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';

let tauriInvoke: ((cmd: string, args?: Record<string, unknown>) => Promise<unknown>) | null = null;
if (typeof window !== 'undefined' && '__TAURI__' in window) {
  import('@tauri-apps/api/core').then((mod) => { tauriInvoke = mod.invoke; }).catch(() => {});
}

const FALLBACK_MODELS = ['llama3', 'codellama', 'mistral', 'phi3', 'qwen2.5-coder'];

// Delay before probing Tauri for models — gives the API time to fully initialise
const TAURI_INIT_DELAY_MS = 300;

const VOTE_STORAGE_KEY = 'kyro-arena-votes';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ModelResponse {
  content: string;
  tokens: number;
  time_ms: number;
}

interface PanelState {
  messages: Message[];
  isLoading: boolean;
  lastResponse: ModelResponse | null;
  error: string | null;
}

interface VoteCounts {
  a: number;
  tie: number;
  b: number;
  total: number;
}

function loadVotes(): VoteCounts {
  if (typeof window === 'undefined') return { a: 0, tie: 0, b: 0, total: 0 };
  try {
    const raw = localStorage.getItem(VOTE_STORAGE_KEY);
    if (raw) return JSON.parse(raw) as VoteCounts;
  } catch {}
  return { a: 0, tie: 0, b: 0, total: 0 };
}

function saveVotes(votes: VoteCounts) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(VOTE_STORAGE_KEY, JSON.stringify(votes));
}

function pct(n: number, total: number): string {
  if (total === 0) return '0%';
  return `${Math.round((n / total) * 100)}%`;
}

interface ModelDropdownProps {
  value: string;
  options: string[];
  onChange: (val: string) => void;
  label: string;
}

function ModelDropdown({ value, options, onChange, label }: ModelDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-[#161b22] border border-[#30363d] text-[#c9d1d9] text-sm hover:border-[#58a6ff] transition-colors"
        aria-label={`Select ${label}`}
      >
        <Bot size={14} className="text-[#58a6ff]" />
        <span className="max-w-[140px] truncate">{value}</span>
        <ChevronDown size={12} className="text-[#8b949e]" />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 min-w-[160px] rounded border border-[#30363d] bg-[#161b22] shadow-xl">
          {options.map((opt) => (
            <button
              key={opt}
              onClick={() => { onChange(opt); setOpen(false); }}
              className={`w-full text-left px-3 py-1.5 text-sm hover:bg-[#21262d] transition-colors ${
                opt === value ? 'text-[#58a6ff]' : 'text-[#c9d1d9]'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface ChatPanelProps {
  label: 'A' | 'B';
  model: string;
  availableModels: string[];
  onModelChange: (m: string) => void;
  panel: PanelState;
}

function ChatPanel({ label, model, availableModels, onModelChange, panel }: ChatPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [panel.messages, panel.isLoading]);

  return (
    <div className="flex flex-col flex-1 min-w-0 border border-[#30363d] rounded-lg overflow-hidden bg-[#0d1117]">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-[#161b22] border-b border-[#30363d]">
        <div className="flex items-center gap-2">
          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[#58a6ff] text-[#0d1117] text-xs font-bold">
            {label}
          </span>
          <ModelDropdown
            value={model}
            options={availableModels}
            onChange={onModelChange}
            label={`Model ${label}`}
          />
        </div>
        {panel.lastResponse && (
          <div className="flex items-center gap-3 text-xs text-[#8b949e]">
            <span className="flex items-center gap-1">
              <Clock size={11} />
              {panel.lastResponse.time_ms.toLocaleString()}ms
            </span>
            <span className="flex items-center gap-1">
              <Hash size={11} />
              {panel.lastResponse.tokens.toLocaleString()} tok
            </span>
          </div>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0" style={{ maxHeight: 420 }}>
        {panel.messages.length === 0 && !panel.isLoading && (
          <div className="flex flex-col items-center justify-center h-full text-[#8b949e] text-sm gap-2 py-8">
            <Bot size={28} className="opacity-40" />
            <span>Send a prompt to start</span>
          </div>
        )}
        {panel.messages.map((msg, i) => (
          <div
            key={i}
            className={`flex flex-col gap-1 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            <span className="text-[10px] uppercase tracking-wide text-[#8b949e]">
              {msg.role === 'user' ? 'You' : model}
            </span>
            <div
              className={`max-w-full rounded-lg px-3 py-2 text-sm whitespace-pre-wrap break-words ${
                msg.role === 'user'
                  ? 'bg-[#1f6feb] text-white'
                  : 'bg-[#161b22] text-[#c9d1d9] border border-[#30363d]'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {panel.isLoading && (
          <div className="flex items-center gap-2 text-[#8b949e] text-sm">
            <Loader2 size={14} className="animate-spin text-[#58a6ff]" />
            <span>Generating…</span>
          </div>
        )}
        {panel.error && (
          <div className="flex items-center gap-2 text-red-400 text-sm bg-red-900/20 border border-red-800/40 rounded p-2">
            <AlertCircle size={14} />
            <span>{panel.error}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function ArenaMode() {
  const [availableModels, setAvailableModels] = useState<string[]>(FALLBACK_MODELS);
  const [modelA, setModelA] = useState(FALLBACK_MODELS[0]);
  const [modelB, setModelB] = useState(FALLBACK_MODELS[2]);
  const [prompt, setPrompt] = useState('');
  const [panelA, setPanelA] = useState<PanelState>({ messages: [], isLoading: false, lastResponse: null, error: null });
  const [panelB, setPanelB] = useState<PanelState>({ messages: [], isLoading: false, lastResponse: null, error: null });
  const [votingEnabled, setVotingEnabled] = useState(false);
  const [lastVote, setLastVote] = useState<'a' | 'tie' | 'b' | null>(null);
  const [votes, setVotes] = useState<VoteCounts>({ a: 0, tie: 0, b: 0, total: 0 });
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setVotes(loadVotes());

    const tryLoadModels = async () => {
      if (!tauriInvoke) return;
      try {
        const models = await tauriInvoke('list_local_models') as string[];
        if (Array.isArray(models) && models.length > 0) {
          setAvailableModels(models);
          setModelA(models[0]);
          setModelB(models[models.length > 1 ? 1 : 0]);
        }
      } catch {}
    };

    // Wait briefly for Tauri to initialise then load models
    const timer = setTimeout(tryLoadModels, TAURI_INIT_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  const callModel = useCallback(
    async (
      model: string,
      messages: Message[],
      setPanel: React.Dispatch<React.SetStateAction<PanelState>>
    ) => {
      setPanel((p) => ({ ...p, isLoading: true, error: null }));
      try {
        let response: ModelResponse;
        if (tauriInvoke) {
          response = await tauriInvoke('chat_complete', {
            model,
            messages,
            stream: false,
          }) as ModelResponse;
        } else {
          // Mock fallback for non-Tauri environment
          await new Promise((r) => setTimeout(r, 600 + Math.random() * 800));
          const mockContent = `[Mock] Response from **${model}**:\n\nThis is a simulated response. Run inside the Kyro desktop app for real AI completions.`;
          response = {
            content: mockContent,
            tokens: Math.floor(Math.random() * 200) + 50,
            time_ms: Math.floor(Math.random() * 1200) + 300,
          };
        }

        setPanel((p) => ({
          ...p,
          isLoading: false,
          lastResponse: response,
          messages: [...p.messages, { role: 'assistant', content: response.content }],
        }));
      } catch (err) {
        setPanel((p) => ({
          ...p,
          isLoading: false,
          error: err instanceof Error ? err.message : String(err),
        }));
      }
    },
    []
  );

  const handleSend = useCallback(async () => {
    const text = prompt.trim();
    if (!text) return;

    const userMsg: Message = { role: 'user', content: text };
    setPrompt('');
    setVotingEnabled(false);
    setLastVote(null);

    const messagesA = [...panelA.messages, userMsg];
    const messagesB = [...panelB.messages, userMsg];

    setPanelA((p) => ({ ...p, messages: [...p.messages, userMsg] }));
    setPanelB((p) => ({ ...p, messages: [...p.messages, userMsg] }));

    await Promise.all([
      callModel(modelA, messagesA, setPanelA),
      callModel(modelB, messagesB, setPanelB),
    ]);

    setVotingEnabled(true);
  }, [prompt, panelA.messages, panelB.messages, modelA, modelB, callModel]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const handleVote = useCallback((choice: 'a' | 'tie' | 'b') => {
    setLastVote(choice);
    setVotes((prev) => {
      const updated = { ...prev, [choice]: prev[choice] + 1, total: prev.total + 1 };
      saveVotes(updated);
      return updated;
    });
    setVotingEnabled(false);
  }, []);

  const handleReset = useCallback(() => {
    setPanelA({ messages: [], isLoading: false, lastResponse: null, error: null });
    setPanelB({ messages: [], isLoading: false, lastResponse: null, error: null });
    setVotingEnabled(false);
    setLastVote(null);
    setPrompt('');
  }, []);

  const isBusy = panelA.isLoading || panelB.isLoading;

  return (
    <div className="flex flex-col h-full bg-[#0d1117] text-[#c9d1d9] overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#30363d] bg-[#161b22] shrink-0">
        <div className="flex items-center gap-2">
          <Trophy size={16} className="text-[#f0883e]" />
          <span className="font-semibold text-sm">Arena Mode</span>
          <span className="text-[#8b949e] text-xs">— compare models side by side</span>
        </div>
        <button
          onClick={handleReset}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs text-[#8b949e] hover:text-[#c9d1d9] hover:bg-[#21262d] transition-colors border border-[#30363d]"
          title="Clear conversation"
        >
          <RefreshCw size={12} />
          Reset
        </button>
      </div>

      {/* Panels */}
      <div className="flex flex-1 gap-3 p-3 min-h-0 overflow-hidden">
        <ChatPanel
          label="A"
          model={modelA}
          availableModels={availableModels}
          onModelChange={setModelA}
          panel={panelA}
        />
        <ChatPanel
          label="B"
          model={modelB}
          availableModels={availableModels}
          onModelChange={setModelB}
          panel={panelB}
        />
      </div>

      {/* Voting */}
      {(votingEnabled || lastVote !== null) && (
        <div className="shrink-0 flex flex-col items-center gap-2 px-4 py-3 border-t border-[#30363d] bg-[#161b22]">
          {lastVote === null ? (
            <>
              <span className="text-xs text-[#8b949e] mb-1">Which response was better?</span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleVote('a')}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded bg-[#0d1117] border border-[#30363d] text-sm hover:border-[#58a6ff] hover:text-[#58a6ff] transition-colors"
                >
                  <span className="flex items-center justify-center w-4 h-4 rounded-full bg-[#58a6ff] text-[#0d1117] text-xs font-bold">A</span>
                  Model A Better
                </button>
                <button
                  onClick={() => handleVote('tie')}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded bg-[#0d1117] border border-[#30363d] text-sm hover:border-[#8b949e] hover:text-[#c9d1d9] transition-colors"
                >
                  <Minus size={14} className="text-[#8b949e]" />
                  Tie
                </button>
                <button
                  onClick={() => handleVote('b')}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded bg-[#0d1117] border border-[#30363d] text-sm hover:border-[#58a6ff] hover:text-[#58a6ff] transition-colors"
                >
                  <span className="flex items-center justify-center w-4 h-4 rounded-full bg-[#58a6ff] text-[#0d1117] text-xs font-bold">B</span>
                  Model B Better
                </button>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2 text-sm text-[#3fb950]">
              <Trophy size={14} />
              <span>
                Vote recorded:{' '}
                {lastVote === 'a' ? 'Model A' : lastVote === 'b' ? 'Model B' : 'Tie'}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Vote Stats */}
      {votes.total > 0 && (
        <div className="shrink-0 flex items-center justify-center gap-5 px-4 py-2 border-t border-[#30363d] bg-[#0d1117]">
          <span className="text-xs text-[#8b949e]">
            {votes.total} vote{votes.total !== 1 ? 's' : ''}
          </span>
          <div className="flex items-center gap-1.5 text-xs">
            <span className="flex items-center justify-center w-4 h-4 rounded-full bg-[#58a6ff] text-[#0d1117] text-[10px] font-bold">A</span>
            <span className="text-[#c9d1d9] font-medium">{pct(votes.a, votes.total)}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <Minus size={11} className="text-[#8b949e]" />
            <span className="text-[#8b949e]">Tie {pct(votes.tie, votes.total)}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <span className="flex items-center justify-center w-4 h-4 rounded-full bg-[#58a6ff] text-[#0d1117] text-[10px] font-bold">B</span>
            <span className="text-[#c9d1d9] font-medium">{pct(votes.b, votes.total)}</span>
          </div>
        </div>
      )}

      {/* Shared Input */}
      <div className="shrink-0 flex items-end gap-2 p-3 border-t border-[#30363d] bg-[#161b22]">
        <textarea
          ref={textareaRef}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Send a prompt to both models… (Enter to send, Shift+Enter for newline)"
          rows={2}
          disabled={isBusy}
          className="flex-1 resize-none rounded border border-[#30363d] bg-[#0d1117] text-[#c9d1d9] placeholder-[#8b949e] text-sm px-3 py-2 focus:outline-none focus:border-[#58a6ff] disabled:opacity-50 transition-colors"
        />
        <button
          onClick={handleSend}
          disabled={isBusy || !prompt.trim()}
          className="flex items-center gap-1.5 px-4 py-2 rounded bg-[#1f6feb] text-white text-sm font-medium hover:bg-[#388bfd] disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
        >
          {isBusy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          Send
        </button>
      </div>
    </div>
  );
}
