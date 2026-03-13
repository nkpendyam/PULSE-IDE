'use client';

import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useKyroStore, ChatMessage, FileNode, RagSource } from '@/store/kyroStore';
import { MentionAutocomplete, MentionItem } from './MentionAutocomplete';
import { buildMentionContext, parseMentions } from './mentionContext';
import { 
  Send, Trash2, Sparkles, FileCode, Search, Check, X, 
  ChevronDown, ChevronRight, Clock, AlertTriangle, Loader2,
  Code, MessageSquare, Zap, BookOpen
} from 'lucide-react';

// Types specific to this component
interface PendingEdit {
  id: string;
  description: string;
  filePath: string;
  diff: string;
  status: 'pending' | 'approved' | 'rejected';
}

interface AgentResult {
  success: boolean;
  message: string;
  files_changed: string[];
  requires_approval: boolean;
  approval_id?: string;
}

interface MentionPreviewItem {
  id: string;
  label: string;
  detail: string;
  resolved: boolean;
  rawToken: string;
}

function treeContainsPrefix(root: FileNode | null, prefix: string): boolean {
  if (!root || !prefix) {
    return false;
  }

  const stack: FileNode[] = [root];
  while (stack.length > 0) {
    const node = stack.pop();
    if (!node) {
      continue;
    }

    if (node.path === prefix || node.path.startsWith(`${prefix}/`) || node.path.startsWith(`${prefix}\\`)) {
      return true;
    }

    if (node.children) {
      for (const child of node.children) {
        stack.push(child);
      }
    }
  }

  return false;
}

// Streaming Message Component
function StreamingMessage({ message }: { message: ChatMessage }) {
  // Use message.content directly - no need for derived state
  const displayedContent = message.content;

  return (
    <div className="max-w-[85%] rounded-lg p-3 text-sm bg-[#21262d] text-[#c9d1d9]">
      <div className="whitespace-pre-wrap break-words">
        {displayedContent}
        {message.isStreaming && (
          <span className="inline-block w-2 h-4 ml-1 bg-[#a371f7] animate-pulse" />
        )}
      </div>
      {message.ragSources && message.ragSources.length > 0 && (
        <div className="mt-3 pt-3 border-t border-[#30363d]">
          <div className="text-xs text-[#8b949e] mb-2 flex items-center gap-1">
            <BookOpen size={12} />
            <span>Sources</span>
          </div>
          {message.ragSources.map((source, idx) => (
            <RagSourceCard key={idx} source={source} />
          ))}
        </div>
      )}
    </div>
  );
}

// RAG Source Card Component
function RagSourceCard({ source }: { source: RagSource }) {
  const [expanded, setExpanded] = useState(false);
  
  return (
    <div className="mb-2 rounded border border-[#30363d] bg-[#0d1117] overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-2 py-1 flex items-center gap-2 text-xs hover:bg-[#21262d] text-left"
      >
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <FileCode size={12} className="text-[#58a6ff]" />
        <span className="text-[#58a6ff] truncate flex-1">{source.file_path}</span>
        <span className="text-[#8b949e]">{source.start_line}-{source.end_line}</span>
        <span className="text-[#3fb950]">{Math.round(source.score * 100)}%</span>
      </button>
      {expanded && (
        <pre className="p-2 text-xs text-[#8b949e] overflow-x-auto bg-[#161b22]">
          <code>{source.preview}</code>
        </pre>
      )}
    </div>
  );
}

// Pending Edit Approval Component
function PendingEditApproval({ 
  edit, 
  onApprove, 
  onReject 
}: { 
  edit: PendingEdit;
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <div className="border border-[#f0883e] rounded-lg p-3 bg-[#1a1108]">
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle size={14} className="text-[#f0883e]" />
        <span className="text-sm font-medium text-[#f0883e]">Pending Approval</span>
      </div>
      <p className="text-sm text-[#c9d1d9] mb-2">{edit.description}</p>
      <p className="text-xs text-[#8b949e] mb-3">
        <FileCode size={12} className="inline mr-1" />
        {edit.filePath}
      </p>
      <pre className="text-xs bg-[#0d1117] p-2 rounded mb-3 overflow-x-auto">
        <code>{edit.diff}</code>
      </pre>
      <div className="flex gap-2">
        <button
          onClick={onApprove}
          className="flex-1 px-3 py-1.5 bg-[#238636] hover:bg-[#2ea043] text-white text-sm rounded flex items-center justify-center gap-1"
        >
          <Check size={14} /> Approve
        </button>
        <button
          onClick={onReject}
          className="flex-1 px-3 py-1.5 bg-[#da3633] hover:bg-[#f85149] text-white text-sm rounded flex items-center justify-center gap-1"
        >
          <X size={14} /> Reject
        </button>
      </div>
    </div>
  );
}

// Quick Action Button
function QuickActionButton({ 
  icon: Icon, 
  label, 
  onClick 
}: { 
  icon: React.ElementType;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-1.5 bg-[#21262d] hover:bg-[#30363d] rounded text-xs text-[#c9d1d9] border border-[#30363d] transition-colors"
    >
      <Icon size={14} />
      {label}
    </button>
  );
}

// Main AI Chat Sidebar Component
export function AIChatSidebar() {
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [pendingEdits, setPendingEdits] = useState<PendingEdit[]>([]);
  const [sessionId, setSessionId] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [showMentions, setShowMentions] = useState(false);
  const [cursorPos, setCursorPos] = useState(0);
  
  const { 
    chatMessages, 
    isAiLoading, 
    models, 
    selectedModel, 
    isOllamaRunning, 
    addChatMessage, 
    clearChatMessages, 
    setAiLoading,
    openFiles,
    activeFileIndex,
    projectPath,
    fileTree,
    terminalOutput,
    gitStatus
  } = useKyroStore();
  
  const currentFile = activeFileIndex >= 0 ? openFiles[activeFileIndex] : null;
  const mentionPreviewItems = useMemo<MentionPreviewItem[]>(() => {
    const parsed = parseMentions(input).mentions;

    return parsed.map((mention, index) => {
      const id = `${mention.type}-${mention.value}-${index}`;

      if (mention.type === 'file') {
        if (!mention.value) {
          return {
            id,
            label: '@file',
            detail: currentFile ? currentFile.path : 'No active file',
            resolved: Boolean(currentFile),
            rawToken: mention.raw,
          };
        }

        const existsInOpenFiles = openFiles.some((file) => file.path === mention.value);
        return {
          id,
          label: '@file',
          detail: mention.value,
          resolved: existsInOpenFiles,
          rawToken: mention.raw,
        };
      }

      if (mention.type === 'folder') {
        const folderPath = mention.value || 'root';
        const resolved = mention.value ? treeContainsPrefix(fileTree, mention.value) : Boolean(fileTree);
        return {
          id,
          label: '@folder',
          detail: folderPath,
          resolved,
          rawToken: mention.raw,
        };
      }

      if (mention.type === 'terminal') {
        const hasOutput = terminalOutput.trim().length > 0;
        return {
          id,
          label: '@terminal',
          detail: hasOutput ? 'Terminal output available' : 'Terminal output empty',
          resolved: hasOutput,
          rawToken: mention.raw,
        };
      }

      if (mention.type === 'git') {
        return {
          id,
          label: '@git',
          detail: gitStatus ? gitStatus.branch : 'Git status unavailable',
          resolved: Boolean(gitStatus),
          rawToken: mention.raw,
        };
      }

      if (mention.type === 'previous') {
        return {
          id,
          label: '@previous',
          detail: chatMessages.length > 0 ? `${chatMessages.length} message(s)` : 'No previous messages',
          resolved: chatMessages.length > 0,
          rawToken: mention.raw,
        };
      }

      if (mention.type === 'codebase') {
        return {
          id,
          label: '@codebase',
          detail: fileTree ? projectPath || 'Project loaded' : 'Project tree unavailable',
          resolved: Boolean(fileTree),
          rawToken: mention.raw,
        };
      }

      return {
        id,
        label: '@web',
        detail: 'Not available in local mode',
        resolved: false,
        rawToken: mention.raw,
      };
    });
  }, [chatMessages.length, currentFile, fileTree, gitStatus, input, openFiles, projectPath, terminalOutput]);

  const removeMentionTokenFromInput = (source: string, rawToken: string, mode: 'first' | 'last'): string => {
    if (!rawToken || !source) {
      return source;
    }

    const findCandidate = (startFromLast: boolean) => {
      let index = startFromLast ? source.lastIndexOf(rawToken) : source.indexOf(rawToken);

      while (index !== -1) {
        const leftOk = index === 0 || /\s/.test(source[index - 1]);
        const rightIndex = index + rawToken.length;
        const rightOk = rightIndex === source.length || /\s/.test(source[rightIndex]);

        if (leftOk && rightOk) {
          return index;
        }

        index = startFromLast
          ? source.lastIndexOf(rawToken, index - 1)
          : source.indexOf(rawToken, index + 1);
      }

      return -1;
    };

    const tokenIndex = mode === 'last' ? findCandidate(true) : findCandidate(false);
    if (tokenIndex === -1) {
      return source;
    }

    const before = source.slice(0, tokenIndex).trimEnd();
    const after = source.slice(tokenIndex + rawToken.length).trimStart();
    return [before, after].filter(Boolean).join(' ');
  };

  const handleRemoveMentionChip = (item: MentionPreviewItem) => {
    setInput((prev) => {
      return removeMentionTokenFromInput(prev, item.rawToken, 'first');
    });
    setShowMentions(false);
    inputRef.current?.focus();
  };

  // Initialize session
  useEffect(() => {
    const initSession = async () => {
      try {
        const id = await invoke<string>('create_chat_session', {
          projectPath: projectPath || '.'
        });
        setSessionId(id);
      } catch (e) {
        console.error('Failed to create chat session:', e);
      }
    };
    initSession();
  }, [projectPath]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Handle send message with RAG context
  const handleSend = async () => {
    if (!input.trim() || isAiLoading || isStreaming) return;
    
    const userMessage = input.trim();
    const { cleanText, mentions } = parseMentions(userMessage);
    const mentionContextBlocks = buildMentionContext({
      mentions,
      openFiles,
      currentFile,
      fileTree,
      terminalOutput,
      gitStatus,
      chatMessages,
      projectPath,
    });
    const enrichedMessage = mentionContextBlocks.length > 0
      ? `${cleanText}\n\n[MENTION CONTEXT]\n${mentionContextBlocks.join('\n\n')}`
      : cleanText;

    setInput('');
    
    // Add user message
    addChatMessage({
      id: Date.now().toString(),
      role: 'user',
      content: userMessage,
      timestamp: new Date()
    });
    
    setAiLoading(true);
    setIsStreaming(true);

    // Add placeholder for streaming response
    const assistantId = (Date.now() + 1).toString();
    addChatMessage({
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true
    });

    try {
      // Build context from current file and open files
      const context = {
        currentFile: currentFile ? {
          file_path: currentFile.path,
          content: currentFile.content,
          language: currentFile.language,
          start_line: 1,
          end_line: currentFile.content.split('\n').length
        } : null,
        openFiles: openFiles.map(f => ({
          file_path: f.path,
          content: f.content,
          language: f.language,
          start_line: 1,
          end_line: f.content.split('\n').length
        }))
      };

      // Call RAG-enhanced chat
      const response = await invoke<{
        message: ChatMessage;
        rag_sources: RagSource[];
        tokens_used: number;
        time_to_first_token_ms: number;
        total_time_ms: number;
      }>('rag_chat', {
        sessionId,
        message: enrichedMessage,
        context
      });

      // Update assistant message with full response
      addChatMessage({
        id: assistantId,
        role: 'assistant',
        content: response.message.content,
        timestamp: new Date(),
        ragSources: response.rag_sources,
        isStreaming: false
      });

    } catch (error) {
      addChatMessage({
        id: assistantId,
        role: 'assistant',
        content: `Error: ${error}`,
        timestamp: new Date(),
        isStreaming: false
      });
    } finally {
      setAiLoading(false);
      setIsStreaming(false);
    }
  };

  // Handle quick agent actions
  const handleQuickAction = async (action: string) => {
    if (!currentFile) return;

    const prompt = `${action} in ${currentFile.path}`;
    setInput(prompt);
    inputRef.current?.focus();
  };

  // Handle agent command (Fix the bug, etc.)
  const handleAgentCommand = async (command: string) => {
    if (!currentFile) return;

    try {
      const result = await invoke<AgentResult>('agent_command', {
        command,
        context: {
          projectPath: projectPath || '.',
          currentFile: currentFile.path,
          openFiles: openFiles.map(f => f.path)
        }
      });

      if (result.requires_approval && result.approval_id) {
        // Add pending edit for approval
        setPendingEdits(prev => [...prev, {
          id: result.approval_id!,
          description: result.message,
          filePath: result.files_changed[0] || 'Unknown',
          diff: 'Preview not available',
          status: 'pending'
        }]);
      }

      addChatMessage({
        id: Date.now().toString(),
        role: 'assistant',
        content: result.message,
        timestamp: new Date()
      });

    } catch (error) {
      addChatMessage({
        id: Date.now().toString(),
        role: 'assistant',
        content: `Error: ${error}`,
        timestamp: new Date()
      });
    }
  };

  // Handle approval
  const handleApprove = async (editId: string) => {
    try {
      await invoke('agent_approve', { approvalId: editId });
      setPendingEdits(prev => prev.filter(e => e.id !== editId));
      addChatMessage({
        id: Date.now().toString(),
        role: 'assistant',
        content: 'Changes applied successfully!',
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Approval failed:', error);
    }
  };

  // Handle rejection
  const handleReject = async (editId: string) => {
    try {
      await invoke('agent_reject', { approvalId: editId });
      setPendingEdits(prev => prev.filter(e => e.id !== editId));
    } catch (error) {
      console.error('Rejection failed:', error);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Backspace') {
      const textarea = inputRef.current;
      const selectionStart = textarea?.selectionStart ?? cursorPos;
      const selectionEnd = textarea?.selectionEnd ?? cursorPos;

      if (selectionStart === selectionEnd && selectionStart === input.length && mentionPreviewItems.length > 0) {
        e.preventDefault();
        const lastMention = mentionPreviewItems[mentionPreviewItems.length - 1];
        setInput((prev) => removeMentionTokenFromInput(prev, lastMention.rawToken, 'last'));
        setShowMentions(false);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInput(value);
    setCursorPos(e.target.selectionStart || 0);
    // Show mention autocomplete when @ is typed
    const textBeforeCursor = value.slice(0, e.target.selectionStart || 0);
    setShowMentions(/@\w*$/.test(textBeforeCursor));
  };

  const handleMentionSelect = (mention: MentionItem, filePath?: string) => {
    const textBeforeCursor = input.slice(0, cursorPos);
    const textAfterCursor = input.slice(cursorPos);
    const atMatch = textBeforeCursor.match(/@\w*$/);
    if (atMatch) {
      const beforeAt = textBeforeCursor.slice(0, atMatch.index);
      const mentionText = filePath ? `${mention.value}:${filePath}` : mention.value;
      setInput(beforeAt + mentionText + ' ' + textAfterCursor);
    }
    setShowMentions(false);
  };

  return (
    <div className="flex flex-col h-full bg-[#0d1117]">
      {/* Header */}
      <div className="h-9 bg-[#161b22] border-b border-[#30363d] flex items-center px-3 justify-between">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-[#a371f7]" />
          <span className="text-xs font-medium">AI Assistant</span>
          <span className="text-xs text-[#8b949e]">(RAG + Local)</span>
        </div>
        <button 
          onClick={clearChatMessages} 
          className="p-1 hover:bg-[#21262d] rounded text-[#8b949e] hover:text-[#c9d1d9]" 
          title="Clear chat"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Status messages */}
        {!isOllamaRunning && (
          <div className="text-center py-8">
            <div className="text-4xl mb-2">🔌</div>
            <p className="text-sm text-[#8b949e] mb-2">Local LLM not initialized</p>
            <p className="text-xs text-[#8b949e]">The embedded model will load automatically</p>
          </div>
        )}

        {/* Pending Edits */}
        {pendingEdits.map(edit => (
          <PendingEditApproval
            key={edit.id}
            edit={edit}
            onApprove={() => handleApprove(edit.id)}
            onReject={() => handleReject(edit.id)}
          />
        ))}

        {/* Chat Messages */}
        {chatMessages.map((message) => (
          <div 
            key={message.id} 
            className={`flex gap-2 ${message.role === 'user' ? 'justify-end' : ''}`}
          >
            {message.role === 'assistant' && (
              <div className="w-6 h-6 rounded bg-[#a371f7] flex items-center justify-center flex-shrink-0">
                <Sparkles size={12} className="text-white" />
              </div>
            )}
            
            {message.role === 'assistant' ? (
              <StreamingMessage message={message} />
            ) : (
              <div className="max-w-[85%] rounded-lg p-3 text-sm bg-[#1f6feb] text-white">
                <div className="whitespace-pre-wrap break-words">{message.content}</div>
              </div>
            )}
          </div>
        ))}

        {/* Loading indicator */}
        {isAiLoading && !isStreaming && (
          <div className="flex gap-2">
            <div className="w-6 h-6 rounded bg-[#a371f7] flex items-center justify-center flex-shrink-0">
              <Sparkles size={12} className="text-white" />
            </div>
            <div className="bg-[#21262d] rounded-lg p-3">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-[#8b949e] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-[#8b949e] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-[#8b949e] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Actions */}
      {currentFile && (
        <div className="px-3 py-2 border-t border-[#30363d] flex flex-wrap gap-2">
          <QuickActionButton
            icon={Zap}
            label="Fix Bug"
            onClick={() => handleQuickAction('Fix the bug')}
          />
          <QuickActionButton
            icon={Code}
            label="Refactor"
            onClick={() => handleQuickAction('Refactor this code')}
          />
          <QuickActionButton
            icon={Search}
            label="Explain"
            onClick={() => handleQuickAction('Explain this code')}
          />
          <QuickActionButton
            icon={MessageSquare}
            label="Add Tests"
            onClick={() => handleQuickAction('Add tests for this code')}
          />
        </div>
      )}

      {/* Input */}
      <div className="p-3 border-t border-[#30363d] relative">
        <MentionAutocomplete
          inputValue={input}
          cursorPosition={cursorPos}
          onSelect={handleMentionSelect}
          onDismiss={() => setShowMentions(false)}
          visible={showMentions}
        />
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={isOllamaRunning ? "Ask about your code... (knows your entire project)" : "Loading model..."}
            disabled={!isOllamaRunning || isAiLoading}
            className="flex-1 bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-[#58a6ff] disabled:opacity-50 disabled:cursor-not-allowed text-[#c9d1d9] placeholder-[#8b949e]"
            rows={3}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isAiLoading || !isOllamaRunning}
            className="px-3 bg-[#238636] hover:bg-[#2ea043] disabled:bg-[#21262d] disabled:text-[#8b949e] rounded-lg text-white transition-colors"
          >
            <Send size={16} />
          </button>
        </div>

        {mentionPreviewItems.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {mentionPreviewItems.map((item) => (
              <div
                key={item.id}
                className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-[10px] ${
                  item.resolved
                    ? 'border-[#2ea043] bg-[#1a2a1a] text-[#8ddb8c]'
                    : 'border-[#f0883e] bg-[#2a1f14] text-[#f2b37b]'
                }`}
                title={item.detail}
              >
                <span className="font-medium">{item.label}</span>
                <span className="opacity-85">{item.detail}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveMentionChip(item)}
                  className="ml-0.5 rounded p-0.5 hover:bg-[#30363d]"
                  aria-label={`Remove ${item.label} mention`}
                  title="Remove mention"
                >
                  <X size={10} />
                </button>
              </div>
            ))}
          </div>
        )}
        
        {/* Context indicator */}
        {currentFile && (
          <div className="mt-2 text-xs text-[#8b949e] flex items-center gap-1">
            <FileCode size={10} />
            <span>Context: {currentFile.path}</span>
            {openFiles.length > 1 && (
              <span className="text-[#58a6ff]"> +{openFiles.length - 1} open files</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default AIChatSidebar;
