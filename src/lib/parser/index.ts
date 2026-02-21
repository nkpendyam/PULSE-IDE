/**
 * Tree-sitter Parser Module
 * 
 * Provides code intelligence, syntax highlighting, and parsing capabilities
 * using Tree-sitter with WebAssembly support.
 * 
 * @module parser
 */

// Core parser service
export {
  TreeSitterService,
  getTreeSitterService,
  resetTreeSitterService,
  LANGUAGE_CONFIGS,
  type SupportedLanguage,
  type LanguageConfig,
  type ParseResult,
  type QueryResult,
  type QueryMatch,
  type QueryCapture,
  type NodeInfo,
} from './tree-sitter-service';

// Syntax highlighting
export {
  SyntaxHighlighter,
  getSyntaxHighlighter,
  resetSyntaxHighlighter,
  DEFAULT_HIGHLIGHT_CAPTURES,
  HIGHLIGHT_QUERIES,
  type HighlightCaptureMapping,
  type MonacoToken,
  type MonacoLineTokens,
  type HighlightResult,
} from './syntax-highlighter';

// Code intelligence
export {
  CodeIntelligence,
  getCodeIntelligence,
  resetCodeIntelligence,
  SYMBOL_TYPE_MAPPINGS,
  DEFINITION_QUERIES,
  REFERENCE_QUERIES,
  type SymbolKind,
  type SymbolInfo,
  type Location,
  type DefinitionResult,
  type ReferenceResult,
  type ScopeInfo,
  type BracketPair,
} from './code-intelligence';

// Grammar management
export {
  GrammarManager,
  getGrammarManager,
  resetGrammarManager,
  getNestedLanguage,
  registerGrammarUrl,
  DEFAULT_GRAMMAR_URLS,
  EXTENSION_MAPPINGS,
  SHEBANG_MAPPINGS,
  type GrammarInfo,
  type GrammarLoaderConfig,
  type LanguageDetectionResult,
} from './grammars';

// Re-export web-tree-sitter types for convenience
export type {
  Tree,
  SyntaxNode,
  Point,
  Range,
  Edit,
  TreeCursor,
} from 'web-tree-sitter';

/**
 * Initialize all parser services
 * Call this once at application startup
 */
export async function initializeParserServices(options?: {
  wasmPath?: string;
  preloadLanguages?: ('typescript' | 'javascript' | 'python' | 'rust' | 'go' | 'json' | 'html' | 'css')[];
}): Promise<void> {
  const { wasmPath, preloadLanguages } = options || {};

  // Initialize Tree-sitter service
  const service = getTreeSitterService(wasmPath);
  await service.initialize();

  // Initialize grammar manager with preloaded languages
  const grammarManager = getGrammarManager();
  
  if (preloadLanguages && preloadLanguages.length > 0) {
    await grammarManager.loadGrammars(preloadLanguages);
  }

  // Initialize syntax highlighter
  getSyntaxHighlighter(service);

  // Initialize code intelligence
  getCodeIntelligence(service);
}

/**
 * Dispose all parser services
 * Call this when the application is shutting down
 */
export function disposeParserServices(): void {
  resetTreeSitterService();
  resetSyntaxHighlighter();
  resetCodeIntelligence();
  resetGrammarManager();
}

/**
 * Parse and analyze a file
 * Convenience function for common parsing operations
 */
export async function parseFile(
  filePath: string,
  source: string,
  options?: {
    language?: 'typescript' | 'javascript' | 'python' | 'rust' | 'go' | 'json' | 'html' | 'css';
    extractSymbols?: boolean;
    highlight?: boolean;
  }
): Promise<{
  tree: import('web-tree-sitter').Tree;
  language: 'typescript' | 'javascript' | 'python' | 'rust' | 'go' | 'json' | 'html' | 'css' | null;
  symbols?: import('./code-intelligence').SymbolInfo[];
  tokens?: import('./syntax-highlighter').HighlightResult;
}> {
  const service = getTreeSitterService();
  const grammarManager = getGrammarManager();
  
  // Detect language if not specified
  const detection = grammarManager.detectLanguage(filePath, source);
  const language = options?.language || detection.language;
  
  if (!language) {
    throw new Error(`Could not detect language for ${filePath}`);
  }

  // Parse the file
  const result = await service.parse(source, language, filePath);

  const output: {
    tree: import('web-tree-sitter').Tree;
    language: 'typescript' | 'javascript' | 'python' | 'rust' | 'go' | 'json' | 'html' | 'css' | null;
    symbols?: import('./code-intelligence').SymbolInfo[];
    tokens?: import('./syntax-highlighter').HighlightResult;
  } = {
    tree: result.tree,
    language,
  };

  // Extract symbols if requested
  if (options?.extractSymbols) {
    const intelligence = getCodeIntelligence(service);
    output.symbols = await intelligence.extractSymbols(result.tree, source, language);
  }

  // Highlight if requested
  if (options?.highlight) {
    const highlighter = getSyntaxHighlighter(service);
    output.tokens = await highlighter.highlightTree(result.tree, source, language);
  }

  return output;
}

// Default export
const parserModule = {
  initializeParserServices,
  disposeParserServices,
  parseFile,
};

export default parserModule;
