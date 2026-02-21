/**
 * PicoClaw-Inspired Lightweight AI Agent Core
 *
 * This module provides an ultra-lightweight AI agent implementation
 * inspired by PicoClaw's efficient architecture.
 *
 * Features:
 * - Minimal memory footprint
 * - Fast startup time
 * - Multi-platform messaging support
 * - Streaming responses
 * - Context management
 */

// Types
export interface PicoMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

export interface PicoContext {
  conversationId: string;
  messages: PicoMessage[];
  metadata: Record<string, unknown>;
}

export interface PicoConfig {
  model: string;
  maxTokens: number;
  temperature: number;
  systemPrompt?: string;
  baseUrl?: string;
}

export interface PicoAgent {
  id: string;
  name: string;
  description: string;
  execute: (input: string, context: PicoContext) => Promise<string>;
}

// Default configuration
const DEFAULT_CONFIG: PicoConfig = {
  model: 'llama3.2',
  maxTokens: 2048,
  temperature: 0.7,
  baseUrl: 'http://localhost:11434',
};

/**
 * PicoCore - Ultra-lightweight AI agent runtime
 * Inspired by PicoClaw's minimal architecture
 */
export class PicoCore {
  private config: PicoConfig;
  private contexts: Map<string, PicoContext> = new Map();
  private agents: Map<string, PicoAgent> = new Map();
  private memoryUsage: number = 0;

  constructor(config: Partial<PicoConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.memoryUsage = process.memoryUsage?.()?.heapUsed || 0;
  }

  /**
   * Create or get conversation context
   * Lightweight context management with automatic cleanup
   */
  createContext(conversationId: string): PicoContext {
    let context = this.contexts.get(conversationId);

    if (!context) {
      context = {
        conversationId,
        messages: [],
        metadata: {},
      };
      this.contexts.set(conversationId, context);

      // Cleanup old contexts if memory is high
      if (this.contexts.size > 100) {
        this.cleanupContexts();
      }
    }

    return context;
  }

  /**
   * Add message to context with automatic memory management
   */
  addMessage(conversationId: string, message: PicoMessage): void {
    const context = this.contexts.get(conversationId);
    if (context) {
      context.messages.push(message);

      // Keep only last 50 messages to minimize memory
      if (context.messages.length > 50) {
        context.messages = context.messages.slice(-50);
      }
    }
  }

  /**
   * Register a lightweight agent
   */
  registerAgent(agent: PicoAgent): void {
    this.agents.set(agent.id, agent);
  }

  /**
   * Execute agent with minimal overhead
   */
  async executeAgent(agentId: string, input: string, conversationId: string): Promise<string> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    const context = this.createContext(conversationId);

    // Add user message
    this.addMessage(conversationId, {
      role: 'user',
      content: input,
      timestamp: Date.now(),
    });

    // Execute agent
    const response = await agent.execute(input, context);

    // Add assistant message
    this.addMessage(conversationId, {
      role: 'assistant',
      content: response,
      timestamp: Date.now(),
    });

    return response;
  }

  /**
   * Stream response from Ollama (lightweight implementation)
   */
  async *streamResponse(
    prompt: string,
    conversationId: string
  ): AsyncGenerator<string, void, unknown> {
    const context = this.createContext(conversationId);

    // Build messages for context
    const messages = [
      ...(this.config.systemPrompt ? [{ role: 'system' as const, content: this.config.systemPrompt }] : []),
      ...context.messages,
      { role: 'user' as const, content: prompt },
    ];

    try {
      const response = await fetch(`${this.config.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.config.model,
          messages,
          stream: true,
          options: {
            temperature: this.config.temperature,
            num_predict: this.config.maxTokens,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama request failed: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let fullResponse = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(Boolean);

        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            if (data.message?.content) {
              fullResponse += data.message.content;
              yield data.message.content;
            }
          } catch {
            // Skip invalid JSON
          }
        }
      }

      // Store in context
      this.addMessage(conversationId, {
        role: 'user',
        content: prompt,
        timestamp: Date.now(),
      });
      this.addMessage(conversationId, {
        role: 'assistant',
        content: fullResponse,
        timestamp: Date.now(),
      });

    } catch (error) {
      console.error('PicoCore stream error:', error);
      throw error;
    }
  }

  /**
   * Get memory usage statistics
   */
  getMemoryStats(): { used: number; contexts: number; agents: number } {
    return {
      used: process.memoryUsage?.()?.heapUsed || 0,
      contexts: this.contexts.size,
      agents: this.agents.size,
    };
  }

  /**
   * Cleanup old contexts to free memory
   */
  private cleanupContexts(): void {
    // Remove oldest contexts
    const entries = Array.from(this.contexts.entries());
    const toRemove = entries.slice(0, 20);

    for (const [id] of toRemove) {
      this.contexts.delete(id);
    }
  }

  /**
   * Clear all contexts (memory cleanup)
   */
  clearAll(): void {
    this.contexts.clear();
  }
}

/**
 * Built-in lightweight agents inspired by PicoClaw
 */
export const PICO_AGENTS: PicoAgent[] = [
  {
    id: 'coder',
    name: 'Coder',
    description: 'Fast code generation agent',
    execute: async (input: string, context: PicoContext) => {
      // This would connect to the actual AI model
      return `[Coder Agent] Processing: ${input}`;
    },
  },
  {
    id: 'explainer',
    name: 'Explainer',
    description: 'Quick code explanation agent',
    execute: async (input: string, context: PicoContext) => {
      return `[Explainer Agent] Analyzing: ${input}`;
    },
  },
  {
    id: 'fixer',
    name: 'Fixer',
    description: 'Bug fixing agent',
    execute: async (input: string, context: PicoContext) => {
      return `[Fixer Agent] Fixing: ${input}`;
    },
  },
];

/**
 * Platform adapters for multi-platform messaging
 * Inspired by PicoClaw's integration capabilities
 */
export interface PlatformAdapter {
  name: string;
  send: (message: string, recipient: string) => Promise<void>;
  receive: (handler: (message: string, sender: string) => Promise<string>) => void;
}

/**
 * Telegram adapter
 */
export class TelegramAdapter implements PlatformAdapter {
  name = 'telegram';
  private token: string;

  constructor(token: string) {
    this.token = token;
  }

  async send(message: string, chatId: string): Promise<void> {
    await fetch(`https://api.telegram.org/bot${this.token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'Markdown',
      }),
    });
  }

  receive(handler: (message: string, sender: string) => Promise<string>): void {
    // Webhook setup would go here
    console.log('Telegram receiver initialized');
  }
}

/**
 * Discord adapter
 */
export class DiscordAdapter implements PlatformAdapter {
  name = 'discord';
  private webhookUrl: string;

  constructor(webhookUrl: string) {
    this.webhookUrl = webhookUrl;
  }

  async send(message: string, _channelId: string): Promise<void> {
    await fetch(this.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: message }),
    });
  }

  receive(handler: (message: string, sender: string) => Promise<string>): void {
    // Bot setup would go here
    console.log('Discord receiver initialized');
  }
}

/**
 * Create a lightweight PicoCore instance
 */
export function createPicoCore(config: Partial<PicoConfig> = {}): PicoCore {
  const core = new PicoCore(config);

  // Register built-in agents
  for (const agent of PICO_AGENTS) {
    core.registerAgent(agent);
  }

  return core;
}

export default PicoCore;
