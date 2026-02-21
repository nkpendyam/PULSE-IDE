'use client';

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  ChevronDown,
  ChevronRight,
  FunctionSquare,
  Box,
  FileCode,
  Type,
  Variable,
  Hash,
  Import,
  Export,
  Braces,
  Circle,
  ChevronUp,
  Search,
  X,
  Layers,
  SortAsc,
  Filter,
  MoreHorizontal,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { LSPSymbol, SymbolKind, LSPRange } from '@/lib/lsp';

// ============================================================================
// TYPES
// ============================================================================

export interface Symbol {
  id: string;
  name: string;
  type: 'function' | 'class' | 'interface' | 'variable' | 'constant' | 'import' | 'export' | 'method' | 'property' | 'field' | 'enum' | 'struct' | 'namespace' | 'module' | 'constructor' | 'type' | 'other';
  kind: SymbolKind;
  line: number;
  endLine?: number;
  column: number;
  range: LSPRange;
  children?: Symbol[];
  signature?: string;
  detail?: string;
  modifiers?: ('public' | 'private' | 'protected' | 'static' | 'async' | 'readonly' | 'abstract' | 'deprecated')[];
}

export interface OutlineViewProps {
  /** Symbols from LSP documentSymbol request */
  symbols?: Symbol[];
  /** Raw LSP symbols to convert */
  lspSymbols?: LSPSymbol[];
  /** Callback when navigating to a symbol */
  onNavigate?: (symbol: Symbol) => void;
  /** Current cursor line (0-indexed) for syncing */
  cursorLine?: number;
  /** Current cursor character (0-indexed) for syncing */
  cursorCharacter?: number;
  /** Whether to auto-scroll to the current symbol */
  autoScrollToSymbol?: boolean;
  /** Whether to highlight the current symbol */
  highlightCurrentSymbol?: boolean;
  /** Additional CSS classes */
  className?: string;
}

type SortMode = 'default' | 'name' | 'type' | 'line';
type FilterMode = 'all' | 'classes' | 'functions' | 'variables' | 'imports';

// ============================================================================
// SYMBOL UTILITIES
// ============================================================================

function symbolKindToType(kind: SymbolKind): Symbol['type'] {
  switch (kind) {
    case SymbolKind.Class: return 'class';
    case SymbolKind.Interface: return 'interface';
    case SymbolKind.Function: return 'function';
    case SymbolKind.Method: return 'method';
    case SymbolKind.Property: return 'property';
    case SymbolKind.Field: return 'field';
    case SymbolKind.Variable: return 'variable';
    case SymbolKind.Constant: return 'constant';
    case SymbolKind.Enum: return 'enum';
    case SymbolKind.Struct: return 'struct';
    case SymbolKind.Namespace: return 'namespace';
    case SymbolKind.Module: return 'module';
    case SymbolKind.Constructor: return 'constructor';
    case SymbolKind.TypeParameter: return 'type';
    default: return 'other';
  }
}

function getSymbolIcon(type: Symbol['type'], kind: SymbolKind): React.ReactNode {
  switch (type) {
    case 'function':
    case 'method':
    case 'constructor':
      return <FunctionSquare className="h-3.5 w-3.5 text-purple-400" />;
    case 'class':
      return <Box className="h-3.5 w-3.5 text-yellow-400" />;
    case 'interface':
      return <Braces className="h-3.5 w-3.5 text-blue-400" />;
    case 'variable':
    case 'field':
      return <Variable className="h-3.5 w-3.5 text-cyan-400" />;
    case 'constant':
      return <Hash className="h-3.5 w-3.5 text-cyan-300" />;
    case 'property':
      return <Type className="h-3.5 w-3.5 text-pink-400" />;
    case 'enum':
    case 'struct':
    case 'type':
      return <Braces className="h-3.5 w-3.5 text-orange-400" />;
    case 'namespace':
    case 'module':
      return <Layers className="h-3.5 w-3.5 text-green-400" />;
    default:
      return <Circle className="h-3.5 w-3.5 text-gray-400" />;
  }
}

function getSymbolTypeColor(type: Symbol['type']): string {
  switch (type) {
    case 'function':
    case 'method':
    case 'constructor': return 'text-purple-400';
    case 'class': return 'text-yellow-400';
    case 'interface': return 'text-blue-400';
    case 'variable':
    case 'field': return 'text-cyan-400';
    case 'constant': return 'text-cyan-300';
    case 'property': return 'text-pink-400';
    case 'enum':
    case 'struct':
    case 'type': return 'text-orange-400';
    case 'namespace':
    case 'module': return 'text-green-400';
    default: return 'text-gray-400';
  }
}

function getModifierColor(modifier: string): string {
  switch (modifier) {
    case 'public': return 'text-green-400 border-green-500/30';
    case 'private': return 'text-red-400 border-red-500/30';
    case 'protected': return 'text-yellow-400 border-yellow-500/30';
    case 'static': return 'text-blue-400 border-blue-500/30';
    case 'async': return 'text-purple-400 border-purple-500/30';
    case 'readonly': return 'text-cyan-400 border-cyan-500/30';
    case 'abstract': return 'text-orange-400 border-orange-500/30';
    case 'deprecated': return 'text-gray-400 border-gray-500/30 line-through';
    default: return 'text-gray-400 border-gray-500/30';
  }
}

// ============================================================================
// CONVERT LSP SYMBOLS TO OUTLINE SYMBOLS
// ============================================================================

function convertLSPSymbolToSymbol(lspSymbol: LSPSymbol, parentPath: string = ''): Symbol {
  const id = `${parentPath}/${lspSymbol.name}:${lspSymbol.range.start.line}`;
  const type = symbolKindToType(lspSymbol.kind);
  
  return {
    id,
    name: lspSymbol.name,
    type,
    kind: lspSymbol.kind,
    line: lspSymbol.range.start.line,
    endLine: lspSymbol.range.end.line,
    column: lspSymbol.range.start.character,
    range: lspSymbol.range,
    detail: lspSymbol.detail,
    children: lspSymbol.children?.map(child => convertLSPSymbolToSymbol(child, id)),
  };
}

// ============================================================================
// SYMBOL NODE COMPONENT
// ============================================================================

interface SymbolNodeProps {
  symbol: Symbol;
  depth: number;
  onNavigate: (symbol: Symbol) => void;
  expandedIds: Set<string>;
  toggleExpand: (id: string) => void;
  currentSymbolId?: string;
  highlightCurrent?: boolean;
  searchQuery: string;
}

function SymbolNode({
  symbol,
  depth,
  onNavigate,
  expandedIds,
  toggleExpand,
  currentSymbolId,
  highlightCurrent,
  searchQuery,
}: SymbolNodeProps) {
  const hasChildren = symbol.children && symbol.children.length > 0;
  const isExpanded = expandedIds.has(symbol.id);
  const isCurrent = currentSymbolId === symbol.id;
  
  // Highlight matching text in search
  const highlightedName = useMemo(() => {
    if (!searchQuery) return symbol.name;
    const index = symbol.name.toLowerCase().indexOf(searchQuery.toLowerCase());
    if (index === -1) return symbol.name;
    return (
      <>
        {symbol.name.slice(0, index)}
        <span className="bg-yellow-500/30 rounded px-0.5">
          {symbol.name.slice(index, index + searchQuery.length)}
        </span>
        {symbol.name.slice(index + searchQuery.length)}
      </>
    );
  }, [symbol.name, searchQuery]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasChildren && e.shiftKey) {
      toggleExpand(symbol.id);
    } else {
      onNavigate(symbol);
    }
  }, [hasChildren, onNavigate, symbol, toggleExpand]);

  const handleExpandClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    toggleExpand(symbol.id);
  }, [symbol.id, toggleExpand]);

  return (
    <div className="select-none">
      <div
        className={cn(
          'flex items-center gap-1 py-0.5 px-1 hover:bg-accent/50 rounded cursor-pointer text-sm transition-colors group',
          isCurrent && highlightCurrent && 'bg-primary/10 border-l-2 border-primary',
          symbol.modifiers?.includes('deprecated') && 'opacity-60'
        )}
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
        onClick={handleClick}
      >
        {hasChildren ? (
          <button
            onClick={handleExpandClick}
            className="p-0.5 hover:bg-accent rounded shrink-0"
          >
            {isExpanded ? (
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3 w-3 text-muted-foreground" />
            )}
          </button>
        ) : (
          <span className="w-4 shrink-0" />
        )}
        
        {getSymbolIcon(symbol.type, symbol.kind)}
        
        <span className={cn('truncate', isCurrent && 'font-medium')}>
          {highlightedName}
        </span>
        
        {symbol.modifiers && symbol.modifiers.length > 0 && (
          <div className="flex items-center gap-0.5 ml-1">
            {symbol.modifiers.map(mod => (
              <Badge
                key={mod}
                variant="outline"
                className={cn('text-[9px] px-1 py-0 h-3.5 border', getModifierColor(mod))}
              >
                {mod}
              </Badge>
            ))}
          </div>
        )}
        
        {symbol.detail && (
          <span className="text-muted-foreground text-[10px] truncate ml-1 max-w-[100px]">
            {symbol.detail}
          </span>
        )}
        
        <span className="text-muted-foreground text-[10px] ml-auto opacity-0 group-hover:opacity-100 shrink-0">
          :{symbol.line + 1}
        </span>
      </div>
      
      {hasChildren && isExpanded && (
        <div>
          {symbol.children!.map(child => (
            <SymbolNode
              key={child.id}
              symbol={child}
              depth={depth + 1}
              onNavigate={onNavigate}
              expandedIds={expandedIds}
              toggleExpand={toggleExpand}
              currentSymbolId={currentSymbolId}
              highlightCurrent={highlightCurrent}
              searchQuery={searchQuery}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// MAIN OUTLINE VIEW COMPONENT
// ============================================================================

export default function OutlineView({
  symbols: propSymbols,
  lspSymbols,
  onNavigate,
  cursorLine,
  cursorCharacter,
  autoScrollToSymbol = true,
  highlightCurrentSymbol = true,
  className,
}: OutlineViewProps) {
  // Convert LSP symbols if provided
  const symbols = useMemo(() => {
    if (propSymbols) return propSymbols;
    if (lspSymbols) return lspSymbols.map(s => convertLSPSymbolToSymbol(s));
    return [];
  }, [propSymbols, lspSymbols]);

  // State
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    // Initially expand all symbols with children
    const expandAll = (syms: Symbol[]): string[] => {
      return syms.flatMap(s => 
        s.children && s.children.length > 0 
          ? [s.id, ...expandAll(s.children)] 
          : []
      );
    };
    return new Set(expandAll(symbols));
  });
  
  const [filterText, setFilterText] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('default');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [showImports, setShowImports] = useState(true);
  const [showPrivate, setShowPrivate] = useState(true);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const currentSymbolRef = useRef<HTMLDivElement>(null);

  // Get all symbol IDs that should be expanded
  const allSymbolIds = useMemo(() => {
    const getAllIds = (syms: Symbol[]): string[] => {
      return syms.flatMap(s => 
        s.children && s.children.length > 0 
          ? [s.id, ...getAllIds(s.children)] 
          : []
      );
    };
    return new Set(getAllIds(symbols));
  }, [symbols]);

  // Find current symbol at cursor position
  const currentSymbol = useMemo(() => {
    if (cursorLine === undefined) return undefined;
    
    const findSymbolAtLine = (syms: Symbol[]): Symbol | undefined => {
      for (const sym of syms) {
        // Check if cursor is within this symbol's range
        const startLine = sym.line;
        const endLine = sym.endLine ?? sym.line;
        
        if (cursorLine >= startLine && cursorLine <= endLine) {
          // Check children first (more specific match)
          if (sym.children && sym.children.length > 0) {
            const childMatch = findSymbolAtLine(sym.children);
            if (childMatch) return childMatch;
          }
          return sym;
        }
      }
      return undefined;
    };

    return findSymbolAtLine(symbols);
  }, [symbols, cursorLine]);

  // Compute path to current symbol for auto-expand
  const pathToCurrentSymbol = useMemo(() => {
    if (!currentSymbol || !autoScrollToSymbol) return [];
    
    const pathToSymbol = (syms: Symbol[], target: Symbol, path: string[] = []): string[] | null => {
      for (const sym of syms) {
        if (sym.id === target.id) return [...path, sym.id];
        if (sym.children) {
          const found = pathToSymbol(sym.children, target, [...path, sym.id]);
          if (found) return found;
        }
      }
      return null;
    };
    
    return pathToSymbol(symbols, currentSymbol) || [];
  }, [currentSymbol, symbols, autoScrollToSymbol]);

  // Merge expanded IDs with path to current symbol
  const effectiveExpandedIds = useMemo(() => {
    if (pathToCurrentSymbol.length === 0) return expandedIds;
    const newSet = new Set(expandedIds);
    pathToCurrentSymbol.forEach(id => newSet.add(id));
    return newSet;
  }, [expandedIds, pathToCurrentSymbol]);

  // Auto-scroll to current symbol
  useEffect(() => {
    if (currentSymbolRef.current && autoScrollToSymbol) {
      currentSymbolRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [currentSymbol, autoScrollToSymbol]);

  // Toggle expand/collapse
  const toggleExpand = useCallback((id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Expand all
  const handleExpandAll = useCallback(() => {
    setExpandedIds(allSymbolIds);
  }, [allSymbolIds]);

  // Collapse all
  const handleCollapseAll = useCallback(() => {
    setExpandedIds(new Set());
  }, []);

  // Navigate to symbol
  const handleNavigate = useCallback((symbol: Symbol) => {
    onNavigate?.(symbol);
  }, [onNavigate]);

  // Filter symbols
  const filteredSymbols = useMemo(() => {
    if (!filterText && filterMode === 'all' && showImports && showPrivate) {
      return symbols;
    }

    const filterByMode = (sym: Symbol): boolean => {
      // Filter by type
      if (filterMode !== 'all') {
        switch (filterMode) {
          case 'classes':
            if (sym.type !== 'class' && sym.type !== 'interface' && sym.type !== 'struct' && sym.type !== 'enum') return false;
            break;
          case 'functions':
            if (sym.type !== 'function' && sym.type !== 'method' && sym.type !== 'constructor') return false;
            break;
          case 'variables':
            if (sym.type !== 'variable' && sym.type !== 'field' && sym.type !== 'property' && sym.type !== 'constant') return false;
            break;
          case 'imports':
            if (sym.type !== 'import' && sym.type !== 'export') return false;
            break;
        }
      }

      // Filter imports
      if (!showImports && (sym.type === 'import' || sym.type === 'export')) {
        return false;
      }

      // Filter private members
      if (!showPrivate && sym.modifiers?.includes('private')) {
        return false;
      }

      return true;
    };

    const filter = (syms: Symbol[]): Symbol[] => {
      return syms.reduce((acc, sym) => {
        const matchesText = !filterText || sym.name.toLowerCase().includes(filterText.toLowerCase());
        const matchesMode = filterByMode(sym);
        const filteredChildren = sym.children ? filter(sym.children) : undefined;
        
        if ((matchesText && matchesMode) || (filteredChildren && filteredChildren.length > 0)) {
          acc.push({ ...sym, children: filteredChildren && filteredChildren.length > 0 ? filteredChildren : sym.children });
        }
        return acc;
      }, [] as Symbol[]);
    };

    return filter(symbols);
  }, [symbols, filterText, filterMode, showImports, showPrivate]);

  // Sort symbols
  const sortedSymbols = useMemo(() => {
    if (sortMode === 'default') return filteredSymbols;

    const sort = (syms: Symbol[]): Symbol[] => {
      const sorted = [...syms];
      
      switch (sortMode) {
        case 'name':
          sorted.sort((a, b) => a.name.localeCompare(b.name));
          break;
        case 'type':
          sorted.sort((a, b) => a.type.localeCompare(b.type));
          break;
        case 'line':
          sorted.sort((a, b) => a.line - b.line);
          break;
      }
      
      return sorted.map(s => ({
        ...s,
        children: s.children ? sort(s.children) : s.children,
      }));
    };

    return sort(filteredSymbols);
  }, [filteredSymbols, sortMode]);

  // Count total symbols
  const totalSymbols = useMemo(() => {
    const count = (syms: Symbol[]): number => syms.reduce((acc, s) => acc + 1 + (s.children ? count(s.children) : 0), 0);
    return count(symbols);
  }, [symbols]);

  return (
    <div className={cn('h-full flex flex-col', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-2 py-1.5 border-b shrink-0">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Outline</span>
        <div className="flex items-center gap-0.5">
          <Button
            size="sm"
            variant="ghost"
            className="h-5 w-5 p-0"
            onClick={handleExpandAll}
            title="Expand all"
          >
            <ChevronDown className="h-3 w-3" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-5 w-5 p-0"
            onClick={handleCollapseAll}
            title="Collapse all"
          >
            <ChevronUp className="h-3 w-3" />
          </Button>
          
          {/* More options dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost" className="h-5 w-5 p-0">
                <MoreHorizontal className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuLabel className="text-xs">Sort By</DropdownMenuLabel>
              <DropdownMenuCheckboxItem
                checked={sortMode === 'default'}
                onCheckedChange={() => setSortMode('default')}
              >
                Default
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={sortMode === 'name'}
                onCheckedChange={() => setSortMode('name')}
              >
                Name
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={sortMode === 'type'}
                onCheckedChange={() => setSortMode('type')}
              >
                Type
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={sortMode === 'line'}
                onCheckedChange={() => setSortMode('line')}
              >
                Line
              </DropdownMenuCheckboxItem>
              
              <DropdownMenuSeparator />
              
              <DropdownMenuLabel className="text-xs">Filter</DropdownMenuLabel>
              <DropdownMenuCheckboxItem
                checked={filterMode === 'all'}
                onCheckedChange={() => setFilterMode('all')}
              >
                All Symbols
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={filterMode === 'classes'}
                onCheckedChange={() => setFilterMode('classes')}
              >
                Classes & Interfaces
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={filterMode === 'functions'}
                onCheckedChange={() => setFilterMode('functions')}
              >
                Functions & Methods
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={filterMode === 'variables'}
                onCheckedChange={() => setFilterMode('variables')}
              >
                Variables & Properties
              </DropdownMenuCheckboxItem>
              
              <DropdownMenuSeparator />
              
              <DropdownMenuCheckboxItem
                checked={showImports}
                onCheckedChange={setShowImports}
              >
                Show Imports
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={showPrivate}
                onCheckedChange={setShowPrivate}
              >
                Show Private Members
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Search/Filter input */}
      <div className="px-2 py-1.5 border-b shrink-0">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <Input
            type="text"
            value={filterText}
            onChange={e => setFilterText(e.target.value)}
            placeholder="Filter symbols..."
            className="h-6 pl-6 pr-6 text-xs"
          />
          {filterText && (
            <Button
              size="sm"
              variant="ghost"
              className="absolute right-0 top-1/2 -translate-y-1/2 h-5 w-5 p-0"
              onClick={() => setFilterText('')}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      {/* Symbol tree */}
      <ScrollArea className="flex-1" ref={scrollRef}>
        <div className="py-1">
          {sortedSymbols.length === 0 ? (
            <div className="px-3 py-2 text-xs text-muted-foreground">
              {filterText ? 'No symbols match filter' : 'No symbols found'}
            </div>
          ) : (
            sortedSymbols.map(symbol => (
              <SymbolNode
                key={symbol.id}
                symbol={symbol}
                depth={0}
                onNavigate={handleNavigate}
                expandedIds={effectiveExpandedIds}
                toggleExpand={toggleExpand}
                currentSymbolId={currentSymbol?.id}
                highlightCurrent={highlightCurrentSymbol}
                searchQuery={filterText}
              />
            ))
          )}
        </div>
      </ScrollArea>

      {/* Footer with stats */}
      <div className="flex items-center justify-between px-2 py-1 border-t text-[10px] text-muted-foreground shrink-0">
        <span>
          {totalSymbols} symbol{totalSymbols !== 1 ? 's' : ''}
          {filteredSymbols.length !== totalSymbols && ` (${filteredSymbols.length} shown)`}
        </span>
        {currentSymbol && (
          <span className="text-primary">
            {currentSymbol.name}
          </span>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// UTILITY: PARSE CODE TO SYMBOLS (FALLBACK WITHOUT LSP)
// ============================================================================

/**
 * Parse TypeScript/JavaScript code to extract symbols
 * This is a fallback when no LSP is available
 */
export function parseCodeToSymbols(code: string, language: string): Symbol[] {
  const symbols: Symbol[] = [];
  const lines = code.split('\n');
  let symbolId = 0;

  // Simple regex patterns for symbol detection
  const patterns = {
    class: /^\s*(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/,
    interface: /^\s*(?:export\s+)?interface\s+(\w+)/,
    function: /^\s*(?:export\s+)?(?:async\s+)?function\s+(\w+)/,
    arrowFunction: /^\s*(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\([^)]*\)\s*(?::\s*[^=]+)?\s*=>/,
    method: /^\s*(?:public|private|protected)?\s*(?:static\s+)?(?:async\s+)?(\w+)\s*\([^)]*\)\s*(?::\s*[^{]+)?\s*\{/,
    property: /^\s*(?:public|private|protected)?\s*(?:readonly\s+)?(\w+)\s*(?::\s*[^=;]+)?\s*[=;]/,
    const: /^\s*(?:export\s+)?const\s+(\w+)\s*=/,
    import: /^\s*import\s+.*?from\s+['"]([^'"]+)['"]/,
    export: /^\s*export\s+(?:default\s+)?(?:function|class|const|let|var)\s+(\w+)/,
  };

  // Track class scope for nested symbols
  let currentClass: Symbol | null = null;
  let braceDepth = 0;

  lines.forEach((line, lineIndex) => {
    braceDepth += (line.match(/\{/g) || []).length;
    braceDepth -= (line.match(/\}/g) || []).length;

    // Check if we've exited the current class
    if (currentClass && braceDepth <= 1) {
      currentClass = null;
    }

    // Try each pattern
    for (const [type, pattern] of Object.entries(patterns)) {
      const match = line.match(pattern);
      if (match) {
        const id = `symbol-${symbolId++}`;
        const name = match[1] || 'anonymous';
        
        const symbol: Symbol = {
          id,
          name,
          type: type as Symbol['type'],
          kind: type === 'class' ? SymbolKind.Class :
                type === 'interface' ? SymbolKind.Interface :
                type === 'function' || type === 'arrowFunction' ? SymbolKind.Function :
                type === 'method' ? SymbolKind.Method :
                type === 'property' ? SymbolKind.Property :
                type === 'const' ? SymbolKind.Constant :
                type === 'import' ? SymbolKind.Module :
                SymbolKind.Variable,
          line: lineIndex,
          column: match.index || 0,
          range: {
            start: { line: lineIndex, character: match.index || 0 },
            end: { line: lineIndex, character: line.length },
          },
          modifiers: [],
        };

        // Detect modifiers
        if (line.includes('export')) symbol.modifiers?.push('export');
        if (line.includes('async')) symbol.modifiers?.push('async');
        if (line.includes('static')) symbol.modifiers?.push('static');
        if (line.includes('private')) symbol.modifiers?.push('private');
        if (line.includes('public')) symbol.modifiers?.push('public');
        if (line.includes('protected')) symbol.modifiers?.push('protected');
        if (line.includes('readonly')) symbol.modifiers?.push('readonly');
        if (line.includes('abstract')) symbol.modifiers?.push('abstract');

        // Handle class nesting
        if (type === 'class' || type === 'interface') {
          currentClass = symbol;
          symbols.push(symbol);
        } else if (currentClass && (type === 'method' || type === 'property')) {
          if (!currentClass.children) currentClass.children = [];
          currentClass.children.push(symbol);
        } else if (type !== 'import') {
          symbols.push(symbol);
        }

        break;
      }
    }
  });

  return symbols;
}

// ============================================================================
// RE-EXPORT LSP TYPES
// ============================================================================

export { SymbolKind, LSPRange } from '@/lib/lsp';
