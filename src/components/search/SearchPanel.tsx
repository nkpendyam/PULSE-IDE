'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import {
  Search,
  Replace,
  Regex,
  CaseSensitive,
  WholeWord,
  File,
  ChevronDown,
  ChevronRight,
  X,
  RefreshCw,
  ListFilter,
  FileText,
  Code,
  Loader2,
} from 'lucide-react';
import { SearchEngine, SearchResult, SearchOptions, SymbolResult } from '@/lib/search/search-engine';

interface SearchPanelProps {
  onFileSelect?: (file: string, line: number, column: number) => void;
  files?: Map<string, string>;
  className?: string;
}

export function SearchPanel({ onFileSelect, files = new Map(), className }: SearchPanelProps) {
  const [query, setQuery] = useState('');
  const [replacement, setReplacement] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [includePattern, setIncludePattern] = useState('');
  const [excludePattern, setExcludePattern] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<Map<string, SearchResult[]>>(new Map());
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'search' | 'replace' | 'symbols'>('search');
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [symbols, setSymbols] = useState<SymbolResult[]>([]);
  const [symbolFilter, setSymbolFilter] = useState('');

  const searchEngineRef = useRef(new SearchEngine());

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;

    setIsSearching(true);
    setResults(new Map());
    setExpandedFiles(new Set());

    const options: SearchOptions = {
      query,
      caseSensitive,
      wholeWord,
      regex: useRegex,
      includePattern,
      excludePattern,
      maxResults: 1000,
      contextLines: 2,
    };

    const allResults = new Map<string, SearchResult[]>();

    for (const [filePath, content] of files) {
      // Check include/exclude patterns
      if (includePattern && !filePath.includes(includePattern)) continue;
      if (excludePattern && filePath.includes(excludePattern)) continue;

      const fileResults = searchEngineRef.current.searchInContent(content, options);
      if (fileResults.length > 0) {
        fileResults.forEach(r => r.file = filePath);
        allResults.set(filePath, fileResults);
      }
    }

    setResults(allResults);
    setIsSearching(false);
    searchEngineRef.current.addToHistory(query);
    setSearchHistory(searchEngineRef.current.getHistory());
  }, [query, caseSensitive, wholeWord, useRegex, includePattern, excludePattern, files]);

  const handleReplace = useCallback(async () => {
    if (!query.trim() || !replacement.trim()) return;

    const options = {
      query,
      replacement,
      caseSensitive,
      wholeWord,
      regex: useRegex,
      replaceAll: true,
    };

    let totalReplacements = 0;
    const newFiles = new Map(files);

    for (const [filePath, content] of files) {
      const { result, count } = searchEngineRef.current.replaceInContent(content, options);
      if (count > 0) {
        newFiles.set(filePath, result);
        totalReplacements += count;
      }
    }

    // Re-run search to show updated results
    handleSearch();
  }, [query, replacement, caseSensitive, wholeWord, useRegex, files, handleSearch]);

  const handleExtractSymbols = useCallback(() => {
    const allSymbols: SymbolResult[] = [];

    for (const [filePath, content] of files) {
      const fileSymbols = searchEngineRef.current.extractSymbols(content, filePath);
      allSymbols.push(...fileSymbols);
    }

    setSymbols(allSymbols);
  }, [files]);

  useEffect(() => {
    if (activeTab === 'symbols') {
      handleExtractSymbols();
    }
  }, [activeTab, handleExtractSymbols]);

  const toggleFile = (file: string) => {
    setExpandedFiles(prev => {
      const next = new Set(prev);
      if (next.has(file)) next.delete(file);
      else next.add(file);
      return next;
    });
  };

  const totalMatches = Array.from(results.values()).reduce((sum, r) => sum + r.length, 0);
  const totalFiles = results.size;

  const filteredSymbols = symbols.filter(s => 
    !symbolFilter || s.name.toLowerCase().includes(symbolFilter.toLowerCase())
  );

  const getSymbolIcon = (kind: SymbolResult['kind']) => {
    switch (kind) {
      case 'class': return <span className="text-yellow-500">◇</span>;
      case 'interface': return <span className="text-blue-500">◈</span>;
      case 'function': return <span className="text-purple-500">ƒ</span>;
      case 'variable': return <span className="text-orange-500">v</span>;
      case 'constant': return <span className="text-cyan-500">c</span>;
      default: return <span className="text-gray-500">•</span>;
    }
  };

  return (
    <div className={cn('flex flex-col h-full bg-zinc-900', className)}>
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex flex-col h-full">
        <div className="flex items-center justify-between px-2 py-1 border-b border-zinc-800">
          <TabsList className="bg-transparent">
            <TabsTrigger value="search" className="text-xs data-[state=active]:bg-zinc-800">
              <Search className="h-3 w-3 mr-1" /> Search
            </TabsTrigger>
            <TabsTrigger value="replace" className="text-xs data-[state=active]:bg-zinc-800">
              <Replace className="h-3 w-3 mr-1" /> Replace
            </TabsTrigger>
            <TabsTrigger value="symbols" className="text-xs data-[state=active]:bg-zinc-800">
              <Code className="h-3 w-3 mr-1" /> Symbols
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="search" className="flex-1 flex flex-col mt-0">
          {/* Search Input */}
          <div className="p-2 space-y-2 border-b border-zinc-800">
            <div className="flex gap-1">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Search..."
                className="h-8 text-sm flex-1 bg-zinc-800 border-zinc-700"
              />
              <Button size="sm" onClick={handleSearch} disabled={isSearching}>
                {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>

            {/* Search Options */}
            <div className="flex items-center gap-3 text-xs">
              <button
                onClick={() => setCaseSensitive(!caseSensitive)}
                className={cn('p-1 rounded', caseSensitive && 'bg-zinc-700')}
                title="Case Sensitive"
              >
                <CaseSensitive className="h-4 w-4" />
              </button>
              <button
                onClick={() => setWholeWord(!wholeWord)}
                className={cn('p-1 rounded', wholeWord && 'bg-zinc-700')}
                title="Whole Word"
              >
                <WholeWord className="h-4 w-4" />
              </button>
              <button
                onClick={() => setUseRegex(!useRegex)}
                className={cn('p-1 rounded', useRegex && 'bg-zinc-700')}
                title="Regular Expression"
              >
                <Regex className="h-4 w-4" />
              </button>
            </div>

            {/* File Patterns */}
            <div className="flex gap-1">
              <Input
                value={includePattern}
                onChange={(e) => setIncludePattern(e.target.value)}
                placeholder="Include: *.ts, *.tsx"
                className="h-7 text-xs bg-zinc-800 border-zinc-700"
              />
              <Input
                value={excludePattern}
                onChange={(e) => setExcludePattern(e.target.value)}
                placeholder="Exclude: node_modules"
                className="h-7 text-xs bg-zinc-800 border-zinc-700"
              />
            </div>
          </div>

          {/* Results Summary */}
          {totalMatches > 0 && (
            <div className="px-2 py-1 text-xs text-zinc-400 border-b border-zinc-800">
              {totalMatches} results in {totalFiles} files
            </div>
          )}

          {/* Search Results */}
          <ScrollArea className="flex-1">
            <div className="p-1">
              {Array.from(results.entries()).map(([file, matches]) => (
                <div key={file} className="mb-1">
                  <button
                    onClick={() => toggleFile(file)}
                    className="flex items-center gap-1 w-full px-2 py-1 text-xs text-left hover:bg-zinc-800 rounded"
                  >
                    {expandedFiles.has(file) ? (
                      <ChevronDown className="h-3 w-3" />
                    ) : (
                      <ChevronRight className="h-3 w-3" />
                    )}
                    <FileText className="h-3 w-3 text-zinc-400" />
                    <span className="truncate flex-1">{file}</span>
                    <Badge variant="secondary" className="text-[10px]">{matches.length}</Badge>
                  </button>

                  {expandedFiles.has(file) && (
                    <div className="ml-4">
                      {matches.map((match, i) => (
                        <button
                          key={i}
                          onClick={() => onFileSelect?.(file, match.line, match.column)}
                          className="flex items-start gap-2 w-full px-2 py-1 text-xs text-left hover:bg-zinc-800 rounded font-mono"
                        >
                          <span className="text-zinc-500 w-8 text-right shrink-0">{match.line}</span>
                          <span className="text-zinc-300 truncate">
                            {match.text.slice(0, match.matchStart)}
                            <span className="bg-yellow-500/30 text-yellow-300">
                              {match.text.slice(match.matchStart, match.matchEnd)}
                            </span>
                            {match.text.slice(match.matchEnd)}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {query && totalMatches === 0 && !isSearching && (
                <div className="p-4 text-center text-zinc-500 text-sm">No results found</div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="replace" className="flex-1 flex flex-col mt-0">
          <div className="p-2 space-y-2 border-b border-zinc-800">
            <div className="flex gap-1">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Find..."
                className="h-8 text-sm bg-zinc-800 border-zinc-700"
              />
            </div>
            <div className="flex gap-1">
              <Input
                value={replacement}
                onChange={(e) => setReplacement(e.target.value)}
                placeholder="Replace with..."
                className="h-8 text-sm flex-1 bg-zinc-800 border-zinc-700"
              />
              <Button size="sm" onClick={handleReplace} variant="secondary">
                Replace All
              </Button>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <button
                onClick={() => setCaseSensitive(!caseSensitive)}
                className={cn('p-1 rounded', caseSensitive && 'bg-zinc-700')}
              >
                <CaseSensitive className="h-4 w-4" />
              </button>
              <button
                onClick={() => setWholeWord(!wholeWord)}
                className={cn('p-1 rounded', wholeWord && 'bg-zinc-700')}
              >
                <WholeWord className="h-4 w-4" />
              </button>
              <button
                onClick={() => setUseRegex(!useRegex)}
                className={cn('p-1 rounded', useRegex && 'bg-zinc-700')}
              >
                <Regex className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="flex-1 flex items-center justify-center text-zinc-500 text-sm">
            Enter find and replace patterns
          </div>
        </TabsContent>

        <TabsContent value="symbols" className="flex-1 flex flex-col mt-0">
          <div className="p-2 border-b border-zinc-800">
            <Input
              value={symbolFilter}
              onChange={(e) => setSymbolFilter(e.target.value)}
              placeholder="Filter symbols..."
              className="h-8 text-sm bg-zinc-800 border-zinc-700"
            />
          </div>
          <ScrollArea className="flex-1">
            <div className="p-1">
              {filteredSymbols.map((symbol, i) => (
                <button
                  key={`${symbol.file}-${symbol.line}-${i}`}
                  onClick={() => onFileSelect?.(symbol.file, symbol.line, symbol.column)}
                  className="flex items-center gap-2 w-full px-2 py-1 text-xs text-left hover:bg-zinc-800 rounded"
                >
                  {getSymbolIcon(symbol.kind)}
                  <span className="text-zinc-300">{symbol.name}</span>
                  <span className="text-zinc-500 text-[10px] ml-auto">{symbol.file}:{symbol.line}</span>
                </button>
              ))}
              {filteredSymbols.length === 0 && (
                <div className="p-4 text-center text-zinc-500 text-sm">No symbols found</div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default SearchPanel;
