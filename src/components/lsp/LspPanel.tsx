'use client';

import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Code, Play, Square, Settings, Check, X } from 'lucide-react';

interface LspServerStatus {
  language: string;
  status: string;
  capabilities: {
    completion: boolean;
    hover: boolean;
    goto_definition: boolean;
    goto_references: boolean;
    rename: boolean;
    diagnostics: boolean;
    formatting: boolean;
    code_actions: boolean;
  };
  version: string | null;
}

export function LspPanel() {
  const [servers, setServers] = useState<LspServerStatus[]>([]);
  const [selectedLang, setSelectedLang] = useState<string | null>(null);

  useEffect(() => {
    invoke<LspServerStatus[]>('lsp_get_servers').then(setServers).catch(() => {});
  }, []);

  const handleStart = async (language: string) => {
    try {
      await invoke('lsp_start_server', { language });
      const s = await invoke<LspServerStatus[]>('lsp_get_servers');
      setServers(s);
    } catch (e) {
      console.error(e);
    }
  };

  const handleStop = async (language: string) => {
    try {
      await invoke('lsp_stop_server', { language });
      const s = await invoke<LspServerStatus[]>('lsp_get_servers');
      setServers(s);
    } catch (e) {
      console.error(e);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'text-[#3fb950]';
      case 'available': return 'text-[#58a6ff]';
      case 'error': return 'text-[#f85149]';
      default: return 'text-[#8b949e]';
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#0d1117] p-4">
      <h3 className="text-[#c9d1d9] font-medium mb-4 flex items-center gap-2">
        <Code size={18} /> Language Servers
      </h3>

      <div className="flex-1 overflow-auto space-y-2">
        {servers.map((server) => (
          <div key={server.language} 
            className="bg-[#161b22] border border-[#30363d] rounded p-3 cursor-pointer hover:border-[#58a6ff]"
            onClick={() => setSelectedLang(selectedLang === server.language ? null : server.language)}>
            <div className="flex items-center justify-between">
              <span className="text-[#c9d1d9] font-medium capitalize">{server.language}</span>
              <div className="flex items-center gap-2">
                <span className={`text-xs ${getStatusColor(server.status)}`}>{server.status}</span>
                {server.status === 'running' ? (
                  <button onClick={(e) => { e.stopPropagation(); handleStop(server.language); }}
                    className="p-1 hover:bg-[#30363d] rounded">
                    <Square size={14} className="text-[#f85149]" />
                  </button>
                ) : (
                  <button onClick={(e) => { e.stopPropagation(); handleStart(server.language); }}
                    className="p-1 hover:bg-[#30363d] rounded">
                    <Play size={14} className="text-[#3fb950]" />
                  </button>
                )}
              </div>
            </div>
            
            {selectedLang === server.language && (
              <div className="mt-3 pt-3 border-t border-[#30363d]">
                <p className="text-xs text-[#8b949e] mb-2">Capabilities:</p>
                <div className="grid grid-cols-2 gap-1">
                  {Object.entries(server.capabilities).map(([key, value]) => (
                    <div key={key} className="flex items-center gap-1 text-xs">
                      {value ? <Check size={12} className="text-[#3fb950]" /> : <X size={12} className="text-[#f85149]" />}
                      <span className="text-[#8b949e]">{key.replace('_', ' ')}</span>
                    </div>
                  ))}
                </div>
                {server.version && (
                  <p className="text-xs text-[#8b949e] mt-2">Version: {server.version}</p>
                )}
              </div>
            )}
          </div>
        ))}

        {servers.length === 0 && (
          <div className="text-center text-[#8b949e] py-8">
            <Code size={32} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">No language servers configured</p>
          </div>
        )}
      </div>
    </div>
  );
}
