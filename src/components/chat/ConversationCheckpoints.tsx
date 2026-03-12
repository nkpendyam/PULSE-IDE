'use client';

import React, { useState, useCallback } from 'react';
import { useKyroStore } from '@/store/kyroStore';
import { Clock, RotateCcw, Check, ChevronRight, GitCommit, FileText, Trash2 } from 'lucide-react';

export interface Checkpoint {
  id: string;
  label: string;
  timestamp: number;
  messageIndex: number;
  fileSnapshots: Map<string, string>; // path -> content at checkpoint
  description: string;
  isAutomatic: boolean;
}

interface ConversationCheckpointsProps {
  checkpoints: Checkpoint[];
  onCreateCheckpoint: (label?: string) => void;
  onRestoreCheckpoint: (checkpointId: string) => void;
  onDeleteCheckpoint: (checkpointId: string) => void;
  currentMessageIndex: number;
}

export function ConversationCheckpoints({
  checkpoints,
  onCreateCheckpoint,
  onRestoreCheckpoint,
  onDeleteCheckpoint,
  currentMessageIndex,
}: ConversationCheckpointsProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmRestore, setConfirmRestore] = useState<string | null>(null);
  const [customLabel, setCustomLabel] = useState('');

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatTimeSince = (ts: number) => {
    const diff = Date.now() - ts;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  const handleRestore = useCallback((checkpointId: string) => {
    if (confirmRestore === checkpointId) {
      onRestoreCheckpoint(checkpointId);
      setConfirmRestore(null);
    } else {
      setConfirmRestore(checkpointId);
      setTimeout(() => setConfirmRestore(null), 3000);
    }
  }, [confirmRestore, onRestoreCheckpoint]);

  const handleCreateCustom = useCallback(() => {
    if (customLabel.trim()) {
      onCreateCheckpoint(customLabel.trim());
      setCustomLabel('');
    } else {
      onCreateCheckpoint();
    }
  }, [customLabel, onCreateCheckpoint]);

  return (
    <div className="flex flex-col">
      {/* Create Checkpoint */}
      <div className="p-2 border-b border-[#30363d]">
        <div className="flex gap-1">
          <input
            type="text"
            value={customLabel}
            onChange={(e) => setCustomLabel(e.target.value)}
            placeholder="Checkpoint label (optional)"
            className="flex-1 px-2 py-1 bg-[#0d1117] border border-[#30363d] rounded text-xs text-[#c9d1d9] placeholder:text-[#484f58] focus:border-[#58a6ff] focus:outline-none"
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreateCustom(); }}
          />
          <button
            onClick={handleCreateCustom}
            className="px-2 py-1 rounded text-xs bg-[#21262d] text-[#c9d1d9] hover:bg-[#30363d] transition-colors"
            title="Create checkpoint"
          >
            <GitCommit size={12} />
          </button>
        </div>
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-y-auto">
        {checkpoints.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-[#8b949e]">
            <Clock size={20} className="mb-2 opacity-50" />
            <span className="text-xs">No checkpoints yet</span>
            <span className="text-[10px] mt-1 opacity-60">Checkpoints are created as you chat</span>
          </div>
        ) : (
          <div className="py-1">
            {[...checkpoints].reverse().map((cp, i) => {
              const isExpanded = expandedId === cp.id;
              const isCurrent = cp.messageIndex === currentMessageIndex;
              const isPast = cp.messageIndex < currentMessageIndex;
              
              return (
                <div key={cp.id} className="relative">
                  {/* Timeline line */}
                  {i < checkpoints.length - 1 && (
                    <div className="absolute left-3.75 top-6 bottom-0 w-px bg-[#30363d]" />
                  )}
                  
                  <div className={`flex items-start gap-2 px-2 py-1.5 hover:bg-[#161b22] transition-colors ${isCurrent ? 'bg-[#388bfd0d]' : ''}`}>
                    {/* Timeline dot */}
                    <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${
                      isCurrent ? 'bg-[#58a6ff] ring-2 ring-[#58a6ff]/30' :
                      isPast ? 'bg-[#30363d]' : 'bg-[#3fb950]'
                    }`} />
                    
                    <div className="flex-1 min-w-0">
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : cp.id)}
                        className="w-full flex items-center gap-1 text-left"
                      >
                        <ChevronRight size={10} className={`text-[#8b949e] transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                        <span className="text-xs text-[#c9d1d9] truncate flex-1">
                          {cp.label}
                        </span>
                        <span className="text-[10px] text-[#8b949e] shrink-0">{formatTimeSince(cp.timestamp)}</span>
                      </button>
                      
                      {isExpanded && (
                        <div className="mt-1 ml-3 space-y-1">
                          <p className="text-[10px] text-[#8b949e]">{cp.description}</p>
                          <div className="flex items-center gap-1 text-[10px] text-[#8b949e]">
                            <FileText size={9} />
                            <span>{cp.fileSnapshots.size} file(s) snapshotted</span>
                          </div>
                          <div className="flex items-center gap-1 text-[10px] text-[#8b949e]">
                            <Clock size={9} />
                            <span>{formatTime(cp.timestamp)}</span>
                            {cp.isAutomatic && <span className="px-1 rounded bg-[#21262d]">auto</span>}
                          </div>
                          <div className="flex gap-1 mt-1">
                            <button
                              onClick={() => handleRestore(cp.id)}
                              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] transition-colors ${
                                confirmRestore === cp.id
                                  ? 'bg-[#d29922]/20 text-[#d29922]'
                                  : 'bg-[#21262d] text-[#8b949e] hover:text-[#c9d1d9]'
                              }`}
                            >
                              <RotateCcw size={9} />
                              {confirmRestore === cp.id ? 'Click to confirm' : 'Restore'}
                            </button>
                            <button
                              onClick={() => onDeleteCheckpoint(cp.id)}
                              className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-[#21262d] text-[#8b949e] hover:text-[#f85149] transition-colors"
                            >
                              <Trash2 size={9} />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Create a checkpoint snapshot of the current codebase state
 */
export function createCheckpointSnapshot(
  openFiles: Array<{ path: string; content: string }>,
  messageIndex: number,
  label?: string
): Checkpoint {
  const snapshots = new Map<string, string>();
  openFiles.forEach(f => snapshots.set(f.path, f.content));
  
  return {
    id: `cp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    label: label || `Checkpoint #${messageIndex + 1}`,
    timestamp: Date.now(),
    messageIndex,
    fileSnapshots: snapshots,
    description: `${openFiles.length} file(s) at message #${messageIndex + 1}`,
    isAutomatic: !label,
  };
}
