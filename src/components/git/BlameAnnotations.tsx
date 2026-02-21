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
  GitCommit, 
  User, 
  Calendar, 
  Clock, 
  FileText,
  ExternalLink,
  Copy,
  Check,
  MessageSquare
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

export interface BlameAnnotationsProps {
  blame?: BlameData;
  showGutter?: boolean;
  onCommitClick?: (commitHash: string) => void;
  onLineClick?: (line: BlameLine) => void;
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
      content: '  variant = \'primary\', ',
      commitHash: 'i9j0k1l2',
      author: 'Charlie Brown',
      authorEmail: 'charlie@example.com',
      date: new Date('2024-01-25'),
      timeAgo: '3 days ago',
      message: 'Refactor Button props destructuring'
    },
    {
      lineNumber: 16,
      content: '  size = \'md\',',
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
      content: '  const baseStyles = \'px-4 py-2 rounded font-medium transition-colors\';',
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
              View Commit
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
  className = ''
}) => {
  const [showDetails, setShowDetails] = useState(true);
  const [showLineNumbers, setShowLineNumbers] = useState(true);
  const [selectedLine, setSelectedLine] = useState<number | null>(null);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

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

  // Handle commit click
  const handleCommitClick = useCallback((hash: string) => {
    if (onCommitClick) {
      onCommitClick(hash);
    }
  }, [onCommitClick]);

  // Handle line click
  const handleLineClick = useCallback((line: BlameLine) => {
    setSelectedLine(line.lineNumber);
    if (onLineClick) {
      onLineClick(line);
    }
  }, [onLineClick]);

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
        <span>Click commit hash for details</span>
      </div>
    </div>
  );
};

export default BlameAnnotations;
