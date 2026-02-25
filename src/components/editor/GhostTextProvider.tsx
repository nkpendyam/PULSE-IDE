'use client';

/**
 * Ghost Text Provider for Monaco Editor
 * 
 * Implements Monaco's InlineCompletionsProvider interface for AI-powered
 * code completions with streaming token display.
 * 
 * Based on:
 * - https://github.com/ydb-platform/monaco-ghost
 * - https://microsoft.github.io/monaco-editor/api/interfaces/monaco.languages.InlineCompletionsProvider.html
 */

import React, { useEffect, useRef, useCallback, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';

// Ghost text configuration
interface GhostTextConfig {
  enabled: boolean;
  debounceMs: number;
  maxTokens: number;
  temperature: number;
  triggerOnTyping: boolean;
  triggerOnNewline: boolean;
  minPrefixLength: number;
  showAcceptHint: boolean;
}

const DEFAULT_CONFIG: GhostTextConfig = {
  enabled: true,
  debounceMs: 300,
  maxTokens: 100,
  temperature: 0.3,
  triggerOnTyping: true,
  triggerOnNewline: true,
  minPrefixLength: 3,
  showAcceptHint: true,
};

// Streaming completion state
interface StreamingCompletion {
  id: string;
  text: string;
  position: { lineNumber: number; column: number };
  isStreaming: boolean;
  abortController?: AbortController;
}

// Streaming token event from backend
interface StreamTokenEvent {
  id: string;
  token: string;
  done: boolean;
}

export function useGhostTextProvider(
  editor: monaco.editor.IStandaloneCodeEditor | null,
  monaco: typeof import('monaco-editor') | null,
  language: string,
  config: Partial<GhostTextConfig> = {}
) {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const [currentCompletion, setCurrentCompletion] = useState<StreamingCompletion | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const completionIdRef = useRef(0);
  const streamingRef = useRef(false);
  const unlistenRef = useRef<UnlistenFn | null>(null);

  // Setup streaming listener
  useEffect(() => {
    const setupStreamingListener = async () => {
      try {
        const unlisten = await listen<StreamTokenEvent>('llm-stream-token', (event) => {
          const { id, token, done } = event.payload;
          
          setCurrentCompletion(prev => {
            if (!prev || prev.id !== id) return prev;
            
            if (done) {
              streamingRef.current = false;
              setIsProcessing(false);
              return { ...prev, isStreaming: false };
            }
            
            return {
              ...prev,
              text: prev.text + token,
              isStreaming: true,
            };
          });
        });
        
        unlistenRef.current = unlisten;
      } catch (error) {
        console.log('Streaming listener not available:', error);
      }
    };
    
    setupStreamingListener();
    
    return () => {
      if (unlistenRef.current) {
        unlistenRef.current();
      }
    };
  }, []);

  // Cancel current completion
  const cancelCompletion = useCallback(() => {
    streamingRef.current = false;
    setIsProcessing(false);
    setCurrentCompletion(null);
  }, []);

  // Fetch streaming completion using embedded LLM
  const fetchStreamingCompletion = useCallback(async (
    model: monaco.editor.ITextModel,
    position: monaco.Position
  ): Promise<void> => {
    if (!cfg.enabled || isProcessing) return;

    // Get context
    const textUntilPosition = model.getValueInRange({
      startLineNumber: 1,
      startColumn: 1,
      endLineNumber: position.lineNumber,
      endColumn: position.column,
    });

    // Check minimum prefix length
    const currentLine = model.getLineContent(position.lineNumber);
    const prefixOnLine = currentLine.substring(0, position.column - 1);
    if (prefixOnLine.length < cfg.minPrefixLength && !prefixOnLine.includes('\n')) {
      return;
    }

    // Cancel previous
    cancelCompletion();

    const id = `completion-${++completionIdRef.current}`;
    streamingRef.current = true;

    setIsProcessing(true);
    setCurrentCompletion({
      id,
      text: '',
      position: { lineNumber: position.lineNumber, column: position.column },
      isStreaming: true,
    });

    try {
      // First try embedded LLM for local inference
      try {
        const isEmbeddedReady = await invoke<boolean>('is_embedded_llm_ready');
        if (isEmbeddedReady) {
          const response = await invoke<string>('embedded_code_complete', {
            code: textUntilPosition,
            language: model.getLanguageId(),
            cursorPosition: textUntilPosition.length,
            options: {
              maxTokens: cfg.maxTokens,
              temperature: cfg.temperature,
              stream: true
            }
          });

          if (response && response.trim()) {
            setCurrentCompletion(prev =>
              prev?.id === id
                ? { ...prev, text: response, isStreaming: false }
                : prev
            );
          }
          return;
        }
      } catch {
        // Fall back to Ollama
      }

      // Fallback to Ollama/AI completion
      const response = await invoke<string>('ai_code_completion', {
        code: textUntilPosition,
        language: model.getLanguageId(),
        maxTokens: cfg.maxTokens,
      });

      if (response && response.trim()) {
        setCurrentCompletion(prev =>
          prev?.id === id
            ? { ...prev, text: response, isStreaming: false }
            : prev
        );
      }

    } catch (error) {
      console.log('Ghost text completion error:', error);
      setCurrentCompletion(null);
    } finally {
      streamingRef.current = false;
      setIsProcessing(false);
    }
  }, [cfg, isProcessing, cancelCompletion]);

  // Register inline completions provider
  useEffect(() => {
    if (!editor || !monaco) return;

    const model = editor.getModel();
    if (!model) return;

    // Register the provider
    const provider: monaco.languages.InlineCompletionsProvider = {
      provideInlineCompletions: async (model, position, context, token) => {
        if (!cfg.enabled) {
          return { items: [] };
        }

        // Clear debounce
        clearTimeout(debounceRef.current);

        // Wait for debounce
        await new Promise<void>(resolve => {
          debounceRef.current = setTimeout(resolve, cfg.debounceMs);
        });

        if (token.isCancellationRequested) {
          return { items: [] };
        }

        // Get completion
        const textUntilPosition = model.getValueInRange({
          startLineNumber: 1,
          startColumn: 1,
          endLineNumber: position.lineNumber,
          endColumn: position.column,
        });

        try {
          const completion = await invoke<string>('ai_code_completion', {
            code: textUntilPosition,
            language: model.getLanguageId(),
            maxTokens: cfg.maxTokens,
            temperature: cfg.temperature,
          });

          if (token.isCancellationRequested || !completion?.trim()) {
            return { items: [] };
          }

          return {
            items: [
              {
                insertText: completion,
                range: new monaco.Range(
                  position.lineNumber,
                  position.column,
                  position.lineNumber,
                  position.column
                ),
              }
            ]
          };
        } catch (error) {
          console.log('Inline completion error:', error);
          return { items: [] };
        }
      },

      freeInlineCompletions: () => {
        // Cleanup if needed
      },

      handleItemDidAccept: (completionItem) => {
        // Log acceptance for telemetry
        console.log('Ghost text accepted');
      },
    };

    const disposable = monaco.languages.registerInlineCompletionsProvider(
      { pattern: '**/*' },
      provider
    );

    return () => {
      disposable.dispose();
      clearTimeout(debounceRef.current);
    };
  }, [editor, monaco, cfg]);

  // Handle keyboard shortcuts
  useEffect(() => {
    if (!editor || !monaco) return;

    // Tab to accept ghost text (Monaco handles this by default with inlineSuggest)
    // Escape to reject
    editor.addCommand(monaco.KeyCode.Escape, () => {
      cancelCompletion();
      // Trigger hide inline suggestions
      editor.trigger('keyboard', 'hideInlineSuggestion', {});
    });

    // Ctrl+Right to accept word
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.RightArrow, () => {
      // Accept next word of ghost text
      if (currentCompletion?.text) {
        const nextWord = currentCompletion.text.split(/\s+/)[0] + ' ';
        const position = editor.getPosition();
        if (position) {
          editor.executeEdits('ghost-text-word', [{
            range: new monaco.Range(
              position.lineNumber,
              position.column,
              position.lineNumber,
              position.column
            ),
            text: nextWord
          }]);
          
          // Update remaining text
          setCurrentCompletion(prev => prev ? {
            ...prev,
            text: prev.text.substring(nextWord.length),
            position: { 
              lineNumber: position.lineNumber, 
              column: position.column + nextWord.length 
            }
          } : null);
        }
      }
    });

  }, [editor, monaco, currentCompletion, cancelCompletion]);

  return {
    currentCompletion,
    isProcessing,
    cancelCompletion,
    config: cfg,
  };
}

// Ghost Text Overlay Component
export function GhostTextOverlay({ 
  editor, 
  completion,
  showHint = true 
}: { 
  editor: monaco.editor.IStandaloneCodeEditor | null;
  completion: StreamingCompletion | null;
  showHint?: boolean;
}) {
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!editor || !completion) return;

    const updatePosition = () => {
      const layoutInfo = editor.getLayoutInfo();
      const position = editor.getPosition();
      if (!position) return;

      // Calculate pixel position
      const lineTop = editor.getTopForLineNumber(completion.position.lineNumber);
      const columnLeft = (completion.position.column - 1) * layoutInfo.fontInfo.typicalFullwidthCharacterWidth;

      setPosition({
        top: lineTop + layoutInfo.contentTop,
        left: columnLeft + layoutInfo.contentLeft
      });
    };

    updatePosition();
    
    const disposable = editor.onDidLayoutChange(updatePosition);
    return () => disposable.dispose();
  }, [editor, completion]);

  if (!completion?.text) return null;

  return (
    <div
      className="absolute pointer-events-none z-50 font-mono"
      style={{
        top: position.top,
        left: position.left,
        fontSize: '14px',
        fontFamily: 'JetBrains Mono, Fira Code, monospace',
      }}
    >
      <span className="text-[#8b949e80] italic whitespace-pre">
        {completion.text}
      </span>
      {showHint && (
        <span className="text-[#58a6ff] text-xs ml-2 opacity-70">
          {completion.isStreaming ? '...' : 'Tab'}
        </span>
      )}
    </div>
  );
}

// Inline Chat Widget for AI assistance
export function InlineChatWidget({
  editor,
  position,
  selection,
  onClose,
}: {
  editor: monaco.editor.IStandaloneCodeEditor | null;
  position: monaco.Position | null;
  selection: monaco.Selection | null;
  onClose: () => void;
}) {
  const [prompt, setPrompt] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async () => {
    if (!prompt.trim() || !editor) return;

    setIsProcessing(true);
    setSuggestion(null);

    try {
      const selectedText = selection 
        ? editor.getModel()?.getValueInRange(selection) 
        : '';

      const response = await invoke<string>('ai_inline_chat', {
        prompt,
        selectedCode: selectedText,
        language: editor.getModel()?.getLanguageId() || 'plaintext',
        context: editor.getModel()?.getValue() || '',
      });

      setSuggestion(response);
    } catch (error) {
      console.error('Inline chat error:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const applySuggestion = () => {
    if (!suggestion || !editor || !selection) return;

    editor.executeEdits('inline-chat', [{
      range: selection,
      text: suggestion,
    }]);

    onClose();
  };

  return (
    <div className="absolute z-50 bg-[#161b22] border border-[#30363d] rounded-lg shadow-xl p-3 w-96">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[#a371f7] text-sm font-medium">AI Assistant</span>
        <button
          onClick={onClose}
          className="ml-auto text-[#8b949e] hover:text-[#c9d1d9]"
        >
          ✕
        </button>
      </div>

      <input
        ref={inputRef}
        type="text"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
        placeholder="Ask AI to edit, explain, or fix..."
        className="w-full px-3 py-2 bg-[#0d1117] border border-[#30363d] rounded text-sm text-[#c9d1d9] placeholder-[#8b949e] focus:outline-none focus:border-[#58a6ff]"
        disabled={isProcessing}
      />

      {isProcessing && (
        <div className="flex items-center gap-2 mt-2 text-sm text-[#8b949e]">
          <div className="animate-spin h-4 w-4 border-2 border-[#58a6ff] border-t-transparent rounded-full" />
          Thinking...
        </div>
      )}

      {suggestion && (
        <div className="mt-3 border-t border-[#30363d] pt-3">
          <div className="text-xs text-[#8b949e] mb-2">Suggested change:</div>
          <pre className="text-sm text-[#c9d1d9] bg-[#0d1117] p-2 rounded overflow-auto max-h-40">
            {suggestion}
          </pre>
          <div className="flex gap-2 mt-2">
            <button
              onClick={applySuggestion}
              className="px-3 py-1 bg-[#238636] hover:bg-[#2ea043] text-white text-sm rounded"
            >
              Apply
            </button>
            <button
              onClick={() => setSuggestion(null)}
              className="px-3 py-1 bg-[#21262d] hover:bg-[#30363d] text-[#c9d1d9] text-sm rounded"
            >
              Discard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default useGhostTextProvider;
