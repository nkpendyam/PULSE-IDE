'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { X, Save, Check, GitMerge } from 'lucide-react';

interface ConflictBlock {
  id: number;
  oursLines: string[];
  theirsLines: string[];
  branchName: string;
  startIndex: number;
  endIndex: number;
  resolved: boolean;
}

interface MergeConflictEditorProps {
  filePath?: string;
  onClose: () => void;
  onSave?: (content: string) => void;
}

const DEMO_CONTENT = `import React from 'react';
<<<<<<< HEAD
import { useState, useEffect } from 'react';
import { useKyroStore } from '@/store/kyroStore';
=======
import { useState } from 'react';
import { useEditorStore } from '@/store/editorStore';
>>>>>>> feature/refactor-store

export function MyComponent() {
<<<<<<< HEAD
  const { openFiles, activeFileIndex } = useKyroStore();
  const activeFile = openFiles[activeFileIndex];
  const [count, setCount] = useState(0);
  const [label, setLabel] = useState('Hello');
=======
  const { currentFile } = useEditorStore();
  const [count, setCount] = useState(0);
>>>>>>> feature/refactor-store

  return (
    <div>
      <p>Count: {count}</p>
    </div>
  );
}
`;

function parseConflicts(content: string): ConflictBlock[] {
  const lines = content.split('\n');
  const blocks: ConflictBlock[] = [];
  let blockId = 0;

  let i = 0;
  while (i < lines.length) {
    if (lines[i].startsWith('<<<<<<< ')) {
      const startIndex = i;
      const branchName = lines[i].replace('<<<<<<< ', '').trim();
      const oursLines: string[] = [];
      i++;

      while (i < lines.length && !lines[i].startsWith('=======')) {
        oursLines.push(lines[i]);
        i++;
      }
      i++; // skip =======

      const theirsLines: string[] = [];
      let endIndex = i;
      while (i < lines.length && !lines[i].startsWith('>>>>>>> ')) {
        theirsLines.push(lines[i]);
        endIndex = i;
        i++;
      }
      endIndex = i; // points to >>>>>>> line

      blocks.push({
        id: blockId++,
        oursLines,
        theirsLines,
        branchName: lines[i]?.replace('>>>>>>> ', '').trim() ?? 'incoming',
        startIndex,
        endIndex,
        resolved: false,
      });
    }
    i++;
  }
  return blocks;
}

function applyResolution(
  content: string,
  block: ConflictBlock,
  resolution: 'ours' | 'theirs' | 'both'
): string {
  const lines = content.split('\n');
  const startIdx = lines.findIndex((l) => l.startsWith('<<<<<<< '));
  if (startIdx === -1) return content;

  // Find the specific conflict matching our block id by counting occurrences
  let found = -1;
  let count = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('<<<<<<< ')) {
      if (count === block.id) {
        found = i;
        break;
      }
      count++;
    }
  }
  if (found === -1) return content;

  let sepIdx = -1;
  let endIdx = -1;
  for (let i = found + 1; i < lines.length; i++) {
    if (lines[i].startsWith('=======') && sepIdx === -1) { sepIdx = i; continue; }
    if (lines[i].startsWith('>>>>>>> ')) { endIdx = i; break; }
  }
  if (sepIdx === -1 || endIdx === -1) return content;

  const oursContent = lines.slice(found + 1, sepIdx);
  const theirsContent = lines.slice(sepIdx + 1, endIdx);

  let replacement: string[];
  if (resolution === 'ours') replacement = oursContent;
  else if (resolution === 'theirs') replacement = theirsContent;
  else replacement = [...oursContent, ...theirsContent];

  return [
    ...lines.slice(0, found),
    ...replacement,
    ...lines.slice(endIdx + 1),
  ].join('\n');
}

function hasConflicts(content: string): boolean {
  return content.includes('<<<<<<< ');
}


export function MergeConflictEditor({ filePath, onClose, onSave }: MergeConflictEditorProps) {
  const [fileContent, setFileContent] = useState<string>('');
  const [resultContent, setResultContent] = useState<string>('');
  const [conflicts, setConflicts] = useState<ConflictBlock[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [savedFeedback, setSavedFeedback] = useState(false);
  const [selectedConflict, setSelectedConflict] = useState<number>(0);

  const loadFile = useCallback(async () => {
    if (!filePath) {
      setFileContent(DEMO_CONTENT);
      setResultContent(DEMO_CONTENT);
      return;
    }
    try {
      const content = await invoke<string>('read_file', { path: filePath });
      setFileContent(content);
      setResultContent(content);
    } catch {
      setFileContent(DEMO_CONTENT);
      setResultContent(DEMO_CONTENT);
    }
  }, [filePath]);

  useEffect(() => {
    loadFile();
  }, [loadFile]);

  useEffect(() => {
    setConflicts(parseConflicts(resultContent));
  }, [resultContent]);

  const remainingConflicts = conflicts.filter((c) => !c.resolved).length;
  const allResolved = hasConflicts(resultContent) === false;

  const handleAccept = (block: ConflictBlock, resolution: 'ours' | 'theirs' | 'both') => {
    const newContent = applyResolution(resultContent, block, resolution);
    setResultContent(newContent);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (filePath) {
        await invoke('write_file', { path: filePath, content: resultContent });
      } else {
        onSave?.(resultContent);
      }
      setSavedFeedback(true);
      setTimeout(() => {
        setSavedFeedback(false);
        onClose();
      }, 800);
    } catch {
      onSave?.(resultContent);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  // Build annotated line lists for ours/theirs panels
  const buildAnnotatedLines = (content: string, side: 'ours' | 'theirs') => {
    const lines = content.split('\n');
    const result: { text: string; type: 'normal' | 'conflict' | 'marker' }[] = [];
    let inConflict = false;
    let inOurs = true;

    for (const line of lines) {
      if (line.startsWith('<<<<<<< ')) {
        inConflict = true;
        inOurs = true;
        result.push({ text: line, type: 'marker' });
        continue;
      }
      if (line.startsWith('=======') && inConflict) {
        inOurs = false;
        result.push({ text: line, type: 'marker' });
        continue;
      }
      if (line.startsWith('>>>>>>> ') && inConflict) {
        inConflict = false;
        result.push({ text: line, type: 'marker' });
        continue;
      }

      if (!inConflict) {
        result.push({ text: line, type: 'normal' });
      } else if ((side === 'ours' && inOurs) || (side === 'theirs' && !inOurs)) {
        result.push({ text: line, type: 'conflict' });
      } else {
        result.push({ text: line, type: 'marker' });
      }
    }
    return result;
  };

  const oursAnnotated = buildAnnotatedLines(fileContent, 'ours');
  const theirsAnnotated = buildAnnotatedLines(fileContent, 'theirs');

  const conflictCount = conflicts.length;

  return (
    <div className="flex flex-col h-full bg-[#0d1117] text-[#c9d1d9] text-xs">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#161b22] border-b border-[#30363d] shrink-0">
        <div className="flex items-center gap-2">
          <GitMerge size={14} className="text-[#a371f7]" />
          <span className="font-medium text-sm">Merge Conflict Editor</span>
          {filePath && (
            <span className="text-[#8b949e] font-mono text-xs">
              {filePath.split('/').slice(-2).join('/')}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {allResolved ? (
            <span className="flex items-center gap-1 text-[#3fb950] text-xs">
              <Check size={12} />
              All {conflictCount} conflict{conflictCount !== 1 ? 's' : ''} resolved
            </span>
          ) : (
            <span className="text-[#d29922] text-xs">
              {hasConflicts(resultContent)
                ? `${parseConflicts(resultContent).length} conflict${parseConflicts(resultContent).length !== 1 ? 's' : ''} remaining`
                : 'No conflicts'}
            </span>
          )}

          <button
            onClick={handleSave}
            disabled={isSaving || !allResolved}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-colors ${
              allResolved && !isSaving
                ? 'bg-[#238636] text-white hover:bg-[#2ea043]'
                : 'bg-[#21262d] text-[#8b949e] cursor-not-allowed'
            }`}
          >
            {savedFeedback ? (
              <>
                <Check size={12} />
                Saved
              </>
            ) : (
              <>
                <Save size={12} />
                {isSaving ? 'Saving…' : 'Save & Close'}
              </>
            )}
          </button>

          <button
            onClick={onClose}
            className="p-1 rounded text-[#8b949e] hover:text-[#c9d1d9] hover:bg-[#21262d]"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Conflict navigation */}
      {conflicts.length > 0 && (
        <div className="flex items-center gap-2 px-4 py-1.5 bg-[#161b22] border-b border-[#30363d] shrink-0">
          <span className="text-[#8b949e]">Jump to conflict:</span>
          <div className="flex items-center gap-1">
            {conflicts.map((c, i) => (
              <button
                key={c.id}
                onClick={() => setSelectedConflict(i)}
                className={`w-6 h-6 rounded text-xs font-medium transition-colors ${
                  selectedConflict === i
                    ? 'bg-[#388bfd]/20 text-[#388bfd] border border-[#388bfd]/40'
                    : 'bg-[#21262d] text-[#8b949e] hover:text-[#c9d1d9]'
                }`}
              >
                {i + 1}
              </button>
            ))}
          </div>
          {conflicts[selectedConflict] && (
            <div className="flex items-center gap-1 ml-2">
              <button
                onClick={() => handleAccept(conflicts[selectedConflict], 'ours')}
                className="px-2 py-0.5 rounded text-[10px] font-medium bg-[#1c3a2a] text-[#3fb950] border border-[#3fb950]/30 hover:bg-[#1c3a2a]/80 transition-colors"
              >
                Accept Ours
              </button>
              <button
                onClick={() => handleAccept(conflicts[selectedConflict], 'theirs')}
                className="px-2 py-0.5 rounded text-[10px] font-medium bg-[#1c2a3a] text-[#388bfd] border border-[#388bfd]/30 hover:bg-[#1c2a3a]/80 transition-colors"
              >
                Accept Theirs
              </button>
              <button
                onClick={() => handleAccept(conflicts[selectedConflict], 'both')}
                className="px-2 py-0.5 rounded text-[10px] font-medium bg-[#2d1c3a] text-[#a371f7] border border-[#a371f7]/30 hover:bg-[#2d1c3a]/80 transition-colors"
              >
                Accept Both
              </button>
            </div>
          )}
        </div>
      )}

      {/* 3-panel layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT: Ours */}
        <div className="flex flex-col flex-1 border-r border-[#30363d] overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[#161b22] border-b border-[#30363d] shrink-0">
            <span className="w-2 h-2 rounded-full bg-[#3fb950]" />
            <span className="font-medium text-[#3fb950]">Ours</span>
            <span className="text-[#8b949e]">(Current Branch)</span>
          </div>
          <div className="flex-1 overflow-auto font-mono text-xs leading-5">
            {oursAnnotated.map((item, i) => (
              <div
                key={i}
                className={`flex px-0 ${
                  item.type === 'conflict'
                    ? 'bg-[#1c3a2a]'
                    : item.type === 'marker'
                    ? 'bg-[#1c2d1c] text-[#3fb950]/60'
                    : ''
                }`}
              >
                <span className="w-10 text-right pr-3 text-[#8b949e]/50 select-none shrink-0 border-r border-[#30363d]">
                  {i + 1}
                </span>
                <span
                  className={`flex-1 px-3 whitespace-pre ${
                    item.type === 'conflict' ? 'text-[#3fb950]' : 'text-[#c9d1d9]'
                  }`}
                >
                  {item.text || ' '}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* CENTER: Result */}
        <div className="flex flex-col flex-1 border-r border-[#30363d] overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[#161b22] border-b border-[#30363d] shrink-0">
            <span className="w-2 h-2 rounded-full bg-[#a371f7]" />
            <span className="font-medium text-[#a371f7]">Result</span>
            <span className="text-[#8b949e]">(Editable)</span>
            {allResolved && (
              <span className="ml-auto flex items-center gap-1 text-[#3fb950]">
                <Check size={10} />
                <span>Clean</span>
              </span>
            )}
          </div>
          <textarea
            value={resultContent}
            onChange={(e) => setResultContent(e.target.value)}
            spellCheck={false}
            className="flex-1 bg-[#0d1117] text-[#c9d1d9] font-mono text-xs leading-5 p-3 resize-none outline-none border-0 focus:ring-0"
          />
        </div>

        {/* RIGHT: Theirs */}
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[#161b22] border-b border-[#30363d] shrink-0">
            <span className="w-2 h-2 rounded-full bg-[#388bfd]" />
            <span className="font-medium text-[#388bfd]">Theirs</span>
            <span className="text-[#8b949e]">(Incoming)</span>
          </div>
          <div className="flex-1 overflow-auto font-mono text-xs leading-5">
            {theirsAnnotated.map((item, i) => (
              <div
                key={i}
                className={`flex px-0 ${
                  item.type === 'conflict'
                    ? 'bg-[#1c2a3a]'
                    : item.type === 'marker'
                    ? 'bg-[#1c1c2d] text-[#388bfd]/60'
                    : ''
                }`}
              >
                <span className="w-10 text-right pr-3 text-[#8b949e]/50 select-none shrink-0 border-r border-[#30363d]">
                  {i + 1}
                </span>
                <span
                  className={`flex-1 px-3 whitespace-pre ${
                    item.type === 'conflict' ? 'text-[#388bfd]' : 'text-[#c9d1d9]'
                  }`}
                >
                  {item.text || ' '}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-1.5 bg-[#161b22] border-t border-[#30363d] text-[#8b949e] shrink-0">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#3fb950]" />
            Ours: HEAD
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#388bfd]" />
            Theirs:{' '}
            {conflicts[0]?.branchName ?? 'incoming'}
          </span>
        </div>

        <button
          onClick={onClose}
          className="px-3 py-1 rounded text-xs hover:bg-[#21262d] transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
