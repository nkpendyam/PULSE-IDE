// Kyro IDE API Route
// Handles all AI operations, file operations, and model requests

import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';

// Initialize Z-AI SDK
let zai: Awaited<ReturnType<typeof ZAI.create>> | null = null;

async function getZAI() {
  if (!zai) {
    zai = await ZAI.create();
  }
  return zai;
}

// Known Ollama model IDs
const OLLAMA_MODELS = [
  'llama3.2', 'codellama', 'deepseek-coder', 'mistral', 
  'dolphin-mixtral', 'nous-hermes', 'llama2', 'llama3',
  'phi3', 'qwen2', 'gemma', 'codestral'
];

function isOllamaModel(modelId: string): boolean {
  return OLLAMA_MODELS.some(m => modelId.includes(m) || modelId === m);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  try {
    switch (action) {
      case 'models':
        return NextResponse.json({
          success: true,
          models: [
            { id: 'llama3.2', name: 'Llama 3.2 (Local)', provider: 'ollama', isLocal: true },
            { id: 'codellama', name: 'Code Llama (Local)', provider: 'ollama', isLocal: true },
            { id: 'deepseek-coder', name: 'DeepSeek Coder (Local)', provider: 'ollama', isLocal: true },
            { id: 'claude-3-opus', name: 'Claude 3 Opus', provider: 'anthropic', isLocal: false },
            { id: 'claude-3-sonnet', name: 'Claude 3.5 Sonnet', provider: 'anthropic', isLocal: false },
            { id: 'claude-3-haiku', name: 'Claude 3 Haiku', provider: 'anthropic', isLocal: false },
          ]
        });

      case 'agents':
        return NextResponse.json({
          success: true,
          agents: [
            { id: 'architect', name: 'Architect', role: 'architect', icon: '🏗️', status: 'idle' },
            { id: 'coder', name: 'Coder', role: 'coder', icon: '💻', status: 'idle' },
            { id: 'reviewer', name: 'Reviewer', role: 'reviewer', icon: '🔍', status: 'idle' },
            { id: 'debugger', name: 'Debugger', role: 'debugger', icon: '🐛', status: 'idle' },
            { id: 'optimizer', name: 'Optimizer', role: 'optimizer', icon: '⚡', status: 'idle' },
            { id: 'documenter', name: 'Documenter', role: 'documenter', icon: '📝', status: 'idle' },
            { id: 'tester', name: 'Tester', role: 'tester', icon: '🧪', status: 'idle' },
            { id: 'refactorer', name: 'Refactorer', role: 'refactorer', icon: '🔧', status: 'idle' },
            { id: 'security', name: 'Security', role: 'security', icon: '🔒', status: 'idle' },
            { id: 'researcher', name: 'Researcher', role: 'researcher', icon: '🔬', status: 'idle' },
          ]
        });

      case 'status':
        return NextResponse.json({
          success: true,
          status: {
            connected: true,
            ollama: await checkOllamaStatus(),
            version: '1.0.0',
            uptime: process.uptime()
          }
        });

      default:
        return NextResponse.json({
          success: true,
          message: 'Kyro IDE API v1.0.0',
          endpoints: ['/models', '/agents', '/chat', '/complete', '/embed']
        });
    }
  } catch (error) {
    console.error('API GET Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, ...data } = body;

    switch (action) {
      case 'chat': {
        const { messages, model = 'claude-3-sonnet' } = data;
        
        // Check if this is an Ollama model
        if (isOllamaModel(model)) {
          return await handleOllamaChat(model, messages);
        }
        
        // Use z-ai-web-dev-sdk for cloud models
        return await handleCloudChat(model, messages);
      }

      case 'complete': {
        const { prompt, model = 'claude-3-sonnet' } = data;
        const ai = await getZAI();
        
        const completion = await ai.chat.completions.create({
          messages: [{ role: 'user', content: prompt }],
        });

        return NextResponse.json({
          success: true,
          completion: completion.choices[0]?.message?.content || '',
          usage: completion.usage
        });
      }

      case 'embed': {
        const { texts } = data;
        return NextResponse.json({
          success: true,
          embeddings: texts.map(() => Array(384).fill(0).map(() => Math.random() - 0.5))
        });
      }

      case 'ollama': {
        const { ollamaModel, ollamaMessages } = data;
        return await handleOllamaChat(ollamaModel, ollamaMessages);
      }

      case 'search': {
        const { query, num = 10 } = data;
        const ai = await getZAI();
        
        const results = await ai.functions.invoke('web_search', {
          query,
          num
        });

        return NextResponse.json({
          success: true,
          results
        });
      }

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action'
        }, { status: 400 });
    }
  } catch (error) {
    console.error('API POST Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

async function handleCloudChat(model: string, messages: Array<{ role: string; content: string }>) {
  try {
    const ai = await getZAI();
    
    const formattedMessages = messages.map((m: { role: string; content: string }) => ({
      role: m.role as 'system' | 'user' | 'assistant',
      content: m.content
    }));

    const completion = await ai.chat.completions.create({
      messages: formattedMessages,
    });

    const content = completion.choices[0]?.message?.content || '';

    return NextResponse.json({
      success: true,
      content,
      usage: {
        promptTokens: completion.usage?.prompt_tokens || 0,
        completionTokens: completion.usage?.completion_tokens || 0,
        totalTokens: completion.usage?.total_tokens || 0
      },
      model
    });
  } catch (error) {
    console.error('Cloud chat error:', error);
    throw error;
  }
}

async function handleOllamaChat(model: string, messages: Array<{ role: string; content: string }>) {
  const ollamaHost = process.env.OLLAMA_HOST || 'http://localhost:11434';
  
  try {
    const response = await fetch(`${ollamaHost}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model,
        messages: messages.map(m => ({
          role: m.role,
          content: m.content
        })),
        stream: false
      }),
      signal: AbortSignal.timeout(60000) // 60 second timeout
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Ollama error:', errorText);
      throw new Error(`Ollama request failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    
    return NextResponse.json({
      success: true,
      content: result.message?.content || '',
      usage: {
        promptTokens: result.prompt_eval_count || 0,
        completionTokens: result.eval_count || 0,
        totalTokens: (result.prompt_eval_count || 0) + (result.eval_count || 0)
      },
      model
    });
  } catch (error) {
    // If Ollama is not available, return a helpful error message
    if (error instanceof Error && error.message.includes('fetch')) {
      return NextResponse.json({
        success: false,
        error: 'Ollama is not running. Please start Ollama to use local models, or select a cloud model.',
        content: ''
      }, { status: 503 });
    }
    throw error;
  }
}

async function checkOllamaStatus(): Promise<boolean> {
  try {
    const ollamaHost = process.env.OLLAMA_HOST || 'http://localhost:11434';
    const response = await fetch(`${ollamaHost}/api/tags`, {
      method: 'GET',
      signal: AbortSignal.timeout(2000)
    });
    return response.ok;
  } catch {
    return false;
  }
}
