'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { X, Circle } from 'lucide-react';
import { useKyroStore } from '@/store/kyroStore';

export function TabBar() {
  const { openFiles, activeFileIndex, setActiveFile, closeFile, closeAllFiles, closeOtherFiles } = useKyroStore();
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; path: string } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [contextMenu]);

  const handleContextMenu = useCallback((e: React.MouseEvent, path: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, path });
  }, []);
  
  if (openFiles.length === 0) return null;
  
  const getExtensionIcon = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    const iconMap: Record<string, { icon: string; color: string }> = {
      'ts': { icon: 'TS', color: 'text-[#3178c6]' }, 'tsx': { icon: 'TX', color: 'text-[#3178c6]' },
      'js': { icon: 'JS', color: 'text-[#f7df1e]' }, 'py': { icon: 'PY', color: 'text-[#3776ab]' },
      'rs': { icon: 'RS', color: 'text-[#dea584]' }, 'go': { icon: 'GO', color: 'text-[#00add8]' },
    };
    return iconMap[ext || ''] || { icon: ext?.toUpperCase() || '?', color: 'text-[#8b949e]' };
  };
  
  return (
    <div className="h-9 bg-[#0d1117] border-b border-[#30363d] flex items-center overflow-x-auto relative">
      {openFiles.map((file, index) => {
        const isActive = index === activeFileIndex;
        const extInfo = getExtensionIcon(file.path);
        const filename = file.path.split('/').pop() || file.path;
        return (
          <div key={file.path} className={`h-full flex items-center gap-2 px-3 border-r border-[#30363d] cursor-pointer min-w-0 max-w-[180px] ${isActive ? 'bg-[#0d1117] border-b-2 border-b-[#58a6ff]' : 'bg-[#161b22] hover:bg-[#21262d]'}`}
            onClick={() => setActiveFile(index)}
            onContextMenu={(e) => handleContextMenu(e, file.path)}>
            <span className={`text-[10px] font-bold ${extInfo.color}`}>{extInfo.icon}</span>
            <span className="text-xs truncate flex-1">{filename}</span>
            {file.isDirty ? <button onClick={(e) => { e.stopPropagation(); closeFile(file.path); }} className="text-[#8b949e] hover:text-[#c9d1d9]"><Circle size={8} fill="currentColor" /></button> : <button onClick={(e) => { e.stopPropagation(); closeFile(file.path); }} className="text-[#8b949e] hover:text-[#c9d1d9]"><X size={14} /></button>}
          </div>
        );
      })}

      {/* Tab Context Menu */}
      {contextMenu && (
        <div
          ref={menuRef}
          className="fixed z-50 bg-[#161b22] border border-[#30363d] rounded-md shadow-xl py-1 min-w-[160px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            onClick={() => { closeFile(contextMenu.path); setContextMenu(null); }}
            className="w-full text-left px-3 py-1.5 text-xs text-[#c9d1d9] hover:bg-[#21262d]"
          >
            Close
          </button>
          <button
            onClick={() => { closeOtherFiles(contextMenu.path); setContextMenu(null); }}
            className="w-full text-left px-3 py-1.5 text-xs text-[#c9d1d9] hover:bg-[#21262d]"
          >
            Close Others
          </button>
          <button
            onClick={() => { closeAllFiles(); setContextMenu(null); }}
            className="w-full text-left px-3 py-1.5 text-xs text-[#c9d1d9] hover:bg-[#21262d]"
          >
            Close All
          </button>
          <div className="border-t border-[#30363d] my-1" />
          <button
            onClick={() => {
              navigator.clipboard.writeText(contextMenu.path);
              setContextMenu(null);
            }}
            className="w-full text-left px-3 py-1.5 text-xs text-[#c9d1d9] hover:bg-[#21262d]"
          >
            Copy Path
          </button>
        </div>
      )}
    </div>
  );
}
