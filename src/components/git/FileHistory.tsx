'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { 
  GitCommit, 
  User, 
  Calendar, 
  Clock, 
  FileText,
  RotateCcw,
  GitCompare,
  Eye,
  ChevronRight,
  ChevronDown,
  Check,
  Copy,
  ArrowRight,
  ExternalLink,
  MessageSquare,
  Plus,
  Minus
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Types
export interface FileCommit {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  authorEmail: string;
  date: Date;
  timeAgo: string;
  additions: number;
  deletions: number;
  isMerge: boolean;
  parentHashes: string[];
}

export interface FileVersion {
  commitHash: string;
  content: string;
  path: string;
  size: number;
  lines: number;
}

export interface FileHistoryData {
  path: string;
  commits: FileCommit[];
  currentContent: string;
  branch: string;
}

export interface FileHistoryProps {
  history?: FileHistoryData;
  onViewVersion?: (commitHash: string) => void;
  onCompare?: (fromHash: string, toHash: string) => void;
  onRestore?: (commitHash: string) => void;
  className?: string;
}

// Mock data for demonstration
const mockFileHistory: FileHistoryData = {
  path: 'src/components/Button.tsx',
  branch: 'main',
  currentContent: `import React from 'react';
import { cn } from '@/lib/utils';

interface ButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
}

export function Button({ children, variant = 'primary', size = 'md', disabled = false, onClick, className }: ButtonProps) {
  return <button>{children}</button>;
}`,
  commits: [
    {
      hash: 'i9j0k1l2m3n4o5p6',
      shortHash: 'i9j0k1l',
      message: 'Add ghost and danger button variants',
      author: 'Charlie Brown',
      authorEmail: 'charlie@example.com',
      date: new Date('2024-01-25T14:30:00'),
      timeAgo: '3 days ago',
      additions: 12,
      deletions: 4,
      isMerge: false,
      parentHashes: ['h8g7f6e5d4c3b2a1']
    },
    {
      hash: 'e5f6g7h8i9j0k1l2',
      shortHash: 'e5f6g7h',
      message: 'Add className prop for customization and size prop support',
      author: 'Bob Smith',
      authorEmail: 'bob@example.com',
      date: new Date('2024-01-20T10:15:00'),
      timeAgo: '1 week ago',
      additions: 8,
      deletions: 2,
      isMerge: false,
      parentHashes: ['d4c3b2a1f0e9d8c7']
    },
    {
      hash: 'a1b2c3d4e5f6g7h8',
      shortHash: 'a1b2c3d',
      message: 'Initial Button component setup with basic props',
      author: 'Alice Johnson',
      authorEmail: 'alice@example.com',
      date: new Date('2024-01-15T09:00:00'),
      timeAgo: '2 weeks ago',
      additions: 25,
      deletions: 0,
      isMerge: false,
      parentHashes: ['0000000000000000']
    }
  ]
};

// Author color mapping
const getAuthorColor = (author: string): string => {
  const colors = [
    'text-blue-400',
    'text-green-400',
    'text-purple-400',
    'text-orange-400',
    'text-pink-400',
    'text-cyan-400',
    'text-yellow-400',
  ];
  
  let hash = 0;
  for (let i = 0; i < author.length; i++) {
    hash = author.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

// Commit item component
const CommitItem: React.FC<{
  commit: FileCommit;
  index: number;
  isSelected: boolean;
  isCompareSelected: boolean;
  isCompareBase: boolean;
  onSelect: () => void;
  onCompareSelect: () => void;
  onView: () => void;
  onRestore: () => void;
  onCopyHash: () => void;
  copied: boolean;
}> = ({ 
  commit, 
  index, 
  isSelected, 
  isCompareSelected,
  isCompareBase,
  onSelect, 
  onCompareSelect,
  onView, 
  onRestore, 
  onCopyHash,
  copied 
}) => {
  const [expanded, setExpanded] = useState(false);
  const authorColor = getAuthorColor(commit.author);

  return (
    <div className={cn(
      'border-b border-[#3c3c3c] last:border-b-0',
      isSelected && 'bg-blue-500/10',
      isCompareSelected && 'bg-purple-500/10',
      isCompareBase && 'bg-green-500/10'
    )}>
      {/* Main commit row */}
      <div 
        className="flex items-start gap-3 px-3 py-2 cursor-pointer hover:bg-[#2a2a2a]"
        onClick={onSelect}
      >
        {/* Timeline indicator */}
        <div className="flex flex-col items-center">
          <div className={cn(
            'w-3 h-3 rounded-full border-2',
            isSelected 
              ? 'bg-blue-500 border-blue-400' 
              : 'bg-[#2a2a2a] border-gray-500'
          )} />
          {index < 10 - 1 && (
            <div className="w-0.5 h-full bg-[#3c3c3c] mt-1" />
          )}
        </div>

        {/* Commit content */}
        <div className="flex-1 min-w-0">
          {/* Commit header */}
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-xs text-gray-400">
              {commit.shortHash}
            </span>
            <Badge 
              variant="outline" 
              className="text-[10px] h-4 px-1"
            >
              {index === 0 ? 'HEAD' : `${index} ago`}
            </Badge>
            {commit.isMerge && (
              <Badge variant="secondary" className="text-[10px] h-4 px-1">
                Merge
              </Badge>
            )}
          </div>

          {/* Commit message */}
          <p className="text-sm text-gray-200 truncate mb-1">
            {commit.message}
          </p>

          {/* Author and date */}
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span className={cn('flex items-center gap-1', authorColor)}>
              <User className="h-3 w-3" />
              {commit.author.split(' ')[0]}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {commit.timeAgo}
            </span>
            <span className="flex items-center gap-1">
              <Plus className="h-3 w-3 text-green-400" />
              {commit.additions}
            </span>
            <span className="flex items-center gap-1">
              <Minus className="h-3 w-3 text-red-400" />
              {commit.deletions}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={(e) => {
              e.stopPropagation();
              onCopyHash();
            }}
          >
            {copied ? (
              <Check className="h-3 w-3 text-green-400" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
          >
            {expanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </Button>
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="px-3 pb-3 pl-10">
          {/* Full commit info */}
          <div className="p-3 bg-[#181818] rounded-md space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Full hash:</span>
              <span className="font-mono text-gray-300">{commit.hash}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Author:</span>
              <span className={authorColor}>{commit.author}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Date:</span>
              <span className="text-gray-300">
                {commit.date.toLocaleDateString()} {commit.date.toLocaleTimeString()}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Parents:</span>
              <div className="flex items-center gap-1">
                {commit.parentHashes.map((h, i) => (
                  <span key={i} className="font-mono text-gray-300">
                    {h.substring(0, 7)}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 mt-3">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs flex-1"
              onClick={(e) => {
                e.stopPropagation();
                onView();
              }}
            >
              <Eye className="h-3 w-3 mr-1" />
              View File
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs flex-1"
              onClick={(e) => {
                e.stopPropagation();
                onCompareSelect();
              }}
            >
              <GitCompare className="h-3 w-3 mr-1" />
              Compare
            </Button>
            {index > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs flex-1"
                onClick={(e) => {
                  e.stopPropagation();
                  onRestore();
                }}
              >
                <RotateCcw className="h-3 w-3 mr-1" />
                Restore
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Compare panel component
const ComparePanel: React.FC<{
  baseCommit: FileCommit | null;
  compareCommit: FileCommit | null;
  onClose: () => void;
  onCompare: () => void;
}> = ({ baseCommit, compareCommit, onClose, onCompare }) => {
  if (!baseCommit && !compareCommit) return null;

  return (
    <div className="p-3 border-b border-[#3c3c3c] bg-[#181818]">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-gray-400">Compare Versions</span>
        <Button
          variant="ghost"
          size="sm"
          className="h-5 text-xs"
          onClick={onClose}
        >
          Clear
        </Button>
      </div>
      
      <div className="flex items-center gap-2">
        {baseCommit ? (
          <Badge variant="outline" className="text-xs border-green-500 text-green-400">
            Base: {baseCommit.shortHash}
          </Badge>
        ) : (
          <span className="text-xs text-gray-500">Select base commit</span>
        )}
        
        <ArrowRight className="h-3 w-3 text-gray-500" />
        
        {compareCommit ? (
          <Badge variant="outline" className="text-xs border-purple-500 text-purple-400">
            Compare: {compareCommit.shortHash}
          </Badge>
        ) : (
          <span className="text-xs text-gray-500">Select commit to compare</span>
        )}
      </div>

      {baseCommit && compareCommit && (
        <Button
          variant="default"
          size="sm"
          className="w-full h-7 text-xs mt-2"
          onClick={onCompare}
        >
          <GitCompare className="h-3 w-3 mr-1" />
          Show Diff
        </Button>
      )}
    </div>
  );
};

// Main FileHistory component
export const FileHistory: React.FC<FileHistoryProps> = ({
  history = mockFileHistory,
  onViewVersion,
  onCompare,
  onRestore,
  className = ''
}) => {
  const [selectedCommit, setSelectedCommit] = useState<string | null>(null);
  const [compareBase, setCompareBase] = useState<string | null>(null);
  const [compareTarget, setCompareTarget] = useState<string | null>(null);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  // Get commit by hash
  const getCommit = useCallback((hash: string) => {
    return history.commits.find(c => c.hash === hash || c.shortHash === hash);
  }, [history.commits]);

  // Handle copy hash
  const handleCopyHash = useCallback((hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 2000);
  }, []);

  // Handle commit select
  const handleSelect = useCallback((hash: string) => {
    setSelectedCommit(hash === selectedCommit ? null : hash);
  }, [selectedCommit]);

  // Handle compare select
  const handleCompareSelect = useCallback((hash: string) => {
    if (!compareBase) {
      setCompareBase(hash);
    } else if (!compareTarget && hash !== compareBase) {
      setCompareTarget(hash);
    } else {
      setCompareBase(hash);
      setCompareTarget(null);
    }
  }, [compareBase, compareTarget]);

  // Handle clear compare
  const handleClearCompare = useCallback(() => {
    setCompareBase(null);
    setCompareTarget(null);
  }, []);

  // Handle view version
  const handleViewVersion = useCallback((hash: string) => {
    if (onViewVersion) {
      onViewVersion(hash);
    }
  }, [onViewVersion]);

  // Handle restore
  const handleRestore = useCallback((hash: string) => {
    if (onRestore) {
      onRestore(hash);
    }
  }, [onRestore]);

  // Handle compare commits
  const handleCompareCommits = useCallback(() => {
    if (compareBase && compareTarget && onCompare) {
      onCompare(compareBase, compareTarget);
    }
  }, [compareBase, compareTarget, onCompare]);

  return (
    <div className={cn('flex flex-col h-full bg-[#1e1e1e]', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#3c3c3c]">
        <div className="flex items-center gap-3">
          <FileText className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-medium">File History</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {history.commits.length} commits
          </Badge>
          <Badge variant="secondary" className="text-xs">
            {history.branch}
          </Badge>
        </div>
      </div>

      {/* File path */}
      <div className="px-4 py-2 border-b border-[#3c3c3c] bg-[#252525]">
        <span className="text-xs text-gray-400 font-mono truncate block">
          {history.path}
        </span>
      </div>

      {/* Compare panel */}
      <ComparePanel
        baseCommit={compareBase ? getCommit(compareBase) || null : null}
        compareCommit={compareTarget ? getCommit(compareTarget) || null : null}
        onClose={handleClearCompare}
        onCompare={handleCompareCommits}
      />

      {/* Commits list */}
      <ScrollArea className="flex-1">
        {history.commits.length > 0 ? (
          history.commits.map((commit, index) => (
            <CommitItem
              key={commit.hash}
              commit={commit}
              index={index}
              isSelected={selectedCommit === commit.hash}
              isCompareSelected={compareTarget === commit.hash}
              isCompareBase={compareBase === commit.hash}
              onSelect={() => handleSelect(commit.hash)}
              onCompareSelect={() => handleCompareSelect(commit.hash)}
              onView={() => handleViewVersion(commit.hash)}
              onRestore={() => handleRestore(commit.hash)}
              onCopyHash={() => handleCopyHash(commit.hash)}
              copied={copiedHash === commit.hash}
            />
          ))
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 text-sm p-4">
            <GitCommit className="h-8 w-8 mb-2" />
            <span>No commit history</span>
          </div>
        )}
      </ScrollArea>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-[#3c3c3c] text-xs text-gray-500">
        <span>Click commit to expand</span>
        <span>Ctrl+click to compare</span>
      </div>
    </div>
  );
};

export default FileHistory;
