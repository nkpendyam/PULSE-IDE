'use client';

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Clock, FileCode, X, Trash2, Pin, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';

// Types
export interface RecentFile {
  id: string;
  path: string;
  name: string;
  language?: string;
  lastOpened: Date;
  isPinned: boolean;
  openCount: number;
}

export interface RecentFilesProps {
  recentFiles?: RecentFile[];
  onFileSelect?: (file: RecentFile) => void;
  onFileRemove?: (fileId: string) => void;
  onClearAll?: () => void;
  onPinToggle?: (fileId: string) => void;
  maxRecent?: number;
  className?: string;
  variant?: 'dropdown' | 'panel';
}

// File icon mapping
const FILE_ICONS: Record<string, { color: string }> = {
  ts: { color: 'text-blue-400' },
  tsx: { color: 'text-blue-400' },
  js: { color: 'text-yellow-400' },
  jsx: { color: 'text-yellow-400' },
  json: { color: 'text-yellow-500' },
  md: { color: 'text-gray-400' },
  css: { color: 'text-blue-400' },
  scss: { color: 'text-pink-400' },
  html: { color: 'text-orange-500' },
  py: { color: 'text-green-400' },
  go: { color: 'text-cyan-400' },
};

const getFileColor = (filename: string): string => {
  const ext = filename.toLowerCase().split('.').pop() || '';
  return FILE_ICONS[ext]?.color || 'text-gray-400';
};

// Time ago formatter
const formatTimeAgo = (date: Date): string => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
};

// Recent File Item
interface RecentFileItemProps {
  file: RecentFile;
  onSelect: () => void;
  onRemove: () => void;
  onPinToggle: () => void;
  isSelected?: boolean;
}

const RecentFileItem: React.FC<RecentFileItemProps> = ({
  file,
  onSelect,
  onRemove,
  onPinToggle,
  isSelected,
}) => {
  const fileColor = getFileColor(file.name);

  return (
    <div
      className={cn(
        'group flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer',
        'hover:bg-accent/50 transition-colors',
        isSelected && 'bg-accent'
      )}
      onClick={onSelect}
    >
      {/* Pin or Icon */}
      {file.isPinned ? (
        <Pin className={cn('w-4 h-4 shrink-0 text-primary')} />
      ) : (
        <FileCode className={cn('w-4 h-4 shrink-0', fileColor)} />
      )}

      {/* File Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm truncate">{file.name}</span>
          {file.isPinned && (
            <Badge variant="secondary" className="text-[9px] px-1 h-4">
              Pinned
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate">{file.path}</p>
      </div>

      {/* Time & Actions */}
      <div className="flex items-center gap-1 shrink-0">
        <span className="text-[10px] text-muted-foreground">
          {formatTimeAgo(file.lastOpened)}
        </span>
        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="w-5 h-5"
            onClick={(e) => {
              e.stopPropagation();
              onPinToggle();
            }}
            title={file.isPinned ? 'Unpin' : 'Pin'}
          >
            <Pin className="w-3 h-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="w-5 h-5 hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            title="Remove from recent"
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
      </div>
    </div>
  );
};

// Main Component
export const RecentFiles: React.FC<RecentFilesProps> = ({
  recentFiles: controlledFiles,
  onFileSelect,
  onFileRemove,
  onClearAll,
  onPinToggle,
  maxRecent = 20,
  className = '',
  variant = 'dropdown',
}) => {
  // Load from localStorage on mount using lazy initialization
  const [internalFiles, setInternalFiles] = useState<RecentFile[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const stored = localStorage.getItem('kyro-recent-files');
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed.map((f: RecentFile) => ({
          ...f,
          lastOpened: new Date(f.lastOpened),
        }));
      }
    } catch (e) {
      console.error('Failed to load recent files:', e);
    }
    return [];
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  // Use controlled or internal state
  const files = useMemo(() => controlledFiles ?? internalFiles, [controlledFiles, internalFiles]);

  // Sort files: pinned first, then by last opened
  const sortedFiles = useMemo(() => {
    return [...files]
      .sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return b.lastOpened.getTime() - a.lastOpened.getTime();
      })
      .slice(0, maxRecent);
  }, [files, maxRecent]);

  // Filter by search
  const filteredFiles = useMemo(() => {
    if (!searchQuery) return sortedFiles;
    const query = searchQuery.toLowerCase();
    return sortedFiles.filter(
      (f) =>
        f.name.toLowerCase().includes(query) ||
        f.path.toLowerCase().includes(query)
    );
  }, [sortedFiles, searchQuery]);

  // Add file to recent
  const addRecentFile = useCallback((file: Omit<RecentFile, 'id' | 'lastOpened' | 'openCount'>) => {
    const existing = files.find((f) => f.path === file.path);
    if (existing) {
      // Update existing
      setInternalFiles((prev) =>
        prev.map((f) =>
          f.path === file.path
            ? { ...f, lastOpened: new Date(), openCount: f.openCount + 1 }
            : f
        )
      );
    } else {
      // Add new
      const newFile: RecentFile = {
        ...file,
        id: `recent-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        lastOpened: new Date(),
        openCount: 1,
      };
      setInternalFiles((prev) => [newFile, ...prev].slice(0, maxRecent));
    }
  }, [files, maxRecent]);

  // Handle file selection
  const handleSelect = useCallback((file: RecentFile) => {
    if (onFileSelect) {
      onFileSelect(file);
    }
    // Update last opened
    setInternalFiles((prev) =>
      prev.map((f) =>
        f.id === file.id
          ? { ...f, lastOpened: new Date(), openCount: f.openCount + 1 }
          : f
      )
    );
    setIsOpen(false);
  }, [onFileSelect]);

  // Handle remove
  const handleRemove = useCallback((fileId: string) => {
    if (onFileRemove) {
      onFileRemove(fileId);
    } else {
      setInternalFiles((prev) => prev.filter((f) => f.id !== fileId));
    }
  }, [onFileRemove]);

  // Handle pin toggle
  const handlePinToggle = useCallback((fileId: string) => {
    if (onPinToggle) {
      onPinToggle(fileId);
    } else {
      setInternalFiles((prev) =>
        prev.map((f) =>
          f.id === fileId ? { ...f, isPinned: !f.isPinned } : f
        )
      );
    }
  }, [onPinToggle]);

  // Handle clear all
  const handleClearAll = useCallback(() => {
    if (onClearAll) {
      onClearAll();
    } else {
      setInternalFiles((prev) => prev.filter((f) => f.isPinned));
    }
  }, [onClearAll]);



  // Save to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem('kyro-recent-files', JSON.stringify(files));
    } catch (e) {
      console.error('Failed to save recent files:', e);
    }
  }, [files]);

  // Dropdown variant
  if (variant === 'dropdown') {
    return (
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn('gap-1.5 h-7 text-xs', className)}
          >
            <Clock className="w-3.5 h-3.5" />
            Recent
            {files.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-[9px] px-1 h-4">
                {files.length}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className={cn('w-80 p-0', className)}
        >
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search recent files..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-7 h-8 text-xs"
              />
            </div>
          </div>
          <ScrollArea className="h-[300px]">
            <div className="p-1">
              {filteredFiles.length === 0 ? (
                <div className="text-center py-6 text-xs text-muted-foreground">
                  {searchQuery ? 'No matching files' : 'No recent files'}
                </div>
              ) : (
                filteredFiles.map((file) => (
                  <RecentFileItem
                    key={file.id}
                    file={file}
                    onSelect={() => handleSelect(file)}
                    onRemove={() => handleRemove(file.id)}
                    onPinToggle={() => handlePinToggle(file.id)}
                  />
                ))
              )}
            </div>
          </ScrollArea>
          {files.length > 0 && (
            <div className="p-2 border-t flex justify-between">
              <span className="text-[10px] text-muted-foreground">
                {filteredFiles.length} of {files.length} files
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs text-muted-foreground hover:text-destructive"
                onClick={handleClearAll}
              >
                <Trash2 className="w-3 h-3 mr-1" />
                Clear All
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    );
  }

  // Panel variant
  return (
    <div className={cn('h-full flex flex-col bg-background', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b shrink-0">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Recent Files
          </span>
          <Badge variant="secondary" className="text-[10px]">
            {files.length}
          </Badge>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-xs text-muted-foreground hover:text-destructive"
          onClick={handleClearAll}
        >
          <Trash2 className="w-3 h-3" />
        </Button>
      </div>

      {/* Search */}
      <div className="p-2 border-b shrink-0">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search recent files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>
      </div>

      {/* File List */}
      <ScrollArea className="flex-1">
        <div className="p-1">
          {filteredFiles.length === 0 ? (
            <div className="text-center py-8 text-xs text-muted-foreground">
              {searchQuery ? 'No matching files found' : 'No recent files'}
            </div>
          ) : (
            filteredFiles.map((file) => (
              <RecentFileItem
                key={file.id}
                file={file}
                onSelect={() => handleSelect(file)}
                onRemove={() => handleRemove(file.id)}
                onPinToggle={() => handlePinToggle(file.id)}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default RecentFiles;
