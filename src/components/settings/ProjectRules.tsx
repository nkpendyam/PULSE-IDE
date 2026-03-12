'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { FileText, Plus, Trash2, Save, ChevronRight, AlertCircle, Info } from 'lucide-react';

export interface ProjectRule {
  id: string;
  name: string;
  content: string;
  enabled: boolean;
  isGlobal: boolean; // true = workspace-level, false = folder-level
  source: string; // file path or 'manual'
}

const DEFAULT_RULES_TEMPLATE = `# Kyro Project Rules
# These rules are included as context in every AI interaction.
# Similar to .cursorrules / .github/copilot-instructions.md

## Project Overview
# Describe your project here so the AI understands the codebase.

## Code Style
# - Use TypeScript strict mode
# - Prefer functional components with hooks
# - Use Tailwind CSS for styling

## Architecture
# - Next.js App Router
# - Zustand for state management
# - Tauri for desktop backend

## Conventions
# - File naming: kebab-case for files, PascalCase for components
# - Imports: absolute paths with @/ prefix
# - Tests: colocated in __tests__ directories

## Do NOT
# - Do not use class components
# - Do not use CSS modules
# - Do not add dependencies without approval
`;

interface ProjectRulesProps {
  projectPath: string | null;
}

export function ProjectRules({ projectPath }: ProjectRulesProps) {
  const [rules, setRules] = useState<ProjectRule[]>([]);
  const [activeRule, setActiveRule] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [loading, setLoading] = useState(false);

  // Load rules from .kyrorules file
  useEffect(() => {
    async function loadRules() {
      setLoading(true);
      try {
        if (typeof window !== 'undefined' && window.__TAURI__) {
          // Try to read .kyrorules
          try {
            const result = await window.__TAURI__.core.invoke<{ path: string; content: string; language: string }>('read_file', {
              path: '.kyrorules'
            });
            setRules([{
              id: 'kyrorules',
              name: '.kyrorules',
              content: result.content,
              enabled: true,
              isGlobal: true,
              source: '.kyrorules',
            }]);
          } catch {
            // File doesn't exist
          }

          // Also check .github/copilot-instructions.md
          try {
            const result = await window.__TAURI__.core.invoke<{ path: string; content: string; language: string }>('read_file', {
              path: '.github/copilot-instructions.md'
            });
            setRules(prev => [...prev, {
              id: 'copilot-instructions',
              name: 'copilot-instructions.md',
              content: result.content,
              enabled: true,
              isGlobal: true,
              source: '.github/copilot-instructions.md',
            }]);
          } catch {
            // File doesn't exist
          }
        }
      } finally {
        setLoading(false);
      }
    }
    loadRules();
  }, [projectPath]);

  const handleSelectRule = useCallback((ruleId: string) => {
    if (isDirty) {
      // Save current before switching
      handleSave();
    }
    setActiveRule(ruleId);
    const rule = rules.find(r => r.id === ruleId);
    if (rule) {
      setEditContent(rule.content);
      setIsDirty(false);
    }
  }, [rules, isDirty]);

  const handleSave = useCallback(async () => {
    if (!activeRule) return;
    
    const rule = rules.find(r => r.id === activeRule);
    if (!rule) return;

    setRules(prev => prev.map(r =>
      r.id === activeRule ? { ...r, content: editContent } : r
    ));

    // Save to filesystem
    if (typeof window !== 'undefined' && window.__TAURI__) {
      try {
        await window.__TAURI__.core.invoke('write_file', {
          path: rule.source,
          content: editContent,
        });
      } catch (e) {
        console.error('Failed to save rule file:', e);
      }
    }
    
    setIsDirty(false);
  }, [activeRule, editContent, rules]);

  const handleCreateNew = useCallback(async () => {
    const newRule: ProjectRule = {
      id: `rule-${Date.now()}`,
      name: '.kyrorules',
      content: DEFAULT_RULES_TEMPLATE,
      enabled: true,
      isGlobal: true,
      source: '.kyrorules',
    };

    // Save to filesystem
    if (typeof window !== 'undefined' && window.__TAURI__) {
      try {
        await window.__TAURI__.core.invoke('write_file', {
          path: '.kyrorules',
          content: DEFAULT_RULES_TEMPLATE,
        });
      } catch (e) {
        console.error('Failed to create .kyrorules:', e);
      }
    }

    setRules(prev => [...prev, newRule]);
    setActiveRule(newRule.id);
    setEditContent(newRule.content);
    setIsDirty(false);
  }, []);

  const handleToggleRule = useCallback((ruleId: string) => {
    setRules(prev => prev.map(r =>
      r.id === ruleId ? { ...r, enabled: !r.enabled } : r
    ));
  }, []);

  const handleDeleteRule = useCallback(async (ruleId: string) => {
    const rule = rules.find(r => r.id === ruleId);
    if (!rule) return;

    setRules(prev => prev.filter(r => r.id !== ruleId));
    if (activeRule === ruleId) {
      setActiveRule(null);
      setEditContent('');
    }
  }, [rules, activeRule]);

  const activeRuleObj = rules.find(r => r.id === activeRule);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b border-[#30363d]">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-[#c9d1d9]">Project Rules</span>
          <button
            onClick={handleCreateNew}
            className="p-1 rounded hover:bg-[#21262d] text-[#8b949e] hover:text-[#c9d1d9]"
            title="Create .kyrorules"
          >
            <Plus size={12} />
          </button>
        </div>
        <p className="text-[10px] text-[#8b949e]">
          Rules are included as context in every AI interaction
        </p>
      </div>

      {/* Rule list */}
      <div className="border-b border-[#30363d]">
        {rules.length === 0 ? (
          <div className="p-4 text-center">
            <Info size={20} className="mx-auto mb-2 text-[#8b949e] opacity-50" />
            <p className="text-xs text-[#8b949e]">No project rules found</p>
            <button
              onClick={handleCreateNew}
              className="mt-2 px-3 py-1 rounded text-xs bg-[#21262d] text-[#c9d1d9] hover:bg-[#30363d] transition-colors"
            >
              Create .kyrorules
            </button>
          </div>
        ) : (
          rules.map(rule => (
            <div
              key={rule.id}
              className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer transition-colors ${
                activeRule === rule.id ? 'bg-[#388bfd0d]' : 'hover:bg-[#161b22]'
              }`}
              onClick={() => handleSelectRule(rule.id)}
            >
              <input
                type="checkbox"
                checked={rule.enabled}
                onChange={(e) => { e.stopPropagation(); handleToggleRule(rule.id); }}
                className="accent-[#58a6ff] w-3 h-3"
              />
              <FileText size={12} className={rule.enabled ? 'text-[#58a6ff]' : 'text-[#484f58]'} />
              <span className={`text-xs flex-1 ${rule.enabled ? 'text-[#c9d1d9]' : 'text-[#484f58]'}`}>
                {rule.name}
              </span>
              <span className="text-[10px] text-[#484f58]">{rule.source}</span>
              <button
                onClick={(e) => { e.stopPropagation(); handleDeleteRule(rule.id); }}
                className="p-0.5 rounded text-[#484f58] hover:text-[#f85149]"
              >
                <Trash2 size={10} />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Editor */}
      {activeRuleObj && (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between px-3 py-1.5 bg-[#161b22] border-b border-[#30363d]">
            <span className="text-[10px] text-[#8b949e]">
              Editing: {activeRuleObj.name}
              {isDirty && <span className="ml-1 text-[#d29922]">●</span>}
            </span>
            <button
              onClick={handleSave}
              disabled={!isDirty}
              className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-[#21262d] text-[#8b949e] hover:text-[#c9d1d9] disabled:opacity-30 transition-colors"
            >
              <Save size={9} /> Save
            </button>
          </div>
          <textarea
            value={editContent}
            onChange={(e) => { setEditContent(e.target.value); setIsDirty(true); }}
            className="flex-1 p-3 bg-[#0d1117] text-xs text-[#c9d1d9] font-mono resize-none focus:outline-none focus:ring-1 focus:ring-[#58a6ff]/30"
            spellCheck={false}
            placeholder="Write your project rules here..."
          />
        </div>
      )}
    </div>
  );
}

/**
 * Get all enabled project rules as a combined context string
 * for injection into AI prompts.
 */
export function getRulesContext(rules: ProjectRule[]): string {
  const enabled = rules.filter(r => r.enabled);
  if (enabled.length === 0) return '';
  
  return enabled
    .map(r => `--- ${r.name} ---\n${r.content}`)
    .join('\n\n');
}
