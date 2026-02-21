// Kyro IDE - Vector Database for RAG
// Efficient semantic search using LanceDB-style vector storage

import { EventEmitter } from 'events';

// ============================================================================
// TYPES
// ============================================================================

export interface VectorDocument {
  id: string;
  content: string;
  embedding: number[];
  metadata: {
    path: string;
    type: 'file' | 'chunk' | 'symbol' | 'doc' | 'memory';
    language?: string;
    lineStart?: number;
    lineEnd?: number;
    name?: string;
    timestamp: number;
    hash: string;
  };
}

export interface SearchResult {
  id: string;
  content: string;
  score: number;
  metadata: VectorDocument['metadata'];
}

export interface IndexStats {
  documentCount: number;
  totalTokens: number;
  lastIndexed: Date;
  indexSize: number; // in bytes
}

// ============================================================================
// VECTOR DATABASE
// ============================================================================

export class VectorDatabase extends EventEmitter {
  private documents: Map<string, VectorDocument> = new Map();
  private index: Map<string, number[]> = new Map(); // id -> embedding
  private embeddingDimension: number = 384; // Default for small models
  private isIndexed: boolean = false;

  constructor() {
    super();
  }

  // Add a document with embedding
  async addDocument(
    id: string,
    content: string,
    embedding: number[],
    metadata: VectorDocument['metadata']
  ): Promise<void> {
    const doc: VectorDocument = {
      id,
      content,
      embedding,
      metadata: {
        ...metadata,
        timestamp: Date.now()
      }
    };

    this.documents.set(id, doc);
    this.index.set(id, embedding);
    this.embeddingDimension = embedding.length;

    this.emit('document:added', { id, metadata });
  }

  // Add multiple documents
  async addDocuments(docs: Array<{
    id: string;
    content: string;
    embedding: number[];
    metadata: VectorDocument['metadata'];
  }>): Promise<void> {
    for (const doc of docs) {
      await this.addDocument(doc.id, doc.content, doc.embedding, doc.metadata);
    }
    this.emit('documents:batch-added', docs.length);
  }

  // Remove a document
  removeDocument(id: string): boolean {
    const existed = this.documents.delete(id);
    this.index.delete(id);
    
    if (existed) {
      this.emit('document:removed', id);
    }
    
    return existed;
  }

  // Remove documents by path
  removeDocumentsByPath(path: string): number {
    let removed = 0;
    
    for (const [id, doc] of this.documents) {
      if (doc.metadata.path === path || doc.metadata.path.startsWith(path + '/')) {
        this.documents.delete(id);
        this.index.delete(id);
        removed++;
      }
    }

    if (removed > 0) {
      this.emit('documents:path-removed', { path, count: removed });
    }

    return removed;
  }

  // Search by embedding
  async search(
    queryEmbedding: number[],
    options: {
      limit?: number;
      minScore?: number;
      filter?: (doc: VectorDocument) => boolean;
    } = {}
  ): Promise<SearchResult[]> {
    const { limit = 10, minScore = 0.5, filter } = options;

    const results: SearchResult[] = [];

    for (const [id, doc] of this.documents) {
      // Apply filter
      if (filter && !filter(doc)) continue;

      // Calculate similarity (cosine similarity)
      const score = this.cosineSimilarity(queryEmbedding, doc.embedding);

      if (score >= minScore) {
        results.push({
          id,
          content: doc.content,
          score,
          metadata: doc.metadata
        });
      }
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    return results.slice(0, limit);
  }

  // Hybrid search (embedding + keyword)
  async hybridSearch(
    queryEmbedding: number[],
    keywords: string[],
    options: {
      limit?: number;
      semanticWeight?: number;
      keywordWeight?: number;
    } = {}
  ): Promise<SearchResult[]> {
    const { limit = 10, semanticWeight = 0.7, keywordWeight = 0.3 } = options;

    const results: SearchResult[] = [];
    const keywordsLower = keywords.map(k => k.toLowerCase());

    for (const [id, doc] of this.documents) {
      // Semantic score
      const semanticScore = this.cosineSimilarity(queryEmbedding, doc.embedding);

      // Keyword score
      const contentLower = doc.content.toLowerCase();
      let keywordScore = 0;
      for (const keyword of keywordsLower) {
        if (contentLower.includes(keyword)) {
          keywordScore += 1;
        }
      }
      keywordScore = Math.min(keywordScore / keywords.length, 1);

      // Combined score
      const score = semanticWeight * semanticScore + keywordWeight * keywordScore;

      if (score > 0.3) {
        results.push({
          id,
          content: doc.content,
          score,
          metadata: doc.metadata
        });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }

  // Get document by ID
  getDocument(id: string): VectorDocument | undefined {
    return this.documents.get(id);
  }

  // Get all documents
  getAllDocuments(): VectorDocument[] {
    return Array.from(this.documents.values());
  }

  // Get documents by type
  getDocumentsByType(type: VectorDocument['metadata']['type']): VectorDocument[] {
    return this.getAllDocuments().filter(d => d.metadata.type === type);
  }

  // Get documents by path
  getDocumentsByPath(path: string): VectorDocument[] {
    return this.getAllDocuments().filter(d => 
      d.metadata.path === path || d.metadata.path.startsWith(path + '/')
    );
  }

  // Get statistics
  getStats(): IndexStats {
    let totalTokens = 0;
    for (const doc of this.documents.values()) {
      totalTokens += doc.content.length / 4; // Rough estimate
    }

    return {
      documentCount: this.documents.size,
      totalTokens,
      lastIndexed: new Date(),
      indexSize: this.documents.size * 1000 // Rough estimate
    };
  }

  // Clear all documents
  clear(): void {
    this.documents.clear();
    this.index.clear();
    this.emit('index:cleared');
  }

  // Export index
  exportIndex(): string {
    return JSON.stringify({
      documents: Array.from(this.documents.entries()),
      dimension: this.embeddingDimension
    });
  }

  // Import index
  importIndex(json: string): number {
    try {
      const data = JSON.parse(json);
      this.documents = new Map(data.documents);
      this.index = new Map(
        data.documents.map(([id, doc]: [string, VectorDocument]) => [id, doc.embedding])
      );
      this.embeddingDimension = data.dimension || 384;
      this.emit('index:imported', this.documents.size);
      return this.documents.size;
    } catch (error) {
      this.emit('error', error);
      return 0;
    }
  }

  // Cosine similarity
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    if (normA === 0 || normB === 0) return 0;

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  // Chunk text for embedding
  chunkText(
    text: string,
    options: {
      maxChunkSize?: number;
      overlap?: number;
      respectBoundaries?: boolean;
    } = {}
  ): Array<{ content: string; lineStart: number; lineEnd: number }> {
    const { maxChunkSize = 500, overlap = 50, respectBoundaries = true } = options;
    const lines = text.split('\n');
    const chunks: Array<{ content: string; lineStart: number; lineEnd: number }> = [];

    let currentChunk: string[] = [];
    let currentSize = 0;
    let chunkStartLine = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineSize = line.length;

      if (currentSize + lineSize > maxChunkSize && currentChunk.length > 0) {
        // Save current chunk
        chunks.push({
          content: currentChunk.join('\n'),
          lineStart: chunkStartLine + 1,
          lineEnd: i
        });

        // Start new chunk with overlap
        const overlapLines = Math.min(overlap, currentChunk.length);
        currentChunk = currentChunk.slice(-overlapLines);
        currentSize = currentChunk.join('\n').length;
        chunkStartLine = i - overlapLines;
      }

      currentChunk.push(line);
      currentSize += lineSize + 1; // +1 for newline
    }

    // Save last chunk
    if (currentChunk.length > 0) {
      chunks.push({
        content: currentChunk.join('\n'),
        lineStart: chunkStartLine + 1,
        lineEnd: lines.length
      });
    }

    return chunks;
  }

  // Generate document ID
  generateId(path: string, type: string, lineStart: number, lineEnd: number): string {
    return `${path}:${type}:${lineStart}-${lineEnd}`.replace(/[^a-zA-Z0-9:_-]/g, '_');
  }
}

// ============================================================================
// EMBEDDING SERVICE
// ============================================================================

export class EmbeddingService {
  private modelId: string = 'all-MiniLM-L6-v2';
  private cache: Map<string, number[]> = new Map();

  // Generate embedding for text
  async embed(text: string): Promise<number[]> {
    // Check cache
    const cacheKey = this.hashText(text);
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    // In real implementation, would call Ollama or local embedding model
    // For now, return a pseudo-embedding
    const embedding = this.pseudoEmbed(text);
    
    // Cache
    this.cache.set(cacheKey, embedding);
    
    return embedding;
  }

  // Generate embeddings for multiple texts
  async embedBatch(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map(t => this.embed(t)));
  }

  // Pseudo-embedding (placeholder)
  private pseudoEmbed(text: string): number[] {
    // This is a placeholder - real implementation would use a proper embedding model
    const dimension = 384;
    const embedding: number[] = new Array(dimension).fill(0);
    
    // Simple hash-based pseudo-embedding
    for (let i = 0; i < text.length; i++) {
      const charCode = text.charCodeAt(i);
      embedding[i % dimension] += Math.sin(charCode * (i + 1));
    }
    
    // Normalize
    const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return embedding.map(val => val / (norm || 1));
  }

  // Hash text for cache key
  private hashText(text: string): string {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }

  // Clear cache
  clearCache(): void {
    this.cache.clear();
  }
}

// Singleton instances
let vectorDbInstance: VectorDatabase | null = null;
let embeddingServiceInstance: EmbeddingService | null = null;

export function getVectorDatabase(): VectorDatabase {
  if (!vectorDbInstance) {
    vectorDbInstance = new VectorDatabase();
  }
  return vectorDbInstance;
}

export function getEmbeddingService(): EmbeddingService {
  if (!embeddingServiceInstance) {
    embeddingServiceInstance = new EmbeddingService();
  }
  return embeddingServiceInstance;
}
