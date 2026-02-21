'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Send,
  Bot,
  User,
  Copy,
  Check,
  RotateCcw,
  ThumbsUp,
  ThumbsDown,
  Sparkles,
  Code,
  FileText,
  Lightbulb,
  Trash2,
  Settings,
  ChevronDown,
  MoreHorizontal,
  Loader2
} from 'lucide-react';

// Types
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  model?: string;
  tokens?: number;
  codeBlocks?: CodeBlock[];
  feedback?: 'positive' | 'negative' | null;
  isStreaming?: boolean;
}

export interface CodeBlock {
  id: string;
  language: string;
  code: string;
  filename?: string;
}

export interface AIChatPanelProps {
  messages?: ChatMessage[];
  onSendMessage?: (message: string, context?: string) => void;
  onRegenerate?: (messageId: string) => void;
  onFeedback?: (messageId: string, feedback: 'positive' | 'negative') => void;
  onCopyCode?: (code: string) => void;
  onApplyCode?: (code: string, filename?: string) => void;
  onClearHistory?: () => void;
  model?: string;
  availableModels?: string[];
  onModelChange?: (model: string) => void;
  isLoading?: boolean;
  placeholder?: string;
  className?: string;
}

// Code Block Component
const CodeBlockComponent: React.FC<{
  block: CodeBlock;
  onCopy: () => void;
  onApply?: () => void;
  copied: boolean;
}> = ({ block, onCopy, onApply, copied }) => {
  return (
    <div className="my-2 rounded-lg overflow-hidden border border-[#3c3c3c]">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#2d2d2d] text-xs">
        <span className="text-gray-400">{block.language}{block.filename && ` - ${block.filename}`}</span>
        <div className="flex items-center gap-1">
          {onApply && (
            <button
              onClick={onApply}
              className="px-2 py-0.5 text-blue-400 hover:text-blue-300 hover:bg-[#3c3c3c] rounded"
            >
              Apply
            </button>
          )}
          <button
            onClick={onCopy}
            className="flex items-center gap-1 px-2 py-0.5 text-gray-400 hover:text-white hover:bg-[#3c3c3c] rounded"
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>
      {/* Code */}
      <pre className="p-3 overflow-x-auto bg-[#1e1e1e] text-sm font-mono">
        <code className="text-gray-300">{block.code}</code>
      </pre>
    </div>
  );
};

// Message Component
const MessageComponent: React.FC<{
  message: ChatMessage;
  onRegenerate?: () => void;
  onFeedback?: (feedback: 'positive' | 'negative') => void;
  onCopyCode?: (code: string) => void;
  onApplyCode?: (code: string, filename?: string) => void;
}> = ({ message, onRegenerate, onFeedback, onCopyCode, onApplyCode }) => {
  const [copiedBlocks, setCopiedBlocks] = useState<Set<string>>(new Set());
  const isUser = message.role === 'user';

  // Parse code blocks from content
  const parseContent = (content: string): { text: string; codeBlocks: CodeBlock[] } => {
    const codeBlockRegex = /```(\w+)?(?:\s+(.+?))?\n([\s\S]*?)```/g;
    const codeBlocks: CodeBlock[] = [];
    let match;
    let index = 0;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      codeBlocks.push({
        id: `block-${index}`,
        language: match[1] || 'plaintext',
        filename: match[2],
        code: match[3].trim(),
      });
      index++;
    }

    const text = content.replace(codeBlockRegex, `__CODE_BLOCK_${codeBlocks.length - 1}__`);

    return { text, codeBlocks };
  };

  const { text, codeBlocks } = parseContent(message.content);

  const handleCopyBlock = (blockId: string, code: string) => {
    setCopiedBlocks((prev) => new Set(prev).add(blockId));
    onCopyCode?.(code);
    setTimeout(() => {
      setCopiedBlocks((prev) => {
        const next = new Set(prev);
        next.delete(blockId);
        return next;
      });
    }, 2000);
  };

  return (
    <div className={`flex gap-3 p-4 ${isUser ? 'bg-[#1e1e1e]' : 'bg-[#181818]'}`}>
      {/* Avatar */}
      <div className={`w-8 h-8 rounded flex items-center justify-center shrink-0 ${isUser ? 'bg-blue-600' : 'bg-gradient-to-br from-purple-500 to-pink-500'}`}>
        {isUser ? <User size={16} /> : <Bot size={16} />}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium text-gray-200">
            {isUser ? 'You' : 'PULSE AI'}
          </span>
          {message.model && (
            <span className="text-xs text-gray-500">({message.model})</span>
          )}
          <span className="text-xs text-gray-500">
            {message.timestamp.toLocaleTimeString()}
          </span>
          {message.isStreaming && (
            <Loader2 size={12} className="animate-spin text-blue-400" />
          )}
        </div>

        {/* Message Content */}
        <div className="text-sm text-gray-300 whitespace-pre-wrap">
          {text.split(/__CODE_BLOCK_(\d+)__/).map((part, i) => {
            if (i % 2 === 1) {
              const blockIndex = parseInt(part);
              const block = codeBlocks[blockIndex];
              if (block) {
                return (
                  <CodeBlockComponent
                    key={block.id}
                    block={block}
                    onCopy={() => handleCopyBlock(block.id, block.code)}
                    onApply={onApplyCode ? () => onApplyCode(block.code, block.filename) : undefined}
                    copied={copiedBlocks.has(block.id)}
                  />
                );
              }
            }
            return <span key={i}>{part}</span>;
          })}
        </div>

        {/* Actions */}
        {!isUser && !message.isStreaming && (
          <div className="flex items-center gap-1 mt-2 opacity-0 hover:opacity-100 transition-opacity">
            <button
              onClick={onRegenerate}
              className="p-1 text-gray-500 hover:text-gray-300 hover:bg-[#3c3c3c] rounded"
              title="Regenerate"
            >
              <RotateCcw size={14} />
            </button>
            <button
              onClick={() => onFeedback?.('positive')}
              className={`p-1 rounded ${message.feedback === 'positive' ? 'text-green-500' : 'text-gray-500 hover:text-gray-300 hover:bg-[#3c3c3c]'}`}
              title="Good response"
            >
              <ThumbsUp size={14} />
            </button>
            <button
              onClick={() => onFeedback?.('negative')}
              className={`p-1 rounded ${message.feedback === 'negative' ? 'text-red-500' : 'text-gray-500 hover:text-gray-300 hover:bg-[#3c3c3c]'}`}
              title="Bad response"
            >
              <ThumbsDown size={14} />
            </button>
            <button
              onClick={() => {
                navigator.clipboard.writeText(message.content);
              }}
              className="p-1 text-gray-500 hover:text-gray-300 hover:bg-[#3c3c3c] rounded"
              title="Copy message"
            >
              <Copy size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// Quick Actions
const QUICK_ACTIONS = [
  { id: 'explain', label: 'Explain code', icon: Lightbulb },
  { id: 'fix', label: 'Fix errors', icon: Code },
  { id: 'refactor', label: 'Refactor', icon: Sparkles },
  { id: 'document', label: 'Add docs', icon: FileText },
];

// Main AI Chat Panel Component
export const AIChatPanel: React.FC<AIChatPanelProps> = ({
  messages: controlledMessages,
  onSendMessage,
  onRegenerate,
  onFeedback,
  onCopyCode,
  onApplyCode,
  onClearHistory,
  model = 'Llama 3.2',
  availableModels = ['Llama 3.2', 'Code Llama', 'DeepSeek Coder', 'Mistral'],
  onModelChange,
  isLoading = false,
  placeholder = 'Ask PULSE AI anything...',
  className = '',
}) => {
  const [internalMessages, setInternalMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [selectedModel, setSelectedModel] = useState(model);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Use controlled or internal state
  const messages = controlledMessages ?? internalMessages;

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle send message
  const handleSend = useCallback(() => {
    if (!inputValue.trim() || isLoading) return;

    const newMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date(),
    };

    if (onSendMessage) {
      onSendMessage(inputValue.trim());
    } else {
      setInternalMessages((prev) => [...prev, newMessage]);
    }

    setInputValue('');
    inputRef.current?.focus();
  }, [inputValue, isLoading, onSendMessage]);

  // Handle quick action
  const handleQuickAction = useCallback((action: string) => {
    setInputValue(`${action.charAt(0).toUpperCase() + action.slice(1)}: `);
    inputRef.current?.focus();
  }, []);

  // Handle key down
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className={`flex flex-col h-full bg-[#1e1e1e] ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#3c3c3c]">
        <div className="flex items-center gap-2">
          <Bot size={18} className="text-purple-400" />
          <span className="font-medium text-gray-200">AI Assistant</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Model Selector */}
          <div className="relative">
            <button
              onClick={() => setShowModelSelector(!showModelSelector)}
              className="flex items-center gap-1 px-2 py-1 text-sm text-gray-400 hover:text-gray-200 hover:bg-[#3c3c3c] rounded"
            >
              <span>{selectedModel}</span>
              <ChevronDown size={12} />
            </button>
            {showModelSelector && (
              <div className="absolute right-0 top-full mt-1 z-10 bg-[#252526] border border-[#3c3c3c] rounded shadow-lg min-w-[150px]">
                {availableModels.map((m) => (
                  <button
                    key={m}
                    onClick={() => {
                      setSelectedModel(m);
                      setShowModelSelector(false);
                      onModelChange?.(m);
                    }}
                    className={`w-full px-3 py-1.5 text-left text-sm hover:bg-[#094771] ${m === selectedModel ? 'text-white' : 'text-gray-400'}`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Clear History */}
          <button
            onClick={onClearHistory}
            className="p-1 text-gray-400 hover:text-gray-200 hover:bg-[#3c3c3c] rounded"
            title="Clear history"
          >
            <Trash2 size={14} />
          </button>

          {/* Settings */}
          <button
            className="p-1 text-gray-400 hover:text-gray-200 hover:bg-[#3c3c3c] rounded"
            title="Settings"
          >
            <Settings size={14} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <Bot size={48} className="mb-4 opacity-50" />
            <p className="text-lg font-medium mb-2">PULSE AI Assistant</p>
            <p className="text-sm mb-4">Powered by {selectedModel}</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {QUICK_ACTIONS.map((action) => (
                <button
                  key={action.id}
                  onClick={() => handleQuickAction(action.label)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-[#2d2d2d] hover:bg-[#3c3c3c] rounded text-sm text-gray-300"
                >
                  <action.icon size={14} />
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <MessageComponent
                key={message.id}
                message={message}
                onRegenerate={onRegenerate ? () => onRegenerate(message.id) : undefined}
                onFeedback={onFeedback}
                onCopyCode={onCopyCode}
                onApplyCode={onApplyCode}
              />
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input Area */}
      <div className="p-3 border-t border-[#3c3c3c]">
        {/* Quick Actions */}
        <div className="flex gap-1 mb-2">
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action.id}
              onClick={() => handleQuickAction(action.label)}
              className="flex items-center gap-1 px-2 py-0.5 text-xs text-gray-500 hover:text-gray-300 hover:bg-[#3c3c3c] rounded"
            >
              <action.icon size={12} />
              {action.label}
            </button>
          ))}
        </div>

        {/* Input */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              rows={1}
              className="w-full px-3 py-2 bg-[#2d2d2d] border border-[#3c3c3c] rounded-lg text-sm text-gray-200 placeholder-gray-500 resize-none focus:outline-none focus:border-[#007acc]"
              style={{ minHeight: '40px', maxHeight: '120px' }}
            />
          </div>
          <button
            onClick={handleSend}
            disabled={!inputValue.trim() || isLoading}
            className={`px-4 py-2 rounded-lg flex items-center gap-1 ${
              inputValue.trim() && !isLoading
                ? 'bg-[#007acc] hover:bg-[#1a8cdb] text-white'
                : 'bg-[#2d2d2d] text-gray-500 cursor-not-allowed'
            }`}
          >
            {isLoading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Send size={16} />
            )}
          </button>
        </div>

        {/* Footer Info */}
        <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
          <span>Press Enter to send, Shift+Enter for new line</span>
          <span>{selectedModel}</span>
        </div>
      </div>
    </div>
  );
};

export default AIChatPanel;
