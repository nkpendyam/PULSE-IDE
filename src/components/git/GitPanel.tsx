'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  GitBranch, 
  GitCommit, 
  GitMerge,
  GitCompare,
  Plus,
  Minus,
  RefreshCw,
  Check,
  X,
  ChevronDown,
  ChevronRight,
  FileText,
  Clock,
  AlertTriangle,
  CheckCircle2,
  MessageSquare,
  Send,
  MoreHorizontal,
  ExternalLink,
  RotateCcw,
  Trash2,
  Eye,
  History,
  User
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Import sub-components (we'll use mock data for standalone demo)
import DiffViewer from './DiffViewer';
import MergeConflicts from './MergeConflicts';
import BlameAnnotations from './BlameAnnotations';
import FileHistory from './FileHistory';

// Types
export interface GitStatus {
  branch: string;
  ahead: number;
  behind: number;
  staged: GitFile[];
  changes: GitFile[];
  conflicts: GitFile[];
  untracked: GitFile[];
}

export interface GitFile {
  path: string;
  status: 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked' | 'conflict';
  staged?: boolean;
  additions?: number;
  deletions?: number;
}

export interface GitCommit {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  date: Date;
  timeAgo: string;
}

export interface GitBranchInfo {
  name: string;
  isCurrent: boolean;
  isRemote: boolean;
  upstream?: string;
  ahead?: number;
  behind?: number;
}

export interface GitPanelProps {
  onFileStage?: (path: string) => void;
  onFileUnstage?: (path: string) => void;
  onFileDiscard?: (path: string) => void;
  onFileOpen?: (path: string) => void;
  onCommit?: (message: string) => void;
  onPush?: () => void;
  onPull?: () => void;
  onFetch?: () => void;
  onBranchCreate?: (name: string) => void;
  onBranchSwitch?: (name: string) => void;
  onMerge?: (branch: string) => void;
  className?: string;
}

// Mock data
const mockStatus: GitStatus = {
  branch: 'feature/new-button-variants',
  ahead: 3,
  behind: 1,
  staged: [
    { path: 'src/components/Button.tsx', status: 'modified', additions: 12, deletions: 4 },
    { path: 'src/styles/button.css', status: 'added', additions: 45, deletions: 0 }
  ],
  changes: [
    { path: 'src/components/Card.tsx', status: 'modified', additions: 8, deletions: 2 },
    { path: 'src/hooks/useAuth.ts', status: 'modified', additions: 15, deletions: 5 },
    { path: 'src/utils/api.ts', status: 'deleted', additions: 0, deletions: 30 }
  ],
  conflicts: [
    { path: 'src/components/Modal.tsx', status: 'conflict' }
  ],
  untracked: [
    { path: 'src/components/NewComponent.tsx', status: 'untracked' },
    { path: 'src/tests/button.test.ts', status: 'untracked' }
  ]
};

const mockRecentCommits: GitCommit[] = [
  {
    hash: 'i9j0k1l2m3n4o5p6q7r8s9t0',
    shortHash: 'i9j0k1l',
    message: 'Add ghost and danger button variants',
    author: 'Charlie Brown',
    date: new Date('2024-01-25T14:30:00'),
    timeAgo: '3 days ago'
  },
  {
    hash: 'e5f6g7h8i9j0k1l2m3n4o5p6',
    shortHash: 'e5f6g7h',
    message: 'Add className prop for customization',
    author: 'Bob Smith',
    date: new Date('2024-01-20T10:15:00'),
    timeAgo: '1 week ago'
  },
  {
    hash: 'a1b2c3d4e5f6g7h8i9j0k1l2',
    shortHash: 'a1b2c3d',
    message: 'Initial Button component setup',
    author: 'Alice Johnson',
    date: new Date('2024-01-15T09:00:00'),
    timeAgo: '2 weeks ago'
  }
];

const mockBranches: GitBranchInfo[] = [
  { name: 'main', isCurrent: false, isRemote: false, ahead: 0, behind: 2 },
  { name: 'feature/new-button-variants', isCurrent: true, isRemote: false, ahead: 3, behind: 1 },
  { name: 'feature/auth-improvements', isCurrent: false, isRemote: false },
  { name: 'develop', isCurrent: false, isRemote: false },
  { name: 'origin/main', isCurrent: false, isRemote: true },
  { name: 'origin/develop', isCurrent: false, isRemote: true }
];

// Status badge component
const StatusBadge: React.FC<{ status: GitFile['status'] }> = ({ status }) => {
  const config: Record<string, { label: string; className: string }> = {
    modified: { label: 'M', className: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50' },
    added: { label: 'A', className: 'bg-green-500/20 text-green-400 border-green-500/50' },
    deleted: { label: 'D', className: 'bg-red-500/20 text-red-400 border-red-500/50' },
    renamed: { label: 'R', className: 'bg-blue-500/20 text-blue-400 border-blue-500/50' },
    untracked: { label: 'U', className: 'bg-gray-500/20 text-gray-400 border-gray-500/50' },
    conflict: { label: 'C', className: 'bg-orange-500/20 text-orange-400 border-orange-500/50' }
  };

  const { label, className } = config[status];

  return (
    <Badge variant="outline" className={cn('text-[10px] h-4 w-4 p-0 flex items-center justify-center font-mono', className)}>
      {label}
    </Badge>
  );
};

// File item component
const FileItem: React.FC<{
  file: GitFile;
  isStaged: boolean;
  onStage?: () => void;
  onUnstage?: () => void;
  onDiscard?: () => void;
  onOpen?: () => void;
}> = ({ file, isStaged, onStage, onUnstage, onDiscard, onOpen }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div 
      className="flex items-center gap-2 px-2 py-1 hover:bg-[#2a2a2a] cursor-pointer group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onOpen}
    >
      <StatusBadge status={file.status} />
      <span className="flex-1 text-xs truncate font-mono">{file.path}</span>
      
      {/* Stats */}
      {(file.additions !== undefined || file.deletions !== undefined) && (
        <div className="flex items-center gap-1 text-[10px] opacity-50 group-hover:opacity-100">
          {file.additions !== undefined && file.additions > 0 && (
            <span className="text-green-400">+{file.additions}</span>
          )}
          {file.deletions !== undefined && file.deletions > 0 && (
            <span className="text-red-400">-{file.deletions}</span>
          )}
        </div>
      )}

      {/* Actions */}
      {isHovered && (
        <div className="flex items-center gap-1">
          {isStaged ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              onClick={(e) => { e.stopPropagation(); onUnstage?.(); }}
              title="Unstage"
            >
              <Minus className="h-3 w-3" />
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              onClick={(e) => { e.stopPropagation(); onStage?.(); }}
              title="Stage"
            >
              <Plus className="h-3 w-3" />
            </Button>
          )}
          {!isStaged && (
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 text-red-400 hover:text-red-300"
              onClick={(e) => { e.stopPropagation(); onDiscard?.(); }}
              title="Discard"
            >
              <RotateCcw className="h-3 w-3" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

// File group component
const FileGroup: React.FC<{
  title: string;
  count: number;
  files: GitFile[];
  isStaged: boolean;
  onStageAll?: () => void;
  onUnstageAll?: () => void;
  onFileStage?: (path: string) => void;
  onFileUnstage?: (path: string) => void;
  onFileDiscard?: (path: string) => void;
  onFileOpen?: (path: string) => void;
  defaultOpen?: boolean;
  variant?: 'default' | 'warning' | 'danger';
}> = ({ 
  title, 
  count, 
  files, 
  isStaged, 
  onStageAll, 
  onUnstageAll, 
  onFileStage, 
  onFileUnstage, 
  onFileDiscard, 
  onFileOpen,
  defaultOpen = true,
  variant = 'default'
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const variantStyles = {
    default: 'text-gray-400',
    warning: 'text-yellow-400',
    danger: 'text-red-400'
  };

  return (
    <div className="border-b border-[#3c3c3c] last:border-b-0">
      <div 
        className="flex items-center gap-2 px-3 py-1.5 hover:bg-[#2a2a2a] cursor-pointer"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? (
          <ChevronDown className="h-3 w-3 text-gray-500" />
        ) : (
          <ChevronRight className="h-3 w-3 text-gray-500" />
        )}
        <span className={cn('text-xs font-medium', variantStyles[variant])}>
          {title}
        </span>
        <Badge variant="secondary" className="text-[10px] h-4 px-1">
          {count}
        </Badge>
        
        {/* Group actions */}
        <div className="ml-auto flex items-center gap-1">
          {isStaged ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-5 text-xs"
              onClick={(e) => { e.stopPropagation(); onUnstageAll?.(); }}
            >
              Unstage All
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="h-5 text-xs"
              onClick={(e) => { e.stopPropagation(); onStageAll?.(); }}
            >
              Stage All
            </Button>
          )}
        </div>
      </div>
      
      {isOpen && (
        <div className="pb-1">
          {files.map(file => (
            <FileItem
              key={file.path}
              file={file}
              isStaged={isStaged}
              onStage={() => onFileStage?.(file.path)}
              onUnstage={() => onFileUnstage?.(file.path)}
              onDiscard={() => onFileDiscard?.(file.path)}
              onOpen={() => onFileOpen?.(file.path)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// Commit history component
const CommitHistory: React.FC<{
  commits: GitCommit[];
  onCommitClick?: (hash: string) => void;
}> = ({ commits, onCommitClick }) => (
  <div className="space-y-1">
    {commits.map(commit => (
      <div 
        key={commit.hash}
        className="flex items-start gap-2 px-3 py-2 hover:bg-[#2a2a2a] cursor-pointer group"
        onClick={() => onCommitClick?.(commit.hash)}
      >
        <GitCommit className="h-4 w-4 text-gray-500 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-200 truncate">{commit.message}</p>
          <div className="flex items-center gap-2 mt-1 text-[10px] text-gray-500">
            <span className="font-mono">{commit.shortHash}</span>
            <span>•</span>
            <span>{commit.author}</span>
            <span>•</span>
            <span>{commit.timeAgo}</span>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 opacity-0 group-hover:opacity-100"
        >
          <ExternalLink className="h-3 w-3" />
        </Button>
      </div>
    ))}
  </div>
);

// Branch selector component
const BranchSelector: React.FC<{
  currentBranch: string;
  branches: GitBranchInfo[];
  onSwitch?: (name: string) => void;
  onCreate?: (name: string) => void;
}> = ({ currentBranch, branches, onSwitch, onCreate }) => {
  const [isOpen, setIsOpen] = useState(false);

  const localBranches = branches.filter(b => !b.isRemote);
  const remoteBranches = branches.filter(b => b.isRemote);

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1">
          <GitBranch className="h-3 w-3" />
          <span className="truncate max-w-[120px]">{currentBranch}</span>
          <ChevronDown className="h-3 w-3 ml-auto" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64 bg-[#1e1e1e] border-[#3c3c3c]">
        <div className="px-2 py-1.5 text-xs text-gray-400">Local Branches</div>
        {localBranches.map(branch => (
          <DropdownMenuItem
            key={branch.name}
            className={cn(
              'text-xs cursor-pointer',
              branch.isCurrent && 'bg-blue-500/10'
            )}
            onClick={() => {
              if (!branch.isCurrent) onSwitch?.(branch.name);
              setIsOpen(false);
            }}
          >
            <div className="flex items-center gap-2 w-full">
              {branch.isCurrent && <Check className="h-3 w-3 text-green-400" />}
              <span className={branch.isCurrent ? 'text-blue-400' : ''}>
                {branch.name}
              </span>
              {(branch.ahead || branch.behind) && (
                <span className="ml-auto text-gray-500">
                  {branch.ahead}↑ {branch.behind}↓
                </span>
              )}
            </div>
          </DropdownMenuItem>
        ))}
        
        <DropdownMenuSeparator className="bg-[#3c3c3c]" />
        
        <div className="px-2 py-1.5 text-xs text-gray-400">Remote Branches</div>
        {remoteBranches.map(branch => (
          <DropdownMenuItem
            key={branch.name}
            className="text-xs cursor-pointer"
            onClick={() => {
              onSwitch?.(branch.name);
              setIsOpen(false);
            }}
          >
            <span className="text-gray-400">{branch.name}</span>
          </DropdownMenuItem>
        ))}
        
        <DropdownMenuSeparator className="bg-[#3c3c3c]" />
        
        <DropdownMenuItem className="text-xs cursor-pointer" onClick={() => setIsOpen(false)}>
          <Plus className="h-3 w-3 mr-2" />
          Create new branch...
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

// Main GitPanel component
export const GitPanel: React.FC<GitPanelProps> = ({
  onFileStage,
  onFileUnstage,
  onFileDiscard,
  onFileOpen,
  onCommit,
  onPush,
  onPull,
  onFetch,
  onBranchCreate,
  onBranchSwitch,
  onMerge,
  className = ''
}) => {
  const [status] = useState<GitStatus>(mockStatus);
  const [commits] = useState<GitCommit[]>(mockRecentCommits);
  const [branches] = useState<GitBranchInfo[]>(mockBranches);
  const [commitMessage, setCommitMessage] = useState('');
  const [activeTab, setActiveTab] = useState<'changes' | 'history' | 'branches'>('changes');

  // Calculate stats
  const stats = useMemo(() => ({
    staged: status.staged.length,
    changes: status.changes.length + status.untracked.length,
    conflicts: status.conflicts.length
  }), [status]);

  // Handle commit
  const handleCommit = useCallback(() => {
    if (commitMessage.trim() && stats.staged > 0) {
      onCommit?.(commitMessage);
      setCommitMessage('');
    }
  }, [commitMessage, stats.staged, onCommit]);

  // Handle keyboard shortcut for commit
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleCommit();
    }
  }, [handleCommit]);

  return (
    <div className={cn('flex flex-col h-full bg-[#1e1e1e] text-gray-200', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#3c3c3c]">
        <div className="flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-gray-400" />
          <span className="text-xs font-semibold uppercase tracking-wide">Source Control</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={onFetch}
            title="Fetch"
          >
            <RefreshCw className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={onPull}
            title="Pull"
          >
            <GitMerge className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={onPush}
            title="Push"
          >
            <GitCommit className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Branch selector and sync status */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#3c3c3c] bg-[#252525]">
        <BranchSelector
          currentBranch={status.branch}
          branches={branches}
          onSwitch={onBranchSwitch}
          onCreate={onBranchCreate}
        />
        <div className="flex items-center gap-2 text-[10px] text-gray-500">
          {status.ahead > 0 && (
            <span className="text-green-400">{status.ahead}↑</span>
          )}
          {status.behind > 0 && (
            <span className="text-yellow-400">{status.behind}↓</span>
          )}
        </div>
      </div>

      {/* Tab navigation */}
      <div className="flex border-b border-[#3c3c3c]">
        <Button
          variant={activeTab === 'changes' ? 'ghost' : 'ghost'}
          className={cn(
            'flex-1 h-8 text-xs rounded-none border-b-2',
            activeTab === 'changes' ? 'border-blue-500 text-blue-400' : 'border-transparent text-gray-400'
          )}
          onClick={() => setActiveTab('changes')}
        >
          Changes
          {stats.changes + stats.conflicts > 0 && (
            <Badge variant="secondary" className="ml-2 text-[10px] h-4">
              {stats.changes + stats.conflicts}
            </Badge>
          )}
        </Button>
        <Button
          variant="ghost"
          className={cn(
            'flex-1 h-8 text-xs rounded-none border-b-2',
            activeTab === 'history' ? 'border-blue-500 text-blue-400' : 'border-transparent text-gray-400'
          )}
          onClick={() => setActiveTab('history')}
        >
          History
        </Button>
        <Button
          variant="ghost"
          className={cn(
            'flex-1 h-8 text-xs rounded-none border-b-2',
            activeTab === 'branches' ? 'border-blue-500 text-blue-400' : 'border-transparent text-gray-400'
          )}
          onClick={() => setActiveTab('branches')}
        >
          Branches
        </Button>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        {activeTab === 'changes' && (
          <div>
            {/* Commit message input */}
            <div className="p-3 border-b border-[#3c3c3c]">
              <textarea
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Commit message (Ctrl+Enter to commit)"
                className="w-full h-16 px-3 py-2 text-xs bg-[#181818] border border-[#3c3c3c] rounded resize-none focus:outline-none focus:border-blue-500"
              />
              <div className="flex items-center justify-between mt-2">
                <span className="text-[10px] text-gray-500">
                  {stats.staged} file(s) staged
                </span>
                <Button
                  variant="default"
                  size="sm"
                  className="h-6 text-xs"
                  disabled={!commitMessage.trim() || stats.staged === 0}
                  onClick={handleCommit}
                >
                  <Check className="h-3 w-3 mr-1" />
                  Commit
                </Button>
              </div>
            </div>

            {/* Conflicts */}
            {status.conflicts.length > 0 && (
              <FileGroup
                title="Conflicts"
                count={status.conflicts.length}
                files={status.conflicts}
                isStaged={false}
                defaultOpen={true}
                variant="danger"
                onFileOpen={onFileOpen}
              />
            )}

            {/* Staged changes */}
            <FileGroup
              title="Staged Changes"
              count={status.staged.length}
              files={status.staged}
              isStaged={true}
              onUnstageAll={() => status.staged.forEach(f => onFileUnstage?.(f.path))}
              onFileUnstage={onFileUnstage}
              onFileOpen={onFileOpen}
            />

            {/* Unstaged changes */}
            <FileGroup
              title="Changes"
              count={status.changes.length}
              files={status.changes}
              isStaged={false}
              onStageAll={() => status.changes.forEach(f => onFileStage?.(f.path))}
              onFileStage={onFileStage}
              onFileDiscard={onFileDiscard}
              onFileOpen={onFileOpen}
            />

            {/* Untracked files */}
            {status.untracked.length > 0 && (
              <FileGroup
                title="Untracked"
                count={status.untracked.length}
                files={status.untracked}
                isStaged={false}
                defaultOpen={false}
                onStageAll={() => status.untracked.forEach(f => onFileStage?.(f.path))}
                onFileStage={onFileStage}
                onFileDiscard={onFileDiscard}
                onFileOpen={onFileOpen}
              />
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <CommitHistory 
            commits={commits}
            onCommitClick={(hash) => console.log('View commit:', hash)}
          />
        )}

        {activeTab === 'branches' && (
          <div className="p-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400">Branches</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 text-xs"
                onClick={() => onBranchCreate?.('new-branch')}
              >
                <Plus className="h-3 w-3 mr-1" />
                New
              </Button>
            </div>
            {branches.filter(b => !b.isRemote).map(branch => (
              <div
                key={branch.name}
                className={cn(
                  'flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-[#2a2a2a]',
                  branch.isCurrent && 'bg-blue-500/10'
                )}
                onClick={() => !branch.isCurrent && onBranchSwitch?.(branch.name)}
              >
                <GitBranch className="h-3 w-3 text-gray-500" />
                <span className={cn('text-xs', branch.isCurrent && 'text-blue-400')}>
                  {branch.name}
                </span>
                {branch.isCurrent && (
                  <Badge variant="outline" className="ml-auto text-[10px] h-4 border-blue-500 text-blue-400">
                    current
                  </Badge>
                )}
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Footer */}
      <div className="flex items-center justify-between px-3 py-1.5 border-t border-[#3c3c3c] text-[10px] text-gray-500">
        <span>
          {stats.staged} staged • {stats.changes} unstaged
          {stats.conflicts > 0 && <span className="text-red-400"> • {stats.conflicts} conflicts</span>}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-5 w-5">
              <MoreHorizontal className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-[#1e1e1e] border-[#3c3c3c]">
            <DropdownMenuItem className="text-xs" onClick={onFetch}>
              <RefreshCw className="h-3 w-3 mr-2" />
              Fetch All
            </DropdownMenuItem>
            <DropdownMenuItem className="text-xs" onClick={onPull}>
              <GitMerge className="h-3 w-3 mr-2" />
              Pull
            </DropdownMenuItem>
            <DropdownMenuItem className="text-xs" onClick={onPush}>
              <GitCommit className="h-3 w-3 mr-2" />
              Push
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-[#3c3c3c]" />
            <DropdownMenuItem className="text-xs">
              <GitCompare className="h-3 w-3 mr-2" />
              Compare with...
            </DropdownMenuItem>
            <DropdownMenuItem className="text-xs">
              <History className="h-3 w-3 mr-2" />
              View History
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};

export default GitPanel;
