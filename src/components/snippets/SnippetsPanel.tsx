'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus, Search, X, Code, Trash2, Copy, ChevronDown,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────

interface Snippet {
  id: string;
  name: string;
  prefix: string;
  language: string;
  description: string;
  body: string;
}

// ── Built-in snippets ──────────────────────────────────────────────────────────

const BUILTIN_SNIPPETS: Snippet[] = [
  {
    id: 'bi-react-component',
    name: 'React Functional Component',
    prefix: 'rfc',
    language: 'typescript',
    description: 'Creates a new React functional component with TypeScript',
    body: `import React from 'react';\n\ninterface Props {\n  // define props here\n}\n\nexport function ComponentName({ }: Props) {\n  return (\n    <div>\n      <h1>ComponentName</h1>\n    </div>\n  );\n}\n`,
  },
  {
    id: 'bi-use-state',
    name: 'useState Hook',
    prefix: 'us',
    language: 'typescript',
    description: 'React useState hook with typed state',
    body: `const [$1, set$2] = useState<$3>($4);`,
  },
  {
    id: 'bi-use-effect',
    name: 'useEffect Hook',
    prefix: 'ue',
    language: 'typescript',
    description: 'React useEffect with cleanup',
    body: `useEffect(() => {\n  $1\n\n  return () => {\n    // cleanup\n  };\n}, [$2]);`,
  },
  {
    id: 'bi-async-fn',
    name: 'Async Function',
    prefix: 'afn',
    language: 'typescript',
    description: 'Async/await function with try/catch',
    body: `async function $1($2): Promise<$3> {\n  try {\n    $4\n  } catch (error) {\n    console.error(error);\n    throw error;\n  }\n}`,
  },
  {
    id: 'bi-try-catch',
    name: 'Try / Catch Block',
    prefix: 'tc',
    language: 'javascript',
    description: 'Try/catch/finally block',
    body: `try {\n  $1\n} catch (error) {\n  console.error('Error:', error);\n} finally {\n  $2\n}`,
  },
  {
    id: 'bi-console-group',
    name: 'Console Log Group',
    prefix: 'clg',
    language: 'javascript',
    description: 'Grouped console output for debugging',
    body: `console.group('$1');\nconsole.log('data:', $2);\nconsole.log('type:', typeof $2);\nconsole.groupEnd();`,
  },
  {
    id: 'bi-py-class',
    name: 'Python Class',
    prefix: 'pyclass',
    language: 'python',
    description: 'Python class with __init__ and methods',
    body: `class $1:\n    """$2"""\n\n    def __init__(self, $3):\n        $4\n\n    def __repr__(self) -> str:\n        return f"$1()"\n`,
  },
  {
    id: 'bi-py-fn',
    name: 'Python Function',
    prefix: 'pyfn',
    language: 'python',
    description: 'Python typed function with docstring',
    body: `def $1($2) -> $3:\n    """$4\n\n    Args:\n        $2: description\n\n    Returns:\n        $3: description\n    """\n    $5\n`,
  },
  {
    id: 'bi-rust-struct',
    name: 'Rust Struct',
    prefix: 'rstruct',
    language: 'rust',
    description: 'Rust struct with derive macros and impl block',
    body: `#[derive(Debug, Clone, PartialEq)]\npub struct $1 {\n    $2: $3,\n}\n\nimpl $1 {\n    pub fn new($2: $3) -> Self {\n        Self { $2 }\n    }\n}\n`,
  },
  {
    id: 'bi-go-fn',
    name: 'Go Function',
    prefix: 'gofn',
    language: 'go',
    description: 'Go function with error return',
    body: `func $1($2 $3) ($4, error) {\n\t$5\n\treturn $6, nil\n}\n`,
  },
  {
    id: 'bi-ts-interface',
    name: 'TypeScript Interface',
    prefix: 'tsi',
    language: 'typescript',
    description: 'TypeScript interface definition',
    body: `interface $1 {\n  id: string;\n  $2: $3;\n  createdAt: Date;\n  updatedAt: Date;\n}\n`,
  },
  {
    id: 'bi-css-flex',
    name: 'CSS Flexbox Container',
    prefix: 'flex',
    language: 'css',
    description: 'Flexbox container with common properties',
    body: `.$1 {\n  display: flex;\n  flex-direction: row;\n  align-items: center;\n  justify-content: space-between;\n  gap: 0.5rem;\n  flex-wrap: wrap;\n}\n`,
  },
];

const LANGUAGE_COLORS: Record<string, string> = {
  typescript: 'bg-[#1f6feb] text-[#79c0ff]',
  javascript: 'bg-[#a04a00] text-[#ffa657]',
  python: 'bg-[#1a4a1a] text-[#3fb950]',
  rust: 'bg-[#3d1f00] text-[#ffa657]',
  go: 'bg-[#003333] text-[#39d0d8]',
  css: 'bg-[#2d1b69] text-[#d2a8ff]',
  html: 'bg-[#5a1e02] text-[#ffa657]',
  json: 'bg-[#21262d] text-[#8b949e]',
  bash: 'bg-[#161b22] text-[#8b949e]',
  any: 'bg-[#21262d] text-[#c9d1d9]',
};

const LANGUAGE_OPTIONS = [
  'javascript', 'typescript', 'python', 'rust', 'go',
  'css', 'html', 'json', 'bash', 'any',
];

const LS_KEY = 'kyro-user-snippets';

function langClass(lang: string) {
  return LANGUAGE_COLORS[lang] ?? LANGUAGE_COLORS.any;
}

function loadUserSnippets(): Snippet[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function saveUserSnippets(snippets: Snippet[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(snippets));
  import('@tauri-apps/api/core')
    .then(({ invoke }) =>
      invoke('set_setting', { key: 'snippets', value: JSON.stringify(snippets) }),
    )
    .catch(() => {/* Tauri not available – localStorage already saved */});
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function SnippetRow({
  snippet,
  onInsert,
  onDelete,
  canDelete,
}: {
  snippet: Snippet;
  onInsert: (body: string) => void;
  onDelete?: (id: string) => void;
  canDelete: boolean;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="group flex items-start gap-3 px-3 py-2 hover:bg-[#161b22] border-b border-[#21262d] last:border-0 transition-colors"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span
        className={`mt-0.5 shrink-0 font-mono text-xs px-1.5 py-0.5 rounded border border-transparent ${langClass(snippet.language)}`}
      >
        {snippet.prefix}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm text-[#c9d1d9] font-medium truncate">{snippet.name}</span>
          <span className={`text-xs px-1.5 py-0 rounded ${langClass(snippet.language)}`}>
            {snippet.language}
          </span>
        </div>
        <p className="text-xs text-[#8b949e] truncate mt-0.5">{snippet.description}</p>
      </div>
      <div
        className={`flex items-center gap-1 shrink-0 transition-opacity ${hovered ? 'opacity-100' : 'opacity-0'}`}
      >
        <button
          onClick={() => onInsert(snippet.body)}
          className="text-xs px-2 py-0.5 rounded bg-[#1f6feb] hover:bg-[#388bfd] text-white transition-colors"
          title="Insert snippet"
        >
          Insert
        </button>
        {canDelete && onDelete && (
          <button
            onClick={() => onDelete(snippet.id)}
            className="p-1 rounded hover:bg-[#f85149]/20 text-[#8b949e] hover:text-[#f85149] transition-colors"
            title="Delete snippet"
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>
    </div>
  );
}

// ── New Snippet Form ───────────────────────────────────────────────────────────

interface NewSnippetFormProps {
  onSave: (snippet: Snippet) => void;
  onCancel: () => void;
}

function NewSnippetForm({ onSave, onCancel }: NewSnippetFormProps) {
  const [name, setName] = useState('');
  const [prefix, setPrefix] = useState('');
  const [language, setLanguage] = useState('typescript');
  const [description, setDescription] = useState('');
  const [body, setBody] = useState('');

  function handleSave() {
    if (!name.trim() || !prefix.trim() || !body.trim()) return;
    onSave({
      id: `user-${Date.now()}`,
      name: name.trim(),
      prefix: prefix.trim(),
      language,
      description: description.trim(),
      body,
    });
  }

  const inputCls =
    'w-full bg-[#161b22] border border-[#30363d] rounded px-2 py-1.5 text-sm text-[#c9d1d9] placeholder-[#484f58] focus:outline-none focus:border-[#58a6ff]';

  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded-lg m-3 p-4 space-y-3">
      <h3 className="text-sm font-semibold text-[#c9d1d9]">New Snippet</h3>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-[#8b949e] mb-1">Name</label>
          <input className={inputCls} placeholder="React Component" value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs text-[#8b949e] mb-1">Prefix / Trigger</label>
          <input className={inputCls} placeholder="rfc" value={prefix} onChange={e => setPrefix(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-[#8b949e] mb-1">Language</label>
          <select
            className={inputCls}
            value={language}
            onChange={e => setLanguage(e.target.value)}
          >
            {LANGUAGE_OPTIONS.map(l => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-[#8b949e] mb-1">Description</label>
          <input className={inputCls} placeholder="Short description" value={description} onChange={e => setDescription(e.target.value)} />
        </div>
      </div>
      <div>
        <label className="block text-xs text-[#8b949e] mb-1">Body</label>
        <textarea
          className={`${inputCls} font-mono resize-none`}
          rows={5}
          placeholder="Your snippet code here..."
          value={body}
          onChange={e => setBody(e.target.value)}
        />
      </div>
      <div className="flex gap-2 justify-end">
        <button
          onClick={onCancel}
          className="text-xs px-3 py-1.5 rounded border border-[#30363d] text-[#8b949e] hover:text-[#c9d1d9] hover:border-[#484f58] transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={!name.trim() || !prefix.trim() || !body.trim()}
          className="text-xs px-3 py-1.5 rounded bg-[#238636] hover:bg-[#2ea043] text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Save Snippet
        </button>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function SnippetsPanel() {
  const [activeTab, setActiveTab] = useState<'mine' | 'builtin'>('builtin');
  const [userSnippets, setUserSnippets] = useState<Snippet[]>([]);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    setUserSnippets(loadUserSnippets());
  }, []);

  const filtered = useMemo(() => {
    const list = activeTab === 'builtin' ? BUILTIN_SNIPPETS : userSnippets;
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(
      s =>
        s.name.toLowerCase().includes(q) ||
        s.prefix.toLowerCase().includes(q) ||
        s.language.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q),
    );
  }, [activeTab, userSnippets, search]);

  function handleInsert(body: string) {
    window.dispatchEvent(new CustomEvent('kyro:insert-snippet', { detail: { body } }));
  }

  function handleDelete(id: string) {
    const updated = userSnippets.filter(s => s.id !== id);
    setUserSnippets(updated);
    saveUserSnippets(updated);
  }

  function handleSaveNew(snippet: Snippet) {
    const updated = [...userSnippets, snippet];
    setUserSnippets(updated);
    saveUserSnippets(updated);
    setShowForm(false);
  }

  return (
    <div className="flex flex-col h-full bg-[#0d1117] text-[#c9d1d9]">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#30363d] shrink-0">
        <div className="flex items-center gap-2">
          <Code size={14} className="text-[#58a6ff]" />
          <span className="text-xs font-semibold text-[#c9d1d9] uppercase tracking-wide">Snippets</span>
        </div>
        <button
          onClick={() => { setShowForm(true); setActiveTab('mine'); }}
          className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] transition-colors"
          title="New Snippet"
        >
          <Plus size={12} />
          New
        </button>
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b border-[#30363d] shrink-0">
        <div className="relative">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-[#484f58]" />
          <input
            className="w-full bg-[#161b22] border border-[#30363d] rounded px-2 py-1 pl-6 text-xs text-[#c9d1d9] placeholder-[#484f58] focus:outline-none focus:border-[#58a6ff]"
            placeholder="Search snippets..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#484f58] hover:text-[#8b949e]">
              <X size={10} />
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#30363d] shrink-0">
        {(['mine', 'builtin'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab
                ? 'border-[#f78166] text-[#c9d1d9]'
                : 'border-transparent text-[#8b949e] hover:text-[#c9d1d9]'
            }`}
          >
            {tab === 'mine' ? 'My Snippets' : 'Built-in'}
            <span className="bg-[#21262d] text-[#8b949e] text-[10px] px-1.5 py-0.5 rounded-full">
              {tab === 'mine' ? userSnippets.length : BUILTIN_SNIPPETS.length}
            </span>
          </button>
        ))}
      </div>

      {/* Form */}
      {showForm && activeTab === 'mine' && (
        <NewSnippetForm onSave={handleSaveNew} onCancel={() => setShowForm(false)} />
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 gap-2 text-[#484f58]">
            {activeTab === 'mine' && userSnippets.length === 0 ? (
              <>
                <Code size={24} className="opacity-40" />
                <p className="text-xs">No custom snippets yet. Click + New to create one.</p>
              </>
            ) : (
              <>
                <Search size={20} className="opacity-40" />
                <p className="text-xs">No snippets match your search.</p>
              </>
            )}
          </div>
        ) : (
          filtered.map(snippet => (
            <SnippetRow
              key={snippet.id}
              snippet={snippet}
              onInsert={handleInsert}
              onDelete={handleDelete}
              canDelete={activeTab === 'mine'}
            />
          ))
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-1.5 border-t border-[#30363d] shrink-0 flex items-center justify-between">
        <span className="text-[10px] text-[#484f58]">{filtered.length} snippet{filtered.length !== 1 ? 's' : ''}</span>
        <span className="text-[10px] text-[#484f58]">Press Insert to add to editor</span>
      </div>
    </div>
  );
}
