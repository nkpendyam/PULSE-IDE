/**
 * Tests for AI Client
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fetch
global.fetch = vi.fn();

describe('AIClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should get default models when API fails', async () => {
    (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

    const { aiClient } = await import('../ai-client');
    const models = await aiClient.getModels();

    expect(models.length).toBeGreaterThan(0);
    expect(models.find(m => m.id === 'claude-3-sonnet')).toBeDefined();
  });

  it('should call chat API with correct parameters', async () => {
    const mockResponse = {
      content: 'Hello, how can I help?',
      tokens: { prompt: 10, completion: 20, total: 30 }
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    });

    const { aiClient } = await import('../ai-client');
    const response = await aiClient.chat([
      { role: 'user', content: 'Hello' }
    ]);

    expect(response.content).toBe('Hello, how can I help?');
    expect(global.fetch).toHaveBeenCalledWith('/api/ide', expect.objectContaining({
      method: 'POST',
      body: expect.stringContaining('chat')
    }));
  });

  it('should handle API errors gracefully', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error'
    });

    const { aiClient } = await import('../ai-client');

    await expect(aiClient.chat([{ role: 'user', content: 'test' }]))
      .rejects.toThrow('AI request failed');
  });
});
