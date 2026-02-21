// Kyro IDE - Model Gateway
// Multi-provider AI model integration with Ollama support
// NOTE: This file is safe for both client and server-side usage
// The actual AI calls are handled via API routes

import { Model, ModelProvider, ModelConfig, ModelResponse, Message, Tool } from '@/types/ide';
import { EventEmitter } from 'events';

// ============================================================================
// MODEL DEFINITIONS
// ============================================================================

export const MODEL_DEFINITIONS: Omit<Model, 'status' | 'metrics'>[] = [
  // Ollama Local Models
  {
    id: 'llama3.2',
    name: 'Llama 3.2 (Local)',
    provider: 'ollama',
    type: 'chat',
    contextWindow: 128000,
    maxTokens: 4096,
    supportsVision: true,
    supportsTools: true,
    supportsStreaming: true,
    isLocal: true,
    isUncensored: false,
    size: 2,
    ram: 4
  },
  {
    id: 'codellama',
    name: 'Code Llama (Local)',
    provider: 'ollama',
    type: 'chat',
    contextWindow: 16384,
    maxTokens: 4096,
    supportsVision: false,
    supportsTools: true,
    supportsStreaming: true,
    isLocal: true,
    isUncensored: false,
    size: 7,
    ram: 8
  },
  {
    id: 'deepseek-coder',
    name: 'DeepSeek Coder (Local)',
    provider: 'ollama',
    type: 'chat',
    contextWindow: 16384,
    maxTokens: 4096,
    supportsVision: false,
    supportsTools: true,
    supportsStreaming: true,
    isLocal: true,
    isUncensored: false,
    size: 6.7,
    ram: 8
  },
  {
    id: 'mistral',
    name: 'Mistral (Local)',
    provider: 'ollama',
    type: 'chat',
    contextWindow: 32768,
    maxTokens: 4096,
    supportsVision: false,
    supportsTools: true,
    supportsStreaming: true,
    isLocal: true,
    isUncensored: false,
    size: 4.1,
    ram: 6
  },
  {
    id: 'dolphin-mixtral',
    name: 'Dolphin Mixtral (Uncensored)',
    provider: 'ollama',
    type: 'chat',
    contextWindow: 32768,
    maxTokens: 4096,
    supportsVision: false,
    supportsTools: true,
    supportsStreaming: true,
    isLocal: true,
    isUncensored: true,
    size: 26,
    ram: 32
  },
  {
    id: 'nous-hermes',
    name: 'Nous Hermes (Uncensored)',
    provider: 'ollama',
    type: 'chat',
    contextWindow: 4096,
    maxTokens: 2048,
    supportsVision: false,
    supportsTools: false,
    supportsStreaming: true,
    isLocal: true,
    isUncensored: true,
    size: 7,
    ram: 8
  },
  // Cloud Models (via z-ai-web-dev-sdk)
  {
    id: 'claude-3-opus',
    name: 'Claude 3 Opus',
    provider: 'anthropic',
    type: 'chat',
    contextWindow: 200000,
    maxTokens: 4096,
    supportsVision: true,
    supportsTools: true,
    supportsStreaming: true,
    isLocal: false,
    isUncensored: false
  },
  {
    id: 'claude-3-sonnet',
    name: 'Claude 3.5 Sonnet',
    provider: 'anthropic',
    type: 'chat',
    contextWindow: 200000,
    maxTokens: 8192,
    supportsVision: true,
    supportsTools: true,
    supportsStreaming: true,
    isLocal: false,
    isUncensored: false
  },
  {
    id: 'claude-3-haiku',
    name: 'Claude 3 Haiku',
    provider: 'anthropic',
    type: 'chat',
    contextWindow: 200000,
    maxTokens: 4096,
    supportsVision: true,
    supportsTools: true,
    supportsStreaming: true,
    isLocal: false,
    isUncensored: false
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    type: 'chat',
    contextWindow: 128000,
    maxTokens: 4096,
    supportsVision: true,
    supportsTools: true,
    supportsStreaming: true,
    isLocal: false,
    isUncensored: false
  },
  {
    id: 'gpt-4-turbo',
    name: 'GPT-4 Turbo',
    provider: 'openai',
    type: 'chat',
    contextWindow: 128000,
    maxTokens: 4096,
    supportsVision: true,
    supportsTools: true,
    supportsStreaming: true,
    isLocal: false,
    isUncensored: false
  },
  {
    id: 'gemini-pro',
    name: 'Gemini Pro',
    provider: 'google',
    type: 'chat',
    contextWindow: 32000,
    maxTokens: 2048,
    supportsVision: true,
    supportsTools: true,
    supportsStreaming: true,
    isLocal: false,
    isUncensored: false
  }
];

// ============================================================================
// MODEL GATEWAY (Client-safe version - AI calls go through API routes)
// ============================================================================

export class ModelGateway extends EventEmitter {
  private models: Map<string, Model> = new Map();
  private ollamaHost: string = 'http://localhost:11434';
  private isInitialized: boolean = false;

  constructor() {
    super();
    this.initializeModels();
  }

  private initializeModels(): void {
    MODEL_DEFINITIONS.forEach(def => {
      const model: Model = {
        ...def,
        status: def.isLocal ? 'available' : 'available',
        metrics: {
          requestsTotal: 0,
          tokensTotal: 0,
          avgLatency: 0,
          lastUsed: undefined
        }
      };
      this.models.set(model.id, model);
    });
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      this.isInitialized = true;
      this.emit('gateway:initialized');

      // Check Ollama availability
      await this.checkOllamaStatus();
    } catch (error) {
      console.error('Failed to initialize ModelGateway:', error);
      this.emit('gateway:error', error);
    }
  }

  private async checkOllamaStatus(): Promise<void> {
    try {
      const response = await fetch(`${this.ollamaHost}/api/tags`);
      if (response.ok) {
        const data = await response.json();
        // Update Ollama models based on available models
        if (data.models) {
          data.models.forEach((model: { name: string }) => {
            const existingModel = this.models.get(model.name);
            if (existingModel) {
              existingModel.status = 'available';
            }
          });
        }
        this.emit('ollama:connected');
      }
    } catch {
      // Ollama not available
      this.models.forEach(model => {
        if (model.provider === 'ollama') {
          model.status = 'unavailable';
        }
      });
      this.emit('ollama:disconnected');
    }
  }

  getModels(): Model[] {
    return Array.from(this.models.values());
  }

  getModelsByProvider(provider: ModelProvider): Model[] {
    return this.getModels().filter(m => m.provider === provider);
  }

  getLocalModels(): Model[] {
    return this.getModels().filter(m => m.isLocal);
  }

  getUncensoredModels(): Model[] {
    return this.getModels().filter(m => m.isUncensored);
  }

  getModel(id: string): Model | undefined {
    return this.models.get(id);
  }

  setOllamaHost(host: string): void {
    this.ollamaHost = host;
    this.checkOllamaStatus();
  }

  // Client-side chat - calls the API route
  async chat(
    modelId: string,
    messages: Message[],
    config: Partial<ModelConfig> = {},
    _tools?: Tool[],
    onStream?: (chunk: string) => void
  ): Promise<ModelResponse> {
    const model = this.models.get(modelId);
    if (!model) {
      throw new Error(`Model ${modelId} not found`);
    }

    const startTime = Date.now();
    this.emit('model:request', { modelId, messages: messages.length });

    try {
      // Call the API route
      const response = await fetch('/api/ide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'chat',
          model: modelId,
          messages: messages.map(m => ({
            role: m.role,
            content: typeof m.content === 'string' ? m.content : m.content.map(c => c.text).join('\n')
          })),
          stream: !!onStream,
          ...config
        })
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.statusText}`);
      }

      const data = await response.json();
      const latency = Date.now() - startTime;

      // Update metrics
      model.metrics!.requestsTotal++;
      model.metrics!.tokensTotal += data.usage?.totalTokens || 0;
      model.metrics!.avgLatency = 
        (model.metrics!.avgLatency * (model.metrics!.requestsTotal - 1) + latency) / 
        model.metrics!.requestsTotal;
      model.metrics!.lastUsed = new Date();

      this.emit('model:response', { modelId, latency, tokens: data.usage?.totalTokens || 0 });

      return {
        id: data.id || `chat-${Date.now()}`,
        requestId: `req-${Date.now()}`,
        model: modelId,
        content: data.content || '',
        usage: data.usage || { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        latency,
        finishReason: 'stop'
      };
    } catch (error) {
      this.emit('model:error', { modelId, error });
      throw error;
    }
  }

  async pullOllamaModel(modelName: string, onProgress?: (status: string) => void): Promise<void> {
    const response = await fetch(`${this.ollamaHost}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: modelName, stream: true })
    });

    if (!response.ok) {
      throw new Error(`Failed to pull model: ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(Boolean);

        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            if (onProgress && data.status) {
              onProgress(data.status);
            }
          } catch {
            // Skip invalid JSON
          }
        }
      }
    }

    // Refresh model list
    await this.checkOllamaStatus();
  }

  async getEmbedding(modelId: string, text: string): Promise<number[]> {
    const model = this.models.get(modelId);
    if (!model) {
      throw new Error(`Model ${modelId} not found`);
    }

    if (model.provider === 'ollama') {
      const response = await fetch(`${this.ollamaHost}/api/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: modelId, prompt: text })
      });

      if (!response.ok) {
        throw new Error(`Ollama embedding failed: ${response.statusText}`);
      }

      const data = await response.json();
      return data.embedding;
    }

    throw new Error('Embeddings only supported for Ollama models');
  }
}

let modelGatewayInstance: ModelGateway | null = null;

export function getModelGateway(): ModelGateway {
  if (!modelGatewayInstance) {
    modelGatewayInstance = new ModelGateway();
  }
  return modelGatewayInstance;
}
