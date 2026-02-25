'use client';

import React from 'react';
import { X, Circle } from 'lucide-react';
import { useKyroStore } from '@/store/kyroStore';

export function TabBar() {
  const { openFiles, activeFileIndex, setActiveFile, closeFile } = useKyroStore();
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
    <div className="h-9 bg-[#0d1117] border-b border-[#30363d] flex items-center overflow-x-auto">
      {openFiles.map((file, index) => {
        const isActive = index === activeFileIndex;
        const extInfo = getExtensionIcon(file.path);
        const filename = file.path.split('/').pop() || file.path;
        return (
          <div key={file.path} className={`h-full flex items-center gap-2 px-3 border-r border-[#30363d] cursor-pointer min-w-0 max-w-[180px] ${isActive ? 'bg-[#0d1117] border-b-2 border-b-[#58a6ff]' : 'bg-[#161b22] hover:bg-[#21262d]'}`}
            onClick={() => setActiveFile(index)}>
            <span className={`text-[10px] font-bold ${extInfo.color}`}>{extInfo.icon}</span>
            <span className="text-xs truncate flex-1">{filename}</span>
            {file.isDirty ? <button onClick={(e) => { e.stopPropagation(); closeFile(file.path); }} className="text-[#8b949e] hover:text-[#c9d1d9]"><Circle size={8} fill="currentColor" /></button> : <button onClick={(e) => { e.stopPropagation(); closeFile(file.path); }} className="text-[#8b949e] hover:text-[#c9d1d9]"><X size={14} /></button>}
          </div>
        );
      })}
    </div>
  );
}
