'use client';

import React, { useState, useCallback, useMemo } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronRight,
  File,
  Filter,
  RefreshCw,
  Trash2,
  Search
} from 'lucide-react';

// Types
export interface Diagnostic {
  id: string;
  severity: 'error' | 'warning' | 'info' | 'hint';
  message: string;
  source: string;
  file: string;
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
  code?: string;
  relatedInformation?: {
    message: string;
    file: string;
    line: number;
    column: number;
  }[];
}

export interface ProblemsPanelProps {
  diagnostics?: Diagnostic[];
  onDiagnosticClick?: (diagnostic: Diagnostic) => void;
  onRefresh?: () => void;
  onClear?: () => void;
  className?: string;
}

// Severity colors and icons
const SEVERITY_CONFIG = {
  error: {
    icon: AlertCircle,
    color: 'text-red-400',
    bgColor: 'bg-red-400/10',
    label: 'Error'
  },
  warning: {
    icon: AlertTriangle,
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-400/10',
    label: 'Warning'
  },
  info: {
    icon: Info,
    color: 'text-blue-400',
    bgColor: 'bg-blue-400/10',
    label: 'Info'
  },
  hint: {
    icon: Info,
    color: 'text-gray-400',
    bgColor: 'bg-gray-400/10',
    label: 'Hint'
  }
};

// Diagnostic Item Component
interface DiagnosticItemProps {
  diagnostic: Diagnostic;
  onClick: () => void;
  isExpanded: boolean;
  onToggle: () => void;
}

const DiagnosticItem: React.FC<DiagnosticItemProps> = ({
  diagnostic,
  onClick,
  isExpanded,
  onToggle
}) => {
  const config = SEVERITY_CONFIG[diagnostic.severity];
  const Icon = config.icon;

  return (
    <div className="border-b border-[#3c3c3c] last:border-b-0">
      {/* Main Row */}
      <div
        className="flex items-start gap-2 px-3 py-2 hover:bg-[#2a2d2e] cursor-pointer"
        onClick={onClick}
      >
        <Icon size={16} className={`mt-0.5 shrink-0 ${config.color}`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-200 truncate">{diagnostic.message}</p>
          <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500">
            <span className="truncate">{diagnostic.source}</span>
            {diagnostic.code && (
              <span className="shrink-0">({diagnostic.code})</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 text-xs text-gray-500">
          <span className="truncate max-w-[150px]">{diagnostic.file.split('/').pop()}</span>
          <span>Ln {diagnostic.line}, Col {diagnostic.column}</span>
        </div>
      </div>

      {/* Related Information */}
      {diagnostic.relatedInformation && diagnostic.relatedInformation.length > 0 && (
        <div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
            className="flex items-center gap-1 px-3 py-1 text-xs text-gray-400 hover:text-gray-300"
          >
            {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            <span>{diagnostic.relatedInformation.length} related</span>
          </button>
          {isExpanded && (
            <div className="pl-8 pb-2">
              {diagnostic.relatedInformation.map((related, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 py-1 text-xs text-gray-400 hover:text-gray-300 cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    // Navigate to related location
                  }}
                >
                  <File size={12} />
                  <span className="truncate">{related.file.split('/').pop()}</span>
                  <span>Ln {related.line}, Col {related.column}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Main Problems Panel Component
export const ProblemsPanel: React.FC<ProblemsPanelProps> = ({
  diagnostics: controlledDiagnostics,
  onDiagnosticClick,
  onRefresh,
  onClear,
  className = '',
}) => {
  const [internalDiagnostics, setInternalDiagnostics] = useState<Diagnostic[]>([]);
  const [filter, setFilter] = useState<'all' | 'errors' | 'warnings'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [groupByFile, setGroupByFile] = useState(true);

  // Use controlled or internal state
  const diagnostics = controlledDiagnostics ?? internalDiagnostics;

  // Filter diagnostics
  const filteredDiagnostics = useMemo(() => {
    let filtered = diagnostics;

    // Filter by severity
    if (filter === 'errors') {
      filtered = filtered.filter((d) => d.severity === 'error');
    } else if (filter === 'warnings') {
      filtered = filtered.filter((d) => d.severity === 'warning');
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (d) =>
          d.message.toLowerCase().includes(query) ||
          d.file.toLowerCase().includes(query) ||
          d.source.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [diagnostics, filter, searchQuery]);

  // Group by file
  const groupedDiagnostics = useMemo(() => {
    if (!groupByFile) {
      return { ungrouped: filteredDiagnostics };
    }

    const groups: Record<string, Diagnostic[]> = {};
    filteredDiagnostics.forEach((d) => {
      const file = d.file;
      if (!groups[file]) {
        groups[file] = [];
      }
      groups[file].push(d);
    });

    return groups;
  }, [filteredDiagnostics, groupByFile]);

  // Counts
  const counts = useMemo(() => {
    return {
      total: diagnostics.length,
      errors: diagnostics.filter((d) => d.severity === 'error').length,
      warnings: diagnostics.filter((d) => d.severity === 'warning').length,
      info: diagnostics.filter((d) => d.severity === 'info').length,
    };
  }, [diagnostics]);

  // Toggle expanded
  const toggleExpanded = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  return (
    <div className={`flex flex-col h-full bg-[#1e1e1e] ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#3c3c3c]">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
            Problems
          </span>
          <div className="flex items-center gap-1">
            <span className={`flex items-center gap-1 text-xs ${counts.errors > 0 ? 'text-red-400' : 'text-gray-500'}`}>
              <AlertCircle size={12} />
              {counts.errors}
            </span>
            <span className={`flex items-center gap-1 text-xs ${counts.warnings > 0 ? 'text-yellow-400' : 'text-gray-500'}`}>
              <AlertTriangle size={12} />
              {counts.warnings}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setGroupByFile(!groupByFile)}
            className={`p-1 rounded ${groupByFile ? 'text-white bg-[#3c3c3c]' : 'text-gray-400 hover:text-gray-200'}`}
            title={groupByFile ? 'Ungroup' : 'Group by file'}
          >
            <File size={14} />
          </button>
          <button
            onClick={onRefresh}
            className="p-1 text-gray-400 hover:text-gray-200 hover:bg-[#3c3c3c] rounded"
            title="Refresh"
          >
            <RefreshCw size={14} />
          </button>
          <button
            onClick={onClear}
            className="p-1 text-gray-400 hover:text-gray-200 hover:bg-[#3c3c3c] rounded"
            title="Clear all"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-[#3c3c3c]">
        {/* Search */}
        <div className="flex-1 flex items-center bg-[#2d2d2d] rounded px-2 py-1">
          <Search size={12} className="text-gray-500" />
          <input
            type="text"
            placeholder="Filter problems..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent border-none outline-none text-xs text-gray-200 placeholder-gray-500 px-2"
          />
        </div>

        {/* Filter Buttons */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setFilter('all')}
            className={`px-2 py-0.5 text-xs rounded ${filter === 'all' ? 'bg-[#3c3c3c] text-white' : 'text-gray-400 hover:text-gray-200'}`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('errors')}
            className={`px-2 py-0.5 text-xs rounded ${filter === 'errors' ? 'bg-red-500/20 text-red-400' : 'text-gray-400 hover:text-gray-200'}`}
          >
            Errors
          </button>
          <button
            onClick={() => setFilter('warnings')}
            className={`px-2 py-0.5 text-xs rounded ${filter === 'warnings' ? 'bg-yellow-500/20 text-yellow-400' : 'text-gray-400 hover:text-gray-200'}`}
          >
            Warnings
          </button>
        </div>
      </div>

      {/* Problems List */}
      <div className="flex-1 overflow-y-auto">
        {Object.keys(groupedDiagnostics).length > 0 ? (
          Object.entries(groupedDiagnostics).map(([file, diags]) => (
            <div key={file}>
              {groupByFile && (
                <div className="flex items-center gap-2 px-3 py-1 bg-[#252526] text-xs text-gray-400 sticky top-0 z-10">
                  <File size={12} />
                  <span className="truncate">{file}</span>
                  <span className="text-gray-500">({diags.length})</span>
                </div>
              )}
              {diags.map((diagnostic) => (
                <DiagnosticItem
                  key={diagnostic.id}
                  diagnostic={diagnostic}
                  onClick={() => onDiagnosticClick?.(diagnostic)}
                  isExpanded={expandedIds.has(diagnostic.id)}
                  onToggle={() => toggleExpanded(diagnostic.id)}
                />
              ))}
            </div>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <AlertCircle size={24} className="mb-2 opacity-50" />
            <span className="text-sm">No problems detected</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProblemsPanel;
