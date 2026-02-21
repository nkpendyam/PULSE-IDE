/**
 * Tree-sitter Code Intelligence
 * 
 * Provides code intelligence features using Tree-sitter AST:
 * - Find definitions
 * - Find references
 * - Extract symbols
 * - Get scope at position
 * - Find matching brackets
 */

import type { Tree, SyntaxNode, Point } from 'web-tree-sitter';
import { TreeSitterService, SupportedLanguage } from './tree-sitter-service';

// Symbol types
export type SymbolKind =
  | 'file'
  | 'module'
  | 'namespace'
  | 'package'
  | 'class'
  | 'method'
  | 'property'
  | 'field'
  | 'constructor'
  | 'enum'
  | 'interface'
  | 'function'
  | 'variable'
  | 'constant'
  | 'string'
  | 'number'
  | 'boolean'
  | 'array'
  | 'object'
  | 'key'
  | 'null'
  | 'enum_member'
  | 'struct'
  | 'event'
  | 'operator'
  | 'type_parameter';

// Symbol information
export interface SymbolInfo {
  name: string;
  kind: SymbolKind;
  detail?: string;
  containerName?: string;
  range: {
    start: Point;
    end: Point;
  };
  selectionRange: {
    start: Point;
    end: Point;
  };
  children?: SymbolInfo[];
}

// Location information
export interface Location {
  filePath: string;
  range: {
    start: Point;
    end: Point;
  };
}

// Definition result
export interface DefinitionResult {
  location: Location;
  symbol: SymbolInfo;
}

// Reference result
export interface ReferenceResult {
  locations: Location[];
  symbol: SymbolInfo;
}

// Scope information
export interface ScopeInfo {
  type: 'block' | 'function' | 'class' | 'module' | 'global';
  range: {
    start: Point;
    end: Point;
  };
  variables: SymbolInfo[];
  parent?: ScopeInfo;
}

// Bracket pair
export interface BracketPair {
  open: {
    position: Point;
    character: string;
  };
  close: {
    position: Point;
    character: string;
  };
}

// Node type mappings for symbols by language
const SYMBOL_TYPE_MAPPINGS: Partial<Record<SupportedLanguage, Record<string, SymbolKind>>> = {
  typescript: {
    'function_declaration': 'function',
    'function_expression': 'function',
    'arrow_function': 'function',
    'method_definition': 'method',
    'class_declaration': 'class',
    'interface_declaration': 'interface',
    'enum_declaration': 'enum',
    'type_alias_declaration': 'type_parameter',
    'variable_declarator': 'variable',
    'lexical_declaration': 'variable',
    'variable_declaration': 'variable',
    'property_signature': 'property',
    'property_identifier': 'property',
    'field_definition': 'field',
    'parameter': 'variable',
    'identifier': 'variable',
    'type_identifier': 'type_parameter',
    'namespace_import': 'namespace',
    'import_clause': 'module',
    'export_statement': 'module',
  },
  javascript: {
    'function_declaration': 'function',
    'function_expression': 'function',
    'arrow_function': 'function',
    'method_definition': 'method',
    'class_declaration': 'class',
    'variable_declarator': 'variable',
    'lexical_declaration': 'variable',
    'variable_declaration': 'variable',
    'property_identifier': 'property',
    'parameter': 'variable',
    'identifier': 'variable',
  },
  python: {
    'function_definition': 'function',
    'class_definition': 'class',
    'decorator': 'function',
    'assignment': 'variable',
    'identifier': 'variable',
    'typed_parameter': 'variable',
    'default_parameter': 'variable',
    'keyword_argument': 'variable',
  },
  rust: {
    'function_item': 'function',
    'struct_item': 'struct',
    'enum_item': 'enum',
    'impl_item': 'class',
    'trait_item': 'interface',
    'type_item': 'type_parameter',
    'let_declaration': 'variable',
    'field_declaration': 'field',
    'identifier': 'variable',
    'function_identifier': 'function',
  },
  go: {
    'function_declaration': 'function',
    'method_declaration': 'method',
    'type_declaration': 'class',
    'type_spec': 'class',
    'struct_type': 'struct',
    'interface_type': 'interface',
    'var_declaration': 'variable',
    'const_declaration': 'constant',
    'const_spec': 'constant',
    'field_identifier': 'field',
    'identifier': 'variable',
  },
};

// Definition queries by language
const DEFINITION_QUERIES: Partial<Record<SupportedLanguage, string>> = {
  typescript: `
    (function_declaration name: (identifier) @definition.function)
    (function_expression name: (identifier) @definition.function)
    (method_definition name: (property_identifier) @definition.method)
    (class_declaration name: (type_identifier) @definition.class)
    (interface_declaration name: (type_identifier) @definition.interface)
    (enum_declaration name: (type_identifier) @definition.enum)
    (type_alias_declaration name: (type_identifier) @definition.type)
    (variable_declarator name: (identifier) @definition.variable)
    (lexical_declaration (variable_declarator name: (identifier) @definition.variable))
    (parameter name: (identifier) @definition.parameter)
    (import_clause (identifier) @definition.import)
  `,
  javascript: `
    (function_declaration name: (identifier) @definition.function)
    (function_expression name: (identifier) @definition.function)
    (method_definition name: (property_identifier) @definition.method)
    (class_declaration name: (identifier) @definition.class)
    (variable_declarator name: (identifier) @definition.variable)
    (lexical_declaration (variable_declarator name: (identifier) @definition.variable))
    (parameter name: (identifier) @definition.parameter)
  `,
  python: `
    (function_definition name: (identifier) @definition.function)
    (class_definition name: (identifier) @definition.class)
    (assignment left: (identifier) @definition.variable)
    (typed_parameter name: (identifier) @definition.parameter)
  `,
};

// Reference queries by language
const REFERENCE_QUERIES: Partial<Record<SupportedLanguage, string>> = {
  typescript: `
    (identifier) @reference
    (type_identifier) @reference
    (property_identifier) @reference
  `,
  javascript: `
    (identifier) @reference
    (property_identifier) @reference
  `,
  python: `
    (identifier) @reference
    (attribute) @reference
  `,
};

/**
 * Code Intelligence Service
 * Provides code analysis features using Tree-sitter
 */
export class CodeIntelligence {
  private service: TreeSitterService;
  private definitionQueries: Map<SupportedLanguage, Parser.Query> = new Map();
  private referenceQueries: Map<SupportedLanguage, Parser.Query> = new Map();

  constructor(service: TreeSitterService) {
    this.service = service;
  }

  /**
   * Find definition at position
   */
  async findDefinition(
    tree: Tree,
    source: string,
    position: Point,
    language: SupportedLanguage,
    filePath: string
  ): Promise<DefinitionResult | null> {
    // Get node at position
    const node = tree.rootNode.descendantForPosition(position);
    if (!node) return null;

    // Get the identifier name
    const name = node.text;
    if (!name || name.length === 0) return null;

    // Look for definition in current file
    const definition = await this.findDefinitionInFile(tree, source, name, language, filePath);
    return definition;
  }

  /**
   * Find definition in file by name
   */
  async findDefinitionInFile(
    tree: Tree,
    source: string,
    name: string,
    language: SupportedLanguage,
    filePath: string
  ): Promise<DefinitionResult | null> {
    const query = await this.getDefinitionQuery(language);
    if (!query) return null;

    const matches = query.matches(tree.rootNode);
    
    for (const match of matches) {
      for (const capture of match.captures) {
        if (capture.name.startsWith('definition.') && capture.node.text === name) {
          const symbol = this.nodeToSymbol(capture.node, source, language);
          if (symbol) {
            return {
              location: {
                filePath,
                range: {
                  start: capture.node.startPosition,
                  end: capture.node.endPosition,
                },
              },
              symbol,
            };
          }
        }
      }
    }

    return null;
  }

  /**
   * Find all references to a symbol
   */
  async findReferences(
    tree: Tree,
    source: string,
    position: Point,
    language: SupportedLanguage,
    filePath: string,
    includeDeclaration: boolean = true
  ): Promise<ReferenceResult | null> {
    // Get node at position
    const node = tree.rootNode.descendantForPosition(position);
    if (!node) return null;

    // Get the identifier name
    const name = node.text;
    if (!name || name.length === 0) return null;

    const query = await this.getReferenceQuery(language);
    if (!query) return null;

    const locations: Location[] = [];
    const matches = query.matches(tree.rootNode);

    // Get the symbol info
    let symbol: SymbolInfo | null = null;
    const definition = await this.findDefinitionInFile(tree, source, name, language, filePath);
    if (definition) {
      symbol = definition.symbol;
    }

    for (const match of matches) {
      for (const capture of match.captures) {
        if (capture.name === 'reference' && capture.node.text === name) {
          // Check if this is the definition
          const isDefinition = capture.node.parent?.type.includes('declaration') ||
                              capture.node.parent?.type.includes('definition');
          
          if (includeDeclaration || !isDefinition) {
            locations.push({
              filePath,
              range: {
                start: capture.node.startPosition,
                end: capture.node.endPosition,
              },
            });
          }
        }
      }
    }

    if (locations.length === 0) return null;

    return {
      locations,
      symbol: symbol || {
        name,
        kind: 'variable',
        range: { start: node.startPosition, end: node.endPosition },
        selectionRange: { start: node.startPosition, end: node.endPosition },
      },
    };
  }

  /**
   * Extract all symbols from a file
   */
  async extractSymbols(
    tree: Tree,
    source: string,
    language: SupportedLanguage
  ): Promise<SymbolInfo[]> {
    const symbols: SymbolInfo[] = [];
    
    // Walk the tree and extract symbols
    this.extractSymbolsFromNode(tree.rootNode, source, language, symbols, null);
    
    return symbols;
  }

  /**
   * Recursively extract symbols from a node
   */
  private extractSymbolsFromNode(
    node: SyntaxNode,
    source: string,
    language: SupportedLanguage,
    symbols: SymbolInfo[],
    containerName: string | null
  ): void {
    const mappings = SYMBOL_TYPE_MAPPINGS[language] || {};
    const kind = mappings[node.type];
    
    if (kind) {
      const symbol = this.nodeToSymbol(node, source, language);
      if (symbol) {
        if (containerName) {
          symbol.containerName = containerName;
        }
        
        // Extract children for classes, interfaces, etc.
        if (kind === 'class' || kind === 'interface' || kind === 'struct') {
          symbol.children = this.extractChildSymbols(node, source, language, symbol.name);
        }
        
        symbols.push(symbol);
        containerName = symbol.name;
      }
    }

    // Recurse into children
    for (const child of node.children) {
      this.extractSymbolsFromNode(child, source, language, symbols, containerName);
    }
  }

  /**
   * Extract child symbols from a parent node (class members, etc.)
   */
  private extractChildSymbols(
    node: SyntaxNode,
    source: string,
    language: SupportedLanguage,
    containerName: string
  ): SymbolInfo[] {
    const children: SymbolInfo[] = [];
    const mappings = SYMBOL_TYPE_MAPPINGS[language] || {};

    // Find the body/class body
    const body = node.childForFieldName('body') || 
                 node.children.find(c => c.type.includes('body'));
    
    if (body) {
      for (const child of body.children) {
        const kind = mappings[child.type];
        if (kind) {
          const symbol = this.nodeToSymbol(child, source, language);
          if (symbol) {
            symbol.containerName = containerName;
            children.push(symbol);
          }
        }
      }
    }

    return children;
  }

  /**
   * Convert a node to symbol info
   */
  private nodeToSymbol(
    node: SyntaxNode,
    source: string,
    language: SupportedLanguage
  ): SymbolInfo | null {
    const mappings = SYMBOL_TYPE_MAPPINGS[language] || {};
    const kind = mappings[node.type];
    
    if (!kind) return null;

    // Try to get the name from the node
    let name = '';
    const nameNode = node.childForFieldName('name');
    if (nameNode) {
      name = nameNode.text;
    } else if (node.type === 'variable_declarator') {
      // Variable declarator has the name as the first child
      const firstChild = node.firstChild;
      if (firstChild) {
        name = firstChild.text;
      }
    } else {
      name = node.text;
    }

    // Get detail from type annotation or parameters
    let detail: string | undefined;
    const typeNode = node.childForFieldName('type');
    const paramsNode = node.childForFieldName('parameters');
    if (typeNode) {
      detail = `: ${typeNode.text}`;
    } else if (paramsNode) {
      detail = paramsNode.text;
    }

    return {
      name,
      kind,
      detail,
      range: {
        start: node.startPosition,
        end: node.endPosition,
      },
      selectionRange: {
        start: nameNode?.startPosition || node.startPosition,
        end: nameNode?.endPosition || node.endPosition,
      },
    };
  }

  /**
   * Get the scope at a position
   */
  getScopeAtPosition(
    tree: Tree,
    source: string,
    position: Point,
    language: SupportedLanguage
  ): ScopeInfo | null {
    const node = tree.rootNode.descendantForPosition(position);
    if (!node) return null;

    // Walk up to find the enclosing scope
    let current: SyntaxNode | null = node;
    let scopeNode: SyntaxNode | null = null;
    let scopeType: ScopeInfo['type'] = 'global';

    while (current) {
      const type = current.type;
      
      if (type === 'function_declaration' || type === 'function_expression' || 
          type === 'arrow_function' || type === 'method_definition') {
        scopeNode = current;
        scopeType = 'function';
        break;
      }
      
      if (type === 'class_declaration' || type === 'class_expression') {
        scopeNode = current;
        scopeType = 'class';
        break;
      }
      
      if (type === 'module' || type === 'import_statement') {
        scopeNode = current;
        scopeType = 'module';
        break;
      }
      
      if (type === 'block' || type === 'statement_block') {
        scopeNode = current;
        scopeType = 'block';
        break;
      }
      
      current = current.parent;
    }

    if (!scopeNode) {
      // Global scope
      return {
        type: 'global',
        range: {
          start: { row: 0, column: 0 },
          end: tree.rootNode.endPosition,
        },
        variables: [],
      };
    }

    // Extract variables in scope
    const variables = this.extractVariablesInScope(scopeNode, source, language);

    const scope: ScopeInfo = {
      type: scopeType,
      range: {
        start: scopeNode.startPosition,
        end: scopeNode.endPosition,
      },
      variables,
    };

    // Find parent scope
    if (scopeNode.parent) {
      scope.parent = this.getScopeAtPosition(tree, source, scopeNode.startPosition, language);
    }

    return scope;
  }

  /**
   * Extract variables declared in a scope
   */
  private extractVariablesInScope(
    scopeNode: SyntaxNode,
    source: string,
    language: SupportedLanguage
  ): SymbolInfo[] {
    const variables: SymbolInfo[] = [];
    const mappings = SYMBOL_TYPE_MAPPINGS[language] || {};

    // Variable declaration node types
    const declarationTypes = [
      'variable_declarator',
      'lexical_declaration',
      'parameter',
      'assignment',
    ];

    // Walk the scope node
    const walk = (node: SyntaxNode) => {
      if (declarationTypes.includes(node.type)) {
        const kind = mappings[node.type];
        if (kind) {
          const symbol = this.nodeToSymbol(node, source, language);
          if (symbol) {
            variables.push(symbol);
          }
        }
      }

      for (const child of node.children) {
        // Don't descend into nested functions/classes
        if (!child.type.includes('function') && !child.type.includes('class')) {
          walk(child);
        }
      }
    };

    walk(scopeNode);
    return variables;
  }

  /**
   * Find matching brackets
   */
  findMatchingBracket(
    tree: Tree,
    source: string,
    position: Point
  ): BracketPair | null {
    const node = tree.rootNode.descendantForPosition(position);
    if (!node) return null;

    // Get the character at position
    const lines = source.split('\n');
    if (position.row >= lines.length) return null;
    
    const line = lines[position.row];
    const char = line[position.column];
    
    // Define bracket pairs
    const bracketPairs: Record<string, string> = {
      '(': ')',
      ')': '(',
      '[': ']',
      ']': '[',
      '{': '}',
      '}': '{',
      '<': '>',
      '>': '<',
    };

    const matching = bracketPairs[char];
    if (!matching) return null;

    // Look for bracket node types
    const bracketNodes = this.findBracketNodes(tree.rootNode, char, matching);
    
    for (const pair of bracketNodes) {
      if (this.positionEquals(pair.open.position, position) ||
          this.positionEquals(pair.close.position, position)) {
        return pair;
      }
    }

    return null;
  }

  /**
   * Find all bracket pairs in a node
   */
  private findBracketNodes(
    node: SyntaxNode,
    openChar: string,
    closeChar: string
  ): BracketPair[] {
    const pairs: BracketPair[] = [];

    // Check if this node has bracket children
    const firstChild = node.firstChild;
    const lastChild = node.lastChild;

    if (firstChild && lastChild && firstChild !== lastChild) {
      const firstText = firstChild.text;
      const lastText = lastChild.text;

      if ((firstText === openChar && lastText === closeChar) ||
          (firstText === closeChar && lastText === openChar)) {
        pairs.push({
          open: {
            position: firstChild.startPosition,
            character: firstText,
          },
          close: {
            position: lastChild.startPosition,
            character: lastText,
          },
        });
      }
    }

    // Recurse into children
    for (const child of node.children) {
      pairs.push(...this.findBracketNodes(child, openChar, closeChar));
    }

    return pairs;
  }

  /**
   * Compare two positions
   */
  private positionEquals(a: Point, b: Point): boolean {
    return a.row === b.row && a.column === b.column;
  }

  /**
   * Get or create definition query
   */
  private async getDefinitionQuery(language: SupportedLanguage): Promise<Parser.Query | null> {
    const cached = this.definitionQueries.get(language);
    if (cached) return cached;

    const querySource = DEFINITION_QUERIES[language];
    if (!querySource) return null;

    try {
      const lang = await this.service.loadLanguage(language);
      const query = lang.query(querySource);
      this.definitionQueries.set(language, query);
      return query;
    } catch (error) {
      console.warn(`Failed to create definition query for ${language}:`, error);
      return null;
    }
  }

  /**
   * Get or create reference query
   */
  private async getReferenceQuery(language: SupportedLanguage): Promise<Parser.Query | null> {
    const cached = this.referenceQueries.get(language);
    if (cached) return cached;

    const querySource = REFERENCE_QUERIES[language];
    if (!querySource) return null;

    try {
      const lang = await this.service.loadLanguage(language);
      const query = lang.query(querySource);
      this.referenceQueries.set(language, query);
      return query;
    } catch (error) {
      console.warn(`Failed to create reference query for ${language}:`, error);
      return null;
    }
  }

  /**
   * Find all occurrences of a symbol
   */
  async findAllOccurrences(
    tree: Tree,
    source: string,
    name: string,
    language: SupportedLanguage,
    filePath: string
  ): Promise<Location[]> {
    const locations: Location[] = [];
    const query = await this.getReferenceQuery(language);
    if (!query) return locations;

    const matches = query.matches(tree.rootNode);

    for (const match of matches) {
      for (const capture of match.captures) {
        if (capture.node.text === name) {
          locations.push({
            filePath,
            range: {
              start: capture.node.startPosition,
              end: capture.node.endPosition,
            },
          });
        }
      }
    }

    return locations;
  }

  /**
   * Get document outline (hierarchical symbols)
   */
  async getDocumentOutline(
    tree: Tree,
    source: string,
    language: SupportedLanguage
  ): Promise<SymbolInfo[]> {
    const symbols: SymbolInfo[] = [];
    
    // Only get top-level symbols
    const mappings = SYMBOL_TYPE_MAPPINGS[language] || {};
    
    for (const child of tree.rootNode.children) {
      const kind = mappings[child.type];
      if (kind && (kind === 'class' || kind === 'interface' || kind === 'function' || 
                   kind === 'enum' || kind === 'struct' || kind === 'module')) {
        const symbol = this.nodeToSymbol(child, source, language);
        if (symbol) {
          // Add children for classes/interfaces
          if (kind === 'class' || kind === 'interface') {
            symbol.children = this.extractChildSymbols(child, source, language, symbol.name);
          }
          symbols.push(symbol);
        }
      }
    }

    return symbols;
  }

  /**
   * Clear query caches
   */
  clearCache(): void {
    this.definitionQueries.clear();
    this.referenceQueries.clear();
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.clearCache();
  }
}

// Singleton instance
let intelligenceInstance: CodeIntelligence | null = null;

/**
 * Get the global code intelligence instance
 */
export function getCodeIntelligence(service?: TreeSitterService): CodeIntelligence {
  if (!intelligenceInstance) {
    const treeSitterService = service || getTreeSitterService();
    intelligenceInstance = new CodeIntelligence(treeSitterService);
  }
  return intelligenceInstance;
}

/**
 * Reset the code intelligence instance
 */
export function resetCodeIntelligence(): void {
  if (intelligenceInstance) {
    intelligenceInstance.dispose();
    intelligenceInstance = null;
  }
}

// Import Parser type
import Parser from 'web-tree-sitter';
import { getTreeSitterService } from './tree-sitter-service';

export default CodeIntelligence;
