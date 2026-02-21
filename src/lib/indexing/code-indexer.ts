/**
 * Kyro IDE - Code Indexer
 * Index workspace files with AI-powered embeddings and incremental updates
 */

import { EventEmitter } from 'events';
import { aiClient } from '@/lib/ai-client';
import { VectorStore, getVectorStore, VectorDocument, VectorMetadata } from './vector-store';
import { SymbolIndex, getSymbolIndex, SymbolInfo, SymbolExtractor, getSymbolExtractor } from './symbol-index';

// ============================================================================
// TYPES
// ============================================================================

export interface CodeChunk {
  id: string;
  path: string;
  content: string;
  startLine: number;
  endLine: number;
  language: string;
  hash: string;
  embedding?: number[];
  symbols: string[];
  imports: string[];
  exports: string[];
}

export interface IndexResult {
  chunks: CodeChunk[];
  symbols: SymbolInfo[];
  embeddingsGenerated: number;
  duration: number;
}

export interface IndexingProgress {
  phase: 'scanning' | 'chunking' | 'extracting' | 'embedding' | 'storing' | 'complete' | 'error';
  current: number;
  total: number;
  currentFile?: string;
  message?: string;
  error?: string;
}

export interface IndexingOptions {
  excludePatterns?: string[];
  includePatterns?: string[];
  maxFileSize?: number;
  chunkSize?: number;
  chunkOverlap?: number;
  generateEmbeddings?: boolean;
  extractSymbols?: boolean;
  incremental?: boolean;
  batchSize?: number;
}

export interface FileIndexInfo {
  path: string;
  hash: string;
  lastIndexed: number;
  chunkCount: number;
  symbolCount: number;
  embeddingStatus: 'pending' | 'processing' | 'complete' | 'failed';
}

export interface IndexStats {
  totalFiles: number;
  totalChunks: number;
  totalSymbols: number;
  indexSize: number;
  lastUpdated: Date;
  embeddingCount: number;
  pendingEmbeddings: number;
}

const DEFAULT_OPTIONS: IndexingOptions = {
  excludePatterns: [
    'node_modules/**',
    '.git/**',
    'dist/**',
    'build/**',
    '.next/**',
    'out/**',
    '**/*.min.js',
    '**/*.min.css',
    '**/*.map',
    '**/package-lock.json',
    '**/yarn.lock',
    '**/pnpm-lock.yaml',
  ],
  includePatterns: [
    '**/*.{ts,tsx,js,jsx,py,go,rs,java,c,cpp,h,hpp,css,scss,html,md,json,yaml,yml}',
  ],
  maxFileSize: 1024 * 1024, // 1MB
  chunkSize: 500,
  chunkOverlap: 50,
  generateEmbeddings: true,
  extractSymbols: true,
  incremental: true,
  batchSize: 10,
};

// ============================================================================
// CODE INDEXER
// ============================================================================

export class CodeIndexer extends EventEmitter {
  private vectorStore: VectorStore;
  private symbolIndex: SymbolIndex;
  private symbolExtractor: SymbolExtractor;
  
  // File tracking for incremental indexing
  private fileIndex: Map<string, FileIndexInfo> = new Map();
  
  // Chunk storage
  private chunks: Map<string, CodeChunk> = new Map();
  
  // Embedding queue
  private embeddingQueue: CodeChunk[] = [];
  private isProcessingEmbeddings: boolean = false;
  
  // Indexing state
  private isIndexing: boolean = false;
  private currentIndexingProgress?: IndexingProgress;
  
  private options: IndexingOptions;

  constructor(
    vectorStore: VectorStore = getVectorStore(),
    symbolIndex: SymbolIndex = getSymbolIndex(),
    symbolExtractor: SymbolExtractor = getSymbolExtractor(),
    options: IndexingOptions = DEFAULT_OPTIONS
  ) {
    super();
    this.vectorStore = vectorStore;
    this.symbolIndex = symbolIndex;
    this.symbolExtractor = symbolExtractor;
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  // Initialize the indexer
  async initialize(): Promise<void> {
    await this.vectorStore.initialize();
    await this.vectorStore.loadFromStorage();
    this.emit('initialized');
  }

  // Index a single file
  async indexFile(
    path: string,
    content: string,
    options: Partial<IndexingOptions> = {}
  ): Promise<IndexResult> {
    const startTime = Date.now();
    const opts = { ...this.options, ...options };

    // Check if file should be excluded
    if (this.shouldExclude(path)) {
      return { chunks: [], symbols: [], embeddingsGenerated: 0, duration: 0 };
    }

    // Check file size
    if (content.length > (opts.maxFileSize || DEFAULT_OPTIONS.maxFileSize!)) {
      return { chunks: [], symbols: [], embeddingsGenerated: 0, duration: 0 };
    }

    // Check for incremental update
    const hash = this.hashContent(content);
    const existingInfo = this.fileIndex.get(path);
    
    if (opts.incremental && existingInfo && existingInfo.hash === hash) {
      // File hasn't changed, skip indexing
      return {
        chunks: [],
        symbols: [],
        embeddingsGenerated: 0,
        duration: 0,
      };
    }

    // Remove old data if updating
    if (existingInfo) {
      await this.removeFileData(path);
    }

    // Detect language
    const language = this.detectLanguage(path);

    // Create chunks
    const chunks = this.createChunks(path, content, language);

    // Extract symbols
    let symbols: SymbolInfo[] = [];
    if (opts.extractSymbols) {
      symbols = this.symbolExtractor.extractSymbols(content, path, language);
      this.symbolIndex.addSymbols(symbols);
    }

    // Extract imports/exports from chunks
    for (const chunk of chunks) {
      this.extractImportsExports(chunk);
      chunk.symbols = symbols
        .filter(s => s.line >= chunk.startLine && s.line <= chunk.endLine)
        .map(s => s.name);
    }

    // Store chunks
    for (const chunk of chunks) {
      this.chunks.set(chunk.id, chunk);
    }

    // Generate embeddings
    let embeddingsGenerated = 0;
    if (opts.generateEmbeddings) {
      embeddingsGenerated = await this.generateEmbeddings(chunks);
    }

    // Update file index
    this.fileIndex.set(path, {
      path,
      hash,
      lastIndexed: Date.now(),
      chunkCount: chunks.length,
      symbolCount: symbols.length,
      embeddingStatus: opts.generateEmbeddings ? 'complete' : 'pending',
    });

    const duration = Date.now() - startTime;
    
    this.emit('file:indexed', { path, chunks: chunks.length, symbols: symbols.length, duration });
    
    return {
      chunks,
      symbols,
      embeddingsGenerated,
      duration,
    };
  }

  // Index multiple files
  async indexFiles(
    files: Array<{ path: string; content: string }>,
    options: Partial<IndexingOptions> = {}
  ): Promise<IndexResult[]> {
    const results: IndexResult[] = [];
    const batchSize = options.batchSize || this.options.batchSize || 10;

    this.isIndexing = true;

    // Filter files
    const filesToIndex = files.filter(f => !this.shouldExclude(f.path));

    // Process in batches
    for (let i = 0; i < filesToIndex.length; i += batchSize) {
      const batch = filesToIndex.slice(i, i + batchSize);
      
      this.emitProgress('chunking', i, filesToIndex.length, `Processing batch ${Math.floor(i / batchSize) + 1}`);

      const batchResults = await Promise.all(
        batch.map(file => this.indexFile(file.path, file.content, options))
      );

      results.push(...batchResults);
    }

    this.isIndexing = false;
    this.emitProgress('complete', filesToIndex.length, filesToIndex.length);

    return results;
  }

  // Incremental index - only re-index changed files
  async incrementalIndex(
    files: Array<{ path: string; content: string }>,
    options: Partial<IndexingOptions> = {}
  ): Promise<IndexResult[]> {
    const results: IndexResult[] = [];
    const opts = { ...this.options, ...options, incremental: true };

    for (const file of files) {
      const hash = this.hashContent(file.content);
      const existingInfo = this.fileIndex.get(file.path);

      // Skip unchanged files
      if (existingInfo && existingInfo.hash === hash) {
        continue;
      }

      const result = await this.indexFile(file.path, file.content, opts);
      if (result.chunks.length > 0 || result.symbols.length > 0) {
        results.push(result);
      }
    }

    return results;
  }

  // Remove a file from the index
  async removeFile(path: string): Promise<void> {
    await this.removeFileData(path);
    this.fileIndex.delete(path);
    this.emit('file:removed', { path });
  }

  // Get chunks for a file
  getFileChunks(path: string): CodeChunk[] {
    return Array.from(this.chunks.values()).filter(c => c.path === path);
  }

  // Get chunk by ID
  getChunk(id: string): CodeChunk | undefined {
    return this.chunks.get(id);
  }

  // Get file index info
  getFileInfo(path: string): FileIndexInfo | undefined {
    return this.fileIndex.get(path);
  }

  // Get all indexed files
  getIndexedFiles(): FileIndexInfo[] {
    return Array.from(this.fileIndex.values());
  }

  // Get index statistics
  getStats(): IndexStats {
    let embeddingCount = 0;
    let pendingEmbeddings = 0;

    for (const chunk of this.chunks.values()) {
      if (chunk.embedding) {
        embeddingCount++;
      } else {
        pendingEmbeddings++;
      }
    }

    let indexSize = 0;
    for (const chunk of this.chunks.values()) {
      indexSize += chunk.content.length;
      if (chunk.embedding) {
        indexSize += chunk.embedding.length * 8;
      }
    }

    return {
      totalFiles: this.fileIndex.size,
      totalChunks: this.chunks.size,
      totalSymbols: this.symbolIndex.getStats().totalSymbols,
      indexSize,
      lastUpdated: new Date(),
      embeddingCount,
      pendingEmbeddings,
    };
  }

  // Get indexing progress
  getProgress(): IndexingProgress | undefined {
    return this.currentIndexingProgress;
  }

  // Check if currently indexing
  isCurrentlyIndexing(): boolean {
    return this.isIndexing;
  }

  // Generate embeddings for pending chunks
  async processPendingEmbeddings(): Promise<number> {
    const pendingChunks = Array.from(this.chunks.values()).filter(c => !c.embedding);
    
    if (pendingChunks.length === 0) return 0;

    return this.generateEmbeddings(pendingChunks);
  }

  // Clear the entire index
  async clear(): Promise<void> {
    this.chunks.clear();
    this.fileIndex.clear();
    this.embeddingQueue = [];
    this.symbolIndex.clear();
    await this.vectorStore.clear();
    
    this.emit('index:cleared');
  }

  // Export index to JSON
  async export(): Promise<string> {
    const data = {
      chunks: Array.from(this.chunks.entries()),
      fileIndex: Array.from(this.fileIndex.entries()),
      vectorStore: await this.vectorStore.export(),
      symbolIndex: this.symbolIndex.export(),
      exportedAt: new Date().toISOString(),
    };

    return JSON.stringify(data);
  }

  // Import index from JSON
  async import(data: string): Promise<number> {
    try {
      const parsed = JSON.parse(data);

      // Import chunks
      if (parsed.chunks) {
        this.chunks = new Map(parsed.chunks);
      }

      // Import file index
      if (parsed.fileIndex) {
        this.fileIndex = new Map(parsed.fileIndex);
      }

      // Import vector store
      if (parsed.vectorStore) {
        await this.vectorStore.import(parsed.vectorStore);
      }

      // Import symbol index
      if (parsed.symbolIndex) {
        this.symbolIndex.import(parsed.symbolIndex);
      }

      this.emit('index:imported', { count: this.chunks.size });
      return this.chunks.size;
    } catch (error) {
      console.error('Failed to import index:', error);
      return 0;
    }
  }

  // Get the vector store
  getVectorStore(): VectorStore {
    return this.vectorStore;
  }

  // Get the symbol index
  getSymbolIndex(): SymbolIndex {
    return this.symbolIndex;
  }

  // Private: Remove file data from all indices
  private async removeFileData(path: string): Promise<void> {
    // Remove chunks
    for (const [id, chunk] of this.chunks) {
      if (chunk.path === path) {
        this.chunks.delete(id);
      }
    }

    // Remove from vector store
    await this.vectorStore.removeDocumentsByPath(path);

    // Remove from symbol index
    this.symbolIndex.removeSymbolsByPath(path);
  }

  // Private: Generate embeddings for chunks
  private async generateEmbeddings(chunks: CodeChunk[]): Promise<number> {
    let generated = 0;
    const batchSize = 5;

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);

      const results = await Promise.all(
        batch.map(chunk => this.generateEmbedding(chunk))
      );

      for (let j = 0; j < batch.length; j++) {
        if (results[j]) {
          batch[j].embedding = results[j]!;
          generated++;

          // Add to vector store
          await this.vectorStore.addDocument({
            id: batch[j].id,
            content: batch[j].content,
            embedding: results[j]!,
            metadata: {
              path: batch[j].path,
              type: 'chunk',
              language: batch[j].language,
              lineStart: batch[j].startLine,
              lineEnd: batch[j].endLine,
              timestamp: Date.now(),
              hash: batch[j].hash,
            },
          });
        }
      }

      this.emit('embeddings:generated', { current: Math.min(i + batchSize, chunks.length), total: chunks.length });
    }

    return generated;
  }

  // Private: Generate embedding for a single chunk
  private async generateEmbedding(chunk: CodeChunk): Promise<number[] | null> {
    try {
      // Use AI service to generate semantic representation
      const response = await aiClient.chat([
        {
          role: 'system',
          content: 'You are a code semantic analyzer. Extract key semantic concepts for code search embeddings.',
        },
        {
          role: 'user',
          content: `Extract key semantic concepts from this ${chunk.language} code. Return a JSON array of 15 keywords/concepts: ${chunk.content.slice(0, 1000)}`,
        },
      ], 'claude-3-haiku', { maxTokens: 150, temperature: 0.1 });

      // Parse concepts and convert to embedding
      const conceptsMatch = response.content.match(/\[.*\]/s);
      if (conceptsMatch) {
        try {
          const concepts = JSON.parse(conceptsMatch[0]) as string[];
          return this.textToEmbedding(concepts.join(' ') + ' ' + chunk.content.slice(0, 200));
        } catch {
          return this.textToEmbedding(chunk.content);
        }
      }

      return this.textToEmbedding(chunk.content);
    } catch (error) {
      console.error('Failed to generate embedding:', error);
      // Fallback to pseudo-embedding
      return this.textToEmbedding(chunk.content);
    }
  }

  // Private: Convert text to embedding vector
  private textToEmbedding(text: string): number[] {
    const dimension = 1536;
    const embedding: number[] = new Array(dimension).fill(0);

    // Hash-based embedding with n-gram features
    for (let i = 0; i < text.length; i++) {
      const charCode = text.charCodeAt(i);
      const pos = i % dimension;
      embedding[pos] += Math.sin(charCode * (i + 1)) + Math.cos(charCode * (i + 2));
    }

    // Add word-level features
    const words = text.toLowerCase().split(/\s+/);
    for (const word of words) {
      const hash = this.simpleHash(word);
      for (let i = 0; i < Math.min(word.length, 15); i++) {
        const pos = (Math.abs(hash) + i) % dimension;
        embedding[pos] += 1 / (i + 1);
      }
    }

    // Add code-specific features
    const codeFeatures = this.extractCodeFeatures(text);
    for (const feature of codeFeatures) {
      const hash = this.simpleHash(feature);
      const pos = Math.abs(hash) % dimension;
      embedding[pos] += 2;
    }

    // Normalize
    const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return embedding.map(val => val / (norm || 1));
  }

  // Private: Extract code-specific features
  private extractCodeFeatures(text: string): string[] {
    const features: string[] = [];

    // Function names
    const funcMatch = text.match(/(?:function|def|fn|func)\s+(\w+)/g);
    if (funcMatch) features.push(...funcMatch);

    // Class names
    const classMatch = text.match(/(?:class|struct|interface)\s+(\w+)/g);
    if (classMatch) features.push(...classMatch);

    // Keywords
    const keywords = ['async', 'await', 'import', 'export', 'const', 'let', 'var', 'return', 'if', 'else', 'for', 'while'];
    for (const kw of keywords) {
      if (new RegExp(`\\b${kw}\\b`).test(text)) {
        features.push(`keyword:${kw}`);
      }
    }

    return features;
  }

  // Private: Create chunks from file content
  private createChunks(path: string, content: string, language: string): CodeChunk[] {
    const lines = content.split('\n');
    const chunks: CodeChunk[] = [];
    const chunkSize = this.options.chunkSize || DEFAULT_OPTIONS.chunkSize!;
    const chunkOverlap = this.options.chunkOverlap || DEFAULT_OPTIONS.chunkOverlap!;

    let currentStart = 0;
    let currentLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      currentLines.push(lines[i]);

      // Check if we should create a chunk
      if (currentLines.length >= chunkSize) {
        const chunkContent = currentLines.join('\n');
        chunks.push(this.createChunk(path, chunkContent, currentStart, i, language));

        // Keep overlap lines
        currentLines = currentLines.slice(-chunkOverlap);
        currentStart = i - chunkOverlap + 1;
      }
    }

    // Create final chunk
    if (currentLines.length > 0) {
      const chunkContent = currentLines.join('\n');
      chunks.push(this.createChunk(path, chunkContent, currentStart, lines.length - 1, language));
    }

    return chunks;
  }

  // Private: Create a single chunk
  private createChunk(
    path: string,
    content: string,
    startLine: number,
    endLine: number,
    language: string
  ): CodeChunk {
    const id = `${path}:${startLine}-${endLine}`;
    return {
      id,
      path,
      content,
      startLine,
      endLine,
      language,
      hash: this.hashContent(content),
      symbols: [],
      imports: [],
      exports: [],
    };
  }

  // Private: Extract imports and exports from chunk
  private extractImportsExports(chunk: CodeChunk): void {
    const content = chunk.content;

    // Extract imports
    const importPatterns = [
      /import\s+.*?from\s+['"]([^'"]+)['"]/g,
      /import\s+['"]([^'"]+)['"]/g,
      /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
      /from\s+['"]([^'"]+)['"]\s+import/g,
    ];

    for (const pattern of importPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        if (!chunk.imports.includes(match[1])) {
          chunk.imports.push(match[1]);
        }
      }
    }

    // Extract exports
    const exportPatterns = [
      /export\s+(?:default\s+)?(?:function|class|const|let|var)\s+(\w+)/g,
      /export\s+\{([^}]+)\}/g,
    ];

    for (const pattern of exportPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const names = match[1]?.split(',').map(s => s.trim().split(' as ')[0]) || [];
        for (const name of names) {
          if (name && !chunk.exports.includes(name)) {
            chunk.exports.push(name);
          }
        }
      }
    }
  }

  // Private: Check if path should be excluded
  private shouldExclude(path: string): boolean {
    const excludePatterns = this.options.excludePatterns || DEFAULT_OPTIONS.excludePatterns!;

    return excludePatterns.some(pattern => {
      if (pattern.includes('**')) {
        const regex = new RegExp(
          pattern
            .replace(/\*\*/g, '<<DOUBLE_STAR>>')
            .replace(/\*/g, '[^/]*')
            .replace(/<<DOUBLE_STAR>>/g, '.*')
        );
        return regex.test(path);
      }
      return path.includes(pattern.replace('*', ''));
    });
  }

  // Private: Detect language from file extension
  private detectLanguage(path: string): string {
    const ext = path.split('.').pop()?.toLowerCase() || '';
    const langMap: Record<string, string> = {
      'ts': 'typescript',
      'tsx': 'typescriptreact',
      'js': 'javascript',
      'jsx': 'javascriptreact',
      'py': 'python',
      'go': 'go',
      'rs': 'rust',
      'java': 'java',
      'c': 'c',
      'cpp': 'cpp',
      'h': 'c',
      'hpp': 'cpp',
      'css': 'css',
      'scss': 'scss',
      'html': 'html',
      'json': 'json',
      'yaml': 'yaml',
      'yml': 'yaml',
      'md': 'markdown',
      'sql': 'sql',
    };
    return langMap[ext] || 'plaintext';
  }

  // Private: Hash content
  private hashContent(content: string): string {
    return this.simpleHash(content).toString(16);
  }

  // Private: Simple hash function
  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash;
  }

  // Private: Emit progress event
  private emitProgress(
    phase: IndexingProgress['phase'],
    current: number,
    total: number,
    message?: string
  ): void {
    this.currentIndexingProgress = { phase, current, total, message };
    this.emit('progress', this.currentIndexingProgress);
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let indexerInstance: CodeIndexer | null = null;

export function getCodeIndexer(): CodeIndexer {
  if (!indexerInstance) {
    indexerInstance = new CodeIndexer();
  }
  return indexerInstance;
}

export function createCodeIndexer(options?: IndexingOptions): CodeIndexer {
  return new CodeIndexer(undefined, undefined, undefined, options);
}
