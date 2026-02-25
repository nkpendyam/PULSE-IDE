'use client';

import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useExtendedKyroStore } from '@/store/extendedStore';
import { Bot, Play, Trash2, Plus, CheckCircle, Clock, AlertCircle, Send } from 'lucide-react';

export function AgentPanel() {
  const { agents, fetchAgents } = useExtendedKyroStore();
  const [showCreate, setShowCreate] = useState(false);
  const [newAgentName, setNewAgentName] = useState('');
  const [newAgentRole, setNewAgentRole] = useState('coder');
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [running, setRunning] = useState(false);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  const handleCreateAgent = async () => {
    if (!newAgentName.trim()) return;
    await invoke('create_agent', { name: newAgentName, role: newAgentRole });
    setNewAgentName('');
    setShowCreate(false);
    fetchAgents();
  };

  const handleDeleteAgent = async (agentId: string) => {
    if (confirm('Delete this agent?')) {
      await invoke('delete_agent', { agentId });
      fetchAgents();
    }
  };

  const handleRunAgent = async () => {
    if (!selectedAgent || !prompt.trim()) return;
    setRunning(true);
    try {
      await invoke<{ response: string }>('run_agent', {
        request: { agentId: selectedAgent, prompt }
      });
      setPrompt('');
      // Could show result in a modal or add to task list
    } catch (err) {
      console.error('Agent run failed:', err);
    } finally {
      setRunning(false);
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role.toLowerCase()) {
      case 'planner': return '📋';
      case 'coder': return '💻';
      case 'reviewer': return '👀';
      case 'tester': return '🧪';
      case 'debugger': return '🐛';
      case 'architect': return '🏗️';
      default: return '🤖';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'idle': return <Clock size={14} className="text-[#8b949e]" />;
      case 'running': return <Play size={14} className="text-[#58a6ff]" />;
      case 'completed': return <CheckCircle size={14} className="text-[#3fb950]" />;
      case 'error': return <AlertCircle size={14} className="text-[#f85149]" />;
      default: return <Clock size={14} className="text-[#8b949e]" />;
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#0d1117]">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#30363d] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot size={18} className="text-[#8b949e]" />
          <h3 className="text-[#c9d1d9] font-medium">AI Agents</h3>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1 px-2 py-1 text-sm text-[#58a6ff] hover:bg-[#21262d] rounded"
        >
          <Plus size={16} />
          New
        </button>
      </div>

      {/* Create Agent Modal */}
      {showCreate && (
        <div className="px-4 py-3 border-b border-[#30363d] bg-[#161b22]">
          <input
            type="text"
            value={newAgentName}
            onChange={(e) => setNewAgentName(e.target.value)}
            placeholder="Agent name"
            className="w-full mb-2 bg-[#0d1117] border border-[#30363d] rounded px-3 py-2 text-[#c9d1d9] text-sm"
          />
          <select
            value={newAgentRole}
            onChange={(e) => setNewAgentRole(e.target.value)}
            className="w-full mb-2 bg-[#0d1117] border border-[#30363d] rounded px-3 py-2 text-[#c9d1d9] text-sm"
          >
            <option value="planner">Planner</option>
            <option value="coder">Coder</option>
            <option value="reviewer">Reviewer</option>
            <option value="tester">Tester</option>
            <option value="debugger">Debugger</option>
            <option value="architect">Architect</option>
          </select>
          <div className="flex gap-2">
            <button
              onClick={handleCreateAgent}
              className="flex-1 py-2 bg-[#238636] hover:bg-[#2ea043] text-white text-sm rounded"
            >
              Create
            </button>
            <button
              onClick={() => setShowCreate(false)}
              className="flex-1 py-2 bg-[#21262d] hover:bg-[#30363d] text-[#c9d1d9] text-sm rounded"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Agent List */}
      <div className="flex-1 overflow-y-auto">
        {agents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-[#8b949e]">
            <Bot size={48} className="mb-4 opacity-50" />
            <p>No agents yet</p>
            <p className="text-sm">Create an agent to get started</p>
          </div>
        ) : (
          <div className="divide-y divide-[#30363d]">
            {agents.map((agent) => (
              <div
                key={agent.id}
                onClick={() => setSelectedAgent(agent.id)}
                className={`px-4 py-3 cursor-pointer hover:bg-[#161b22] ${
                  selectedAgent === agent.id ? 'bg-[#161b22]' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{getRoleIcon(agent.role)}</span>
                    <div>
                      <p className="text-[#c9d1d9]">{agent.name}</p>
                      <p className="text-xs text-[#8b949e]">{agent.role}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(agent.status)}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteAgent(agent.id);
                      }}
                      className="p-1 hover:bg-[#21262d] rounded"
                    >
                      <Trash2 size={14} className="text-[#f85149]" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Prompt Input */}
      {selectedAgent && (
        <div className="px-4 py-3 border-t border-[#30363d]">
          <div className="flex gap-2">
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleRunAgent()}
              placeholder="Enter a task for the agent..."
              className="flex-1 bg-[#161b22] border border-[#30363d] rounded px-3 py-2 text-[#c9d1d9] text-sm"
            />
            <button
              onClick={handleRunAgent}
              disabled={running || !prompt.trim()}
              className="px-4 py-2 bg-[#238636] hover:bg-[#2ea043] text-white rounded disabled:opacity-50"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
