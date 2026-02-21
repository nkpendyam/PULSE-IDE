/**
 * Tree-sitter Syntax Highlighter
 * 
 * Converts Tree-sitter syntax highlighting captures to Monaco editor tokens.
 * Supports custom theme mappings and nested language handling.
 */

import type { Tree, SyntaxNode } from 'web-tree-sitter';
import { TreeSitterService, SupportedLanguage, LANGUAGE_CONFIGS } from './tree-sitter-service';

// Monaco types (minimal interface for tree-sitter integration)
export interface MonacoToken {
  startIndex: number;
  endIndex: number;
  scopes: string[];
}

export interface MonacoLineTokens {
  line: number;
  tokens: MonacoToken[];
}

export interface HighlightResult {
  tokens: MonacoLineTokens[];
  language: SupportedLanguage;
}

// Tree-sitter highlight capture names to Monaco scopes
export interface HighlightCaptureMapping {
  [captureName: string]: string[];
}

// Default capture mappings based on Tree-sitter highlight queries
const DEFAULT_HIGHLIGHT_CAPTURES: HighlightCaptureMapping = {
  // Comments
  'comment': ['comment'],
  'comment.line': ['comment.line'],
  'comment.block': ['comment.block'],
  'comment.documentation': ['comment.documentation'],
  
  // Keywords
  'keyword': ['keyword'],
  'keyword.control': ['keyword.control'],
  'keyword.control.conditional': ['keyword.control.conditional'],
  'keyword.control.import': ['keyword.control.import'],
  'keyword.control.repeat': ['keyword.control.repeat'],
  'keyword.control.return': ['keyword.control.return'],
  'keyword.control.exception': ['keyword.control.exception'],
  'keyword.operator': ['keyword.operator'],
  'keyword.other': ['keyword.other'],
  'keyword.function': ['keyword.function'],
  'keyword.storage': ['storage'],
  'keyword.storage.type': ['storage.type'],
  'keyword.storage.modifier': ['storage.modifier'],
  
  // Constants
  'constant': ['constant'],
  'constant.builtin': ['constant.language'],
  'constant.boolean': ['constant.language'],
  'constant.character': ['constant.character'],
  'constant.character.escape': ['constant.character.escape'],
  'constant.numeric': ['constant.numeric'],
  'constant.numeric.integer': ['constant.numeric'],
  'constant.numeric.float': ['constant.numeric'],
  'constant.null': ['constant.language'],
  'constant.other': ['constant.other'],
  
  // Strings
  'string': ['string'],
  'string.quoted': ['string'],
  'string.quoted.single': ['string'],
  'string.quoted.double': ['string'],
  'string.quoted.triple': ['string'],
  'string.quoted.other': ['string'],
  'string.unquoted': ['string.unquoted'],
  'string.interpolated': ['string.interpolated'],
  'string.escape': ['constant.character.escape'],
  'string.special': ['string.other'],
  'string.regexp': ['string.regexp'],
  
  // Characters
  'character': ['constant.character'],
  'character.special': ['constant.character.special'],
  
  // Functions
  'function': ['entity.name.function'],
  'function.call': ['entity.name.function'],
  'function.builtin': ['support.function'],
  'function.method': ['entity.name.function.method'],
  'function.method.call': ['entity.name.function.method'],
  'function.macro': ['entity.name.function.macro'],
  'function.definition': ['entity.name.function.definition'],
  
  // Methods
  'method': ['entity.name.function.method'],
  'method.call': ['entity.name.function.method.call'],
  
  // Types
  'type': ['entity.name.type'],
  'type.builtin': ['support.type'],
  'type.enum': ['entity.name.type.enum'],
  'type.interface': ['entity.name.interface'],
  'type.class': ['entity.name.class'],
  'type.struct': ['entity.name.struct'],
  
  // Variables
  'variable': ['variable'],
  'variable.builtin': ['variable.language'],
  'variable.parameter': ['variable.parameter'],
  'variable.other': ['variable.other'],
  'variable.other.member': ['variable.other.property'],
  'variable.other.property': ['variable.other.property'],
  'variable.other.constant': ['variable.other.constant'],
  
  // Parameters
  'parameter': ['variable.parameter'],
  'parameter.reference': ['variable.parameter.reference'],
  
  // Properties
  'property': ['variable.other.property'],
  'property.definition': ['variable.other.property.definition'],
  
  // Labels
  'label': ['entity.name.label'],
  
  // Punctuation
  'punctuation': ['punctuation'],
  'punctuation.bracket': ['punctuation.bracket'],
  'punctuation.bracket.round': ['punctuation.parenthesis'],
  'punctuation.bracket.square': ['punctuation.squarebracket'],
  'punctuation.bracket.curly': ['punctuation.curlybracket'],
  'punctuation.bracket.angle': ['punctuation.anglebracket'],
  'punctuation.delimiter': ['punctuation.separator'],
  'punctuation.separator': ['punctuation.separator'],
  'punctuation.terminator': ['punctuation.terminator'],
  'punctuation.special': ['punctuation.other'],
  
  // Operators
  'operator': ['keyword.operator'],
  'operator.arithmetic': ['keyword.operator.arithmetic'],
  'operator.relational': ['keyword.operator.comparison'],
  'operator.logical': ['keyword.operator.logical'],
  'operator.bitwise': ['keyword.operator.bitwise'],
  'operator.assignment': ['keyword.operator.assignment'],
  'operator.other': ['keyword.operator.other'],
  
  // Tags (HTML/JSX)
  'tag': ['entity.name.tag'],
  'tag.builtin': ['entity.name.tag'],
  'tag.attribute': ['entity.other.attribute-name'],
  'tag.delimiter': ['punctuation.definition.tag'],
  
  // Attributes
  'attribute': ['entity.other.attribute-name'],
  'attribute.builtin': ['support.attribute'],
  'attribute.value': ['string'],
  
  // Modules/Imports
  'module': ['entity.name.namespace'],
  'module.import': ['entity.name.namespace.import'],
  'namespace': ['entity.name.namespace'],
  
  // Constructor
  'constructor': ['entity.name.function.constructor'],
  
  // Definitions
  'definition': ['meta.definition'],
  'definition.function': ['meta.definition.function'],
  'definition.class': ['meta.definition.class'],
  'definition.variable': ['meta.definition.variable'],
  'definition.method': ['meta.definition.method'],
  'definition.type': ['meta.definition.type'],
  
  // Text
  'text': ['text'],
  'text.title': ['markup.heading'],
  'text.uri': ['string.other.link'],
  'text.literal': ['markup.raw'],
  'text.emphasis': ['markup.italic'],
  'text.strong': ['markup.bold'],
  'text.quote': ['markup.quote'],
  'text.todo': ['markup.inserted'],
  
  // Markup
  'markup': ['markup'],
  'markup.heading': ['markup.heading'],
  'markup.heading.marker': ['markup.heading.marker'],
  'markup.list': ['markup.list'],
  'markup.list.numbered': ['markup.list.numbered'],
  'markup.list.unnumbered': ['markup.list.unnumbered'],
  'markup.bold': ['markup.bold'],
  'markup.italic': ['markup.italic'],
  'markup.strikethrough': ['markup.strikethrough'],
  'markup.underline': ['markup.underline'],
  'markup.inserted': ['markup.inserted'],
  'markup.deleted': ['markup.deleted'],
  'markup.link': ['markup.underline.link'],
  'markup.link.url': ['markup.underline.link'],
  'markup.link.label': ['markup.link.label'],
  'markup.link.text': ['markup.link.text'],
  'markup.quote': ['markup.quote'],
  'markup.raw': ['markup.raw'],
  'markup.raw.block': ['markup.raw.block'],
  
  // Diff
  'diff': ['meta.diff'],
  'diff.plus': ['markup.inserted'],
  'diff.minus': ['markup.deleted'],
  'diff.delta': ['markup.changed'],
  
  // Error
  'error': ['invalid.illegal'],
  'warning': ['invalid.deprecated'],
  
  // Tags for scope
  '@constant': ['constant'],
  '@function': ['entity.name.function'],
  '@keyword': ['keyword'],
  '@operator': ['keyword.operator'],
  '@punctuation': ['punctuation'],
  '@string': ['string'],
  '@type': ['entity.name.type'],
  '@variable': ['variable'],
};

// Language-specific highlight queries
const HIGHLIGHT_QUERIES: Partial<Record<SupportedLanguage, string>> = {
  typescript: `
    ; Keywords
    ["abstract" "as" "asserts" "async" "await" "break" "case" "catch" "class" "const" "continue" "debugger" "default" "delete" "do" "else" "enum" "export" "extends" "finally" "for" "from" "function" "get" "if" "implements" "import" "in" "instanceof" "interface" "let" "new" "of" "package" "private" "protected" "public" "readonly" "return" "set" "static" "super" "switch" "this" "throw" "try" "type" "typeof" "var" "void" "while" "with" "yield"] @keyword
    
    ; Constants
    ["true" "false" "null" "undefined" "NaN" "Infinity"] @constant.builtin
    
    ; Strings
    (string) @string
    (template_string) @string
    
    ; Numbers
    (number) @constant.numeric
    
    ; Comments
    (comment) @comment
    
    ; Functions
    (function_declaration name: (identifier) @function)
    (function_expression name: (identifier) @function)
    (method_definition name: (property_identifier) @function.method)
    (arrow_function) @function
    
    ; Types
    (type_identifier) @type
    (predefined_type) @type.builtin
    
    ; Variables
    (identifier) @variable
    (property_identifier) @property
    (shorthand_property_identifier) @property
    
    ; Operators
    ["+" "-" "*" "/" "%" "=" "==" "===" "!=" "!==" "<" ">" "<=" ">=" "&&" "||" "!" "&" "|" "^" "~" "<<" ">>" ">>>" "??" "?." "?:" "=>"] @operator
    
    ; Punctuation
    ["(" ")" "[" "]" "{" "}" "," ";" "." ":" "::"] @punctuation
  `,
  javascript: `
    ; Keywords
    ["async" "await" "break" "case" "catch" "class" "const" "continue" "debugger" "default" "delete" "do" "else" "export" "extends" "finally" "for" "from" "function" "get" "if" "import" "in" "instanceof" "let" "new" "of" "return" "set" "static" "super" "switch" "this" "throw" "try" "typeof" "var" "void" "while" "with" "yield"] @keyword
    
    ; Constants
    ["true" "false" "null" "undefined" "NaN" "Infinity"] @constant.builtin
    
    ; Strings
    (string) @string
    (template_string) @string
    
    ; Numbers
    (number) @constant.numeric
    
    ; Comments
    (comment) @comment
    
    ; Functions
    (function_declaration name: (identifier) @function)
    (function_expression name: (identifier) @function)
    (method_definition name: (property_identifier) @function.method)
    (arrow_function) @function
    
    ; Variables
    (identifier) @variable
    (property_identifier) @property
    
    ; Operators
    ["+" "-" "*" "/" "%" "=" "==" "===" "!=" "!==" "<" ">" "<=" ">=" "&&" "||" "!" "&" "|" "^" "~" "<<" ">>" ">>>" "??" "?." "?:" "=>"] @operator
    
    ; Punctuation
    ["(" ")" "[" "]" "{" "}" "," ";" "." ":"] @punctuation
  `,
  python: `
    ; Keywords
    ["and" "as" "assert" "async" "await" "break" "class" "continue" "def" "del" "elif" "else" "except" "finally" "for" "from" "global" "if" "import" "in" "is" "lambda" "nonlocal" "not" "or" "pass" "raise" "return" "try" "while" "with" "yield"] @keyword
    
    ; Constants
    ["True" "False" "None"] @constant.builtin
    
    ; Strings
    (string) @string
    
    ; Numbers
    (integer) @constant.numeric.integer
    (float) @constant.numeric.float
    
    ; Comments
    (comment) @comment
    
    ; Functions
    (function_definition name: (identifier) @function)
    (decorator) @function.macro
    
    ; Classes
    (class_definition name: (identifier) @type.class)
    
    ; Variables
    (identifier) @variable
    (attribute) @property
    
    ; Operators
    ["+" "-" "*" "/" "//" "%" "@" "**" "<<" ">>" "&" "|" "^" "~" "<" ">" "<=" ">=" "==" "!=" "is" "is not" "in" "not in" "and" "or" "not" ":=" "=" "+=" "-=" "*=" "/=" "//=" "%=" "**=" "@=" "&=" "|=" "^=" ">>=" "<<="] @operator
    
    ; Punctuation
    ["(" ")" "[" "]" "{" "}" "," ";" "." ":" "\\"] @punctuation
  `,
  json: `
    ; Keys
    (pair key: (string) @property)
    
    ; Values
    (string) @string
    (number) @constant.numeric
    ["true" "false" "null"] @constant.builtin
    
    ; Punctuation
    ["{" "}" "[" "]" "," ":"] @punctuation
  `,
  html: `
    ; Tags
    (tag_name) @tag
    (end_tag) @tag
    
    ; Attributes
    (attribute_name) @attribute
    (attribute_value) @string
    (quoted_attribute_value) @string
    
    ; Punctuation
    ["<" ">" "</" "/>" "="] @punctuation.definition.tag
    
    ; Comments
    (comment) @comment
  `,
  css: `
    ; Selectors
    (tag_name) @tag
    (class_name) @property
    (id_name) @constant
    (pseudo_class_selector) @keyword
    (pseudo_element_selector) @keyword
    
    ; Properties
    (property_name) @property
    
    ; Values
    (plain_value) @constant
    (color_value) @constant
    (string_value) @string
    (integer_value) @constant.numeric
    (float_value) @constant.numeric
    
    ; Functions
    (call_expression (identifier) @function)
    
    ; Punctuation
    ["{" "}" "[" "]" "(" ")" ";" ":" ","] @punctuation
  `,
};

/**
 * Syntax Highlighter for Monaco Editor
 * Uses Tree-sitter queries to generate semantic tokens
 */
export class SyntaxHighlighter {
  private service: TreeSitterService;
  private captureMappings: HighlightCaptureMapping;
  private highlightQueryCache: Map<SupportedLanguage, Parser.Query> = new Map();

  constructor(service: TreeSitterService, customMappings?: HighlightCaptureMapping) {
    this.service = service;
    this.captureMappings = {
      ...DEFAULT_HIGHLIGHT_CAPTURES,
      ...customMappings,
    };
  }

  /**
   * Highlight source code and return Monaco-compatible tokens
   */
  async highlight(
    source: string,
    language: SupportedLanguage
  ): Promise<HighlightResult> {
    const parseResult = await this.service.parse(source, language);
    return this.highlightTree(parseResult.tree, source, language);
  }

  /**
   * Highlight an existing tree
   */
  async highlightTree(
    tree: Tree,
    source: string,
    language: SupportedLanguage
  ): Promise<HighlightResult> {
    const tokens = await this.extractTokens(tree, source, language);
    
    return {
      tokens,
      language,
    };
  }

  /**
   * Extract tokens from tree using highlight queries
   */
  private async extractTokens(
    tree: Tree,
    source: string,
    language: SupportedLanguage
  ): Promise<MonacoLineTokens[]> {
    const lineTokens: MonacoLineTokens[] = [];
    const lines = source.split('\n');
    
    // Initialize token arrays for each line
    for (let i = 0; i < lines.length; i++) {
      lineTokens.push({ line: i, tokens: [] });
    }

    // Try to use highlight query
    const query = await this.getHighlightQuery(language);
    
    if (query) {
      // Use query-based highlighting
      const captures = query.captures(tree.rootNode);
      
      for (const capture of captures) {
        const node = capture.node;
        const scopes = this.captureMappings[capture.name] || [capture.name];
        
        // Add token for each capture
        this.addToken(
          lineTokens,
          node.startIndex,
          node.endIndex,
          scopes
        );
      }
    } else {
      // Fallback to tree-walking highlighting
      this.walkAndHighlight(tree.rootNode, source, lineTokens, language);
    }

    // Sort tokens by start position for each line
    for (const line of lineTokens) {
      line.tokens.sort((a, b) => a.startIndex - b.startIndex);
    }

    return lineTokens;
  }

  /**
   * Get or create highlight query for language
   */
  private async getHighlightQuery(language: SupportedLanguage): Promise<Parser.Query | null> {
    const cached = this.highlightQueryCache.get(language);
    if (cached) return cached;

    const querySource = HIGHLIGHT_QUERIES[language];
    if (!querySource) return null;

    try {
      const lang = await this.service.loadLanguage(language);
      const query = lang.query(querySource);
      this.highlightQueryCache.set(language, query);
      return query;
    } catch (error) {
      console.warn(`Failed to create highlight query for ${language}:`, error);
      return null;
    }
  }

  /**
   * Walk the tree and apply fallback highlighting
   */
  private walkAndHighlight(
    node: SyntaxNode,
    source: string,
    lineTokens: MonacoLineTokens[],
    language: SupportedLanguage
  ): void {
    const nodeType = node.type;
    const scopes = this.getNodeScopes(nodeType, language);
    
    if (scopes.length > 0) {
      this.addToken(
        lineTokens,
        node.startIndex,
        node.endIndex,
        scopes
      );
    }

    // Recursively process children
    for (const child of node.children) {
      this.walkAndHighlight(child, source, lineTokens, language);
    }
  }

  /**
   * Get scopes for a node type (fallback method)
   */
  private getNodeScopes(nodeType: string, _language: SupportedLanguage): string[] {
    // Map common node types to scopes
    const typeScopes: Record<string, string[]> = {
      // Comments
      'comment': ['comment'],
      'line_comment': ['comment.line'],
      'block_comment': ['comment.block'],
      
      // Strings
      'string': ['string'],
      'string_literal': ['string'],
      'template_string': ['string'],
      'template_literal': ['string'],
      
      // Numbers
      'number': ['constant.numeric'],
      'numeric_literal': ['constant.numeric'],
      'integer': ['constant.numeric'],
      'float': ['constant.numeric'],
      
      // Keywords
      'keyword': ['keyword'],
      
      // Identifiers
      'identifier': ['variable'],
      'type_identifier': ['entity.name.type'],
      'property_identifier': ['variable.other.property'],
      
      // Functions
      'function_declaration': ['entity.name.function'],
      'function_expression': ['entity.name.function'],
      'method_definition': ['entity.name.function.method'],
      'arrow_function': ['meta.arrow'],
      
      // Classes/Types
      'class_declaration': ['entity.name.class'],
      'interface_declaration': ['entity.name.interface'],
      
      // JSX/HTML
      'jsx_element': ['meta.tag'],
      'jsx_self_closing_element': ['meta.tag'],
      'jsx_opening_element': ['meta.tag'],
      'jsx_closing_element': ['meta.tag'],
      'tag_name': ['entity.name.tag'],
      
      // Operators
      'operator': ['keyword.operator'],
      
      // Punctuation
      'punctuation': ['punctuation'],
      '(': ['punctuation.bracket'],
      ')': ['punctuation.bracket'],
      '[': ['punctuation.bracket'],
      ']': ['punctuation.bracket'],
      '{': ['punctuation.bracket'],
      '}': ['punctuation.bracket'],
    };

    return typeScopes[nodeType] || [];
  }

  /**
   * Add a token to the appropriate line(s)
   */
  private addToken(
    lineTokens: MonacoLineTokens[],
    startIndex: number,
    endIndex: number,
    scopes: string[]
  ): void {
    const token: MonacoToken = {
      startIndex,
      endIndex,
      scopes,
    };

    // Find the line for this token
    const lineIndex = this.findLineForPosition(lineTokens, startIndex);
    if (lineIndex >= 0 && lineIndex < lineTokens.length) {
      lineTokens[lineIndex].tokens.push(token);
    }
  }

  /**
   * Find the line index for a position
   */
  private findLineForPosition(lineTokens: MonacoLineTokens[], position: number): number {
    // Simple linear search - could be optimized with binary search
    for (let i = 0; i < lineTokens.length; i++) {
      // This is a simplified version - in production, you'd track line start positions
      return Math.min(position, lineTokens.length - 1);
    }
    return 0;
  }

  /**
   * Add custom capture mapping
   */
  addCaptureMapping(captureName: string, scopes: string[]): void {
    this.captureMappings[captureName] = scopes;
  }

  /**
   * Set custom capture mappings
   */
  setCaptureMappings(mappings: HighlightCaptureMapping): void {
    this.captureMappings = { ...DEFAULT_HIGHLIGHT_CAPTURES, ...mappings };
  }

  /**
   * Convert to Monaco's tokens provider format
   */
  toMonacoTokensProvider(
    result: HighlightResult
  ): { tokens: Array<{ offset: number; type: string }[]> } {
    const monacoTokens: Array<{ offset: number; type: string }[]> = [];
    
    for (const line of result.tokens) {
      const lineTokens: { offset: number; type: string }[] = [];
      
      for (const token of line.tokens) {
        lineTokens.push({
          offset: token.startIndex,
          type: token.scopes.join('.'),
        });
      }
      
      monacoTokens.push(lineTokens);
    }
    
    return { tokens: monacoTokens };
  }

  /**
   * Clear highlight query cache
   */
  clearCache(): void {
    this.highlightQueryCache.clear();
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.clearCache();
  }
}

// Singleton instance
let highlighterInstance: SyntaxHighlighter | null = null;

/**
 * Get the global syntax highlighter instance
 */
export function getSyntaxHighlighter(
  service?: TreeSitterService,
  customMappings?: HighlightCaptureMapping
): SyntaxHighlighter {
  if (!highlighterInstance) {
    const treeSitterService = service || getTreeSitterService();
    highlighterInstance = new SyntaxHighlighter(treeSitterService, customMappings);
  }
  return highlighterInstance;
}

/**
 * Reset the highlighter instance
 */
export function resetSyntaxHighlighter(): void {
  if (highlighterInstance) {
    highlighterInstance.dispose();
    highlighterInstance = null;
  }
}

// Import Parser type for Query
import Parser from 'web-tree-sitter';
import { getTreeSitterService } from './tree-sitter-service';

export default SyntaxHighlighter;
