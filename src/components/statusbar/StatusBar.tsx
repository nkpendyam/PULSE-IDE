'use client';

import React from 'react';
import { useKyroStore } from '@/store/kyroStore';
import { GitBranch, Terminal, Sparkles, AlertTriangle, AlertCircle } from 'lucide-react';

export function StatusBar() {
  const { cursorPosition, openFiles, activeFileIndex, gitStatus, isOllamaRunning, selectedModel, showTerminal, showChat, toggleTerminal, toggleChat } = useKyroStore();
  const currentFile = activeFileIndex >= 0 ? openFiles[activeFileIndex] : null;
  
  return (
    <div className="h-6 bg-[#161b22] border-t border-[#30363d] flex items-center px-2 justify-between text-xs">
      <div className="flex items-center gap-3">
        {gitStatus && <div className="flex items-center gap-1 text-[#8b949e]"><GitBranch size={12} /><span>{gitStatus.branch}</span></div>}
      </div>
      <div className="flex items-center gap-3">
        <button onClick={toggleChat} className={`flex items-center gap-1 ${showChat ? 'text-[#a371f7]' : 'text-[#8b949e]'} hover:text-[#c9d1d9]`}>
          <Sparkles size={12} /><span>{isOllamaRunning ? selectedModel.split(':')[0] : 'Offline'}</span>
        </button>
        <button onClick={toggleTerminal} className={`flex items-center gap-1 ${showTerminal ? 'text-[#58a6ff]' : 'text-[#8b949e]'} hover:text-[#c9d1d9]`}>
          <Terminal size={12} /><span>Terminal</span>
        </button>
        {currentFile && <span className="text-[#8b949e]">Ln {cursorPosition.line}, Col {cursorPosition.column}</span>}
        {currentFile && <span className="text-[#8b949e]">{currentFile.language.toUpperCase()}</span>}
        <span className="text-[#8b949e]">UTF-8</span>
      </div>
    </div>
  );
}
