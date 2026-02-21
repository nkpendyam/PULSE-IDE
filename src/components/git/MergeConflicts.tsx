'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  AlertTriangle, 
  ChevronUp, 
  ChevronDown, 
  Check,
  GitMerge,
  ArrowRight,
  Code,
  X,
  CheckCircle2
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Types
export interface ConflictSection {
  id: string;
  startLine: number;
  endLine: number;
  currentContent: string;
  incomingContent: string;
  currentLabel?: string;
  incomingLabel?: string;
  resolved: boolean;
  resolution?: 'current' | 'incoming' | 'both' | 'custom';
  customContent?: string;
}

export interface ConflictFile {
  path: string;
  conflicts: ConflictSection[];
  content: string;
  hasConflicts: boolean;
}

export interface MergeConflictsProps {
  files?: ConflictFile[];
  onResolve?: (filePath: string, conflictId: string, resolution: 'current' | 'incoming' | 'both' | 'custom', customContent?: string) => void;
  onNavigate?: (filePath: string, conflictId: string) => void;
  className?: string;
}

// Mock data for demonstration
const mockConflictFiles: ConflictFile[] = [
  {
    path: 'src/components/Button.tsx',
    hasConflicts: true,
    content: `import React from 'react';
import { cn } from '@/lib/utils';

<<<<<<< HEAD
interface ButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  onClick?: () => void;
}
=======
interface ButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'danger' | 'outline';
  size?: 'small' | 'medium' | 'large';
  loading?: boolean;
  onClick?: () => void;
}
>>>>>>> feature/new-button-variants

export function Button({ children, variant, size, onClick }: ButtonProps) {
  return <button>{children}</button>;
}`,
    conflicts: [
      {
        id: 'conflict-1',
        startLine: 4,
        endLine: 18,
        currentContent: `interface ButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  onClick?: () => void;
}`,
        incomingContent: `interface ButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'danger' | 'outline';
  size?: 'small' | 'medium' | 'large';
  loading?: boolean;
  onClick?: () => void;
}`,
        currentLabel: 'HEAD (main)',
        incomingLabel: 'feature/new-button-variants',
        resolved: false
      }
    ]
  },
  {
    path: 'src/hooks/useAuth.ts',
    hasConflicts: true,
    content: `import { useState, useEffect } from 'react';

<<<<<<< HEAD
export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    // Check auth status
  }, []);
  
  return { user, loading };
}
=======
export function useAuth(initialUser = null) {
  const [user, setUser] = useState(initialUser);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    // Check auth status with error handling
  }, []);
  
  const login = async (credentials) => {
    // Login logic
  };
  
  const logout = async () => {
    // Logout logic
  };
  
  return { user, isAuthenticated, error, login, logout };
}
>>>>>>> feature/auth-improvements`,
    conflicts: [
      {
        id: 'conflict-2',
        startLine: 3,
        endLine: 25,
        currentContent: `export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    // Check auth status
  }, []);
  
  return { user, loading };
}`,
        incomingContent: `export function useAuth(initialUser = null) {
  const [user, setUser] = useState(initialUser);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    // Check auth status with error handling
  }, []);
  
  const login = async (credentials) => {
    // Login logic
  };
  
  const logout = async () => {
    // Logout logic
  };
  
  return { user, isAuthenticated, error, login, logout };
}`,
        currentLabel: 'HEAD (main)',
        incomingLabel: 'feature/auth-improvements',
        resolved: false
      }
    ]
  },
  {
    path: 'src/utils/api.ts',
    hasConflicts: true,
    content: `const API_BASE = 'https://api.example.com';

<<<<<<< HEAD
export async function fetchData(endpoint: string) {
  const response = await fetch(\`\${API_BASE}\${endpoint}\`);
  return response.json();
}
=======
export async function fetchData(endpoint: string, options = {}) {
  const response = await fetch(\`\${API_BASE}\${endpoint}\`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  });
  
  if (!response.ok) {
    throw new Error(\`API Error: \${response.status}\`);
  }
  
  return response.json();
}
>>>>>>> feature/error-handling`,
    conflicts: [
      {
        id: 'conflict-3',
        startLine: 3,
        endLine: 22,
        currentContent: `export async function fetchData(endpoint: string) {
  const response = await fetch(\`\${API_BASE}\${endpoint}\`);
  return response.json();
}`,
        incomingContent: `export async function fetchData(endpoint: string, options = {}) {
  const response = await fetch(\`\${API_BASE}\${endpoint}\`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  });
  
  if (!response.ok) {
    throw new Error(\`API Error: \${response.status}\`);
  }
  
  return response.json();
}`,
        currentLabel: 'HEAD (main)',
        incomingLabel: 'feature/error-handling',
        resolved: false
      }
    ]
  }
];

// Code preview component
const CodePreview: React.FC<{
  code: string;
  label: string;
  type: 'current' | 'incoming';
  isSelected: boolean;
  onClick: () => void;
}> = ({ code, label, type, isSelected, onClick }) => (
  <div 
    className={cn(
      'flex-1 border rounded-md overflow-hidden cursor-pointer transition-all',
      isSelected 
        ? type === 'current' 
          ? 'border-green-500 bg-green-500/10' 
          : 'border-blue-500 bg-blue-500/10'
        : 'border-[#3c3c3c] bg-[#1e1e1e] hover:border-gray-500'
    )}
    onClick={onClick}
  >
    <div className={cn(
      'px-3 py-1.5 text-xs font-medium border-b flex items-center gap-2',
      type === 'current' ? 'border-green-500/50 text-green-400' : 'border-blue-500/50 text-blue-400'
    )}>
      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: type === 'current' ? '#22c55e' : '#3b82f6' }} />
      {label}
    </div>
    <ScrollArea className="max-h-48">
      <pre className="p-3 text-xs font-mono text-gray-300 whitespace-pre-wrap">
        {code}
      </pre>
    </ScrollArea>
  </div>
);

// Conflict item component
const ConflictItem: React.FC<{
  conflict: ConflictSection;
  filePath: string;
  onResolve: (resolution: 'current' | 'incoming' | 'both' | 'custom') => void;
  onNavigate: () => void;
  isExpanded: boolean;
  onToggle: () => void;
}> = ({ conflict, filePath, onResolve, onNavigate, isExpanded, onToggle }) => {
  const [selectedSide, setSelectedSide] = useState<'current' | 'incoming' | null>(null);

  const handleResolve = (resolution: 'current' | 'incoming' | 'both') => {
    onResolve(resolution);
  };

  return (
    <div className={cn(
      'border rounded-lg overflow-hidden',
      conflict.resolved ? 'border-green-500/30 bg-green-500/5' : 'border-[#3c3c3c] bg-[#1e1e1e]'
    )}>
      {/* Header */}
      <div 
        className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-[#2a2a2a]"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          {conflict.resolved ? (
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          )}
          <span className="text-sm font-medium">
            Lines {conflict.startLine} - {conflict.endLine}
          </span>
          {conflict.resolved && (
            <Badge variant="outline" className="text-xs border-green-500 text-green-400">
              Resolved: {conflict.resolution}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs"
            onClick={(e) => {
              e.stopPropagation();
              onNavigate();
            }}
          >
            <Code className="h-3 w-3 mr-1" />
            View in Editor
          </Button>
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-gray-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-gray-400" />
          )}
        </div>
      </div>

      {/* Expanded content */}
      {isExpanded && !conflict.resolved && (
        <div className="border-t border-[#3c3c3c] p-3">
          {/* Code comparison */}
          <div className="flex gap-3 mb-4">
            <CodePreview
              code={conflict.currentContent}
              label={conflict.currentLabel || 'Current Changes'}
              type="current"
              isSelected={selectedSide === 'current'}
              onClick={() => setSelectedSide('current')}
            />
            <div className="flex items-center">
              <ArrowRight className="h-4 w-4 text-gray-500" />
            </div>
            <CodePreview
              code={conflict.incomingContent}
              label={conflict.incomingLabel || 'Incoming Changes'}
              type="incoming"
              isSelected={selectedSide === 'incoming'}
              onClick={() => setSelectedSide('incoming')}
            />
          </div>

          {/* Resolution buttons */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">Resolve this conflict:</span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs border-green-500/50 text-green-400 hover:bg-green-500/10"
                onClick={() => handleResolve('current')}
              >
                <Check className="h-3 w-3 mr-1" />
                Accept Current
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs border-blue-500/50 text-blue-400 hover:bg-blue-500/10"
                onClick={() => handleResolve('incoming')}
              >
                <Check className="h-3 w-3 mr-1" />
                Accept Incoming
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs border-purple-500/50 text-purple-400 hover:bg-purple-500/10"
                onClick={() => handleResolve('both')}
              >
                <GitMerge className="h-3 w-3 mr-1" />
                Accept Both
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Resolved state */}
      {isExpanded && conflict.resolved && (
        <div className="border-t border-[#3c3c3c] p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-green-400">
              <CheckCircle2 className="h-4 w-4" />
              <span>Resolved using: <strong>{conflict.resolution}</strong></span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-gray-400"
              onClick={() => onResolve('current')} // This would actually unresolve
            >
              <X className="h-3 w-3 mr-1" />
              Undo
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

// File conflicts component
const FileConflicts: React.FC<{
  file: ConflictFile;
  onResolve: (conflictId: string, resolution: 'current' | 'incoming' | 'both' | 'custom') => void;
  onNavigate: (conflictId: string) => void;
}> = ({ file, onResolve, onNavigate }) => {
  const [expandedConflicts, setExpandedConflicts] = useState<Set<string>>(new Set());

  const toggleConflict = (id: string) => {
    setExpandedConflicts(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const unresolvedCount = file.conflicts.filter(c => !c.resolved).length;

  return (
    <div className="border-b border-[#3c3c3c] last:border-b-0">
      {/* File header */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#252525]">
        <div className="flex items-center gap-3">
          <Code className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-200">{file.path}</span>
          <Badge 
            variant="outline" 
            className={cn(
              'text-xs',
              unresolvedCount > 0 
                ? 'border-yellow-500 text-yellow-400' 
                : 'border-green-500 text-green-400'
            )}
          >
            {unresolvedCount > 0 ? `${unresolvedCount} unresolved` : 'All resolved'}
          </Badge>
        </div>
      </div>

      {/* Conflicts list */}
      <div className="p-3 space-y-3">
        {file.conflicts.map(conflict => (
          <ConflictItem
            key={conflict.id}
            conflict={conflict}
            filePath={file.path}
            onResolve={(resolution) => onResolve(conflict.id, resolution)}
            onNavigate={() => onNavigate(conflict.id)}
            isExpanded={expandedConflicts.has(conflict.id)}
            onToggle={() => toggleConflict(conflict.id)}
          />
        ))}
      </div>
    </div>
  );
};

// Main MergeConflicts component
export const MergeConflicts: React.FC<MergeConflictsProps> = ({
  files = mockConflictFiles,
  onResolve,
  onNavigate,
  className = ''
}) => {
  const [conflictFiles, setConflictFiles] = useState<ConflictFile[]>(files);
  const [currentConflictIndex, setCurrentConflictIndex] = useState(0);

  // Calculate statistics
  const stats = useMemo(() => {
    const totalConflicts = conflictFiles.reduce((acc, file) => acc + file.conflicts.length, 0);
    const resolvedConflicts = conflictFiles.reduce(
      (acc, file) => acc + file.conflicts.filter(c => c.resolved).length,
      0
    );
    const filesWithConflicts = conflictFiles.filter(f => f.hasConflicts).length;

    return {
      total: totalConflicts,
      resolved: resolvedConflicts,
      unresolved: totalConflicts - resolvedConflicts,
      filesWithConflicts
    };
  }, [conflictFiles]);

  // Get all conflicts for navigation
  const allConflicts = useMemo(() => {
    return conflictFiles.flatMap(file =>
      file.conflicts.map(conflict => ({ file, conflict }))
    );
  }, [conflictFiles]);

  // Navigate to next/previous conflict
  const navigateConflict = useCallback((direction: 'next' | 'prev') => {
    const unresolvedConflicts = allConflicts.filter(item => !item.conflict.resolved);
    if (unresolvedConflicts.length === 0) return;

    const currentIndex = unresolvedConflicts.findIndex(
      item => item.conflict.id === allConflicts[currentConflictIndex]?.conflict.id
    );

    let newIndex: number;
    if (direction === 'next') {
      newIndex = (currentIndex + 1) % unresolvedConflicts.length;
    } else {
      newIndex = (currentIndex - 1 + unresolvedConflicts.length) % unresolvedConflicts.length;
    }

    setCurrentConflictIndex(allConflicts.findIndex(
      item => item.conflict.id === unresolvedConflicts[newIndex].conflict.id
    ));
  }, [allConflicts, currentConflictIndex]);

  // Handle conflict resolution
  const handleResolve = useCallback((filePath: string, conflictId: string, resolution: 'current' | 'incoming' | 'both' | 'custom') => {
    setConflictFiles(prev =>
      prev.map(file => {
        if (file.path !== filePath) return file;
        return {
          ...file,
          conflicts: file.conflicts.map(conflict => {
            if (conflict.id !== conflictId) return conflict;
            return { ...conflict, resolved: true, resolution };
          })
        };
      })
    );

    if (onResolve) {
      onResolve(filePath, conflictId, resolution);
    }
  }, [onResolve]);

  // Handle navigation
  const handleNavigate = useCallback((filePath: string, conflictId: string) => {
    const index = allConflicts.findIndex(
      item => item.file.path === filePath && item.conflict.id === conflictId
    );
    if (index !== -1) {
      setCurrentConflictIndex(index);
    }

    if (onNavigate) {
      onNavigate(filePath, conflictId);
    }
  }, [allConflicts, onNavigate]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'n' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        navigateConflict('next');
      }
      if (e.key === 'p' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        navigateConflict('prev');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigateConflict]);

  return (
    <div className={cn('flex flex-col h-full bg-[#1e1e1e]', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#3c3c3c]">
        <div className="flex items-center gap-3">
          <GitMerge className="h-4 w-4 text-purple-400" />
          <span className="text-sm font-medium">Merge Conflicts</span>
          {stats.unresolved > 0 && (
            <Badge variant="destructive" className="text-xs">
              {stats.unresolved} unresolved
            </Badge>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => navigateConflict('prev')}
            disabled={stats.unresolved === 0}
          >
            <ChevronUp className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => navigateConflict('next')}
            disabled={stats.unresolved === 0}
          >
            <ChevronDown className="h-3 w-3" />
          </Button>
          <span className="text-xs text-gray-400">
            {stats.resolved}/{stats.total}
          </span>
        </div>
      </div>

      {/* Summary */}
      {stats.unresolved > 0 && (
        <div className="flex items-center gap-4 px-4 py-2 bg-yellow-500/10 border-b border-yellow-500/20 text-xs text-yellow-400">
          <AlertTriangle className="h-3 w-3" />
          <span>
            {stats.unresolved} conflict{stats.unresolved !== 1 ? 's' : ''} remaining in {stats.filesWithConflicts} file{stats.filesWithConflicts !== 1 ? 's' : ''}
          </span>
          <span className="ml-auto text-gray-500">Ctrl+N / Ctrl+P to navigate</span>
        </div>
      )}

      {/* All resolved message */}
      {stats.unresolved === 0 && stats.total > 0 && (
        <div className="flex items-center gap-4 px-4 py-3 bg-green-500/10 border-b border-green-500/20 text-sm text-green-400">
          <CheckCircle2 className="h-4 w-4" />
          <span>All conflicts resolved! Ready to commit.</span>
        </div>
      )}

      {/* Files list */}
      <ScrollArea className="flex-1">
        {conflictFiles.length > 0 ? (
          conflictFiles.map(file => (
            <FileConflicts
              key={file.path}
              file={file}
              onResolve={(conflictId, resolution) => handleResolve(file.path, conflictId, resolution)}
              onNavigate={(conflictId) => handleNavigate(file.path, conflictId)}
            />
          ))
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 text-sm p-4">
            <CheckCircle2 className="h-8 w-8 mb-2 text-green-500" />
            <span>No merge conflicts detected</span>
          </div>
        )}
      </ScrollArea>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-[#3c3c3c] text-xs text-gray-400">
        <span>{stats.filesWithConflicts} file{stats.filesWithConflicts !== 1 ? 's' : ''} with conflicts</span>
        {stats.unresolved > 0 && (
          <Button variant="outline" size="sm" className="h-6 text-xs">
            Abort Merge
          </Button>
        )}
        {stats.unresolved === 0 && stats.total > 0 && (
          <Button variant="default" size="sm" className="h-6 text-xs">
            Commit Resolution
          </Button>
        )}
      </div>
    </div>
  );
};

export default MergeConflicts;
