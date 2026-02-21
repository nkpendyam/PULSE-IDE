'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { 
  File, Search, Settings, Terminal, GitBranch, Code, Save, FolderOpen, Plus, Sparkles 
} from 'lucide-react';

interface CommandItem {
  id: string;
  label: string;
  category?: string;
  shortcut?: string;
  action?: () => void;
}

const COMMANDS: CommandItem[] = [
  { id: 'file.new', label: 'New File', category: 'File', shortcut: 'Ctrl+N' },
  { id: 'file.open', label: 'Open File', category: 'File', shortcut: 'Ctrl+O' },
  { id: 'file.save', label: 'Save', category: 'File', shortcut: 'Ctrl+S' },
  { id: 'edit.find', label: 'Find', category: 'Edit', shortcut: 'Ctrl+F' },
  { id: 'edit.replace', label: 'Replace', category: 'Edit', shortcut: 'Ctrl+H' },
  { id: 'edit.format', label: 'Format Document', category: 'Edit', shortcut: 'Shift+Alt+F' },
  { id: 'nav.gotoLine', label: 'Go to Line', category: 'Navigation', shortcut: 'Ctrl+G' },
  { id: 'terminal.new', label: 'New Terminal', category: 'Terminal', shortcut: 'Ctrl+`' },
  { id: 'git.commit', label: 'Git Commit', category: 'Git' },
  { id: 'git.push', label: 'Git Push', category: 'Git' },
  { id: 'ai.explain', label: 'AI: Explain Code', category: 'AI', shortcut: 'Ctrl+Shift+E' },
  { id: 'ai.refactor', label: 'AI: Refactor', category: 'AI', shortcut: 'Ctrl+Shift+R' },
  { id: 'settings.open', label: 'Open Settings', category: 'Settings', shortcut: 'Ctrl+,' },
  { id: 'settings.theme', label: 'Toggle Theme', category: 'Settings' },
];

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCommand?: (id: string) => void;
}

export default function CommandPalette({ open, onOpenChange, onCommand }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().replace(/^>/, '').trim();
    return COMMANDS.filter(c => 
      c.label.toLowerCase().includes(q) || 
      (c.category?.toLowerCase().includes(q))
    );
  }, [query]);

  const handleKey = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelected(i => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelected(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && filtered[selected]) {
      e.preventDefault();
      onCommand?.(filtered[selected].id);
      onOpenChange(false);
      setQuery('');
    } else if (e.key === 'Escape') {
      onOpenChange(false);
    }
  }, [filtered, selected, onCommand, onOpenChange]);

  // Reset state when dialog opens
  const handleOpenChange = useCallback((newOpen: boolean) => {
    if (newOpen) {
      setQuery('');
      setSelected(0);
    }
    onOpenChange(newOpen);
  }, [onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="p-0 gap-0 max-w-lg top-[20%] translate-y-0">
        <div className="p-3 border-b">
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Type a command or search..."
            className="border-0 focus-visible:ring-0"
            autoFocus
          />
        </div>
        <ScrollArea className="max-h-64">
          {filtered.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">No commands found</div>
          ) : (
            filtered.map((cmd, i) => (
              <div
                key={cmd.id}
                className={cn(
                  'flex items-center justify-between px-3 py-2 cursor-pointer',
                  i === selected ? 'bg-accent' : 'hover:bg-accent/50'
                )}
                onClick={() => {
                  onCommand?.(cmd.id);
                  onOpenChange(false);
                }}
                onMouseEnter={() => setSelected(i)}
              >
                <div>
                  <span className="font-medium">{cmd.label}</span>
                  {cmd.category && (
                    <span className="ml-2 text-xs text-muted-foreground">{cmd.category}</span>
                  )}
                </div>
                {cmd.shortcut && (
                  <Badge variant="secondary" className="text-[10px] font-mono">{cmd.shortcut}</Badge>
                )}
              </div>
            ))
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
