/**
 * Tree-sitter Parser Service
 * 
 * Provides core parsing capabilities using Tree-sitter with WebAssembly support.
 * Supports incremental parsing, multiple languages, and AST queries.
 */

import Parser, { Tree, SyntaxNode, Point, Range, Edit } from 'web-tree-sitter';

// Supported languages
export type SupportedLanguage =
  | 'typescript'
  | 'typescriptreact'
  | 'javascript'
  | 'javascriptreact'
  | 'python'
  | 'rust'
  | 'go'
  | 'json'
  | 'html'
  | 'css'
  | 'yaml'
  | 'markdown';

// Language configuration
export interface LanguageConfig {
  name: string;
  extensions: string[];
  grammarPackage: string;
  aliases: string[];
}

// Parse result with metadata
export interface ParseResult {
  tree: Tree;
  language: SupportedLanguage;
  source: string;
  parseTime: number;
  isIncremental: boolean;
}

// Query result
export interface QueryResult {
  matches: QueryMatch[];
  captures: QueryCapture[];
}

export interface QueryMatch {
  pattern: number;
  captures: QueryCapture[];
}

export interface QueryCapture {
  name: string;
  node: SyntaxNode;
}

// Tree-sitter node wrapper with utility methods
export interface NodeInfo {
  type: string;
  text: string;
  startPosition: Point;
  endPosition: Point;
  childCount: number;
  children: NodeInfo[];
  isNamed: boolean;
  isError: boolean;
  isMissing: boolean;
  hasError: boolean;
}

// Language configurations mapping
export const LANGUAGE_CONFIGS: Record<SupportedLanguage, LanguageConfig> = {
  typescript: {
    name: 'TypeScript',
    extensions: ['.ts'],
    grammarPackage: 'tree-sitter-typescript',
    aliases: ['ts'],
  },
  typescriptreact: {
    name: 'TypeScript React',
    extensions: ['.tsx'],
    grammarPackage: 'tree-sitter-tsx',
    aliases: ['tsx'],
  },
  javascript: {
    name: 'JavaScript',
    extensions: ['.js', '.cjs', '.mjs'],
    grammarPackage: 'tree-sitter-javascript',
    aliases: ['js', 'cjs', 'mjs'],
  },
  javascriptreact: {
    name: 'JavaScript React',
    extensions: ['.jsx'],
    grammarPackage: 'tree-sitter-jsx',
    aliases: ['jsx'],
  },
  python: {
    name: 'Python',
    extensions: ['.py', '.pyw'],
    grammarPackage: 'tree-sitter-python',
    aliases: ['py', 'pyw'],
  },
  rust: {
    name: 'Rust',
    extensions: ['.rs'],
    grammarPackage: 'tree-sitter-rust',
    aliases: ['rs'],
  },
  go: {
    name: 'Go',
    extensions: ['.go'],
    grammarPackage: 'tree-sitter-go',
    aliases: ['go'],
  },
  json: {
    name: 'JSON',
    extensions: ['.json', '.jsonc'],
    grammarPackage: 'tree-sitter-json',
    aliases: ['json', 'jsonc'],
  },
  html: {
    name: 'HTML',
    extensions: ['.html', '.htm'],
    grammarPackage: 'tree-sitter-html',
    aliases: ['html', 'htm'],
  },
  css: {
    name: 'CSS',
    extensions: ['.css', '.scss', '.less'],
    grammarPackage: 'tree-sitter-css',
    aliases: ['css', 'scss', 'less'],
  },
  yaml: {
    name: 'YAML',
    extensions: ['.yaml', '.yml'],
    grammarPackage: 'tree-sitter-yaml',
    aliases: ['yaml', 'yml'],
  },
  markdown: {
    name: 'Markdown',
    extensions: ['.md', '.markdown'],
    grammarPackage: 'tree-sitter-markdown',
    aliases: ['md', 'markdown'],
  },
};

/**
 * Tree-sitter Parser Service
 * Manages parser instances, language grammars, and provides parsing capabilities
 */
export class TreeSitterService {
  private parser: Parser | null = null;
  private languages: Map<SupportedLanguage, Parser.Language> = new Map();
  private treeCache: Map<string, Tree> = new Map();
  private initialized = false;
  private initPromise: Promise<void> | null = null;
  private wasmPath: string | undefined;

  constructor(wasmPath?: string) {
    this.wasmPath = wasmPath;
  }

  /**
   * Initialize the Tree-sitter parser with WebAssembly
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this.doInitialize();
    await this.initPromise;
    this.initPromise = null;
  }

  private async doInitialize(): Promise<void> {
    try {
      // Set WebAssembly path for browser/Tauri environment
      if (this.wasmPath) {
        Parser.init({
          locateFile() {
            return '/tree-sitter.wasm';
          },
        });
      } else {
        // Default initialization - WASM file should be in public directory
        Parser.init({
          locateFile(file: string) {
            if (typeof window !== 'undefined') {
              // Browser environment - WASM in public folder
              return `/${file}`;
            }
            // Node/Tauri environment
            return file;
          },
        });
      }

      this.parser = new Parser();
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize Tree-sitter:', error);
      throw new Error(`Tree-sitter initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Load a language grammar
   */
  async loadLanguage(language: SupportedLanguage): Promise<Parser.Language> {
    await this.initialize();

    // Check cache
    const cached = this.languages.get(language);
    if (cached) return cached;

    // Load language grammar
    const langConfig = LANGUAGE_CONFIGS[language];
    if (!langConfig) {
      throw new Error(`Unsupported language: ${language}`);
    }

    try {
      // In browser environment, we need to load WASM grammars differently
      // This would typically be done via dynamic imports or pre-loaded WASM
      const lang = await this.loadLanguageWasm(language);
      this.languages.set(language, lang);
      return lang;
    } catch (error) {
      console.error(`Failed to load language ${language}:`, error);
      throw new Error(`Failed to load ${language} grammar: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Load language WASM grammar
   * This is a placeholder that would be implemented with actual grammar loading
   */
  private async loadLanguageWasm(language: SupportedLanguage): Promise<Parser.Language> {
    // In a real implementation, this would load the WASM grammar files
    // For now, we use a simplified approach that works with pre-loaded grammars
    
    const grammarUrls: Partial<Record<SupportedLanguage, string>> = {
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

    const url = grammarUrls[language];
    if (!url) {
      throw new Error(`No grammar URL for language: ${language}`);
    }

    try {
      const lang = await Parser.Language.load(url);
      return lang;
    } catch (loadError) {
      console.warn(`Failed to load grammar from ${url}:`, loadError);
      throw loadError;
    }
  }

  /**
   * Parse source code
   */
  async parse(
    source: string,
    language: SupportedLanguage,
    filePath?: string,
    oldTree?: Tree
  ): Promise<ParseResult> {
    await this.initialize();

    const lang = await this.loadLanguage(language);
    if (!this.parser) {
      throw new Error('Parser not initialized');
    }

    this.parser.setLanguage(lang);
    
    const startTime = performance.now();
    const isIncremental = oldTree !== undefined;

    let tree: Tree;
    if (oldTree) {
      // Incremental parsing with old tree
      tree = this.parser.parse(source, oldTree);
    } else {
      tree = this.parser.parse(source);
    }

    const parseTime = performance.now() - startTime;

    // Cache tree for incremental parsing
    if (filePath) {
      this.treeCache.set(filePath, tree);
    }

    return {
      tree,
      language,
      source,
      parseTime,
      isIncremental,
    };
  }

  /**
   * Parse with incremental updates
   */
  async parseIncremental(
    source: string,
    language: SupportedLanguage,
    filePath: string,
    editStart: number,
    oldEndPosition: number,
    newEndPosition: number
  ): Promise<ParseResult> {
    await this.initialize();

    const oldTree = this.treeCache.get(filePath);
    if (!oldTree) {
      return this.parse(source, language, filePath);
    }

    // Create edit object for incremental parsing
    const edit: Edit = {
      startIndex: editStart,
      oldEndIndex: oldEndPosition,
      newEndIndex: newEndPosition,
      startPosition: { row: 0, column: editStart },
      oldEndPosition: { row: 0, column: oldEndPosition },
      newEndPosition: { row: 0, column: newEndPosition },
    };

    // Apply edit to old tree
    oldTree.edit(edit);

    return this.parse(source, language, filePath, oldTree);
  }

  /**
   * Get cached tree for a file
   */
  getCachedTree(filePath: string): Tree | undefined {
    return this.treeCache.get(filePath);
  }

  /**
   * Clear tree cache
   */
  clearCache(filePath?: string): void {
    if (filePath) {
      this.treeCache.delete(filePath);
    } else {
      this.treeCache.clear();
    }
  }

  /**
   * Query the syntax tree
   */
  async query(
    tree: Tree,
    queryString: string,
    language: SupportedLanguage
  ): Promise<QueryResult> {
    const lang = await this.loadLanguage(language);
    const query = lang.query(queryString);

    const matches = query.matches(tree.rootNode);
    const captures = query.captures(tree.rootNode);

    return {
      matches: matches.map((match) => ({
        pattern: match.pattern,
        captures: match.captures.map((cap) => ({
          name: cap.name,
          node: cap.node,
        })),
      })),
      captures: captures.map((cap) => ({
        name: cap.name,
        node: cap.node,
      })),
    };
  }

  /**
   * Get node at position
   */
  getNodeAtPosition(tree: Tree, row: number, column: number): SyntaxNode | null {
    return tree.rootNode.descendantForPosition({ row, column });
  }

  /**
   * Get node info for serialization
   */
  getNodeInfo(node: SyntaxNode, source: string): NodeInfo {
    return {
      type: node.type,
      text: node.text,
      startPosition: node.startPosition,
      endPosition: node.endPosition,
      childCount: node.childCount,
      children: node.children.map((child) => this.getNodeInfo(child, source)),
      isNamed: node.isNamed(),
      isError: node.isError(),
      isMissing: node.isMissing(),
      hasError: node.hasError(),
    };
  }

  /**
   * Walk the tree and yield nodes
   */
  *walkTree(tree: Tree): Generator<SyntaxNode> {
    const cursor = tree.walk();
    let visitedChildren = false;

    while (true) {
      if (!visitedChildren) {
        yield cursor.currentNode;
        if (cursor.gotoFirstChild()) {
          visitedChildren = false;
        } else {
          visitedChildren = true;
        }
      } else if (cursor.gotoNextSibling()) {
        visitedChildren = false;
      } else if (cursor.gotoParent()) {
        visitedChildren = true;
      } else {
        break;
      }
    }
  }

  /**
   * Get the smallest node containing a range
   */
  getNodeForRange(tree: Tree, startRow: number, startColumn: number, endRow: number, endColumn: number): SyntaxNode | null {
    const range: Range = {
      startPosition: { row: startRow, column: startColumn },
      endPosition: { row: endRow, column: endColumn },
      startIndex: 0,
      endIndex: 0,
    };
    
    return tree.rootNode.descendantForPositionRange(
      range.startPosition,
      range.endPosition
    );
  }

  /**
   * Detect language from file extension
   */
  detectLanguage(filePath: string): SupportedLanguage | null {
    const ext = '.' + filePath.split('.').pop()?.toLowerCase();
    
    for (const [lang, config] of Object.entries(LANGUAGE_CONFIGS)) {
      if (config.extensions.includes(ext)) {
        return lang as SupportedLanguage;
      }
    }
    
    return null;
  }

  /**
   * Check if a language is loaded
   */
  isLanguageLoaded(language: SupportedLanguage): boolean {
    return this.languages.has(language);
  }

  /**
   * Get all loaded languages
   */
  getLoadedLanguages(): SupportedLanguage[] {
    return Array.from(this.languages.keys());
  }

  /**
   * Check if service is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.treeCache.clear();
    this.languages.clear();
    if (this.parser) {
      this.parser = null;
    }
    this.initialized = false;
  }
}

// Singleton instance
let instance: TreeSitterService | null = null;

/**
 * Get the global Tree-sitter service instance
 */
export function getTreeSitterService(wasmPath?: string): TreeSitterService {
  if (!instance) {
    instance = new TreeSitterService(wasmPath);
  }
  return instance;
}

/**
 * Reset the global instance (useful for testing)
 */
export function resetTreeSitterService(): void {
  if (instance) {
    instance.dispose();
    instance = null;
  }
}

export default TreeSitterService;
