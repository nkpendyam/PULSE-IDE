import { NextRequest, NextResponse } from 'next/server';
import { createPicoCore, PicoCore } from '@/lib/pulse/pico';

// Singleton PicoCore instance
let picoCore: PicoCore | null = null;

function getPicoCore(): PicoCore {
  if (!picoCore) {
    picoCore = createPicoCore({
      model: 'llama3.2',
      maxTokens: 2048,
      temperature: 0.7,
      baseUrl: process.env.OLLAMA_HOST || 'http://localhost:11434',
    });
  }
  return picoCore;
}

/**
 * PicoClaw-style lightweight API
 * Ultra-fast AI responses with minimal overhead
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, conversationId, message, agentId } = body;

    const core = getPicoCore();

    switch (action) {
      case 'chat': {
        // Streaming chat response
        const { readable, writable } = new TransformStream();
        const writer = writable.getWriter();

        // Stream response in background
        (async () => {
          try {
            for await (const chunk of core.streamResponse(message, conversationId)) {
              await writer.write(new TextEncoder().encode(`data: ${JSON.stringify({ chunk })}\n\n`));
            }
            await writer.write(new TextEncoder().encode(`data: ${JSON.stringify({ done: true })}\n\n`));
          } catch (error) {
            await writer.write(new TextEncoder().encode(`data: ${JSON.stringify({ error: String(error) })}\n\n`));
          } finally {
            await writer.close();
          }
        })();

        return new Response(readable, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          },
        });
      }

      case 'agent': {
        // Execute agent
        const response = await core.executeAgent(agentId, message, conversationId);
        return NextResponse.json({ success: true, response });
      }

      case 'context': {
        // Get context info
        const context = core.createContext(conversationId);
        return NextResponse.json({
          success: true,
          context: {
            id: context.conversationId,
            messageCount: context.messages.length,
          },
        });
      }

      case 'memory': {
        // Get memory stats (PicoClaw-style monitoring)
        const stats = core.getMemoryStats();
        return NextResponse.json({
          success: true,
          memory: {
            used: Math.round(stats.used / 1024 / 1024), // MB
            contexts: stats.contexts,
            agents: stats.agents,
          },
        });
      }

      case 'clear': {
        // Clear all contexts
        core.clearAll();
        return NextResponse.json({ success: true, message: 'Cleared all contexts' });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Pico API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: String(error) },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint for health check and stats
 */
export async function GET() {
  const core = getPicoCore();
  const stats = core.getMemoryStats();

  return NextResponse.json({
    status: 'ok',
    version: '1.0.0',
    memory: {
      usedMB: Math.round(stats.used / 1024 / 1024),
      contexts: stats.contexts,
      agents: stats.agents,
    },
    timestamp: new Date().toISOString(),
  });
}
