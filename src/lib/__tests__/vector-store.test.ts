/**
 * Tests for Vector Store
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { VectorStore } from '../indexing/vector-store';

describe('VectorStore', () => {
  let vectorStore: VectorStore;

  beforeEach(() => {
    vectorStore = new VectorStore();
  });

  it('should add documents correctly', async () => {
    const embedding = new Array(1536).fill(0).map((_, i) => Math.sin(i));

    await vectorStore.addDocument({
      id: 'doc-1',
      content: 'function hello() { return "Hello World"; }',
      embedding,
      metadata: {
        path: '/test.ts',
        type: 'chunk',
        language: 'typescript',
        lineStart: 1,
        lineEnd: 1,
        timestamp: Date.now(),
        hash: 'abc123'
      }
    });

    const stats = vectorStore.getStats();
    expect(stats.totalDocuments).toBe(1);
  });

  it('should search for similar documents', async () => {
    const embedding1 = new Array(1536).fill(0).map((_, i) => Math.sin(i));
    const embedding2 = new Array(1536).fill(0).map((_, i) => Math.cos(i));

    await vectorStore.addDocument({
      id: 'doc-1',
      content: 'function add(a, b) { return a + b; }',
      embedding: embedding1,
      metadata: {
        path: '/math.ts',
        type: 'chunk',
        language: 'typescript',
        lineStart: 1,
        lineEnd: 1,
        timestamp: Date.now(),
        hash: 'hash1'
      }
    });

    await vectorStore.addDocument({
      id: 'doc-2',
      content: 'const PI = 3.14159;',
      embedding: embedding2,
      metadata: {
        path: '/constants.ts',
        type: 'chunk',
        language: 'typescript',
        lineStart: 1,
        lineEnd: 1,
        timestamp: Date.now(),
        hash: 'hash2'
      }
    });

    // Search with embedding similar to doc-1
    const results = await vectorStore.search(embedding1, { limit: 2 });

    expect(results.length).toBe(2);
    expect(results[0].id).toBe('doc-1'); // Most similar
  });

  it('should remove documents by path', async () => {
    const embedding = new Array(1536).fill(0.5);

    await vectorStore.addDocument({
      id: 'doc-1',
      content: 'test content',
      embedding,
      metadata: {
        path: '/remove-me.ts',
        type: 'chunk',
        language: 'typescript',
        lineStart: 1,
        lineEnd: 1,
        timestamp: Date.now(),
        hash: 'hash1'
      }
    });

    await vectorStore.removeDocumentsByPath('/remove-me.ts');

    const stats = vectorStore.getStats();
    expect(stats.totalDocuments).toBe(0);
  });

  it('should compute cosine similarity correctly', () => {
    const vecA = [1, 0, 0];
    const vecB = [1, 0, 0];
    const vecC = [0, 1, 0];
    const vecD = [-1, 0, 0];

    const simAB = vectorStore.cosineSimilarity(vecA, vecB);
    const simAC = vectorStore.cosineSimilarity(vecA, vecC);
    const simAD = vectorStore.cosineSimilarity(vecA, vecD);

    expect(simAB).toBeCloseTo(1, 5); // Identical vectors
    expect(simAC).toBeCloseTo(0, 5); // Orthogonal vectors
    expect(simAD).toBeCloseTo(-1, 5); // Opposite vectors
  });
});
