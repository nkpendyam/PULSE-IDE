/**
 * Kyro IDE - Codebase Indexing System
 * Semantic search with AI-powered embeddings
 */

// Vector Store - IndexedDB-backed vector database
export {
  VectorStore,
  getVectorStore,
  createVectorStore,
  type VectorDocument,
  type VectorMetadata,
  type VectorSearchResult,
  type VectorStoreStats,
  type VectorStoreConfig,
} from './vector-store';

// Symbol Index - Fast symbol lookup and tracking
export {
  SymbolIndex,
  SymbolExtractor,
  getSymbolIndex,
  getSymbolExtractor,
  type SymbolKind,
  type SymbolInfo,
  type ParameterInfo,
  type SymbolReference,
  type SymbolSearchOptions,
  type SymbolIndexStats,
} from './symbol-index';

// Semantic Search - AI-powered search engine
export {
  SemanticSearchEngine,
  getSemanticSearchEngine,
  createSemanticSearchEngine,
  type SearchQuery,
  type SearchFilters,
  type SemanticSearchResult,
  type SearchHighlight,
  type SearchOptions,
  type CodeExampleSearch,
  type SearchContext,
  type QueryUnderstanding,
} from './semantic-search';

// Code Indexer - File indexing with embeddings
export {
  CodeIndexer,
  getCodeIndexer,
  createCodeIndexer,
  type CodeChunk,
  type IndexResult,
  type IndexingProgress,
  type IndexingOptions,
  type FileIndexInfo,
  type IndexStats,
} from './code-indexer';
