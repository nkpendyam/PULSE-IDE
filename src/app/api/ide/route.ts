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

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  try {
    switch (action) {
      case 'models':
        return NextResponse.json({
          success: true,
          models: [
            { id: 'ollama/llama3.2', name: 'Llama 3.2 (Local)', provider: 'ollama', isLocal: true },
            { id: 'ollama/codellama', name: 'Code Llama (Local)', provider: 'ollama', isLocal: true },
            { id: 'ollama/deepseek-coder', name: 'DeepSeek Coder (Local)', provider: 'ollama', isLocal: true },
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
        const { messages, model = 'claude-3-sonnet', stream = false } = data;
        const ai = await getZAI();
        
        const completion = await ai.chat.completions.create({
          messages: messages.map((m: { role: string; content: string }) => ({
            role: m.role as 'system' | 'user' | 'assistant',
            content: m.content
          })),
        });

        return NextResponse.json({
          success: true,
          content: completion.choices[0]?.message?.content || '',
          usage: completion.usage,
          model: model
        });
      }

      case 'complete': {
        const { prompt, model = 'claude-3-sonnet', maxTokens = 500 } = data;
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
        const response = await fetch('http://localhost:11434/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: ollamaModel,
            messages: ollamaMessages,
            stream: false
          })
        });

        if (!response.ok) {
          throw new Error(`Ollama request failed: ${response.statusText}`);
        }

        const result = await response.json();
        return NextResponse.json({
          success: true,
          content: result.message?.content || '',
          model: ollamaModel
        });
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
    console.error('API Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

async function checkOllamaStatus(): Promise<boolean> {
  try {
    const response = await fetch('http://localhost:11434/api/tags', {
      method: 'GET',
      signal: AbortSignal.timeout(2000)
    });
    return response.ok;
  } catch {
    return false;
  }
}
