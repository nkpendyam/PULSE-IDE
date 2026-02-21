/**
 * Kyro IDE - Snippets Module
 * 
 * Export all snippet-related functionality
 */

export {
  SnippetManager,
  SnippetParser,
  snippetManager,
  // Types
  type Snippet,
  type SnippetVariable,
  type VariableTransformation,
  type TabStop,
  type Position,
  type ParsedSnippet,
  type SnippetContext,
  type SnippetCompletion,
  type SnippetSession,
  type SnippetInsertionResult,
} from './snippet-manager';
