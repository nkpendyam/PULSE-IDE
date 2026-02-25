'use client';

import React, { useState, useEffect } from 'react';
import { useExtendedKyroStore, Extension } from '@/store/extendedStore';
import { Search, Download, Trash2, ToggleLeft, ToggleRight, Star, RefreshCw } from 'lucide-react';

export function ExtensionMarketplace() {
  const {
    installedExtensions,
    availableExtensions,
    extensionLoading,
    fetchExtensions,
    searchExtensions,
    installExtension,
    uninstallExtension,
    toggleExtension,
  } = useExtendedKyroStore();

  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'installed' | 'search'>('installed');

  useEffect(() => {
    fetchExtensions();
  }, [fetchExtensions]);

  const handleSearch = async () => {
    if (query.trim()) {
      await searchExtensions(query);
    }
  };

  const handleInstall = async (extensionId: string) => {
    await installExtension(extensionId);
  };

  const handleUninstall = async (extensionId: string) => {
    if (confirm('Uninstall this extension?')) {
      await uninstallExtension(extensionId);
    }
  };

  const handleToggle = async (extensionId: string, enabled: boolean) => {
    await toggleExtension(extensionId, enabled);
  };

  return (
    <div className="h-full flex flex-col bg-[#0d1117]">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#30363d]">
        <h3 className="text-[#c9d1d9] font-medium mb-3">Extensions</h3>

        {/* Tabs */}
        <div className="flex gap-2 mb-3">
          <button
            onClick={() => setActiveTab('installed')}
            className={`px-3 py-1 text-sm rounded ${
              activeTab === 'installed'
                ? 'bg-[#21262d] text-[#c9d1d9]'
                : 'text-[#8b949e] hover:text-[#c9d1d9]'
            }`}
          >
            Installed ({installedExtensions.length})
          </button>
          <button
            onClick={() => setActiveTab('search')}
            className={`px-3 py-1 text-sm rounded ${
              activeTab === 'search'
                ? 'bg-[#21262d] text-[#c9d1d9]'
                : 'text-[#8b949e] hover:text-[#c9d1d9]'
            }`}
          >
            Marketplace
          </button>
        </div>

        {/* Search */}
        {activeTab === 'search' && (
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8b949e]" size={16} />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Search extensions..."
                className="w-full bg-[#161b22] border border-[#30363d] rounded pl-9 pr-3 py-2 text-sm text-[#c9d1d9] focus:outline-none focus:border-[#58a6ff]"
              />
            </div>
            <button
              onClick={handleSearch}
              className="px-4 py-2 bg-[#238636] hover:bg-[#2ea043] text-white text-sm rounded"
            >
              Search
            </button>
          </div>
        )}
      </div>

      {/* Extension List */}
      <div className="flex-1 overflow-y-auto p-4">
        {extensionLoading ? (
          <div className="flex items-center justify-center h-full">
            <RefreshCw className="animate-spin text-[#8b949e]" size={24} />
          </div>
        ) : (
          <div className="space-y-3">
            {(activeTab === 'installed' ? installedExtensions : availableExtensions).map((ext) => (
              <ExtensionCard
                key={ext.id}
                extension={ext}
                isInstalled={installedExtensions.some((e) => e.id === ext.id)}
                onInstall={handleInstall}
                onUninstall={handleUninstall}
                onToggle={handleToggle}
              />
            ))}
            {(activeTab === 'installed' ? installedExtensions : availableExtensions).length === 0 && (
              <p className="text-center text-[#8b949e] py-8">
                {activeTab === 'installed'
                  ? 'No extensions installed. Search the marketplace to add some!'
                  : 'Search for extensions to install'}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

interface ExtensionCardProps {
  extension: Extension;
  isInstalled: boolean;
  onInstall: (id: string) => void;
  onUninstall: (id: string) => void;
  onToggle: (id: string, enabled: boolean) => void;
}

function ExtensionCard({ extension, isInstalled, onInstall, onUninstall, onToggle }: ExtensionCardProps) {
  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded p-4 hover:border-[#30363d]">
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="w-12 h-12 bg-[#21262d] rounded flex items-center justify-center text-[#58a6ff] text-lg font-bold">
          {extension.display_name.charAt(0).toUpperCase()}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-[#c9d1d9] font-medium truncate">{extension.display_name}</h4>
            {extension.rating !== undefined && (
              <div className="flex items-center gap-1 text-xs text-[#8b949e]">
                <Star size={12} className="fill-[#f0883e] text-[#f0883e]" />
                {extension.rating.toFixed(1)}
              </div>
            )}
          </div>
          <p className="text-xs text-[#8b949e] mb-1">{extension.publisher}</p>
          <p className="text-sm text-[#8b949e] line-clamp-2">{extension.description}</p>

          {/* Stats */}
          <div className="flex items-center gap-4 mt-2 text-xs text-[#8b949e]">
            <span>v{extension.version}</span>
            {extension.download_count !== undefined && (
              <span>{(extension.download_count / 1000).toFixed(1)}K downloads</span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {isInstalled ? (
            <>
              <button
                onClick={() => onToggle(extension.id, !extension.enabled)}
                className="p-2 hover:bg-[#21262d] rounded"
                title={extension.enabled ? 'Disable' : 'Enable'}
              >
                {extension.enabled ? (
                  <ToggleRight size={20} className="text-[#3fb950]" />
                ) : (
                  <ToggleLeft size={20} className="text-[#8b949e]" />
                )}
              </button>
              <button
                onClick={() => onUninstall(extension.id)}
                className="p-2 hover:bg-[#21262d] rounded"
                title="Uninstall"
              >
                <Trash2 size={18} className="text-[#f85149]" />
              </button>
            </>
          ) : (
            <button
              onClick={() => onInstall(extension.id)}
              className="flex items-center gap-1 px-3 py-1.5 bg-[#238636] hover:bg-[#2ea043] text-white text-sm rounded"
            >
              <Download size={16} />
              Install
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
