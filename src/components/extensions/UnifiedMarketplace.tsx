'use client';

/**
 * Unified Extension Marketplace Component
 * 
 * Combines VS Code Marketplace and Open VSX Registry for extension discovery.
 * Supports search, browse, install, and manage extensions.
 * 
 * Based on:
 * - https://github.com/eclipse/openvsx
 * - https://marketplace.visualstudio.com
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { 
  Search, Download, Trash2, RefreshCw, ChevronDown, Star, 
  Clock, ExternalLink, Check, AlertCircle, Filter, Grid, List,
  Puzzle, Settings, Power
} from 'lucide-react';

// Extension type
interface Extension {
  id: string;
  name: string;
  displayName: string;
  publisher: string;
  description: string;
  version: string;
  iconUrl?: string;
  downloadCount: number;
  averageRating?: number;
  ratingCount: number;
  categories: string[];
  tags: string[];
  repository?: string;
  license?: string;
  installed: boolean;
  enabled: boolean;
  source: 'vscode' | 'openvsx';
}

// Filter state
interface FilterState {
  category: string;
  source: 'all' | 'vscode' | 'openvsx';
  sortBy: 'downloads' | 'rating' | 'updated' | 'name';
  installed: boolean;
}

const CATEGORIES = [
  'All',
  'Programming Languages',
  'Debuggers',
  'Snippets',
  'Linters',
  'Formatters',
  'Themes',
  'Keymaps',
  'Language Packs',
  'Other',
];

export function ExtensionMarketplace() {
  const [extensions, setExtensions] = useState<Extension[]>([]);
  const [installedExtensions, setInstalledExtensions] = useState<Extension[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'browse' | 'installed'>('browse');
  const [filters, setFilters] = useState<FilterState>({
    category: 'All',
    source: 'all',
    sortBy: 'downloads',
    installed: false,
  });
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedExtension, setSelectedExtension] = useState<Extension | null>(null);
  const [installProgress, setInstallProgress] = useState<string | null>(null);

  // Load installed extensions
  useEffect(() => {
    loadInstalledExtensions();
  }, []);

  // Load installed extensions
  const loadInstalledExtensions = async () => {
    try {
      const installed = await invoke<Extension[]>('list_installed_extensions');
      setInstalledExtensions(installed);
    } catch (error) {
      console.error('Failed to load installed extensions:', error);
    }
  };

  // Search extensions
  const searchExtensions = useCallback(async () => {
    if (!searchQuery.trim() && filters.category === 'All') {
      // Load popular extensions
      await loadPopularExtensions();
      return;
    }

    setIsLoading(true);
    try {
      const results = await invoke<Extension[]>('search_extensions_unified', {
        query: searchQuery,
        category: filters.category === 'All' ? null : filters.category,
        source: filters.source,
        sortBy: filters.sortBy,
        limit: 50,
      });

      // Mark installed
      const installedIds = new Set(installedExtensions.map(e => e.id));
      const withInstallStatus = results.map(ext => ({
        ...ext,
        installed: installedIds.has(ext.id),
        enabled: true,
      }));

      setExtensions(withInstallStatus);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, filters, installedExtensions]);

  // Load popular extensions
  const loadPopularExtensions = async () => {
    setIsLoading(true);
    try {
      const [vscodeResults, openvsxResults] = await Promise.all([
        invoke<Extension[]>('get_popular_extensions', { count: 25 }),
        invoke<Extension[]>('get_openvsx_popular', { count: 25 }),
      ]);

      const allExtensions = [
        ...vscodeResults.map(e => ({ ...e, source: 'vscode' as const })),
        ...openvsxResults.map(e => ({ ...e, source: 'openvsx' as const })),
      ];

      // Sort by downloads
      allExtensions.sort((a, b) => b.downloadCount - a.downloadCount);

      // Mark installed
      const installedIds = new Set(installedExtensions.map(e => e.id));
      const withInstallStatus = allExtensions.map(ext => ({
        ...ext,
        installed: installedIds.has(ext.id),
        enabled: true,
      }));

      setExtensions(withInstallStatus.slice(0, 50));
    } catch (error) {
      console.error('Failed to load popular extensions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Install extension
  const installExtension = async (extension: Extension) => {
    setInstallProgress(extension.id);
    try {
      await invoke('install_extension_unified', {
        publisher: extension.publisher,
        name: extension.name,
        version: extension.version,
        source: extension.source,
      });

      // Update state
      setExtensions(prev => prev.map(e => 
        e.id === extension.id ? { ...e, installed: true } : e
      ));
      setInstalledExtensions(prev => [...prev, { ...extension, installed: true }]);
    } catch (error) {
      console.error('Install failed:', error);
    } finally {
      setInstallProgress(null);
    }
  };

  // Uninstall extension
  const uninstallExtension = async (extension: Extension) => {
    try {
      await invoke('uninstall_extension', {
        extensionId: extension.id,
      });

      setExtensions(prev => prev.map(e => 
        e.id === extension.id ? { ...e, installed: false } : e
      ));
      setInstalledExtensions(prev => prev.filter(e => e.id !== extension.id));
    } catch (error) {
      console.error('Uninstall failed:', error);
    }
  };

  // Enable/disable extension
  const toggleExtension = async (extension: Extension) => {
    try {
      if (extension.enabled) {
        await invoke('disable_extension', { extensionId: extension.id });
      } else {
        await invoke('enable_extension', { extensionId: extension.id });
      }

      const updateFn = (prev: Extension[]) => prev.map(e =>
        e.id === extension.id ? { ...e, enabled: !e.enabled } : e
      );

      setExtensions(updateFn);
      setInstalledExtensions(updateFn);
    } catch (error) {
      console.error('Toggle failed:', error);
    }
  };

  // Format download count
  const formatDownloads = (count: number) => {
    if (count >= 1_000_000) {
      return `${(count / 1_000_000).toFixed(1)}M`;
    } else if (count >= 1_000) {
      return `${(count / 1_000).toFixed(1)}K`;
    }
    return count.toString();
  };

  // Filtered extensions
  const displayedExtensions = useMemo(() => {
    if (activeTab === 'installed') {
      return installedExtensions.filter(e => 
        !searchQuery || 
        e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.displayName.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    let result = extensions;

    if (filters.installed) {
      result = result.filter(e => e.installed);
    }

    return result;
  }, [activeTab, extensions, installedExtensions, searchQuery, filters]);

  // Run search on mount and filter change
  useEffect(() => {
    if (activeTab === 'browse') {
      searchExtensions();
    }
  }, [activeTab, filters.category, filters.source, filters.sortBy]);

  return (
    <div className="h-full flex flex-col bg-[#0d1117]">
      {/* Header */}
      <div className="p-3 border-b border-[#30363d]">
        <div className="flex items-center gap-2">
          <Puzzle size={18} className="text-[#a371f7]" />
          <h2 className="font-semibold text-[#c9d1d9]">Extensions</h2>
        </div>

        {/* Search */}
        <div className="relative mt-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8b949e]" size={16} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && searchExtensions()}
            placeholder="Search extensions..."
            className="w-full pl-9 pr-4 py-2 bg-[#161b22] border border-[#30363d] rounded-md text-sm text-[#c9d1d9] placeholder-[#8b949e] focus:outline-none focus:border-[#58a6ff]"
          />
        </div>

        {/* Tabs */}
        <div className="flex mt-3 border-b border-[#30363d]">
          {(['browse', 'installed'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-[#58a6ff] text-[#58a6ff]'
                  : 'border-transparent text-[#8b949e] hover:text-[#c9d1d9]'
              }`}
            >
              {tab === 'browse' ? 'Browse' : `Installed (${installedExtensions.length})`}
            </button>
          ))}
        </div>

        {/* Filters */}
        {activeTab === 'browse' && (
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <select
              value={filters.category}
              onChange={(e) => setFilters(f => ({ ...f, category: e.target.value }))}
              className="px-2 py-1 bg-[#161b22] border border-[#30363d] rounded text-sm text-[#c9d1d9]"
            >
              {CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>

            <select
              value={filters.source}
              onChange={(e) => setFilters(f => ({ ...f, source: e.target.value as any }))}
              className="px-2 py-1 bg-[#161b22] border border-[#30363d] rounded text-sm text-[#c9d1d9]"
            >
              <option value="all">All Sources</option>
              <option value="vscode">VS Code</option>
              <option value="openvsx">Open VSX</option>
            </select>

            <select
              value={filters.sortBy}
              onChange={(e) => setFilters(f => ({ ...f, sortBy: e.target.value as any }))}
              className="px-2 py-1 bg-[#161b22] border border-[#30363d] rounded text-sm text-[#c9d1d9]"
            >
              <option value="downloads">Downloads</option>
              <option value="rating">Rating</option>
              <option value="updated">Recently Updated</option>
              <option value="name">Name</option>
            </select>

            <div className="flex-1" />

            <button
              onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
              className="p-1 text-[#8b949e] hover:text-[#c9d1d9]"
            >
              {viewMode === 'grid' ? <List size={18} /> : <Grid size={18} />}
            </button>
          </div>
        )}
      </div>

      {/* Extension List */}
      <div className="flex-1 overflow-auto p-3">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#58a6ff]" />
          </div>
        ) : displayedExtensions.length === 0 ? (
          <div className="text-center text-[#8b949e] py-8">
            {activeTab === 'installed' 
              ? 'No extensions installed yet' 
              : 'No extensions found'}
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-2 gap-3">
            {displayedExtensions.map(ext => (
              <ExtensionCard
                key={ext.id}
                extension={ext}
                onInstall={installExtension}
                onUninstall={uninstallExtension}
                onToggle={toggleExtension}
                isInstalling={installProgress === ext.id}
                onSelect={() => setSelectedExtension(ext)}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {displayedExtensions.map(ext => (
              <ExtensionListItem
                key={ext.id}
                extension={ext}
                onInstall={installExtension}
                onUninstall={uninstallExtension}
                onToggle={toggleExtension}
                isInstalling={installProgress === ext.id}
                onSelect={() => setSelectedExtension(ext)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Extension Detail Modal */}
      {selectedExtension && (
        <ExtensionDetailModal
          extension={selectedExtension}
          onClose={() => setSelectedExtension(null)}
          onInstall={installExtension}
          onUninstall={uninstallExtension}
          onToggle={toggleExtension}
          isInstalling={installProgress === selectedExtension.id}
        />
      )}
    </div>
  );
}

// Extension Card Component
function ExtensionCard({
  extension,
  onInstall,
  onUninstall,
  onToggle,
  isInstalling,
  onSelect,
}: {
  extension: Extension;
  onInstall: (ext: Extension) => void;
  onUninstall: (ext: Extension) => void;
  onToggle: (ext: Extension) => void;
  isInstalling: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      className="p-3 bg-[#161b22] border border-[#30363d] rounded-lg hover:border-[#484f58] cursor-pointer"
      onClick={onSelect}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="w-12 h-12 rounded bg-[#21262d] flex items-center justify-center overflow-hidden flex-shrink-0">
          {extension.iconUrl ? (
            <img src={extension.iconUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <Puzzle size={24} className="text-[#8b949e]" />
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-[#c9d1d9] truncate">{extension.displayName}</h3>
            {extension.source === 'openvsx' && (
              <span className="text-xs px-1 bg-[#238636] text-white rounded">Open VSX</span>
            )}
          </div>
          <p className="text-xs text-[#8b949e] truncate">{extension.publisher}</p>
          <p className="text-xs text-[#8b949e] mt-1 line-clamp-2">{extension.description}</p>

          {/* Stats */}
          <div className="flex items-center gap-3 mt-2 text-xs text-[#8b949e]">
            <span>{formatDownloads(extension.downloadCount)} downloads</span>
            {extension.averageRating && (
              <span className="flex items-center gap-1">
                <Star size={12} className="text-[#d29922]" fill="#d29922" />
                {extension.averageRating.toFixed(1)}
              </span>
            )}
          </div>

          {/* Action */}
          <div className="mt-2">
            {extension.installed ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => { e.stopPropagation(); onToggle(extension); }}
                  className={`px-2 py-1 rounded text-xs ${
                    extension.enabled
                      ? 'bg-[#21262d] text-[#8b949e]'
                      : 'bg-[#238636] text-white'
                  }`}
                >
                  {extension.enabled ? 'Disable' : 'Enable'}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onUninstall(extension); }}
                  className="px-2 py-1 bg-[#da3633] text-white rounded text-xs"
                >
                  Uninstall
                </button>
              </div>
            ) : (
              <button
                onClick={(e) => { e.stopPropagation(); onInstall(extension); }}
                disabled={isInstalling}
                className="px-3 py-1 bg-[#238636] hover:bg-[#2ea043] text-white rounded text-xs flex items-center gap-1"
              >
                {isInstalling ? (
                  <>
                    <RefreshCw size={12} className="animate-spin" />
                    Installing...
                  </>
                ) : (
                  <>
                    <Download size={12} />
                    Install
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Extension List Item Component
function ExtensionListItem({
  extension,
  onInstall,
  onUninstall,
  onToggle,
  isInstalling,
  onSelect,
}: {
  extension: Extension;
  onInstall: (ext: Extension) => void;
  onUninstall: (ext: Extension) => void;
  onToggle: (ext: Extension) => void;
  isInstalling: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      className="flex items-center gap-3 p-3 bg-[#161b22] border border-[#30363d] rounded hover:border-[#484f58] cursor-pointer"
      onClick={onSelect}
    >
      {/* Icon */}
      <div className="w-10 h-10 rounded bg-[#21262d] flex items-center justify-center overflow-hidden flex-shrink-0">
        {extension.iconUrl ? (
          <img src={extension.iconUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <Puzzle size={20} className="text-[#8b949e]" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-medium text-[#c9d1d9] truncate">{extension.displayName}</h3>
          <span className="text-xs text-[#8b949e]">{extension.version}</span>
          {extension.source === 'openvsx' && (
            <span className="text-xs px-1 bg-[#238636] text-white rounded">Open VSX</span>
          )}
        </div>
        <p className="text-xs text-[#8b949e] truncate">{extension.description}</p>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 text-xs text-[#8b949e]">
        <span>{formatDownloads(extension.downloadCount)}</span>
        {extension.averageRating && (
          <span className="flex items-center gap-1">
            <Star size={12} className="text-[#d29922]" fill="#d29922" />
            {extension.averageRating.toFixed(1)}
          </span>
        )}
      </div>

      {/* Action */}
      <div className="flex items-center gap-2">
        {extension.installed ? (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); onToggle(extension); }}
              className={`p-1.5 rounded ${
                extension.enabled
                  ? 'bg-[#21262d] text-[#8b949e]'
                  : 'bg-[#238636] text-white'
              }`}
              title={extension.enabled ? 'Disable' : 'Enable'}
            >
              <Power size={14} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onUninstall(extension); }}
              className="p-1.5 bg-[#da3633] text-white rounded"
              title="Uninstall"
            >
              <Trash2 size={14} />
            </button>
          </>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); onInstall(extension); }}
            disabled={isInstalling}
            className="px-3 py-1.5 bg-[#238636] hover:bg-[#2ea043] text-white rounded text-xs flex items-center gap-1"
          >
            {isInstalling ? (
              <RefreshCw size={14} className="animate-spin" />
            ) : (
              <Download size={14} />
            )}
          </button>
        )}
      </div>
    </div>
  );
}

// Extension Detail Modal
function ExtensionDetailModal({
  extension,
  onClose,
  onInstall,
  onUninstall,
  onToggle,
  isInstalling,
}: {
  extension: Extension;
  onClose: () => void;
  onInstall: (ext: Extension) => void;
  onUninstall: (ext: Extension) => void;
  onToggle: (ext: Extension) => void;
  isInstalling: boolean;
}) {
  const [readme, setReadme] = useState<string>('');
  const [isLoadingReadme, setIsLoadingReadme] = useState(false);

  useEffect(() => {
    const loadReadme = async () => {
      setIsLoadingReadme(true);
      try {
        const content = await invoke<string>('get_extension_readme', {
          publisher: extension.publisher,
          name: extension.name,
          source: extension.source,
        });
        setReadme(content || 'No readme available.');
      } catch {
        setReadme('No readme available.');
      } finally {
        setIsLoadingReadme(false);
      }
    };

    loadReadme();
  }, [extension]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-[#161b22] border border-[#30363d] rounded-lg w-[800px] max-h-[80vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-[#30363d] flex items-start gap-4">
          <div className="w-16 h-16 rounded bg-[#21262d] flex items-center justify-center overflow-hidden">
            {extension.iconUrl ? (
              <img src={extension.iconUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <Puzzle size={32} className="text-[#8b949e]" />
            )}
          </div>

          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-[#c9d1d9]">{extension.displayName}</h2>
              {extension.source === 'openvsx' && (
                <span className="text-xs px-2 py-0.5 bg-[#238636] text-white rounded">Open VSX</span>
              )}
            </div>
            <p className="text-sm text-[#8b949e]">{extension.publisher} • v{extension.version}</p>
            <p className="text-sm text-[#8b949e] mt-1">{extension.description}</p>

            <div className="flex items-center gap-4 mt-2 text-xs text-[#8b949e]">
              <span>{formatDownloads(extension.downloadCount)} downloads</span>
              {extension.averageRating && (
                <span className="flex items-center gap-1">
                  <Star size={14} className="text-[#d29922]" fill="#d29922" />
                  {extension.averageRating.toFixed(1)} ({extension.ratingCount} reviews)
                </span>
              )}
              {extension.repository && (
                <a
                  href={extension.repository}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 hover:text-[#58a6ff]"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLink size={14} />
                  Repository
                </a>
              )}
            </div>
          </div>

          <button onClick={onClose} className="text-[#8b949e] hover:text-[#c9d1d9]">
            ✕
          </button>
        </div>

        {/* Actions */}
        <div className="px-4 py-2 border-b border-[#30363d] flex items-center gap-2">
          {extension.installed ? (
            <>
              <button
                onClick={() => { onToggle(extension); onClose(); }}
                className={`px-4 py-2 rounded text-sm ${
                  extension.enabled
                    ? 'bg-[#21262d] text-[#c9d1d9]'
                    : 'bg-[#238636] text-white'
                }`}
              >
                {extension.enabled ? 'Disable' : 'Enable'}
              </button>
              <button
                onClick={() => { onUninstall(extension); onClose(); }}
                className="px-4 py-2 bg-[#da3633] text-white rounded text-sm"
              >
                Uninstall
              </button>
              <span className="ml-2 text-sm text-[#3fb950] flex items-center gap-1">
                <Check size={16} />
                Installed
              </span>
            </>
          ) : (
            <button
              onClick={() => { onInstall(extension); onClose(); }}
              disabled={isInstalling}
              className="px-4 py-2 bg-[#238636] hover:bg-[#2ea043] text-white rounded text-sm flex items-center gap-2"
            >
              {isInstalling ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  Installing...
                </>
              ) : (
                <>
                  <Download size={16} />
                  Install
                </>
              )}
            </button>
          )}
        </div>

        {/* Tags & Categories */}
        {(extension.categories.length > 0 || extension.tags.length > 0) && (
          <div className="px-4 py-2 border-b border-[#30363d] flex flex-wrap gap-2">
            {extension.categories.map(cat => (
              <span key={cat} className="px-2 py-1 bg-[#21262d] text-[#8b949e] rounded text-xs">
                {cat}
              </span>
            ))}
            {extension.tags.slice(0, 5).map(tag => (
              <span key={tag} className="px-2 py-1 bg-[#21262d] text-[#8b949e] rounded text-xs">
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* Readme */}
        <div className="p-4 overflow-auto max-h-[400px]">
          {isLoadingReadme ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="animate-spin text-[#8b949e]" size={24} />
            </div>
          ) : (
            <div className="prose prose-invert prose-sm max-w-none text-[#c9d1d9]">
              <pre className="whitespace-pre-wrap text-sm">{readme}</pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ExtensionMarketplace;
