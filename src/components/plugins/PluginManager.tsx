'use client';

import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useExtendedKyroStore } from '@/store/extendedStore';
import { Puzzle, ToggleRight, ToggleLeft, Trash2, Upload, RefreshCw, Shield, Cpu } from 'lucide-react';

export function PluginManager() {
  const { plugins, pluginLoading, fetchPlugins, installPlugin, togglePlugin } = useExtendedKyroStore();
  const [showInstall, setShowInstall] = useState(false);
  const [wasmPath, setWasmPath] = useState('');

  useEffect(() => {
    fetchPlugins();
  }, [fetchPlugins]);

  const handleInstall = async () => {
    if (!wasmPath.trim()) return;
    await installPlugin(wasmPath);
    setWasmPath('');
    setShowInstall(false);
  };

  const handleUninstall = async (pluginId: string) => {
    if (confirm('Uninstall this plugin?')) {
      await invoke('uninstall_plugin', { pluginId });
      fetchPlugins();
    }
  };

  const handleToggle = async (pluginId: string, enabled: boolean) => {
    await togglePlugin(pluginId, enabled);
  };

  const getStateColor = (state: string) => {
    switch (state.toLowerCase()) {
      case 'active': return 'text-[#3fb950]';
      case 'inactive': return 'text-[#8b949e]';
      case 'error': return 'text-[#f85149]';
      default: return 'text-[#8b949e]';
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#0d1117]">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#30363d] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Puzzle size={18} className="text-[#8b949e]" />
          <h3 className="text-[#c9d1d9] font-medium">Plugins</h3>
        </div>
        <button
          onClick={() => setShowInstall(true)}
          className="flex items-center gap-1 px-3 py-1 text-sm bg-[#238636] hover:bg-[#2ea043] text-white rounded"
        >
          <Upload size={16} />
          Install
        </button>
      </div>

      {/* Install Modal */}
      {showInstall && (
        <div className="px-4 py-3 border-b border-[#30363d] bg-[#161b22]">
          <p className="text-sm text-[#8b949e] mb-2">Enter path to WASM plugin:</p>
          <input
            type="text"
            value={wasmPath}
            onChange={(e) => setWasmPath(e.target.value)}
            placeholder="/path/to/plugin.wasm"
            className="w-full mb-2 bg-[#0d1117] border border-[#30363d] rounded px-3 py-2 text-[#c9d1d9] text-sm"
          />
          <div className="flex gap-2">
            <button
              onClick={handleInstall}
              className="flex-1 py-2 bg-[#238636] hover:bg-[#2ea043] text-white text-sm rounded"
            >
              Install
            </button>
            <button
              onClick={() => setShowInstall(false)}
              className="flex-1 py-2 bg-[#21262d] hover:bg-[#30363d] text-[#c9d1d9] text-sm rounded"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Plugin List */}
      <div className="flex-1 overflow-y-auto p-4">
        {pluginLoading ? (
          <div className="flex items-center justify-center h-full">
            <RefreshCw className="animate-spin text-[#8b949e]" size={24} />
          </div>
        ) : plugins.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-[#8b949e]">
            <Puzzle size={48} className="mb-4 opacity-50" />
            <p>No plugins installed</p>
            <p className="text-sm">Install a WASM plugin to extend functionality</p>
          </div>
        ) : (
          <div className="space-y-3">
            {plugins.map((plugin) => (
              <div key={plugin.id} className="bg-[#161b22] border border-[#30363d] rounded p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="text-[#c9d1d9] font-medium">{plugin.name}</h4>
                      <span className={`text-xs ${getStateColor(plugin.state)}`}>
                        {plugin.state}
                      </span>
                    </div>
                    <p className="text-xs text-[#8b949e] mb-1">{plugin.author} • v{plugin.version}</p>
                    {plugin.description && (
                      <p className="text-sm text-[#8b949e] mb-2">{plugin.description}</p>
                    )}
                    
                    {/* Capabilities */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {plugin.capabilities.map((cap, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-[#21262d] text-[#8b949e] rounded"
                        >
                          <Shield size={10} />
                          {cap}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggle(plugin.id, !plugin.enabled)}
                      className="p-2 hover:bg-[#21262d] rounded"
                      title={plugin.enabled ? 'Disable' : 'Enable'}
                    >
                      {plugin.enabled ? (
                        <ToggleRight size={20} className="text-[#3fb950]" />
                      ) : (
                        <ToggleLeft size={20} className="text-[#8b949e]" />
                      )}
                    </button>
                    <button
                      onClick={() => handleUninstall(plugin.id)}
                      className="p-2 hover:bg-[#21262d] rounded"
                      title="Uninstall"
                    >
                      <Trash2 size={18} className="text-[#f85149]" />
                    </button>
                  </div>
                </div>

                {/* Memory Usage */}
                <div className="mt-2 pt-2 border-t border-[#30363d] flex items-center gap-2 text-xs text-[#8b949e]">
                  <Cpu size={12} />
                  <span>Memory limit: {plugin.memory_limit_mb}MB</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
