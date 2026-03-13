'use client';

import React, { useState, useMemo } from 'react';
import { useExtendedKyroStore } from '@/store/extendedStore';
import { useKyroStore } from '@/store/kyroStore';
import { invoke } from '@tauri-apps/api/core';
import { Settings, Sun, Moon, Monitor, Save, RotateCcw, Sparkles, Search, X } from 'lucide-react';

// Reusable toggle switch component
function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={`w-12 h-6 rounded-full relative ${value ? 'bg-[#238636]' : 'bg-[#21262d]'}`}
      aria-label={label}
    >
      <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${value ? 'translate-x-7' : 'translate-x-1'}`} />
    </button>
  );
}

// ─── Setting item descriptor used for search ─────────────────────────────────

interface SettingItem {
  id: string;
  label: string;
  description?: string;
  section: string;
  render: () => React.ReactNode;
}

export function SettingsPanel() {
  const { theme, settings, updateSettings, setTheme, updateChannel, autoUpdateEnabled, setUpdateChannel } = useExtendedKyroStore();
  const editorOptions = useKyroStore(s => s.settings.editorOptions);
  const setEditorOptions = useKyroStore(s => s.setEditorOptions);
  const ghostTextConfig = useKyroStore(s => s.ghostTextConfig);
  const setGhostTextConfig = useKyroStore(s => s.setGhostTextConfig);
  const aiTemperature = useKyroStore(s => s.aiTemperature);
  const setAiTemperature = useKyroStore(s => s.setAiTemperature);
  const aiMaxTokens = useKyroStore(s => s.aiMaxTokens);
  const setAiMaxTokens = useKyroStore(s => s.setAiMaxTokens);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  const handleSave = async () => {
    setSaving(true);
    const failed: string[] = [];
    for (const [key, value] of Object.entries(settings)) {
      try {
        await invoke('set_setting', { key, value: JSON.stringify(value) });
      } catch {
        failed.push(key);
      }
    }
    if (failed.length > 0) {
      // Backend unavailable or partial failure – persist everything to localStorage as fallback
      localStorage.setItem('kro-settings', JSON.stringify(settings));
    }
    setSaving(false);
  };

  const handleReset = () => {
    updateSettings({
      fontSize: 14,
      tabSize: 4,
      wordWrap: true,
      minimap: true,
      formatOnSave: true,
      autoSave: true,
      autoSaveDelay: 1000,
    });
    setEditorOptions({
      cursorSmoothCaret: true,
      smoothScrolling: true,
      formatOnPaste: false,
      linkedEditing: false,
      renderLineHighlight: 'line',
      indentationGuides: true,
      bracketPairGuides: true,
      wordWrapColumn: 80,
      zenMode: false,
    });
    setAiTemperature(0.7);
    setAiMaxTokens(2048);
  };

  // ─── All setting items (used for search filtering) ─────────────────────────

  const allItems: SettingItem[] = useMemo(() => [
    // ── Appearance ───────────────────────────────────────────────────────────
    {
      id: 'theme',
      label: 'Theme',
      description: 'Color theme for the application',
      section: 'Appearance',
      render: () => (
        <div className="flex gap-2">
          {(['light', 'dark', 'system'] as const).map((t) => {
            const Icon = t === 'light' ? Sun : t === 'dark' ? Moon : Monitor;
            return (
              <button
                key={t}
                onClick={() => setTheme(t)}
                className={`flex items-center gap-2 px-3 py-2 rounded border ${
                  theme === t
                    ? 'bg-[#21262d] border-[#58a6ff] text-[#c9d1d9]'
                    : 'border-[#30363d] text-[#8b949e] hover:border-[#58a6ff]'
                }`}
              >
                <Icon size={16} />
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            );
          })}
        </div>
      ),
    },
    // ── Editor ───────────────────────────────────────────────────────────────
    {
      id: 'fontSize',
      label: 'Font Size',
      description: 'Editor font size in pixels',
      section: 'Editor',
      render: () => (
        <input
          type="number"
          value={settings.fontSize}
          onChange={(e) => updateSettings({ fontSize: parseInt(e.target.value) || 14 })}
          min={8} max={32}
          className="w-20 bg-[#161b22] border border-[#30363d] rounded px-3 py-1 text-[#c9d1d9] text-sm"
        />
      ),
    },
    {
      id: 'tabSize',
      label: 'Tab Size',
      description: 'Number of spaces per tab',
      section: 'Editor',
      render: () => (
        <select
          value={settings.tabSize}
          onChange={(e) => updateSettings({ tabSize: parseInt(e.target.value) })}
          className="w-20 bg-[#161b22] border border-[#30363d] rounded px-3 py-1 text-[#c9d1d9] text-sm"
        >
          <option value={2}>2</option>
          <option value={4}>4</option>
          <option value={8}>8</option>
        </select>
      ),
    },
    {
      id: 'wordWrap',
      label: 'Word Wrap',
      description: 'Wrap long lines in the editor',
      section: 'Editor',
      render: () => (
        <Toggle value={settings.wordWrap} onChange={(v) => updateSettings({ wordWrap: v })} label="Word Wrap" />
      ),
    },
    {
      id: 'minimap',
      label: 'Show Minimap',
      description: 'Show the code minimap on the right side',
      section: 'Editor',
      render: () => (
        <Toggle value={settings.minimap} onChange={(v) => updateSettings({ minimap: v })} label="Show Minimap" />
      ),
    },
    {
      id: 'formatOnSave',
      label: 'Format on Save',
      description: 'Automatically format code when saving',
      section: 'Editor',
      render: () => (
        <Toggle value={settings.formatOnSave} onChange={(v) => updateSettings({ formatOnSave: v })} label="Format on Save" />
      ),
    },
    {
      id: 'autoSave',
      label: 'Auto Save',
      description: 'Automatically save files',
      section: 'Editor',
      render: () => (
        <Toggle value={settings.autoSave} onChange={(v) => updateSettings({ autoSave: v })} label="Auto Save" />
      ),
    },
    // ── Advanced Editor ───────────────────────────────────────────────────────
    {
      id: 'stickyScroll',
      label: 'Sticky Scroll',
      description: 'Pin scope headers at top of editor',
      section: 'Advanced Editor',
      render: () => (
        <Toggle value={editorOptions.stickyScroll} onChange={(v) => setEditorOptions({ stickyScroll: v })} label="Sticky Scroll" />
      ),
    },
    {
      id: 'bracketPairColorization',
      label: 'Bracket Colorization',
      description: 'Colorize matching bracket pairs',
      section: 'Advanced Editor',
      render: () => (
        <Toggle value={editorOptions.bracketPairColorization} onChange={(v) => setEditorOptions({ bracketPairColorization: v })} label="Bracket Colorization" />
      ),
    },
    {
      id: 'inlineSuggest',
      label: 'Inline Suggestions',
      description: 'Show AI completions inline',
      section: 'Advanced Editor',
      render: () => (
        <Toggle value={editorOptions.inlineSuggest} onChange={(v) => setEditorOptions({ inlineSuggest: v })} label="Inline Suggest" />
      ),
    },
    {
      id: 'renderWhitespace',
      label: 'Render Whitespace',
      description: 'When to render whitespace characters',
      section: 'Advanced Editor',
      render: () => (
        <select
          value={editorOptions.renderWhitespace}
          onChange={(e) => setEditorOptions({ renderWhitespace: e.target.value as 'none' | 'boundary' | 'selection' | 'all' })}
          className="w-28 bg-[#161b22] border border-[#30363d] rounded px-3 py-1 text-[#c9d1d9] text-sm"
        >
          <option value="none">None</option>
          <option value="boundary">Boundary</option>
          <option value="selection">Selection</option>
          <option value="all">All</option>
        </select>
      ),
    },
    {
      id: 'lineNumbers',
      label: 'Line Numbers',
      description: 'How line numbers are displayed',
      section: 'Advanced Editor',
      render: () => (
        <select
          value={editorOptions.lineNumbers}
          onChange={(e) => setEditorOptions({ lineNumbers: e.target.value as 'on' | 'off' | 'relative' })}
          className="w-28 bg-[#161b22] border border-[#30363d] rounded px-3 py-1 text-[#c9d1d9] text-sm"
        >
          <option value="on">On</option>
          <option value="off">Off</option>
          <option value="relative">Relative</option>
        </select>
      ),
    },
    {
      id: 'autoSaveMode',
      label: 'Auto Save Mode',
      description: 'When files are automatically saved',
      section: 'Advanced Editor',
      render: () => (
        <select
          value={editorOptions.autoSave}
          onChange={(e) => setEditorOptions({ autoSave: e.target.value as 'off' | 'afterDelay' | 'onFocusChange' })}
          className="w-32 bg-[#161b22] border border-[#30363d] rounded px-3 py-1 text-[#c9d1d9] text-sm"
        >
          <option value="off">Off</option>
          <option value="afterDelay">After Delay</option>
          <option value="onFocusChange">On Focus Change</option>
        </select>
      ),
    },
    {
      id: 'formatOnSaveAdvanced',
      label: 'Format on Save',
      description: 'Format document before saving (editor option)',
      section: 'Advanced Editor',
      render: () => (
        <Toggle value={editorOptions.formatOnSave} onChange={(v) => setEditorOptions({ formatOnSave: v })} label="Format on Save" />
      ),
    },
    {
      id: 'cursorSmoothCaret',
      label: 'Smooth Caret Animation',
      description: 'Animate cursor movement with smooth interpolation',
      section: 'Advanced Editor',
      render: () => (
        <Toggle value={editorOptions.cursorSmoothCaret} onChange={(v) => setEditorOptions({ cursorSmoothCaret: v })} label="Smooth Caret" />
      ),
    },
    {
      id: 'smoothScrolling',
      label: 'Smooth Scrolling',
      description: 'Animate scrolling within the editor',
      section: 'Advanced Editor',
      render: () => (
        <Toggle value={editorOptions.smoothScrolling} onChange={(v) => setEditorOptions({ smoothScrolling: v })} label="Smooth Scrolling" />
      ),
    },
    {
      id: 'formatOnPaste',
      label: 'Format on Paste',
      description: 'Automatically format pasted code',
      section: 'Advanced Editor',
      render: () => (
        <Toggle value={editorOptions.formatOnPaste} onChange={(v) => setEditorOptions({ formatOnPaste: v })} label="Format on Paste" />
      ),
    },
    {
      id: 'linkedEditing',
      label: 'Linked Editing',
      description: 'Auto-rename matching HTML/JSX tags',
      section: 'Advanced Editor',
      render: () => (
        <Toggle value={editorOptions.linkedEditing} onChange={(v) => setEditorOptions({ linkedEditing: v })} label="Linked Editing" />
      ),
    },
    {
      id: 'renderLineHighlight',
      label: 'Highlight Current Line',
      description: 'How the current line is highlighted',
      section: 'Advanced Editor',
      render: () => (
        <select
          value={editorOptions.renderLineHighlight}
          onChange={(e) => setEditorOptions({ renderLineHighlight: e.target.value as 'none' | 'gutter' | 'line' | 'all' })}
          className="w-24 bg-[#161b22] border border-[#30363d] rounded px-3 py-1 text-[#c9d1d9] text-sm"
        >
          <option value="none">None</option>
          <option value="gutter">Gutter</option>
          <option value="line">Line</option>
          <option value="all">All</option>
        </select>
      ),
    },
    {
      id: 'indentationGuides',
      label: 'Indentation Guides',
      description: 'Show vertical lines for indentation levels',
      section: 'Advanced Editor',
      render: () => (
        <Toggle value={editorOptions.indentationGuides} onChange={(v) => setEditorOptions({ indentationGuides: v })} label="Indentation Guides" />
      ),
    },
    {
      id: 'bracketPairGuides',
      label: 'Bracket Pair Guides',
      description: 'Show guides for matching bracket pairs',
      section: 'Advanced Editor',
      render: () => (
        <Toggle value={editorOptions.bracketPairGuides} onChange={(v) => setEditorOptions({ bracketPairGuides: v })} label="Bracket Pair Guides" />
      ),
    },
    {
      id: 'wordWrapColumn',
      label: 'Word Wrap Column',
      description: 'Column at which lines wrap when word wrap is enabled',
      section: 'Advanced Editor',
      render: () => (
        <input
          type="number"
          value={editorOptions.wordWrapColumn}
          onChange={(e) => setEditorOptions({ wordWrapColumn: Math.max(40, Math.min(500, parseInt(e.target.value) || 80)) })}
          min={40} max={500}
          className="w-20 bg-[#161b22] border border-[#30363d] rounded px-3 py-1 text-[#c9d1d9] text-sm"
        />
      ),
    },
    {
      id: 'zenMode',
      label: 'Zen Mode',
      description: 'Full-screen distraction-free editing mode',
      section: 'Advanced Editor',
      render: () => (
        <Toggle value={editorOptions.zenMode} onChange={(v) => setEditorOptions({ zenMode: v })} label="Zen Mode" />
      ),
    },
    // ── AI / Ghost Text ───────────────────────────────────────────────────────
    {
      id: 'ghostText',
      label: 'Ghost Text',
      description: 'AI-powered inline completions',
      section: 'AI',
      render: () => (
        <Toggle value={ghostTextConfig.enabled} onChange={(v) => setGhostTextConfig({ enabled: v })} label="Ghost Text" />
      ),
    },
    {
      id: 'ghostTemperature',
      label: 'Ghost Text Temperature',
      description: 'Lower = more focused, higher = more creative',
      section: 'AI',
      render: () => (
        <input
          type="number"
          value={ghostTextConfig.temperature}
          onChange={(e) => setGhostTextConfig({ temperature: Math.max(0, Math.min(2, parseFloat(e.target.value) || 0)) })}
          min={0} max={2} step={0.1}
          className="w-20 bg-[#161b22] border border-[#30363d] rounded px-3 py-1 text-[#c9d1d9] text-sm"
        />
      ),
    },
    {
      id: 'ghostMaxTokens',
      label: 'Ghost Text Max Tokens',
      description: 'Completion length limit for inline suggestions',
      section: 'AI',
      render: () => (
        <input
          type="number"
          value={ghostTextConfig.maxTokens}
          onChange={(e) => setGhostTextConfig({ maxTokens: Math.max(10, parseInt(e.target.value) || 100) })}
          min={10} max={500} step={10}
          className="w-20 bg-[#161b22] border border-[#30363d] rounded px-3 py-1 text-[#c9d1d9] text-sm"
        />
      ),
    },
    {
      id: 'debounceMs',
      label: 'Debounce (ms)',
      description: 'Delay before triggering a completion request',
      section: 'AI',
      render: () => (
        <input
          type="number"
          value={ghostTextConfig.debounceMs}
          onChange={(e) => setGhostTextConfig({ debounceMs: Math.max(50, parseInt(e.target.value) || 200) })}
          min={50} max={2000} step={50}
          className="w-20 bg-[#161b22] border border-[#30363d] rounded px-3 py-1 text-[#c9d1d9] text-sm"
        />
      ),
    },
    {
      id: 'completionCache',
      label: 'Completion Cache',
      description: 'Cache completions for faster repeated suggestions',
      section: 'AI',
      render: () => (
        <Toggle value={ghostTextConfig.cacheEnabled} onChange={(v) => setGhostTextConfig({ cacheEnabled: v })} label="Cache" />
      ),
    },
    {
      id: 'aiTemperature',
      label: 'AI Model Temperature',
      description: 'Controls creativity of AI chat responses (0.0–2.0)',
      section: 'AI',
      render: () => (
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={0} max={2} step={0.1}
            value={aiTemperature}
            onChange={(e) => setAiTemperature(parseFloat(e.target.value))}
            className="w-28 accent-[#58a6ff]"
          />
          <span className="text-sm text-[#c9d1d9] w-8 text-right">{aiTemperature.toFixed(1)}</span>
        </div>
      ),
    },
    {
      id: 'aiMaxTokens',
      label: 'AI Max Tokens',
      description: 'Maximum tokens in AI chat responses (256–8192)',
      section: 'AI',
      render: () => (
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={256} max={8192} step={256}
            value={aiMaxTokens}
            onChange={(e) => setAiMaxTokens(parseInt(e.target.value))}
            className="w-28 accent-[#58a6ff]"
          />
          <span className="text-sm text-[#c9d1d9] w-12 text-right">{aiMaxTokens}</span>
        </div>
      ),
    },
    // ── Updates ───────────────────────────────────────────────────────────────
    {
      id: 'updateChannel',
      label: 'Update Channel',
      description: 'Which release channel to receive updates from',
      section: 'Updates',
      render: () => (
        <select
          value={updateChannel}
          onChange={(e) => setUpdateChannel(e.target.value)}
          className="w-28 bg-[#161b22] border border-[#30363d] rounded px-3 py-1 text-[#c9d1d9] text-sm"
        >
          <option value="stable">Stable</option>
          <option value="beta">Beta</option>
          <option value="nightly">Nightly</option>
        </select>
      ),
    },
    {
      id: 'autoUpdate',
      label: 'Auto Update',
      description: 'Automatically download and install updates',
      section: 'Updates',
      render: () => (
        <button
          onClick={async () => { await invoke('set_auto_update', { enabled: !autoUpdateEnabled }); }}
          className={`w-12 h-6 rounded-full relative ${autoUpdateEnabled ? 'bg-[#238636]' : 'bg-[#21262d]'}`}
        >
          <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${autoUpdateEnabled ? 'translate-x-7' : 'translate-x-1'}`} />
        </button>
      ),
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [theme, settings, editorOptions, ghostTextConfig, aiTemperature, aiMaxTokens, updateChannel, autoUpdateEnabled]);

  // ─── Filter items by search query ─────────────────────────────────────────

  const filteredItems = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return allItems;
    return allItems.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        (item.description?.toLowerCase().includes(q) ?? false) ||
        item.section.toLowerCase().includes(q),
    );
  }, [search, allItems]);

  // Group filtered items by section
  const sections = useMemo(() => {
    const map = new Map<string, SettingItem[]>();
    for (const item of filteredItems) {
      const group = map.get(item.section) ?? [];
      group.push(item);
      map.set(item.section, group);
    }
    return map;
  }, [filteredItems]);

  const sectionOrder = ['Appearance', 'Editor', 'Advanced Editor', 'AI', 'Updates'];

  return (
    <div className="h-full flex flex-col bg-[#0d1117]">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#30363d] flex items-center gap-2">
        <Settings size={18} className="text-[#8b949e]" />
        <h3 className="text-[#c9d1d9] font-medium">Settings</h3>
      </div>

      {/* Search bar */}
      <div className="px-4 py-2 border-b border-[#30363d]">
        <div className="flex items-center gap-2 bg-[#161b22] border border-[#30363d] rounded px-3 py-1.5 focus-within:border-[#58a6ff]">
          <Search size={14} className="text-[#8b949e] shrink-0" />
          <input
            type="text"
            placeholder="Search settings…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-sm text-[#c9d1d9] placeholder-[#484f58] outline-none"
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-[#8b949e] hover:text-[#c9d1d9]">
              <X size={12} />
            </button>
          )}
        </div>
        {search && (
          <p className="text-[11px] text-[#484f58] mt-1">
            {filteredItems.length} result{filteredItems.length !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {filteredItems.length === 0 ? (
          <p className="text-sm text-[#484f58] text-center py-8">No settings match &quot;{search}&quot;</p>
        ) : (
          sectionOrder.map((sectionName) => {
            const items = sections.get(sectionName);
            if (!items?.length) return null;
            const isAI = sectionName === 'AI';
            return (
              <section key={sectionName}>
                <h4 className="text-sm text-[#c9d1d9] font-medium mb-3 flex items-center gap-1.5">
                  {isAI && <Sparkles size={14} className="text-[#a371f7]" />}
                  {isAI ? 'AI / Ghost Text' : sectionName}
                </h4>
                <div className="space-y-4">
                  {items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between">
                      <div>
                        <label className="text-sm text-[#8b949e]">{item.label}</label>
                        {item.description && (
                          <p className="text-[10px] text-[#484f58]">{item.description}</p>
                        )}
                      </div>
                      <div className="ml-4 shrink-0">{item.render()}</div>
                    </div>
                  ))}
                </div>
              </section>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-[#30363d] flex justify-end gap-2">
        <button
          onClick={handleReset}
          className="flex items-center gap-2 px-4 py-2 text-sm text-[#8b949e] hover:text-[#c9d1d9] hover:bg-[#21262d] rounded"
        >
          <RotateCcw size={16} />
          Reset
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-[#238636] hover:bg-[#2ea043] text-white rounded"
        >
          <Save size={16} />
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}


