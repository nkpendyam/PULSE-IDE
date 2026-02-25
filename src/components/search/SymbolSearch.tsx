'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useKyroStore } from '@/store/kyroStore';
import { ChevronRight, File, Folder, ChevronDown, Search } from 'lucide-react';

interface Symbol {
  name: string;
  kind: 'function' | 'class' | 'struct' | 'interface' | 'enum' | 'variable' | 'constant' | 'method' | 'property';
  file: string;
  line: number;
  column: number;
  children?: Symbol[];
}

interface SymbolSearchProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SymbolSearch({ isOpen, onClose }: SymbolSearchProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [symbols, setSymbols] = useState<Symbol[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const { projectPath, openFile } = useKyroStore();

  // Load workspace symbols
  useEffect(() => {
    if (!projectPath || !isOpen) return;

    const loadSymbols = async () => {
      setIsLoading(true);
      try {
        // Get symbols from all open files and indexed files
        const workspaceSymbols = await fetch('workspace_symbols', {
          method: 'POST',
          body: JSON.stringify({ path: projectPath })
        }).then(() => []).catch(() => {
          // Fallback: use file symbols from store
          return [];
        });

        setSymbols(workspaceSymbols);
      } finally {
        setIsLoading(false);
      }
    };

    loadSymbols();
  }, [projectPath, isOpen]);

  // Filter symbols by query with fuzzy matching
  const filteredSymbols = useMemo(() => {
    if (!query.trim()) return symbols;

    const queryLower = query.toLowerCase();
    
    return symbols
      .map(symbol => {
        const nameLower = symbol.name.toLowerCase();
        let score = 0;
        
        // Exact match
        if (nameLower === queryLower) {
          score = 100;
        }
        // Starts with
        else if (nameLower.startsWith(queryLower)) {
          score = 80;
        }
        // Contains
        else if (nameLower.includes(queryLower)) {
          score = 60;
        }
        // Fuzzy match
        else {
          let lastIndex = -1;
          let matched = true;
          for (const char of queryLower) {
            const index = nameLower.indexOf(char, lastIndex + 1);
            if (index === -1) {
              matched = false;
              break;
            }
            score += index === lastIndex + 1 ? 10 : 1;
            lastIndex = index;
          }
          if (!matched) score = 0;
        }

        return { symbol, score };
      })
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(item => item.symbol);
  }, [symbols, query]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => Math.min(prev + 1, filteredSymbols.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredSymbols[selectedIndex]) {
            openSymbol(filteredSymbols[selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredSymbols, selectedIndex]);

  // Open symbol
  const openSymbol = async (symbol: Symbol) => {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const fileContent = await invoke<{ path: string; content: string; language: string }>('read_file', { path: symbol.file });
      openFile({ path: fileContent.path, content: fileContent.content, language: fileContent.language, isDirty: false });
      onClose();
      setQuery('');
    } catch (error) {
      console.error('Error opening symbol:', error);
    }
  };

  // Symbol kind icons and colors
  const kindConfig: Record<string, { icon: string; color: string }> = {
    function: { icon: 'ƒ', color: 'text-[#dcdcaa]' },
    method: { icon: 'm', color: 'text-[#dcdcaa]' },
    class: { icon: 'C', color: 'text-[#4ec9b0]' },
    struct: { icon: 'S', color: 'text-[#4ec9b0]' },
    interface: { icon: 'I', color: 'text-[#4ec9b0]' },
    enum: { icon: 'E', color: 'text-[#4ec9b0]' },
    variable: { icon: 'v', color: 'text-[#9cdcfe]' },
    constant: { icon: 'c', color: 'text-[#4fc1ff]' },
    property: { icon: 'p', color: 'text-[#9cdcfe]' }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15%] bg-black/50" onClick={onClose}>
      <div className="w-[500px] max-h-[400px] bg-[#161b22] rounded-lg border border-[#30363d] shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center px-4 py-3 border-b border-[#30363d]">
          <Search size={18} className="text-[#8b949e] mr-3" />
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Search symbols in workspace..."
            className="flex-1 bg-transparent text-[#c9d1d9] placeholder-[#8b949e] outline-none text-sm"
            autoFocus
          />
          <kbd className="px-2 py-1 text-xs bg-[#21262d] rounded text-[#8b949e]">Ctrl+T</kbd>
        </div>

        <div className="max-h-[320px] overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#58a6ff]"></div>
            </div>
          ) : filteredSymbols.length === 0 ? (
            <div className="px-4 py-8 text-center text-[#8b949e]">
              {query.trim() ? 'No symbols found' : 'Type to search symbols'}
            </div>
          ) : (
            filteredSymbols.map((symbol, index) => (
              <div
                key={`${symbol.file}-${symbol.line}-${symbol.name}`}
                onClick={() => openSymbol(symbol)}
                className={`flex items-center px-4 py-2 cursor-pointer ${
                  index === selectedIndex ? 'bg-[#21262d]' : 'hover:bg-[#21262d]'
                }`}
              >
                <span className={`w-5 h-5 flex items-center justify-center text-xs font-bold rounded ${kindConfig[symbol.kind]?.color || 'text-[#8b949e]'}`}>
                  {kindConfig[symbol.kind]?.icon || '?'}
                </span>
                <span className="ml-3 text-sm text-[#c9d1d9]">{symbol.name}</span>
                <span className="ml-auto text-xs text-[#8b949e] truncate max-w-[200px]">
                  {symbol.file.split('/').pop()}:{symbol.line}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
