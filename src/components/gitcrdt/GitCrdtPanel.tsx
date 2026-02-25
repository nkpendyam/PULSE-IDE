'use client';

import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { GitBranch, RefreshCw, Upload, Download, Loader2, Check } from 'lucide-react';

interface GitCrdtStatus {
  branch: string;
  ahead: number;
  behind: number;
  uncommitted_changes: number;
  last_sync: string | null;
  is_syncing: boolean;
}

export function GitCrdtPanel() {
  const [status, setStatus] = useState<GitCrdtStatus | null>(null);
  const [commitMsg, setCommitMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [autoCommit, setAutoCommit] = useState(true);

  useEffect(() => {
    invoke<GitCrdtStatus>('git_crdt_status').then(setStatus).catch(() => {});
  }, []);

  const handleSync = async () => {
    setLoading(true);
    try {
      const result = await invoke('git_crdt_sync');
      console.log('Sync result:', result);
      const s = await invoke<GitCrdtStatus>('git_crdt_status');
      setStatus(s);
    } finally { setLoading(false); }
  };

  const handleCommit = async () => {
    if (!commitMsg) return;
    setLoading(true);
    try {
      await invoke('git_crdt_commit', { message: commitMsg });
      setCommitMsg('');
      const s = await invoke<GitCrdtStatus>('git_crdt_status');
      setStatus(s);
    } finally { setLoading(false); }
  };

  const toggleAutoCommit = async () => {
    await invoke('git_crdt_auto_commit', { enabled: !autoCommit });
    setAutoCommit(!autoCommit);
  };

  return (
    <div className="h-full flex flex-col bg-[#0d1117] p-4">
      <h3 className="text-[#c9d1d9] font-medium mb-4 flex items-center gap-2">
        <GitBranch size={18} /> Git CRDT
      </h3>

      {status && (
        <div className="bg-[#161b22] p-3 rounded border border-[#30363d] mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[#58a6ff] font-medium">{status.branch}</span>
            {status.is_syncing && <Loader2 size={14} className="animate-spin text-[#f0883e]" />}
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div>
              <p className="text-[#3fb950] font-bold">{status.ahead}</p>
              <p className="text-[#8b949e]">Ahead</p>
            </div>
            <div>
              <p className="text-[#f0883e] font-bold">{status.behind}</p>
              <p className="text-[#8b949e]">Behind</p>
            </div>
            <div>
              <p className="text-[#a371f7] font-bold">{status.uncommitted_changes}</p>
              <p className="text-[#8b949e]">Changes</p>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-2 mb-4">
        <button onClick={handleSync} disabled={loading}
          className="flex-1 flex items-center justify-center gap-2 py-2 bg-[#238636] hover:bg-[#2ea043] text-white text-sm rounded">
          <RefreshCw size={14} /> Sync
        </button>
      </div>

      <input value={commitMsg} onChange={(e) => setCommitMsg(e.target.value)}
        placeholder="Commit message..."
        className="w-full mb-2 bg-[#161b22] border border-[#30363d] rounded px-3 py-2 text-[#c9d1d9] text-sm" />

      <button onClick={handleCommit} disabled={loading || !commitMsg}
        className="w-full py-2 bg-[#58a6ff] hover:bg-[#79c0ff] text-white text-sm rounded mb-4 disabled:opacity-50">
        Commit
      </button>

      <div className="flex items-center justify-between">
        <span className="text-sm text-[#8b949e]">Auto Commit</span>
        <button onClick={toggleAutoCommit}
          className={`w-12 h-6 rounded-full relative ${autoCommit ? 'bg-[#238636]' : 'bg-[#21262d]'}`}>
          <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${autoCommit ? 'translate-x-7' : 'translate-x-1'}`} />
        </button>
      </div>

      {status?.last_sync && (
        <p className="mt-4 text-xs text-[#8b949e]">
          Last sync: {new Date(status.last_sync).toLocaleString()}
        </p>
      )}
    </div>
  );
}
