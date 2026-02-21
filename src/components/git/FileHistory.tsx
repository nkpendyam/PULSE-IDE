'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
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
  Minus,
  Columns,
  AlignLeft,
  X,
  Loader2,
  History,
  Code,
  FileCode
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

export interface CommitDiffData {
  commit: FileCommit;
  file: {
    oldPath: string;
    newPath: string;
    oldContent: string;
    newContent: string;
    status: 'added' | 'removed' | 'modified' | 'renamed';
    additions: number;
    deletions: number;
  };
}

export interface CompareDiffData {
  fromCommit: FileCommit;
  toCommit: FileCommit;
  file: {
    oldPath: string;
    newPath: string;
    oldContent: string;
    newContent: string;
    status: 'added' | 'removed' | 'modified' | 'renamed';
    additions: number;
    deletions: number;
  };
}

export interface FileHistoryProps {
  history?: FileHistoryData;
  onViewVersion?: (commitHash: string) => void;
  onCompare?: (fromHash: string, toHash: string) => void;
  onRestore?: (commitHash: string) => void;
  onFetchCommitDiff?: (commitHash: string, filePath: string) => Promise<CommitDiffData | null>;
  onFetchCompareDiff?: (fromHash: string, toHash: string, filePath: string) => Promise<CompareDiffData | null>;
  onFetchFileVersion?: (commitHash: string, filePath: string) => Promise<FileVersion | null>;
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
      hash: 'i9j0k1l2m3n4o5p6q7r8s9t0',
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
      hash: 'e5f6g7h8i9j0k1l2m3n4o5p6',
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
      hash: 'a1b2c3d4e5f6g7h8i9j0k1l2',
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

// Mock commit diffs
const mockCommitDiffs: Record<string, CommitDiffData> = {
  'i9j0k1l2m3n4o5p6q7r8s9t0': {
    commit: mockFileHistory.commits[0],
    file: {
      oldPath: 'src/components/Button.tsx',
      newPath: 'src/components/Button.tsx',
      oldContent: `interface ButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
}

export function Button({ children, variant = 'primary', size = 'md' }: ButtonProps) {
  return <button>{children}</button>;
}`,
      newContent: `interface ButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
}

export function Button({ 
  children, 
  variant = 'primary', 
  size = 'md',
  disabled = false,
  onClick,
  className 
}: ButtonProps) {
  const baseStyles = 'px-4 py-2 rounded font-medium transition-colors';
  
  const variantStyles = {
    primary: 'bg-blue-500 text-white hover:bg-blue-600',
    secondary: 'bg-gray-200 text-gray-800 hover:bg-gray-300',
    danger: 'bg-red-500 text-white hover:bg-red-600',
    ghost: 'bg-transparent hover:bg-gray-100'
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(baseStyles, variantStyles[variant], className)}
    >
      {children}
    </button>
  );
}`,
      status: 'modified',
      additions: 12,
      deletions: 4
    }
  },
  'e5f6g7h8i9j0k1l2m3n4o5p6': {
    commit: mockFileHistory.commits[1],
    file: {
      oldPath: 'src/components/Button.tsx',
      newPath: 'src/components/Button.tsx',
      oldContent: `import React from 'react';

interface ButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  onClick?: () => void;
}`,
      newContent: `import React from 'react';
import { cn } from '@/lib/utils';

interface ButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
}`,
      status: 'modified',
      additions: 8,
      deletions: 2
    }
  },
  'a1b2c3d4e5f6g7h8i9j0k1l2': {
    commit: mockFileHistory.commits[2],
    file: {
      oldPath: '/dev/null',
      newPath: 'src/components/Button.tsx',
      oldContent: '',
      newContent: `import React from 'react';

interface ButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  onClick?: () => void;
}

export function Button({ children, variant = 'primary', disabled = false, onClick }: ButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={\`px-4 py-2 rounded font-medium
        \${variant === 'primary' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-800'}
        \${disabled && 'opacity-50 cursor-not-allowed'}
      \`}
    >
      {children}
    </button>
  );
}`,
      status: 'added',
      additions: 25,
      deletions: 0
    }
  }
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

// Compute diff lines from content
function computeDiffLines(oldContent: string, newContent: string): Array<{
  oldLineNumber: number | null;
  newLineNumber: number | null;
  type: 'added' | 'removed' | 'unchanged';
  content: string;
}> {
  const oldLines = oldContent.split('\n');
  const newLines = newContent.split('\n');
  const result: Array<{
    oldLineNumber: number | null;
    newLineNumber: number | null;
    type: 'added' | 'removed' | 'unchanged';
    content: string;
  }> = [];

  // Simple LCS-based diff algorithm
  const lcs: number[][] = [];
  for (let i = 0; i <= oldLines.length; i++) {
    lcs[i] = [];
    for (let j = 0; j <= newLines.length; j++) {
      if (i === 0 || j === 0) {
        lcs[i][j] = 0;
      } else if (oldLines[i - 1] === newLines[j - 1]) {
        lcs[i][j] = lcs[i - 1][j - 1] + 1;
      } else {
        lcs[i][j] = Math.max(lcs[i - 1][j], lcs[i][j - 1]);
      }
    }
  }

  // Backtrack to find diff
  const diff: Array<{ type: 'added' | 'removed' | 'unchanged'; oldIndex?: number; newIndex?: number }> = [];
  let i = oldLines.length;
  let j = newLines.length;
  
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      diff.unshift({ type: 'unchanged', oldIndex: i - 1, newIndex: j - 1 });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || lcs[i][j - 1] >= lcs[i - 1][j])) {
      diff.unshift({ type: 'added', newIndex: j - 1 });
      j--;
    } else if (i > 0) {
      diff.unshift({ type: 'removed', oldIndex: i - 1 });
      i--;
    }
  }

  let oldLineNum = 1;
  let newLineNum = 1;

  diff.forEach(item => {
    if (item.type === 'unchanged') {
      result.push({
        oldLineNumber: oldLineNum++,
        newLineNumber: newLineNum++,
        type: 'unchanged',
        content: oldLines[item.oldIndex!]
      });
    } else if (item.type === 'added') {
      result.push({
        oldLineNumber: null,
        newLineNumber: newLineNum++,
        type: 'added',
        content: newLines[item.newIndex!]
      });
    } else if (item.type === 'removed') {
      result.push({
        oldLineNumber: oldLineNum++,
        newLineNumber: null,
        type: 'removed',
        content: oldLines[item.oldIndex!]
      });
    }
  });

  return result;
}

// Diff line component
const DiffLineView: React.FC<{
  line: {
    oldLineNumber: number | null;
    newLineNumber: number | null;
    type: 'added' | 'removed' | 'unchanged';
    content: string;
  };
  viewMode: 'side-by-side' | 'inline';
}> = ({ line, viewMode }) => {
  const bgColor = line.type === 'added' 
    ? 'bg-green-500/10' 
    : line.type === 'removed' 
      ? 'bg-red-500/10' 
      : 'bg-transparent';
  
  const textColor = line.type === 'added' 
    ? 'text-green-400' 
    : line.type === 'removed' 
      ? 'text-red-400' 
      : 'text-gray-300';
  
  const prefix = line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' ';

  if (viewMode === 'inline') {
    return (
      <div className={cn('flex hover:bg-[#2a2a2a]', bgColor)}>
        <div className="w-10 min-w-[40px] text-right px-2 py-0.5 text-xs font-mono text-gray-500 select-none border-r border-[#3c3c3c]">
          {line.oldLineNumber ?? ''}
        </div>
        <div className="w-10 min-w-[40px] text-right px-2 py-0.5 text-xs font-mono text-gray-500 select-none border-r border-[#3c3c3c]">
          {line.newLineNumber ?? ''}
        </div>
        <div className={cn('flex-1 px-3 py-0.5 font-mono text-xs whitespace-pre', textColor)}>
          <span className="select-none mr-2">{prefix}</span>
          {line.content}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex hover:bg-[#2a2a2a]', bgColor)}>
      <div className="w-10 min-w-[40px] text-right px-2 py-0.5 text-xs font-mono text-gray-500 select-none border-r border-[#3c3c3c]">
        {line.oldLineNumber ?? ''}
      </div>
      <div className={cn('flex-1 px-3 py-0.5 font-mono text-xs whitespace-pre border-r border-[#3c3c3c]', textColor)}>
        {line.type !== 'added' && (
          <>
            <span className="select-none mr-2">{line.type === 'removed' ? '-' : ' '}</span>
            {line.content}
          </>
        )}
      </div>
      <div className="w-10 min-w-[40px] text-right px-2 py-0.5 text-xs font-mono text-gray-500 select-none border-r border-[#3c3c3c]">
        {line.newLineNumber ?? ''}
      </div>
      <div className={cn('flex-1 px-3 py-0.5 font-mono text-xs whitespace-pre', textColor)}>
        {line.type !== 'removed' && (
          <>
            <span className="select-none mr-2">{line.type === 'added' ? '+' : ' '}</span>
            {line.content}
          </>
        )}
      </div>
    </div>
  );
};

// Diff viewer component for sheets/modals
const DiffViewerPanel: React.FC<{
  title: string;
  description?: string;
  file: {
    oldPath: string;
    newPath: string;
    oldContent: string;
    newContent: string;
    status: 'added' | 'removed' | 'modified' | 'renamed';
    additions: number;
    deletions: number;
  };
  metadata?: React.ReactNode;
}> = ({ title, description, file, metadata }) => {
  const [viewMode, setViewMode] = useState<'side-by-side' | 'inline'>('inline');
  
  const diffLines = useMemo(() => {
    if (file.status === 'added') {
      return file.newContent.split('\n').map((line, idx) => ({
        oldLineNumber: null,
        newLineNumber: idx + 1,
        type: 'added' as const,
        content: line
      }));
    }
    if (file.status === 'removed') {
      return file.oldContent.split('\n').map((line, idx) => ({
        oldLineNumber: idx + 1,
        newLineNumber: null,
        type: 'removed' as const,
        content: line
      }));
    }
    return computeDiffLines(file.oldContent, file.newContent);
  }, [file]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#3c3c3c]">
        <div className="flex items-center gap-2">
          <FileCode className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-medium">{title}</span>
        </div>
        <div className="flex items-center gap-1 bg-[#2a2a2a] rounded p-0.5">
          <Button
            variant={viewMode === 'inline' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => setViewMode('inline')}
          >
            <AlignLeft className="h-3 w-3 mr-1" />
            Inline
          </Button>
          <Button
            variant={viewMode === 'side-by-side' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => setViewMode('side-by-side')}
          >
            <Columns className="h-3 w-3 mr-1" />
            Split
          </Button>
        </div>
      </div>

      {/* Description */}
      {description && (
        <div className="px-4 py-2 text-sm text-gray-400 border-b border-[#3c3c3c]">
          {description}
        </div>
      )}

      {/* Metadata */}
      {metadata && (
        <div className="px-4 py-2 border-b border-[#3c3c3c]">
          {metadata}
        </div>
      )}

      {/* File header */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#252525] border-b border-[#3c3c3c]">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-mono text-gray-300">{file.newPath}</span>
          {file.oldPath !== file.newPath && file.oldPath !== '/dev/null' && (
            <>
              <span className="text-gray-500">←</span>
              <span className="text-sm font-mono text-gray-500">{file.oldPath}</span>
            </>
          )}
          <Badge 
            variant="outline" 
            className={cn(
              'text-[10px] h-4',
              file.status === 'added' && 'border-green-500 text-green-400',
              file.status === 'removed' && 'border-red-500 text-red-400',
              file.status === 'modified' && 'border-yellow-500 text-yellow-400',
              file.status === 'renamed' && 'border-blue-500 text-blue-400'
            )}
          >
            {file.status}
          </Badge>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1 text-green-400">
            <Plus className="h-3 w-3" />
            {file.additions}
          </span>
          <span className="flex items-center gap-1 text-red-400">
            <Minus className="h-3 w-3" />
            {file.deletions}
          </span>
        </div>
      </div>

      {/* Diff content */}
      <ScrollArea className="flex-1">
        {viewMode === 'side-by-side' && (
          <div className="flex bg-[#1e1e1e] text-xs">
            <div className="flex-1 border-r border-[#3c3c3c]">
              <div className="px-3 py-1 bg-[#2a2a2a] text-gray-500 text-[10px] font-sans">Original</div>
            </div>
            <div className="flex-1">
              <div className="px-3 py-1 bg-[#2a2a2a] text-gray-500 text-[10px] font-sans">Modified</div>
            </div>
          </div>
        )}
        <div className="font-mono text-xs">
          {diffLines.map((line, idx) => (
            <DiffLineView key={idx} line={line} viewMode={viewMode} />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
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
              View Diff
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
  onFetchCommitDiff,
  onFetchCompareDiff,
  onFetchFileVersion,
  className = ''
}) => {
  const [selectedCommit, setSelectedCommit] = useState<string | null>(null);
  const [compareBase, setCompareBase] = useState<string | null>(null);
  const [compareTarget, setCompareTarget] = useState<string | null>(null);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  // Diff viewing state
  const [showDiffSheet, setShowDiffSheet] = useState(false);
  const [diffData, setDiffData] = useState<CommitDiffData | CompareDiffData | null>(null);
  const [isLoadingDiff, setIsLoadingDiff] = useState(false);

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

  // Handle view version (show diff for commit)
  const handleViewVersion = useCallback(async (hash: string) => {
    setIsLoadingDiff(true);
    try {
      if (onFetchCommitDiff) {
        const data = await onFetchCommitDiff(hash, history.path);
        setDiffData(data);
      } else {
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 300));
        const mockDiff = mockCommitDiffs[hash];
        if (mockDiff) {
          setDiffData(mockDiff);
        }
      }
      setShowDiffSheet(true);
    } catch (error) {
      console.error('Failed to fetch commit diff:', error);
    } finally {
      setIsLoadingDiff(false);
    }
    if (onViewVersion) {
      onViewVersion(hash);
    }
  }, [onViewVersion, onFetchCommitDiff, history.path]);

  // Handle restore
  const handleRestore = useCallback((hash: string) => {
    if (onRestore) {
      onRestore(hash);
    }
  }, [onRestore]);

  // Handle compare commits
  const handleCompareCommits = useCallback(async () => {
    if (!compareBase || !compareTarget) return;
    
    setIsLoadingDiff(true);
    try {
      if (onFetchCompareDiff) {
        const data = await onFetchCompareDiff(compareBase, compareTarget, history.path);
        setDiffData(data);
      } else {
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 300));
        // Create a compare diff from mock data
        const baseCommit = getCommit(compareBase);
        const targetCommit = getCommit(compareTarget);
        const baseDiff = mockCommitDiffs[compareBase];
        
        if (baseCommit && targetCommit && baseDiff) {
          setDiffData({
            fromCommit: targetCommit,
            toCommit: baseCommit,
            file: baseDiff.file
          });
        }
      }
      setShowDiffSheet(true);
    } catch (error) {
      console.error('Failed to fetch compare diff:', error);
    } finally {
      setIsLoadingDiff(false);
    }
    
    if (onCompare) {
      onCompare(compareBase, compareTarget);
    }
  }, [compareBase, compareTarget, onCompare, onFetchCompareDiff, history.path, getCommit]);

  // Render diff metadata based on type
  const renderDiffMetadata = () => {
    if (!diffData) return null;
    
    if ('commit' in diffData) {
      // Single commit diff
      const commit = diffData.commit;
      const authorColor = getAuthorColor(commit.author);
      return (
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <User className="h-3 w-3 text-gray-400" />
            <span className={authorColor}>{commit.author}</span>
          </div>
          <div className="flex items-center gap-2 text-gray-400">
            <Calendar className="h-3 w-3" />
            <span>{commit.date.toLocaleDateString()}</span>
          </div>
          <div className="flex items-center gap-2 text-gray-400">
            <MessageSquare className="h-3 w-3" />
            <span className="truncate max-w-[200px]">{commit.message}</span>
          </div>
        </div>
      );
    } else {
      // Compare diff
      const fromCommit = diffData.fromCommit;
      const toCommit = diffData.toCommit;
      return (
        <div className="flex items-center gap-2 text-xs">
          <span className="font-mono text-green-400">{fromCommit.shortHash}</span>
          <ArrowRight className="h-3 w-3 text-gray-500" />
          <span className="font-mono text-purple-400">{toCommit.shortHash}</span>
        </div>
      );
    }
  };

  return (
    <div className={cn('flex flex-col h-full bg-[#1e1e1e]', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#3c3c3c]">
        <div className="flex items-center gap-3">
          <History className="h-4 w-4 text-gray-400" />
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
        <span>Select two to compare</span>
      </div>

      {/* Diff Sheet */}
      <Sheet open={showDiffSheet} onOpenChange={setShowDiffSheet}>
        <SheetContent 
          side="right" 
          className="w-[800px] max-w-[90vw] p-0 bg-[#1e1e1e] border-[#3c3c3c]"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Commit Diff</SheetTitle>
            <SheetDescription>
              View the changes made in this commit
            </SheetDescription>
          </SheetHeader>
          {diffData && (
            <DiffViewerPanel
              title={'commit' in diffData 
                ? `Commit ${diffData.commit.shortHash}` 
                : `Compare ${diffData.fromCommit.shortHash} → ${diffData.toCommit.shortHash}`
              }
              description={'commit' in diffData ? diffData.commit.message : undefined}
              file={diffData.file}
              metadata={renderDiffMetadata()}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* Loading overlay */}
      {isLoadingDiff && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="flex items-center gap-2 text-white">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Loading diff...</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default FileHistory;
