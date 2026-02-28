'use client';

import React from 'react';
import { Files, Search, GitBranch, Settings, FolderOpen, FileCode } from 'lucide-react';

interface ActivityBarProps { 
  activePanel: 'explorer' | 'search' | 'git' | 'symbols'; 
  onPanelChange: (panel: 'explorer' | 'search' | 'git' | 'symbols') => void; 
  onOpenFolder: () => void; 
}

export function ActivityBar({ activePanel, onPanelChange, onOpenFolder }: ActivityBarProps) {
  const items = [
    { id: 'explorer' as const, icon: Files, label: 'Explorer' },
    { id: 'symbols' as const, icon: FileCode, label: 'Symbols' },
    { id: 'search' as const, icon: Search, label: 'Search' },
    { id: 'git' as const, icon: GitBranch, label: 'Source Control' },
  ];
  
  return (
    <div className="w-12 bg-[#0d1117] border-r border-[#30363d] flex flex-col items-center py-2">
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = activePanel === item.id;
        return (
          <button key={item.id} onClick={() => onPanelChange(item.id)}
            className={`w-10 h-10 flex items-center justify-center rounded mb-1 transition-colors relative ${isActive ? 'text-[#c9d1d9] after:absolute after:right-0 after:top-1/2 after:-translate-y-1/2 after:w-0.5 after:h-6 after:bg-[#58a6ff] after:rounded-l' : 'text-[#8b949e] hover:text-[#c9d1d9]'}`}
            title={item.label}><Icon size={20} /></button>
        );
      })}
      <div className="flex-1" />
      <button onClick={onOpenFolder} className="w-10 h-10 flex items-center justify-center rounded text-[#8b949e] hover:text-[#c9d1d9]" title="Open Folder"><FolderOpen size={20} /></button>
      <button className="w-10 h-10 flex items-center justify-center rounded text-[#8b949e] hover:text-[#c9d1d9]" title="Settings"><Settings size={20} /></button>
    </div>
  );
}
