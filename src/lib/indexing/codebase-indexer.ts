// Kyro IDE - Codebase Indexing Service
// Semantic search and code understanding

import { EventEmitter } from 'events';

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

export interface SearchResult {
  chunk: CodeChunk;
  score: number;
  highlights: { start: number; end: number }[];
}

export interface IndexStats {
  totalFiles: number;
  totalChunks: number;
  totalSymbols: number;
  indexSize: number;
  lastUpdated: Date;
  indexingProgress: number;
}

export interface IndexingOptions {
  excludePatterns: string[];
  maxFileSize: number;
  chunkSize: number;
  chunkOverlap: number;
  includePatterns: string[];
}

// ============================================================================
// CODEBASE INDEXER
// ============================================================================

export class CodebaseIndexer extends EventEmitter {
  private chunks: Map<string, CodeChunk> = new Map();
  private fileHashes: Map<string, string> = new Map();
  private symbolIndex: Map<string, Set<string>> = new Map();
  private isIndexing: boolean = false;
  private stats: IndexStats = {
    totalFiles: 0,
    totalChunks: 0,
    totalSymbols: 0,
    indexSize: 0,
    lastUpdated: new Date(),
    indexingProgress: 0,
  };

  constructor(private options: IndexingOptions = {
    excludePatterns: ['node_modules/**', '.git/**', 'dist/**', '**/*.min.js'],
    maxFileSize: 1024 * 1024, // 1MB
    chunkSize: 500,
    chunkOverlap: 50,
    includePatterns: ['**/*.{ts,tsx,js,jsx,py,go,rs,java}'],
  }) {
    super();
  }

  // Index a file
  async indexFile(path: string, content: string): Promise<CodeChunk[]> {
    // Check if file should be excluded
    if (this.shouldExclude(path)) {
      return [];
    }

    // Check file size
    if (content.length > this.options.maxFileSize) {
      return [];
    }

    // Check if already indexed (hash comparison)
    const hash = this.hashContent(content);
    const existingHash = this.fileHashes.get(path);
    if (existingHash === hash) {
      return []; // Already indexed, no changes
    }

    // Remove old chunks for this file
    this.removeFileChunks(path);

    // Detect language
    const language = this.detectLanguage(path);

    // Create chunks
    const chunks = this.createChunks(path, content, language);
    
    // Extract symbols
    chunks.forEach(chunk => {
      this.extractSymbols(chunk);
    });

    // Store chunks
    chunks.forEach(chunk => {
      this.chunks.set(chunk.id, chunk);
    });

    // Update file hash
    this.fileHashes.set(path, hash);

    // Update stats
    this.updateStats();

    this.emit('file:indexed', { path, chunks: chunks.length });
    return chunks;
  }

  // Remove file from index
  removeFile(path: string): void {
    this.removeFileChunks(path);
    this.fileHashes.delete(path);
    this.updateStats();
    this.emit('file:removed', { path });
  }

  // Search the codebase
  async search(query: string, limit: number = 10): Promise<SearchResult[]> {
    const keywords = this.extractKeywords(query);
    const scores = new Map<string, number>();

    // Score chunks based on keyword matches
    this.chunks.forEach((chunk, id) => {
      let score = 0;
      const content = chunk.content.toLowerCase();

      for (const keyword of keywords) {
        // Direct content match
        const regex = new RegExp(keyword, 'gi');
        const matches = content.match(regex);
        if (matches) {
          score += matches.length * 2;
        }

        // Symbol match
        if (chunk.symbols.some(s => s.toLowerCase().includes(keyword))) {
          score += 5;
        }

        // Path match
        if (chunk.path.toLowerCase().includes(keyword)) {
          score += 3;
        }
      }

      if (score > 0) {
        scores.set(id, score);
      }
    });

    // Sort by score and get top results
    const sortedIds = Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([id]) => id);

    // Build results
    return sortedIds.map(id => {
      const chunk = this.chunks.get(id)!;
      return {
        chunk,
        score: scores.get(id) || 0,
        highlights: this.findHighlights(chunk.content, keywords),
      };
    });
  }

  // Get relevant context for a query
  async getContext(query: string, maxTokens: number = 4000): Promise<CodeChunk[]> {
    const results = await this.search(query, 20);
    const selected: CodeChunk[] = [];
    let tokenCount = 0;

    for (const result of results) {
      const chunkTokens = result.chunk.content.length / 4; // Approximate
      if (tokenCount + chunkTokens > maxTokens) break;
      selected.push(result.chunk);
      tokenCount += chunkTokens;
    }

    return selected;
  }

  // Get all symbols
  getAllSymbols(): string[] {
    return Array.from(this.symbolIndex.keys());
  }

  // Get chunks containing a symbol
  getChunksForSymbol(symbol: string): CodeChunk[] {
    const chunkIds = this.symbolIndex.get(symbol.toLowerCase());
    if (!chunkIds) return [];
    return Array.from(chunkIds).map(id => this.chunks.get(id)).filter(Boolean) as CodeChunk[];
  }

  // Get stats
  getStats(): IndexStats {
    return { ...this.stats };
  }

  // Clear the index
  clear(): void {
    this.chunks.clear();
    this.fileHashes.clear();
    this.symbolIndex.clear();
    this.updateStats();
    this.emit('index:cleared');
  }

  // Export index
  export(): string {
    return JSON.stringify({
      chunks: Array.from(this.chunks.entries()),
      fileHashes: Array.from(this.fileHashes.entries()),
      symbolIndex: Array.from(this.symbolIndex.entries()),
    });
  }

  // Import index
  import(data: string): void {
    try {
      const parsed = JSON.parse(data);
      this.chunks = new Map(parsed.chunks);
      this.fileHashes = new Map(parsed.fileHashes);
      this.symbolIndex = new Map(parsed.symbolIndex.map(
        ([k, v]: [string, unknown]) => [k, new Set(v as string[])]
      ));
      this.updateStats();
      this.emit('index:imported', { chunks: this.chunks.size });
    } catch (e) {
      console.error('Failed to import index:', e);
    }
  }

  // Private methods
  private shouldExclude(path: string): boolean {
    return this.options.excludePatterns.some(pattern => {
      const regex = new RegExp(
        pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*')
      );
      return regex.test(path);
    });
  }

  private hashContent(content: string): string {
    // Simple hash function
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }

  private detectLanguage(path: string): string {
    const ext = path.split('.').pop()?.toLowerCase() || '';
    const langMap: Record<string, string> = {
      'ts': 'typescript', 'tsx': 'typescript', 'js': 'javascript', 'jsx': 'javascript',
      'py': 'python', 'go': 'go', 'rs': 'rust', 'java': 'java',
      'c': 'c', 'cpp': 'cpp', 'h': 'c', 'hpp': 'cpp',
      'css': 'css', 'scss': 'scss', 'html': 'html',
      'json': 'json', 'yaml': 'yaml', 'yml': 'yaml',
      'md': 'markdown', 'sql': 'sql',
    };
    return langMap[ext] || 'plaintext';
  }

  private createChunks(path: string, content: string, language: string): CodeChunk[] {
    const lines = content.split('\n');
    const chunks: CodeChunk[] = [];
    
    let currentStart = 0;
    let currentLines: string[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      currentLines.push(lines[i]);
      
      // Check if we should create a chunk
      if (currentLines.length >= this.options.chunkSize) {
        const chunkContent = currentLines.join('\n');
        chunks.push(this.createChunk(path, chunkContent, currentStart, i, language));
        
        // Keep overlap lines
        currentLines = currentLines.slice(-this.options.chunkOverlap);
        currentStart = i - this.options.chunkOverlap + 1;
      }
    }
    
    // Create final chunk
    if (currentLines.length > 0) {
      const chunkContent = currentLines.join('\n');
      chunks.push(this.createChunk(path, chunkContent, currentStart, lines.length - 1, language));
    }
    
    return chunks;
  }

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

  private extractSymbols(chunk: CodeChunk): void {
    const content = chunk.content;
    
    // Extract function/class names
    const patterns = [
      /(?:function|def|class|interface|type|const|let|var)\s+(\w+)/g,
      /(?:export\s+(?:default\s+)?(?:function|class|const))\s+(\w+)/g,
    ];
    
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const symbol = match[1];
        chunk.symbols.push(symbol);
        
        // Add to symbol index
        const key = symbol.toLowerCase();
        if (!this.symbolIndex.has(key)) {
          this.symbolIndex.set(key, new Set());
        }
        this.symbolIndex.get(key)!.add(chunk.id);
      }
    }
    
    // Extract imports
    const importPattern = /import\s+.*?from\s+['"]([^'"]+)['"]/g;
    let importMatch;
    while ((importMatch = importPattern.exec(content)) !== null) {
      chunk.imports.push(importMatch[1]);
    }
    
    // Extract exports
    const exportPattern = /export\s+(?:default\s+)?(\w+)/g;
    let exportMatch;
    while ((exportMatch = exportPattern.exec(content)) !== null) {
      chunk.exports.push(exportMatch[1]);
    }
  }

  private removeFileChunks(path: string): void {
    for (const [id, chunk] of this.chunks) {
      if (chunk.path === path) {
        // Remove from symbol index
        chunk.symbols.forEach(symbol => {
          this.symbolIndex.get(symbol.toLowerCase())?.delete(id);
        });
        this.chunks.delete(id);
      }
    }
  }

  private extractKeywords(query: string): string[] {
    const stopWords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
      'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
      'may', 'might', 'must', 'shall', 'can', 'need', 'to', 'of', 'in', 'for', 'on', 'with',
      'at', 'by', 'from', 'as', 'into', 'through', 'how', 'what', 'where', 'when', 'why']);
    
    return query
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word));
  }

  private findHighlights(content: string, keywords: string[]): { start: number; end: number }[] {
    const highlights: { start: number; end: number }[] = [];
    
    for (const keyword of keywords) {
      const regex = new RegExp(keyword, 'gi');
      let match;
      while ((match = regex.exec(content)) !== null) {
        highlights.push({ start: match.index, end: match.index + match[0].length });
      }
    }
    
    return highlights;
  }

  private updateStats(): void {
    this.stats = {
      totalFiles: this.fileHashes.size,
      totalChunks: this.chunks.size,
      totalSymbols: this.symbolIndex.size,
      indexSize: JSON.stringify(this.export()).length,
      lastUpdated: new Date(),
      indexingProgress: 100,
    };
  }
}

// Singleton
let indexerInstance: CodebaseIndexer | null = null;

export function getCodebaseIndexer(): CodebaseIndexer {
  if (!indexerInstance) {
    indexerInstance = new CodebaseIndexer();
  }
  return indexerInstance;
}
