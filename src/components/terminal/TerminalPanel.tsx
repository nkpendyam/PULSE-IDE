'use client';

import React, { useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useKyroStore } from '@/store/kyroStore';
import { X } from 'lucide-react';

export function TerminalPanel() {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<any>(null);
  const fitAddonRef = useRef<any>(null);
  const [isClient, setIsClient] = useState(false);
  const { projectPath, toggleTerminal, terminalHeight } = useKyroStore();
  
  useEffect(() => { setIsClient(true); }, []);
  
  useEffect(() => {
    if (!isClient || !terminalRef.current) return;
    const initTerminal = async () => {
      try {
        const { Terminal } = await import('xterm');
        const { FitAddon } = await import('xterm-addon-fit');
        await import('xterm/css/xterm.css');
        const term = new Terminal({ cursorBlink: true, fontSize: 13, fontFamily: 'JetBrains Mono, monospace',
          theme: { background: '#0D1117', foreground: '#C9D1D9', cursor: '#58A6FF', selectionBackground: '#264F78' } });
        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);
        term.open(terminalRef.current!);
        fitAddon.fit();
        xtermRef.current = term;
        fitAddonRef.current = fitAddon;
        invoke('create_terminal', { id: 'main', cwd: projectPath || undefined }).catch(console.error);
        term.onData((data: string) => { invoke('write_to_terminal', { id: 'main', data }).catch(console.error); });
        const handleResize = () => { fitAddon.fit(); invoke('resize_terminal', { id: 'main', cols: term.cols, rows: term.rows }).catch(console.error); };
        window.addEventListener('resize', handleResize);
        setTimeout(handleResize, 100);
        return () => { window.removeEventListener('resize', handleResize); term.dispose(); };
      } catch (error) { console.error('Failed to initialize terminal:', error); }
    };
    initTerminal();
  }, [isClient, projectPath]);
  
  return (
    <div className="flex flex-col h-full">
      <div className="h-8 bg-[#161b22] border-b border-[#30363d] flex items-center px-2 justify-between">
        <span className="text-xs font-medium text-[#8b949e]">Terminal</span>
        <button onClick={toggleTerminal} className="p-1 hover:bg-[#21262d] rounded text-[#8b949e] hover:text-[#c9d1d9]" title="Close Terminal"><X size={14} /></button>
      </div>
      <div ref={terminalRef} className="flex-1 p-2 overflow-hidden bg-[#0d1117]" style={{ minHeight: 0 }} />
    </div>
  );
}
