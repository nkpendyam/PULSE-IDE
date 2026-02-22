'use client';

import React, { useState } from 'react';
import { ChevronRight, ChevronDown, File, Folder, FolderOpen } from 'lucide-react';
import { useKyroStore, FileNode } from '@/store/kyroStore';

interface FileTreeProps { node: FileNode; onFileClick: (path: string) => void; level: number; }

export function FileTree({ node, onFileClick, level }: FileTreeProps) {
  const [isExpanded, setIsExpanded] = useState(level < 2);
  const { openFiles } = useKyroStore();
  const isOpen = openFiles.some(f => f.path === node.path);
  
  const getFileIcon = (name: string, isDir: boolean) => {
    if (isDir) return null;
    const ext = name.split('.').pop()?.toLowerCase();
    const iconMap: Record<string, string> = { 'rs': '🦀', 'py': '🐍', 'js': '📜', 'ts': '📘', 'go': '🔵', 'java': '☕', 'html': '🌐', 'css': '🎨', 'json': '📋', 'md': '📝' };
    return iconMap[ext || ''] || null;
  };
  
  if (node.name.startsWith('.')) return null;
  
  const icon = getFileIcon(node.name, node.isDirectory);
  const paddingLeft = level * 12 + 8;
  
  return (
    <div className="select-none">
      <div className={`flex items-center gap-1 py-1 px-1 cursor-pointer hover:bg-[#21262d] rounded ${isOpen ? 'bg-[#1f6feb33]' : ''}`} style={{ paddingLeft }}
        onClick={() => node.isDirectory ? setIsExpanded(!isExpanded) : onFileClick(node.path)}>
        {node.isDirectory && <span className="text-[#8b949e]">{isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</span>}
        {icon ? <span className="text-xs">{icon}</span> : node.isDirectory ? (isExpanded ? <FolderOpen size={14} className="text-[#54aeff]" /> : <Folder size={14} className="text-[#54aeff]" />) : <File size={14} className="text-[#8b949e]" />}
        <span className={`text-xs truncate ${node.isDirectory ? 'font-medium' : ''}`}>{node.name}</span>
      </div>
      {node.isDirectory && isExpanded && node.children && (
        <div>{node.children.map((child) => <FileTree key={child.path} node={child} onFileClick={onFileClick} level={level + 1} />)}</div>
      )}
    </div>
  );
}
