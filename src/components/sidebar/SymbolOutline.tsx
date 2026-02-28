'use client';

import React, { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useKyroStore } from '@/store/kyroStore';
import { FileCode, FunctionSquare, Box, Hash, Type, Variable } from 'lucide-react';

interface Symbol {
  name: string;
  kind: 'Function' | 'Class' | 'Struct' | 'Interface' | 'Enum' | 'Constant' | 'Variable' | 'Module' | 'Method' | 'Property' | 'Field' | 'Type' | 'Macro';
  start_line: number;
  start_col: number;
  end_line: number;
  end_col: number;
  documentation?: string;
}

export function SymbolOutline() {
  const { openFiles, activeFileIndex } = useKyroStore();
  const [symbols, setSymbols] = useState<Symbol[]>([]);
  const [loading, setLoading] = useState(false);
  
  const currentFile = activeFileIndex >= 0 ? openFiles[activeFileIndex] : null;
  
  useEffect(() => {
    // Skip if no current file - the component will return null anyway
    if (!currentFile) {
      // Use setTimeout to defer the state update
      const timer = setTimeout(() => setSymbols([]), 0);
      return () => clearTimeout(timer);
    }
    
    // Defer loading state to avoid synchronous setState in effect
    const loadingTimer = setTimeout(() => setLoading(true), 0);
    
    invoke<{symbols: Symbol[]}>('extract_symbols', { language: currentFile.language, code: currentFile.content })
      .then((result) => {
        setSymbols(result.symbols);
        setLoading(false);
      })
      .catch((e) => {
        console.error('Failed to extract symbols:', e);
        setLoading(false);
      });
    
    return () => clearTimeout(loadingTimer);
  }, [currentFile]);
  
  const getIcon = (kind: string) => {
    switch (kind) {
      case 'Function':
      case 'Method': return <FunctionSquare size={14} className="text-[#e6b450]" />;
      case 'Class': return <Box size={14} className="text-[#4ec9b0]" />;
      case 'Struct': return <Type size={14} className="text-[#4ec9b0]" />;
      case 'Enum': return <Hash size={14} className="text-[#dcdcaa]" />;
      case 'Interface': return <FileCode size={14} className="text-[#b8d7a3]" />;
      case 'Constant': return <Variable size={14} className="text-[#4fc1ff]" />;
      case 'Variable':
      case 'Field': return <Variable size={14} className="text-[#9cdcfe]" />;
      default: return <FileCode size={14} className="text-[#8b949e]" />;
    }
  };
  
  const getColor = (kind: string) => {
    switch (kind) {
      case 'Function':
      case 'Method': return 'text-[#dcdcaa]';
      case 'Class':
      case 'Struct':
      case 'Type': return 'text-[#4ec9b0]';
      case 'Enum': return 'text-[#b8d7a3]';
      case 'Interface': return 'text-[#b8d7a3]';
      case 'Constant': return 'text-[#4fc1ff]';
      case 'Variable':
      case 'Field': return 'text-[#9cdcfe]';
      default: return 'text-[#8b949e]';
    }
  };
  
  // Group symbols by kind
  const groupedSymbols = symbols.reduce((acc, symbol) => {
    const kind = symbol.kind;
    if (!acc[kind]) acc[kind] = [];
    acc[kind].push(symbol);
    return acc;
  }, {} as Record<string, Symbol[]>);
  
  const kindOrder = ['Class', 'Struct', 'Interface', 'Enum', 'Function', 'Method', 'Constant', 'Variable', 'Field'];
  const sortedKinds = Object.keys(groupedSymbols).sort((a, b) => {
    const aIdx = kindOrder.indexOf(a);
    const bIdx = kindOrder.indexOf(b);
    return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
  });
  
  if (!currentFile) return null;
  
  if (loading) {
    return (
      <div className="p-3 text-xs text-[#8b949e]">
        <span className="animate-pulse">Analyzing...</span>
      </div>
    );
  }
  
  if (symbols.length === 0) {
    return (
      <div className="p-3 text-xs text-[#8b949e]">
        <p>No symbols found</p>
        <p className="mt-1 text-[10px]">Open a file with functions, classes, or structs</p>
      </div>
    );
  }
  
  return (
    <div className="py-2 text-xs">
      <div className="px-3 py-1 text-[#8b949e] text-[10px] uppercase font-medium border-b border-[#30363d]">
        {symbols.length} symbols • {currentFile.language}
      </div>
      
      {sortedKinds.map((kind) => (
        <div key={kind} className="mt-1">
          <div className="px-3 py-1 text-[#8b949e] text-[10px] uppercase font-medium bg-[#161b22] sticky top-0">
            {kind} ({groupedSymbols[kind].length})
          </div>
          {groupedSymbols[kind].map((symbol, idx) => (
            <div
              key={`${kind}-${idx}`}
              className="flex items-center gap-2 px-3 py-1 hover:bg-[#21262d] cursor-pointer"
              onClick={() => {
                // Emit event to editor to go to line
                window.dispatchEvent(new CustomEvent('kyro:goto-line', { 
                  detail: { line: symbol.start_line, col: symbol.start_col } 
                }));
              }}
            >
              {getIcon(kind)}
              <span className={getColor(kind)}>{symbol.name}</span>
              <span className="text-[#6e7681] ml-auto">:{symbol.start_line}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
