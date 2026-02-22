'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { open } from '@tauri-apps/plugin-dialog';
import { useKyroStore } from '@/store/kyroStore';
import { FileTree } from '@/components/sidebar/FileTree';
import { CodeEditor } from '@/components/editor/CodeEditor';
import { TerminalPanel } from '@/components/terminal/TerminalPanel';
import { AIChatPanel } from '@/components/chat/AIChatPanel';
import { StatusBar } from '@/components/statusbar/StatusBar';
import { TabBar } from '@/components/tabs/TabBar';
import { ActivityBar } from '@/components/sidebar/ActivityBar';
import { SymbolOutline } from '@/components/sidebar/SymbolOutline';
import { FolderOpen, Search, GitBranch, Settings, FileCode } from 'lucide-react';

export default function KyroIDE() {
  const [isLoading, setIsLoading] = useState(false);
  const [activePanel, setActivePanel] = useState<'explorer' | 'search' | 'git' | 'symbols'>('explorer');
  const [supportedLanguages, setSupportedLanguages] = useState<string[]>([]);
  
  const { projectPath, fileTree, openFiles, activeFileIndex, isOllamaRunning, models, showChat, showTerminal, sidebarWidth, chatWidth, setProjectPath, setFileTree, openFile, setOllamaStatus, setModels, setGitStatus, setSupportedLanguages: setStoreSupportedLanguages } = useKyroStore();

  useEffect(() => {
    const checkOllama = async () => {
      try {
        const isRunning = await invoke<boolean>('check_ollama_status');
        setOllamaStatus(isRunning);
        if (isRunning) {
          const modelList = await invoke<Array<{name: string; size: string; modified_at: string}>>('list_models');
          setModels(modelList);
        }
      } catch { setOllamaStatus(false); }
    };
    checkOllama();
    
    // Load supported languages
    const loadLanguages = async () => {
      try {
        const languages = await invoke<string[]>('list_supported_languages');
        setSupportedLanguages(languages);
        setStoreSupportedLanguages(languages);
      } catch (e) { console.error('Failed to load languages:', e); }
    };
    loadLanguages();
  }, [setOllamaStatus, setModels, setStoreSupportedLanguages]);

  useEffect(() => {
    const unlisten = listen<{id: string; data: string}>('terminal-output', (event) => {
      useKyroStore.getState().appendTerminalOutput(event.payload.data);
    });
    return () => { unlisten.then(fn => fn()); };
  }, []);

  const handleOpenFolder = useCallback(async () => {
    try {
      const selected = await open({ directory: true, multiple: false, title: 'Open Project Folder' });
      if (selected && typeof selected === 'string') {
        setIsLoading(true);
        setProjectPath(selected);
        const tree = await invoke<{name: string; path: string; is_directory: boolean; children?: Array<{name: string; path: string; is_directory: boolean; children?: unknown[]}>}>('get_file_tree', { path: selected, maxDepth: 5 });
        setFileTree(tree);
        try {
          const status = await invoke<{branch: string; ahead: number; behind: number; staged: Array<{path: string; status: string}>; unstaged: Array<{path: string; status: string}>; untracked: string[]}>('git_status', { path: selected });
          setGitStatus(status);
        } catch { setGitStatus(null); }
        setIsLoading(false);
      }
    } catch { setIsLoading(false); }
  }, [setProjectPath, setFileTree, setGitStatus]);

  const handleFileOpen = useCallback(async (path: string) => {
    try {
      const fileContent = await invoke<{path: string; content: string; language: string}>('read_file', { path });
      openFile({ path: fileContent.path, content: fileContent.content, language: fileContent.language, isDirty: false });
    } catch (error) { console.error('Failed to open file:', error); }
  }, [openFile]);

  const currentFile = activeFileIndex >= 0 ? openFiles[activeFileIndex] : null;

  return (
    <div className="h-screen w-screen flex flex-col bg-[#0d1117] text-[#c9d1d9] overflow-hidden">
      {/* Title Bar */}
      <div className="h-8 bg-[#161b22] border-b border-[#30363d] flex items-center px-3 justify-between">
        <div className="flex items-center gap-2">
          <span className="font-bold text-[#58a6ff]">KYRO IDE</span>
          {projectPath && <span className="text-xs text-[#8b949e] ml-2">{projectPath.split('/').pop()}</span>}
          {currentFile && <span className="text-xs text-[#58a6ff] ml-2">• {currentFile.language}</span>}
        </div>
        <div className="flex items-center gap-2 text-xs text-[#8b949e]">
          {isOllamaRunning ? (
            <span className="flex items-center gap-1 text-[#3fb950]"><span className="w-2 h-2 rounded-full bg-[#3fb950]"></span>Ollama Connected</span>
          ) : (
            <span className="flex items-center gap-1 text-[#f85149]"><span className="w-2 h-2 rounded-full bg-[#f85149]"></span>Ollama Offline</span>
          )}
        </div>
      </div>
      
      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        <ActivityBar activePanel={activePanel} onPanelChange={setActivePanel} onOpenFolder={handleOpenFolder} />
        
        {/* Sidebar */}
        <div className="bg-[#0d1117] border-r border-[#30363d] flex flex-col" style={{ width: sidebarWidth }}>
          <div className="h-9 flex items-center justify-between px-3 border-b border-[#30363d]">
            <span className="text-xs font-semibold uppercase text-[#8b949e]">
              {activePanel === 'explorer' && 'Explorer'}
              {activePanel === 'search' && 'Search'}
              {activePanel === 'git' && 'Source Control'}
              {activePanel === 'symbols' && 'Symbols'}
            </span>
            <button onClick={handleOpenFolder} className="p-1 hover:bg-[#21262d] rounded text-[#8b949e] hover:text-[#c9d1d9]" title="Open Folder"><FolderOpen size={14} /></button>
          </div>
          
          <div className="flex-1 overflow-auto">
            {activePanel === 'explorer' && (fileTree ? <FileTree node={fileTree} onFileClick={handleFileOpen} level={0} /> : (
              <div className="p-4 text-center text-[#8b949e]">
                <FolderOpen className="mx-auto mb-2 opacity-50" size={32} />
                <p className="text-sm mb-3">Open a folder to start</p>
                <button onClick={handleOpenFolder} className="px-4 py-2 bg-[#238636] hover:bg-[#2ea043] text-white rounded text-sm">Open Folder</button>
              </div>
            ))}
            
            {activePanel === 'search' && (
              <div className="p-3">
                <input type="text" placeholder="Search files..." className="w-full px-3 py-2 bg-[#0d1117] border border-[#30363d] rounded text-sm focus:outline-none focus:border-[#58a6ff]" />
                <div className="mt-3 text-xs text-[#8b949e]">
                  <p className="mb-2">Quick search across all files</p>
                  <p className="text-[#58a6ff]">Ctrl+P to search</p>
                </div>
              </div>
            )}
            
            {activePanel === 'git' && (
              <div className="p-3 text-xs text-[#8b949e]">
                <GitBranch className="mb-2" size={16} />
                <p>Git integration coming soon</p>
              </div>
            )}
            
            {activePanel === 'symbols' && currentFile && (
              <SymbolOutline />
            )}
            
            {activePanel === 'symbols' && !currentFile && (
              <div className="p-4 text-center text-[#8b949e]">
                <FileCode className="mx-auto mb-2 opacity-50" size={32} />
                <p className="text-sm">Open a file to see symbols</p>
              </div>
            )}
          </div>
        </div>
        
        {/* Editor Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <TabBar />
          <div className="flex-1 flex overflow-hidden">
            <div className="flex-1 flex flex-col overflow-hidden">
              {currentFile ? <CodeEditor /> : (
                <div className="flex-1 flex items-center justify-center bg-[#0d1117]">
                  <div className="text-center text-[#8b949e]">
                    <div className="text-6xl mb-4">⚡</div>
                    <h2 className="text-xl font-bold mb-2 text-[#c9d1d9]">KYRO IDE</h2>
                    <p className="text-sm mb-4">AI-Powered Code Editor</p>
                    <button onClick={handleOpenFolder} className="px-4 py-2 bg-[#238636] hover:bg-[#2ea043] text-white rounded text-sm flex items-center gap-2 mx-auto"><FolderOpen size={16} />Open Folder</button>
                    {isOllamaRunning && models.length > 0 && <div className="mt-4 text-xs"><span className="text-[#3fb950]">●</span> {models.length} AI models available</div>}
                    {supportedLanguages.length > 0 && <div className="mt-2 text-xs"><span className="text-[#58a6ff]">●</span> {supportedLanguages.length} languages supported</div>}
                  </div>
                </div>
              )}
            </div>
            {showChat && <div className="border-l border-[#30363d] bg-[#0d1117]" style={{ width: chatWidth }}><AIChatPanel /></div>}
          </div>
          {showTerminal && <div className="border-t border-[#30363d] bg-[#0d1117]" style={{ height: 200 }}><TerminalPanel /></div>}
        </div>
      </div>
      
      <StatusBar />
      {isLoading && <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"><div className="bg-[#161b22] p-4 rounded-lg text-[#c9d1d9]">Loading...</div></div>}
    </div>
  );
}
