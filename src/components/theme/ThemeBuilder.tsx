'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Palette,
  Download,
  Upload,
  Check,
  ChevronDown,
  ChevronRight,
  Paintbrush,
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────

interface ThemeColors {
  // Background colors
  '--background': string;
  '--foreground': string;
  '--card': string;
  '--border': string;
  // Brand colors
  '--primary': string;
  '--secondary': string;
  '--accent': string;
  // Status colors
  '--destructive': string;
  '--success': string;
  // Editor colors
  '--editor-bg': string;
  '--editor-fg': string;
  '--editor-line-numbers': string;
}

interface Theme {
  name: string;
  colors: ThemeColors;
}

// ─── Preset Themes ──────────────────────────────────────────────────────────

const PRESET_THEMES: Theme[] = [
  {
    name: 'GitHub Dark',
    colors: {
      '--background': '#0d1117',
      '--foreground': '#c9d1d9',
      '--card': '#161b22',
      '--border': '#30363d',
      '--primary': '#58a6ff',
      '--secondary': '#8b949e',
      '--accent': '#a371f7',
      '--destructive': '#f85149',
      '--success': '#3fb950',
      '--editor-bg': '#0d1117',
      '--editor-fg': '#c9d1d9',
      '--editor-line-numbers': '#6e7681',
    },
  },
  {
    name: 'GitHub Light',
    colors: {
      '--background': '#ffffff',
      '--foreground': '#24292f',
      '--card': '#f6f8fa',
      '--border': '#d0d7de',
      '--primary': '#0969da',
      '--secondary': '#57606a',
      '--accent': '#8250df',
      '--destructive': '#cf222e',
      '--success': '#1a7f37',
      '--editor-bg': '#ffffff',
      '--editor-fg': '#24292f',
      '--editor-line-numbers': '#8c959f',
    },
  },
  {
    name: 'Dracula',
    colors: {
      '--background': '#282a36',
      '--foreground': '#f8f8f2',
      '--card': '#44475a',
      '--border': '#6272a4',
      '--primary': '#8be9fd',
      '--secondary': '#6272a4',
      '--accent': '#bd93f9',
      '--destructive': '#ff5555',
      '--success': '#50fa7b',
      '--editor-bg': '#282a36',
      '--editor-fg': '#f8f8f2',
      '--editor-line-numbers': '#6272a4',
    },
  },
  {
    name: 'Monokai Pro',
    colors: {
      '--background': '#2d2a2e',
      '--foreground': '#fcfcfa',
      '--card': '#403e41',
      '--border': '#5b595c',
      '--primary': '#78dce8',
      '--secondary': '#939293',
      '--accent': '#ab9df2',
      '--destructive': '#ff6188',
      '--success': '#a9dc76',
      '--editor-bg': '#2d2a2e',
      '--editor-fg': '#fcfcfa',
      '--editor-line-numbers': '#5b595c',
    },
  },
  {
    name: 'Solarized Dark',
    colors: {
      '--background': '#002b36',
      '--foreground': '#839496',
      '--card': '#073642',
      '--border': '#586e75',
      '--primary': '#268bd2',
      '--secondary': '#657b83',
      '--accent': '#6c71c4',
      '--destructive': '#dc322f',
      '--success': '#859900',
      '--editor-bg': '#002b36',
      '--editor-fg': '#839496',
      '--editor-line-numbers': '#586e75',
    },
  },
  {
    name: 'Nord',
    colors: {
      '--background': '#2e3440',
      '--foreground': '#eceff4',
      '--card': '#3b4252',
      '--border': '#4c566a',
      '--primary': '#88c0d0',
      '--secondary': '#7b88a1',
      '--accent': '#b48ead',
      '--destructive': '#bf616a',
      '--success': '#a3be8c',
      '--editor-bg': '#2e3440',
      '--editor-fg': '#d8dee9',
      '--editor-line-numbers': '#616e88',
    },
  },
];

const COLOR_GROUPS: { label: string; keys: (keyof ThemeColors)[]; description: string }[] = [
  {
    label: 'Background',
    description: 'Surface and border colors',
    keys: ['--background', '--foreground', '--card', '--border'],
  },
  {
    label: 'Brand',
    description: 'Primary, secondary and accent colors',
    keys: ['--primary', '--secondary', '--accent'],
  },
  {
    label: 'Status',
    description: 'Destructive and success state colors',
    keys: ['--destructive', '--success'],
  },
  {
    label: 'Editor',
    description: 'Editor surface, text and gutter colors',
    keys: ['--editor-bg', '--editor-fg', '--editor-line-numbers'],
  },
];

const COLOR_LABELS: Record<keyof ThemeColors, string> = {
  '--background': 'Background',
  '--foreground': 'Foreground',
  '--card': 'Card',
  '--border': 'Border',
  '--primary': 'Primary',
  '--secondary': 'Secondary',
  '--accent': 'Accent',
  '--destructive': 'Destructive',
  '--success': 'Success',
  '--editor-bg': 'Editor Background',
  '--editor-fg': 'Editor Text',
  '--editor-line-numbers': 'Line Numbers',
};

const STORAGE_KEY = 'kyro-custom-themes';

// ─── Preview mockup ─────────────────────────────────────────────────────────

function IDEPreview({ colors }: { colors: ThemeColors }) {
  const s = (v: keyof ThemeColors) => colors[v];

  const lines = [
    { ln: 1, tokens: [{ t: 'import', c: s('--primary') }, { t: ' { useState } ', c: s('--editor-fg') }, { t: 'from', c: s('--primary') }, { t: " 'react'", c: s('--accent') }] },
    { ln: 2, tokens: [] },
    { ln: 3, tokens: [{ t: 'function', c: s('--primary') }, { t: ' App', c: s('--accent') }, { t: '() {', c: s('--editor-fg') }] },
    { ln: 4, tokens: [{ t: '  const', c: s('--primary') }, { t: ' [count, setCount]', c: s('--editor-fg') }, { t: ' = ', c: s('--secondary') }, { t: 'useState', c: s('--accent') }, { t: '(', c: s('--editor-fg') }, { t: '0', c: s('--destructive') }, { t: ');', c: s('--editor-fg') }] },
    { ln: 5, tokens: [] },
    { ln: 6, tokens: [{ t: '  return', c: s('--primary') }, { t: ' (', c: s('--editor-fg') }] },
    { ln: 7, tokens: [{ t: '    <button', c: s('--primary') }, { t: ' onClick', c: s('--accent') }, { t: '={() => ', c: s('--editor-fg') }, { t: 'setCount', c: s('--accent') }, { t: '(c + ', c: s('--editor-fg') }, { t: '1', c: s('--destructive') }, { t: ')}>',  c: s('--editor-fg') }] },
    { ln: 8, tokens: [{ t: '      Count: ', c: s('--editor-fg') }, { t: '{count}', c: s('--accent') }] },
    { ln: 9, tokens: [{ t: '    </button>', c: s('--primary') }] },
    { ln: 10, tokens: [{ t: '  )', c: s('--editor-fg') }] },
    { ln: 11, tokens: [{ t: '}', c: s('--editor-fg') }] },
  ];

  return (
    <div
      className="rounded-lg overflow-hidden border text-[11px] font-mono"
      style={{ background: s('--editor-bg'), borderColor: s('--border') }}
    >
      {/* Title bar */}
      <div
        className="flex items-center gap-1.5 px-3 py-2 border-b"
        style={{ background: s('--card'), borderColor: s('--border') }}
      >
        <div className="w-2.5 h-2.5 rounded-full" style={{ background: s('--destructive') }} />
        <div className="w-2.5 h-2.5 rounded-full" style={{ background: s('--success') }} />
        <div className="w-2.5 h-2.5 rounded-full" style={{ background: s('--secondary') }} />
        <span className="ml-2 text-[10px]" style={{ color: s('--secondary') }}>App.tsx</span>
      </div>
      {/* Code area */}
      <div className="p-3 space-y-0.5">
        {lines.map(({ ln, tokens }) => (
          <div key={ln} className="flex gap-3">
            <span className="w-4 text-right shrink-0 select-none" style={{ color: s('--editor-line-numbers') }}>
              {ln}
            </span>
            <span>
              {tokens.map((tok, i) => (
                <span key={i} style={{ color: tok.c }}>{tok.t}</span>
              ))}
            </span>
          </div>
        ))}
      </div>
      {/* Status bar */}
      <div
        className="flex items-center gap-3 px-3 py-1 text-[10px] border-t"
        style={{ background: s('--card'), borderColor: s('--border'), color: s('--secondary') }}
      >
        <span style={{ color: s('--success') }}>● TypeScript</span>
        <span>Ln 4, Col 32</span>
        <span style={{ color: s('--primary') }}>UTF-8</span>
      </div>
    </div>
  );
}

// ─── Color Picker Row ────────────────────────────────────────────────────────

function ColorRow({
  label,
  variable,
  value,
  onChange,
}: {
  label: string;
  variable: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <div className="flex items-center gap-2 min-w-0">
        <div
          className="w-4 h-4 rounded border border-[#30363d] shrink-0 cursor-pointer"
          style={{ background: value }}
          onClick={() => document.getElementById(`cp-${variable}`)?.click()}
        />
        <span className="text-sm text-[#8b949e] truncate">{label}</span>
        <span className="text-[10px] text-[#484f58] hidden sm:block">{variable}</span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <input
          id={`cp-${variable}`}
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-8 h-7 rounded cursor-pointer border border-[#30363d] bg-transparent p-0.5"
        />
        <input
          type="text"
          value={value.toUpperCase()}
          onChange={(e) => {
            const v = e.target.value;
            if (/^#[0-9A-Fa-f]{0,6}$/.test(v)) onChange(v.length === 7 ? v : value);
          }}
          className="w-20 bg-[#161b22] border border-[#30363d] rounded px-2 py-1 text-[#c9d1d9] text-xs font-mono"
          maxLength={7}
        />
      </div>
    </div>
  );
}

// ─── Collapsible Section ─────────────────────────────────────────────────────

function Section({
  title,
  description,
  children,
  defaultOpen = true,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-[#30363d] rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-[#161b22] hover:bg-[#1c2128] text-left"
      >
        <div>
          <span className="text-sm text-[#c9d1d9] font-medium">{title}</span>
          <span className="ml-2 text-[11px] text-[#484f58]">{description}</span>
        </div>
        {open ? <ChevronDown size={14} className="text-[#8b949e]" /> : <ChevronRight size={14} className="text-[#8b949e]" />}
      </button>
      {open && <div className="px-4 pb-3 pt-1 bg-[#0d1117] divide-y divide-[#21262d]">{children}</div>}
    </div>
  );
}

// ─── ThemeBuilder ────────────────────────────────────────────────────────────

export function ThemeBuilder() {
  const [colors, setColors] = useState<ThemeColors>({ ...PRESET_THEMES[0].colors });
  const [appliedPreset, setAppliedPreset] = useState<string>(PRESET_THEMES[0].name);
  const [customThemes, setCustomThemes] = useState<Theme[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    } catch {
      return [];
    }
  });
  const [saveThemeName, setSaveThemeName] = useState('');
  const [applied, setApplied] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  const setColor = useCallback((key: keyof ThemeColors, value: string) => {
    setColors((prev) => ({ ...prev, [key]: value }));
  }, []);

  const applyTheme = useCallback(() => {
    for (const [key, value] of Object.entries(colors)) {
      document.documentElement.style.setProperty(key, value);
    }
    setApplied(true);
    setTimeout(() => setApplied(false), 2000);
  }, [colors]);

  const loadPreset = useCallback((preset: Theme) => {
    setColors({ ...preset.colors });
    setAppliedPreset(preset.name);
  }, []);

  const exportTheme = useCallback(() => {
    const data = JSON.stringify({ name: appliedPreset, colors }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${appliedPreset.toLowerCase().replace(/\s+/g, '-')}-theme.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [appliedPreset, colors]);

  const importTheme = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string) as Partial<Theme>;
        if (parsed.colors) {
          setColors((prev) => ({ ...prev, ...parsed.colors }));
          if (parsed.name) setAppliedPreset(parsed.name);
        }
      } catch {
        /* invalid JSON – ignore */
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }, []);

  const saveCustomTheme = useCallback(() => {
    if (!saveThemeName.trim()) return;
    const theme: Theme = { name: saveThemeName.trim(), colors: { ...colors } };
    setCustomThemes((prev) => {
      const filtered = prev.filter((t) => t.name !== theme.name);
      const next = [...filtered, theme];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
    setSaveThemeName('');
  }, [saveThemeName, colors]);

  const deleteCustomTheme = useCallback((name: string) => {
    setCustomThemes((prev) => {
      const next = prev.filter((t) => t.name !== name);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  // Persist to localStorage on every color change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(customThemes));
  }, [customThemes]);

  const allPresets = [...PRESET_THEMES, ...customThemes];

  return (
    <div className="h-full flex flex-col bg-[#0d1117]">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#30363d] flex items-center gap-2 shrink-0">
        <Palette size={18} className="text-[#8b949e]" />
        <h3 className="text-[#c9d1d9] font-medium">Theme Builder</h3>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Live Preview */}
        <div>
          <h4 className="text-xs font-semibold text-[#8b949e] uppercase tracking-wider mb-2">Live Preview</h4>
          <IDEPreview colors={colors} />
        </div>

        {/* Preset Themes */}
        <div>
          <h4 className="text-xs font-semibold text-[#8b949e] uppercase tracking-wider mb-2">Preset Themes</h4>
          <div className="grid grid-cols-2 gap-2">
            {allPresets.map((preset) => {
              const isActive = appliedPreset === preset.name && JSON.stringify(colors) === JSON.stringify(preset.colors);
              const isCustom = !PRESET_THEMES.find((p) => p.name === preset.name);
              return (
                <button
                  key={preset.name}
                  onClick={() => loadPreset(preset)}
                  className={`flex items-center gap-2 px-3 py-2 rounded border text-left text-sm transition-colors ${
                    isActive
                      ? 'border-[#58a6ff] bg-[#1c2128] text-[#c9d1d9]'
                      : 'border-[#30363d] text-[#8b949e] hover:border-[#58a6ff] hover:bg-[#161b22]'
                  }`}
                >
                  <div
                    className="w-3 h-3 rounded-full shrink-0 border border-[#30363d]"
                    style={{ background: preset.colors['--primary'] }}
                  />
                  <span className="truncate flex-1">{preset.name}</span>
                  {isActive && <Check size={12} className="text-[#58a6ff] shrink-0" />}
                  {isCustom && (
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteCustomTheme(preset.name); }}
                      className="text-[#484f58] hover:text-[#f85149] ml-1 shrink-0"
                      title="Delete custom theme"
                    >
                      ×
                    </button>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Color Groups */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-[#8b949e] uppercase tracking-wider mb-2">Colors</h4>
          {COLOR_GROUPS.map((group) => (
            <Section key={group.label} title={group.label} description={group.description}>
              {group.keys.map((key) => (
                <ColorRow
                  key={key}
                  label={COLOR_LABELS[key]}
                  variable={key}
                  value={colors[key]}
                  onChange={(v) => setColor(key, v)}
                />
              ))}
            </Section>
          ))}
        </div>

        {/* Save custom theme */}
        <div className="border border-[#30363d] rounded-lg p-4 bg-[#0d1117]">
          <h4 className="text-xs font-semibold text-[#8b949e] uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Paintbrush size={12} /> Save as Custom Theme
          </h4>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Theme name…"
              value={saveThemeName}
              onChange={(e) => setSaveThemeName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveCustomTheme()}
              className="flex-1 bg-[#161b22] border border-[#30363d] rounded px-3 py-1.5 text-sm text-[#c9d1d9] placeholder-[#484f58] focus:outline-none focus:border-[#58a6ff]"
            />
            <button
              onClick={saveCustomTheme}
              disabled={!saveThemeName.trim()}
              className="px-3 py-1.5 text-sm rounded border border-[#30363d] text-[#8b949e] hover:text-[#c9d1d9] hover:border-[#58a6ff] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Save
            </button>
          </div>
        </div>
      </div>

      {/* Footer actions */}
      <div className="px-4 py-3 border-t border-[#30363d] flex gap-2 shrink-0">
        <input ref={importRef} type="file" accept=".json" className="hidden" onChange={importTheme} />
        <button
          onClick={() => importRef.current?.click()}
          className="flex items-center gap-2 px-3 py-2 text-sm border border-[#30363d] text-[#8b949e] hover:text-[#c9d1d9] hover:border-[#58a6ff] rounded"
        >
          <Upload size={14} />
          Import
        </button>
        <button
          onClick={exportTheme}
          className="flex items-center gap-2 px-3 py-2 text-sm border border-[#30363d] text-[#8b949e] hover:text-[#c9d1d9] hover:border-[#58a6ff] rounded"
        >
          <Download size={14} />
          Export
        </button>
        <button
          onClick={applyTheme}
          className={`ml-auto flex items-center gap-2 px-4 py-2 text-sm rounded font-medium transition-colors ${
            applied ? 'bg-[#1f6feb] text-white' : 'bg-[#238636] hover:bg-[#2ea043] text-white'
          }`}
        >
          {applied ? <Check size={14} /> : <Palette size={14} />}
          {applied ? 'Applied!' : 'Apply Theme'}
        </button>
      </div>
    </div>
  );
}
