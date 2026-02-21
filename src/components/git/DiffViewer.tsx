'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { 
  ChevronDown, 
  ChevronRight, 
  Columns, 
  AlignLeft,
  Plus,
  Minus,
  ChevronUp,
  Copy,
  Check
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Types
export interface DiffLine {
  oldLineNumber: number | null;
  newLineNumber: number | null;
  type: 'added' | 'removed' | 'unchanged' | 'modified';
  oldContent: string;
  newContent: string;
  isFolded?: boolean;
  foldStart?: boolean;
  foldEnd?: boolean;
  foldedLines?: number;
}

export interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  header: string;
  lines: DiffLine[];
}

export interface DiffFile {
  oldPath: string;
  newPath: string;
  oldContent: string;
  newContent: string;
  hunks: DiffHunk[];
  status: 'added' | 'removed' | 'modified' | 'renamed';
}

export interface DiffViewerProps {
  diff?: DiffFile;
  viewMode?: 'side-by-side' | 'inline';
  showLineNumbers?: boolean;
  foldThreshold?: number;
  onLineClick?: (line: DiffLine, side: 'old' | 'new') => void;
  className?: string;
}

// Mock data for demonstration
const mockDiffFile: DiffFile = {
  oldPath: 'src/components/Button.tsx',
  newPath: 'src/components/Button.tsx',
  status: 'modified',
  oldContent: `import React from 'react';

interface ButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary';
  onClick?: () => void;
}

export function Button({ children, variant = 'primary', onClick }: ButtonProps) {
  return (
    <button
      onClick={onClick}
      className={\`px-4 py-2 rounded font-medium
        \${variant === 'primary' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-800'}
      \`}
    >
      {children}
    </button>
  );
}`,
  newContent: `import React from 'react';
import { cn } from '@/lib/utils';

interface ButtonProps {
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

  const sizeStyles = {
    sm: 'text-sm px-2 py-1',
    md: 'text-base px-4 py-2',
    lg: 'text-lg px-6 py-3'
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        baseStyles,
        variantStyles[variant],
        sizeStyles[size],
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      {children}
    </button>
  );
}`,
  hunks: []
};

// Compute diff hunks from content
function computeDiffHunks(oldContent: string, newContent: string): DiffHunk[] {
  const oldLines = oldContent.split('\n');
  const newLines = newContent.split('\n');
  const hunks: DiffHunk[] = [];
  
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

  // Group into hunks
  let currentHunk: DiffHunk = {
    oldStart: 1,
    oldLines: 0,
    newStart: 1,
    newLines: 0,
    header: '@@ -1,1 +1,1 @@',
    lines: []
  };
  
  let oldLineNum = 1;
  let newLineNum = 1;
  let unchangedCount = 0;
  const contextLines = 3;
  
  diff.forEach((item, index) => {
    const line: DiffLine = {
      oldLineNumber: null,
      newLineNumber: null,
      type: item.type,
      oldContent: '',
      newContent: ''
    };

    if (item.type === 'unchanged') {
      line.oldLineNumber = oldLineNum++;
      line.newLineNumber = newLineNum++;
      line.oldContent = oldLines[item.oldIndex!];
      line.newContent = newLines[item.newIndex!];
      unchangedCount++;
    } else if (item.type === 'added') {
      line.newLineNumber = newLineNum++;
      line.newContent = newLines[item.newIndex!];
      unchangedCount = 0;
    } else if (item.type === 'removed') {
      line.oldLineNumber = oldLineNum++;
      line.oldContent = oldLines[item.oldIndex!];
      unchangedCount = 0;
    }

    currentHunk.lines.push(line);
  });

  hunks.push(currentHunk);
  return hunks;
}

// Line number component
const LineNumber: React.FC<{
  number: number | null;
  type: 'added' | 'removed' | 'unchanged' | 'modified';
  side: 'old' | 'new';
}> = ({ number, type, side }) => {
  const bgColor = type === 'added' 
    ? 'bg-green-500/10' 
    : type === 'removed' 
      ? 'bg-red-500/10' 
      : 'bg-transparent';

  return (
    <div className={cn(
      'w-12 min-w-[48px] text-right px-2 py-0.5 text-xs font-mono select-none',
      'text-gray-500 border-r border-[#3c3c3c]',
      bgColor
    )}>
      {number ?? ''}
    </div>
  );
};

// Diff line content
const DiffLineContent: React.FC<{
  content: string;
  type: 'added' | 'removed' | 'unchanged' | 'modified';
  side: 'old' | 'new';
  isHovered: boolean;
  onCopy?: () => void;
  showCopyButton?: boolean;
}> = ({ content, type, side, isHovered, onCopy, showCopyButton }) => {
  const bgColor = type === 'added' 
    ? 'bg-green-500/20' 
    : type === 'removed' 
      ? 'bg-red-500/20' 
      : 'bg-transparent';

  const prefix = type === 'added' ? '+' : type === 'removed' ? '-' : ' ';

  return (
    <div className={cn(
      'flex-1 py-0.5 px-2 font-mono text-xs whitespace-pre',
      bgColor
    )}>
      <span className={cn(
        'mr-2 select-none',
        type === 'added' && 'text-green-400',
        type === 'removed' && 'text-red-400',
        type === 'unchanged' && 'text-gray-500'
      )}>
        {prefix}
      </span>
      <span className={cn(
        type === 'added' && 'text-green-300',
        type === 'removed' && 'text-red-300',
        type === 'unchanged' && 'text-gray-300'
      )}>
        {content}
      </span>
      {isHovered && showCopyButton && (
        <Button
          variant="ghost"
          size="icon"
          className="h-4 w-4 ml-2 opacity-0 group-hover:opacity-100"
          onClick={onCopy}
        >
          <Copy className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
};

// Folded section component
const FoldedSection: React.FC<{
  lines: number;
  onUnfold: () => void;
}> = ({ lines, onUnfold }) => (
  <div 
    className="flex items-center gap-2 px-4 py-1 bg-[#2a2a2a] text-gray-500 text-xs cursor-pointer hover:bg-[#3a3a3a]"
    onClick={onUnfold}
  >
    <ChevronDown className="h-3 w-3" />
    <span>...</span>
    <span className="text-gray-600">({lines} unchanged lines folded)</span>
    <Button variant="ghost" size="sm" className="h-5 text-xs ml-auto">
      Unfold
    </Button>
  </div>
);

// Side-by-side diff view
const SideBySideView: React.FC<{
  hunks: DiffHunk[];
  showLineNumbers: boolean;
  foldThreshold: number;
  onLineClick?: (line: DiffLine, side: 'old' | 'new') => void;
}> = ({ hunks, showLineNumbers, foldThreshold, onLineClick }) => {
  const [expandedFolds, setExpandedFolds] = useState<Set<number>>(new Set());
  const [hoveredLine, setHoveredLine] = useState<number | null>(null);

  const toggleFold = (index: number) => {
    setExpandedFolds(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  let lineIndex = 0;
  let unchangedStreak = 0;
  let foldStartIndex = -1;

  return (
    <div className="font-mono text-sm">
      {hunks.map((hunk, hunkIndex) => (
        <div key={hunkIndex}>
          {/* Hunk header */}
          <div className="flex items-center gap-2 px-4 py-1 bg-[#1a1a2e] text-cyan-400 text-xs font-sans">
            <span>{hunk.header}</span>
          </div>
          
          {/* Diff lines */}
          {hunk.lines.map((line, idx) => {
            const globalIndex = lineIndex++;
            
            // Handle folding of unchanged lines
            if (line.type === 'unchanged') {
              unchangedStreak++;
              if (unchangedStreak === foldThreshold && foldStartIndex === -1) {
                foldStartIndex = idx;
              }
            } else {
              unchangedStreak = 0;
              foldStartIndex = -1;
            }

            return (
              <div 
                key={idx}
                className="flex group hover:bg-[#2a2a2a]"
                onMouseEnter={() => setHoveredLine(globalIndex)}
                onMouseLeave={() => setHoveredLine(null)}
              >
                {/* Old side */}
                <div className="flex flex-1 border-r border-[#3c3c3c]">
                  {showLineNumbers && (
                    <LineNumber number={line.oldLineNumber} type={line.type} side="old" />
                  )}
                  <DiffLineContent
                    content={line.oldContent}
                    type={line.type}
                    side="old"
                    isHovered={hoveredLine === globalIndex}
                  />
                </div>
                
                {/* New side */}
                <div className="flex flex-1">
                  {showLineNumbers && (
                    <LineNumber number={line.newLineNumber} type={line.type} side="new" />
                  )}
                  <DiffLineContent
                    content={line.newContent}
                    type={line.type}
                    side="new"
                    isHovered={hoveredLine === globalIndex}
                    showCopyButton
                  />
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};

// Inline diff view
const InlineView: React.FC<{
  hunks: DiffHunk[];
  showLineNumbers: boolean;
  foldThreshold: number;
  onLineClick?: (line: DiffLine, side: 'old' | 'new') => void;
}> = ({ hunks, showLineNumbers, foldThreshold, onLineClick }) => {
  const [hoveredLine, setHoveredLine] = useState<number | null>(null);
  let lineIndex = 0;

  return (
    <div className="font-mono text-sm">
      {hunks.map((hunk, hunkIndex) => (
        <div key={hunkIndex}>
          {/* Hunk header */}
          <div className="flex items-center gap-2 px-4 py-1 bg-[#1a1a2e] text-cyan-400 text-xs font-sans">
            <span>{hunk.header}</span>
          </div>
          
          {/* Diff lines */}
          {hunk.lines.map((line, idx) => {
            const globalIndex = lineIndex++;

            if (line.type === 'unchanged') {
              return (
                <div 
                  key={idx}
                  className="flex group hover:bg-[#2a2a2a]"
                  onMouseEnter={() => setHoveredLine(globalIndex)}
                  onMouseLeave={() => setHoveredLine(null)}
                >
                  {showLineNumbers && (
                    <>
                      <LineNumber number={line.oldLineNumber} type={line.type} side="old" />
                      <LineNumber number={line.newLineNumber} type={line.type} side="new" />
                    </>
                  )}
                  <DiffLineContent
                    content={line.oldContent || line.newContent}
                    type={line.type}
                    side="old"
                    isHovered={hoveredLine === globalIndex}
                  />
                </div>
              );
            }

            if (line.type === 'removed') {
              return (
                <div 
                  key={idx}
                  className="flex group hover:bg-[#2a2a2a]"
                  onMouseEnter={() => setHoveredLine(globalIndex)}
                  onMouseLeave={() => setHoveredLine(null)}
                >
                  {showLineNumbers && (
                    <>
                      <LineNumber number={line.oldLineNumber} type={line.type} side="old" />
                      <div className="w-12 min-w-[48px] border-r border-[#3c3c3c]" />
                    </>
                  )}
                  <DiffLineContent
                    content={line.oldContent}
                    type={line.type}
                    side="old"
                    isHovered={hoveredLine === globalIndex}
                  />
                </div>
              );
            }

            if (line.type === 'added') {
              return (
                <div 
                  key={idx}
                  className="flex group hover:bg-[#2a2a2a]"
                  onMouseEnter={() => setHoveredLine(globalIndex)}
                  onMouseLeave={() => setHoveredLine(null)}
                >
                  {showLineNumbers && (
                    <>
                      <div className="w-12 min-w-[48px] border-r border-[#3c3c3c]" />
                      <LineNumber number={line.newLineNumber} type={line.type} side="new" />
                    </>
                  )}
                  <DiffLineContent
                    content={line.newContent}
                    type={line.type}
                    side="new"
                    isHovered={hoveredLine === globalIndex}
                    showCopyButton
                  />
                </div>
              );
            }

            return null;
          })}
        </div>
      ))}
    </div>
  );
};

// Statistics component
const DiffStats: React.FC<{ hunks: DiffHunk[] }> = ({ hunks }) => {
  const stats = useMemo(() => {
    let additions = 0;
    let deletions = 0;
    
    hunks.forEach(hunk => {
      hunk.lines.forEach(line => {
        if (line.type === 'added') additions++;
        if (line.type === 'removed') deletions++;
      });
    });

    return { additions, deletions };
  }, [hunks]);

  return (
    <div className="flex items-center gap-3 text-xs">
      <span className="flex items-center gap-1 text-green-400">
        <Plus className="h-3 w-3" />
        {stats.additions}
      </span>
      <span className="flex items-center gap-1 text-red-400">
        <Minus className="h-3 w-3" />
        {stats.deletions}
      </span>
    </div>
  );
};

// Main DiffViewer component
export const DiffViewer: React.FC<DiffViewerProps> = ({
  diff = mockDiffFile,
  viewMode: initialViewMode = 'side-by-side',
  showLineNumbers = true,
  foldThreshold = 5,
  onLineClick,
  className = ''
}) => {
  const [viewMode, setViewMode] = useState<'side-by-side' | 'inline'>(initialViewMode);
  const [copied, setCopied] = useState(false);

  // Compute diff hunks
  const hunks = useMemo(() => {
    if (diff.hunks.length > 0) return diff.hunks;
    return computeDiffHunks(diff.oldContent, diff.newContent);
  }, [diff]);

  const handleCopyPath = useCallback(() => {
    navigator.clipboard.writeText(diff.newPath);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [diff.newPath]);

  return (
    <div className={cn('flex flex-col h-full bg-[#1e1e1e]', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#3c3c3c]">
        <div className="flex items-center gap-3">
          {/* File path */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-300">{diff.oldPath}</span>
            {diff.oldPath !== diff.newPath && (
              <>
                <span className="text-gray-500">→</span>
                <span className="text-sm text-gray-300">{diff.newPath}</span>
              </>
            )}
          </div>
          
          {/* Status badge */}
          <Badge 
            variant="outline" 
            className={cn(
              'text-xs',
              diff.status === 'added' && 'border-green-500 text-green-400',
              diff.status === 'removed' && 'border-red-500 text-red-400',
              diff.status === 'modified' && 'border-yellow-500 text-yellow-400',
              diff.status === 'renamed' && 'border-blue-500 text-blue-400'
            )}
          >
            {diff.status}
          </Badge>

          {/* Copy button */}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={handleCopyPath}
          >
            {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
          </Button>
        </div>

        {/* Stats and view toggle */}
        <div className="flex items-center gap-4">
          <DiffStats hunks={hunks} />
          
          {/* View mode toggle */}
          <div className="flex items-center gap-1 bg-[#2a2a2a] rounded p-0.5">
            <Button
              variant={viewMode === 'side-by-side' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => setViewMode('side-by-side')}
            >
              <Columns className="h-3 w-3 mr-1" />
              Side by Side
            </Button>
            <Button
              variant={viewMode === 'inline' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => setViewMode('inline')}
            >
              <AlignLeft className="h-3 w-3 mr-1" />
              Inline
            </Button>
          </div>
        </div>
      </div>

      {/* Diff content */}
      <ScrollArea className="flex-1">
        {viewMode === 'side-by-side' ? (
          <SideBySideView
            hunks={hunks}
            showLineNumbers={showLineNumbers}
            foldThreshold={foldThreshold}
            onLineClick={onLineClick}
          />
        ) : (
          <InlineView
            hunks={hunks}
            showLineNumbers={showLineNumbers}
            foldThreshold={foldThreshold}
            onLineClick={onLineClick}
          />
        )}
      </ScrollArea>
    </div>
  );
};

export default DiffViewer;
