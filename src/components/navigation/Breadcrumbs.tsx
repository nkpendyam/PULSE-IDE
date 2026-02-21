'use client';

import React, { useMemo, useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronRight, FileCode, Folder, Home, ChevronDown, Hash, FunctionSquare, Box, Braces, Variable, Type } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { LSPSymbol, SymbolKind } from '@/lib/lsp';

// ============================================================================
// TYPES
// ============================================================================

export interface BreadcrumbItem {
  name: string;
  path: string;
  type: 'folder' | 'file' | 'symbol';
  children?: BreadcrumbItem[];
  icon?: React.ReactNode;
}

export interface SymbolBreadcrumb {
  name: string;
  kind: SymbolKind;
  range: { start: { line: number; character: number }; end: { line: number; character: number } };
  detail?: string;
}

export interface BreadcrumbsProps {
  /** Full file path (e.g., /src/components/Button.tsx) */
  filePath?: string;
  /** Current symbol at cursor position */
  currentSymbol?: SymbolBreadcrumb;
  /** All symbols in the document for breadcrumb navigation */
  documentSymbols?: LSPSymbol[];
  /** Symbol breadcrumbs (symbol hierarchy at cursor position) */
  symbolBreadcrumbs?: SymbolBreadcrumb[];
  /** Callback when navigating to a path */
  onNavigate?: (path: string) => void;
  /** Callback when navigating to a symbol */
  onSymbolNavigate?: (symbol: SymbolBreadcrumb) => void;
  /** Current cursor line (1-indexed for display) */
  cursorLine?: number;
  /** Additional CSS classes */
  className?: string;
}

// ============================================================================
// SYMBOL UTILITIES
// ============================================================================

function getSymbolIcon(kind: SymbolKind): React.ReactNode {
  switch (kind) {
    case SymbolKind.Class:
      return <Box className="h-3 w-3 text-yellow-400" />;
    case SymbolKind.Interface:
      return <Braces className="h-3 w-3 text-blue-400" />;
    case SymbolKind.Function:
    case SymbolKind.Method:
      return <FunctionSquare className="h-3 w-3 text-purple-400" />;
    case SymbolKind.Variable:
    case SymbolKind.Field:
    case SymbolKind.Property:
      return <Variable className="h-3 w-3 text-cyan-400" />;
    case SymbolKind.Constant:
      return <Hash className="h-3 w-3 text-cyan-300" />;
    case SymbolKind.TypeParameter:
      return <Type className="h-3 w-3 text-orange-400" />;
    default:
      return <Hash className="h-3 w-3 text-gray-400" />;
  }
}

function getSymbolKindName(kind: SymbolKind): string {
  const names: Record<number, string> = {
    [SymbolKind.File]: 'File',
    [SymbolKind.Module]: 'Module',
    [SymbolKind.Namespace]: 'Namespace',
    [SymbolKind.Package]: 'Package',
    [SymbolKind.Class]: 'Class',
    [SymbolKind.Method]: 'Method',
    [SymbolKind.Property]: 'Property',
    [SymbolKind.Field]: 'Field',
    [SymbolKind.Constructor]: 'Constructor',
    [SymbolKind.Enum]: 'Enum',
    [SymbolKind.Interface]: 'Interface',
    [SymbolKind.Function]: 'Function',
    [SymbolKind.Variable]: 'Variable',
    [SymbolKind.Constant]: 'Constant',
    [SymbolKind.String]: 'String',
    [SymbolKind.Number]: 'Number',
    [SymbolKind.Boolean]: 'Boolean',
    [SymbolKind.Array]: 'Array',
    [SymbolKind.Object]: 'Object',
    [SymbolKind.Key]: 'Key',
    [SymbolKind.Null]: 'Null',
    [SymbolKind.EnumMember]: 'Enum Member',
    [SymbolKind.Struct]: 'Struct',
    [SymbolKind.Event]: 'Event',
    [SymbolKind.Operator]: 'Operator',
    [SymbolKind.TypeParameter]: 'Type Parameter',
  };
  return names[kind] || 'Symbol';
}

// ============================================================================
// PATH PARSING UTILITIES
// ============================================================================

function parseFilePath(filePath: string): BreadcrumbItem[] {
  const parts = filePath.split('/').filter(Boolean);
  const items: BreadcrumbItem[] = [];
  let currentPath = '';

  parts.forEach((part, index) => {
    currentPath += '/' + part;
    const isFile = index === parts.length - 1 && part.includes('.');
    
    items.push({
      name: part,
      path: currentPath,
      type: isFile ? 'file' : 'folder',
    });
  });

  return items;
}

// ============================================================================
// FILE TYPE ICON
// ============================================================================

function getFileIcon(filename: string): React.ReactNode {
  const ext = filename.split('.').pop()?.toLowerCase();
  const iconColors: Record<string, string> = {
    ts: 'text-blue-400',
    tsx: 'text-blue-400',
    js: 'text-yellow-400',
    jsx: 'text-yellow-400',
    py: 'text-green-400',
    rs: 'text-orange-400',
    go: 'text-cyan-400',
    java: 'text-red-400',
    json: 'text-yellow-300',
    md: 'text-gray-400',
    css: 'text-blue-300',
    scss: 'text-pink-400',
    html: 'text-orange-300',
  };
  
  const color = iconColors[ext || ''] || 'text-blue-400';
  return <FileCode className={cn('h-3 w-3', color)} />;
}

// ============================================================================
// MAIN BREADCRUMBS COMPONENT
// ============================================================================

export default function Breadcrumbs({
  filePath,
  currentSymbol,
  documentSymbols = [],
  symbolBreadcrumbs = [],
  onNavigate,
  onSymbolNavigate,
  cursorLine,
  className,
}: BreadcrumbsProps) {
  const [showAllSymbols, setShowAllSymbols] = useState(false);

  // Parse file path into breadcrumb items
  const pathItems = useMemo(() => {
    if (!filePath) return [];
    return parseFilePath(filePath);
  }, [filePath]);

  // Get file extension for display
  const fileExtension = useMemo(() => {
    if (!filePath) return '';
    const parts = filePath.split('.');
    return parts.length > 1 ? parts.pop()?.toUpperCase() || '' : '';
  }, [filePath]);

  // Find sibling symbols at same level for dropdown
  const siblingSymbols = useMemo(() => {
    if (!currentSymbol || documentSymbols.length === 0) return [];
    
    // Find parent symbol to get siblings
    const findSiblings = (symbols: LSPSymbol[], target: SymbolBreadcrumb, parent?: LSPSymbol): LSPSymbol[] => {
      for (const sym of symbols) {
        if (sym.name === target.name && sym.kind === target.kind) {
          return parent?.children || symbols;
        }
        if (sym.children && sym.children.length > 0) {
          const found = findSiblings(sym.children, target, sym);
          if (found.length > 0) return found;
        }
      }
      return [];
    };

    return findSiblings(documentSymbols, currentSymbol);
  }, [currentSymbol, documentSymbols]);

  // Navigate to path
  const handlePathClick = useCallback((path: string) => {
    onNavigate?.(path);
  }, [onNavigate]);

  // Navigate to symbol
  const handleSymbolClick = useCallback((symbol: SymbolBreadcrumb) => {
    onSymbolNavigate?.(symbol);
  }, [onSymbolNavigate]);

  // Get siblings for a folder (for dropdown navigation)
  const getFolderSiblings = useCallback((path: string): BreadcrumbItem[] => {
    const parentPath = path.split('/').slice(0, -1).join('/');
    // In a real implementation, this would query the file system
    // For now, return empty as we don't have file system access
    return [];
  }, []);

  return (
    <TooltipProvider>
      <div className={cn('flex items-center gap-0.5 text-sm h-7 bg-muted/30 border-b', className)}>
        <ScrollArea className="flex-1 whitespace-nowrap">
          <div className="flex items-center gap-0.5 px-2">
            {/* Home button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 px-1.5 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => handlePathClick('/')}
                >
                  <Home className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Open workspace root</TooltipContent>
            </Tooltip>

            {/* Path breadcrumbs */}
            {pathItems.length > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />}
            
            {pathItems.map((item, index) => (
              <React.Fragment key={item.path}>
                {index > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />}
                
                {item.type === 'folder' ? (
                  // Folder with dropdown for sibling navigation
                  <DropdownMenu>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className={cn(
                              'h-5 px-1.5 text-xs gap-1',
                              index === pathItems.length - 1 && !currentSymbol
                                ? 'text-foreground font-medium'
                                : 'text-muted-foreground hover:text-foreground'
                            )}
                          >
                            <Folder className="h-3 w-3 text-yellow-500" />
                            <span className="max-w-[100px] truncate">{item.name}</span>
                            <ChevronDown className="h-2.5 w-2.5 opacity-50" />
                          </Button>
                        </DropdownMenuTrigger>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">{item.path}</TooltipContent>
                    </Tooltip>
                    <DropdownMenuContent align="start" className="w-48">
                      <DropdownMenuItem onClick={() => handlePathClick(item.path)}>
                        <Folder className="h-3 w-3 mr-2 text-yellow-500" />
                        <span className="truncate">{item.name}</span>
                      </DropdownMenuItem>
                      {getFolderSiblings(item.path).length > 0 && (
                        <>
                          <DropdownMenuSeparator />
                          {getFolderSiblings(item.path).map(sibling => (
                            <DropdownMenuItem
                              key={sibling.path}
                              onClick={() => handlePathClick(sibling.path)}
                            >
                              {sibling.type === 'folder' ? (
                                <Folder className="h-3 w-3 mr-2 text-yellow-500" />
                              ) : (
                                <FileCode className="h-3 w-3 mr-2 text-blue-400" />
                              )}
                              <span className="truncate">{sibling.name}</span>
                            </DropdownMenuItem>
                          ))}
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  // File breadcrumb
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className={cn(
                          'h-5 px-1.5 text-xs gap-1',
                          index === pathItems.length - 1 && !currentSymbol
                            ? 'text-foreground font-medium'
                            : 'text-muted-foreground hover:text-foreground'
                        )}
                        onClick={() => handlePathClick(item.path)}
                      >
                        {getFileIcon(item.name)}
                        <span className="max-w-[120px] truncate">{item.name}</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">{item.path}</TooltipContent>
                  </Tooltip>
                )}
              </React.Fragment>
            ))}

            {/* Symbol breadcrumbs from LSP */}
            {symbolBreadcrumbs.length > 0 && pathItems.length > 0 && (
              <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
            )}
            
            {symbolBreadcrumbs.map((symbol, index) => (
              <React.Fragment key={`${symbol.name}-${index}`}>
                {index > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />}
                
                <DropdownMenu>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className={cn(
                            'h-5 px-1.5 text-xs gap-1',
                            index === symbolBreadcrumbs.length - 1
                              ? 'text-foreground font-medium bg-purple-500/10 rounded'
                              : 'text-muted-foreground hover:text-foreground'
                          )}
                        >
                          {getSymbolIcon(symbol.kind)}
                          <span className="max-w-[100px] truncate">{symbol.name}</span>
                          <ChevronDown className="h-2.5 w-2.5 opacity-50" />
                        </Button>
                      </DropdownMenuTrigger>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      <div className="text-xs">
                        <div className="font-medium">{symbol.name}</div>
                        <div className="text-muted-foreground">{getSymbolKindName(symbol.kind)}</div>
                        {symbol.detail && <div className="text-muted-foreground mt-1">{symbol.detail}</div>}
                        <div className="text-muted-foreground mt-1">Line {symbol.range.start.line + 1}</div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                  <DropdownMenuContent align="start" className="w-48">
                    <DropdownMenuItem onClick={() => handleSymbolClick(symbol)}>
                      {getSymbolIcon(symbol.kind)}
                      <span className="ml-2 truncate">{symbol.name}</span>
                      <Badge variant="outline" className="ml-auto text-[10px]">
                        :{symbol.range.start.line + 1}
                      </Badge>
                    </DropdownMenuItem>
                    {siblingSymbols.length > 1 && (
                      <>
                        <DropdownMenuSeparator />
                        <div className="px-2 py-1 text-xs text-muted-foreground">Siblings</div>
                        {siblingSymbols.slice(0, 10).map((sibling, i) => (
                          <DropdownMenuItem
                            key={`${sibling.name}-${i}`}
                            onClick={() => handleSymbolClick({
                              name: sibling.name,
                              kind: sibling.kind,
                              range: sibling.range,
                              detail: sibling.detail,
                            })}
                            disabled={sibling.name === symbol.name && sibling.kind === symbol.kind}
                          >
                            {getSymbolIcon(sibling.kind)}
                            <span className="ml-2 truncate">{sibling.name}</span>
                            <Badge variant="outline" className="ml-auto text-[10px]">
                              :{sibling.range.start.line + 1}
                            </Badge>
                          </DropdownMenuItem>
                        ))}
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </React.Fragment>
            ))}

            {/* Legacy currentSymbol prop support */}
            {currentSymbol && symbolBreadcrumbs.length === 0 && (
              <>
                {pathItems.length > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />}
                <span className="text-xs text-purple-400 font-medium px-1.5 py-0.5 bg-purple-500/10 rounded">
                  {currentSymbol.name}
                </span>
              </>
            )}
          </div>
          <ScrollBar orientation="horizontal" className="h-1" />
        </ScrollArea>

        {/* Right side: file extension and cursor position */}
        <div className="flex items-center gap-2 px-2 shrink-0">
          {fileExtension && (
            <Badge variant="outline" className="text-[10px] h-4 px-1">
              {fileExtension}
            </Badge>
          )}
          {cursorLine !== undefined && (
            <span className="text-[10px] text-muted-foreground">
              Ln {cursorLine}
            </span>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}

// ============================================================================
// UTILITY: FIND SYMBOL AT CURSOR
// ============================================================================

/**
 * Find the symbol hierarchy at a given cursor position
 * Returns an array of symbols from outermost to innermost
 */
export function findSymbolsAtPosition(
  symbols: LSPSymbol[],
  line: number,
  character: number
): SymbolBreadcrumb[] {
  const result: SymbolBreadcrumb[] = [];

  function findInSymbols(syms: LSPSymbol[], depth: number): boolean {
    for (const sym of syms) {
      const { range } = sym;
      
      // Check if position is within this symbol's range
      if (
        (range.start.line < line || (range.start.line === line && range.start.character <= character)) &&
        (range.end.line > line || (range.end.line === line && range.end.character >= character))
      ) {
        result.push({
          name: sym.name,
          kind: sym.kind,
          range: sym.range,
          detail: sym.detail,
        });
        
        // Recursively search children
        if (sym.children && sym.children.length > 0) {
          findInSymbols(sym.children, depth + 1);
        }
        
        return true;
      }
    }
    return false;
  }

  findInSymbols(symbols, 0);
  return result;
}

// ============================================================================
// UTILITY: CONVERT LSP SYMBOLS TO BREADCRUMB FORMAT
// ============================================================================

export function convertLSPSymbolsToBreadcrumbs(symbols: LSPSymbol[]): SymbolBreadcrumb[] {
  return symbols.map(sym => ({
    name: sym.name,
    kind: sym.kind,
    range: sym.range,
    detail: sym.detail,
  }));
}
