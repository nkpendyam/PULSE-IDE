/**
 * Kyro IDE - Semantic Search
 * AI-powered search with query understanding and code example matching
 */

import { EventEmitter } from 'events';
import { aiClient } from '@/lib/ai-client';
import { VectorStore, getVectorStore, VectorSearchResult, VectorDocument } from './vector-store';
import { SymbolIndex, getSymbolIndex, SymbolInfo, SymbolKind } from './symbol-index';

// ============================================================================
// TYPES
// ============================================================================

export interface SearchQuery {
  text: string;
  type?: 'code' | 'natural' | 'symbol' | 'auto';
  language?: string;
  filters?: SearchFilters;
}

export interface SearchFilters {
  paths?: string[];
  kinds?: SymbolKind[];
  languages?: string[];
  dateRange?: { start: Date; end: Date };
  fileSize?: { min?: number; max?: number };
}

export interface SemanticSearchResult {
  id: string;
  type: 'code' | 'symbol' | 'chunk';
  content: string;
  score: number;
  path: string;
  lineStart: number;
  lineEnd: number;
  language?: string;
  symbol?: SymbolInfo;
  highlights: SearchHighlight[];
  context?: string;
  explanation?: string;
}

export interface SearchHighlight {
  start: number;
  end: number;
  type: 'match' | 'symbol' | 'keyword';
  text: string;
}

export interface SearchOptions {
  limit?: number;
  minScore?: number;
  includeContext?: boolean;
  includeExplanation?: boolean;
  hybridSearch?: boolean;
  semanticWeight?: number;
  keywordWeight?: number;
}

export interface CodeExampleSearch {
  code: string;
  language?: string;
  findSimilar?: boolean;
  findUsage?: boolean;
  limit?: number;
}

export interface SearchContext {
  recentFiles?: string[];
  openFiles?: string[];
  selectedSymbol?: string;
  cursorPosition?: { path: string; line: number; column: number };
}

export interface QueryUnderstanding {
  intent: 'find_definition' | 'find_usage' | 'find_similar' | 'find_related' | 'explain' | 'general';
  entities: string[];
  keywords: string[];
  codePatterns: string[];
  languageHint?: string;
}

// ============================================================================
// SEMANTIC SEARCH ENGINE
// ============================================================================

export class SemanticSearchEngine extends EventEmitter {
  private vectorStore: VectorStore;
  private symbolIndex: SymbolIndex;
  private queryCache: Map<string, number[]> = new Map();
  private maxCacheSize: number = 100;

  constructor(
    vectorStore: VectorStore = getVectorStore(),
    symbolIndex: SymbolIndex = getSymbolIndex()
  ) {
    super();
    this.vectorStore = vectorStore;
    this.symbolIndex = symbolIndex;
  }

  // Main search method
  async search(
    query: SearchQuery,
    options: SearchOptions = {}
  ): Promise<SemanticSearchResult[]> {
    const {
      limit = 10,
      minScore = 0.3,
      includeContext = true,
      includeExplanation = false,
      hybridSearch = true,
      semanticWeight = 0.6,
      keywordWeight = 0.4,
    } = options;

    // Understand the query
    const understanding = await this.understandQuery(query);
    
    // Generate embedding for the query
    const queryEmbedding = await this.generateEmbedding(query.text);

    // Perform searches based on intent
    let results: SemanticSearchResult[] = [];

    switch (understanding.intent) {
      case 'find_definition':
        results = await this.searchDefinitions(understanding, query, options);
        break;
        
      case 'find_usage':
        results = await this.searchUsage(understanding, query, options);
        break;
        
      case 'find_similar':
        results = await this.searchSimilar(queryEmbedding, query, options);
        break;
        
      case 'find_related':
        results = await this.searchRelated(understanding, query, options);
        break;
        
      default:
        // General semantic search
        if (hybridSearch) {
          results = await this.hybridSearch(
            queryEmbedding,
            understanding.keywords,
            {
              limit,
              minScore,
              semanticWeight,
              keywordWeight,
            }
          );
        } else {
          results = await this.semanticSearch(queryEmbedding, { limit, minScore });
        }
    }

    // Add context and explanations
    if (includeContext) {
      results = await this.addContext(results);
    }

    if (includeExplanation) {
      results = await this.addExplanations(results, query);
    }

    return results.slice(0, limit);
  }

  // Search by code example
  async searchByCodeExample(search: CodeExampleSearch): Promise<SemanticSearchResult[]> {
    const { code, language, findSimilar = true, findUsage = false, limit = 5 } = search;

    // Generate embedding for the code
    const embedding = await this.generateEmbedding(code);

    // Extract symbols from the code
    const symbols = this.extractSymbolsFromCode(code, language);

    const results: SemanticSearchResult[] = [];

    // Find similar code
    if (findSimilar) {
      const similarResults = await this.vectorStore.findSimilar(code, embedding, {
        limit: limit * 2,
        sameLanguage: !!language,
      });

      for (const result of similarResults) {
        results.push({
          id: result.id,
          type: 'code',
          content: result.content,
          score: result.score,
          path: result.metadata.path,
          lineStart: result.metadata.lineStart,
          lineEnd: result.metadata.lineEnd,
          language: result.metadata.language,
          highlights: [],
        });
      }
    }

    // Find usage of symbols
    if (findUsage && symbols.length > 0) {
      for (const symbolName of symbols) {
        const symbolResults = this.symbolIndex.searchByName(symbolName, { limit: 5 });
        
        for (const symbol of symbolResults) {
          // Get references
          const refs = this.symbolIndex.getReferencesTo(symbol.id);
          
          for (const ref of refs) {
            results.push({
              id: `ref:${symbol.id}:${ref.path}:${ref.line}`,
              type: 'code',
              content: `Usage of ${symbol.name} at ${ref.path}:${ref.line}`,
              score: 0.8,
              path: ref.path,
              lineStart: ref.line,
              lineEnd: ref.line,
              highlights: [{ start: 0, end: symbol.name.length, type: 'symbol', text: symbol.name }],
            });
          }
        }
      }
    }

    // Deduplicate and sort
    const uniqueResults = this.deduplicateResults(results);
    return uniqueResults.slice(0, limit);
  }

  // Quick search for autocomplete/suggestions
  async quickSearch(
    query: string,
    context?: SearchContext
  ): Promise<SemanticSearchResult[]> {
    const keywords = this.extractKeywords(query);
    
    // Search symbols first (fast)
    const symbolResults = this.symbolIndex.search({
      query,
      limit: 5,
      fuzzy: true,
    });

    const results: SemanticSearchResult[] = [];

    for (const symbol of symbolResults) {
      results.push({
        id: symbol.id,
        type: 'symbol',
        content: symbol.content || symbol.name,
        score: 0.9,
        path: symbol.path,
        lineStart: symbol.line,
        lineEnd: symbol.endLine,
        language: symbol.language,
        symbol,
        highlights: [],
      });
    }

    // Boost results from recent/open files
    if (context) {
      this.boostByContext(results, context);
    }

    return results.slice(0, 10);
  }

  // Get context for a position in code
  async getContextForPosition(
    path: string,
    line: number,
    _column: number,
    maxTokens: number = 2000
  ): Promise<SemanticSearchResult[]> {
    const results: SemanticSearchResult[] = [];
    let tokenCount = 0;

    // Get symbols at this position
    const symbols = this.symbolIndex.getSymbolsByPath(path);
    const relevantSymbols = symbols.filter(
      s => s.line <= line && s.endLine >= line
    );

    for (const symbol of relevantSymbols) {
      if (tokenCount >= maxTokens) break;

      results.push({
        id: symbol.id,
        type: 'symbol',
        content: symbol.content || symbol.name,
        score: 1.0,
        path: symbol.path,
        lineStart: symbol.line,
        lineEnd: symbol.endLine,
        language: symbol.language,
        symbol,
        highlights: [],
      });

      tokenCount += Math.ceil((symbol.content?.length || 0) / 4);
    }

    // Get related symbols
    for (const symbol of relevantSymbols) {
      if (tokenCount >= maxTokens) break;

      const referenced = this.symbolIndex.getSymbolsReferencedBy(symbol.id);
      for (const ref of referenced) {
        if (tokenCount >= maxTokens) break;

        results.push({
          id: ref.id,
          type: 'symbol',
          content: ref.content || ref.name,
          score: 0.8,
          path: ref.path,
          lineStart: ref.line,
          lineEnd: ref.endLine,
          language: ref.language,
          symbol: ref,
          highlights: [],
        });

        tokenCount += Math.ceil((ref.content?.length || 0) / 4);
      }
    }

    return results;
  }

  // Private: Understand query intent
  private async understandQuery(query: SearchQuery): Promise<QueryUnderstanding> {
    const text = query.text.toLowerCase();

    // Detect intent from query patterns
    let intent: QueryUnderstanding['intent'] = 'general';
    const entities: string[] = [];
    const codePatterns: string[] = [];

    // Intent detection patterns
    if (/\b(definition|define|declared?|where is|implementation)\b/.test(text)) {
      intent = 'find_definition';
    } else if (/\b(usage|used|called|referenced?|usages)\b/.test(text)) {
      intent = 'find_usage';
    } else if (/\b(similar|like|same|pattern)\b/.test(text)) {
      intent = 'find_similar';
    } else if (/\b(related|connected|depends?|imports?|dependency)\b/.test(text)) {
      intent = 'find_related';
    } else if (/\b(explain|what does|how does|why)\b/.test(text)) {
      intent = 'explain';
    }

    // Extract potential symbol names (capitalized words, quoted strings, code identifiers)
    const symbolPattern = /['"]([a-zA-Z_][a-zA-Z0-9_]*)['"]|([A-Z][a-zA-Z0-9_]*)/g;
    let match;
    while ((match = symbolPattern.exec(query.text)) !== null) {
      entities.push(match[1] || match[2]);
    }

    // Extract code patterns (text in backticks or code-like structures)
    const codePattern = /`([^`]+)`|([a-zA-Z_][a-zA-Z0-9_]*\([^)]*\))/g;
    while ((match = codePattern.exec(query.text)) !== null) {
      codePatterns.push(match[1] || match[2]);
    }

    // Extract keywords
    const keywords = this.extractKeywords(query.text);

    // Detect language hint
    let languageHint: string | undefined;
    const langPatterns: Record<string, RegExp> = {
      typescript: /\b(typescript|ts|tsx)\b/i,
      javascript: /\b(javascript|js|jsx)\b/i,
      python: /\b(python|py)\b/i,
      rust: /\b(rust|rs)\b/i,
      go: /\b(golang|go)\b/i,
    };

    for (const [lang, pattern] of Object.entries(langPatterns)) {
      if (pattern.test(text)) {
        languageHint = lang;
        break;
      }
    }

    return {
      intent,
      entities,
      keywords,
      codePatterns,
      languageHint: languageHint || query.language,
    };
  }

  // Private: Generate embedding using AI service
  private async generateEmbedding(text: string): Promise<number[]> {
    // Check cache first
    const cacheKey = this.hashText(text);
    if (this.queryCache.has(cacheKey)) {
      return this.queryCache.get(cacheKey)!;
    }

    // Use AI service to generate embedding
    // Since the AI service doesn't have a dedicated embedding method,
    // we'll use a pseudo-embedding approach with chat completion
    // In production, you would use a proper embedding API
    
    const embedding = await this.generatePseudoEmbedding(text);
    
    // Cache the embedding
    if (this.queryCache.size >= this.maxCacheSize) {
      // Remove oldest entry (first key)
      const firstKey = this.queryCache.keys().next().value;
      if (firstKey) {
        this.queryCache.delete(firstKey);
      }
    }
    this.queryCache.set(cacheKey, embedding);

    return embedding;
  }

  // Private: Generate pseudo-embedding
  private async generatePseudoEmbedding(text: string): Promise<number[]> {
    // Use AI to get a semantic representation
    try {
      const response = await aiClient.chat([
        {
          role: 'system',
          content: 'You are a code semantic analyzer. Extract key concepts from code or queries.',
        },
        {
          role: 'user',
          content: `Extract 10 key semantic concepts from this text for code search. Return only a JSON array of single words: "${text}"`,
        },
      ], 'claude-3-haiku', { maxTokens: 100, temperature: 0.1 });

      // Parse the concepts and create a simple embedding
      const concepts = JSON.parse(response.content.match(/\[.*\]/)?.[0] || '[]') as string[];
      return this.textToEmbedding(concepts.join(' '));
    } catch {
      // Fallback to simple text-based embedding
      return this.textToEmbedding(text);
    }
  }

  // Private: Convert text to embedding vector
  private textToEmbedding(text: string): number[] {
    const dimension = 1536;
    const embedding: number[] = new Array(dimension).fill(0);

    // Simple hash-based embedding
    for (let i = 0; i < text.length; i++) {
      const charCode = text.charCodeAt(i);
      const pos = i % dimension;
      embedding[pos] += Math.sin(charCode * (i + 1)) + Math.cos(charCode * (i + 2));
    }

    // Add n-gram features
    const words = text.toLowerCase().split(/\s+/);
    for (const word of words) {
      const hash = this.simpleHash(word);
      for (let i = 0; i < Math.min(word.length, 10); i++) {
        const pos = (hash + i) % dimension;
        embedding[pos] += 1;
      }
    }

    // Normalize
    const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return embedding.map(val => val / (norm || 1));
  }

  // Private: Search for definitions
  private async searchDefinitions(
    understanding: QueryUnderstanding,
    query: SearchQuery,
    options: SearchOptions
  ): Promise<SemanticSearchResult[]> {
    const results: SemanticSearchResult[] = [];
    const { limit = 10 } = options;

    // Search by entity names
    for (const entity of understanding.entities) {
      const symbols = this.symbolIndex.search({
        query: entity,
        kinds: ['class', 'interface', 'function', 'type', 'enum'],
        limit,
      });

      for (const symbol of symbols) {
        results.push({
          id: symbol.id,
          type: 'symbol',
          content: symbol.content || symbol.name,
          score: symbol.name.toLowerCase() === entity.toLowerCase() ? 1.0 : 0.8,
          path: symbol.path,
          lineStart: symbol.line,
          lineEnd: symbol.endLine,
          language: symbol.language,
          symbol,
          highlights: [{ start: 0, end: symbol.name.length, type: 'symbol', text: symbol.name }],
        });
      }
    }

    // Also search by keywords if no entities found
    if (results.length === 0) {
      const symbols = this.symbolIndex.search({
        query: understanding.keywords.join(' '),
        kinds: ['class', 'interface', 'function', 'type'],
        limit,
      });

      for (const symbol of symbols) {
        results.push({
          id: symbol.id,
          type: 'symbol',
          content: symbol.content || symbol.name,
          score: 0.7,
          path: symbol.path,
          lineStart: symbol.line,
          lineEnd: symbol.endLine,
          language: symbol.language,
          symbol,
          highlights: [],
        });
      }
    }

    return results;
  }

  // Private: Search for usage
  private async searchUsage(
    understanding: QueryUnderstanding,
    _query: SearchQuery,
    options: SearchOptions
  ): Promise<SemanticSearchResult[]> {
    const results: SemanticSearchResult[] = [];
    const { limit = 20 } = options;

    for (const entity of understanding.entities) {
      const symbols = this.symbolIndex.searchByName(entity, { limit: 5 });

      for (const symbol of symbols) {
        // Get references to this symbol
        const refs = this.symbolIndex.getReferencesTo(symbol.id);

        for (const ref of refs) {
          results.push({
            id: `ref:${symbol.id}:${ref.path}:${ref.line}`,
            type: 'code',
            content: `Usage at ${ref.path}:${ref.line}`,
            score: 0.9,
            path: ref.path,
            lineStart: ref.line,
            lineEnd: ref.line,
            highlights: [{ start: 0, end: symbol.name.length, type: 'match', text: symbol.name }],
          });
        }

        // Also get symbols that reference this one
        const referencingSymbols = this.symbolIndex.getSymbolsThatReference(symbol.id);
        for (const refSymbol of referencingSymbols) {
          results.push({
            id: refSymbol.id,
            type: 'symbol',
            content: refSymbol.content || refSymbol.name,
            score: 0.8,
            path: refSymbol.path,
            lineStart: refSymbol.line,
            lineEnd: refSymbol.endLine,
            language: refSymbol.language,
            symbol: refSymbol,
            highlights: [],
          });
        }
      }
    }

    return results.slice(0, limit);
  }

  // Private: Search for similar code
  private async searchSimilar(
    embedding: number[],
    _query: SearchQuery,
    options: SearchOptions
  ): Promise<SemanticSearchResult[]> {
    const { limit = 10, minScore = 0.7 } = options;

    const vectorResults = await this.vectorStore.search(embedding, {
      limit: limit * 2,
      minScore,
    });

    return vectorResults.map(result => ({
      id: result.id,
      type: 'code' as const,
      content: result.content,
      score: result.score,
      path: result.metadata.path,
      lineStart: result.metadata.lineStart,
      lineEnd: result.metadata.lineEnd,
      language: result.metadata.language,
      highlights: [],
    }));
  }

  // Private: Search for related code
  private async searchRelated(
    understanding: QueryUnderstanding,
    _query: SearchQuery,
    options: SearchOptions
  ): Promise<SemanticSearchResult[]> {
    const results: SemanticSearchResult[] = [];
    const { limit = 15 } = options;

    for (const entity of understanding.entities) {
      const symbols = this.symbolIndex.searchByName(entity, { limit: 3 });

      for (const symbol of symbols) {
        // Get referenced symbols (dependencies)
        const referenced = this.symbolIndex.getSymbolsReferencedBy(symbol.id);
        for (const ref of referenced) {
          results.push({
            id: `related:${ref.id}`,
            type: 'symbol',
            content: ref.content || ref.name,
            score: 0.85,
            path: ref.path,
            lineStart: ref.line,
            lineEnd: ref.endLine,
            language: ref.language,
            symbol: ref,
            highlights: [],
          });
        }

        // Get symbols that reference this one (dependents)
        const dependents = this.symbolIndex.getSymbolsThatReference(symbol.id);
        for (const dep of dependents) {
          results.push({
            id: `dependent:${dep.id}`,
            type: 'symbol',
            content: dep.content || dep.name,
            score: 0.75,
            path: dep.path,
            lineStart: dep.line,
            lineEnd: dep.endLine,
            language: dep.language,
            symbol: dep,
            highlights: [],
          });
        }
      }
    }

    return results.slice(0, limit);
  }

  // Private: Hybrid search
  private async hybridSearch(
    embedding: number[],
    keywords: string[],
    options: SearchOptions & { semanticWeight: number; keywordWeight: number }
  ): Promise<SemanticSearchResult[]> {
    const vectorResults = await this.vectorStore.hybridSearch(embedding, keywords, {
      limit: options.limit || 10,
      minScore: options.minScore || 0.3,
      semanticWeight: options.semanticWeight,
      keywordWeight: options.keywordWeight,
    });

    return vectorResults.map(result => ({
      id: result.id,
      type: 'code' as const,
      content: result.content,
      score: result.score,
      path: result.metadata.path,
      lineStart: result.metadata.lineStart,
      lineEnd: result.metadata.lineEnd,
      language: result.metadata.language,
      highlights: [],
    }));
  }

  // Private: Pure semantic search
  private async semanticSearch(
    embedding: number[],
    options: SearchOptions
  ): Promise<SemanticSearchResult[]> {
    const vectorResults = await this.vectorStore.search(embedding, {
      limit: options.limit || 10,
      minScore: options.minScore || 0.3,
    });

    return vectorResults.map(result => ({
      id: result.id,
      type: 'code' as const,
      content: result.content,
      score: result.score,
      path: result.metadata.path,
      lineStart: result.metadata.lineStart,
      lineEnd: result.metadata.lineEnd,
      language: result.metadata.language,
      highlights: [],
    }));
  }

  // Private: Add surrounding context to results
  private async addContext(results: SemanticSearchResult[]): Promise<SemanticSearchResult[]> {
    const enriched: SemanticSearchResult[] = [];

    for (const result of results) {
      // Get surrounding symbols for context
      const symbols = this.symbolIndex.getSymbolsByPath(result.path);
      const nearbySymbols = symbols.filter(
        s => Math.abs(s.line - result.lineStart) <= 10
      );

      enriched.push({
        ...result,
        context: nearbySymbols.map(s => s.name).join(', '),
      });
    }

    return enriched;
  }

  // Private: Add AI explanations to results
  private async addExplanations(
    results: SemanticSearchResult[],
    query: SearchQuery
  ): Promise<SemanticSearchResult[]> {
    if (results.length === 0) return results;

    const enriched: SemanticSearchResult[] = [];

    for (const result of results.slice(0, 3)) {
      try {
        const response = await aiClient.chat([
          {
            role: 'system',
            content: 'Explain why this code result is relevant to the search query in one sentence.',
          },
          {
            role: 'user',
            content: `Query: "${query.text}"\n\nCode:\n${result.content.slice(0, 500)}`,
          },
        ], 'claude-3-haiku', { maxTokens: 100 });

        enriched.push({
          ...result,
          explanation: response.content,
        });
      } catch {
        enriched.push(result);
      }
    }

    // Add remaining results without explanation
    enriched.push(...results.slice(3));

    return enriched;
  }

  // Private: Extract keywords from text
  private extractKeywords(text: string): string[] {
    const stopWords = new Set([
      'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
      'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'to', 'of',
      'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through',
      'how', 'what', 'where', 'when', 'why', 'which', 'who', 'whom', 'this',
      'that', 'these', 'those', 'and', 'or', 'but', 'if', 'then', 'else',
      'find', 'search', 'show', 'get', 'me', 'all', 'some', 'any',
    ]);

    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word));
  }

  // Private: Extract symbols from code snippet
  private extractSymbolsFromCode(code: string, language?: string): string[] {
    const symbols: string[] = [];
    const patterns = [
      /\b([A-Z][a-zA-Z0-9_]*)\b/g, // Class names
      /\b([a-z_][a-zA-Z0-9_]*)\s*\(/g, // Function calls
      /import\s+\{([^}]+)\}/g, // Imports
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(code)) !== null) {
        const names = match[1]?.split(',').map(s => s.trim()) || [];
        for (const name of names) {
          if (name && !symbols.includes(name)) {
            symbols.push(name);
          }
        }
      }
    }

    return symbols;
  }

  // Private: Deduplicate results
  private deduplicateResults(results: SemanticSearchResult[]): SemanticSearchResult[] {
    const seen = new Set<string>();
    const deduped: SemanticSearchResult[] = [];

    for (const result of results) {
      const key = `${result.path}:${result.lineStart}:${result.lineEnd}`;
      if (!seen.has(key)) {
        seen.add(key);
        deduped.push(result);
      }
    }

    // Sort by score
    return deduped.sort((a, b) => b.score - a.score);
  }

  // Private: Boost results by context
  private boostByContext(results: SemanticSearchResult[], context: SearchContext): void {
    const recentPaths = new Set(context.recentFiles || []);
    const openPaths = new Set(context.openFiles || []);

    for (const result of results) {
      if (openPaths.has(result.path)) {
        result.score += 0.1;
      }
      if (recentPaths.has(result.path)) {
        result.score += 0.05;
      }
    }

    results.sort((a, b) => b.score - a.score);
  }

  // Private: Hash text
  private hashText(text: string): string {
    return this.simpleHash(text).toString(36);
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

  // Clear cache
  clearCache(): void {
    this.queryCache.clear();
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let searchEngineInstance: SemanticSearchEngine | null = null;

export function getSemanticSearchEngine(): SemanticSearchEngine {
  if (!searchEngineInstance) {
    searchEngineInstance = new SemanticSearchEngine();
  }
  return searchEngineInstance;
}

export function createSemanticSearchEngine(
  vectorStore?: VectorStore,
  symbolIndex?: SymbolIndex
): SemanticSearchEngine {
  return new SemanticSearchEngine(vectorStore, symbolIndex);
}
