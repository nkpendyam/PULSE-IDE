/**
 * Tree-sitter Language Grammars
 * 
 * Manages loading, caching, and switching between language grammars.
 * Supports on-demand loading for efficient memory usage.
 */

import Parser from 'web-tree-sitter';
import { SupportedLanguage, LANGUAGE_CONFIGS } from './tree-sitter-service';

// Grammar metadata
export interface GrammarInfo {
  language: SupportedLanguage;
  name: string;
  version: string;
  extensions: string[];
  wasmUrl: string;
  loaded: boolean;
  loadTime?: number;
}

// Grammar loader configuration
export interface GrammarLoaderConfig {
  baseUrl?: string;
  preload?: SupportedLanguage[];
  onProgress?: (loaded: number, total: number) => void;
  onError?: (language: SupportedLanguage, error: Error) => void;
}

// Language detection result
export interface LanguageDetectionResult {
  language: SupportedLanguage | null;
  confidence: number;
  alternatives: SupportedLanguage[];
}

// Grammar cache
interface GrammarCache {
  language: Parser.Language;
  loadedAt: number;
  accessCount: number;
  lastAccessed: number;
}

// Default grammar URLs (WASM files in public/grammars)
const DEFAULT_GRAMMAR_URLS: Partial<Record<SupportedLanguage, string>> = {
  typescript: '/grammars/tree-sitter-typescript.wasm',
  typescriptreact: '/grammars/tree-sitter-tsx.wasm',
  javascript: '/grammars/tree-sitter-javascript.wasm',
  javascriptreact: '/grammars/tree-sitter-jsx.wasm',
  python: '/grammars/tree-sitter-python.wasm',
  rust: '/grammars/tree-sitter-rust.wasm',
  go: '/grammars/tree-sitter-go.wasm',
  json: '/grammars/tree-sitter-json.wasm',
  html: '/grammars/tree-sitter-html.wasm',
  css: '/grammars/tree-sitter-css.wasm',
  yaml: '/grammars/tree-sitter-yaml.wasm',
  markdown: '/grammars/tree-sitter-markdown.wasm',
};

// Shebang mappings
const SHEBANG_MAPPINGS: Record<string, SupportedLanguage> = {
  'node': 'javascript',
  'nodejs': 'javascript',
  'deno': 'typescript',
  'bun': 'typescript',
  'python': 'python',
  'python3': 'python',
  'python2': 'python',
  'bash': 'javascript', // Often bash scripts use .sh but could be shell scripts
  'sh': 'javascript',
  'rust': 'rust',
  'cargo': 'rust',
  'go': 'go',
};

// File extension to language mappings (comprehensive)
const EXTENSION_MAPPINGS: Record<string, SupportedLanguage> = {
  // TypeScript
  '.ts': 'typescript',
  '.tsx': 'typescriptreact',
  '.mts': 'typescript',
  '.cts': 'typescript',
  
  // JavaScript
  '.js': 'javascript',
  '.jsx': 'javascriptreact',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  
  // Python
  '.py': 'python',
  '.pyw': 'python',
  '.pyi': 'python',
  '.pyx': 'python',
  
  // Rust
  '.rs': 'rust',
  
  // Go
  '.go': 'go',
  
  // JSON
  '.json': 'json',
  '.jsonc': 'json',
  '.json5': 'json',
  
  // HTML
  '.html': 'html',
  '.htm': 'html',
  '.xhtml': 'html',
  
  // CSS
  '.css': 'css',
  '.scss': 'css',
  '.less': 'css',
  '.sass': 'css',
  
  // YAML
  '.yaml': 'yaml',
  '.yml': 'yaml',
  
  // Markdown
  '.md': 'markdown',
  '.markdown': 'markdown',
  '.mdown': 'markdown',
  '.mkd': 'markdown',
};

// Filename patterns for language detection
const FILENAME_PATTERNS: Array<{
  pattern: RegExp;
  language: SupportedLanguage;
}> = [
  { pattern: /^tsconfig\.json$/i, language: 'json' },
  { pattern: /^package\.json$/i, language: 'json' },
  { pattern: /^package-lock\.json$/i, language: 'json' },
  { pattern: /^\.eslintrc$/i, language: 'json' },
  { pattern: /\.config\.js$/i, language: 'javascript' },
  { pattern: /\.config\.ts$/i, language: 'typescript' },
  { pattern: /^Dockerfile$/i, language: 'javascript' },
  { pattern: /^Makefile$/i, language: 'javascript' },
];

/**
 * Grammar Manager
 * Handles loading and caching of Tree-sitter language grammars
 */
export class GrammarManager {
  private cache: Map<SupportedLanguage, GrammarCache> = new Map();
  private loading: Map<SupportedLanguage, Promise<Parser.Language>> = new Map();
  private config: GrammarLoaderConfig;
  private maxCacheSize: number = 10;
  private initialized: boolean = false;

  constructor(config: GrammarLoaderConfig = {}) {
    this.config = {
      baseUrl: '/grammars',
      ...config,
    };
  }

  /**
   * Initialize the grammar manager
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Preload specified languages
    if (this.config.preload && this.config.preload.length > 0) {
      await this.loadGrammars(this.config.preload);
    }

    this.initialized = true;
  }

  /**
   * Load a single grammar
   */
  async loadGrammar(language: SupportedLanguage): Promise<Parser.Language> {
    // Check cache
    const cached = this.cache.get(language);
    if (cached) {
      cached.accessCount++;
      cached.lastAccessed = Date.now();
      return cached.language;
    }

    // Check if already loading
    const loading = this.loading.get(language);
    if (loading) {
      return loading;
    }

    // Start loading
    const loadPromise = this.doLoadGrammar(language);
    this.loading.set(language, loadPromise);

    try {
      const loaded = await loadPromise;
      return loaded;
    } finally {
      this.loading.delete(language);
    }
  }

  /**
   * Actually load the grammar
   */
  private async doLoadGrammar(language: SupportedLanguage): Promise<Parser.Language> {
    const startTime = performance.now();
    const url = this.getGrammarUrl(language);

    try {
      const lang = await Parser.Language.load(url);
      
      // Cache the loaded grammar
      this.addToCache(language, lang);
      
      const loadTime = performance.now() - startTime;
      console.log(`Loaded ${language} grammar in ${loadTime.toFixed(2)}ms`);

      return lang;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.config.onError?.(language, err);
      throw new Error(`Failed to load ${language} grammar: ${err.message}`);
    }
  }

  /**
   * Load multiple grammars
   */
  async loadGrammars(languages: SupportedLanguage[]): Promise<Map<SupportedLanguage, Parser.Language>> {
    const results = new Map<SupportedLanguage, Parser.Language>();
    const total = languages.length;
    let loaded = 0;

    for (const language of languages) {
      try {
        const lang = await this.loadGrammar(language);
        results.set(language, lang);
        loaded++;
        this.config.onProgress?.(loaded, total);
      } catch (error) {
        console.warn(`Failed to load ${language}:`, error);
      }
    }

    return results;
  }

  /**
   * Unload a grammar from cache
   */
  unloadGrammar(language: SupportedLanguage): boolean {
    return this.cache.delete(language);
  }

  /**
   * Get grammar info
   */
  getGrammarInfo(language: SupportedLanguage): GrammarInfo | null {
    const config = LANGUAGE_CONFIGS[language];
    if (!config) return null;

    const cached = this.cache.get(language);

    return {
      language,
      name: config.name,
      version: '0.1.0', // Would be fetched from grammar metadata
      extensions: config.extensions,
      wasmUrl: this.getGrammarUrl(language),
      loaded: !!cached,
      loadTime: cached?.loadedAt,
    };
  }

  /**
   * Get all loaded grammars
   */
  getLoadedGrammars(): GrammarInfo[] {
    return Array.from(this.cache.keys()).map(lang => this.getGrammarInfo(lang)!);
  }

  /**
   * Get available grammars
   */
  getAvailableGrammars(): GrammarInfo[] {
    return Object.keys(LANGUAGE_CONFIGS).map(lang => 
      this.getGrammarInfo(lang as SupportedLanguage)!
    );
  }

  /**
   * Detect language from file path
   */
  detectLanguageFromPath(filePath: string): LanguageDetectionResult {
    const alternatives: SupportedLanguage[] = [];
    
    // Check filename patterns first
    const filename = filePath.split('/').pop() || '';
    for (const { pattern, language } of FILENAME_PATTERNS) {
      if (pattern.test(filename)) {
        return {
          language,
          confidence: 1.0,
          alternatives: [],
        };
      }
    }

    // Check extension
    const ext = '.' + filename.split('.').pop()?.toLowerCase();
    const language = EXTENSION_MAPPINGS[ext];
    
    if (language) {
      // Find alternatives (e.g., .ts could also be TypeScript)
      for (const [extension, lang] of Object.entries(EXTENSION_MAPPINGS)) {
        if (extension === ext && lang !== language) {
          alternatives.push(lang);
        }
      }

      return {
        language,
        confidence: 0.9,
        alternatives,
      };
    }

    // Unknown extension
    return {
      language: null,
      confidence: 0,
      alternatives,
    };
  }

  /**
   * Detect language from content
   */
  detectLanguageFromContent(content: string): LanguageDetectionResult {
    const alternatives: SupportedLanguage[] = [];

    // Check shebang
    const firstLine = content.split('\n')[0];
    if (firstLine.startsWith('#!')) {
      const interpreter = firstLine.slice(2).trim().split('/').pop()?.split(' ')[0];
      if (interpreter && SHEBANG_MAPPINGS[interpreter]) {
        return {
          language: SHEBANG_MAPPINGS[interpreter],
          confidence: 0.95,
          alternatives: [],
        };
      }
    }

    // Check for TypeScript-specific syntax
    if (content.includes(': ') && /[a-zA-Z]+\s*:\s*[A-Z][a-zA-Z<>[\],\s]*/.test(content)) {
      alternatives.push('typescript');
      
      // Check for JSX
      if (/<[A-Z][a-zA-Z]*/.test(content)) {
        return {
          language: 'typescriptreact',
          confidence: 0.85,
          alternatives: ['typescript', 'javascript', 'javascriptreact'],
        };
      }

      return {
        language: 'typescript',
        confidence: 0.8,
        alternatives: ['javascript'],
      };
    }

    // Check for JSX
    if (/<[A-Z][a-zA-Z]*/.test(content) || /<[a-z]+[^>]*>/.test(content)) {
      if (content.includes('interface ') || content.includes(': ')) {
        return {
          language: 'typescriptreact',
          confidence: 0.75,
          alternatives: ['javascriptreact', 'typescript', 'javascript'],
        };
      }
      return {
        language: 'javascriptreact',
        confidence: 0.75,
        alternatives: ['javascript', 'typescriptreact', 'typescript'],
      };
    }

    // Check for Python
    if (/^def\s+\w+\s*\(/m.test(content) || /^class\s+\w+(\s*\(|\s*:)/m.test(content)) {
      return {
        language: 'python',
        confidence: 0.85,
        alternatives: [],
      };
    }

    // Check for Rust
    if (/^fn\s+\w+\s*[<(]/m.test(content) || /^struct\s+\w+/m.test(content)) {
      return {
        language: 'rust',
        confidence: 0.85,
        alternatives: [],
      };
    }

    // Check for Go
    if (/^func\s+(\([a-zA-Z]+\s+\*?[a-zA-Z]+\)\s+)?[a-zA-Z]+/m.test(content)) {
      return {
        language: 'go',
        confidence: 0.85,
        alternatives: [],
      };
    }

    // Check for JSON
    if (/^\s*[\[{]/m.test(content) && /"[\w_]+"\s*:/m.test(content)) {
      return {
        language: 'json',
        confidence: 0.8,
        alternatives: [],
      };
    }

    // Check for HTML
    if (/<(!DOCTYPE|html|head|body|div|span|p|a|script|style)/i.test(content)) {
      return {
        language: 'html',
        confidence: 0.8,
        alternatives: [],
      };
    }

    // Check for CSS
    if (/[.#]?[\w-]+\s*\{[\s\S]*\}/m.test(content) || /@media|@keyframes|@import/m.test(content)) {
      return {
        language: 'css',
        confidence: 0.8,
        alternatives: [],
      };
    }

    // Check for YAML
    if (/^[\w-]+:\s*[\w-]+$/m.test(content) && !/^[{}\[\]]/.test(content)) {
      return {
        language: 'yaml',
        confidence: 0.7,
        alternatives: [],
      };
    }

    // Check for Markdown
    if (/^#{1,6}\s+.+$/m.test(content) || /^\*\*[^*]+\*\*|^_[^_]+_/m.test(content)) {
      return {
        language: 'markdown',
        confidence: 0.8,
        alternatives: [],
      };
    }

    // Default to JavaScript
    return {
      language: 'javascript',
      confidence: 0.3,
      alternatives: ['typescript', 'python', 'go', 'rust'],
    };
  }

  /**
   * Detect language from both path and content
   */
  detectLanguage(filePath: string, content?: string): LanguageDetectionResult {
    // First try path-based detection
    const pathResult = this.detectLanguageFromPath(filePath);
    
    if (pathResult.confidence >= 0.9) {
      return pathResult;
    }

    // If we have content, try content-based detection
    if (content) {
      const contentResult = this.detectLanguageFromContent(content);
      
      // If path gave no result, use content result
      if (!pathResult.language) {
        return contentResult;
      }

      // If both have results and they match, increase confidence
      if (pathResult.language === contentResult.language) {
        return {
          language: pathResult.language,
          confidence: Math.min(pathResult.confidence + contentResult.confidence, 1.0),
          alternatives: [...new Set([...pathResult.alternatives, ...contentResult.alternatives])],
        };
      }

      // Conflict - prefer path-based if high confidence
      if (pathResult.confidence > contentResult.confidence) {
        return pathResult;
      }

      return contentResult;
    }

    return pathResult;
  }

  /**
   * Get grammar URL
   */
  private getGrammarUrl(language: SupportedLanguage): string {
    return DEFAULT_GRAMMAR_URLS[language] || 
           `${this.config.baseUrl}/tree-sitter-${language}.wasm`;
  }

  /**
   * Add grammar to cache with LRU eviction
   */
  private addToCache(language: SupportedLanguage, lang: Parser.Language): void {
    // Check if we need to evict
    if (this.cache.size >= this.maxCacheSize) {
      this.evictLRU();
    }

    this.cache.set(language, {
      language: lang,
      loadedAt: Date.now(),
      accessCount: 1,
      lastAccessed: Date.now(),
    });
  }

  /**
   * Evict least recently used grammar
   */
  private evictLRU(): void {
    let lruLanguage: SupportedLanguage | null = null;
    let lruTime = Infinity;

    for (const [lang, cache] of this.cache) {
      if (cache.lastAccessed < lruTime) {
        lruTime = cache.lastAccessed;
        lruLanguage = lang;
      }
    }

    if (lruLanguage) {
      this.cache.delete(lruLanguage);
      console.log(`Evicted ${lruLanguage} grammar from cache`);
    }
  }

  /**
   * Set max cache size
   */
  setMaxCacheSize(size: number): void {
    this.maxCacheSize = size;
    
    // Evict if needed
    while (this.cache.size > this.maxCacheSize) {
      this.evictLRU();
    }
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Check if a language is loaded
   */
  isLoaded(language: SupportedLanguage): boolean {
    return this.cache.has(language);
  }

  /**
   * Check if a language is currently loading
   */
  isLoading(language: SupportedLanguage): boolean {
    return this.loading.has(language);
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    maxSize: number;
    languages: Array<{ language: SupportedLanguage; accessCount: number; lastAccessed: number }>;
  } {
    return {
      size: this.cache.size,
      maxSize: this.maxCacheSize,
      languages: Array.from(this.cache.entries()).map(([language, cache]) => ({
        language,
        accessCount: cache.accessCount,
        lastAccessed: cache.lastAccessed,
      })),
    };
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.clearCache();
    this.loading.clear();
    this.initialized = false;
  }
}

// Singleton instance
let grammarManagerInstance: GrammarManager | null = null;

/**
 * Get the global grammar manager instance
 */
export function getGrammarManager(config?: GrammarLoaderConfig): GrammarManager {
  if (!grammarManagerInstance) {
    grammarManagerInstance = new GrammarManager(config);
  }
  return grammarManagerInstance;
}

/**
 * Reset the grammar manager instance
 */
export function resetGrammarManager(): void {
  if (grammarManagerInstance) {
    grammarManagerInstance.dispose();
    grammarManagerInstance = null;
  }
}

/**
 * Get the appropriate language for nested content
 * (e.g., JavaScript inside HTML script tags, CSS inside style tags)
 */
export function getNestedLanguage(
  parentNodeType: string,
  nodeType: string
): SupportedLanguage | null {
  const nestedMappings: Record<string, Record<string, SupportedLanguage>> = {
    'script_element': {
      'raw_text': 'javascript',
    },
    'style_element': {
      'raw_text': 'css',
    },
    'template_literal': {
      'template_string': 'javascript',
    },
    'jsx_expression': {
      'jsx_child': 'javascript',
    },
  };

  return nestedMappings[parentNodeType]?.[nodeType] || null;
}

/**
 * Register custom grammar URL
 */
export function registerGrammarUrl(language: SupportedLanguage, url: string): void {
  DEFAULT_GRAMMAR_URLS[language] = url;
}

export default GrammarManager;
