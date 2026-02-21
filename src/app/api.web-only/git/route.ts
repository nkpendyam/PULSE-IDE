import { NextRequest, NextResponse } from 'next/server';

// Types for Git operations
interface BlameLine {
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

interface BlameAuthor {
  name: string;
  email: string;
  avatar?: string;
  commitCount: number;
  lineCount: number;
}

interface BlameData {
  file: string;
  lines: BlameLine[];
  authors: BlameAuthor[];
  totalCommits: number;
}

interface FileCommit {
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

interface FileHistoryData {
  path: string;
  commits: FileCommit[];
  currentContent: string;
  branch: string;
}

interface CommitDiffData {
  commitHash: string;
  parentHash: string;
  message: string;
  author: string;
  authorEmail: string;
  date: Date;
  files: Array<{
    oldPath: string;
    newPath: string;
    oldContent: string;
    newContent: string;
    status: 'added' | 'removed' | 'modified' | 'renamed';
    additions: number;
    deletions: number;
  }>;
}

interface FileVersion {
  commitHash: string;
  content: string;
  path: string;
  size: number;
  lines: number;
}

// Helper function to format time ago
function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffWeeks < 4) return `${diffWeeks}w ago`;
  return `${diffMonths}mo ago`;
}

// Helper function to compute diff
function computeDiff(
  oldContent: string, 
  newContent: string
): { additions: number; deletions: number } {
  const oldLines = oldContent.split('\n');
  const newLines = newContent.split('\n');
  
  // Simple LCS-based diff
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

  let additions = 0;
  let deletions = 0;
  let i = oldLines.length;
  let j = newLines.length;
  
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      i--;
      j--;
    } else if (j > 0 && (i === 0 || lcs[i][j - 1] >= lcs[i - 1][j])) {
      additions++;
      j--;
    } else if (i > 0) {
      deletions++;
      i--;
    }
  }

  return { additions, deletions };
}

// Mock data generators for demo
// In production, these would be replaced with actual Git commands
// executed through Tauri or a backend service

function generateMockBlame(filePath: string): BlameData {
  const authors: BlameAuthor[] = [
    { name: 'Alice Johnson', email: 'alice@example.com', commitCount: 3, lineCount: 25 },
    { name: 'Bob Smith', email: 'bob@example.com', commitCount: 1, lineCount: 10 },
    { name: 'Charlie Brown', email: 'charlie@example.com', commitCount: 1, lineCount: 8 }
  ];

  const commits = [
    { hash: 'a1b2c3d4', author: 'Alice Johnson', email: 'alice@example.com', message: 'Initial component setup', date: new Date('2024-01-15') },
    { hash: 'e5f6g7h8', author: 'Bob Smith', email: 'bob@example.com', message: 'Add utility imports', date: new Date('2024-01-20') },
    { hash: 'i9j0k1l2', author: 'Charlie Brown', email: 'charlie@example.com', message: 'Add new features', date: new Date('2024-01-25') }
  ];

  const content = `import React from 'react';
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
}`;

  const lines = content.split('\n').map((lineContent, index) => {
    const commitIndex = index % commits.length;
    const commit = commits[commitIndex];
    
    return {
      lineNumber: index + 1,
      content: lineContent,
      commitHash: commit.hash,
      author: commit.author,
      authorEmail: commit.email,
      date: commit.date,
      timeAgo: formatTimeAgo(commit.date),
      message: commit.message
    };
  });

  return {
    file: filePath,
    lines,
    authors,
    totalCommits: commits.length
  };
}

function generateMockHistory(filePath: string): FileHistoryData {
  const commits: FileCommit[] = [
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
  ];

  return {
    path: filePath,
    commits,
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
    branch: 'main'
  };
}

function generateMockCommitDiff(commitHash: string, filePath: string): CommitDiffData {
  const oldContent = `interface ButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
}

export function Button({ children, variant = 'primary', size = 'md' }: ButtonProps) {
  return <button>{children}</button>;
}`;

  const newContent = `interface ButtonProps {
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
}`;

  const diff = computeDiff(oldContent, newContent);

  return {
    commitHash: commitHash,
    parentHash: 'e5f6g7h8i9j0k1l2',
    message: 'Add ghost and danger button variants',
    author: 'Charlie Brown',
    authorEmail: 'charlie@example.com',
    date: new Date('2024-01-25T14:30:00'),
    files: [{
      oldPath: filePath,
      newPath: filePath,
      oldContent,
      newContent,
      status: 'modified',
      additions: diff.additions,
      deletions: diff.deletions
    }]
  };
}

function generateMockCompareDiff(
  fromHash: string, 
  toHash: string, 
  filePath: string
): CommitDiffData {
  const oldContent = `interface ButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary';
}

export function Button({ children, variant = 'primary' }: ButtonProps) {
  return <button>{children}</button>;
}`;

  const newContent = `interface ButtonProps {
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
}`;

  const diff = computeDiff(oldContent, newContent);

  return {
    commitHash: toHash,
    parentHash: fromHash,
    message: `Compare ${fromHash.substring(0, 7)}...${toHash.substring(0, 7)}`,
    author: 'Multiple Authors',
    authorEmail: 'noreply@example.com',
    date: new Date(),
    files: [{
      oldPath: filePath,
      newPath: filePath,
      oldContent,
      newContent,
      status: 'modified',
      additions: diff.additions,
      deletions: diff.deletions
    }]
  };
}

function generateMockFileVersion(commitHash: string, filePath: string): FileVersion {
  const content = `import React from 'react';
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
}`;

  return {
    commitHash,
    content,
    path: filePath,
    size: content.length,
    lines: content.split('\n').length
  };
}

// API Route Handler
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');
  const filePath = searchParams.get('filePath') || 'src/components/Button.tsx';
  const commitHash = searchParams.get('commitHash');
  const fromHash = searchParams.get('fromHash');
  const toHash = searchParams.get('toHash');

  try {
    switch (action) {
      case 'blame': {
        const blame = generateMockBlame(filePath);
        return NextResponse.json({ success: true, data: blame });
      }

      case 'history': {
        const history = generateMockHistory(filePath);
        return NextResponse.json({ success: true, data: history });
      }

      case 'commitDiff': {
        if (!commitHash) {
          return NextResponse.json(
            { success: false, error: 'commitHash is required' },
            { status: 400 }
          );
        }
        const diff = generateMockCommitDiff(commitHash, filePath);
        return NextResponse.json({ success: true, data: diff });
      }

      case 'compareDiff': {
        if (!fromHash || !toHash) {
          return NextResponse.json(
            { success: false, error: 'fromHash and toHash are required' },
            { status: 400 }
          );
        }
        const diff = generateMockCompareDiff(fromHash, toHash, filePath);
        return NextResponse.json({ success: true, data: diff });
      }

      case 'fileVersion': {
        if (!commitHash) {
          return NextResponse.json(
            { success: false, error: 'commitHash is required' },
            { status: 400 }
          );
        }
        const version = generateMockFileVersion(commitHash, filePath);
        return NextResponse.json({ success: true, data: version });
      }

      case 'status': {
        return NextResponse.json({
          success: true,
          data: {
            isGitRepo: true,
            currentBranch: 'main',
            ahead: 0,
            behind: 0,
            staged: 2,
            unstaged: 1,
            untracked: 1
          }
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action. Use: blame, history, commitDiff, compareDiff, fileVersion, status' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Git API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, filePath, commitHash, fromHash, toHash } = body;

    switch (action) {
      case 'blame': {
        const blame = generateMockBlame(filePath || 'src/components/Button.tsx');
        return NextResponse.json({ success: true, data: blame });
      }

      case 'history': {
        const history = generateMockHistory(filePath || 'src/components/Button.tsx');
        return NextResponse.json({ success: true, data: history });
      }

      case 'commitDiff': {
        if (!commitHash) {
          return NextResponse.json(
            { success: false, error: 'commitHash is required' },
            { status: 400 }
          );
        }
        const diff = generateMockCommitDiff(commitHash, filePath || 'src/components/Button.tsx');
        return NextResponse.json({ success: true, data: diff });
      }

      case 'compareDiff': {
        if (!fromHash || !toHash) {
          return NextResponse.json(
            { success: false, error: 'fromHash and toHash are required' },
            { status: 400 }
          );
        }
        const diff = generateMockCompareDiff(fromHash, toHash, filePath || 'src/components/Button.tsx');
        return NextResponse.json({ success: true, data: diff });
      }

      case 'fileVersion': {
        if (!commitHash) {
          return NextResponse.json(
            { success: false, error: 'commitHash is required' },
            { status: 400 }
          );
        }
        const version = generateMockFileVersion(commitHash, filePath || 'src/components/Button.tsx');
        return NextResponse.json({ success: true, data: version });
      }

      case 'restore': {
        // In production, this would execute: git checkout <commitHash> -- <filePath>
        return NextResponse.json({
          success: true,
          message: `File ${filePath} restored to commit ${commitHash}`,
          data: {
            restored: true,
            filePath,
            commitHash
          }
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Git API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
