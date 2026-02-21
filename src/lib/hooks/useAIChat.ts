/**
 * Kyro IDE - AI Chat Hook
 * React hook for AI chat functionality connected to the backend
 */

import { useState, useCallback, useRef } from 'react';
import { ChatMessage } from '@/components/chat/AIChatPanel';
import { aiService, AIModel } from '@/lib/pulse/ai/ai-service';

export interface UseAIChatOptions {
  initialMessages?: ChatMessage[];
  defaultModel?: string;
  systemPrompt?: string;
  onMessageReceived?: (message: ChatMessage) => void;
  onError?: (error: string) => void;
}

export interface UseAIChatReturn {
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  model: string;
  models: AIModel[];
  sendMessage: (content: string, context?: CodeContext) => Promise<void>;
  regenerate: (messageId: string) => Promise<void>;
  clearHistory: () => void;
  setModel: (model: string) => void;
  loadModels: () => Promise<void>;
}

export interface CodeContext {
  code: string;
  language: string;
  filename?: string;
}

export function useAIChat(options: UseAIChatOptions = {}): UseAIChatReturn {
  const {
    initialMessages = [],
    defaultModel = 'claude-3-sonnet',
    onMessageReceived,
    onError
  } = options;

  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [model, setModel] = useState(defaultModel);
  const [models, setModels] = useState<AIModel[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Load available models
  const loadModels = useCallback(async () => {
    try {
      const availableModels = await aiService.getModels();
      setModels(availableModels);
    } catch (err) {
      console.error('Failed to load models:', err);
    }
  }, []);

  // Send message
  const sendMessage = useCallback(async (content: string, context?: CodeContext) => {
    if (!content.trim() || isLoading) return;

    setError(null);
    setIsLoading(true);

    // Create user message
    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}-user`,
      role: 'user',
      content,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);

    // Create placeholder assistant message for streaming
    const assistantId = `msg-${Date.now()}-assistant`;
    const assistantMessage: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      model,
      isStreaming: true,
    };

    setMessages(prev => [...prev, assistantMessage]);

    try {
      abortControllerRef.current = new AbortController();

      // Build message history for context
      const conversationHistory = messages.slice(-10).map(m => ({
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content
      }));

      // Add current user message
      conversationHistory.push({ role: 'user', content });

      // Build code context if provided
      const codeContext = context ? [{ ...context }] : undefined;

      // Call AI service
      const response = await aiService.chatWithContext(
        content,
        codeContext,
        conversationHistory.slice(0, -1) // Exclude current message as it's sent separately
      );

      // Update assistant message with response
      setMessages(prev => prev.map(m => 
        m.id === assistantId
          ? {
              ...m,
              content: response.content,
              model: response.model,
              tokens: response.tokens?.total,
              isStreaming: false,
            }
          : m
      ));

      const finalMessage: ChatMessage = {
        id: assistantId,
        role: 'assistant',
        content: response.content,
        timestamp: new Date(),
        model: response.model,
        tokens: response.tokens?.total,
      };

      onMessageReceived?.(finalMessage);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      
      // Update assistant message with error
      setMessages(prev => prev.map(m => 
        m.id === assistantId
          ? {
              ...m,
              content: `Error: ${errorMessage}`,
              isStreaming: false,
            }
          : m
      ));

      onError?.(errorMessage);
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  }, [messages, model, isLoading, onMessageReceived, onError]);

  // Regenerate last response
  const regenerate = useCallback(async (messageId: string) => {
    const messageIndex = messages.findIndex(m => m.id === messageId);
    if (messageIndex < 0) return;

    // Find the user message that prompted this response
    const userMessageIndex = messageIndex - 1;
    if (userMessageIndex < 0 || messages[userMessageIndex].role !== 'user') return;

    const userContent = messages[userMessageIndex].content;

    // Remove the assistant message and regenerate
    setMessages(prev => prev.filter(m => m.id !== messageId));
    await sendMessage(userContent);
  }, [messages, sendMessage]);

  // Clear history
  const clearHistory = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  // Set model
  const handleSetModel = useCallback((newModel: string) => {
    setModel(newModel);
  }, []);

  return {
    messages,
    isLoading,
    error,
    model,
    models,
    sendMessage,
    regenerate,
    clearHistory,
    setModel: handleSetModel,
    loadModels,
  };
}

export default useAIChat;
