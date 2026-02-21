'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { ChevronRight, ChevronDown, File, Folder, FolderOpen, Search, RefreshCw, Plus, Trash2, Edit2, Copy, Scissors, Clipboard, GitBranch, AlertCircle } from 'lucide-react';

// Types
interface FileNode {
  id: string;
  name: string;
  type: 'file' | 'folder';
  path: string;
  children?: FileNode[];
  isOpen?: boolean;
  isDirty?: boolean;
  gitStatus?: 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked' | 'ignored' | null;
  icon?: string;
}

interface FileExplorerProps {
  files?: FileNode[];
  onFileSelect?: (file: FileNode) => void;
  onFileCreate?: (parentPath: string, name: string, type: 'file' | 'folder') => void;
  onFileDelete?: (path: string) => void;
  onFileRename?: (path: string, newName: string) => void;
  onFileMove?: (sourcePath: string, targetPath: string) => void;
  onFileCopy?: (sourcePath: string, targetPath: string) => void;
  onRefresh?: () => void;
  workspaceName?: string;
  className?: string;
}

// File icon mapping
const FILE_ICONS: Record<string, { icon: string; color: string }> = {
  ts: { icon: 'TS', color: 'text-blue-500' },
  tsx: { icon: 'TSX', color: 'text-blue-400' },
  js: { icon: 'JS', color: 'text-yellow-400' },
  jsx: { icon: 'JSX', color: 'text-yellow-400' },
  json: { icon: '{}', color: 'text-yellow-600' },
  md: { icon: 'MD', color: 'text-gray-400' },
  css: { icon: 'CSS', color: 'text-blue-400' },
  scss: { icon: 'SASS', color: 'text-pink-400' },
  html: { icon: 'HTML', color: 'text-orange-500' },
  py: { icon: 'PY', color: 'text-green-500' },
  rs: { icon: 'RS', color: 'text-orange-600' },
  go: { icon: 'GO', color: 'text-cyan-400' },
  java: { icon: 'J', color: 'text-red-500' },
  rb: { icon: 'RB', color: 'text-red-600' },
  php: { icon: 'PHP', color: 'text-purple-400' },
  c: { icon: 'C', color: 'text-blue-600' },
  cpp: { icon: 'C++', color: 'text-blue-600' },
  h: { icon: 'H', color: 'text-purple-500' },
  sh: { icon: 'SH', color: 'text-green-400' },
  yaml: { icon: 'YML', color: 'text-red-400' },
  yml: { icon: 'YML', color: 'text-red-400' },
  xml: { icon: 'XML', color: 'text-orange-400' },
  sql: { icon: 'SQL', color: 'text-blue-300' },
  dockerfile: { icon: '🐳', color: 'text-blue-400' },
  gitignore: { icon: 'GIT', color: 'text-orange-500' },
  env: { icon: 'ENV', color: 'text-yellow-500' },
  lock: { icon: '🔒', color: 'text-gray-500' },
  svg: { icon: 'SVG', color: 'text-yellow-500' },
  png: { icon: 'IMG', color: 'text-green-400' },
  jpg: { icon: 'IMG', color: 'text-green-400' },
  gif: { icon: 'GIF', color: 'text-purple-400' },
};

// Get file icon
const getFileIcon = (filename: string): { icon: string; color: string } => {
  const ext = filename.toLowerCase().split('.').pop() || '';
  const basename = filename.toLowerCase().split('/').pop() || '';
  
  // Special files
  if (basename === 'dockerfile') return FILE_ICONS.dockerfile;
  if (basename === '.gitignore') return FILE_ICONS.gitignore;
  if (basename.startsWith('.env')) return FILE_ICONS.env;
  
  return FILE_ICONS[ext] || { icon: '📄', color: 'text-gray-400' };
};

// Git status colors
const GIT_STATUS_COLORS: Record<string, string> = {
  modified: 'text-yellow-500',
  added: 'text-green-500',
  deleted: 'text-red-500',
  renamed: 'text-blue-500',
  untracked: 'text-gray-500',
  ignored: 'text-gray-600',
};

// Context Menu Component
interface ContextMenuProps {
  x: number;
  y: number;
  node: FileNode | null;
  onClose: () => void;
  onNewFile: () => void;
  onNewFolder: () => void;
  onRename: () => void;
  onDelete: () => void;
  onCopy: () => void;
  onCut: () => void;
  onPaste: () => void;
  canPaste: boolean;
}

const ContextMenu: React.FC<ContextMenuProps> = ({
  x, y, node, onClose, onNewFile, onNewFolder, onRename, onDelete, onCopy, onCut, onPaste, canPaste
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-[#1e1e1e] border border-[#3c3c3c] rounded-md shadow-lg py-1 min-w-[180px]"
      style={{ left: x, top: y }}
    >
      {node ? (
        <>
          <MenuItem icon={<Plus size={14} />} label="New File" onClick={onNewFile} />
          <MenuItem icon={<Plus size={14} />} label="New Folder" onClick={onNewFolder} />
          <MenuDivider />
          <MenuItem icon={<Edit2 size={14} />} label="Rename" onClick={onRename} shortcut="F2" />
          <MenuItem icon={<Trash2 size={14} />} label="Delete" onClick={onDelete} shortcut="Del" className="text-red-400 hover:text-red-300" />
          <MenuDivider />
          <MenuItem icon={<Copy size={14} />} label="Copy" onClick={onCopy} shortcut="Ctrl+C" />
          <MenuItem icon={<Scissors size={14} />} label="Cut" onClick={onCut} shortcut="Ctrl+X" />
          <MenuItem icon={<Clipboard size={14} />} label="Paste" onClick={onPaste} shortcut="Ctrl+V" disabled={!canPaste} />
        </>
      ) : (
        <>
          <MenuItem icon={<Plus size={14} />} label="New File" onClick={onNewFile} />
          <MenuItem icon={<Plus size={14} />} label="New Folder" onClick={onNewFolder} />
        </>
      )}
    </div>
  );
};

const MenuItem: React.FC<{
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  shortcut?: string;
  disabled?: boolean;
  className?: string;
}> = ({ icon, label, onClick, shortcut, disabled, className = '' }) => (
  <button
    className={`w-full px-3 py-1.5 flex items-center gap-2 text-left text-sm hover:bg-[#094771] ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
    onClick={onClick}
    disabled={disabled}
  >
    <span className="w-4">{icon}</span>
    <span className="flex-1">{label}</span>
    {shortcut && <span className="text-xs text-gray-500">{shortcut}</span>}
  </button>
);

const MenuDivider: React.FC = () => <div className="h-px bg-[#3c3c3c] my-1" />;

// File Tree Item Component
interface FileTreeItemProps {
  node: FileNode;
  depth: number;
  selectedPath: string | null;
  onSelect: (node: FileNode) => void;
  onToggle: (node: FileNode) => void;
  onContextMenu: (e: React.MouseEvent, node: FileNode | null) => void;
  onRename: (node: FileNode) => void;
}

const FileTreeItem: React.FC<FileTreeItemProps> = ({
  node, depth, selectedPath, onSelect, onToggle, onContextMenu, onRename
}) => {
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(node.name);
  const inputRef = useRef<HTMLInputElement>(null);

  const isSelected = selectedPath === node.path;
  const { icon, color } = node.type === 'file' ? getFileIcon(node.name) : { icon: '', color: '' };

  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isRenaming]);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (node.type === 'folder') {
      onToggle(node);
    }
    onSelect(node);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (node.type === 'file') {
      onSelect(node);
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onContextMenu(e, node);
  };

  const handleRenameSubmit = () => {
    if (renameValue.trim() && renameValue !== node.name) {
      onRename({ ...node, name: renameValue.trim() });
    }
    setIsRenaming(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleRenameSubmit();
    } else if (e.key === 'Escape') {
      setRenameValue(node.name);
      setIsRenaming(false);
    }
  };

  return (
    <div>
      <div
        className={`flex items-center gap-1 px-2 py-0.5 cursor-pointer select-none group ${
          isSelected ? 'bg-[#094771]' : 'hover:bg-[#2a2d2e]'
        }`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
      >
        {/* Expand/Collapse Arrow for Folders */}
        {node.type === 'folder' && (
          <span className="w-4 h-4 flex items-center justify-center">
            {node.isOpen ? (
              <ChevronDown size={14} className="text-gray-400" />
            ) : (
              <ChevronRight size={14} className="text-gray-400" />
            )}
          </span>
        )}
        
        {/* Folder/File Icon */}
        {node.type === 'folder' ? (
          node.isOpen ? (
            <FolderOpen size={16} className="text-yellow-500" />
          ) : (
            <Folder size={16} className="text-yellow-500" />
          )
        ) : (
          <span className={`w-4 text-xs font-bold flex items-center justify-center ${color}`}>
            {icon.length <= 3 ? icon : <File size={14} className="text-gray-400" />}
          </span>
        )}

        {/* Name */}
        {isRenaming ? (
          <input
            ref={inputRef}
            type="text"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={handleRenameSubmit}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-[#3c3c3c] border border-[#007acc] px-1 text-sm outline-none rounded"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="flex-1 text-sm truncate text-gray-200">
            {node.name}
          </span>
        )}

        {/* Dirty Indicator */}
        {node.isDirty && (
          <span className="w-2 h-2 rounded-full bg-white mr-1" title="Unsaved changes" />
        )}

        {/* Git Status */}
        {node.gitStatus && (
          <span className={`text-xs mr-1 ${GIT_STATUS_COLORS[node.gitStatus]}`}>
            {node.gitStatus === 'modified' && 'M'}
            {node.gitStatus === 'added' && 'A'}
            {node.gitStatus === 'deleted' && 'D'}
            {node.gitStatus === 'renamed' && 'R'}
            {node.gitStatus === 'untracked' && 'U'}
          </span>
        )}
      </div>

      {/* Children */}
      {node.type === 'folder' && node.isOpen && node.children && (
        <div>
          {node.children.map((child) => (
            <FileTreeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedPath={selectedPath}
              onSelect={onSelect}
              onToggle={onToggle}
              onContextMenu={onContextMenu}
              onRename={onRename}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// Main File Explorer Component
export const FileExplorer: React.FC<FileExplorerProps> = ({
  files = [],
  onFileSelect,
  onFileCreate,
  onFileDelete,
  onFileRename,
  onFileMove,
  onFileCopy,
  onRefresh,
  workspaceName = 'PULSE-IDE',
  className = '',
}) => {
  const [treeData, setTreeData] = useState<FileNode[]>(files);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; node: FileNode | null } | null>(null);
  const [clipboard, setClipboard] = useState<{ path: string; operation: 'copy' | 'cut' } | null>(null);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());

  // Update tree data when files prop changes
  useEffect(() => {
    setTreeData(files);
  }, [files]);

  // Toggle folder open/closed
  const handleToggle = useCallback((node: FileNode) => {
    const toggleNode = (nodes: FileNode[]): FileNode[] => {
      return nodes.map((n) => {
        if (n.id === node.id) {
          const newIsOpen = !n.isOpen;
          if (newIsOpen) {
            setExpandedPaths((prev) => new Set(prev).add(n.path));
          } else {
            setExpandedPaths((prev) => {
              const next = new Set(prev);
              next.delete(n.path);
              return next;
            });
          }
          return { ...n, isOpen: newIsOpen };
        }
        if (n.children) {
          return { ...n, children: toggleNode(n.children) };
        }
        return n;
      });
    };
    setTreeData(toggleNode(treeData));
  }, [treeData]);

  // Handle file selection
  const handleSelect = useCallback((node: FileNode) => {
    setSelectedPath(node.path);
    if (node.type === 'file' && onFileSelect) {
      onFileSelect(node);
    }
  }, [onFileSelect]);

  // Handle context menu
  const handleContextMenu = useCallback((e: React.MouseEvent, node: FileNode | null) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, node });
  }, []);

  // Close context menu
  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  // Create new file
  const handleNewFile = useCallback(() => {
    closeContextMenu();
    const parentPath = contextMenu?.node?.path || '';
    const name = prompt('Enter file name:');
    if (name && onFileCreate) {
      onFileCreate(parentPath, name, 'file');
    }
  }, [contextMenu, closeContextMenu, onFileCreate]);

  // Create new folder
  const handleNewFolder = useCallback(() => {
    closeContextMenu();
    const parentPath = contextMenu?.node?.path || '';
    const name = prompt('Enter folder name:');
    if (name && onFileCreate) {
      onFileCreate(parentPath, name, 'folder');
    }
  }, [contextMenu, closeContextMenu, onFileCreate]);

  // Rename file/folder
  const handleRename = useCallback((node: FileNode) => {
    if (onFileRename) {
      onFileRename(node.path, node.name);
    }
  }, [onFileRename]);

  // Delete file/folder
  const handleDelete = useCallback(() => {
    closeContextMenu();
    if (contextMenu?.node && onFileDelete) {
      if (confirm(`Delete "${contextMenu.node.name}"?`)) {
        onFileDelete(contextMenu.node.path);
      }
    }
  }, [contextMenu, closeContextMenu, onFileDelete]);

  // Copy file/folder
  const handleCopy = useCallback(() => {
    if (contextMenu?.node) {
      setClipboard({ path: contextMenu.node.path, operation: 'copy' });
    }
    closeContextMenu();
  }, [contextMenu, closeContextMenu]);

  // Cut file/folder
  const handleCut = useCallback(() => {
    if (contextMenu?.node) {
      setClipboard({ path: contextMenu.node.path, operation: 'cut' });
    }
    closeContextMenu();
  }, [contextMenu, closeContextMenu]);

  // Paste file/folder
  const handlePaste = useCallback(() => {
    if (clipboard && contextMenu?.node) {
      if (clipboard.operation === 'copy' && onFileCopy) {
        onFileCopy(clipboard.path, contextMenu.node.path);
      } else if (clipboard.operation === 'cut' && onFileMove) {
        onFileMove(clipboard.path, contextMenu.node.path);
      }
    }
    closeContextMenu();
  }, [clipboard, contextMenu, closeContextMenu, onFileCopy, onFileMove]);

  // Collapse all folders
  const collapseAll = useCallback(() => {
    setExpandedPaths(new Set());
    const collapse = (nodes: FileNode[]): FileNode[] => {
      return nodes.map((n) => ({
        ...n,
        isOpen: false,
        children: n.children ? collapse(n.children) : undefined,
      }));
    };
    setTreeData(collapse(treeData));
  }, [treeData]);

  // Expand all folders
  const expandAll = useCallback(() => {
    const allPaths = new Set<string>();
    const collect = (nodes: FileNode[]) => {
      nodes.forEach((n) => {
        if (n.type === 'folder') {
          allPaths.add(n.path);
          if (n.children) collect(n.children);
        }
      });
    };
    collect(treeData);
    setExpandedPaths(allPaths);

    const expand = (nodes: FileNode[]): FileNode[] => {
      return nodes.map((n) => ({
        ...n,
        isOpen: n.type === 'folder',
        children: n.children ? expand(n.children) : undefined,
      }));
    };
    setTreeData(expand(treeData));
  }, [treeData]);

  // Filter files by search query
  const filteredTree = useMemo(() => {
    if (!searchQuery) return treeData;

    const filter = (nodes: FileNode[]): FileNode[] => {
      return nodes.reduce<FileNode[]>((acc, node) => {
        if (node.name.toLowerCase().includes(searchQuery.toLowerCase())) {
          acc.push({ ...node, isOpen: true });
        } else if (node.children) {
          const filteredChildren = filter(node.children);
          if (filteredChildren.length > 0) {
            acc.push({ ...node, children: filteredChildren, isOpen: true });
          }
        }
        return acc;
      }, []);
    };
    return filter(treeData);
  }, [treeData, searchQuery]);

  return (
    <div className={`flex flex-col h-full bg-[#181818] text-gray-200 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#3c3c3c]">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
          Explorer
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={onRefresh}
            className="p-1 hover:bg-[#3c3c3c] rounded"
            title="Refresh"
          >
            <RefreshCw size={14} className="text-gray-400" />
          </button>
          <button
            onClick={collapseAll}
            className="p-1 hover:bg-[#3c3c3c] rounded"
            title="Collapse All"
          >
            <ChevronRight size={14} className="text-gray-400" />
          </button>
          <button
            onClick={expandAll}
            className="p-1 hover:bg-[#3c3c3c] rounded"
            title="Expand All"
          >
            <ChevronDown size={14} className="text-gray-400" />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-2 py-1">
        <div className="flex items-center bg-[#3c3c3c] rounded px-2 py-1">
          <Search size={12} className="text-gray-500" />
          <input
            type="text"
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent border-none outline-none text-sm px-2 text-gray-200 placeholder-gray-500"
          />
        </div>
      </div>

      {/* Workspace Name */}
      <div className="px-2 py-1.5 mt-1">
        <div className="flex items-center gap-2 text-sm font-medium">
          <GitBranch size={14} className="text-gray-400" />
          <span>{workspaceName}</span>
        </div>
      </div>

      {/* File Tree */}
      <div
        className="flex-1 overflow-auto py-1"
        onContextMenu={(e) => handleContextMenu(e, null)}
      >
        {filteredTree.length > 0 ? (
          filteredTree.map((node) => (
            <FileTreeItem
              key={node.id}
              node={node}
              depth={0}
              selectedPath={selectedPath}
              onSelect={handleSelect}
              onToggle={handleToggle}
              onContextMenu={handleContextMenu}
              onRename={handleRename}
            />
          ))
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 text-sm">
            <AlertCircle size={24} className="mb-2" />
            <span>No files found</span>
          </div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          node={contextMenu.node}
          onClose={closeContextMenu}
          onNewFile={handleNewFile}
          onNewFolder={handleNewFolder}
          onRename={() => {
            closeContextMenu();
            if (contextMenu.node) {
              handleRename(contextMenu.node);
            }
          }}
          onDelete={handleDelete}
          onCopy={handleCopy}
          onCut={handleCut}
          onPaste={handlePaste}
          canPaste={clipboard !== null}
        />
      )}
    </div>
  );
};

export default FileExplorer;
