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
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { 
  GitCommit, 
  User, 
  Calendar, 
  Clock, 
  FileText,
  ExternalLink,
  Copy,
  Check,
  MessageSquare,
  X,
  ChevronLeft,
  ChevronRight,
  Plus,
  Minus,
  Columns,
  AlignLeft,
  RefreshCw,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Types
export interface BlameLine {
  lineNumber: number;
  content: string;
  commitHash: string;
  author: string;
  authorEmail: string;
  date: Date;
  timeAgo: string;
  message: string;
  previousHash?: string;
  previousFilename?: string;
}

export interface BlameAuthor {
  name: string;
  email: string;
  avatar?: string;
  commitCount: number;
  lineCount: number;
}

export interface BlameData {
  file: string;
  lines: BlameLine[];
  authors: BlameAuthor[];
  totalCommits: number;
}

export interface CommitDiff {
  commitHash: string;
  parentHash: string;
  message: string;
  author: string;
  authorEmail: string;
  date: Date;
  files: DiffFile[];
}

export interface DiffFile {
  oldPath: string;
  newPath: string;
  oldContent: string;
  newContent: string;
  status: 'added' | 'removed' | 'modified' | 'renamed';
  additions: number;
  deletions: number;
}

export interface BlameAnnotationsProps {
  blame?: BlameData;
  showGutter?: boolean;
  onCommitClick?: (commitHash: string) => void;
  onLineClick?: (line: BlameLine) => void;
  onFetchCommitDiff?: (commitHash: string) => Promise<CommitDiff | null>;
  className?: string;
}

// Mock data for demonstration
const mockBlameData: BlameData = {
  file: 'src/components/Button.tsx',
  totalCommits: 5,
  authors: [
    { name: 'Alice Johnson', email: 'alice@example.com', commitCount: 3, lineCount: 25 },
    { name: 'Bob Smith', email: 'bob@example.com', commitCount: 1, lineCount: 10 },
    { name: 'Charlie Brown', email: 'charlie@example.com', commitCount: 1, lineCount: 8 }
  ],
  lines: [
    {
      lineNumber: 1,
      content: "import React from 'react';",
      commitHash: 'a1b2c3d4',
      author: 'Alice Johnson',
      authorEmail: 'alice@example.com',
      date: new Date('2024-01-15'),
      timeAgo: '2 weeks ago',
      message: 'Initial Button component setup'
    },
    {
      lineNumber: 2,
      content: "import { cn } from '@/lib/utils';",
      commitHash: 'e5f6g7h8',
      author: 'Bob Smith',
      authorEmail: 'bob@example.com',
      date: new Date('2024-01-20'),
      timeAgo: '1 week ago',
      message: 'Add utility imports for styling'
    },
    {
      lineNumber: 3,
      content: '',
      commitHash: 'a1b2c3d4',
      author: 'Alice Johnson',
      authorEmail: 'alice@example.com',
      date: new Date('2024-01-15'),
      timeAgo: '2 weeks ago',
      message: 'Initial Button component setup'
    },
    {
      lineNumber: 4,
      content: 'interface ButtonProps {',
      commitHash: 'a1b2c3d4',
      author: 'Alice Johnson',
      authorEmail: 'alice@example.com',
      date: new Date('2024-01-15'),
      timeAgo: '2 weeks ago',
      message: 'Initial Button component setup'
    },
    {
      lineNumber: 5,
      content: '  children: React.ReactNode;',
      commitHash: 'a1b2c3d4',
      author: 'Alice Johnson',
      authorEmail: 'alice@example.com',
      date: new Date('2024-01-15'),
      timeAgo: '2 weeks ago',
      message: 'Initial Button component setup'
    },
    {
      lineNumber: 6,
      content: "  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';",
      commitHash: 'i9j0k1l2',
      author: 'Charlie Brown',
      authorEmail: 'charlie@example.com',
      date: new Date('2024-01-25'),
      timeAgo: '3 days ago',
      message: 'Add ghost and danger button variants'
    },
    {
      lineNumber: 7,
      content: "  size?: 'sm' | 'md' | 'lg';",
      commitHash: 'e5f6g7h8',
      author: 'Bob Smith',
      authorEmail: 'bob@example.com',
      date: new Date('2024-01-20'),
      timeAgo: '1 week ago',
      message: 'Add size prop support'
    },
    {
      lineNumber: 8,
      content: '  disabled?: boolean;',
      commitHash: 'a1b2c3d4',
      author: 'Alice Johnson',
      authorEmail: 'alice@example.com',
      date: new Date('2024-01-15'),
      timeAgo: '2 weeks ago',
      message: 'Initial Button component setup'
    },
    {
      lineNumber: 9,
      content: '  onClick?: () => void;',
      commitHash: 'a1b2c3d4',
      author: 'Alice Johnson',
      authorEmail: 'alice@example.com',
      date: new Date('2024-01-15'),
      timeAgo: '2 weeks ago',
      message: 'Initial Button component setup'
    },
    {
      lineNumber: 10,
      content: '  className?: string;',
      commitHash: 'e5f6g7h8',
      author: 'Bob Smith',
      authorEmail: 'bob@example.com',
      date: new Date('2024-01-20'),
      timeAgo: '1 week ago',
      message: 'Add className prop for customization'
    },
    {
      lineNumber: 11,
      content: '}',
      commitHash: 'a1b2c3d4',
      author: 'Alice Johnson',
      authorEmail: 'alice@example.com',
      date: new Date('2024-01-15'),
      timeAgo: '2 weeks ago',
      message: 'Initial Button component setup'
    },
    {
      lineNumber: 12,
      content: '',
      commitHash: 'a1b2c3d4',
      author: 'Alice Johnson',
      authorEmail: 'alice@example.com',
      date: new Date('2024-01-15'),
      timeAgo: '2 weeks ago',
      message: 'Initial Button component setup'
    },
    {
      lineNumber: 13,
      content: 'export function Button({ ',
      commitHash: 'i9j0k1l2',
      author: 'Charlie Brown',
      authorEmail: 'charlie@example.com',
      date: new Date('2024-01-25'),
      timeAgo: '3 days ago',
      message: 'Refactor Button props destructuring'
    },
    {
      lineNumber: 14,
      content: '  children, ',
      commitHash: 'i9j0k1l2',
      author: 'Charlie Brown',
      authorEmail: 'charlie@example.com',
      date: new Date('2024-01-25'),
      timeAgo: '3 days ago',
      message: 'Refactor Button props destructuring'
    },
    {
      lineNumber: 15,
      content: "  variant = 'primary', ",
      commitHash: 'i9j0k1l2',
      author: 'Charlie Brown',
      authorEmail: 'charlie@example.com',
      date: new Date('2024-01-25'),
      timeAgo: '3 days ago',
      message: 'Refactor Button props destructuring'
    },
    {
      lineNumber: 16,
      content: "  size = 'md',",
      commitHash: 'e5f6g7h8',
      author: 'Bob Smith',
      authorEmail: 'bob@example.com',
      date: new Date('2024-01-20'),
      timeAgo: '1 week ago',
      message: 'Add size prop with default value'
    },
    {
      lineNumber: 17,
      content: '  disabled = false,',
      commitHash: 'a1b2c3d4',
      author: 'Alice Johnson',
      authorEmail: 'alice@example.com',
      date: new Date('2024-01-15'),
      timeAgo: '2 weeks ago',
      message: 'Initial Button component setup'
    },
    {
      lineNumber: 18,
      content: '  onClick,',
      commitHash: 'a1b2c3d4',
      author: 'Alice Johnson',
      authorEmail: 'alice@example.com',
      date: new Date('2024-01-15'),
      timeAgo: '2 weeks ago',
      message: 'Initial Button component setup'
    },
    {
      lineNumber: 19,
      content: '  className ',
      commitHash: 'e5f6g7h8',
      author: 'Bob Smith',
      authorEmail: 'bob@example.com',
      date: new Date('2024-01-20'),
      timeAgo: '1 week ago',
      message: 'Add className prop for customization'
    },
    {
      lineNumber: 20,
      content: '}: ButtonProps) {',
      commitHash: 'i9j0k1l2',
      author: 'Charlie Brown',
      authorEmail: 'charlie@example.com',
      date: new Date('2024-01-25'),
      timeAgo: '3 days ago',
      message: 'Refactor Button props destructuring'
    },
    {
      lineNumber: 21,
      content: "  const baseStyles = 'px-4 py-2 rounded font-medium transition-colors';",
      commitHash: 'i9j0k1l2',
      author: 'Charlie Brown',
      authorEmail: 'charlie@example.com',
      date: new Date('2024-01-25'),
      timeAgo: '3 days ago',
      message: 'Add base styles constant'
    },
    {
      lineNumber: 22,
      content: '  ',
      commitHash: 'i9j0k1l2',
      author: 'Charlie Brown',
      authorEmail: 'charlie@example.com',
      date: new Date('2024-01-25'),
      timeAgo: '3 days ago',
      message: 'Add base styles constant'
    },
    {
      lineNumber: 23,
      content: '  const variantStyles = {',
      commitHash: 'i9j0k1l2',
      author: 'Charlie Brown',
      authorEmail: 'charlie@example.com',
      date: new Date('2024-01-25'),
      timeAgo: '3 days ago',
      message: 'Add variant styles object'
    },
    {
      lineNumber: 24,
      content: "    primary: 'bg-blue-500 text-white hover:bg-blue-600',",
      commitHash: 'i9j0k1l2',
      author: 'Charlie Brown',
      authorEmail: 'charlie@example.com',
      date: new Date('2024-01-25'),
      timeAgo: '3 days ago',
      message: 'Add variant styles object'
    },
    {
      lineNumber: 25,
      content: "    secondary: 'bg-gray-200 text-gray-800 hover:bg-gray-300',",
      commitHash: 'i9j0k1l2',
      author: 'Charlie Brown',
      authorEmail: 'charlie@example.com',
      date: new Date('2024-01-25'),
      timeAgo: '3 days ago',
      message: 'Add variant styles object'
    },
    {
      lineNumber: 26,
      content: "    danger: 'bg-red-500 text-white hover:bg-red-600',",
      commitHash: 'i9j0k1l2',
      author: 'Charlie Brown',
      authorEmail: 'charlie@example.com',
      date: new Date('2024-01-25'),
      timeAgo: '3 days ago',
      message: 'Add ghost and danger button variants'
    },
    {
      lineNumber: 27,
      content: "    ghost: 'bg-transparent hover:bg-gray-100'",
      commitHash: 'i9j0k1l2',
      author: 'Charlie Brown',
      authorEmail: 'charlie@example.com',
      date: new Date('2024-01-25'),
      timeAgo: '3 days ago',
      message: 'Add ghost and danger button variants'
    },
    {
      lineNumber: 28,
      content: '  };',
      commitHash: 'i9j0k1l2',
      author: 'Charlie Brown',
      authorEmail: 'charlie@example.com',
      date: new Date('2024-01-25'),
      timeAgo: '3 days ago',
      message: 'Add variant styles object'
    }
  ]
};

// Mock commit diff data
const mockCommitDiffs: Record<string, CommitDiff> = {
  'a1b2c3d4': {
    commitHash: 'a1b2c3d4e5f6g7h8',
    parentHash: '0000000000000000',
    message: 'Initial Button component setup',
    author: 'Alice Johnson',
    authorEmail: 'alice@example.com',
    date: new Date('2024-01-15T09:00:00'),
    files: [
      {
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
    ]
  },
  'e5f6g7h8': {
    commitHash: 'e5f6g7h8i9j0k1l2',
    parentHash: 'a1b2c3d4e5f6g7h8',
    message: 'Add utility imports for styling and className prop',
    author: 'Bob Smith',
    authorEmail: 'bob@example.com',
    date: new Date('2024-01-20T10:15:00'),
    files: [
      {
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
    ]
  },
  'i9j0k1l2': {
    commitHash: 'i9j0k1l2m3n4o5p6',
    parentHash: 'e5f6g7h8i9j0k1l2',
    message: 'Add ghost and danger button variants with refactored styles',
    author: 'Charlie Brown',
    authorEmail: 'charlie@example.com',
    date: new Date('2024-01-25T14:30:00'),
    files: [
      {
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
    ]
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

// Commit hash shortening
const shortHash = (hash: string): string => hash.substring(0, 7);

// Compute diff hunks from content
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

// Diff line component for the modal
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

// File diff component
const FileDiffView: React.FC<{
  file: DiffFile;
  viewMode: 'side-by-side' | 'inline';
}> = ({ file, viewMode }) => {
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
    <div className="border border-[#3c3c3c] rounded-md overflow-hidden mb-4">
      {/* File header */}
      <div className="flex items-center justify-between px-3 py-2 bg-[#252525] border-b border-[#3c3c3c]">
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
              file.status === 'modified' && 'border-yellow-500 text-yellow-400'
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
      <ScrollArea className="max-h-[300px]">
        {viewMode === 'side-by-side' ? (
          <div className="flex bg-[#1e1e1e] text-xs">
            <div className="flex-1 border-r border-[#3c3c3c]">
              <div className="px-3 py-1 bg-[#2a2a2a] text-gray-500 text-[10px] font-sans">Original</div>
            </div>
            <div className="flex-1">
              <div className="px-3 py-1 bg-[#2a2a2a] text-gray-500 text-[10px] font-sans">Modified</div>
            </div>
          </div>
        ) : null}
        <div className="font-mono text-xs">
          {diffLines.map((line, idx) => (
            <DiffLineView key={idx} line={line} viewMode={viewMode} />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};

// Commit Diff Modal component
const CommitDiffModal: React.FC<{
  commitDiff: CommitDiff | null;
  isOpen: boolean;
  onClose: () => void;
  onNavigate?: (direction: 'prev' | 'next') => void;
  hasPrev?: boolean;
  hasNext?: boolean;
}> = ({ commitDiff, isOpen, onClose, onNavigate, hasPrev, hasNext }) => {
  const [viewMode, setViewMode] = useState<'side-by-side' | 'inline'>('inline');

  if (!commitDiff) return null;

  const authorColor = getAuthorColor(commitDiff.author);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] bg-[#1e1e1e] border-[#3c3c3c] text-white">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <GitCommit className="h-5 w-5 text-gray-400" />
              <DialogTitle className="font-mono text-lg">
                {shortHash(commitDiff.commitHash)}
              </DialogTitle>
              {onNavigate && (
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => onNavigate('prev')}
                    disabled={!hasPrev}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => onNavigate('next')}
                    disabled={!hasNext}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
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
          </div>
          <DialogDescription className="text-gray-400 text-sm mt-1">
            {commitDiff.message}
          </DialogDescription>
        </DialogHeader>

        {/* Commit metadata */}
        <div className="flex items-center gap-4 px-1 py-2 text-xs border-b border-[#3c3c3c] mb-4">
          <div className="flex items-center gap-2">
            <User className="h-3 w-3 text-gray-400" />
            <span className={authorColor}>{commitDiff.author}</span>
            <span className="text-gray-500">&lt;{commitDiff.authorEmail}&gt;</span>
          </div>
          <div className="flex items-center gap-2 text-gray-400">
            <Calendar className="h-3 w-3" />
            <span>{commitDiff.date.toLocaleDateString()}</span>
            <Clock className="h-3 w-3 ml-2" />
            <span>{commitDiff.date.toLocaleTimeString()}</span>
          </div>
          <div className="flex items-center gap-2 text-gray-500 ml-auto">
            <span>Parent:</span>
            <span className="font-mono">{shortHash(commitDiff.parentHash)}</span>
          </div>
        </div>

        {/* Files diff */}
        <ScrollArea className="flex-1 max-h-[50vh]">
          <div className="space-y-4">
            {commitDiff.files.map((file, idx) => (
              <FileDiffView key={idx} file={file} viewMode={viewMode} />
            ))}
          </div>
        </ScrollArea>

        {/* Summary */}
        <div className="flex items-center justify-between pt-4 border-t border-[#3c3c3c] text-xs text-gray-500">
          <span>
            {commitDiff.files.length} file{commitDiff.files.length !== 1 ? 's' : ''} changed
          </span>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1 text-green-400">
              <Plus className="h-3 w-3" />
              {commitDiff.files.reduce((sum, f) => sum + f.additions, 0)} additions
            </span>
            <span className="flex items-center gap-1 text-red-400">
              <Minus className="h-3 w-3" />
              {commitDiff.files.reduce((sum, f) => sum + f.deletions, 0)} deletions
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// Blame gutter line component
const BlameGutterLine: React.FC<{
  line: BlameLine;
  showDetails: boolean;
  isGroupStart: boolean;
  groupLineCount: number;
  onCommitClick: () => void;
  onCopyHash: () => void;
  copied: boolean;
}> = ({ line, showDetails, isGroupStart, groupLineCount, onCommitClick, onCopyHash, copied }) => {
  const authorColor = getAuthorColor(line.author);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div 
          className={cn(
            'flex items-center gap-2 px-2 py-0.5 text-xs cursor-pointer transition-colors border-l-2',
            'hover:bg-[#2a2a2a]',
            isGroupStart ? 'border-blue-500 bg-blue-500/5' : 'border-transparent',
            showDetails && 'min-w-[200px]'
          )}
          onClick={onCommitClick}
        >
          {/* Commit hash */}
          <span className="font-mono text-gray-500 w-14 shrink-0">
            {shortHash(line.commitHash)}
          </span>
          
          {/* Author name (if showing details) */}
          {showDetails && (
            <span className={cn('truncate flex-1', authorColor)}>
              {line.author.split(' ')[0]}
            </span>
          )}
          
          {/* Time ago */}
          {showDetails && (
            <span className="text-gray-500 truncate">
              {line.timeAgo}
            </span>
          )}

          {/* Group indicator */}
          {isGroupStart && groupLineCount > 1 && (
            <Badge variant="secondary" className="text-[10px] h-4 px-1">
              {groupLineCount}
            </Badge>
          )}
        </div>
      </TooltipTrigger>
      
      <TooltipContent 
        side="right" 
        className="w-80 p-3 bg-[#1e1e1e] border border-[#3c3c3c]"
      >
        <div className="space-y-2">
          {/* Commit info header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <GitCommit className="h-4 w-4 text-gray-400" />
              <span className="font-mono text-sm">{line.commitHash}</span>
            </div>
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
          </div>

          {/* Author */}
          <div className="flex items-center gap-2 text-sm">
            <User className="h-3 w-3 text-gray-400" />
            <span className={authorColor}>{line.author}</span>
            <span className="text-gray-500 text-xs">&lt;{line.authorEmail}&gt;</span>
          </div>

          {/* Date */}
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Calendar className="h-3 w-3" />
            <span>{line.date.toLocaleDateString()}</span>
            <Clock className="h-3 w-3 ml-2" />
            <span>{line.date.toLocaleTimeString()}</span>
          </div>

          {/* Message */}
          <div className="flex items-start gap-2 text-sm pt-1 border-t border-[#3c3c3c]">
            <MessageSquare className="h-3 w-3 text-gray-400 mt-1 shrink-0" />
            <span className="text-gray-300">{line.message}</span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              className="h-6 text-xs flex-1"
              onClick={(e) => {
                e.stopPropagation();
                onCommitClick();
              }}
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              View Diff
            </Button>
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
};

// Code line component
const CodeLine: React.FC<{
  line: BlameLine;
  showLineNumbers: boolean;
  highlighted: boolean;
  onClick: () => void;
}> = ({ line, showLineNumbers, highlighted, onClick }) => (
  <div 
    className={cn(
      'flex items-center group hover:bg-[#2a2a2a] cursor-pointer',
      highlighted && 'bg-blue-500/10'
    )}
    onClick={onClick}
  >
    {/* Line number */}
    {showLineNumbers && (
      <div className="w-10 min-w-[40px] text-right px-2 py-0.5 text-xs font-mono text-gray-500 select-none border-r border-[#3c3c3c]">
        {line.lineNumber}
      </div>
    )}
    
    {/* Code content */}
    <div className="flex-1 px-3 py-0.5 font-mono text-xs whitespace-pre">
      {line.content || '\u00A0'}
    </div>
  </div>
);

// Author statistics component
const AuthorStats: React.FC<{
  authors: BlameAuthor[];
  totalLines: number;
}> = ({ authors, totalLines }) => (
  <div className="p-3 border-b border-[#3c3c3c]">
    <h4 className="text-xs font-medium text-gray-400 mb-2">Authors</h4>
    <div className="space-y-2">
      {authors.map((author, index) => {
        const percentage = Math.round((author.lineCount / totalLines) * 100);
        const authorColor = getAuthorColor(author.name);
        
        return (
          <div key={index} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className={cn('truncate', authorColor)}>{author.name}</span>
              <span className="text-gray-500">
                {author.lineCount} lines ({percentage}%)
              </span>
            </div>
            <div className="h-1 bg-[#2a2a2a] rounded-full overflow-hidden">
              <div 
                className={cn('h-full bg-current opacity-50', authorColor)}
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  </div>
);

// Main BlameAnnotations component
export const BlameAnnotations: React.FC<BlameAnnotationsProps> = ({
  blame = mockBlameData,
  showGutter = true,
  onCommitClick,
  onLineClick,
  onFetchCommitDiff,
  className = ''
}) => {
  const [showDetails, setShowDetails] = useState(true);
  const [showLineNumbers, setShowLineNumbers] = useState(true);
  const [selectedLine, setSelectedLine] = useState<number | null>(null);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  
  // Commit diff modal state
  const [selectedCommitHash, setSelectedCommitHash] = useState<string | null>(null);
  const [commitDiff, setCommitDiff] = useState<CommitDiff | null>(null);
  const [isLoadingDiff, setIsLoadingDiff] = useState(false);

  // Get unique commits for navigation
  const uniqueCommits = useMemo(() => {
    const commits = new Map<string, BlameLine>();
    blame.lines.forEach(line => {
      if (!commits.has(line.commitHash)) {
        commits.set(line.commitHash, line);
      }
    });
    return Array.from(commits.keys());
  }, [blame.lines]);

  // Compute line groups (consecutive lines from same commit)
  const lineGroups = useMemo(() => {
    const groups: Array<{ startLine: number; endLine: number; commitHash: string; count: number }> = [];
    
    blame.lines.forEach((line, index) => {
      if (index === 0 || line.commitHash !== blame.lines[index - 1].commitHash) {
        groups.push({
          startLine: line.lineNumber,
          endLine: line.lineNumber,
          commitHash: line.commitHash,
          count: 1
        });
      } else {
        const lastGroup = groups[groups.length - 1];
        lastGroup.endLine = line.lineNumber;
        lastGroup.count++;
      }
    });

    return groups;
  }, [blame.lines]);

  // Check if line is group start
  const isGroupStart = useCallback((lineNumber: number): { isStart: boolean; count: number } => {
    const group = lineGroups.find(g => g.startLine === lineNumber);
    return { isStart: !!group, count: group?.count || 1 };
  }, [lineGroups]);

  // Handle copy hash
  const handleCopyHash = useCallback((hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 2000);
  }, []);

  // Fetch commit diff
  const fetchCommitDiff = useCallback(async (hash: string) => {
    setIsLoadingDiff(true);
    try {
      // Use provided fetcher or mock data
      if (onFetchCommitDiff) {
        const diff = await onFetchCommitDiff(hash);
        setCommitDiff(diff);
      } else {
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 300));
        const mockDiff = mockCommitDiffs[hash.substring(0, 7)] || mockCommitDiffs['i9j0k1l2'];
        setCommitDiff(mockDiff);
      }
    } catch (error) {
      console.error('Failed to fetch commit diff:', error);
    } finally {
      setIsLoadingDiff(false);
    }
  }, [onFetchCommitDiff]);

  // Handle commit click - shows diff modal
  const handleCommitClick = useCallback((hash: string) => {
    setSelectedCommitHash(hash);
    fetchCommitDiff(hash);
    if (onCommitClick) {
      onCommitClick(hash);
    }
  }, [onCommitClick, fetchCommitDiff]);

  // Handle line click
  const handleLineClick = useCallback((line: BlameLine) => {
    setSelectedLine(line.lineNumber);
    if (onLineClick) {
      onLineClick(line);
    }
  }, [onLineClick]);

  // Handle navigation between commits
  const handleNavigate = useCallback((direction: 'prev' | 'next') => {
    if (!selectedCommitHash) return;
    const currentIndex = uniqueCommits.indexOf(selectedCommitHash);
    let newIndex = direction === 'prev' ? currentIndex - 1 : currentIndex + 1;
    
    if (newIndex < 0) newIndex = uniqueCommits.length - 1;
    if (newIndex >= uniqueCommits.length) newIndex = 0;
    
    const newHash = uniqueCommits[newIndex];
    setSelectedCommitHash(newHash);
    fetchCommitDiff(newHash);
  }, [selectedCommitHash, uniqueCommits, fetchCommitDiff]);

  // Close diff modal
  const handleCloseDiffModal = useCallback(() => {
    setSelectedCommitHash(null);
    setCommitDiff(null);
  }, []);

  return (
    <div className={cn('flex flex-col h-full bg-[#1e1e1e]', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#3c3c3c]">
        <div className="flex items-center gap-3">
          <GitCommit className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-medium">Git Blame</span>
          <Badge variant="outline" className="text-xs">
            {blame.lines.length} lines
          </Badge>
          <Badge variant="outline" className="text-xs">
            {blame.totalCommits} commits
          </Badge>
        </div>

        {/* View options */}
        <div className="flex items-center gap-2">
          <Button
            variant={showDetails ? 'secondary' : 'ghost'}
            size="sm"
            className="h-6 text-xs"
            onClick={() => setShowDetails(!showDetails)}
          >
            Details
          </Button>
          <Button
            variant={showLineNumbers ? 'secondary' : 'ghost'}
            size="sm"
            className="h-6 text-xs"
            onClick={() => setShowLineNumbers(!showLineNumbers)}
          >
            Line #
          </Button>
        </div>
      </div>

      {/* Author stats */}
      {showDetails && (
        <AuthorStats 
          authors={blame.authors} 
          totalLines={blame.lines.length} 
        />
      )}

      {/* Blame view */}
      <ScrollArea className="flex-1">
        <div className="flex">
          {/* Blame gutter */}
          {showGutter && (
            <div className="shrink-0 border-r border-[#3c3c3c] bg-[#181818]">
              {blame.lines.map((line) => {
                const { isStart, count } = isGroupStart(line.lineNumber);
                return (
                  <BlameGutterLine
                    key={line.lineNumber}
                    line={line}
                    showDetails={showDetails}
                    isGroupStart={isStart}
                    groupLineCount={count}
                    onCommitClick={() => handleCommitClick(line.commitHash)}
                    onCopyHash={() => handleCopyHash(line.commitHash)}
                    copied={copiedHash === line.commitHash}
                  />
                );
              })}
            </div>
          )}

          {/* Code content */}
          <div className="flex-1 overflow-x-auto">
            {blame.lines.map((line) => (
              <CodeLine
                key={line.lineNumber}
                line={line}
                showLineNumbers={showLineNumbers}
                highlighted={selectedLine === line.lineNumber}
                onClick={() => handleLineClick(line)}
              />
            ))}
          </div>
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-[#3c3c3c] text-xs text-gray-500">
        <span>{blame.file}</span>
        <span>Click commit to view diff</span>
      </div>

      {/* Commit Diff Modal */}
      <CommitDiffModal
        commitDiff={commitDiff}
        isOpen={!!selectedCommitHash}
        onClose={handleCloseDiffModal}
        onNavigate={handleNavigate}
        hasPrev={uniqueCommits.indexOf(selectedCommitHash || '') > 0}
        hasNext={uniqueCommits.indexOf(selectedCommitHash || '') < uniqueCommits.length - 1}
      />

      {/* Loading overlay */}
      {isLoadingDiff && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="flex items-center gap-2 text-white">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Loading commit diff...</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default BlameAnnotations;
