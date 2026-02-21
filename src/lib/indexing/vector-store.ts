/**
 * Kyro IDE - Vector Store with IndexedDB Persistence
 * Lightweight vector database for semantic code search
 */

import { EventEmitter } from 'events';

// ============================================================================
// TYPES
// ============================================================================

export interface VectorDocument {
  id: string;
  content: string;
  embedding: number[];
  metadata: VectorMetadata;
}

export interface VectorMetadata {
  path: string;
  type: 'file' | 'chunk' | 'symbol' | 'function' | 'class' | 'interface' | 'variable';
  language?: string;
  lineStart: number;
  lineEnd: number;
  name?: string;
  timestamp: number;
  hash: string;
  symbolType?: string;
  parentSymbol?: string;
  signatures?: string[];
}

export interface VectorSearchResult {
  id: string;
  content: string;
  score: number;
  metadata: VectorMetadata;
  highlights?: { start: number; end: number; text: string }[];
}

export interface VectorStoreStats {
  documentCount: number;
  totalTokens: number;
  lastIndexed: Date;
  indexSize: number;
  dimension: number;
}

export interface VectorStoreConfig {
  dbName: string;
  storeName: string;
  embeddingDimension: number;
  similarityThreshold: number;
}

const DEFAULT_CONFIG: VectorStoreConfig = {
  dbName: 'kyro-ide-vectors',
  storeName: 'embeddings',
  embeddingDimension: 1536, // OpenAI embedding dimension
  similarityThreshold: 0.7,
};

// ============================================================================
// INDEXEDDB VECTOR STORE
// ============================================================================

export class VectorStore extends EventEmitter {
  private db: IDBDatabase | null = null;
  private memoryIndex: Map<string, VectorDocument> = new Map();
  private embeddingDimension: number;
  private isInitialized: boolean = false;
  private initPromise: Promise<void> | null = null;

  constructor(private config: VectorStoreConfig = DEFAULT_CONFIG) {
    super();
    this.embeddingDimension = config.embeddingDimension;
  }

  // Initialize IndexedDB
  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this.initDB();
    return this.initPromise;
  }

  private async initDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.config.dbName, 1);

      request.onerror = () => {
        console.error('Failed to open IndexedDB:', request.error);
        // Fall back to memory-only mode
        this.isInitialized = true;
        resolve();
      };

      request.onsuccess = () => {
        this.db = request.result;
        this.isInitialized = true;
        this.emit('initialized');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create object store for vectors
        if (!db.objectStoreNames.contains(this.config.storeName)) {
          const store = db.createObjectStore(this.config.storeName, { keyPath: 'id' });
          store.createIndex('path', 'metadata.path', { unique: false });
          store.createIndex('type', 'metadata.type', { unique: false });
          store.createIndex('name', 'metadata.name', { unique: false });
          store.createIndex('hash', 'metadata.hash', { unique: false });
          store.createIndex('timestamp', 'metadata.timestamp', { unique: false });
        }
      };
    });
  }

  // Add a single document
  async addDocument(doc: VectorDocument): Promise<void> {
    await this.initialize();

    // Validate embedding dimension
    if (doc.embedding.length !== this.embeddingDimension) {
      this.embeddingDimension = doc.embedding.length;
    }

    // Store in memory
    this.memoryIndex.set(doc.id, doc);

    // Persist to IndexedDB
    if (this.db) {
      await this.persistDocument(doc);
    }

    this.emit('document:added', { id: doc.id, type: doc.metadata.type });
  }

  // Add multiple documents
  async addDocuments(docs: VectorDocument[]): Promise<void> {
    await this.initialize();

    for (const doc of docs) {
      this.memoryIndex.set(doc.id, doc);
    }

    // Batch persist to IndexedDB
    if (this.db) {
      await this.persistDocuments(docs);
    }

    this.emit('documents:batch-added', { count: docs.length });
  }

  // Get document by ID
  async getDocument(id: string): Promise<VectorDocument | undefined> {
    await this.initialize();

    // Check memory first
    if (this.memoryIndex.has(id)) {
      return this.memoryIndex.get(id);
    }

    // Load from IndexedDB
    if (this.db) {
      return this.loadDocument(id);
    }

    return undefined;
  }

  // Remove document by ID
  async removeDocument(id: string): Promise<boolean> {
    await this.initialize();

    const existed = this.memoryIndex.delete(id);

    if (this.db) {
      await this.deleteDocument(id);
    }

    if (existed) {
      this.emit('document:removed', { id });
    }

    return existed;
  }

  // Remove all documents for a path
  async removeDocumentsByPath(path: string): Promise<number> {
    await this.initialize();

    let removed = 0;
    const toRemove: string[] = [];

    for (const [id, doc] of this.memoryIndex) {
      if (doc.metadata.path === path || doc.metadata.path.startsWith(path + '/')) {
        toRemove.push(id);
        removed++;
      }
    }

    // Remove from memory
    for (const id of toRemove) {
      this.memoryIndex.delete(id);
    }

    // Remove from IndexedDB
    if (this.db) {
      await this.deleteDocumentsByPath(path);
    }

    if (removed > 0) {
      this.emit('documents:path-removed', { path, count: removed });
    }

    return removed;
  }

  // Search by embedding vector
  async search(
    queryEmbedding: number[],
    options: {
      limit?: number;
      minScore?: number;
      filter?: (doc: VectorDocument) => boolean;
      includeHighlights?: boolean;
    } = {}
  ): Promise<VectorSearchResult[]> {
    await this.initialize();

    const {
      limit = 10,
      minScore = this.config.similarityThreshold,
      filter,
      includeHighlights = false,
    } = options;

    const results: VectorSearchResult[] = [];

    for (const [id, doc] of this.memoryIndex) {
      // Apply filter
      if (filter && !filter(doc)) continue;

      // Calculate cosine similarity
      const score = this.cosineSimilarity(queryEmbedding, doc.embedding);

      if (score >= minScore) {
        results.push({
          id,
          content: doc.content,
          score,
          metadata: doc.metadata,
          highlights: includeHighlights ? [] : undefined,
        });
      }
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    return results.slice(0, limit);
  }

  // Hybrid search combining vector similarity and keyword matching
  async hybridSearch(
    queryEmbedding: number[],
    keywords: string[],
    options: {
      limit?: number;
      semanticWeight?: number;
      keywordWeight?: number;
      minScore?: number;
    } = {}
  ): Promise<VectorSearchResult[]> {
    await this.initialize();

    const {
      limit = 10,
      semanticWeight = 0.6,
      keywordWeight = 0.4,
      minScore = 0.3,
    } = options;

    const results: VectorSearchResult[] = [];
    const keywordsLower = keywords.map(k => k.toLowerCase());

    for (const [id, doc] of this.memoryIndex) {
      // Semantic score
      const semanticScore = this.cosineSimilarity(queryEmbedding, doc.embedding);

      // Keyword score
      const contentLower = doc.content.toLowerCase();
      let keywordScore = 0;
      let matchCount = 0;

      for (const keyword of keywordsLower) {
        const regex = new RegExp(this.escapeRegex(keyword), 'gi');
        const matches = contentLower.match(regex);
        if (matches) {
          keywordScore += matches.length;
          matchCount++;
        }
      }

      // Normalize keyword score
      keywordScore = matchCount > 0 ? Math.min(keywordScore / (keywords.length * 2), 1) : 0;

      // Combined score
      const score = semanticWeight * semanticScore + keywordWeight * keywordScore;

      if (score >= minScore) {
        results.push({
          id,
          content: doc.content,
          score,
          metadata: doc.metadata,
        });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }

  // Find similar code snippets
  async findSimilar(
    codeSnippet: string,
    embedding: number[],
    options: {
      limit?: number;
      excludePath?: string;
      sameLanguage?: boolean;
    } = {}
  ): Promise<VectorSearchResult[]> {
    await this.initialize();

    const { limit = 5, excludePath, sameLanguage } = options;

    const results = await this.search(embedding, {
      limit: limit * 2,
      minScore: 0.75,
      filter: (doc) => {
        if (excludePath && doc.metadata.path === excludePath) return false;
        if (sameLanguage && !doc.metadata.language) return false;
        return true;
      },
    });

    return results.slice(0, limit);
  }

  // Get all documents
  async getAllDocuments(): Promise<VectorDocument[]> {
    await this.initialize();
    return Array.from(this.memoryIndex.values());
  }

  // Get documents by type
  async getDocumentsByType(type: VectorMetadata['type']): Promise<VectorDocument[]> {
    await this.initialize();
    return Array.from(this.memoryIndex.values()).filter(
      (doc) => doc.metadata.type === type
    );
  }

  // Get documents by path
  async getDocumentsByPath(path: string): Promise<VectorDocument[]> {
    await this.initialize();
    return Array.from(this.memoryIndex.values()).filter(
      (doc) => doc.metadata.path === path || doc.metadata.path.startsWith(path + '/')
    );
  }

  // Get store statistics
  async getStats(): Promise<VectorStoreStats> {
    await this.initialize();

    let totalTokens = 0;
    let indexSize = 0;

    for (const doc of this.memoryIndex.values()) {
      totalTokens += Math.ceil(doc.content.length / 4);
      indexSize += doc.content.length + doc.embedding.length * 8;
    }

    return {
      documentCount: this.memoryIndex.size,
      totalTokens,
      lastIndexed: new Date(),
      indexSize,
      dimension: this.embeddingDimension,
    };
  }

  // Clear all documents
  async clear(): Promise<void> {
    await this.initialize();

    this.memoryIndex.clear();

    if (this.db) {
      await this.clearStore();
    }

    this.emit('store:cleared');
  }

  // Export store data
  async export(): Promise<string> {
    await this.initialize();

    const data = {
      documents: Array.from(this.memoryIndex.entries()),
      dimension: this.embeddingDimension,
      exportedAt: new Date().toISOString(),
    };

    return JSON.stringify(data);
  }

  // Import store data
  async import(data: string): Promise<number> {
    await this.initialize();

    try {
      const parsed = JSON.parse(data);

      if (parsed.documents) {
        for (const [id, doc] of parsed.documents) {
          this.memoryIndex.set(id, doc);
        }
      }

      if (parsed.dimension) {
        this.embeddingDimension = parsed.dimension;
      }

      // Persist to IndexedDB
      if (this.db && parsed.documents) {
        await this.persistDocuments(parsed.documents.map(([, doc]: [string, VectorDocument]) => doc));
      }

      this.emit('store:imported', { count: this.memoryIndex.size });
      return this.memoryIndex.size;
    } catch (error) {
      console.error('Failed to import vector store:', error);
      return 0;
    }
  }

  // Load all documents from IndexedDB into memory
  async loadFromStorage(): Promise<number> {
    await this.initialize();

    if (!this.db) return 0;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(this.config.storeName, 'readonly');
      const store = transaction.objectStore(this.config.storeName);
      const request = store.getAll();

      request.onsuccess = () => {
        const docs = request.result as VectorDocument[];
        this.memoryIndex.clear();

        for (const doc of docs) {
          this.memoryIndex.set(doc.id, doc);
        }

        this.emit('store:loaded', { count: docs.length });
        resolve(docs.length);
      };

      request.onerror = () => {
        console.error('Failed to load from IndexedDB:', request.error);
        reject(request.error);
      };
    });
  }

  // Private: Persist document to IndexedDB
  private async persistDocument(doc: VectorDocument): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(this.config.storeName, 'readwrite');
      const store = transaction.objectStore(this.config.storeName);
      const request = store.put(doc);

      request.onsuccess = () => resolve();
      request.onerror = () => {
        console.error('Failed to persist document:', request.error);
        reject(request.error);
      };
    });
  }

  // Private: Persist multiple documents
  private async persistDocuments(docs: VectorDocument[]): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(this.config.storeName, 'readwrite');
      const store = transaction.objectStore(this.config.storeName);

      for (const doc of docs) {
        store.put(doc);
      }

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => {
        console.error('Failed to persist documents:', transaction.error);
        reject(transaction.error);
      };
    });
  }

  // Private: Load document from IndexedDB
  private async loadDocument(id: string): Promise<VectorDocument | undefined> {
    if (!this.db) return undefined;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(this.config.storeName, 'readonly');
      const store = transaction.objectStore(this.config.storeName);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        console.error('Failed to load document:', request.error);
        reject(request.error);
      };
    });
  }

  // Private: Delete document from IndexedDB
  private async deleteDocument(id: string): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(this.config.storeName, 'readwrite');
      const store = transaction.objectStore(this.config.storeName);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => {
        console.error('Failed to delete document:', request.error);
        reject(request.error);
      };
    });
  }

  // Private: Delete documents by path
  private async deleteDocumentsByPath(path: string): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(this.config.storeName, 'readwrite');
      const store = transaction.objectStore(this.config.storeName);
      const index = store.index('path');
      const request = index.openCursor(IDBKeyRange.only(path));

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => {
        console.error('Failed to delete documents by path:', transaction.error);
        reject(transaction.error);
      };
    });
  }

  // Private: Clear store
  private async clearStore(): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(this.config.storeName, 'readwrite');
      const store = transaction.objectStore(this.config.storeName);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => {
        console.error('Failed to clear store:', request.error);
        reject(request.error);
      };
    });
  }

  // Private: Cosine similarity
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

  // Private: Escape regex special characters
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let vectorStoreInstance: VectorStore | null = null;

export function getVectorStore(): VectorStore {
  if (!vectorStoreInstance) {
    vectorStoreInstance = new VectorStore();
  }
  return vectorStoreInstance;
}

export function createVectorStore(config?: Partial<VectorStoreConfig>): VectorStore {
  return new VectorStore({ ...DEFAULT_CONFIG, ...config });
}
