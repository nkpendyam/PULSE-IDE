'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Globe, Plus, ExternalLink, Copy, XCircle, AlertTriangle, Wifi,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────

type Protocol = 'HTTP' | 'HTTPS' | 'TCP';
type Visibility = 'Local' | 'Public';

interface Port {
  id: string;
  port: number;
  protocol: Protocol;
  process: string;
  origin: string;
  visibility: Visibility;
  active: boolean;
  isManual: boolean;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const LS_KEY = 'kyro-ports';
const DEMO_PORTS: Port[] = [
  { id: 'demo-3000', port: 3000, protocol: 'HTTP',  process: 'node',   origin: 'localhost', visibility: 'Local', active: true,  isManual: false },
  { id: 'demo-8080', port: 8080, protocol: 'HTTP',  process: 'server', origin: 'localhost', visibility: 'Local', active: true,  isManual: false },
  { id: 'demo-5173', port: 5173, protocol: 'HTTP',  process: 'vite',   origin: 'localhost', visibility: 'Local', active: true,  isManual: false },
];

function loadManualPorts(): Port[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function saveManualPorts(ports: Port[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(ports));
}

function portColor(port: number): string {
  const colors = [
    'bg-[#1f6feb] text-[#79c0ff]',
    'bg-[#238636] text-[#3fb950]',
    'bg-[#9933cc] text-[#d2a8ff]',
    'bg-[#b45309] text-[#fbbf24]',
    'bg-[#0891b2] text-[#67e8f9]',
    'bg-[#be185d] text-[#f9a8d4]',
  ];
  return colors[port % colors.length];
}

function parsePortsFromOutput(output: string): number[] {
  const ports: number[] = [];
  // Match patterns like 0.0.0.0:3000, :::3000, *:3000
  const regex = /(?:0\.0\.0\.0|::|\*):(\d{2,5})\s/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(output)) !== null) {
    const p = parseInt(m[1], 10);
    if (p > 0 && p <= 65535 && !ports.includes(p)) ports.push(p);
  }
  return ports;
}

// ── Toast ──────────────────────────────────────────────────────────────────────

function useToast() {
  const [toast, setToast] = useState<string | null>(null);

  function show(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }

  return { toast, show };
}

// ── Port Row ───────────────────────────────────────────────────────────────────

interface PortRowProps {
  port: Port;
  onRemove: (id: string) => void;
  onToggleVisibility: (id: string) => void;
  onWarning: (msg: string) => void;
}

function PortRow({ port, onRemove, onToggleVisibility, onWarning }: PortRowProps) {
  function handleOpen() {
    window.open(`${port.protocol.toLowerCase()}://localhost:${port.port}`, '_blank');
  }

  function handleCopy() {
    navigator.clipboard.writeText(`${port.protocol.toLowerCase()}://localhost:${port.port}`).catch(() => {});
  }

  function handleVisibility() {
    if (port.visibility === 'Local') {
      onWarning('Making a port public is not recommended for production.');
    }
    onToggleVisibility(port.id);
  }

  return (
    <tr className="border-b border-[#21262d] hover:bg-[#161b22] transition-colors group">
      {/* Port */}
      <td className="px-3 py-2">
        <div className="flex items-center gap-2">
          {port.active && (
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#3fb950] opacity-60" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#3fb950]" />
            </span>
          )}
          <span className={`font-mono text-xs px-2 py-0.5 rounded ${portColor(port.port)}`}>
            {port.port}
          </span>
        </div>
      </td>
      {/* Protocol */}
      <td className="px-3 py-2 text-xs text-[#8b949e]">{port.protocol}</td>
      {/* Process */}
      <td className="px-3 py-2 text-xs font-mono text-[#8b949e] truncate max-w-[80px]">{port.process}</td>
      {/* Origin */}
      <td className="px-3 py-2 text-xs text-[#484f58]">{port.origin}</td>
      {/* Visibility */}
      <td className="px-3 py-2">
        <button
          onClick={handleVisibility}
          className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
            port.visibility === 'Public'
              ? 'bg-[#d29922]/10 text-[#d29922] border-[#d29922]/30 hover:bg-[#d29922]/20'
              : 'bg-[#21262d] text-[#8b949e] border-[#30363d] hover:border-[#484f58]'
          }`}
        >
          {port.visibility}
        </button>
      </td>
      {/* Status */}
      <td className="px-3 py-2">
        <span className={`text-[10px] px-1.5 py-0.5 rounded ${
          port.active ? 'text-[#3fb950] bg-[#3fb950]/10' : 'text-[#484f58] bg-[#21262d]'
        }`}>
          {port.active ? 'Active' : 'Idle'}
        </span>
      </td>
      {/* Actions */}
      <td className="px-3 py-2">
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={handleOpen}
            title="Open in browser"
            className="p-1 rounded text-[#8b949e] hover:text-[#58a6ff] hover:bg-[#58a6ff]/10 transition-colors"
          >
            <ExternalLink size={12} />
          </button>
          <button
            onClick={handleCopy}
            title="Copy address"
            className="p-1 rounded text-[#8b949e] hover:text-[#c9d1d9] hover:bg-[#21262d] transition-colors"
          >
            <Copy size={12} />
          </button>
          <button
            onClick={() => onRemove(port.id)}
            title="Remove port"
            className="p-1 rounded text-[#8b949e] hover:text-[#f85149] hover:bg-[#f85149]/10 transition-colors"
          >
            <XCircle size={12} />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function PortsPanel() {
  const [ports, setPorts] = useState<Port[]>([]);
  const [newPort, setNewPort] = useState('');
  const [newProtocol, setNewProtocol] = useState<Protocol>('HTTP');
  const [portError, setPortError] = useState('');
  const { toast, show: showToast } = useToast();

  useEffect(() => {
    const manual = loadManualPorts();
    // Try to detect system ports
    (async () => {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const output = await invoke<string>('run_terminal_command', {
          command: 'ss -tlnp 2>/dev/null || netstat -tlnp 2>/dev/null || echo "NO_DATA"',
        });
        if (output && !output.includes('NO_DATA')) {
          const detected = parsePortsFromOutput(output);
          const detectedPorts: Port[] = detected.map(p => ({
            id: `detected-${p}`,
            port: p,
            protocol: p === 443 ? 'HTTPS' : 'HTTP',
            process: 'unknown',
            origin: 'localhost',
            visibility: 'Local',
            active: true,
            isManual: false,
          }));
          setPorts([...detectedPorts, ...manual]);
          return;
        }
      } catch {
        /* Tauri unavailable */
      }
      setPorts([...DEMO_PORTS, ...manual]);
    })();
  }, []);

  function persistManual(all: Port[]) {
    const manual = all.filter(p => p.isManual);
    saveManualPorts(manual);
  }

  const handleAdd = useCallback(() => {
    const num = parseInt(newPort, 10);
    if (!newPort || isNaN(num) || num < 1 || num > 65535) {
      setPortError('Port must be a number between 1 and 65535');
      return;
    }
    if (ports.some(p => p.port === num)) {
      setPortError('This port is already listed');
      return;
    }
    setPortError('');
    const port: Port = {
      id: `manual-${Date.now()}`,
      port: num,
      protocol: newProtocol,
      process: 'manual',
      origin: 'localhost',
      visibility: 'Local',
      active: true,
      isManual: true,
    };
    const updated = [...ports, port];
    setPorts(updated);
    persistManual(updated);
    setNewPort('');
  }, [newPort, newProtocol, ports]);

  function handleRemove(id: string) {
    const updated = ports.filter(p => p.id !== id);
    setPorts(updated);
    persistManual(updated);
  }

  function handleToggleVisibility(id: string) {
    const updated = ports.map(p =>
      p.id === id ? { ...p, visibility: p.visibility === 'Local' ? 'Public' : 'Local' as Visibility } : p,
    );
    setPorts(updated);
    persistManual(updated);
  }

  return (
    <div className="flex flex-col h-full bg-[#0d1117] text-[#c9d1d9] relative">
      {/* Toast */}
      {toast && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-[#d29922] text-black text-xs px-3 py-1.5 rounded shadow-lg">
          <AlertTriangle size={12} />
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#30363d] shrink-0">
        <div className="flex items-center gap-2">
          <Wifi size={14} className="text-[#58a6ff]" />
          <span className="text-xs font-semibold uppercase tracking-wide">Ports</span>
          <span className="text-[10px] bg-[#21262d] text-[#8b949e] px-1.5 py-0.5 rounded-full">
            {ports.length}
          </span>
        </div>
      </div>

      {/* Add port form */}
      <div className="px-3 py-2 border-b border-[#30363d] shrink-0 flex items-start gap-2">
        <div className="flex flex-col flex-1">
          <div className="flex gap-2">
            <input
              type="number"
              className="w-24 bg-[#161b22] border border-[#30363d] rounded px-2 py-1 text-xs text-[#c9d1d9] placeholder-[#484f58] focus:outline-none focus:border-[#58a6ff]"
              placeholder="Port"
              value={newPort}
              min={1}
              max={65535}
              onChange={e => { setNewPort(e.target.value); setPortError(''); }}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
            />
            <select
              className="bg-[#161b22] border border-[#30363d] rounded px-2 py-1 text-xs text-[#c9d1d9] focus:outline-none focus:border-[#58a6ff]"
              value={newProtocol}
              onChange={e => setNewProtocol(e.target.value as Protocol)}
            >
              <option>HTTP</option>
              <option>HTTPS</option>
              <option>TCP</option>
            </select>
            <button
              onClick={handleAdd}
              className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-[#238636]/20 hover:bg-[#238636]/40 text-[#3fb950] border border-[#238636]/30 transition-colors"
            >
              <Plus size={12} />
              Add Port
            </button>
          </div>
          {portError && (
            <p className="text-[10px] text-[#f85149] mt-1">{portError}</p>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {ports.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-[#484f58] gap-2">
            <Globe size={24} className="opacity-40" />
            <p className="text-xs">No ports forwarded. Click + Add Port to forward a port.</p>
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#30363d] text-[#8b949e] text-left">
                <th className="px-3 py-2 font-medium">Port</th>
                <th className="px-3 py-2 font-medium">Protocol</th>
                <th className="px-3 py-2 font-medium">Process</th>
                <th className="px-3 py-2 font-medium">Origin</th>
                <th className="px-3 py-2 font-medium">Visibility</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {ports.map(port => (
                <PortRow
                  key={port.id}
                  port={port}
                  onRemove={handleRemove}
                  onToggleVisibility={handleToggleVisibility}
                  onWarning={showToast}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
