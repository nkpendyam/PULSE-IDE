'use client';

import React, { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { check, type Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { Download, RefreshCw, Check, X, Clock, ArrowUp, Info } from 'lucide-react';

interface UpdateInfo {
  version: string;
  current_version: string;
  release_date: string;
  release_notes: string;
  channel: string;
  size_mb: number;
  mandatory: boolean;
}

interface UpdateProgress {
  downloaded_mb: number;
  total_mb: number;
  percentage: number;
  speed_mbps: number;
}

export function UpdatePanel() {
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  const [checking, setChecking] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [readyToInstall, setReadyToInstall] = useState(false);
  const [progress, setProgress] = useState<UpdateProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [channel, setChannel] = useState('stable');
  const [autoUpdate, setAutoUpdate] = useState(true);
  // Holds the live Update handle from tauri-plugin-updater for download/install
  const pendingUpdate = useRef<Update | null>(null);

  useEffect(() => {
    checkForUpdates();
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const ch = await invoke<string>('get_update_channel');
      setChannel(ch);
      const auto = await invoke<boolean>('is_auto_update_enabled');
      setAutoUpdate(auto);
    } catch (err) {
      console.error('Failed to load update settings:', err);
    }
  };

  const checkForUpdates = async () => {
    setChecking(true);
    setError(null);
    pendingUpdate.current = null;
    try {
      // Use tauri-plugin-updater for signature-verified update check
      const upd = await check();
      if (upd) {
        pendingUpdate.current = upd;
        setUpdate({
          version: upd.version,
          current_version: upd.currentVersion,
          release_date: upd.date ?? '',
          release_notes: upd.body ?? '',
          channel,
          size_mb: 0,
          mandatory: (upd.body ?? '').toLowerCase().includes('critical') ||
                     (upd.body ?? '').toLowerCase().includes('security'),
        });
      } else {
        setUpdate(null);
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setChecking(false);
    }
  };

  const downloadUpdate = async () => {
    if (!pendingUpdate.current) return;
    setDownloading(true);
    setError(null);
    let totalBytes = 0;
    let downloadedBytes = 0;
    const startTime = Date.now();
    try {
      await pendingUpdate.current.download((event) => {
        if (event.event === 'Started') {
          totalBytes = event.data.contentLength ?? 0;
        } else if (event.event === 'Progress') {
          downloadedBytes += event.data.chunkLength;
          const elapsedSec = (Date.now() - startTime) / 1000 || 0.001;
          setProgress({
            downloaded_mb: downloadedBytes / 1_048_576,
            total_mb: totalBytes / 1_048_576,
            percentage: totalBytes > 0 ? (downloadedBytes / totalBytes) * 100 : 0,
            speed_mbps: (downloadedBytes / 1_048_576) / elapsedSec,
          });
        } else if (event.event === 'Finished') {
          setProgress((p) => p ? { ...p, percentage: 100 } : null);
        }
      });
      setReadyToInstall(true);
    } catch (err) {
      setError(String(err));
    } finally {
      setDownloading(false);
    }
  };

  const installUpdate = async () => {
    if (!pendingUpdate.current) return;
    try {
      await pendingUpdate.current.install();
      await relaunch();
    } catch (err) {
      setError(String(err));
    }
  };

  const skipUpdate = async () => {
    await invoke('skip_update');
    setUpdate(null);
    pendingUpdate.current = null;
  };

  const handleChannelChange = async (newChannel: string) => {
    try {
      await invoke('set_update_channel', { channel: newChannel });
      setChannel(newChannel);
    } catch (err) {
      setError(String(err));
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#0d1117] p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[#c9d1d9] font-medium">Updates</h3>
        <button
          onClick={checkForUpdates}
          disabled={checking}
          className="flex items-center gap-2 px-3 py-1.5 bg-[#21262d] hover:bg-[#30363d] text-[#c9d1d9] text-sm rounded disabled:opacity-50"
        >
          <RefreshCw size={16} className={checking ? 'animate-spin' : ''} />
          Check for Updates
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-[#f85149]/10 border border-[#f85149] text-[#f85149] px-4 py-2 rounded mb-4 flex items-center justify-between">
          <span className="text-sm">{error}</span>
          <button onClick={() => setError(null)}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* Update Available */}
      {update && (
        <div className="bg-[#161b22] border border-[#30363d] rounded p-4 mb-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-[#238636] rounded">
              <ArrowUp size={20} className="text-white" />
            </div>
            <div className="flex-1">
              <h4 className="text-[#c9d1d9] font-medium mb-1">
                Update Available: v{update.version}
              </h4>
              <p className="text-sm text-[#8b949e] mb-2">
                Current: v{update.current_version} • Size: {update.size_mb.toFixed(1)} MB
              </p>
              
              {/* Release Notes */}
              <div className="bg-[#0d1117] rounded p-3 mb-3 text-sm text-[#8b949e] max-h-40 overflow-y-auto">
                {update.release_notes.split('\n').map((line, i) => (
                  <p key={i} className="mb-1">{line}</p>
                ))}
              </div>

              {/* Download Progress */}
              {downloading && progress && (
                <div className="mb-3">
                  <div className="flex items-center justify-between text-sm text-[#8b949e] mb-1">
                    <span>{progress.downloaded_mb.toFixed(1)} / {progress.total_mb.toFixed(1)} MB</span>
                    <span>{progress.speed_mbps.toFixed(1)} MB/s</span>
                  </div>
                  <div className="w-full h-2 bg-[#21262d] rounded overflow-hidden">
                    <div
                      className="h-full bg-[#238636] transition-all"
                      style={{ width: `${progress.percentage}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                {!downloading && !readyToInstall ? (
                  <>
                    <button
                      onClick={downloadUpdate}
                      className="flex items-center gap-2 px-4 py-2 bg-[#238636] hover:bg-[#2ea043] text-white text-sm rounded"
                    >
                      <Download size={16} />
                      Download
                    </button>
                    {!update.mandatory && (
                      <button
                        onClick={skipUpdate}
                        className="px-4 py-2 bg-[#21262d] hover:bg-[#30363d] text-[#c9d1d9] text-sm rounded"
                      >
                        Skip
                      </button>
                    )}
                  </>
                ) : readyToInstall ? (
                  <button
                    onClick={installUpdate}
                    className="flex items-center gap-2 px-4 py-2 bg-[#238636] hover:bg-[#2ea043] text-white text-sm rounded"
                  >
                    <Check size={16} />
                    Install & Restart
                  </button>
                ) : (
                  <button
                    disabled
                    className="px-4 py-2 bg-[#21262d] text-[#8b949e] text-sm rounded opacity-50 cursor-not-allowed"
                  >
                    Downloading…
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* No Update */}
      {!update && !checking && (
        <div className="flex flex-col items-center justify-center py-8 text-[#8b949e]">
          <Check size={48} className="text-[#3fb950] mb-4" />
          <p className="text-[#c9d1d9]">You're up to date!</p>
          <p className="text-sm">v{'0.1.0'}</p>
        </div>
      )}

      {/* Settings */}
      <div className="mt-auto pt-4 border-t border-[#30363d]">
        <h4 className="text-sm text-[#c9d1d9] font-medium mb-3">Update Settings</h4>
        
        {/* Channel */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Info size={14} className="text-[#8b949e]" />
            <span className="text-sm text-[#8b949e]">Update Channel</span>
          </div>
          <select
            value={channel}
            onChange={(e) => handleChannelChange(e.target.value)}
            className="bg-[#161b22] border border-[#30363d] rounded px-3 py-1 text-[#c9d1d9] text-sm"
          >
            <option value="stable">Stable</option>
            <option value="beta">Beta</option>
            <option value="nightly">Nightly</option>
          </select>
        </div>

        {/* Auto Update */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock size={14} className="text-[#8b949e]" />
            <span className="text-sm text-[#8b949e]">Auto Update</span>
          </div>
          <button
            onClick={async () => {
              await invoke('set_auto_update', { enabled: !autoUpdate });
              setAutoUpdate(!autoUpdate);
            }}
            className={`w-12 h-6 rounded-full relative ${
              autoUpdate ? 'bg-[#238636]' : 'bg-[#21262d]'
            }`}
          >
            <div
              className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                autoUpdate ? 'translate-x-7' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  );
}
