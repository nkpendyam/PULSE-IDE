'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Sparkles, X, Check, RotateCcw, ChevronUp, ChevronDown } from 'lucide-react';

interface InlineChatProps {
  isOpen: boolean;
  onClose: () => void;
  position: { x: number; y: number } | null;
  selection: {
    startLine: number;
    endLine: number;
    text: string;
  } | null;
  onAccept: (newText: string) => void;
  onReject: () => void;
}

export function InlineChat({ isOpen, onClose, position, selection, onAccept, onReject }: InlineChatProps) {
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [suggestedCode, setSuggestedCode] = useState<string | null>(null);
  const [showDiff, setShowDiff] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Submit to AI
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!prompt.trim()) return;

    setIsLoading(true);
    setResponse('');
    setSuggestedCode(null);

    try {
      // Call AI for code edit
      const result = await invoke<{ text: string; code: string }>('ai_inline_edit', {
        prompt,
        selectedCode: selection?.text || '',
        context: selection ? `Lines ${selection.startLine}-${selection.endLine}` : ''
      });

      setResponse(result.text);
      setSuggestedCode(result.code);
      setShowDiff(true);
    } catch (error) {
      console.error('Inline chat error:', error);
      setResponse('Error processing request. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [prompt, selection]);

  // Accept suggestion
  const handleAccept = () => {
    if (suggestedCode) {
      onAccept(suggestedCode);
    }
    handleClose();
  };

  // Reject and close
  const handleReject = () => {
    onReject();
    handleClose();
  };

  // Close and reset
  const handleClose = () => {
    setPrompt('');
    setResponse('');
    setSuggestedCode(null);
    setShowDiff(false);
    onClose();
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      }

      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (suggestedCode) {
          handleAccept();
        } else {
          handleSubmit(e as unknown as React.FormEvent);
        }
      }

      if (e.key === 'Tab' && suggestedCode) {
        e.preventDefault();
        handleAccept();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, suggestedCode, handleClose, handleAccept, handleSubmit]);

  if (!isOpen || !position) return null;

  return (
    <div
      className="fixed z-50 w-[400px] bg-[#161b22] border border-[#30363d] rounded-lg shadow-2xl overflow-hidden"
      style={{ left: position.x, top: position.y }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#30363d] bg-[#0d1117]">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-[#a371f7]" />
          <span className="text-xs font-medium text-[#c9d1d9]">AI Edit</span>
        </div>
        <button onClick={handleClose} className="p-1 hover:bg-[#21262d] rounded">
          <X size={14} className="text-[#8b949e]" />
        </button>
      </div>

      {/* Selected code preview */}
      {selection && selection.text && (
        <div className="px-3 py-2 border-b border-[#30363d] bg-[#0d1117]">
          <div className="text-xs text-[#8b949e] mb-1">Selected:</div>
          <pre className="text-xs text-[#c9d1d9] font-mono max-h-[60px] overflow-hidden">
            {selection.text.slice(0, 200)}
            {selection.text.length > 200 && '...'}
          </pre>
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-3">
        <div className="flex items-start gap-2">
          <textarea
            ref={inputRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe what you want to change..."
            className="flex-1 bg-[#0d1117] border border-[#30363d] rounded px-3 py-2 text-sm text-[#c9d1d9] placeholder-[#8b949e] outline-none resize-none focus:border-[#58a6ff]"
            rows={2}
            disabled={isLoading}
          />
        </div>
        <div className="flex items-center justify-between mt-2">
          <span className="text-[10px] text-[#8b949e]">Ctrl+Enter to submit</span>
          <button
            type="submit"
            disabled={!prompt.trim() || isLoading}
            className="px-3 py-1 bg-[#238636] hover:bg-[#2ea043] disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs rounded"
          >
            {isLoading ? 'Processing...' : 'Submit'}
          </button>
        </div>
      </form>

      {/* Response */}
      {(response || isLoading) && (
        <div className="px-3 py-2 border-t border-[#30363d]">
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-[#8b949e]">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#58a6ff]"></div>
              Thinking...
            </div>
          ) : (
            <>
              <div className="text-xs text-[#8b949e] mb-1">Response:</div>
              <div className="text-sm text-[#c9d1d9]">{response}</div>
            </>
          )}
        </div>
      )}

      {/* Suggested code diff */}
      {suggestedCode && showDiff && (
        <div className="border-t border-[#30363d]">
          <div className="flex items-center justify-between px-3 py-2 bg-[#0d1117]">
            <span className="text-xs text-[#8b949e]">Suggested changes:</span>
            <button
              onClick={() => setShowDiff(!showDiff)}
              className="p-1 hover:bg-[#21262d] rounded"
            >
              {showDiff ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>
          
          {showDiff && (
            <div className="max-h-[200px] overflow-auto font-mono text-xs">
              <pre className="p-3 text-[#c9d1d9] whitespace-pre-wrap">{suggestedCode}</pre>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2 px-3 py-2 border-t border-[#30363d] bg-[#0d1117]">
            <button
              onClick={handleReject}
              className="flex items-center gap-1 px-3 py-1 text-xs text-[#8b949e] hover:text-[#c9d1d9] hover:bg-[#21262d] rounded"
            >
              <RotateCcw size={12} />
              Reject
            </button>
            <button
              onClick={handleAccept}
              className="flex items-center gap-1 px-3 py-1 bg-[#238636] hover:bg-[#2ea043] text-white text-xs rounded"
            >
              <Check size={12} />
              Accept (Tab)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
