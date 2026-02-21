'use client';

import React, { useState, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { Search, Replace, File, ChevronDown, ChevronRight, X } from 'lucide-react';

export interface SearchResult {
  file: string;
  line: number;
  column: number;
  text: string;
  matchStart: number;
  matchEnd: number;
}

interface SearchPanelProps {
  onSearch?: (query: string, options: SearchOptions) => void;
  onReplace?: (query: string, replace: string, options: SearchOptions) => void;
  results?: SearchResult[];
  className?: string;
}

export interface SearchOptions {
  caseSensitive: boolean;
  wholeWord: boolean;
  regex: boolean;
  includePattern: string;
  excludePattern: string;
}

export default function SearchPanel({ 
  onSearch, 
  onReplace, 
  results = [], 
  className 
}: SearchPanelProps) {
  const [query, setQuery] = useState('');
  const [replace, setReplace] = useState('');
  const [showReplace, setShowReplace] = useState(false);
  const [options, setOptions] = useState<SearchOptions>({
    caseSensitive: false,
    wholeWord: false,
    regex: false,
    includePattern: '',
    excludePattern: '',
  });
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());

  const handleSearch = useCallback(() => {
    if (query.trim()) {
      onSearch?.(query, options);
    }
  }, [query, options, onSearch]);

  const handleReplace = useCallback(() => {
    if (query.trim()) {
      onReplace?.(query, replace, options);
    }
  }, [query, replace, options, onReplace]);

  const toggleFile = (file: string) => {
    setExpandedFiles(prev => {
      const next = new Set(prev);
      if (next.has(file)) {
        next.delete(file);
      } else {
        next.add(file);
      }
      return next;
    });
  };

  // Group results by file
  const groupedResults = results.reduce((acc, result) => {
    if (!acc[result.file]) {
      acc[result.file] = [];
    }
    acc[result.file].push(result);
    return acc;
  }, {} as Record<string, SearchResult[]>);

  return (
    <div className={cn('h-full flex flex-col', className)}>
      <div className="p-2 space-y-2 border-b shrink-0">
        {/* Search input */}
        <div className="flex gap-1">
          <div className="flex-1 relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="Search in project..."
              className="pl-8"
            />
          </div>
          <Button size="icon" variant="ghost" onClick={() => setShowReplace(!showReplace)}>
            <Replace className="h-4 w-4" />
          </Button>
        </div>

        {/* Replace input */}
        {showReplace && (
          <div className="flex gap-1">
            <Input
              value={replace}
              onChange={e => setReplace(e.target.value)}
              placeholder="Replace with..."
            />
            <Button size="sm" onClick={handleReplace}>Replace</Button>
          </div>
        )}

        {/* Options */}
        <div className="flex items-center gap-2 flex-wrap">
          <label className="flex items-center gap-1 text-xs cursor-pointer">
            <Checkbox
              checked={options.caseSensitive}
              onCheckedChange={v => setOptions(o => ({ ...o, caseSensitive: !!v }))}
            />
            Case
          </label>
          <label className="flex items-center gap-1 text-xs cursor-pointer">
            <Checkbox
              checked={options.wholeWord}
              onCheckedChange={v => setOptions(o => ({ ...o, wholeWord: !!v }))}
            />
            Word
          </label>
          <label className="flex items-center gap-1 text-xs cursor-pointer">
            <Checkbox
              checked={options.regex}
              onCheckedChange={v => setOptions(o => ({ ...o, regex: !!v }))}
            />
            Regex
          </label>
        </div>

        {/* Include/Exclude patterns */}
        <div className="flex gap-1">
          <Input
            value={options.includePattern}
            onChange={e => setOptions(o => ({ ...o, includePattern: e.target.value }))}
            placeholder="Include: *.ts, *.tsx"
            className="text-xs h-7"
          />
          <Input
            value={options.excludePattern}
            onChange={e => setOptions(o => ({ ...o, excludePattern: e.target.value }))}
            placeholder="Exclude: node_modules"
            className="text-xs h-7"
          />
        </div>
      </div>

      {/* Results */}
      <ScrollArea className="flex-1">
        {Object.keys(groupedResults).length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            {query ? 'No results found' : 'Type to search in project'}
          </div>
        ) : (
          <div className="py-1">
            {Object.entries(groupedResults).map(([file, fileResults]) => (
              <div key={file}>
                <button
                  className="w-full flex items-center gap-1 px-2 py-1 hover:bg-accent/50 text-left"
                  onClick={() => toggleFile(file)}
                >
                  {expandedFiles.has(file) ? (
                    <ChevronDown className="h-3 w-3 shrink-0" />
                  ) : (
                    <ChevronRight className="h-3 w-3 shrink-0" />
                  )}
                  <File className="h-3 w-3 shrink-0" />
                  <span className="text-xs truncate flex-1">{file}</span>
                  <Badge variant="secondary" className="text-[10px]">
                    {fileResults.length}
                  </Badge>
                </button>
                {expandedFiles.has(file) && (
                  <div className="pl-6">
                    {fileResults.map((result, i) => (
                      <div
                        key={i}
                        className="px-2 py-1 hover:bg-accent/50 cursor-pointer text-xs"
                      >
                        <span className="text-muted-foreground mr-2">{result.line}:</span>
                        <span>{result.text.slice(0, result.matchStart)}</span>
                        <span className="bg-yellow-500/30">{result.text.slice(result.matchStart, result.matchEnd)}</span>
                        <span>{result.text.slice(result.matchEnd)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Status */}
      {results.length > 0 && (
        <div className="p-2 border-t text-xs text-muted-foreground shrink-0">
          {results.length} results in {Object.keys(groupedResults).length} files
        </div>
      )}
    </div>
  );
}
