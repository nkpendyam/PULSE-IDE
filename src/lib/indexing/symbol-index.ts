/**
 * Kyro IDE - Symbol Index
 * Fast symbol lookup with comprehensive tracking
 */

import { EventEmitter } from 'events';

// ============================================================================
// TYPES
// ============================================================================

export type SymbolKind =
  | 'function'
  | 'class'
  | 'interface'
  | 'type'
  | 'enum'
  | 'enum_member'
  | 'constant'
  | 'variable'
  | 'method'
  | 'property'
  | 'field'
  | 'namespace'
  | 'module'
  | 'import'
  | 'export'
  | 'parameter'
  | 'type_parameter'
  | 'constructor'
  | 'decorator';

export interface SymbolInfo {
  id: string;
  name: string;
  kind: SymbolKind;
  path: string;
  line: number;
  column: number;
  endLine: number;
  endColumn: number;
  language: string;
  
  // Symbol details
  signature?: string;
  returnType?: string;
  parameters?: ParameterInfo[];
  typeParameters?: string[];
  decorators?: string[];
  modifiers?: string[]; // public, private, static, async, etc.
  documentation?: string;
  
  // Relationships
  parentId?: string;
  parentName?: string;
  children: string[];
  references: SymbolReference[];
  
  // Code context
  content?: string;
  hash: string;
  timestamp: number;
  
  // Metrics
  usageCount: number;
  lastAccessed?: number;
}

export interface ParameterInfo {
  name: string;
  type?: string;
  defaultValue?: string;
  optional: boolean;
  rest: boolean;
}

export interface SymbolReference {
  path: string;
  line: number;
  column: number;
  kind: 'import' | 'call' | 'inheritance' | 'type_usage' | 'reference';
}

export interface SymbolSearchOptions {
  query?: string;
  kinds?: SymbolKind[];
  paths?: string[];
  languages?: string[];
  limit?: number;
  fuzzy?: boolean;
  includeContent?: boolean;
}

export interface SymbolIndexStats {
  totalSymbols: number;
  symbolsByKind: Record<SymbolKind, number>;
  symbolsByLanguage: Record<string, number>;
  symbolCount: number;
  referenceCount: number;
  lastUpdated: Date;
}

// ============================================================================
// SYMBOL INDEX
// ============================================================================

export class SymbolIndex extends EventEmitter {
  // Main storage: id -> SymbolInfo
  private symbols: Map<string, SymbolInfo> = new Map();
  
  // Quick lookup indices
  private nameIndex: Map<string, Set<string>> = new Map(); // lowercase name -> symbol ids
  private pathIndex: Map<string, Set<string>> = new Map(); // path -> symbol ids
  private kindIndex: Map<SymbolKind, Set<string>> = new Map(); // kind -> symbol ids
  private languageIndex: Map<string, Set<string>> = new Map(); // language -> symbol ids
  
  // Trie for prefix search
  private trieRoot: TrieNode = { children: new Map(), symbolIds: new Set() };
  
  // Reference tracking
  private referenceGraph: Map<string, Set<string>> = new Map(); // symbol id -> referenced symbol ids
  private reverseReferenceGraph: Map<string, Set<string>> = new Map(); // symbol id -> referenced by symbol ids

  constructor() {
    super();
  }

  // Add or update a symbol
  addSymbol(symbol: SymbolInfo): void {
    const existing = this.symbols.get(symbol.id);
    
    // Remove from old indices if updating
    if (existing) {
      this.removeFromIndices(existing);
    }
    
    // Store the symbol
    this.symbols.set(symbol.id, symbol);
    
    // Add to indices
    this.addToIndices(symbol);
    
    // Add to trie
    this.addToTrie(symbol.name.toLowerCase(), symbol.id);
    
    this.emit('symbol:added', { id: symbol.id, name: symbol.name, kind: symbol.kind });
  }

  // Add multiple symbols
  addSymbols(symbols: SymbolInfo[]): void {
    for (const symbol of symbols) {
      this.addSymbol(symbol);
    }
    this.emit('symbols:batch-added', { count: symbols.length });
  }

  // Remove a symbol
  removeSymbol(id: string): boolean {
    const symbol = this.symbols.get(id);
    if (!symbol) return false;
    
    // Remove from indices
    this.removeFromIndices(symbol);
    
    // Remove from trie
    this.removeFromTrie(symbol.name.toLowerCase(), id);
    
    // Remove from reference graphs
    this.referenceGraph.delete(id);
    this.reverseReferenceGraph.delete(id);
    
    // Remove parent-child relationships
    if (symbol.parentId) {
      const parent = this.symbols.get(symbol.parentId);
      if (parent) {
        parent.children = parent.children.filter(c => c !== id);
      }
    }
    
    // Remove children references
    for (const childId of symbol.children) {
      const child = this.symbols.get(childId);
      if (child) {
        child.parentId = undefined;
        child.parentName = undefined;
      }
    }
    
    // Delete the symbol
    this.symbols.delete(id);
    
    this.emit('symbol:removed', { id, name: symbol.name });
    return true;
  }

  // Remove all symbols for a path
  removeSymbolsByPath(path: string): number {
    const symbolIds = this.pathIndex.get(path);
    if (!symbolIds) return 0;
    
    const count = symbolIds.size;
    for (const id of symbolIds) {
      this.removeSymbol(id);
    }
    
    this.emit('symbols:path-removed', { path, count });
    return count;
  }

  // Get symbol by ID
  getSymbol(id: string): SymbolInfo | undefined {
    const symbol = this.symbols.get(id);
    if (symbol) {
      symbol.lastAccessed = Date.now();
      symbol.usageCount++;
    }
    return symbol;
  }

  // Search symbols by name
  searchByName(name: string, options: SymbolSearchOptions = {}): SymbolInfo[] {
    const { limit = 50, fuzzy = true } = options;
    const results: SymbolInfo[] = [];
    const lowerName = name.toLowerCase();
    
    // Exact match first
    const exactMatches = this.nameIndex.get(lowerName);
    if (exactMatches) {
      for (const id of exactMatches) {
        const symbol = this.symbols.get(id);
        if (symbol) results.push(symbol);
      }
    }
    
    // Fuzzy search using trie
    if (fuzzy && results.length < limit) {
      const prefixMatches = this.searchTrie(lowerName);
      for (const id of prefixMatches) {
        if (!results.find(r => r.id === id)) {
          const symbol = this.symbols.get(id);
          if (symbol) results.push(symbol);
        }
      }
    }
    
    return this.applyFilters(results.slice(0, limit), options);
  }

  // Advanced symbol search
  search(options: SymbolSearchOptions = {}): SymbolInfo[] {
    const { query, kinds, paths, languages, limit = 50, fuzzy = true } = options;
    
    let candidates: SymbolInfo[] = [];
    
    // If query provided, search by name
    if (query) {
      candidates = this.searchByName(query, { ...options, limit: limit * 2 });
    } else {
      // Get all symbols matching filters
      candidates = this.getSymbolsByFilters(kinds, paths, languages);
    }
    
    // Apply filters
    return this.applyFilters(candidates.slice(0, limit), options);
  }

  // Get symbols by kind
  getSymbolsByKind(kind: SymbolKind): SymbolInfo[] {
    const ids = this.kindIndex.get(kind);
    if (!ids) return [];
    return Array.from(ids)
      .map(id => this.symbols.get(id))
      .filter((s): s is SymbolInfo => s !== undefined);
  }

  // Get symbols by path
  getSymbolsByPath(path: string): SymbolInfo[] {
    const ids = this.pathIndex.get(path);
    if (!ids) return [];
    return Array.from(ids)
      .map(id => this.symbols.get(id))
      .filter((s): s is SymbolInfo => s !== undefined);
  }

  // Get symbols by language
  getSymbolsByLanguage(language: string): SymbolInfo[] {
    const ids = this.languageIndex.get(language);
    if (!ids) return [];
    return Array.from(ids)
      .map(id => this.symbols.get(id))
      .filter((s): s is SymbolInfo => s !== undefined);
  }

  // Get symbol hierarchy (for a class/interface)
  getSymbolHierarchy(id: string): {
    symbol: SymbolInfo;
    children: SymbolInfo[];
    parent?: SymbolInfo;
  } | null {
    const symbol = this.symbols.get(id);
    if (!symbol) return null;
    
    const children = symbol.children
      .map(childId => this.symbols.get(childId))
      .filter((s): s is SymbolInfo => s !== undefined);
    
    const parent = symbol.parentId ? this.symbols.get(symbol.parentId) : undefined;
    
    return { symbol, children, parent };
  }

  // Get references to a symbol
  getReferencesTo(id: string): SymbolReference[] {
    const symbol = this.symbols.get(id);
    return symbol?.references || [];
  }

  // Get symbols referenced by a symbol
  getSymbolsReferencedBy(id: string): SymbolInfo[] {
    const referencedIds = this.referenceGraph.get(id);
    if (!referencedIds) return [];
    
    return Array.from(referencedIds)
      .map(refId => this.symbols.get(refId))
      .filter((s): s is SymbolInfo => s !== undefined);
  }

  // Get symbols that reference this symbol
  getSymbolsThatReference(id: string): SymbolInfo[] {
    const referencedByIds = this.reverseReferenceGraph.get(id);
    if (!referencedByIds) return [];
    
    return Array.from(referencedByIds)
      .map(refId => this.symbols.get(refId))
      .filter((s): s is SymbolInfo => s !== undefined);
  }

  // Add a reference between symbols
  addReference(fromId: string, toId: string): void {
    if (!this.referenceGraph.has(fromId)) {
      this.referenceGraph.set(fromId, new Set());
    }
    this.referenceGraph.get(fromId)!.add(toId);
    
    if (!this.reverseReferenceGraph.has(toId)) {
      this.reverseReferenceGraph.set(toId, new Set());
    }
    this.reverseReferenceGraph.get(toId)!.add(fromId);
  }

  // Get all symbol names (for autocomplete)
  getAllSymbolNames(): string[] {
    return Array.from(this.nameIndex.keys());
  }

  // Get statistics
  getStats(): SymbolIndexStats {
    const symbolsByKind: Record<SymbolKind, number> = {} as Record<SymbolKind, number>;
    const symbolsByLanguage: Record<string, number> = {};
    let referenceCount = 0;
    
    for (const symbol of this.symbols.values()) {
      symbolsByKind[symbol.kind] = (symbolsByKind[symbol.kind] || 0) + 1;
      symbolsByLanguage[symbol.language] = (symbolsByLanguage[symbol.language] || 0) + 1;
      referenceCount += symbol.references.length;
    }
    
    return {
      totalSymbols: this.symbols.size,
      symbolsByKind,
      symbolsByLanguage,
      symbolCount: this.symbols.size,
      referenceCount,
      lastUpdated: new Date(),
    };
  }

  // Clear the index
  clear(): void {
    this.symbols.clear();
    this.nameIndex.clear();
    this.pathIndex.clear();
    this.kindIndex.clear();
    this.languageIndex.clear();
    this.trieRoot = { children: new Map(), symbolIds: new Set() };
    this.referenceGraph.clear();
    this.reverseReferenceGraph.clear();
    
    this.emit('index:cleared');
  }

  // Export to JSON
  export(): string {
    const data = {
      symbols: Array.from(this.symbols.entries()),
      exportedAt: new Date().toISOString(),
    };
    return JSON.stringify(data);
  }

  // Import from JSON
  import(data: string): number {
    try {
      const parsed = JSON.parse(data);
      
      this.clear();
      
      if (parsed.symbols) {
        for (const [, symbol] of parsed.symbols) {
          this.addSymbol(symbol as SymbolInfo);
        }
      }
      
      this.emit('index:imported', { count: this.symbols.size });
      return this.symbols.size;
    } catch (error) {
      console.error('Failed to import symbol index:', error);
      return 0;
    }
  }

  // Private: Add symbol to all indices
  private addToIndices(symbol: SymbolInfo): void {
    // Name index
    const lowerName = symbol.name.toLowerCase();
    if (!this.nameIndex.has(lowerName)) {
      this.nameIndex.set(lowerName, new Set());
    }
    this.nameIndex.get(lowerName)!.add(symbol.id);
    
    // Path index
    if (!this.pathIndex.has(symbol.path)) {
      this.pathIndex.set(symbol.path, new Set());
    }
    this.pathIndex.get(symbol.path)!.add(symbol.id);
    
    // Kind index
    if (!this.kindIndex.has(symbol.kind)) {
      this.kindIndex.set(symbol.kind, new Set());
    }
    this.kindIndex.get(symbol.kind)!.add(symbol.id);
    
    // Language index
    if (!this.languageIndex.has(symbol.language)) {
      this.languageIndex.set(symbol.language, new Set());
    }
    this.languageIndex.get(symbol.language)!.add(symbol.id);
  }

  // Private: Remove symbol from all indices
  private removeFromIndices(symbol: SymbolInfo): void {
    // Name index
    const lowerName = symbol.name.toLowerCase();
    this.nameIndex.get(lowerName)?.delete(symbol.id);
    if (this.nameIndex.get(lowerName)?.size === 0) {
      this.nameIndex.delete(lowerName);
    }
    
    // Path index
    this.pathIndex.get(symbol.path)?.delete(symbol.id);
    if (this.pathIndex.get(symbol.path)?.size === 0) {
      this.pathIndex.delete(symbol.path);
    }
    
    // Kind index
    this.kindIndex.get(symbol.kind)?.delete(symbol.id);
    if (this.kindIndex.get(symbol.kind)?.size === 0) {
      this.kindIndex.delete(symbol.kind);
    }
    
    // Language index
    this.languageIndex.get(symbol.language)?.delete(symbol.id);
    if (this.languageIndex.get(symbol.language)?.size === 0) {
      this.languageIndex.delete(symbol.language);
    }
  }

  // Private: Add to trie
  private addToTrie(name: string, symbolId: string): void {
    let node = this.trieRoot;
    
    for (const char of name) {
      if (!node.children.has(char)) {
        node.children.set(char, { children: new Map(), symbolIds: new Set() });
      }
      node = node.children.get(char)!;
    }
    
    node.symbolIds.add(symbolId);
  }

  // Private: Remove from trie
  private removeFromTrie(name: string, symbolId: string): void {
    const path: TrieNode[] = [this.trieRoot];
    let node = this.trieRoot;
    
    for (const char of name) {
      if (!node.children.has(char)) return;
      node = node.children.get(char)!;
      path.push(node);
    }
    
    node.symbolIds.delete(symbolId);
    
    // Clean up empty nodes (optional, for memory efficiency)
    // Going backwards and removing empty nodes
    for (let i = path.length - 1; i > 0; i--) {
      const currentNode = path[i];
      if (currentNode.symbolIds.size === 0 && currentNode.children.size === 0) {
        const prevNode = path[i - 1];
        prevNode.children.delete(name[i - 1]);
      } else {
        break;
      }
    }
  }

  // Private: Search trie for prefix matches
  private searchTrie(prefix: string): string[] {
    let node = this.trieRoot;
    
    // Navigate to the prefix node
    for (const char of prefix) {
      if (!node.children.has(char)) return [];
      node = node.children.get(char)!;
    }
    
    // Collect all symbol IDs from this node and its descendants
    const results: string[] = [];
    this.collectTrieIds(node, results);
    return results;
  }

  // Private: Collect all IDs from a trie node
  private collectTrieIds(node: TrieNode, results: string[]): void {
    results.push(...node.symbolIds);
    for (const child of node.children.values()) {
      this.collectTrieIds(child, results);
    }
  }

  // Private: Get symbols by multiple filters
  private getSymbolsByFilters(
    kinds?: SymbolKind[],
    paths?: string[],
    languages?: string[]
  ): SymbolInfo[] {
    let candidates: SymbolInfo[] = Array.from(this.symbols.values());
    
    if (kinds && kinds.length > 0) {
      const ids = new Set<string>();
      for (const kind of kinds) {
        const kindIds = this.kindIndex.get(kind);
        if (kindIds) {
          for (const id of kindIds) ids.add(id);
        }
      }
      candidates = candidates.filter(s => ids.has(s.id));
    }
    
    if (paths && paths.length > 0) {
      const ids = new Set<string>();
      for (const path of paths) {
        const pathIds = this.pathIndex.get(path);
        if (pathIds) {
          for (const id of pathIds) ids.add(id);
        }
      }
      candidates = candidates.filter(s => ids.has(s.id));
    }
    
    if (languages && languages.length > 0) {
      const ids = new Set<string>();
      for (const lang of languages) {
        const langIds = this.languageIndex.get(lang);
        if (langIds) {
          for (const id of langIds) ids.add(id);
        }
      }
      candidates = candidates.filter(s => ids.has(s.id));
    }
    
    return candidates;
  }

  // Private: Apply filters to results
  private applyFilters(symbols: SymbolInfo[], options: SymbolSearchOptions): SymbolInfo[] {
    let results = symbols;
    
    const { kinds, paths, languages } = options;
    
    if (kinds && kinds.length > 0) {
      results = results.filter(s => kinds.includes(s.kind));
    }
    
    if (paths && paths.length > 0) {
      results = results.filter(s => paths.includes(s.path));
    }
    
    if (languages && languages.length > 0) {
      results = results.filter(s => languages.includes(s.language));
    }
    
    return results;
  }
}

// ============================================================================
// TRIE NODE
// ============================================================================

interface TrieNode {
  children: Map<string, TrieNode>;
  symbolIds: Set<string>;
}

// ============================================================================
// SYMBOL EXTRACTOR
// ============================================================================

export class SymbolExtractor {
  // Extract symbols from code content
  extractSymbols(
    content: string,
    path: string,
    language: string
  ): SymbolInfo[] {
    const symbols: SymbolInfo[] = [];
    const lines = content.split('\n');
    
    // Use language-specific patterns
    const patterns = this.getPatterns(language);
    
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];
      
      for (const pattern of patterns) {
        const regex = new RegExp(pattern.regex, 'g');
        let match;
        
        while ((match = regex.exec(line)) !== null) {
          const symbol = this.createSymbol(
            match,
            pattern.kind,
            path,
            lineIndex + 1,
            match.index + 1,
            language,
            content,
            lines
          );
          
          if (symbol) {
            symbols.push(symbol);
          }
        }
      }
    }
    
    // Resolve parent-child relationships
    this.resolveRelationships(symbols);
    
    return symbols;
  }

  // Get patterns for a language
  private getPatterns(language: string): Array<{ regex: string; kind: SymbolKind }> {
    const patterns: Array<{ regex: string; kind: SymbolKind }> = [];
    
    switch (language) {
      case 'typescript':
      case 'typescriptreact':
      case 'javascript':
      case 'javascriptreact':
        patterns.push(
          // Classes
          { regex: '(?:export\\s+)?(?:default\\s+)?(?:abstract\\s+)?class\\s+(\\w+)', kind: 'class' },
          // Interfaces
          { regex: '(?:export\\s+)?interface\\s+(\\w+)', kind: 'interface' },
          // Types
          { regex: '(?:export\\s+)?type\\s+(\\w+)', kind: 'type' },
          // Enums
          { regex: '(?:export\\s+)?enum\\s+(\\w+)', kind: 'enum' },
          // Functions
          { regex: '(?:export\\s+)?(?:async\\s+)?function\\s+(\\w+)', kind: 'function' },
          // Arrow functions / const
          { regex: '(?:export\\s+)?(?:const|let|var)\\s+(\\w+)\\s*[=:]', kind: 'variable' },
          // Methods
          { regex: '(?:public|private|protected)?\\s*(?:async\\s+)?(\\w+)\\s*\\([^)]*\\)\\s*(?::\\s*\\w+)?\\s*\\{', kind: 'method' },
        );
        break;
        
      case 'python':
        patterns.push(
          { regex: 'class\\s+(\\w+)', kind: 'class' },
          { regex: 'def\\s+(\\w+)', kind: 'function' },
          { regex: '(\\w+)\\s*=\\s*(?:def|lambda)', kind: 'variable' },
        );
        break;
        
      case 'go':
        patterns.push(
          { regex: 'type\\s+(\\w+)\\s+struct', kind: 'class' },
          { regex: 'type\\s+(\\w+)\\s+interface', kind: 'interface' },
          { regex: 'func\\s+(?:\\([^)]+\\)\\s+)?(\\w+)', kind: 'function' },
        );
        break;
        
      case 'rust':
        patterns.push(
          { regex: '(?:pub\\s+)?struct\\s+(\\w+)', kind: 'class' },
          { regex: '(?:pub\\s+)?trait\\s+(\\w+)', kind: 'interface' },
          { regex: '(?:pub\\s+)?enum\\s+(\\w+)', kind: 'enum' },
          { regex: '(?:pub\\s+)?fn\\s+(\\w+)', kind: 'function' },
        );
        break;
        
      case 'java':
        patterns.push(
          { regex: '(?:public|private|protected)?\\s*(?:abstract|final)?\\s*class\\s+(\\w+)', kind: 'class' },
          { regex: '(?:public|private|protected)?\\s*interface\\s+(\\w+)', kind: 'interface' },
          { regex: '(?:public|private|protected)?\\s*(?:static)?\\s*(?:\\w+)\\s+(\\w+)\\s*\\(', kind: 'method' },
        );
        break;
        
      default:
        // Generic patterns
        patterns.push(
          { regex: 'function\\s+(\\w+)', kind: 'function' },
          { regex: 'class\\s+(\\w+)', kind: 'class' },
          { regex: 'interface\\s+(\\w+)', kind: 'interface' },
        );
    }
    
    return patterns;
  }

  // Create a symbol from a regex match
  private createSymbol(
    match: RegExpExecArray,
    kind: SymbolKind,
    path: string,
    line: number,
    column: number,
    language: string,
    _content: string,
    lines: string[]
  ): SymbolInfo | null {
    const name = match[1];
    if (!name) return null;
    
    // Find the end of the symbol (simplified)
    const endLine = this.findSymbolEnd(lines, line - 1, kind);
    
    const symbolContent = lines.slice(line - 1, endLine).join('\n');
    
    return {
      id: `${path}:${kind}:${name}:${line}`,
      name,
      kind,
      path,
      line,
      column,
      endLine,
      endColumn: lines[endLine - 1]?.length || 0,
      language,
      content: symbolContent,
      hash: this.hashContent(symbolContent),
      timestamp: Date.now(),
      children: [],
      references: [],
      usageCount: 0,
    };
  }

  // Find the end line of a symbol
  private findSymbolEnd(lines: string[], startLine: number, kind: SymbolKind): number {
    let braceCount = 0;
    let foundStart = false;
    
    for (let i = startLine; i < lines.length; i++) {
      const line = lines[i];
      
      for (const char of line) {
        if (char === '{') {
          braceCount++;
          foundStart = true;
        } else if (char === '}') {
          braceCount--;
        }
      }
      
      if (foundStart && braceCount === 0) {
        return i + 1;
      }
      
      // For single-line declarations
      if (!foundStart && i > startLine && !line.trim().startsWith('//') && line.trim().length > 0) {
        return i;
      }
    }
    
    return lines.length;
  }

  // Resolve parent-child relationships
  private resolveRelationships(symbols: SymbolInfo[]): void {
    // Sort by line number
    symbols.sort((a, b) => a.line - b.line);
    
    // Stack to track nesting
    const stack: SymbolInfo[] = [];
    
    for (const symbol of symbols) {
      // Pop symbols that have ended
      while (stack.length > 0 && stack[stack.length - 1].endLine < symbol.line) {
        stack.pop();
      }
      
      // If there's a parent on the stack, set up the relationship
      if (stack.length > 0) {
        const parent = stack[stack.length - 1];
        symbol.parentId = parent.id;
        symbol.parentName = parent.name;
        parent.children.push(symbol.id);
      }
      
      // Push this symbol onto the stack
      stack.push(symbol);
    }
  }

  // Hash content
  private hashContent(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let symbolIndexInstance: SymbolIndex | null = null;
let symbolExtractorInstance: SymbolExtractor | null = null;

export function getSymbolIndex(): SymbolIndex {
  if (!symbolIndexInstance) {
    symbolIndexInstance = new SymbolIndex();
  }
  return symbolIndexInstance;
}

export function getSymbolExtractor(): SymbolExtractor {
  if (!symbolExtractorInstance) {
    symbolExtractorInstance = new SymbolExtractor();
  }
  return symbolExtractorInstance;
}
