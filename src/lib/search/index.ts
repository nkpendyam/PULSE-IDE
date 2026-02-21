/**
 * Search Module - Advanced Search Features for Kyro IDE
 * 
 * Export all search engine functionality for use across the IDE.
 */

export {
  // Classes
  SearchEngine,
  searchEngine,
  
  // Types
  type SearchMatch,
  type SearchResult,
  type FileSearchResult,
  type SearchOptions,
  type ReplaceOptions,
  type ReplaceResult,
  type SymbolInfo,
  type SearchHistoryItem,
  type FileContent,
  
  // Enums
  SymbolKind,
  
  // Helper functions
  getFileExtension,
  getLanguageFromExtension,
  getSymbolKindName,
  getSymbolKindIcon,
} from './search-engine';
