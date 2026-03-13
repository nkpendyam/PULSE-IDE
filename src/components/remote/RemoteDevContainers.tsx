'use client';

import React, { useState, useCallback, useEffect, useMemo } from 'react';
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

interface RemoteCapabilities {
  supportsSsh: boolean;
  supportsWsl: boolean;
  supportsDevcontainer: boolean;
  notes: string[];
}

interface RemoteExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
}

interface RemoteFileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size?: number;
}

interface BackendRemoteConnection {
  connectionId: string;
  connectionType: ConnectionType;
  host: string;
  status: 'connected' | 'disconnected' | 'connecting';
  connectedAt: string;
  config: Record<string, string>;
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
  const [capabilities, setCapabilities] = useState<RemoteCapabilities | null>(null);
  const [remoteCommand, setRemoteCommand] = useState('pwd');
  const [execOutput, setExecOutput] = useState<RemoteExecResult | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [remotePath, setRemotePath] = useState('.');
  const [remoteFiles, setRemoteFiles] = useState<RemoteFileEntry[]>([]);
  const [isListingFiles, setIsListingFiles] = useState(false);
  const [selectedRemoteFilePath, setSelectedRemoteFilePath] = useState<string | null>(null);
  const [remoteFilePreview, setRemoteFilePreview] = useState<string>('');
  const [isReadingFile, setIsReadingFile] = useState(false);
  const [isWritingFile, setIsWritingFile] = useState(false);
  const [localExportDir, setLocalExportDir] = useState(`${projectPath || '.'}/download`);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newConn, setNewConn] = useState({ name: '', type: 'ssh' as ConnectionType, host: '' });
  const [expandedSection, setExpandedSection] = useState<string | null>('connections');
  const [devcontainerExists, setDevcontainerExists] = useState(false);
  const isDesktop = typeof window !== 'undefined' && !!window.__TAURI__;

  const connectedConnections = useMemo(
    () => connections.filter(c => c.status === 'connected'),
    [connections]
  );

  const selectedConnectionId = connectedConnections[0]?.id ?? null;

  useEffect(() => {
    if (!isDesktop || !window.__TAURI__) {
      return;
    }

    const tauri = window.__TAURI__;

    tauri.core.invoke<RemoteCapabilities>('remote_get_capabilities')
      .then(setCapabilities)
      .catch((e) => setError(String(e)));

    tauri.core.invoke<BackendRemoteConnection[]>('list_remote_connections')
      .then((backendConnections) => {
        const hydrated = backendConnections.map((conn) => ({
          id: conn.connectionId,
          name: `${conn.connectionType.toUpperCase()} ${conn.host}`,
          type: conn.connectionType,
          host: conn.host,
          status: conn.status,
          lastConnected: Date.parse(conn.connectedAt),
          config: conn.config,
        }));
        setConnections(hydrated);
      })
      .catch(() => {
        // Keep local state fallback
      });

    tauri.core.invoke<Array<{
      id: string;
      name: string;
      connectionType: ConnectionType;
      host: string;
      config: Record<string, string>;
      lastConnected?: number;
    }>>('remote_list_profiles')
      .then((profiles) => {
        setConnections((existing) => {
          const existingById = new Map(existing.map(c => [c.id, c]));
          const fromProfiles: RemoteConnection[] = profiles.map((profile) => {
            const connected = existingById.get(profile.id);
            if (connected) return connected;
            return {
              id: profile.id,
              name: profile.name,
              type: profile.connectionType,
              host: profile.host,
              status: 'disconnected',
              lastConnected: profile.lastConnected,
              config: profile.config || {},
            };
          });
          return fromProfiles.length > 0 ? fromProfiles : existing;
        });
      })
      .catch(() => {
        // non-fatal
      });
  }, [isDesktop]);

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
          connectionId: conn.id,
          connectionType: conn.type,
          host: conn.host,
          config: conn.config,
        });

        setConnections(prev =>
          prev.map(c => c.id === id
            ? { ...c, id: remote.connectionId, status: 'connected' as const, lastConnected: Date.now() }
            : c)
        );

        await tauri.core.invoke('remote_save_profile', {
          id: remote.connectionId,
          name: conn.name,
          connectionType: conn.type,
          host: conn.host,
          config: conn.config,
          lastConnected: Date.now(),
        });
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
    if (isDesktop && window.__TAURI__) {
      window.__TAURI__.core.invoke('remote_remove_profile', { id }).catch(() => {
        // best effort
      });
    }
    if (selectedRemoteFilePath && selectedRemoteFilePath.startsWith(id)) {
      setSelectedRemoteFilePath(null);
      setRemoteFilePreview('');
    }
  }, [isDesktop, selectedRemoteFilePath]);

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
    if (isDesktop && window.__TAURI__) {
      window.__TAURI__.core.invoke('remote_save_profile', {
        id: conn.id,
        name: conn.name,
        connectionType: conn.type,
        host: conn.host,
        config: conn.config,
        lastConnected: conn.lastConnected ?? null,
      }).catch(() => {
        // best effort
      });
    }
    setNewConn({ name: '', type: 'ssh', host: '' });
    setShowAddForm(false);
  }, [newConn, isDesktop]);

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

  const handleExecuteRemoteCommand = useCallback(async () => {
    if (!isDesktop || !window.__TAURI__) {
      setError('Remote command execution requires desktop runtime.');
      return;
    }

    if (!selectedConnectionId) {
      setError('Connect to a remote target first.');
      return;
    }

    if (!remoteCommand.trim()) {
      setError('Enter a command to run.');
      return;
    }

    setIsExecuting(true);
    setError(null);

    try {
      const result = await window.__TAURI__.core.invoke<RemoteExecResult>('remote_execute_command', {
        connectionId: selectedConnectionId,
        command: remoteCommand,
        cwd: projectPath || null,
      });
      setExecOutput(result);
    } catch (e) {
      setError(String(e));
    } finally {
      setIsExecuting(false);
    }
  }, [isDesktop, projectPath, remoteCommand, selectedConnectionId]);

  const handleListRemoteFiles = useCallback(async () => {
    if (!isDesktop || !window.__TAURI__) {
      setError('Remote file listing requires desktop runtime.');
      return;
    }
    if (!selectedConnectionId) {
      setError('Connect to a remote target first.');
      return;
    }

    setIsListingFiles(true);
    setError(null);
    try {
      const files = await window.__TAURI__.core.invoke<RemoteFileEntry[]>('remote_list_files', {
        connectionId: selectedConnectionId,
        path: remotePath,
      });
      setRemoteFiles(files);
    } catch (e) {
      setError(String(e));
    } finally {
      setIsListingFiles(false);
    }
  }, [isDesktop, selectedConnectionId, remotePath]);

  const handleNavigateRemoteDir = useCallback(async (path: string) => {
    setRemotePath(path);
    if (!isDesktop || !window.__TAURI__ || !selectedConnectionId) return;

    setIsListingFiles(true);
    setError(null);
    try {
      const files = await window.__TAURI__.core.invoke<RemoteFileEntry[]>('remote_list_files', {
        connectionId: selectedConnectionId,
        path,
      });
      setRemoteFiles(files);
    } catch (e) {
      setError(String(e));
    } finally {
      setIsListingFiles(false);
    }
  }, [isDesktop, selectedConnectionId]);

  const handleNavigateUp = useCallback(() => {
    const trimmed = remotePath.replace(/\/+$/, '');
    if (trimmed === '.' || trimmed === '' || trimmed === '/') {
      void handleNavigateRemoteDir('.');
      return;
    }

    const idx = trimmed.lastIndexOf('/');
    const parent = idx <= 0 ? '.' : trimmed.slice(0, idx);
    void handleNavigateRemoteDir(parent);
  }, [handleNavigateRemoteDir, remotePath]);

  const handleOpenRemoteFile = useCallback(async (path: string) => {
    if (!isDesktop || !window.__TAURI__) {
      setError('Remote file preview requires desktop runtime.');
      return;
    }
    if (!selectedConnectionId) {
      setError('Connect to a remote target first.');
      return;
    }

    setIsReadingFile(true);
    setSelectedRemoteFilePath(path);
    setError(null);
    try {
      const content = await window.__TAURI__.core.invoke<string>('remote_read_file', {
        connectionId: selectedConnectionId,
        path,
      });
      setRemoteFilePreview(content);
    } catch (e) {
      setError(String(e));
      setRemoteFilePreview('');
    } finally {
      setIsReadingFile(false);
    }
  }, [isDesktop, selectedConnectionId]);

  const handleSaveRemotePreview = useCallback(async () => {
    if (!isDesktop || !window.__TAURI__) {
      setError('Remote file save requires desktop runtime.');
      return;
    }
    if (!selectedConnectionId || !selectedRemoteFilePath) {
      setError('Select a remote file first.');
      return;
    }

    setIsWritingFile(true);
    setError(null);
    try {
      await window.__TAURI__.core.invoke('remote_write_file', {
        connectionId: selectedConnectionId,
        path: selectedRemoteFilePath,
        content: remoteFilePreview,
      });
    } catch (e) {
      setError(String(e));
    } finally {
      setIsWritingFile(false);
    }
  }, [isDesktop, remoteFilePreview, selectedConnectionId, selectedRemoteFilePath]);

  const handleOpenInEditor = useCallback(() => {
    if (!selectedConnectionId || !selectedRemoteFilePath) {
      setError('Select a remote file first.');
      return;
    }

    const remoteUri = `remote://${selectedConnectionId}/${selectedRemoteFilePath}`;
    window.dispatchEvent(new CustomEvent('kyro:openRemoteFile', {
      detail: {
        path: remoteUri,
        content: remoteFilePreview,
        remoteConnectionId: selectedConnectionId,
        remotePath: selectedRemoteFilePath,
      },
    }));
  }, [remoteFilePreview, selectedConnectionId, selectedRemoteFilePath]);

  const handleExportRemoteFile = useCallback(async () => {
    if (!isDesktop || !window.__TAURI__) {
      setError('Export requires desktop runtime.');
      return;
    }
    if (!selectedConnectionId || !selectedRemoteFilePath) {
      setError('Select a remote file first.');
      return;
    }
    if (!localExportDir.trim()) {
      setError('Set a local export directory.');
      return;
    }

    const filename = selectedRemoteFilePath.split('/').pop() || 'remote-file.txt';
    const localPath = `${localExportDir.replace(/\\/g, '/')}/${filename}`;

    setIsExporting(true);
    setError(null);
    try {
      await window.__TAURI__.core.invoke('remote_export_file_to_local', {
        connectionId: selectedConnectionId,
        remotePath: selectedRemoteFilePath,
        localPath,
      });
    } catch (e) {
      setError(String(e));
    } finally {
      setIsExporting(false);
    }
  }, [isDesktop, localExportDir, selectedConnectionId, selectedRemoteFilePath]);

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

      {capabilities && (
        <div className="mx-2 mt-2 mb-1 rounded border border-[#30363d] bg-[#161b22] px-2 py-1.5 text-xs text-[#8b949e]">
          <div className="mb-1 text-[#c9d1d9]">Runtime capabilities</div>
          <div>SSH: {capabilities.supportsSsh ? 'available' : 'missing'} • WSL: {capabilities.supportsWsl ? 'available' : 'missing'} • Devcontainer: {capabilities.supportsDevcontainer ? 'available' : 'missing'}</div>
          {capabilities.notes.length > 0 && (
            <ul className="mt-1 list-disc pl-4 space-y-0.5">
              {capabilities.notes.map((note, idx) => <li key={idx}>{note}</li>)}
            </ul>
          )}
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

          <div className="mt-2 p-2 bg-[#161b22] rounded border border-[#30363d]">
            <div className="text-[10px] uppercase tracking-wide text-[#8b949e] mb-1">Remote Command</div>
            <input
              value={remoteCommand}
              onChange={e => setRemoteCommand(e.target.value)}
              placeholder="e.g. ls -la"
              className="w-full bg-[#0d1117] border border-[#30363d] rounded px-2 py-1 text-xs mb-1.5 focus:outline-none focus:border-[#58a6ff]"
            />
            <button
              onClick={handleExecuteRemoteCommand}
              disabled={isExecuting || !selectedConnectionId}
              className="w-full px-2 py-1.5 text-xs bg-[#238636] hover:bg-[#2ea043] disabled:bg-[#30363d] text-white rounded"
            >
              {isExecuting ? 'Running...' : 'Run on connected target'}
            </button>

            {execOutput && (
              <div className="mt-2 rounded border border-[#30363d] bg-[#0d1117] p-2 text-[11px] text-[#c9d1d9]">
                <div className="text-[#8b949e] mb-1">Exit {execOutput.exitCode} • {execOutput.durationMs} ms</div>
                {execOutput.stdout && <pre className="whitespace-pre-wrap mb-1">{execOutput.stdout}</pre>}
                {execOutput.stderr && <pre className="whitespace-pre-wrap text-[#f85149]">{execOutput.stderr}</pre>}
              </div>
            )}
          </div>

          <div className="mt-2 p-2 bg-[#161b22] rounded border border-[#30363d]">
            <div className="text-[10px] uppercase tracking-wide text-[#8b949e] mb-1">Remote Files</div>
            <div className="flex gap-1 mb-1.5">
              <button
                onClick={handleNavigateUp}
                className="px-2 py-1 text-xs bg-[#21262d] hover:bg-[#30363d] text-[#c9d1d9] rounded"
              >
                Up
              </button>
              <div className="flex-1 bg-[#0d1117] border border-[#30363d] rounded px-2 py-1 text-xs text-[#8b949e] truncate">
                {remotePath}
              </div>
            </div>
            <div className="flex gap-1 mb-1.5">
              <input
                value={remotePath}
                onChange={e => setRemotePath(e.target.value)}
                placeholder="Path (e.g. . or /workspace)"
                className="flex-1 bg-[#0d1117] border border-[#30363d] rounded px-2 py-1 text-xs focus:outline-none focus:border-[#58a6ff]"
              />
              <button
                onClick={handleListRemoteFiles}
                disabled={isListingFiles || !selectedConnectionId}
                className="px-2 py-1 text-xs bg-[#21262d] hover:bg-[#30363d] disabled:bg-[#21262d]/50 text-[#c9d1d9] rounded"
              >
                {isListingFiles ? 'Listing...' : 'List'}
              </button>
            </div>

            {remoteFiles.length > 0 && (
              <div className="max-h-36 overflow-y-auto rounded border border-[#30363d] bg-[#0d1117] p-1">
                {remoteFiles.map((entry) => (
                  <button
                    key={entry.path}
                    onClick={() => {
                      if (entry.isDirectory) {
                        void handleNavigateRemoteDir(entry.path);
                      } else {
                        handleOpenRemoteFile(entry.path);
                      }
                    }}
                    className={`w-full text-left px-2 py-1 rounded text-xs ${entry.isDirectory ? 'text-[#58a6ff]' : 'text-[#c9d1d9] hover:bg-[#161b22]'}`}
                  >
                    {entry.isDirectory ? '📁' : '📄'} {entry.name}
                    {!entry.isDirectory && typeof entry.size === 'number' ? ` (${entry.size}B)` : ''}
                  </button>
                ))}
              </div>
            )}

            {selectedRemoteFilePath && (
              <div className="mt-2 rounded border border-[#30363d] bg-[#0d1117] p-2 text-[11px]">
                <div className="text-[#8b949e] mb-1 truncate">{selectedRemoteFilePath}</div>
                {isReadingFile ? (
                  <div className="text-[#8b949e]">Loading...</div>
                ) : (
                  <>
                    <textarea
                      value={remoteFilePreview}
                      onChange={(e) => setRemoteFilePreview(e.target.value)}
                      className="w-full min-h-32 max-h-40 bg-[#0d1117] text-[#c9d1d9] border border-[#30363d] rounded p-2 font-mono"
                    />
                    <div className="mt-2 flex gap-1">
                      <button
                        onClick={handleSaveRemotePreview}
                        disabled={isWritingFile}
                        className="px-2 py-1 text-xs bg-[#238636] hover:bg-[#2ea043] disabled:bg-[#30363d] text-white rounded"
                      >
                        {isWritingFile ? 'Saving...' : 'Save to Remote'}
                      </button>
                      <button
                        onClick={handleOpenInEditor}
                        className="px-2 py-1 text-xs bg-[#21262d] hover:bg-[#30363d] text-[#c9d1d9] rounded"
                      >
                        Open in Editor
                      </button>
                    </div>

                    <div className="mt-2 flex gap-1 items-center">
                      <input
                        value={localExportDir}
                        onChange={(e) => setLocalExportDir(e.target.value)}
                        className="flex-1 bg-[#0d1117] border border-[#30363d] rounded px-2 py-1 text-xs text-[#c9d1d9]"
                        placeholder="Local export directory"
                      />
                      <button
                        onClick={handleExportRemoteFile}
                        disabled={isExporting}
                        className="px-2 py-1 text-xs bg-[#1f6feb] hover:bg-[#388bfd] disabled:bg-[#30363d] text-white rounded"
                      >
                        {isExporting ? 'Exporting...' : 'Export Local'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
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
