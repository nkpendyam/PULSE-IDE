'use client';

import React, { useState, useRef, useEffect } from 'react';
import { 
  ChevronRight, 
  ChevronDown, 
  File, 
  Folder, 
  FolderOpen,
  FilePlus,
  FolderPlus,
  Trash2,
  Edit3,
  Copy,
  Scissors,
  ClipboardPaste
} from 'lucide-react';
import { useKyroStore, FileNode } from '@/store/kyroStore';
import { invoke } from '@tauri-apps/api/core';

interface FileTreeProps { 
  node: FileNode; 
  onFileClick: (path: string) => void; 
  level: number;
  onRefresh?: () => void;
}

interface ContextMenuProps {
  x: number;
  y: number;
  node: FileNode;
  onClose: () => void;
  onRefresh?: () => void;
}

function ContextMenu({ x, y, node, onClose, onRefresh }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [isCreatingFile, setIsCreatingFile] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  useEffect(() => {
    if ((isCreatingFile || isCreatingFolder || isRenaming) && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isCreatingFile, isCreatingFolder, isRenaming]);

  const handleCreateFile = async () => {
    if (!newName.trim()) return;
    try {
      const basePath = node.is_directory ? node.path : node.path.substring(0, node.path.lastIndexOf('/'));
      const newPath = `${basePath}/${newName}`;
      await invoke('create_file', { path: newPath });
      onRefresh?.();
      onClose();
    } catch (error) {
      console.error('Failed to create file:', error);
      alert(`Failed to create file: ${error}`);
    }
  };

  const handleCreateFolder = async () => {
    if (!newName.trim()) return;
    try {
      const basePath = node.is_directory ? node.path : node.path.substring(0, node.path.lastIndexOf('/'));
      const newPath = `${basePath}/${newName}`;
      await invoke('create_directory', { path: newPath });
      onRefresh?.();
      onClose();
    } catch (error) {
      console.error('Failed to create folder:', error);
      alert(`Failed to create folder: ${error}`);
    }
  };

  const handleRename = async () => {
    if (!newName.trim()) return;
    try {
      const basePath = node.path.substring(0, node.path.lastIndexOf('/'));
      const newPath = `${basePath}/${newName}`;
      await invoke('rename_file', { oldPath: node.path, newPath });
      onRefresh?.();
      onClose();
    } catch (error) {
      console.error('Failed to rename:', error);
      alert(`Failed to rename: ${error}`);
    }
  };

  const handleDelete = async () => {
    const confirmMsg = node.is_directory 
      ? `Are you sure you want to delete the folder "${node.name}" and all its contents?`
      : `Are you sure you want to delete "${node.name}"?`;
    
    if (!confirm(confirmMsg)) return;

    try {
      if (node.is_directory) {
        await invoke('delete_directory', { path: node.path });
      } else {
        await invoke('delete_file', { path: node.path });
      }
      onRefresh?.();
      onClose();
    } catch (error) {
      console.error('Failed to delete:', error);
      alert(`Failed to delete: ${error}`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, action: () => void) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      action();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (isCreatingFile) {
    return (
      <div 
        ref={menuRef}
        className="fixed bg-[#161b22] border border-[#30363d] rounded shadow-lg p-2 z-50"
        style={{ left: x, top: y }}
      >
        <div className="text-xs text-[#8b949e] mb-1">New File</div>
        <input
          ref={inputRef}
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => handleKeyDown(e, handleCreateFile)}
          className="w-48 px-2 py-1 text-xs bg-[#0d1117] border border-[#30363d] rounded text-white focus:outline-none focus:border-[#1f6feb]"
          placeholder="filename.ext"
        />
      </div>
    );
  }

  if (isCreatingFolder) {
    return (
      <div 
        ref={menuRef}
        className="fixed bg-[#161b22] border border-[#30363d] rounded shadow-lg p-2 z-50"
        style={{ left: x, top: y }}
      >
        <div className="text-xs text-[#8b949e] mb-1">New Folder</div>
        <input
          ref={inputRef}
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => handleKeyDown(e, handleCreateFolder)}
          className="w-48 px-2 py-1 text-xs bg-[#0d1117] border border-[#30363d] rounded text-white focus:outline-none focus:border-[#1f6feb]"
          placeholder="folder-name"
        />
      </div>
    );
  }

  if (isRenaming) {
    return (
      <div 
        ref={menuRef}
        className="fixed bg-[#161b22] border border-[#30363d] rounded shadow-lg p-2 z-50"
        style={{ left: x, top: y }}
      >
        <div className="text-xs text-[#8b949e] mb-1">Rename</div>
        <input
          ref={inputRef}
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => handleKeyDown(e, handleRename)}
          className="w-48 px-2 py-1 text-xs bg-[#0d1117] border border-[#30363d] rounded text-white focus:outline-none focus:border-[#1f6feb]"
          placeholder="new-name"
        />
      </div>
    );
  }

  const menuItems: Array<{ divider?: boolean; icon?: React.ComponentType<{ size: number }>; label?: string; action?: () => void; danger?: boolean }> = [
    ...(node.is_directory ? [
      { icon: FilePlus, label: 'New File', action: () => { setNewName(''); setIsCreatingFile(true); } },
      { icon: FolderPlus, label: 'New Folder', action: () => { setNewName(''); setIsCreatingFolder(true); } },
      { divider: true },
    ] : []),
    { icon: Edit3, label: 'Rename', action: () => { setNewName(node.name); setIsRenaming(true); } },
    { icon: Trash2, label: 'Delete', action: handleDelete, danger: true },
  ];

  return (
    <div 
      ref={menuRef}
      className="fixed bg-[#161b22] border border-[#30363d] rounded shadow-lg py-1 z-50 min-w-[160px]"
      style={{ left: x, top: y }}
    >
      {menuItems.map((item, index) => 
        item.divider ? (
          <div key={index} className="h-px bg-[#30363d] my-1" />
        ) : (
          <button
            key={index}
            onClick={item.action}
            className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-[#21262d] ${
              item.danger ? 'text-[#f85149]' : 'text-[#c9d1d9]'
            }`}
          >
            {item.icon && <item.icon size={14} />}
            <span>{item.label}</span>
          </button>
        )
      )}
    </div>
  );
}

export function FileTree({ node, onFileClick, level, onRefresh }: FileTreeProps) {
  const [isExpanded, setIsExpanded] = useState(level < 2);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const { openFiles } = useKyroStore();
  const isOpen = openFiles.some(f => f.path === node.path);
  
  const getFileIcon = (name: string, isDir: boolean) => {
    if (isDir) return null;
    const ext = name.split('.').pop()?.toLowerCase();
    const iconMap: Record<string, string> = { 
      'rs': '🦀', 'py': '🐍', 'js': '📜', 'ts': '📘', 'tsx': '📘', 'jsx': '📜',
      'go': '🔵', 'java': '☕', 'html': '🌐', 'css': '🎨', 'scss': '🎨',
      'json': '📋', 'md': '📝', 'yaml': '📋', 'yml': '📋', 'toml': '📋',
      'xml': '📄', 'svg': '🎨', 'png': '🖼️', 'jpg': '🖼️', 'jpeg': '🖼️',
      'gif': '🖼️', 'ico': '🖼️', 'sh': '🔧', 'bash': '🔧', 'zsh': '🔧',
      'c': '©️', 'cpp': '©️', 'h': '©️', 'hpp': '©️', 'cs': '©️',
      'rb': '💎', 'php': '🐘', 'swift': '🦅', 'kt': '🅺', 'vue': '💚',
      'svelte': '🧡', 'sql': '🗄️', 'db': '🗄️', 'lock': '🔒'
    };
    return iconMap[ext || ''] || null;
  };
  
  // Hide hidden files (starting with .)
  if (node.name.startsWith('.')) return null;
  
  const icon = getFileIcon(node.name, node.is_directory);
  const paddingLeft = level * 12 + 8;

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const handleClick = () => {
    if (node.is_directory) {
      setIsExpanded(!isExpanded);
    } else {
      onFileClick(node.path);
    }
  };
  
  return (
    <>
      <div className="select-none">
        <div 
          className={`flex items-center gap-1 py-1 px-1 cursor-pointer hover:bg-[#21262d] rounded ${isOpen ? 'bg-[#1f6feb33]' : ''}`} 
          style={{ paddingLeft }}
          onClick={handleClick}
          onContextMenu={handleContextMenu}
        >
          {node.is_directory && (
            <span className="text-[#8b949e]">
              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </span>
          )}
          {icon ? (
            <span className="text-xs">{icon}</span>
          ) : node.is_directory ? (
            isExpanded ? <FolderOpen size={14} className="text-[#54aeff]" /> : <Folder size={14} className="text-[#54aeff]" />
          ) : (
            <File size={14} className="text-[#8b949e]" />
          )}
          <span className={`text-xs truncate ${node.is_directory ? 'font-medium' : ''}`}>
            {node.name}
          </span>
        </div>
        {node.is_directory && isExpanded && node.children && (
          <div>
            {node.children.map((child) => (
              <FileTree 
                key={child.path} 
                node={child} 
                onFileClick={onFileClick} 
                level={level + 1}
                onRefresh={onRefresh}
              />
            ))}
          </div>
        )}
      </div>
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          node={node}
          onClose={() => setContextMenu(null)}
          onRefresh={onRefresh}
        />
      )}
    </>
  );
}
