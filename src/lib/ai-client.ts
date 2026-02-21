/**
 * Kyro IDE - Client-side AI API wrapper
 * This module provides a client-safe interface to the AI services
 * by calling server-side API routes instead of using the SDK directly
 */

// ============================================================================
// TYPES
// ============================================================================

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIResponse {
  content: string;
  tokens?: {
    prompt: number;
    completion: number;
    total: number;
  };
  model: string;
  latency: number;
}

export interface AIModel {
  id: string;
  name: string;
  provider: string;
  isLocal: boolean;
  contextLength?: number;
}

export interface AIStreamChunk {
  content: string;
  done: boolean;
}

// ============================================================================
// CLIENT AI SERVICE
// ============================================================================

class ClientAIService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = typeof window !== 'undefined' ? '' : '';
  }

  // Get available models
  async getModels(): Promise<AIModel[]> {
    try {
      const response = await fetch('/api/ide?action=models');
      if (!response.ok) throw new Error('Failed to fetch models');
      const data = await response.json();
      return data.models || this.getDefaultModels();
    } catch {
      return this.getDefaultModels();
    }
  }

  private getDefaultModels(): AIModel[] {
    return [
      { id: 'claude-3-opus', name: 'Claude 3 Opus', provider: 'anthropic', isLocal: false, contextLength: 200000 },
      { id: 'claude-3-sonnet', name: 'Claude 3.5 Sonnet', provider: 'anthropic', isLocal: false, contextLength: 200000 },
      { id: 'claude-3-haiku', name: 'Claude 3 Haiku', provider: 'anthropic', isLocal: false, contextLength: 200000 },
    ];
  }

  // Main chat completion
  async chat(
    messages: AIMessage[],
    model: string = 'claude-3-sonnet',
    options?: {
      temperature?: number;
      maxTokens?: number;
      systemPrompt?: string;
    }
  ): Promise<AIResponse> {
    const startTime = Date.now();

    const response = await fetch('/api/ide', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'chat',
        messages,
        model,
        options
      })
    });

    if (!response.ok) {
      throw new Error(`AI request failed: ${response.status}`);
    }

    const data = await response.json();
    const latency = Date.now() - startTime;

    return {
      content: data.content || data.response || '',
      tokens: data.tokens,
      model: data.model || model,
      latency
    };
  }

  // Streaming chat completion
  async *chatStream(
    messages: AIMessage[],
    model: string = 'claude-3-sonnet',
    options?: {
      temperature?: number;
      maxTokens?: number;
      systemPrompt?: string;
    }
  ): AsyncGenerator<AIStreamChunk> {
    // For now, we'll do non-streaming and yield the whole response
    // Real streaming would require SSE support
    const response = await this.chat(messages, model, options);
    yield { content: response.content, done: true };
  }

  // Code completion (for inline suggestions)
  async completeCode(
    code: string,
    cursorPosition: number,
    language: string = 'typescript',
    context?: string
  ): Promise<string> {
    const response = await fetch('/api/ide', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'complete',
        code,
        cursorPosition,
        language,
        context
      })
    });

    if (!response.ok) {
      return '';
    }

    const data = await response.json();
    return data.completion || '';
  }

  // Explain code
  async explainCode(code: string, language: string = 'typescript'): Promise<string> {
    const messages: AIMessage[] = [
      {
        role: 'system',
        content: 'You are an expert programmer. Explain code clearly and concisely.'
      },
      {
        role: 'user',
        content: `Explain this ${language} code:\n\n\`\`\`${language}\n${code}\n\`\`\``
      }
    ];

    const response = await this.chat(messages);
    return response.content;
  }

  // Fix code
  async fixCode(code: string, errorMessage?: string, language: string = 'typescript'): Promise<string> {
    const messages: AIMessage[] = [
      {
        role: 'system',
        content: 'You are an expert debugger. Fix the code and explain what was wrong.'
      },
      {
        role: 'user',
        content: `Fix this ${language} code:${errorMessage ? `\n\nError: ${errorMessage}` : ''}\n\n\`\`\`${language}\n${code}\n\`\`\``
      }
    ];

    const response = await this.chat(messages);
    return response.content;
  }

  // Generate tests
  async generateTests(code: string, language: string = 'typescript'): Promise<string> {
    const messages: AIMessage[] = [
      {
        role: 'system',
        content: 'You are an expert test engineer. Generate comprehensive unit tests.'
      },
      {
        role: 'user',
        content: `Generate unit tests for this ${language} code:\n\n\`\`\`${language}\n${code}\n\`\`\``
      }
    ];

    const response = await this.chat(messages);
    return response.content;
  }

  // Refactor code
  async refactorCode(code: string, instructions: string, language: string = 'typescript'): Promise<string> {
    const messages: AIMessage[] = [
      {
        role: 'system',
        content: 'You are an expert software engineer. Refactor code while preserving functionality.'
      },
      {
        role: 'user',
        content: `Refactor this ${language} code:\n\n\`\`\`${language}\n${code}\n\`\`\`\n\nInstructions: ${instructions}`
      }
    ];

    const response = await this.chat(messages);
    return response.content;
  }

  // Chat with code context
  async chatWithContext(
    userMessage: string,
    codeContext?: { code: string; language: string; filename?: string }[],
    conversationHistory?: AIMessage[]
  ): Promise<AIResponse> {
    const systemPrompt = `You are Kyro IDE's AI assistant, an expert programmer helping developers write better code. You can:
- Explain code and concepts
- Write and modify code
- Debug issues
- Suggest improvements
- Answer programming questions

Be concise but thorough. Use code blocks for code examples.`;

    const messages: AIMessage[] = conversationHistory || [];

    // Add code context if provided
    let contextMessage = userMessage;
    if (codeContext && codeContext.length > 0) {
      contextMessage = `${userMessage}\n\nReferenced code:\n${codeContext.map(c => 
        `\`\`\`${c.language}${c.filename ? ` ${c.filename}` : ''}\n${c.code}\n\`\`\``
      ).join('\n')}`;
    }

    messages.push({ role: 'user', content: contextMessage });

    return this.chat(messages, 'claude-3-sonnet', { systemPrompt });
  }

  // Check Ollama status
  async checkOllamaStatus(): Promise<{ running: boolean; models: string[] }> {
    try {
      const response = await fetch('/api/ide?action=ollama-status');
      if (!response.ok) return { running: false, models: [] };
      return await response.json();
    } catch {
      return { running: false, models: [] };
    }
  }
}

// Export singleton
export const aiClient = new ClientAIService();

// Export convenience functions
export const chat = aiClient.chat.bind(aiClient);
export const chatWithContext = aiClient.chatWithContext.bind(aiClient);
export const explainCode = aiClient.explainCode.bind(aiClient);
export const fixCode = aiClient.fixCode.bind(aiClient);
export const generateTests = aiClient.generateTests.bind(aiClient);
export const refactorCode = aiClient.refactorCode.bind(aiClient);
export const completeCode = aiClient.completeCode.bind(aiClient);
