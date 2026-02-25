'use client';

import React, { useState, useRef, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useKyroStore } from '@/store/kyroStore';
import { Send, Trash2, Sparkles } from 'lucide-react';

export function AIChatPanel() {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { chatMessages, isAiLoading, models, selectedModel, isOllamaRunning, addChatMessage, clearChatMessages, setAiLoading, openFiles, activeFileIndex } = useKyroStore();
  const currentFile = activeFileIndex >= 0 ? openFiles[activeFileIndex] : null;
  
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMessages]);
  
  const handleSend = async () => {
    if (!input.trim() || isAiLoading) return;
    const userMessage = input.trim();
    setInput('');
    addChatMessage({ id: Date.now().toString(), role: 'user', content: userMessage, timestamp: new Date() });
    setAiLoading(true);
    try {
      const context = currentFile ? `[Current file: ${currentFile.path}]\n\n${userMessage}` : userMessage;
      const response = await invoke<string>('chat_completion', { model: selectedModel, messages: [{ role: 'system', content: 'You are KYRO, an expert coding assistant.' }, ...chatMessages.map(m => ({ role: m.role, content: m.content })), { role: 'user', content: context }] });
      addChatMessage({ id: (Date.now() + 1).toString(), role: 'assistant', content: response, timestamp: new Date() });
    } catch (error) { addChatMessage({ id: (Date.now() + 1).toString(), role: 'assistant', content: `Error: ${error}`, timestamp: new Date() }); }
    finally { setAiLoading(false); }
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } };
  
  return (
    <div className="flex flex-col h-full">
      <div className="h-9 bg-[#161b22] border-b border-[#30363d] flex items-center px-3 justify-between">
        <div className="flex items-center gap-2"><Sparkles size={14} className="text-[#a371f7]" /><span className="text-xs font-medium">AI Assistant</span></div>
        <button onClick={clearChatMessages} className="p-1 hover:bg-[#21262d] rounded text-[#8b949e] hover:text-[#c9d1d9]" title="Clear chat"><Trash2 size={14} /></button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {!isOllamaRunning && <div className="text-center py-8"><div className="text-4xl mb-2">🔌</div><p className="text-sm text-[#8b949e] mb-2">Ollama is not running</p><p className="text-xs text-[#8b949e]">Start with: <code className="bg-[#21262d] px-1 rounded">ollama serve</code></p></div>}
        {isOllamaRunning && models.length === 0 && <div className="text-center py-8"><div className="text-4xl mb-2">📥</div><p className="text-sm text-[#8b949e] mb-2">No models installed</p><p className="text-xs text-[#8b949e]">Pull a model: <code className="bg-[#21262d] px-1 rounded">ollama pull codellama:7b</code></p></div>}
        {chatMessages.map((message) => (
          <div key={message.id} className={`flex gap-2 ${message.role === 'user' ? 'justify-end' : ''}`}>
            {message.role === 'assistant' && <div className="w-6 h-6 rounded bg-[#a371f7] flex items-center justify-center flex-shrink-0"><Sparkles size={12} className="text-white" /></div>}
            <div className={`max-w-[85%] rounded-lg p-3 text-sm ${message.role === 'user' ? 'bg-[#1f6feb] text-white' : 'bg-[#21262d] text-[#c9d1d9]'}`}>
              <div className="whitespace-pre-wrap break-words">{message.content}</div>
            </div>
          </div>
        ))}
        {isAiLoading && <div className="flex gap-2"><div className="w-6 h-6 rounded bg-[#a371f7] flex items-center justify-center flex-shrink-0"><Sparkles size={12} className="text-white" /></div><div className="bg-[#21262d] rounded-lg p-3"><div className="flex gap-1"><span className="w-2 h-2 bg-[#8b949e] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} /><span className="w-2 h-2 bg-[#8b949e] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} /><span className="w-2 h-2 bg-[#8b949e] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} /></div></div></div>}
        <div ref={messagesEndRef} />
      </div>
      <div className="p-3 border-t border-[#30363d]">
        <div className="flex gap-2">
          <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown} placeholder={isOllamaRunning ? "Ask about your code..." : "Start Ollama to chat..."} disabled={!isOllamaRunning || isAiLoading} className="flex-1 bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-[#58a6ff] disabled:opacity-50 disabled:cursor-not-allowed" rows={2} />
          <button onClick={handleSend} disabled={!input.trim() || isAiLoading || !isOllamaRunning} className="px-3 bg-[#238636] hover:bg-[#2ea043] disabled:bg-[#21262d] disabled:text-[#8b949e] rounded-lg text-white transition-colors"><Send size={16} /></button>
        </div>
      </div>
    </div>
  );
}
