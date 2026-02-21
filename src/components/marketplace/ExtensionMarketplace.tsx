'use client';

import React, { useState, useCallback } from 'react';
import {
  Search,
  Star,
  Download,
  Check,
  RefreshCw,
  Package,
  Clock,
  Loader2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

// ============================================================================
// TYPES
// ============================================================================

interface ExtensionInfo {
  id: string;
  name: string;
  displayName: string;
  description: string;
  publisher: { name: string; verified: boolean };
  version: string;
  icon?: string;
  categories: string[];
  tags: string[];
  downloads: number;
  rating: number;
  ratingCount: number;
  installed: boolean;
  installedVersion?: string;
  lastUpdated: string;
  license?: string;
}

// ============================================================================
// SAMPLE EXTENSIONS
// ============================================================================

const SAMPLE_EXTENSIONS: ExtensionInfo[] = [
  {
    id: 'kyro.python',
    name: 'python',
    displayName: 'Python',
    description: 'IntelliSense, linting, debugging, formatting, refactoring, and more for Python.',
    publisher: { name: 'Kyro', verified: true },
    version: '2024.1.0',
    categories: ['Programming Languages', 'Debuggers'],
    tags: ['python', 'linting', 'debugging'],
    downloads: 2500000,
    rating: 4.8,
    ratingCount: 1250,
    installed: false,
    lastUpdated: '2024-01-15',
    license: 'MIT',
  },
  {
    id: 'kyro.rust',
    name: 'rust',
    displayName: 'Rust',
    description: 'Rust language support with rust-analyzer, debugging, and more.',
    publisher: { name: 'Kyro', verified: true },
    version: '2024.1.0',
    categories: ['Programming Languages', 'Debuggers'],
    tags: ['rust', 'cargo', 'debugging'],
    downloads: 1200000,
    rating: 4.9,
    ratingCount: 890,
    installed: false,
    lastUpdated: '2024-01-14',
    license: 'MIT',
  },
  {
    id: 'kyro.gitlens',
    name: 'gitlens',
    displayName: 'GitLens',
    description: 'Supercharge Git with powerful features: blame annotations, code lens, file history.',
    publisher: { name: 'Kyro', verified: true },
    version: '2024.1.0',
    categories: ['SCM Providers'],
    tags: ['git', 'blame', 'history'],
    downloads: 3500000,
    rating: 4.7,
    ratingCount: 2100,
    installed: true,
    installedVersion: '2024.1.0',
    lastUpdated: '2024-01-16',
    license: 'MIT',
  },
  {
    id: 'kyro.copilot',
    name: 'copilot',
    displayName: 'GitHub Copilot',
    description: 'AI-powered code suggestions directly in your editor.',
    publisher: { name: 'GitHub', verified: true },
    version: '2024.1.0',
    categories: ['Programming Languages'],
    tags: ['ai', 'autocomplete', 'github'],
    downloads: 5000000,
    rating: 4.6,
    ratingCount: 3200,
    installed: false,
    lastUpdated: '2024-01-17',
    license: 'Proprietary',
  },
];

const CATEGORIES = [
  { id: 'all', name: 'All' },
  { id: 'programming-languages', name: 'Languages' },
  { id: 'debuggers', name: 'Debuggers' },
  { id: 'scm-providers', name: 'Source Control' },
  { id: 'themes', name: 'Themes' },
];

// ============================================================================
// EXTENSION CARD
// ============================================================================

const ExtensionCard: React.FC<{
  extension: ExtensionInfo;
  onInstall: (id: string) => void;
  onUninstall: (id: string) => void;
}> = ({ extension, onInstall, onUninstall }) => {
  const [installing, setInstalling] = useState(false);

  const handleInstall = async () => {
    setInstalling(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    onInstall(extension.id);
    setInstalling(false);
  };

  const handleUninstall = async () => {
    setInstalling(true);
    await new Promise(resolve => setTimeout(resolve, 500));
    onUninstall(extension.id);
    setInstalling(false);
  };

  const formatDownloads = (count: number) => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  return (
    <div className="p-4 border border-[#3c3c3c] rounded-lg hover:border-[#007acc] transition-colors">
      <div className="flex gap-4">
        <div className="w-14 h-14 bg-[#2d2d2d] rounded-lg flex items-center justify-center shrink-0">
          <Package className="w-7 h-7 text-gray-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-medium text-white truncate">{extension.displayName}</h3>
              <p className="text-sm text-gray-400 flex items-center gap-1">
                {extension.publisher.name}
                {extension.publisher.verified && (
                  <Badge variant="secondary" className="text-[10px] px-1 py-0">Verified</Badge>
                )}
              </p>
            </div>
            {extension.installed ? (
              <Button variant="outline" size="sm" className="text-green-400 border-green-400/50" onClick={handleUninstall} disabled={installing}>
                {installing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                <span className="ml-1">Installed</span>
              </Button>
            ) : (
              <Button size="sm" onClick={handleInstall} disabled={installing}>
                {installing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                <span className="ml-1">Install</span>
              </Button>
            )}
          </div>
          <p className="text-sm text-gray-300 mt-2 line-clamp-2">{extension.description}</p>
          <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
            <span className="flex items-center gap-1"><Download className="w-3 h-3" />{formatDownloads(extension.downloads)}</span>
            <span className="flex items-center gap-1"><Star className="w-3 h-3 text-yellow-500" />{extension.rating.toFixed(1)}</span>
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{extension.lastUpdated}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// MARKETPLACE PANEL
// ============================================================================

export const ExtensionMarketplace: React.FC = () => {
  const [extensions, setExtensions] = useState<ExtensionInfo[]>(SAMPLE_EXTENSIONS);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const handleInstall = useCallback((id: string) => {
    setExtensions(prev => prev.map(ext => ext.id === id ? { ...ext, installed: true } : ext));
  }, []);

  const handleUninstall = useCallback((id: string) => {
    setExtensions(prev => prev.map(ext => ext.id === id ? { ...ext, installed: false } : ext));
  }, []);

  const filteredExtensions = extensions.filter(ext => {
    if (selectedCategory !== 'all') {
      const categoryMatch = ext.categories.some(c => c.toLowerCase().replace(' ', '-') === selectedCategory);
      if (!categoryMatch) return false;
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return ext.displayName.toLowerCase().includes(query) || ext.description.toLowerCase().includes(query);
    }
    return true;
  });

  const installedCount = extensions.filter(e => e.installed).length;

  return (
    <div className="h-full flex flex-col bg-[#1e1e1e]">
      <div className="px-4 py-3 border-b border-[#3c3c3c]">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <Package className="w-5 h-5" /> Extension Marketplace
        </h2>
        <p className="text-sm text-gray-400 mt-1">{installedCount} extension{installedCount !== 1 ? 's' : ''} installed</p>
      </div>

      <div className="px-4 py-3 border-b border-[#3c3c3c] space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search extensions..." className="pl-10 bg-[#2d2d2d] border-[#3c3c3c]" />
        </div>
        <div className="flex gap-1 overflow-x-auto pb-1">
          {CATEGORIES.map(cat => (
            <button key={cat.id} onClick={() => setSelectedCategory(cat.id)} className={cn('px-3 py-1 text-xs rounded-full whitespace-nowrap transition-colors', selectedCategory === cat.id ? 'bg-[#007acc] text-white' : 'bg-[#2d2d2d] text-gray-400 hover:text-white')}>
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          {filteredExtensions.map(extension => (
            <ExtensionCard key={extension.id} extension={extension} onInstall={handleInstall} onUninstall={handleUninstall} />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};

export default ExtensionMarketplace;
