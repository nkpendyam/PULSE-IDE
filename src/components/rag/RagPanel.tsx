'use client';

import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Search, Database, Trash2, FileText, Loader2 } from 'lucide-react';

interface RagIndexStatus {
  indexed_files: number;
  total_chunks: number;
  index_size_mb: number;
  last_indexed: string | null;
  is_indexing: boolean;
}

interface RagSearchResult {
  file_path: string;
  content: string;
  score: number;
  line_start: number;
  line_end: number;
}

export function RagPanel() {
  const [status, setStatus] = useState<RagIndexStatus | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<RagSearchResult[]>([]);
  const [projectPath, setProjectPath] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    invoke<RagIndexStatus>('get_rag_status').then(setStatus).catch(() => {});
  }, []);

  const handleIndex = async () => {
    if (!projectPath) return;
    setLoading(true);
    try {
      const s = await invoke<RagIndexStatus>('index_project', {
        request: { path: projectPath, recursive: true, file_types: null }
      });
      setStatus(s);
    } finally { setLoading(false); }
  };

  const handleSearch = async () => {
    if (!searchQuery) return;
    setLoading(true);
    try {
      const r = await invoke<RagSearchResult[]>('semantic_search', {
        request: { query: searchQuery, max_results: 10 }
      });
      setResults(r);
    } finally { setLoading(false); }
  };

  return (
    <div className="h-full flex flex-col bg-[#0d1117] p-4">
      <h3 className="text-[#c9d1d9] font-medium mb-4 flex items-center gap-2">
        <Database size={18} /> RAG Search
      </h3>

      {status && (
        <div className="grid grid-cols-3 gap-2 mb-4 text-center">
          <div className="bg-[#161b22] p-2 rounded">
            <p className="text-lg font-bold text-[#58a6ff]">{status.indexed_files}</p>
            <p className="text-xs text-[#8b949e]">Files</p>
          </div>
          <div className="bg-[#161b22] p-2 rounded">
            <p className="text-lg font-bold text-[#3fb950]">{status.total_chunks}</p>
            <p className="text-xs text-[#8b949e]">Chunks</p>
          </div>
          <div className="bg-[#161b22] p-2 rounded">
            <p className="text-lg font-bold text-[#a371f7]">{status.index_size_mb.toFixed(1)}MB</p>
            <p className="text-xs text-[#8b949e]">Size</p>
          </div>
        </div>
      )}

      <input
        value={projectPath}
        onChange={(e) => setProjectPath(e.target.value)}
        placeholder="Project path to index..."
        className="w-full mb-2 bg-[#161b22] border border-[#30363d] rounded px-3 py-2 text-[#c9d1d9] text-sm"
      />

      <div className="flex gap-2 mb-4">
        <button onClick={handleIndex} disabled={loading}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-[#238636] hover:bg-[#2ea043] text-white text-sm rounded">
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Database size={14} />} Index
        </button>
        <button onClick={() => invoke('clear_rag_index').then(() => setStatus(null))}
          className="px-3 py-2 bg-[#21262d] text-[#f85149] text-sm rounded">
          <Trash2 size={14} />
        </button>
      </div>

      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8b949e]" size={16} />
          <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Semantic search..."
            className="w-full bg-[#161b22] border border-[#30363d] rounded pl-9 pr-3 py-2 text-[#c9d1d9] text-sm" />
        </div>
        <button onClick={handleSearch} disabled={loading}
          className="px-4 py-2 bg-[#58a6ff] text-white text-sm rounded">Search</button>
      </div>

      <div className="flex-1 overflow-auto space-y-2">
        {results.map((r, i) => (
          <div key={i} className="bg-[#161b22] border border-[#30363d] rounded p-3">
            <div className="flex justify-between mb-1">
              <span className="text-[#58a6ff] text-sm">{r.file_path}</span>
              <span className="text-[#3fb950] text-xs">{(r.score * 100).toFixed(0)}%</span>
            </div>
            <p className="text-xs text-[#8b949e]">Lines {r.line_start}-{r.line_end}</p>
            <pre className="text-sm text-[#c9d1d9] bg-[#0d1117] p-2 rounded mt-2">{r.content}</pre>
          </div>
        ))}
      </div>
    </div>
  );
}
