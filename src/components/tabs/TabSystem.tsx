'use client';

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { X, Pin, File, GripVertical, ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// Types
export interface Tab {
  id: string;
  title: string;
  path: string;
  icon?: string;
  isDirty?: boolean;
  isPinned?: boolean;
  preview?: boolean;
  language?: string;
}

export interface TabSystemProps {
  tabs?: Tab[];
  activeTabId?: string;
  onTabSelect?: (tabId: string) => void;
  onTabClose?: (tabId: string) => void;
  onTabReorder?: (tabs: Tab[]) => void;
  onTabPin?: (tabId: string) => void;
  onTabSplit?: (tabId: string, direction: 'left' | 'right') => void;
  onTabsClose?: (tabIds: string[]) => void;
  maxVisibleTabs?: number;
  className?: string;
}

// File icon mapping with colors matching VS Code
const FILE_ICONS: Record<string, { icon: string; color: string; bgColor?: string }> = {
  ts: { icon: 'TS', color: 'text-blue-400', bgColor: 'bg-blue-500/20' },
  tsx: { icon: 'TSX', color: 'text-blue-400', bgColor: 'bg-blue-500/20' },
  js: { icon: 'JS', color: 'text-yellow-400', bgColor: 'bg-yellow-500/20' },
  jsx: { icon: 'JSX', color: 'text-yellow-400', bgColor: 'bg-yellow-500/20' },
  json: { icon: '{ }', color: 'text-yellow-500', bgColor: 'bg-yellow-500/20' },
  md: { icon: 'MD', color: 'text-gray-400', bgColor: 'bg-gray-500/20' },
  css: { icon: 'CSS', color: 'text-blue-400', bgColor: 'bg-blue-500/20' },
  scss: { icon: 'SASS', color: 'text-pink-400', bgColor: 'bg-pink-500/20' },
  html: { icon: 'HTML', color: 'text-orange-500', bgColor: 'bg-orange-500/20' },
  py: { icon: 'PY', color: 'text-green-400', bgColor: 'bg-green-500/20' },
  rs: { icon: 'RS', color: 'text-orange-500', bgColor: 'bg-orange-500/20' },
  go: { icon: 'GO', color: 'text-cyan-400', bgColor: 'bg-cyan-500/20' },
  prisma: { icon: 'PR', color: 'text-purple-400', bgColor: 'bg-purple-500/20' },
  sql: { icon: 'SQL', color: 'text-blue-400', bgColor: 'bg-blue-500/20' },
};

const getFileIcon = (filename: string): { icon: string; color: string; bgColor?: string } => {
  const ext = filename.toLowerCase().split('.').pop() || '';
  return FILE_ICONS[ext] || { icon: '📄', color: 'text-gray-400' };
};

// Tab Item Component
interface TabItemProps {
  tab: Tab;
  isActive: boolean;
  onSelect: () => void;
  onClose: (e: React.MouseEvent) => void;
  onMiddleClick: (e: React.MouseEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  dragOverIndex: number | null;
  index: number;
}

const TabItem: React.FC<TabItemProps> = ({
  tab,
  isActive,
  onSelect,
  onClose,
  onMiddleClick,
  onContextMenu,
  onDragStart,
  onDragOver,
  onDrop,
  dragOverIndex,
  index,
}) => {
  const { icon, color } = getFileIcon(tab.title);
  const [isDragging, setIsDragging] = useState(false);
  const tabRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={tabRef}
      draggable
      onDragStart={(e) => {
        setIsDragging(true);
        onDragStart(e);
      }}
      onDragEnd={() => setIsDragging(false)}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onMouseDown={(e) => {
        if (e.button === 1) {
          e.preventDefault();
          onMiddleClick(e);
        }
      }}
      className={cn(
        'group relative flex items-center gap-1.5 px-3 h-9 min-w-0',
        'border-r border-border cursor-pointer select-none',
        'transition-all duration-150',
        isActive
          ? 'bg-background text-foreground border-b-2 border-b-primary border-b-r-0'
          : 'bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground',
        isDragging && 'opacity-50',
        tab.isPinned && 'pr-2'
      )}
      onClick={onSelect}
      onContextMenu={onContextMenu}
    >
      {/* Drag Handle */}
      <GripVertical className="w-3 h-3 opacity-0 group-hover:opacity-50 absolute left-0.5" />

      {/* Pin Indicator */}
      {tab.isPinned && (
        <Pin className="w-3 h-3 text-primary shrink-0 ml-2" />
      )}

      {/* File Icon */}
      <span className={cn(
        'text-[10px] font-bold min-w-[18px] text-center shrink-0',
        color,
        tab.isPinned ? 'ml-0' : 'ml-2'
      )}>
        {icon.length <= 3 ? icon : <File className="w-3.5 h-3.5" />}
      </span>

      {/* Title */}
      <span className="text-xs truncate max-w-[100px] shrink-0">
        {tab.title}
      </span>

      {/* Dirty Indicator or Close Button */}
      <div className="ml-auto flex items-center gap-1 shrink-0">
        {tab.isDirty ? (
          <button
            onClick={onClose}
            className={cn(
              'w-4 h-4 rounded-full flex items-center justify-center',
              'hover:bg-muted-foreground/20 transition-colors',
              'group'
            )}
            title="Unsaved changes - Click to close"
          >
            <span className="w-2 h-2 rounded-full bg-foreground group-hover:hidden" />
            <X className="w-3 h-3 hidden group-hover:block" />
          </button>
        ) : (
          <button
            onClick={onClose}
            className={cn(
              'w-4 h-4 rounded flex items-center justify-center',
              'hover:bg-muted-foreground/20 transition-colors',
              'opacity-0 group-hover:opacity-100'
            )}
            title="Close tab"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Drop indicator */}
      {dragOverIndex === index && (
        <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary" />
      )}
    </div>
  );
};

// Main Tab System Component
export const TabSystem: React.FC<TabSystemProps> = ({
  tabs: controlledTabs,
  activeTabId: controlledActiveTabId,
  onTabSelect,
  onTabClose,
  onTabReorder,
  onTabPin,
  onTabSplit,
  onTabsClose,
  maxVisibleTabs = 15,
  className = '',
}) => {
  const [internalTabs, setInternalTabs] = useState<Tab[]>(controlledTabs || []);
  const [internalActiveTabId, setInternalActiveTabId] = useState<string>('');
  const [draggedTab, setDraggedTab] = useState<Tab | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [showScrollButtons, setShowScrollButtons] = useState(false);
  const tabsRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Use controlled or internal state
  const tabs = useMemo(() => controlledTabs ?? internalTabs, [controlledTabs, internalTabs]);
  const activeTabId = controlledActiveTabId ?? internalActiveTabId;

  // Sort tabs: pinned first
  const sortedTabs = useMemo(() => {
    const pinned = tabs.filter(t => t.isPinned);
    const unpinned = tabs.filter(t => !t.isPinned);
    return [...pinned, ...unpinned];
  }, [tabs]);

  // Check if scroll buttons are needed
  useEffect(() => {
    const checkScroll = () => {
      if (scrollRef.current) {
        const { scrollWidth, clientWidth } = scrollRef.current;
        setShowScrollButtons(scrollWidth > clientWidth);
      }
    };
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [tabs]);

  // Select tab
  const handleSelect = useCallback((tab: Tab) => {
    if (onTabSelect) {
      onTabSelect(tab.id);
    } else {
      setInternalActiveTabId(tab.id);
    }
  }, [onTabSelect]);

  // Close tab
  const handleClose = useCallback((e: React.MouseEvent, tab: Tab) => {
    e.stopPropagation();
    if (onTabClose) {
      onTabClose(tab.id);
    } else {
      setInternalTabs((prev) => prev.filter((t) => t.id !== tab.id));
      if (activeTabId === tab.id && tabs.length > 1) {
        const index = tabs.findIndex((t) => t.id === tab.id);
        const newActiveTab = tabs[index + 1] || tabs[index - 1];
        setInternalActiveTabId(newActiveTab?.id || '');
      }
    }
  }, [onTabClose, activeTabId, tabs]);

  // Middle click to close
  const handleMiddleClick = useCallback((e: React.MouseEvent, tab: Tab) => {
    e.preventDefault();
    handleClose(e as unknown as React.MouseEvent, tab);
  }, [handleClose]);

  // Close multiple tabs
  const closeTabs = useCallback((tabIds: string[]) => {
    if (onTabsClose) {
      onTabsClose(tabIds);
    } else {
      setInternalTabs((prev) => prev.filter((t) => !tabIds.includes(t.id)));
      if (tabIds.includes(activeTabId)) {
        const remaining = tabs.filter((t) => !tabIds.includes(t.id));
        setInternalActiveTabId(remaining[0]?.id || '');
      }
    }
  }, [onTabsClose, activeTabId, tabs]);

  // Context menu actions
  const handleCloseOthers = useCallback((tab: Tab) => {
    const others = tabs.filter(t => t.id !== tab.id && !t.isPinned);
    closeTabs(others.map(t => t.id));
  }, [tabs, closeTabs]);

  const handleCloseToRight = useCallback((tab: Tab) => {
    const index = tabs.findIndex(t => t.id === tab.id);
    const toRight = tabs.slice(index + 1).filter(t => !t.isPinned);
    closeTabs(toRight.map(t => t.id));
  }, [tabs, closeTabs]);

  const handleCloseSaved = useCallback(() => {
    const saved = tabs.filter(t => !t.isDirty);
    closeTabs(saved.map(t => t.id));
  }, [tabs, closeTabs]);

  const handleCloseAll = useCallback(() => {
    const closable = tabs.filter(t => !t.isPinned);
    closeTabs(closable.map(t => t.id));
  }, [tabs, closeTabs]);

  const handlePin = useCallback((tab: Tab) => {
    if (onTabPin) {
      onTabPin(tab.id);
    } else {
      setInternalTabs((prev) =>
        prev.map((t) =>
          t.id === tab.id ? { ...t, isPinned: !t.isPinned } : t
        )
      );
    }
  }, [onTabPin]);

  const handleCopyPath = useCallback((tab: Tab) => {
    navigator.clipboard.writeText(tab.path);
  }, []);

  // Drag and drop
  const handleDragStart = useCallback((e: React.DragEvent, tab: Tab) => {
    setDraggedTab(tab);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', tab.id);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, targetTab: Tab, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetTab: Tab) => {
    e.preventDefault();
    setDragOverIndex(null);
    
    if (!draggedTab || draggedTab.id === targetTab.id) return;

    const newTabs = [...tabs];
    const draggedIndex = newTabs.findIndex((t) => t.id === draggedTab.id);
    const targetIndex = newTabs.findIndex((t) => t.id === targetTab.id);

    newTabs.splice(draggedIndex, 1);
    newTabs.splice(targetIndex, 0, draggedTab);

    if (onTabReorder) {
      onTabReorder(newTabs);
    } else {
      setInternalTabs(newTabs);
    }

    setDraggedTab(null);
  }, [draggedTab, tabs, onTabReorder]);

  // Scroll controls
  const scroll = useCallback((direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 150;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  }, []);

  // Scroll tabs with mouse wheel
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft += e.deltaY;
    }
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        const currentIndex = tabs.findIndex((t) => t.id === activeTabId);
        
        if (e.key === 'Tab') {
          e.preventDefault();
          const nextIndex = e.shiftKey
            ? (currentIndex - 1 + tabs.length) % tabs.length
            : (currentIndex + 1) % tabs.length;
          handleSelect(tabs[nextIndex]);
        } else if (e.key === 'w') {
          e.preventDefault();
          const activeTab = tabs.find((t) => t.id === activeTabId);
          if (activeTab && !activeTab.isPinned) {
            setInternalTabs((prev) => prev.filter((t) => t.id !== activeTabId));
            if (tabs.length > 1) {
              const index = tabs.findIndex((t) => t.id === activeTabId);
              const newActiveTab = tabs[index + 1] || tabs[index - 1];
              setInternalActiveTabId(newActiveTab?.id || '');
            }
          }
        } else if (e.key === 'k' && e.altKey) {
          // Close other tabs
          e.preventDefault();
          const activeTab = tabs.find((t) => t.id === activeTabId);
          if (activeTab) {
            handleCloseOthers(activeTab);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [tabs, activeTabId, handleSelect, handleCloseOthers]);

  // Active tab info
  const activeTab = tabs.find(t => t.id === activeTabId);

  return (
    <div className={cn('flex flex-col bg-muted/30 border-b border-border', className)}>
      {/* Tab Bar */}
      <div className="flex items-center h-9">
        {/* Scroll Left Button */}
        {showScrollButtons && (
          <Button
            variant="ghost"
            size="icon"
            className="w-6 h-6 shrink-0 rounded-none"
            onClick={() => scroll('left')}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
        )}

        {/* Tabs Container */}
        <div
          ref={scrollRef}
          className="flex-1 flex overflow-x-auto scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent"
          onWheel={handleWheel}
          style={{ scrollbarWidth: 'thin' }}
        >
          {sortedTabs.map((tab, index) => (
            <ContextMenu key={tab.id}>
              <ContextMenuTrigger asChild>
                <TabItem
                  tab={tab}
                  index={index}
                  isActive={activeTabId === tab.id}
                  onSelect={() => handleSelect(tab)}
                  onClose={(e) => handleClose(e, tab)}
                  onMiddleClick={(e) => handleMiddleClick(e, tab)}
                  onContextMenu={() => {}}
                  onDragStart={(e) => handleDragStart(e, tab)}
                  onDragOver={(e) => handleDragOver(e, tab, index)}
                  onDrop={(e) => handleDrop(e, tab)}
                  dragOverIndex={dragOverIndex}
                />
              </ContextMenuTrigger>
              <ContextMenuContent className="w-56">
                <ContextMenuItem onClick={() => handleClose({} as React.MouseEvent, tab)}>
                  Close
                  <ContextMenuShortcut>⌘W</ContextMenuShortcut>
                </ContextMenuItem>
                <ContextMenuItem onClick={() => handleCloseOthers(tab)}>
                  Close Others
                </ContextMenuItem>
                <ContextMenuItem onClick={() => handleCloseToRight(tab)}>
                  Close to Right
                </ContextMenuItem>
                <ContextMenuItem onClick={handleCloseSaved}>
                  Close Saved
                </ContextMenuItem>
                <ContextMenuItem onClick={handleCloseAll}>
                  Close All
                  <ContextMenuShortcut>⌘K ⌘W</ContextMenuShortcut>
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem onClick={() => handlePin(tab)}>
                  {tab.isPinned ? 'Unpin' : 'Pin'}
                  {tab.isPinned && <Pin className="w-3 h-3 ml-auto" />}
                </ContextMenuItem>
                <ContextMenuItem onClick={() => handleCopyPath(tab)}>
                  Copy Path
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem onClick={() => onTabSplit?.(tab.id, 'left')}>
                  Split Left
                </ContextMenuItem>
                <ContextMenuItem onClick={() => onTabSplit?.(tab.id, 'right')}>
                  Split Right
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          ))}
        </div>

        {/* Scroll Right Button */}
        {showScrollButtons && (
          <Button
            variant="ghost"
            size="icon"
            className="w-6 h-6 shrink-0 rounded-none"
            onClick={() => scroll('right')}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        )}

        {/* More Options Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="w-7 h-7 shrink-0 rounded-none">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onClick={handleCloseAll}>
              Close All
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleCloseSaved}>
              Close Saved
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => {
              tabs.filter(t => !t.isPinned).forEach(t => handlePin(t));
            }}>
              Pin All
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => {
              tabs.filter(t => t.isPinned).forEach(t => handlePin(t));
            }}>
              Unpin All
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Active Tab Path Bar */}
      {activeTab && (
        <div className="flex items-center px-3 h-6 bg-background/50 border-t border-border/50 text-xs text-muted-foreground">
          <span className="truncate flex-1">{activeTab.path}</span>
          {activeTab.language && (
            <span className="text-muted-foreground/60 ml-2 shrink-0">
              {activeTab.language.toUpperCase()}
            </span>
          )}
        </div>
      )}

      {/* Empty state */}
      {tabs.length === 0 && (
        <div className="flex items-center justify-center h-9 text-xs text-muted-foreground">
          No files open - Press ⌘P to open a file
        </div>
      )}
    </div>
  );
};

export default TabSystem;
