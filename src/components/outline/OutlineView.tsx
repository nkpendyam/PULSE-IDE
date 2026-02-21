'use client';

import React, { useState, useMemo } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
} from 'lucide-react';

export interface Symbol {
  id: string;
  name: string;
  type: 'function' | 'class' | 'interface' | 'variable' | 'constant' | 'import' | 'export' | 'method' | 'property';
  line: number;
  endLine?: number;
  column: number;
  children?: Symbol[];
  signature?: string;
  modifiers?: ('public' | 'private' | 'protected' | 'static' | 'async' | 'readonly')[];
}

interface SymbolNodeProps {
  symbol: Symbol;
  depth: number;
  onNavigate: (symbol: Symbol) => void;
  expandedIds: Set<string>;
  toggleExpand: (id: string) => void;
}

function getSymbolIcon(type: Symbol['type']) {
  switch (type) {
    case 'function':
    case 'method':
      return <FunctionSquare className="h-3.5 w-3.5 text-purple-400" />;
    case 'class':
      return <Box className="h-3.5 w-3.5 text-yellow-400" />;
    case 'interface':
      return <Braces className="h-3.5 w-3.5 text-blue-400" />;
    case 'variable':
      return <Variable className="h-3.5 w-3.5 text-cyan-400" />;
    case 'constant':
      return <Hash className="h-3.5 w-3.5 text-cyan-300" />;
    case 'import':
      return <Import className="h-3.5 w-3.5 text-green-400" />;
    case 'export':
      return <Export className="h-3.5 w-3.5 text-orange-400" />;
    case 'property':
      return <Type className="h-3.5 w-3.5 text-pink-400" />;
    default:
      return <Circle className="h-3.5 w-3.5 text-gray-400" />;
  }
}

function getModifierColor(modifier: string) {
  switch (modifier) {
    case 'public': return 'text-green-400';
    case 'private': return 'text-red-400';
    case 'protected': return 'text-yellow-400';
    case 'static': return 'text-blue-400';
    case 'async': return 'text-purple-400';
    case 'readonly': return 'text-cyan-400';
    default: return 'text-gray-400';
  }
}

function SymbolNode({ symbol, depth, onNavigate, expandedIds, toggleExpand }: SymbolNodeProps) {
  const hasChildren = symbol.children && symbol.children.length > 0;
  const isExpanded = expandedIds.has(symbol.id);

  return (
    <div>
      <div
        className={cn('flex items-center gap-1 py-0.5 px-1 hover:bg-accent/50 rounded cursor-pointer text-sm transition-colors group')}
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
        onClick={() => onNavigate(symbol)}
      >
        {hasChildren ? (
          <button onClick={(e) => { e.stopPropagation(); toggleExpand(symbol.id); }} className="p-0.5 hover:bg-accent rounded">
            {isExpanded ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
          </button>
        ) : (
          <span className="w-4" />
        )}
        {getSymbolIcon(symbol.type)}
        <span className="truncate">{symbol.name}</span>
        {symbol.modifiers && symbol.modifiers.length > 0 && (
          <div className="flex items-center gap-0.5 ml-1">
            {symbol.modifiers.map(mod => (
              <Badge key={mod} variant="outline" className={cn('text-[9px] px-1 py-0 h-3 border-0', getModifierColor(mod))}>{mod}</Badge>
            ))}
          </div>
        )}
        <span className="text-muted-foreground text-[10px] ml-auto opacity-0 group-hover:opacity-100">:{symbol.line}</span>
      </div>
      {hasChildren && isExpanded && (
        <div>
          {symbol.children!.map(child => (
            <SymbolNode key={child.id} symbol={child} depth={depth + 1} onNavigate={onNavigate} expandedIds={expandedIds} toggleExpand={toggleExpand} />
          ))}
        </div>
      )}
    </div>
  );
}

export interface OutlineViewProps {
  symbols?: Symbol[];
  onNavigate?: (symbol: Symbol) => void;
  className?: string;
}

const mockSymbols: Symbol[] = [
  { id: '1', name: 'React', type: 'import', line: 1, column: 1 },
  { id: '2', name: 'useState', type: 'import', line: 1, column: 8 },
  { id: '3', name: 'Button', type: 'interface', line: 5, column: 1, children: [
    { id: '3a', name: 'children', type: 'property', line: 6, column: 3, modifiers: ['readonly'] },
    { id: '3b', name: 'variant', type: 'property', line: 7, column: 3, modifiers: ['readonly'] },
  ]},
  { id: '4', name: 'Button', type: 'function', line: 11, column: 1, signature: '({ children, variant }: Props)', modifiers: ['public', 'export'], children: [
    { id: '4a', name: 'handleClick', type: 'function', line: 15, column: 3, modifiers: ['private'] },
  ]},
  { id: '5', name: 'Card', type: 'class', line: 28, column: 1, modifiers: ['export'], children: [
    { id: '5a', name: 'title', type: 'property', line: 29, column: 3, modifiers: ['public'] },
    { id: '5b', name: 'render', type: 'method', line: 32, column: 3, modifiers: ['public'] },
  ]},
];

export default function OutlineView({ symbols = mockSymbols, onNavigate, className }: OutlineViewProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set(['3', '4', '5']));
  const [filterText, setFilterText] = useState('');

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleNavigate = (symbol: Symbol) => {
    onNavigate?.(symbol);
  };

  const filteredSymbols = useMemo(() => {
    if (!filterText) return symbols;
    const filter = (syms: Symbol[]): Symbol[] => {
      return syms.reduce((acc, sym) => {
        const matches = sym.name.toLowerCase().includes(filterText.toLowerCase());
        const filteredChildren = sym.children ? filter(sym.children) : undefined;
        if (matches || (filteredChildren && filteredChildren.length > 0)) {
          acc.push({ ...sym, children: filteredChildren });
        }
        return acc;
      }, [] as Symbol[]);
    };
    return filter(symbols);
  }, [symbols, filterText]);

  return (
    <div className={cn('h-full flex flex-col', className)}>
      <div className="flex items-center justify-between px-2 py-1.5 border-b shrink-0">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Outline</span>
        <div className="flex items-center gap-0.5">
          <Button size="sm" variant="ghost" className="h-5 px-1 text-[10px]" onClick={() => setExpandedIds(new Set(symbols.flatMap(s => s.children ? [s.id] : [])))}><ChevronDown className="h-3 w-3" /></Button>
          <Button size="sm" variant="ghost" className="h-5 px-1 text-[10px]" onClick={() => setExpandedIds(new Set())}><ChevronUp className="h-3 w-3" /></Button>
        </div>
      </div>
      <div className="px-2 py-1 border-b shrink-0">
        <input type="text" value={filterText} onChange={e => setFilterText(e.target.value)} placeholder="Filter symbols..." className="w-full bg-transparent text-xs border rounded px-2 py-1 outline-none focus:ring-1 focus:ring-primary" />
      </div>
      <ScrollArea className="flex-1">
        <div className="py-1">
          {filteredSymbols.length === 0 ? (
            <div className="px-3 py-2 text-xs text-muted-foreground">{filterText ? 'No symbols match filter' : 'No symbols found'}</div>
          ) : (
            filteredSymbols.map(symbol => (
              <SymbolNode key={symbol.id} symbol={symbol} depth={0} onNavigate={handleNavigate} expandedIds={expandedIds} toggleExpand={toggleExpand} />
            ))
          )}
        </div>
      </ScrollArea>
      <div className="flex items-center justify-between px-2 py-1 border-t text-[10px] text-muted-foreground shrink-0">
        <span>{symbols.length} symbols</span>
      </div>
    </div>
  );
}
