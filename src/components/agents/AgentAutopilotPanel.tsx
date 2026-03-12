'use client';

import React, { useState, useCallback } from 'react';
import { useExtendedKyroStore } from '@/store/extendedStore';
import { Bot, Shield, ShieldAlert, ShieldCheck, Play, Pause, Settings, ChevronRight } from 'lucide-react';

export type PermissionLevel = 'default' | 'yolo' | 'autopilot';

interface AutopilotAction {
  id: string;
  type: 'file_edit' | 'terminal_command' | 'file_create' | 'file_delete' | 'install_package';
  description: string;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  detail: string;
  timestamp: number;
}

interface AgentAutopilotPanelProps {
  permissionLevel: PermissionLevel;
  onPermissionChange: (level: PermissionLevel) => void;
  isRunning: boolean;
  onToggleRunning: () => void;
}

const PERMISSION_CONFIGS = {
  default: {
    label: 'Default',
    description: 'Ask before file edits, terminal commands, and installs',
    icon: Shield,
    color: 'text-[#58a6ff]',
    bgColor: 'bg-[#58a6ff]/10',
    autoApprove: [] as string[],
  },
  yolo: {
    label: 'YOLO Mode',
    description: 'Auto-approve file edits. Ask for terminal and installs',
    icon: ShieldAlert,
    color: 'text-[#d29922]',
    bgColor: 'bg-[#d29922]/10',
    autoApprove: ['file_edit', 'file_create'],
  },
  autopilot: {
    label: 'Autopilot',
    description: 'Auto-approve everything. Agent runs fully autonomous',
    icon: ShieldCheck,
    color: 'text-[#f85149]',
    bgColor: 'bg-[#f85149]/10',
    autoApprove: ['file_edit', 'file_create', 'file_delete', 'terminal_command', 'install_package'],
  },
};

export function AgentAutopilotPanel({ permissionLevel, onPermissionChange, isRunning, onToggleRunning }: AgentAutopilotPanelProps) {
  const [pendingActions, setPendingActions] = useState<AutopilotAction[]>([]);
  const [showSettings, setShowSettings] = useState(false);

  const currentConfig = PERMISSION_CONFIGS[permissionLevel];

  const handleApprove = useCallback((actionId: string) => {
    setPendingActions(prev =>
      prev.map(a => a.id === actionId ? { ...a, status: 'approved' as const } : a)
    );
  }, []);

  const handleReject = useCallback((actionId: string) => {
    setPendingActions(prev =>
      prev.map(a => a.id === actionId ? { ...a, status: 'rejected' as const } : a)
    );
  }, []);

  const handleApproveAll = useCallback(() => {
    setPendingActions(prev =>
      prev.map(a => a.status === 'pending' ? { ...a, status: 'approved' as const } : a)
    );
  }, []);

  const pending = pendingActions.filter(a => a.status === 'pending');

  return (
    <div className="flex flex-col h-full">
      {/* Permission Level Selector */}
      <div className="p-3 border-b border-[#30363d]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-[#c9d1d9]">Agent Mode</span>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-1 rounded hover:bg-[#21262d] text-[#8b949e]"
          >
            <Settings size={12} />
          </button>
        </div>
        
        <div className="space-y-1">
          {(Object.entries(PERMISSION_CONFIGS) as [PermissionLevel, typeof PERMISSION_CONFIGS.default][]).map(([level, config]) => {
            const Icon = config.icon;
            const isActive = permissionLevel === level;
            return (
              <button
                key={level}
                onClick={() => onPermissionChange(level)}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-left transition-colors ${
                  isActive ? `${config.bgColor} ${config.color}` : 'text-[#8b949e] hover:bg-[#21262d]'
                }`}
              >
                <Icon size={14} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium">{config.label}</div>
                  {isActive && <div className="text-[10px] opacity-70 mt-0.5">{config.description}</div>}
                </div>
                {isActive && <div className="w-1.5 h-1.5 rounded-full bg-current" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Run Controls */}
      <div className="px-3 py-2 border-b border-[#30363d] flex items-center gap-2">
        <button
          onClick={onToggleRunning}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
            isRunning
              ? 'bg-[#f85149]/10 text-[#f85149] hover:bg-[#f85149]/20'
              : 'bg-[#238636] text-white hover:bg-[#2ea043]'
          }`}
        >
          {isRunning ? <><Pause size={12} /> Stop Agent</> : <><Play size={12} /> Run Agent</>}
        </button>
        {isRunning && (
          <div className="flex items-center gap-1.5 text-[10px] text-[#8b949e]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#3fb950] animate-pulse" />
            Running
          </div>
        )}
      </div>

      {/* Pending Actions */}
      <div className="flex-1 overflow-y-auto">
        {pending.length > 0 && (
          <div className="p-2">
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-[10px] uppercase tracking-wider text-[#8b949e]">
                Pending Actions ({pending.length})
              </span>
              <button
                onClick={handleApproveAll}
                className="text-[10px] text-[#58a6ff] hover:underline"
              >
                Approve All
              </button>
            </div>
            {pending.map(action => (
              <div key={action.id} className="mb-1 p-2 rounded bg-[#161b22] border border-[#30363d]">
                <div className="flex items-center gap-1.5 mb-1">
                  <ChevronRight size={10} className="text-[#8b949e]" />
                  <span className="text-xs text-[#c9d1d9]">{action.description}</span>
                </div>
                <div className="text-[10px] text-[#8b949e] font-mono mb-2 pl-4">{action.detail}</div>
                <div className="flex gap-1 pl-4">
                  <button
                    onClick={() => handleApprove(action.id)}
                    className="px-2 py-0.5 rounded text-[10px] bg-[#238636]/20 text-[#3fb950] hover:bg-[#238636]/30"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleReject(action.id)}
                    className="px-2 py-0.5 rounded text-[10px] bg-[#f85149]/10 text-[#f85149] hover:bg-[#f85149]/20"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {pending.length === 0 && (
          <div className="flex flex-col items-center justify-center h-32 text-[#8b949e]">
            <Bot size={24} className="mb-2 opacity-50" />
            <span className="text-xs">No pending actions</span>
            <span className="text-[10px] mt-1 opacity-60">
              {isRunning ? 'Agent is working...' : 'Start the agent to begin'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
