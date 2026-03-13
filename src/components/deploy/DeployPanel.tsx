'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  Rocket, Settings, Clock, CheckCircle, XCircle, Loader2,
  ExternalLink, ChevronDown, ChevronRight, TerminalSquare, RefreshCw, Trash2
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DeployStatus = 'idle' | 'deploying' | 'success' | 'error';
type PlatformId = 'vercel' | 'netlify' | 'docker' | 'ghpages';

interface DeploymentConfig {
  projectName: string;
  buildCommand: string;
  outputDir: string;
}

interface PlatformState {
  status: DeployStatus;
  logs: string;
  url: string;
  logsOpen: boolean;
}

interface RecentDeployment {
  id: string;
  platform: PlatformId;
  platformName: string;
  timestamp: number;
  status: 'success' | 'error';
  url?: string;
}

interface InvokeResult {
  output: string;
  exit_code: number;
}

// ---------------------------------------------------------------------------
// Platform definitions
// ---------------------------------------------------------------------------

interface PlatformDef {
  id: PlatformId;
  name: string;
  description: string;
  icon: React.ReactNode;
  accentColor: string;
  buildCommands: (cfg: DeploymentConfig) => string[];
}

const VercelIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2L2 19.5h20L12 2z" />
  </svg>
);

const NetlifyIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M16.934 8.519a1.044 1.044 0 0 1 .303.23l2.349-1.045-2.192-2.193-.793 2.383a1.07 1.07 0 0 1 .333.625zm1.327 2.152a1.049 1.049 0 0 1-.006.124l2.449 1.09.006-4.124-2.283 2.284a1.05 1.05 0 0 1-.166.626zm-2.144 1.878a1.037 1.037 0 0 1-.325-.07L14.3 14.2l5.308.005-1.97-1.965a1.038 1.038 0 0 1-.521.309zm-1.099-1.3a1.05 1.05 0 0 1-.02-.206 1.037 1.037 0 0 1 .016-.195L12.6 9.744l-.005 3.6 2.423-2.095zm-3.565 2.95l1.077 1.078V13.2l-1.077 1.999zm5.43-7.627L14.6 5.31 13.6 7.31l2.283 1.282zm-3.415 1.07L11.6 6.79 11 8.69l1.468-.118zm-2.87 4.357l-1.99 3.715 5.714.006-3.724-3.721zm6.91-4.693L15.6 6.9l1.733 1.732-.43 1.298zm-7.92 4.357l-2.844-2.843-1.36 5.064 4.204-2.221zm-3.415-3.415l2.844 2.844 1.36-5.064-4.204 2.22zM4.71 15.2l2.844 2.844 1.36-5.064L4.71 15.2zm10.336-5.7l-1.732-1.732-1.298.43 1.732 1.732 1.298-.43z" />
  </svg>
);

const DockerIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M13.983 11.078h2.119a.186.186 0 0 0 .186-.185V9.006a.186.186 0 0 0-.186-.186h-2.119a.185.185 0 0 0-.185.185v1.888c0 .102.083.185.185.185m-2.954-5.43h2.118a.186.186 0 0 0 .186-.186V3.574a.186.186 0 0 0-.186-.185h-2.118a.185.185 0 0 0-.185.185v1.888c0 .102.082.185.185.185m0 2.716h2.118a.187.187 0 0 0 .186-.186V6.29a.186.186 0 0 0-.186-.185h-2.118a.185.185 0 0 0-.185.185v1.887c0 .102.082.185.185.186m-2.93 0h2.12a.186.186 0 0 0 .184-.186V6.29a.185.185 0 0 0-.185-.185H8.1a.185.185 0 0 0-.185.185v1.887c0 .102.083.185.185.186m-2.964 0h2.119a.186.186 0 0 0 .185-.186V6.29a.185.185 0 0 0-.185-.185H5.136a.186.186 0 0 0-.186.185v1.887c0 .102.084.185.186.186m5.893 2.715h2.118a.186.186 0 0 0 .186-.185V9.006a.186.186 0 0 0-.186-.186h-2.118a.185.185 0 0 0-.185.185v1.888c0 .102.082.185.185.185m-2.93 0h2.12a.185.185 0 0 0 .184-.185V9.006a.185.185 0 0 0-.184-.186h-2.12a.185.185 0 0 0-.184.185v1.888c0 .102.083.185.185.185m-2.964 0h2.119a.185.185 0 0 0 .185-.185V9.006a.185.185 0 0 0-.184-.186h-2.12a.186.186 0 0 0-.186.186v1.887c0 .102.084.185.186.185m-2.92 0h2.12a.185.185 0 0 0 .184-.185V9.006a.185.185 0 0 0-.184-.186h-2.12a.185.185 0 0 0-.185.186v1.887c0 .102.082.185.185.185M23.763 9.89c-.065-.051-.672-.51-1.954-.51-.338.001-.676.03-1.01.087-.248-1.7-1.653-2.53-1.716-2.566l-.344-.199-.226.327c-.284.438-.49.922-.612 1.43-.23.97-.09 1.882.403 2.661-.595.332-1.55.413-1.744.42H.751a.751.751 0 0 0-.75.748 11.376 11.376 0 0 0 .692 4.062c.545 1.428 1.355 2.48 2.41 3.124 1.18.723 3.1 1.137 5.275 1.137.983.003 1.963-.086 2.93-.266a12.248 12.248 0 0 0 3.823-1.389c.98-.567 1.86-1.288 2.61-2.136 1.252-1.418 1.998-2.997 2.553-4.4h.221c1.372 0 2.215-.549 2.68-1.009.309-.293.55-.65.707-1.046l.098-.288Z" />
  </svg>
);

const GhPagesIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
  </svg>
);

const PLATFORMS: PlatformDef[] = [
  {
    id: 'vercel',
    name: 'Vercel',
    description: 'Deploy Next.js / React apps instantly',
    icon: <VercelIcon />,
    accentColor: '#ffffff',
    buildCommands: (cfg) => [
      cfg.buildCommand,
      `vercel --prod --name ${cfg.projectName || 'my-app'} --yes`,
    ],
  },
  {
    id: 'netlify',
    name: 'Netlify',
    description: 'Deploy static sites & serverless functions',
    icon: <NetlifyIcon />,
    accentColor: '#00ad9f',
    buildCommands: (cfg) => [
      cfg.buildCommand,
      `netlify deploy --prod --dir ${cfg.outputDir} --message "Deploy from Kyro IDE"`,
    ],
  },
  {
    id: 'docker',
    name: 'Docker',
    description: 'Build & run a containerised application',
    icon: <DockerIcon />,
    accentColor: '#2496ed',
    buildCommands: (cfg) => [
      `docker build -t ${cfg.projectName || 'app'}:latest .`,
      `docker run -d -p 3000:3000 --name ${cfg.projectName || 'app'} ${cfg.projectName || 'app'}:latest`,
    ],
  },
  {
    id: 'ghpages',
    name: 'GitHub Pages',
    description: 'Deploy static site to GitHub Pages',
    icon: <GhPagesIcon />,
    accentColor: '#a371f7',
    buildCommands: (cfg) => [
      cfg.buildCommand,
      `npx gh-pages -d ${cfg.outputDir} -m "Deploy from Kyro IDE"`,
    ],
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'kyro-recent-deployments';

function loadRecentDeployments(): RecentDeployment[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as RecentDeployment[]) : [];
  } catch {
    return [];
  }
}

function saveRecentDeployments(list: RecentDeployment[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, 5)));
  } catch {
    // localStorage unavailable (e.g. SSR)
  }
}

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: DeployStatus }) {
  const map: Record<DeployStatus, { label: string; className: string }> = {
    idle:      { label: 'Idle',      className: 'bg-[#21262d] text-[#8b949e]' },
    deploying: { label: 'Deploying', className: 'bg-[#1f2d3d] text-[#58a6ff]' },
    success:   { label: 'Success',   className: 'bg-[#122720] text-[#2ea043]' },
    error:     { label: 'Error',     className: 'bg-[#2d1215] text-[#f85149]' },
  };
  const { label, className } = map[status];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${className}`}>
      {status === 'deploying' && <Loader2 size={11} className="animate-spin" />}
      {status === 'success'   && <CheckCircle size={11} />}
      {status === 'error'     && <XCircle size={11} />}
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function DeployPanel() {
  const [config, setConfig] = useState<DeploymentConfig>({
    projectName: '',
    buildCommand: 'npm run build',
    outputDir: 'out',
  });
  const [configOpen, setConfigOpen] = useState(false);

  const [platformStates, setPlatformStates] = useState<Record<PlatformId, PlatformState>>(() =>
    Object.fromEntries(
      PLATFORMS.map((p) => [p.id, { status: 'idle', logs: '', url: '', logsOpen: false }])
    ) as Record<PlatformId, PlatformState>
  );

  const [recentDeployments, setRecentDeployments] = useState<RecentDeployment[]>([]);
  const logRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});

  useEffect(() => {
    setRecentDeployments(loadRecentDeployments());
  }, []);

  // Auto-scroll logs
  useEffect(() => {
    PLATFORMS.forEach(({ id }) => {
      const el = logRefs.current[id];
      if (el) el.scrollTop = el.scrollHeight;
    });
  }, [platformStates]);

  const appendLog = useCallback((id: PlatformId, text: string) => {
    setPlatformStates((prev) => ({
      ...prev,
      [id]: { ...prev[id], logs: prev[id].logs + text, logsOpen: true },
    }));
  }, []);

  const runCommands = useCallback(
    async (platform: PlatformDef) => {
      const { id } = platform;
      const commands = platform.buildCommands(config);

      setPlatformStates((prev) => ({
        ...prev,
        [id]: { ...prev[id], status: 'deploying', logs: '', url: '', logsOpen: true },
      }));

      let succeeded = true;

      for (const cmd of commands) {
        appendLog(id, `$ ${cmd}\n`);
        try {
          const result = await invoke<InvokeResult>('run_terminal_command', { command: cmd });
          appendLog(id, result.output ? result.output + '\n' : '');
          if (result.exit_code !== 0) {
            appendLog(id, `\n⚠️  Command exited with code ${result.exit_code}\n`);
            succeeded = false;
            break;
          }
        } catch {
          // Tauri desktop runtime is unavailable (running in browser mode).
          // Deployment has NOT been executed — show the command for manual use.
          appendLog(
            id,
            `[Browser mode – Tauri runtime not available]\n` +
            `Deployment did not run. To deploy manually, open a terminal and run:\n\n` +
            `  ${cmd}\n\n`
          );
          // Mark as failed so the error banner is shown and no phantom URL is emitted.
          succeeded = false;
          break;
        }
      }

      const deployedUrl = deriveUrl(id, config.projectName);

      setPlatformStates((prev) => ({
        ...prev,
        [id]: {
          ...prev[id],
          status: succeeded ? 'success' : 'error',
          url: succeeded ? deployedUrl : '',
        },
      }));

      const record: RecentDeployment = {
        id: `${id}-${Date.now()}`,
        platform: id,
        platformName: platform.name,
        timestamp: Date.now(),
        status: succeeded ? 'success' : 'error',
        url: succeeded ? deployedUrl : undefined,
      };

      setRecentDeployments((prev) => {
        const updated = [record, ...prev].slice(0, 5);
        saveRecentDeployments(updated);
        return updated;
      });
    },
    [config, appendLog]
  );

  const clearRecentDeployments = useCallback(() => {
    setRecentDeployments([]);
    saveRecentDeployments([]);
  }, []);

  const toggleLogs = useCallback((id: PlatformId) => {
    setPlatformStates((prev) => ({
      ...prev,
      [id]: { ...prev[id], logsOpen: !prev[id].logsOpen },
    }));
  }, []);

  return (
    <div className="h-full flex flex-col bg-[#0d1117] text-[#c9d1d9]">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#30363d] flex items-center gap-2 shrink-0">
        <Rocket size={18} className="text-[#8b949e]" />
        <h3 className="font-medium text-[#c9d1d9]">Deploy</h3>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* ── Configuration ───────────────────────────────────────────── */}
        <section className="border-b border-[#30363d]">
          <button
            onClick={() => setConfigOpen((v) => !v)}
            className="w-full px-4 py-2.5 flex items-center gap-2 text-sm text-[#8b949e] hover:bg-[#161b22] transition-colors"
          >
            <Settings size={14} />
            <span>Deployment Configuration</span>
            <span className="ml-auto">
              {configOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </span>
          </button>

          {configOpen && (
            <div className="px-4 pb-4 space-y-3 bg-[#0d1117]">
              <ConfigField
                label="Project name"
                placeholder="my-app"
                value={config.projectName}
                onChange={(v) => setConfig((c) => ({ ...c, projectName: v }))}
              />
              <ConfigField
                label="Build command"
                placeholder="npm run build"
                value={config.buildCommand}
                onChange={(v) => setConfig((c) => ({ ...c, buildCommand: v }))}
              />
              <ConfigField
                label="Output directory"
                placeholder="out"
                value={config.outputDir}
                onChange={(v) => setConfig((c) => ({ ...c, outputDir: v }))}
              />
            </div>
          )}
        </section>

        {/* ── Deploy targets ─────────────────────────────────────────── */}
        <section className="p-4 space-y-3">
          <h4 className="text-xs font-semibold text-[#8b949e] uppercase tracking-wider mb-3">
            Deployment Targets
          </h4>
          {PLATFORMS.map((platform) => (
            <PlatformCard
              key={platform.id}
              platform={platform}
              state={platformStates[platform.id]}
              onDeploy={() => runCommands(platform)}
              onToggleLogs={() => toggleLogs(platform.id)}
              logRef={(el) => { logRefs.current[platform.id] = el; }}
            />
          ))}
        </section>

        {/* ── Recent deployments ────────────────────────────────────── */}
        <section className="px-4 pb-6">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-semibold text-[#8b949e] uppercase tracking-wider">
              Recent Deployments
            </h4>
            {recentDeployments.length > 0 && (
              <button
                onClick={clearRecentDeployments}
                className="flex items-center gap-1 text-xs text-[#8b949e] hover:text-[#f85149] transition-colors"
                title="Clear history"
              >
                <Trash2 size={12} />
                Clear
              </button>
            )}
          </div>

          {recentDeployments.length === 0 ? (
            <p className="text-xs text-[#484f58] italic">No deployments yet.</p>
          ) : (
            <div className="space-y-2">
              {recentDeployments.map((d) => (
                <RecentDeploymentRow key={d.id} deployment={d} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PlatformCard
// ---------------------------------------------------------------------------

interface PlatformCardProps {
  platform: PlatformDef;
  state: PlatformState;
  onDeploy: () => void;
  onToggleLogs: () => void;
  logRef: (el: HTMLTextAreaElement | null) => void;
}

function PlatformCard({ platform, state, onDeploy, onToggleLogs, logRef }: PlatformCardProps) {
  const isDeploying = state.status === 'deploying';
  const hasLogs = state.logs.length > 0;

  return (
    <div className="rounded-lg border border-[#30363d] bg-[#161b22] overflow-hidden">
      {/* Card header */}
      <div className="px-4 py-3 flex items-center gap-3">
        {/* Icon */}
        <span style={{ color: platform.accentColor }} className="shrink-0">
          {platform.icon}
        </span>

        {/* Name + description */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[#c9d1d9]">{platform.name}</p>
          <p className="text-xs text-[#8b949e] truncate">{platform.description}</p>
        </div>

        {/* Status badge */}
        <StatusBadge status={state.status} />

        {/* Deploy button */}
        <button
          onClick={onDeploy}
          disabled={isDeploying}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors shrink-0 ${
            isDeploying
              ? 'bg-[#21262d] text-[#484f58] cursor-not-allowed'
              : 'bg-[#238636] hover:bg-[#2ea043] text-white'
          }`}
        >
          {isDeploying ? (
            <><Loader2 size={12} className="animate-spin" />Deploying…</>
          ) : (
            <><Rocket size={12} />Deploy</>
          )}
        </button>
      </div>

      {/* Deployment URL */}
      {state.status === 'success' && state.url && (
        <div className="px-4 py-2 bg-[#122720] border-t border-[#30363d] flex items-center gap-2">
          <CheckCircle size={13} className="text-[#2ea043] shrink-0" />
          <a
            href={state.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[#58a6ff] hover:underline truncate flex items-center gap-1"
          >
            {state.url}
            <ExternalLink size={11} />
          </a>
        </div>
      )}

      {/* Error banner */}
      {state.status === 'error' && (
        <div className="px-4 py-2 bg-[#2d1215] border-t border-[#30363d] flex items-center gap-2">
          <XCircle size={13} className="text-[#f85149] shrink-0" />
          <span className="text-xs text-[#f85149]">Deployment failed — see logs below.</span>
        </div>
      )}

      {/* Logs toggle */}
      {hasLogs && (
        <div className="border-t border-[#30363d]">
          <button
            onClick={onToggleLogs}
            className="w-full px-4 py-1.5 flex items-center gap-1.5 text-xs text-[#8b949e] hover:bg-[#21262d] transition-colors"
          >
            <TerminalSquare size={12} />
            <span>Logs</span>
            <span className="ml-auto">
              {state.logsOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </span>
          </button>

          {state.logsOpen && (
            <textarea
              ref={logRef}
              readOnly
              value={state.logs}
              rows={8}
              className="w-full bg-[#0d1117] text-[#8b949e] text-xs font-mono p-3 border-t border-[#30363d] resize-none focus:outline-none"
              aria-label={`${platform.name} deployment logs`}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// RecentDeploymentRow
// ---------------------------------------------------------------------------

function RecentDeploymentRow({ deployment }: { deployment: RecentDeployment }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-md bg-[#161b22] border border-[#30363d] text-xs">
      {/* Status icon */}
      {deployment.status === 'success' ? (
        <CheckCircle size={13} className="text-[#2ea043] shrink-0" />
      ) : (
        <XCircle size={13} className="text-[#f85149] shrink-0" />
      )}

      {/* Platform name */}
      <span className="font-medium text-[#c9d1d9] w-24 shrink-0">{deployment.platformName}</span>

      {/* Time */}
      <span className="text-[#8b949e] flex items-center gap-1">
        <Clock size={11} />
        {formatRelativeTime(deployment.timestamp)}
      </span>

      {/* URL */}
      {deployment.url && (
        <a
          href={deployment.url}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto text-[#58a6ff] hover:underline flex items-center gap-1 truncate max-w-[180px]"
        >
          {deployment.url}
          <ExternalLink size={10} />
        </a>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ConfigField (inline helper)
// ---------------------------------------------------------------------------

interface ConfigFieldProps {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}

function ConfigField({ label, placeholder, value, onChange }: ConfigFieldProps) {
  return (
    <div>
      <label className="block text-xs text-[#8b949e] mb-1">{label}</label>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-[#0d1117] border border-[#30363d] rounded px-3 py-1.5 text-sm text-[#c9d1d9] placeholder-[#484f58] focus:outline-none focus:border-[#58a6ff] transition-colors"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Utility – derive a plausible deployment URL per platform.
//
// NOTE: These are best-guess placeholder URLs derived from the project name.
// The actual subdomain assigned by Vercel/Netlify may differ (they append a
// unique hash). For GitHub Pages the 'username' segment must be replaced with
// the real GitHub account name. For Docker the host/port depends on the
// runtime environment. These URLs are shown as a convenience starting point
// and should be updated once the CLI output confirms the real address.
// ---------------------------------------------------------------------------

function deriveUrl(platform: PlatformId, projectName: string): string {
  const slug = (projectName || 'my-app').toLowerCase().replace(/[^a-z0-9-]/g, '-');
  switch (platform) {
    case 'vercel':  return `https://${slug}.vercel.app`;
    case 'netlify': return `https://${slug}.netlify.app`;
    case 'docker':  return `http://localhost:3000`;
    // Replace 'username' with your actual GitHub account name.
    case 'ghpages': return `https://username.github.io/${slug}`;
  }
}
