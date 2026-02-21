'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { ChevronRight, FileCode, Folder, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface BreadcrumbItem {
  name: string;
  path: string;
  type: 'folder' | 'file' | 'symbol';
  children?: BreadcrumbItem[];
}

export interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  currentSymbol?: string;
  onNavigate?: (path: string) => void;
  className?: string;
}

export default function Breadcrumbs({ items, currentSymbol, onNavigate, className }: BreadcrumbsProps) {
  return (
    <div className={cn('flex items-center gap-0.5 text-sm h-7 px-2 bg-muted/30 border-b', className)}>
      <Button variant="ghost" size="sm" className="h-5 px-1.5 text-xs text-muted-foreground hover:text-foreground" onClick={() => onNavigate?.('/')}>
        <Home className="h-3 w-3" />
      </Button>
      <ChevronRight className="h-3 w-3 text-muted-foreground" />
      {items.map((item, index) => (
        <React.Fragment key={item.path}>
          <Button
            variant="ghost"
            size="sm"
            className={cn('h-5 px-1.5 text-xs gap-1', index === items.length - 1 ? 'text-foreground font-medium' : 'text-muted-foreground hover:text-foreground')}
            onClick={() => onNavigate?.(item.path)}
          >
            {item.type === 'folder' ? <Folder className="h-3 w-3 text-yellow-500" /> : <FileCode className="h-3 w-3 text-blue-400" />}
            <span className="max-w-[100px] truncate">{item.name}</span>
          </Button>
          {index < items.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
        </React.Fragment>
      ))}
      {currentSymbol && (
        <>
          <ChevronRight className="h-3 w-3 text-muted-foreground" />
          <span className="text-xs text-purple-400 font-medium px-1.5 py-0.5 bg-purple-500/10 rounded">{currentSymbol}</span>
        </>
      )}
      <div className="flex-1" />
      {items.length > 0 && items[items.length - 1].type === 'file' && (
        <span className="text-[10px] text-muted-foreground px-1.5">{items[items.length - 1].name.split('.').pop()?.toUpperCase()}</span>
      )}
    </div>
  );
}
