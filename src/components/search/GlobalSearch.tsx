'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useKyroStore } from '@/store/kyroStore';
import { Search, Replace, File, ChevronDown, ChevronRight, X, Regex, CaseSensitive, MatchWholeWord } from 'lucide-react';

interface SearchResult {
  file: string;
  matches: {
    line: number;
    column: number;
    text: string;
    context: string;
  }[];
}

interface GlobalSearchProps {
  isOpen: boolean;
  onClose: () => void;
}

export function GlobalSearch({ isOpen, onClose }: GlobalSearchProps) {
  const [query, setQuery] = useState('');
  const [replace, setReplace] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showReplace, setShowReplace] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [matchWholeWord, setMatchWholeWord] = useState(false);
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
  const [fileFilter, setFileFilter] = useState('');
  const [excludeFilter, setExcludeFilter] = useState('');

  const { projectPath, openFile } = useKyroStore();

  // Search across project
  const performSearch = useCallback(async () => {
    if (!projectPath || !query.trim()) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    try {
      // Use git grep or ripgrep through backend
      const searchResults = await invoke<SearchResult[]>('search_in_project', {
        path: projectPath,
        query,
        useRegex,
        caseSensitive,
        matchWholeWord,
        fileFilter,
        excludeFilter
      }).catch(() => {
        // Fallback: simple file content search
        return performClientSideSearch();
      });

      setResults(searchResults);
    } catch (error) {
      console.error('Search error:', error);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [projectPath, query, useRegex, caseSensitive, matchWholeWord, fileFilter, excludeFilter]);

  // Client-side fallback search
  const performClientSideSearch = async (): Promise<SearchResult[]> => {
    const results: SearchResult[] = [];
    // Basic implementation - would need file walking
    return results;
  };

  // Replace all occurrences
  const replaceAll = useCallback(async () => {
    if (!projectPath || !query.trim()) return;

    try {
      await invoke('replace_in_project', {
        path: projectPath,
        query,
        replacement: replace,
        useRegex,
        caseSensitive,
        matchWholeWord,
        fileFilter,
        excludeFilter
      });

      // Re-search to show updated results
      performSearch();
    } catch (error) {
      console.error('Replace error:', error);
    }
  }, [projectPath, query, replace, useRegex, caseSensitive, matchWholeWord, fileFilter, excludeFilter, performSearch]);

  // Toggle file expansion
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

  // Open file at match
  const openAtMatch = async (file: string, line: number) => {
    try {
      const fileContent = await invoke<{ path: string; content: string; language: string }>('read_file', { path: file });
      openFile({ path: fileContent.path, content: fileContent.content, language: fileContent.language, isDirty: false });
      onClose();
    } catch (error) {
      console.error('Error opening file:', error);
    }
  };

  // Debounced search
  useEffect(() => {
    const timeout = setTimeout(performSearch, 300);
    return () => clearTimeout(timeout);
  }, [performSearch]);

  // Keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'F') {
        e.preventDefault();
        // Toggle search panel
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const totalMatches = results.reduce((sum, r) => sum + r.matches.length, 0);

  return (
    <div className="h-full flex flex-col bg-[#0d1117]">
      {/* Search input */}
      <div className="p-3 border-b border-[#30363d]">
        <div className="flex items-center gap-2 mb-2">
          <button onClick={() => setShowReplace(!showReplace)} className="p-1 hover:bg-[#21262d] rounded">
            <ChevronRight size={14} className={`text-[#8b949e] transition-transform ${showReplace ? 'rotate-90' : ''}`} />
          </button>
          <div className="flex-1 flex items-center bg-[#0d1117] border border-[#30363d] rounded">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search"
              className="flex-1 px-3 py-1.5 bg-transparent text-[#c9d1d9] outline-none text-sm"
              autoFocus
            />
            <div className="flex items-center gap-1 px-2">
              <button
                onClick={() => setCaseSensitive(!caseSensitive)}
                className={`p-1 rounded ${caseSensitive ? 'bg-[#21262d] text-[#58a6ff]' : 'text-[#8b949e] hover:text-[#c9d1d9]'}`}
                title="Match Case"
              >
                <CaseSensitive size={14} />
              </button>
              <button
                onClick={() => setMatchWholeWord(!matchWholeWord)}
                className={`p-1 rounded ${matchWholeWord ? 'bg-[#21262d] text-[#58a6ff]' : 'text-[#8b949e] hover:text-[#c9d1d9]'}`}
                title="Match Whole Word"
              >
                <MatchWholeWord size={14} />
              </button>
              <button
                onClick={() => setUseRegex(!useRegex)}
                className={`p-1 rounded ${useRegex ? 'bg-[#21262d] text-[#58a6ff]' : 'text-[#8b949e] hover:text-[#c9d1d9]'}`}
                title="Use Regular Expression"
              >
                <Regex size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* Replace input */}
        {showReplace && (
          <div className="flex items-center gap-2 ml-5">
            <div className="flex-1 flex items-center bg-[#0d1117] border border-[#30363d] rounded">
              <input
                type="text"
                value={replace}
                onChange={(e) => setReplace(e.target.value)}
                placeholder="Replace"
                className="flex-1 px-3 py-1.5 bg-transparent text-[#c9d1d9] outline-none text-sm"
              />
            </div>
            <button
              onClick={replaceAll}
              disabled={!replace || totalMatches === 0}
              className="px-3 py-1 bg-[#238636] hover:bg-[#2ea043] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm rounded"
            >
              Replace All
            </button>
          </div>
        )}

        {/* File filters */}
        <div className="flex items-center gap-2 mt-2 ml-5">
          <input
            type="text"
            value={fileFilter}
            onChange={(e) => setFileFilter(e.target.value)}
            placeholder="files to include"
            className="flex-1 px-2 py-1 bg-[#0d1117] border border-[#30363d] rounded text-sm text-[#c9d1d9] outline-none"
          />
          <input
            type="text"
            value={excludeFilter}
            onChange={(e) => setExcludeFilter(e.target.value)}
            placeholder="files to exclude"
            className="flex-1 px-2 py-1 bg-[#0d1117] border border-[#30363d] rounded text-sm text-[#c9d1d9] outline-none"
          />
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-auto">
        {isSearching ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#58a6ff]"></div>
          </div>
        ) : results.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-[#8b949e]">
            {query.trim() ? 'No results found' : 'Type to search across files'}
          </div>
        ) : (
          <div className="p-2">
            <div className="text-xs text-[#8b949e] mb-2 px-2">
              {totalMatches} results in {results.length} files
            </div>

            {results.map((result) => (
              <div key={result.file} className="mb-1">
                <button
                  onClick={() => toggleFile(result.file)}
                  className="w-full flex items-center px-2 py-1 hover:bg-[#21262d] rounded text-left"
                >
                  {expandedFiles.has(result.file) ? (
                    <ChevronDown size={14} className="text-[#8b949e] mr-1" />
                  ) : (
                    <ChevronRight size={14} className="text-[#8b949e] mr-1" />
                  )}
                  <File size={14} className="text-[#8b949e] mr-2" />
                  <span className="text-sm text-[#c9d1d9] flex-1 truncate">{result.file}</span>
                  <span className="text-xs text-[#8b949e]">{result.matches.length}</span>
                </button>

                {expandedFiles.has(result.file) && (
                  <div className="ml-4 mt-1">
                    {result.matches.map((match, idx) => (
                      <button
                        key={idx}
                        onClick={() => openAtMatch(result.file, match.line)}
                        className="w-full flex items-start px-2 py-1 hover:bg-[#21262d] rounded text-left"
                      >
                        <span className="text-xs text-[#8b949e] w-8 flex-shrink-0">{match.line}</span>
                        <span className="text-sm text-[#c9d1d9] font-mono truncate">
                          {match.context.split(query)[0]}
                          <span className="bg-[#264f78] text-[#c9d1d9]">{query}</span>
                          {match.context.split(query)[1]}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
