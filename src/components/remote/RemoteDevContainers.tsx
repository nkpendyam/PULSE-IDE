'use client';

import React, { useState, useCallback } from 'react';
import { Monitor, Container, Plus, Trash2, Play, Square, RefreshCw, Wifi, WifiOff, Server, ChevronDown, ChevronRight, FolderOpen } from 'lucide-react';

export type ConnectionType = 'ssh' | 'devcontainer' | 'wsl';

export interface RemoteConnection {
  id: string;
  name: string;
  type: ConnectionType;
  host: string;
  status: 'connected' | 'disconnected' | 'connecting';
  lastConnected?: number;
  config: Record<string, string>;
}

interface RemoteDevContainersProps {
  projectPath: string;
}

const DEFAULT_DEVCONTAINER = {
  name: 'Kyro Dev Container',
  image: 'mcr.microsoft.com/devcontainers/typescript-node:20',
  features: {
    'ghcr.io/devcontainers/features/rust:1': {},
  },
  forwardPorts: [3000, 1420],
  customizations: {
    vscode: {
      extensions: ['rust-lang.rust-analyzer', 'tauri-apps.tauri-vscode'],
    },
  },
};

export function RemoteDevContainers({ projectPath }: RemoteDevContainersProps) {
  const [connections, setConnections] = useState<RemoteConnection[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newConn, setNewConn] = useState({ name: '', type: 'ssh' as ConnectionType, host: '' });
  const [expandedSection, setExpandedSection] = useState<string | null>('connections');
  const [devcontainerExists, setDevcontainerExists] = useState(false);
  const isDesktop = typeof window !== 'undefined' && !!window.__TAURI__;

  const handleConnect = useCallback(async (id: string) => {
    if (!isDesktop) {
      setError('Remote connections require the desktop Tauri runtime and are not available in browser-only mode.');
      return;
    }

    setConnections(prev =>
      prev.map(c => c.id === id ? { ...c, status: 'connecting' as const } : c)
    );

    try {
      const tauri = window.__TAURI__;
      if (!tauri) {
        setError('Desktop runtime is unavailable.');
        return;
      }

      const conn = connections.find(c => c.id === id);
      if (conn) {
        const remote = await tauri.core.invoke<{ connectionId: string }>('remote_connect', {
          connectionType: conn.type,
          host: conn.host,
          config: conn.config,
        });

        setConnections(prev =>
          prev.map(c => c.id === id
            ? { ...c, id: remote.connectionId, status: 'connected' as const, lastConnected: Date.now() }
            : c)
        );
      }
      setError(null);
    } catch (e) {
      setError(String(e));
      setConnections(prev =>
        prev.map(c => c.id === id ? { ...c, status: 'disconnected' as const } : c)
      );
    }
  }, [connections, isDesktop]);

  const handleDisconnect = useCallback(async (id: string) => {
    if (!isDesktop) {
      setError('Remote disconnect requires desktop runtime.');
      return;
    }

    try {
      const tauri = window.__TAURI__;
      if (!tauri) {
        setError('Desktop runtime is unavailable.');
        return;
      }

      await tauri.core.invoke('remote_disconnect', { connectionId: id });
      setError(null);
    } catch (e) {
      setError(String(e));
    }

    setConnections(prev =>
      prev.map(c => c.id === id ? { ...c, status: 'disconnected' as const } : c)
    );
  }, [isDesktop]);

  const handleRemove = useCallback((id: string) => {
    setConnections(prev => prev.filter(c => c.id !== id));
  }, []);

  const handleAdd = useCallback(() => {
    if (!newConn.name.trim() || !newConn.host.trim()) return;
    const conn: RemoteConnection = {
      id: `conn-${Date.now()}`,
      name: newConn.name,
      type: newConn.type,
      host: newConn.host,
      status: 'disconnected',
      config: {},
    };
    setConnections(prev => [...prev, conn]);
    setNewConn({ name: '', type: 'ssh', host: '' });
    setShowAddForm(false);
  }, [newConn]);

  const handleCreateDevcontainer = useCallback(async () => {
    if (!isDesktop) {
      setError('Creating devcontainers requires desktop runtime file APIs.');
      return;
    }

    try {
      const tauri = window.__TAURI__;
      if (!tauri) {
        setError('Desktop runtime is unavailable.');
        return;
      }

      await tauri.core.invoke('write_file', {
        path: `${projectPath}/.devcontainer/devcontainer.json`,
        content: JSON.stringify(DEFAULT_DEVCONTAINER, null, 2),
      });
      setDevcontainerExists(true);
      setError(null);
    } catch (e) {
      setError(String(e));
    }
  }, [projectPath, isDesktop]);

  const statusIcon = (status: RemoteConnection['status']) => {
    switch (status) {
      case 'connected': return <Wifi size={12} className="text-[#3fb950]" />;
      case 'connecting': return <RefreshCw size={12} className="text-[#d29922] animate-spin" />;
      case 'disconnected': return <WifiOff size={12} className="text-[#8b949e]" />;
    }
  };

  const typeIcon = (type: ConnectionType) => {
    switch (type) {
      case 'ssh': return <Server size={14} />;
      case 'devcontainer': return <Container size={14} />;
      case 'wsl': return <Monitor size={14} />;
    }
  };

  return (
    <div className="flex flex-col h-full text-sm">
      {!isDesktop && (
        <div className="mx-2 mt-2 mb-1 rounded border border-[#d29922]/40 bg-[#d29922]/10 px-2 py-1.5 text-xs text-[#d29922]">
          Browser mode detected: remote SSH/WSL/devcontainer operations require the desktop app.
        </div>
      )}

      {error && (
        <div className="mx-2 mt-2 mb-1 rounded border border-[#f85149]/40 bg-[#f85149]/10 px-2 py-1.5 text-xs text-[#f85149]">
          {error}
        </div>
      )}

      {/* Remote Connections Section */}
      <button
        onClick={() => setExpandedSection(expandedSection === 'connections' ? null : 'connections')}
        className="flex items-center gap-1 px-3 py-2 text-xs font-medium text-[#8b949e] hover:text-[#c9d1d9] hover:bg-[#161b22]"
      >
        {expandedSection === 'connections' ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <Server size={12} className="text-[#58a6ff]" />
        REMOTE CONNECTIONS
      </button>

      {expandedSection === 'connections' && (
        <div className="px-2 pb-2">
          {connections.length === 0 ? (
            <div className="text-xs text-[#8b949e] px-2 py-3 text-center">
              No remote connections configured.
            </div>
          ) : (
            <div className="space-y-1">
              {connections.map(conn => (
                <div key={conn.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[#161b22] group">
                  {typeIcon(conn.type)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="text-xs truncate">{conn.name}</span>
                      {statusIcon(conn.status)}
                    </div>
                    <div className="text-[10px] text-[#8b949e] truncate">{conn.host}</div>
                  </div>
                  <div className="hidden group-hover:flex items-center gap-1">
                    {conn.status === 'disconnected' ? (
                      <button onClick={() => handleConnect(conn.id)} className="p-1 hover:bg-[#21262d] rounded" title="Connect">
                        <Play size={12} className="text-[#3fb950]" />
                      </button>
                    ) : conn.status === 'connected' ? (
                      <button onClick={() => handleDisconnect(conn.id)} className="p-1 hover:bg-[#21262d] rounded" title="Disconnect">
                        <Square size={12} className="text-[#f85149]" />
                      </button>
                    ) : null}
                    <button onClick={() => handleRemove(conn.id)} className="p-1 hover:bg-[#21262d] rounded" title="Remove">
                      <Trash2 size={12} className="text-[#8b949e]" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add Connection Form */}
          {showAddForm ? (
            <div className="mt-2 p-2 bg-[#161b22] rounded border border-[#30363d]">
              <input
                value={newConn.name}
                onChange={e => setNewConn(p => ({ ...p, name: e.target.value }))}
                placeholder="Connection name"
                className="w-full bg-[#0d1117] border border-[#30363d] rounded px-2 py-1 text-xs mb-1.5 focus:outline-none focus:border-[#58a6ff]"
              />
              <select
                value={newConn.type}
                onChange={e => setNewConn(p => ({ ...p, type: e.target.value as ConnectionType }))}
                className="w-full bg-[#0d1117] border border-[#30363d] rounded px-2 py-1 text-xs mb-1.5 focus:outline-none focus:border-[#58a6ff]"
              >
                <option value="ssh">SSH Remote</option>
                <option value="devcontainer">Dev Container</option>
                <option value="wsl">WSL</option>
              </select>
              <input
                value={newConn.host}
                onChange={e => setNewConn(p => ({ ...p, host: e.target.value }))}
                placeholder={newConn.type === 'ssh' ? 'user@hostname' : newConn.type === 'wsl' ? 'distro name' : 'container image'}
                className="w-full bg-[#0d1117] border border-[#30363d] rounded px-2 py-1 text-xs mb-2 focus:outline-none focus:border-[#58a6ff]"
              />
              <div className="flex gap-1">
                <button onClick={handleAdd} className="flex-1 px-2 py-1 bg-[#238636] hover:bg-[#2ea043] text-white text-xs rounded">Add</button>
                <button onClick={() => setShowAddForm(false)} className="flex-1 px-2 py-1 bg-[#21262d] hover:bg-[#30363d] text-xs rounded">Cancel</button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowAddForm(true)}
              className="mt-1 w-full flex items-center justify-center gap-1 px-2 py-1.5 text-xs text-[#58a6ff] hover:bg-[#161b22] rounded border border-dashed border-[#30363d]"
            >
              <Plus size={12} /> Add Connection
            </button>
          )}
        </div>
      )}

      {/* Dev Containers Section */}
      <button
        onClick={() => setExpandedSection(expandedSection === 'devcontainer' ? null : 'devcontainer')}
        className="flex items-center gap-1 px-3 py-2 text-xs font-medium text-[#8b949e] hover:text-[#c9d1d9] hover:bg-[#161b22] border-t border-[#30363d]"
      >
        {expandedSection === 'devcontainer' ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <Container size={12} className="text-[#a371f7]" />
        DEV CONTAINERS
      </button>

      {expandedSection === 'devcontainer' && (
        <div className="px-3 pb-3">
          {devcontainerExists ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 p-2 bg-[#161b22] rounded border border-[#30363d]">
                <Container size={14} className="text-[#a371f7]" />
                <div className="flex-1">
                  <div className="text-xs font-medium">{DEFAULT_DEVCONTAINER.name}</div>
                  <div className="text-[10px] text-[#8b949e]">{DEFAULT_DEVCONTAINER.image}</div>
                </div>
              </div>
              <button className="w-full flex items-center justify-center gap-1 px-2 py-1.5 text-xs bg-[#238636] hover:bg-[#2ea043] text-white rounded">
                <Play size={12} /> Open in Container
              </button>
              <button
                onClick={() => {
                  const path = `${projectPath}/.devcontainer/devcontainer.json`;
                  window.dispatchEvent(new CustomEvent('kyro:openFile', { detail: { path } }));
                }}
                className="w-full flex items-center justify-center gap-1 px-2 py-1.5 text-xs hover:bg-[#161b22] rounded border border-[#30363d]"
              >
                <FolderOpen size={12} /> Edit devcontainer.json
              </button>
            </div>
          ) : (
            <div className="text-center py-4">
              <Container size={24} className="mx-auto mb-2 text-[#8b949e] opacity-50" />
              <p className="text-xs text-[#8b949e] mb-3">No devcontainer.json found</p>
              <button
                onClick={handleCreateDevcontainer}
                className="px-3 py-1.5 text-xs bg-[#238636] hover:bg-[#2ea043] text-white rounded"
              >
                Create Dev Container Config
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
