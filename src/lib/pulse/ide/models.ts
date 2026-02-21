// Kyro IDE - Model Gateway
// Multi-provider AI model integration with Ollama support

import { Model, ModelProvider, ModelConfig, ModelRequest, ModelResponse, Message, Tool, ToolCall } from '@/types/ide';
import { EventEmitter } from 'events';
import ZAI from 'z-ai-web-dev-sdk';

// ============================================================================
// MODEL DEFINITIONS
// ============================================================================

export const MODEL_DEFINITIONS: Omit<Model, 'status' | 'metrics'>[] = [
  // Ollama Local Models
  {
    id: 'ollama/llama3.2',
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
    id: 'ollama/codellama',
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
    id: 'ollama/deepseek-coder',
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
    id: 'ollama/mistral',
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
    id: 'ollama/dolphin-mixtral',
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
    id: 'ollama/nous-hermes',
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
// MODEL GATEWAY
// ============================================================================

export class ModelGateway extends EventEmitter {
  private models: Map<string, Model> = new Map();
  private zai: Awaited<ReturnType<typeof ZAI.create>> | null = null;
  private ollamaHost: string = 'http://localhost:11434';
  private requestQueue: Map<string, ModelRequest[]> = new Map();
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
      this.zai = await ZAI.create();
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
            const modelId = `ollama/${model.name}`;
            const existingModel = this.models.get(modelId);
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

  async chat(
    modelId: string,
    messages: Message[],
    config: Partial<ModelConfig> = {},
    tools?: Tool[],
    onStream?: (chunk: string) => void
  ): Promise<ModelResponse> {
    const model = this.models.get(modelId);
    if (!model) {
      throw new Error(`Model ${modelId} not found`);
    }

    if (model.status === 'unavailable') {
      throw new Error(`Model ${modelId} is unavailable`);
    }

    const startTime = Date.now();
    this.emit('model:request', { modelId, messages: messages.length });

    try {
      let response: ModelResponse;

      if (model.provider === 'ollama') {
        response = await this.callOllama(model, messages, config, onStream);
      } else {
        response = await this.callCloudModel(model, messages, config, tools, onStream);
      }

      // Update metrics
      const latency = Date.now() - startTime;
      model.metrics!.requestsTotal++;
      model.metrics!.tokensTotal += response.usage.totalTokens;
      model.metrics!.avgLatency = 
        (model.metrics!.avgLatency * (model.metrics!.requestsTotal - 1) + latency) / 
        model.metrics!.requestsTotal;
      model.metrics!.lastUsed = new Date();

      this.emit('model:response', { modelId, latency, tokens: response.usage.totalTokens });
      return response;
    } catch (error) {
      this.emit('model:error', { modelId, error });
      throw error;
    }
  }

  private async callOllama(
    model: Model,
    messages: Message[],
    config: Partial<ModelConfig>,
    onStream?: (chunk: string) => void
  ): Promise<ModelResponse> {
    const model_name = model.id.replace('ollama/', '');
    
    const body = {
      model: model_name,
      messages: messages.map(m => ({
        role: m.role,
        content: typeof m.content === 'string' ? m.content : m.content.map(c => c.text).join('\n')
      })),
      stream: !!onStream,
      options: {
        temperature: config.temperature ?? 0.7,
        top_p: config.topP ?? 0.9,
        top_k: config.topK ?? 40,
        num_predict: config.maxTokens ?? 2048,
        stop: config.stopSequences
      }
    };

    const response = await fetch(`${this.ollamaHost}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error(`Ollama request failed: ${response.statusText}`);
    }

    if (onStream) {
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';
      let promptTokens = 0;
      let completionTokens = 0;

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n').filter(Boolean);

          for (const line of lines) {
            try {
              const data = JSON.parse(line);
              if (data.message?.content) {
                fullContent += data.message.content;
                onStream(data.message.content);
              }
              if (data.prompt_eval_count) promptTokens = data.prompt_eval_count;
              if (data.eval_count) completionTokens = data.eval_count;
            } catch {
              // Skip invalid JSON
            }
          }
        }
      }

      return {
        id: `ollama-${Date.now()}`,
        requestId: `req-${Date.now()}`,
        model: model.id,
        content: fullContent,
        usage: {
          promptTokens,
          completionTokens,
          totalTokens: promptTokens + completionTokens
        },
        latency: 0,
        finishReason: 'stop'
      };
    } else {
      const data = await response.json();
      return {
        id: `ollama-${Date.now()}`,
        requestId: `req-${Date.now()}`,
        model: model.id,
        content: data.message?.content || '',
        usage: {
          promptTokens: data.prompt_eval_count || 0,
          completionTokens: data.eval_count || 0,
          totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0)
        },
        latency: 0,
        finishReason: 'stop'
      };
    }
  }

  private async callCloudModel(
    model: Model,
    messages: Message[],
    config: Partial<ModelConfig>,
    tools?: Tool[],
    onStream?: (chunk: string) => void
  ): Promise<ModelResponse> {
    if (!this.zai) {
      await this.initialize();
    }

    if (!this.zai) {
      throw new Error('Model gateway not initialized');
    }

    const formattedMessages = messages.map(m => ({
      role: m.role,
      content: typeof m.content === 'string' ? m.content : m.content.map(c => c.text).join('\n')
    }));

    const startTime = Date.now();

    try {
      const completion = await this.zai.chat.completions.create({
        messages: formattedMessages as Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
        temperature: config.temperature ?? 0.7,
        max_tokens: config.maxTokens ?? 2048,
        ...(config.systemPrompt && { 
          messages: [
            { role: 'system' as const, content: config.systemPrompt },
            ...formattedMessages
          ] as Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
        })
      });

      const content = completion.choices[0]?.message?.content || '';
      const latency = Date.now() - startTime;

      return {
        id: completion.id || `cloud-${Date.now()}`,
        requestId: `req-${Date.now()}`,
        model: model.id,
        content,
        usage: {
          promptTokens: completion.usage?.prompt_tokens || 0,
          completionTokens: completion.usage?.completion_tokens || 0,
          totalTokens: completion.usage?.total_tokens || 0
        },
        latency,
        finishReason: completion.choices[0]?.finish_reason === 'stop' ? 'stop' : 'length'
      };
    } catch (error) {
      console.error('Cloud model error:', error);
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
      const model_name = model.id.replace('ollama/', '');
      const response = await fetch(`${this.ollamaHost}/api/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: model_name, prompt: text })
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
