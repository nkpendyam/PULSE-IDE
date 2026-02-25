'use client';

import React, { useState } from 'react';
import { useExtendedKyroStore } from '@/store/extendedStore';
import { invoke } from '@tauri-apps/api/core';
import { Settings, Sun, Moon, Monitor, Save, RotateCcw } from 'lucide-react';

export function SettingsPanel() {
  const { theme, settings, updateSettings, setTheme, updateChannel, autoUpdateEnabled, setUpdateChannel } = useExtendedKyroStore();
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    // Save settings to backend
    localStorage.setItem('kro-settings', JSON.stringify(settings));
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
  };

  return (
    <div className="h-full flex flex-col bg-[#0d1117]">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#30363d] flex items-center gap-2">
        <Settings size={18} className="text-[#8b949e]" />
        <h3 className="text-[#c9d1d9] font-medium">Settings</h3>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Appearance */}
        <section>
          <h4 className="text-sm text-[#c9d1d9] font-medium mb-3">Appearance</h4>
          
          {/* Theme */}
          <div className="space-y-2">
            <label className="text-sm text-[#8b949e]">Theme</label>
            <div className="flex gap-2">
              <button
                onClick={() => setTheme('light')}
                className={`flex items-center gap-2 px-3 py-2 rounded border ${
                  theme === 'light'
                    ? 'bg-[#21262d] border-[#58a6ff] text-[#c9d1d9]'
                    : 'border-[#30363d] text-[#8b949e] hover:border-[#58a6ff]'
                }`}
              >
                <Sun size={16} />
                Light
              </button>
              <button
                onClick={() => setTheme('dark')}
                className={`flex items-center gap-2 px-3 py-2 rounded border ${
                  theme === 'dark'
                    ? 'bg-[#21262d] border-[#58a6ff] text-[#c9d1d9]'
                    : 'border-[#30363d] text-[#8b949e] hover:border-[#58a6ff]'
                }`}
              >
                <Moon size={16} />
                Dark
              </button>
              <button
                onClick={() => setTheme('system')}
                className={`flex items-center gap-2 px-3 py-2 rounded border ${
                  theme === 'system'
                    ? 'bg-[#21262d] border-[#58a6ff] text-[#c9d1d9]'
                    : 'border-[#30363d] text-[#8b949e] hover:border-[#58a6ff]'
                }`}
              >
                <Monitor size={16} />
                System
              </button>
            </div>
          </div>
        </section>

        {/* Editor */}
        <section>
          <h4 className="text-sm text-[#c9d1d9] font-medium mb-3">Editor</h4>
          
          <div className="space-y-4">
            {/* Font Size */}
            <div className="flex items-center justify-between">
              <label className="text-sm text-[#8b949e]">Font Size</label>
              <input
                type="number"
                value={settings.fontSize}
                onChange={(e) => updateSettings({ fontSize: parseInt(e.target.value) || 14 })}
                min={8}
                max={32}
                className="w-20 bg-[#161b22] border border-[#30363d] rounded px-3 py-1 text-[#c9d1d9] text-sm"
              />
            </div>

            {/* Tab Size */}
            <div className="flex items-center justify-between">
              <label className="text-sm text-[#8b949e]">Tab Size</label>
              <select
                value={settings.tabSize}
                onChange={(e) => updateSettings({ tabSize: parseInt(e.target.value) })}
                className="w-20 bg-[#161b22] border border-[#30363d] rounded px-3 py-1 text-[#c9d1d9] text-sm"
              >
                <option value={2}>2</option>
                <option value={4}>4</option>
                <option value={8}>8</option>
              </select>
            </div>

            {/* Word Wrap */}
            <div className="flex items-center justify-between">
              <label className="text-sm text-[#8b949e]">Word Wrap</label>
              <button
                onClick={() => updateSettings({ wordWrap: !settings.wordWrap })}
                className={`w-12 h-6 rounded-full relative ${
                  settings.wordWrap ? 'bg-[#238636]' : 'bg-[#21262d]'
                }`}
              >
                <div
                  className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                    settings.wordWrap ? 'translate-x-7' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Minimap */}
            <div className="flex items-center justify-between">
              <label className="text-sm text-[#8b949e]">Show Minimap</label>
              <button
                onClick={() => updateSettings({ minimap: !settings.minimap })}
                className={`w-12 h-6 rounded-full relative ${
                  settings.minimap ? 'bg-[#238636]' : 'bg-[#21262d]'
                }`}
              >
                <div
                  className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                    settings.minimap ? 'translate-x-7' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Format on Save */}
            <div className="flex items-center justify-between">
              <label className="text-sm text-[#8b949e]">Format on Save</label>
              <button
                onClick={() => updateSettings({ formatOnSave: !settings.formatOnSave })}
                className={`w-12 h-6 rounded-full relative ${
                  settings.formatOnSave ? 'bg-[#238636]' : 'bg-[#21262d]'
                }`}
              >
                <div
                  className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                    settings.formatOnSave ? 'translate-x-7' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Auto Save */}
            <div className="flex items-center justify-between">
              <label className="text-sm text-[#8b949e]">Auto Save</label>
              <button
                onClick={() => updateSettings({ autoSave: !settings.autoSave })}
                className={`w-12 h-6 rounded-full relative ${
                  settings.autoSave ? 'bg-[#238636]' : 'bg-[#21262d]'
                }`}
              >
                <div
                  className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                    settings.autoSave ? 'translate-x-7' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </section>

        {/* Updates */}
        <section>
          <h4 className="text-sm text-[#c9d1d9] font-medium mb-3">Updates</h4>
          
          <div className="space-y-4">
            {/* Update Channel */}
            <div className="flex items-center justify-between">
              <label className="text-sm text-[#8b949e]">Update Channel</label>
              <select
                value={updateChannel}
                onChange={(e) => setUpdateChannel(e.target.value)}
                className="w-28 bg-[#161b22] border border-[#30363d] rounded px-3 py-1 text-[#c9d1d9] text-sm"
              >
                <option value="stable">Stable</option>
                <option value="beta">Beta</option>
                <option value="nightly">Nightly</option>
              </select>
            </div>

            {/* Auto Update */}
            <div className="flex items-center justify-between">
              <label className="text-sm text-[#8b949e]">Auto Update</label>
              <button
                onClick={async () => {
                  await invoke('set_auto_update', { enabled: !autoUpdateEnabled });
                }}
                className={`w-12 h-6 rounded-full relative ${
                  autoUpdateEnabled ? 'bg-[#238636]' : 'bg-[#21262d]'
                }`}
              >
                <div
                  className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                    autoUpdateEnabled ? 'translate-x-7' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </section>
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
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
}
