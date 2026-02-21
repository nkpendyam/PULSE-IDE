/**
 * Kyro IDE - Real AI Service
 * Connects the IDE to actual AI backends via z-ai-web-dev-sdk
 */

import ZAI from 'z-ai-web-dev-sdk';

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
// AI SERVICE CLASS
// ============================================================================

class AIService {
  private zai: Awaited<ReturnType<typeof ZAI.create>> | null = null;
  private initPromise: Promise<void> | null = null;
  private ollamaHost: string;
  
  constructor() {
    this.ollamaHost = process.env.OLLAMA_HOST || 'http://localhost:11434';
  }

  async initialize(): Promise<void> {
    if (this.zai) return;
    if (this.initPromise) return this.initPromise;
    
    this.initPromise = (async () => {
      this.zai = await ZAI.create();
    })();
    
    return this.initPromise;
  }

  // Get available models
  async getModels(): Promise<AIModel[]> {
    const models: AIModel[] = [
      // Cloud models (via z-ai-web-dev-sdk)
      { id: 'claude-3-opus', name: 'Claude 3 Opus', provider: 'anthropic', isLocal: false, contextLength: 200000 },
      { id: 'claude-3-sonnet', name: 'Claude 3.5 Sonnet', provider: 'anthropic', isLocal: false, contextLength: 200000 },
      { id: 'claude-3-haiku', name: 'Claude 3 Haiku', provider: 'anthropic', isLocal: false, contextLength: 200000 },
    ];

    // Try to get local Ollama models
    try {
      const response = await fetch(`${this.ollamaHost}/api/tags`, {
        signal: AbortSignal.timeout(2000)
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.models && Array.isArray(data.models)) {
          for (const model of data.models) {
            models.push({
              id: model.name,
              name: model.name,
              provider: 'ollama',
              isLocal: true,
              contextLength: 4096
            });
          }
        }
      }
    } catch {
      // Ollama not available
    }

    return models;
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
    
    // Check if this is an Ollama model
    if (await this.isOllamaModel(model)) {
      return this.ollamaChat(messages, model, options);
    }

    // Use z-ai-web-dev-sdk for cloud models
    await this.initialize();
    
    const formattedMessages = options?.systemPrompt
      ? [{ role: 'system' as const, content: options.systemPrompt }, ...messages]
      : messages;

    const completion = await this.zai!.chat.completions.create({
      messages: formattedMessages.map(m => ({
        role: m.role,
        content: m.content
      })),
      temperature: options?.temperature,
      max_tokens: options?.maxTokens,
    });

    const latency = Date.now() - startTime;
    const content = completion.choices[0]?.message?.content || '';

    return {
      content,
      tokens: {
        prompt: completion.usage?.prompt_tokens || 0,
        completion: completion.usage?.completion_tokens || 0,
        total: completion.usage?.total_tokens || 0
      },
      model,
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
    // Real streaming would require SSE support from the SDK
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
    const prompt = `You are an intelligent code completion AI. Complete the following ${language} code. Only return the completion, no explanations.

${context ? `Context:\n${context}\n\n` : ''}Code to complete:
\`\`\`${language}
${code.slice(0, cursorPosition)}[CURSOR]${code.slice(cursorPosition)}
\`\`\`

Complete the code at [CURSOR]. Return only the completion text, nothing else.`;

    await this.initialize();
    
    const completion = await this.zai!.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 100,
      temperature: 0.2,
    });

    return completion.choices[0]?.message?.content || '';
  }

  // Explain code
  async explainCode(code: string, language: string = 'typescript'): Promise<string> {
    const messages: AIMessage[] = [
      {
        role: 'system',
        content: 'You are an expert programmer. Explain code clearly and concisely, focusing on what it does, how it works, and any important patterns or considerations.'
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
        content: 'You are an expert debugger. Fix the code and explain what was wrong. Return the fixed code in a code block.'
      },
      {
        role: 'user',
        content: `Fix this ${language} code:${errorMessage ? `\n\nError: ${errorMessage}` : ''}\n\n\`\`\`${language}\n${code}\n\`\`\`\n\nReturn the corrected code.`
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
        content: 'You are an expert test engineer. Generate comprehensive unit tests with edge cases.'
      },
      {
        role: 'user',
        content: `Generate unit tests for this ${language} code:\n\n\`\`\`${language}\n${code}\n\`\`\`\n\nInclude tests for edge cases and error handling.`
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
        content: 'You are an expert software engineer. Refactor code while preserving functionality. Return the refactored code in a code block.'
      },
      {
        role: 'user',
        content: `Refactor this ${language} code:\n\n\`\`\`${language}\n${code}\n\`\`\`\n\nInstructions: ${instructions}\n\nReturn the refactored code.`
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

  // Private: Ollama chat
  private async ollamaChat(
    messages: AIMessage[],
    model: string,
    options?: { temperature?: number; maxTokens?: number; systemPrompt?: string }
  ): Promise<AIResponse> {
    const startTime = Date.now();

    const formattedMessages = options?.systemPrompt
      ? [{ role: 'system' as const, content: options.systemPrompt }, ...messages]
      : messages;

    const response = await fetch(`${this.ollamaHost}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: formattedMessages,
        stream: false,
        options: {
          temperature: options?.temperature,
          num_predict: options?.maxTokens
        }
      }),
      signal: AbortSignal.timeout(120000)
    });

    if (!response.ok) {
      throw new Error(`Ollama request failed: ${response.status}`);
    }

    const result = await response.json();
    const latency = Date.now() - startTime;

    return {
      content: result.message?.content || '',
      tokens: {
        prompt: result.prompt_eval_count || 0,
        completion: result.eval_count || 0,
        total: (result.prompt_eval_count || 0) + (result.eval_count || 0)
      },
      model,
      latency
    };
  }

  // Private: Check if model is Ollama
  private async isOllamaModel(model: string): Promise<boolean> {
    const ollamaKeywords = ['llama', 'codellama', 'deepseek', 'mistral', 'phi', 'qwen', 'gemma', 'dolphin', 'nous', 'codestral'];
    return ollamaKeywords.some(k => model.toLowerCase().includes(k));
  }

  // Check Ollama status
  async checkOllamaStatus(): Promise<{ running: boolean; models: string[] }> {
    try {
      const response = await fetch(`${this.ollamaHost}/api/tags`, {
        signal: AbortSignal.timeout(2000)
      });
      
      if (response.ok) {
        const data = await response.json();
        return {
          running: true,
          models: (data.models || []).map((m: { name: string }) => m.name)
        };
      }
    } catch {
      // Ollama not available
    }
    
    return { running: false, models: [] };
  }
}

// Export singleton
export const aiService = new AIService();

// Export convenience functions
export const chat = aiService.chat.bind(aiService);
export const chatWithContext = aiService.chatWithContext.bind(aiService);
export const explainCode = aiService.explainCode.bind(aiService);
export const fixCode = aiService.fixCode.bind(aiService);
export const generateTests = aiService.generateTests.bind(aiService);
export const refactorCode = aiService.refactorCode.bind(aiService);
export const completeCode = aiService.completeCode.bind(aiService);
