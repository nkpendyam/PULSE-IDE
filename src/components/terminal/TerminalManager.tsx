'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  ResizablePanelGroup, 
  ResizablePanel, 
  ResizableHandle 
} from '@/components/ui/resizable';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu';
import { 
  Plus, X, Terminal as TerminalIcon, SplitSquareHorizontal, SplitSquareVertical,
  ChevronDown, Trash2, Maximize2, Minimize2, Copy, CheckCircle, XCircle,
  FolderOpen, Settings, MoreHorizontal, ArrowUpDown, ArrowLeftRight,
  TerminalSquare, Layers
} from 'lucide-react';
import Terminal, { 
  TerminalProfile, 
  TerminalState, 
  DEFAULT_PROFILES 
} from './Terminal';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

interface TerminalInstance {
  id: string;
  name: string;
  profile: TerminalProfile;
  cwd: string;
  state: TerminalState;
  createdAt: Date;
  lastActivity: Date;
}

interface SplitPane {
  id: string;
  direction: 'horizontal' | 'vertical';
  children: (SplitPane | TerminalPane)[];
}

interface TerminalPane {
  id: string;
  terminalId: string;
}

type Pane = SplitPane | TerminalPane;

interface TerminalManagerProps {
  className?: string;
  onCommand?: (terminalId: string, command: string, exitCode: number | null) => void;
  defaultProfile?: TerminalProfile;
  fontSize?: number;
  fontFamily?: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function generateId(): string {
  return `term-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function isSplitPane(pane: Pane): pane is SplitPane {
  return 'direction' in pane && 'children' in pane;
}

function isTerminalPane(pane: Pane): pane is TerminalPane {
  return 'terminalId' in pane;
}

function findPaneById(pane: Pane, id: string): Pane | null {
  if (pane.id === id) return pane;
  if (isSplitPane(pane)) {
    for (const child of pane.children) {
      const found = findPaneById(child, id);
      if (found) return found;
    }
  }
  return null;
}

function findParentPane(root: Pane, targetId: string): { parent: SplitPane; index: number } | null {
  if (isSplitPane(root)) {
    for (let i = 0; i < root.children.length; i++) {
      if (root.children[i].id === targetId) {
        return { parent: root, index: i };
      }
      if (isSplitPane(root.children[i])) {
        const found = findParentPane(root.children[i], targetId);
        if (found) return found;
      }
    }
  }
  return null;
}

function removePaneById(pane: Pane, id: string): Pane | null {
  if (isSplitPane(pane)) {
    pane.children = pane.children
      .map(child => removePaneById(child, id))
      .filter((child): child is Pane => child !== null);
    
    if (pane.children.length === 0) return null;
    if (pane.children.length === 1) return pane.children[0];
    return pane;
  }
  return pane.id === id ? null : pane;
}

function addPaneToParent(
  root: Pane, 
  parentId: string | null, 
  newPane: Pane,
  direction: 'horizontal' | 'vertical'
): Pane {
  if (parentId === null) {
    // Split the root
    if (isSplitPane(root) && root.direction === direction) {
      root.children.push(newPane);
      return root;
    }
    return {
      id: generateId(),
      direction,
      children: [root, newPane],
    };
  }

  const parent = findPaneById(root, parentId);
  if (parent && isSplitPane(parent) && parent.direction === direction) {
    parent.children.push(newPane);
    return root;
  }

  // Need to create a new split
  if (parent && isTerminalPane(parent)) {
    const parentInfo = findParentPane(root, parentId);
    if (parentInfo) {
      const newSplit: SplitPane = {
        id: generateId(),
        direction,
        children: [parent, newPane],
      };
      parentInfo.parent.children[parentInfo.index] = newSplit;
      return root;
    }
  }

  return root;
}

// ============================================================================
// TERMINAL TAB COMPONENT
// ============================================================================

interface TerminalTabProps {
  terminal: TerminalInstance;
  isActive: boolean;
  onSelect: () => void;
  onClose: () => void;
  onSplit: (direction: 'horizontal' | 'vertical') => void;
  onChangeProfile: (profile: TerminalProfile) => void;
  profiles: TerminalProfile[];
}

function TerminalTab({
  terminal,
  isActive,
  onSelect,
  onClose,
  onSplit,
  onChangeProfile,
  profiles,
}: TerminalTabProps) {
  const getStatusIcon = () => {
    if (terminal.state.isRunning) {
      return <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />;
    }
    if (terminal.state.exitCode === 0) {
      return <CheckCircle className="w-3 h-3 text-green-500" />;
    }
    if (terminal.state.exitCode !== null && terminal.state.exitCode !== 0) {
      return <XCircle className="w-3 h-3 text-red-500" />;
    }
    return null;
  };

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 px-2 py-1 border-r border-zinc-800 cursor-pointer group min-w-0',
        isActive 
          ? 'bg-zinc-950 text-white' 
          : 'text-zinc-400 hover:bg-zinc-800/50'
      )}
      onClick={onSelect}
    >
      <TerminalIcon className="h-3 w-3 shrink-0" style={{ color: terminal.profile.color }} />
      <span className="text-xs truncate max-w-24">{terminal.name}</span>
      {getStatusIcon()}
      
      <DropdownMenu>
        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
          <button className="opacity-0 group-hover:opacity-100 hover:bg-zinc-700 rounded p-0.5">
            <ChevronDown className="h-3 w-3" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          <DropdownMenuLabel className="text-xs">{terminal.name}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="text-xs">
              <SplitSquareHorizontal className="h-3 w-3 mr-2" />
              Split Pane
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem onClick={() => onSplit('horizontal')}>
                <ArrowLeftRight className="h-3 w-3 mr-2" />
                Horizontal
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onSplit('vertical')}>
                <ArrowUpDown className="h-3 w-3 mr-2" />
                Vertical
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="text-xs">
              <Settings className="h-3 w-3 mr-2" />
              Change Profile
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {profiles.map(profile => (
                <DropdownMenuItem 
                  key={profile.id}
                  onClick={() => onChangeProfile(profile)}
                  className="text-xs"
                >
                  <span className="mr-2">{profile.icon}</span>
                  {profile.name}
                  {terminal.profile.id === profile.id && (
                    <CheckCircle className="h-3 w-3 ml-auto text-green-500" />
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onClose} className="text-xs text-red-400">
            <Trash2 className="h-3 w-3 mr-2" />
            Close Terminal
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

// ============================================================================
// TERMINAL PANE RENDERER
// ============================================================================

interface TerminalPaneRendererProps {
  pane: Pane;
  terminals: Map<string, TerminalInstance>;
  activeTerminalId: string | null;
  onTerminalSelect: (id: string) => void;
  onTerminalClose: (id: string) => void;
  onTerminalSplit: (paneId: string, direction: 'horizontal' | 'vertical') => void;
  onChangeProfile: (terminalId: string, profile: TerminalProfile) => void;
  onCommand: (terminalId: string, command: string, exitCode: number | null) => void;
  onCwdChange: (terminalId: string, cwd: string) => void;
  onStateChange: (terminalId: string, state: TerminalState) => void;
  profiles: TerminalProfile[];
  fontSize?: number;
  fontFamily?: string;
}

function TerminalPaneRenderer({
  pane,
  terminals,
  activeTerminalId,
  onTerminalSelect,
  onTerminalClose,
  onTerminalSplit,
  onChangeProfile,
  onCommand,
  onCwdChange,
  onStateChange,
  profiles,
  fontSize,
  fontFamily,
}: TerminalPaneRendererProps) {
  if (isSplitPane(pane)) {
    return (
      <ResizablePanelGroup 
        direction={pane.direction === 'horizontal' ? 'horizontal' : 'vertical'}
        className="h-full"
      >
        {pane.children.map((child, index) => (
          <React.Fragment key={child.id}>
            <ResizablePanel 
              defaultSize={100 / pane.children.length} 
              minSize={10}
            >
              <TerminalPaneRenderer
                pane={child}
                terminals={terminals}
                activeTerminalId={activeTerminalId}
                onTerminalSelect={onTerminalSelect}
                onTerminalClose={onTerminalClose}
                onTerminalSplit={onTerminalSplit}
                onChangeProfile={onChangeProfile}
                onCommand={onCommand}
                onCwdChange={onCwdChange}
                onStateChange={onStateChange}
                profiles={profiles}
                fontSize={fontSize}
                fontFamily={fontFamily}
              />
            </ResizablePanel>
            {index < pane.children.length - 1 && (
              <ResizableHandle 
                className={cn(
                  pane.direction === 'horizontal' 
                    ? 'w-1 hover:w-1.5' 
                    : 'h-1 hover:h-1.5',
                  'bg-zinc-800 hover:bg-primary/50 transition-all'
                )} 
              />
            )}
          </React.Fragment>
        ))}
      </ResizablePanelGroup>
    );
  }

  const terminal = terminals.get(pane.terminalId);
  if (!terminal) {
    return (
      <div className="h-full flex items-center justify-center bg-zinc-950 text-zinc-500">
        <div className="text-center">
          <TerminalSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-xs">Terminal not found</p>
        </div>
      </div>
    );
  }

  const isActive = activeTerminalId === terminal.id;

  return (
    <div 
      className={cn(
        'h-full flex flex-col',
        isActive && 'ring-inset ring-1 ring-primary/20'
      )}
      onClick={() => onTerminalSelect(terminal.id)}
    >
      {/* Mini tab bar for this pane */}
      <div className="flex items-center bg-zinc-900 border-b border-zinc-800 shrink-0">
        <div className="flex-1 flex items-center">
          <div
            className={cn(
              'flex items-center gap-1.5 px-2 py-1 border-r border-zinc-800',
              isActive ? 'bg-zinc-950 text-white' : 'text-zinc-400'
            )}
          >
            <TerminalIcon className="h-3 w-3" style={{ color: terminal.profile.color }} />
            <span className="text-xs">{terminal.name}</span>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6">
              <MoreHorizontal className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={() => onTerminalSplit(pane.id, 'horizontal')}>
              <SplitSquareHorizontal className="h-3 w-3 mr-2" />
              Split Right
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onTerminalSplit(pane.id, 'vertical')}>
              <SplitSquareVertical className="h-3 w-3 mr-2" />
              Split Down
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={() => onTerminalClose(terminal.id)}
              className="text-red-400"
            >
              <X className="h-3 w-3 mr-2" />
              Close
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Terminal content */}
      <div className="flex-1 overflow-hidden">
        <Terminal
          profile={terminal.profile}
          sessionId={terminal.id}
          fontSize={fontSize}
          fontFamily={fontFamily}
          onCommand={(cmd, code) => onCommand(terminal.id, cmd, code)}
          onCwdChange={(cwd) => onCwdChange(terminal.id, cwd)}
          onStateChange={(state) => onStateChange(terminal.id, state)}
        />
      </div>
    </div>
  );
}

// ============================================================================
// TERMINAL MANAGER COMPONENT
// ============================================================================

export default function TerminalManager({
  className,
  onCommand,
  defaultProfile = DEFAULT_PROFILES[0],
  fontSize = 13,
  fontFamily = 'JetBrains Mono, Menlo, Monaco, Consolas, monospace',
}: TerminalManagerProps) {
  const [terminals, setTerminals] = useState<Map<string, TerminalInstance>>(() => {
    const map = new Map();
    const firstTerminal: TerminalInstance = {
      id: generateId(),
      name: 'Terminal',
      profile: defaultProfile,
      cwd: '/home/project',
      state: {
        cwd: '/home/project',
        isRunning: false,
        exitCode: null,
        lastCommand: '',
        environment: {},
      },
      createdAt: new Date(),
      lastActivity: new Date(),
    };
    map.set(firstTerminal.id, firstTerminal);
    return map;
  });

  const [paneStructure, setPaneStructure] = useState<Pane>(() => ({
    id: generateId(),
    terminalId: Array.from(terminals.keys())[0],
  }));

  const [activeTerminalId, setActiveTerminalId] = useState<string>(() => {
    return Array.from(terminals.keys())[0];
  });

  const [profiles, setProfiles] = useState<TerminalProfile[]>(DEFAULT_PROFILES);
  const [lastUsedProfile, setLastUsedProfile] = useState<TerminalProfile>(defaultProfile);

  // Create new terminal
  const createTerminal = useCallback((profile?: TerminalProfile) => {
    const selectedProfile = profile || lastUsedProfile;
    const newTerminal: TerminalInstance = {
      id: generateId(),
      name: `Terminal ${terminals.size + 1}`,
      profile: selectedProfile,
      cwd: '/home/project',
      state: {
        cwd: '/home/project',
        isRunning: false,
        exitCode: null,
        lastCommand: '',
        environment: {},
      },
      createdAt: new Date(),
      lastActivity: new Date(),
    };

    setTerminals(prev => {
      const newMap = new Map(prev);
      newMap.set(newTerminal.id, newTerminal);
      return newMap;
    });

    setActiveTerminalId(newTerminal.id);
    setLastUsedProfile(selectedProfile);

    // Add to pane structure (new terminal gets its own pane, replacing single terminal pane)
    if (isTerminalPane(paneStructure)) {
      // Just replace with the new terminal
      setPaneStructure({
        id: generateId(),
        terminalId: newTerminal.id,
      });
    }
  }, [terminals.size, lastUsedProfile, paneStructure]);

  // Close terminal
  const closeTerminal = useCallback((id: string) => {
    setTerminals(prev => {
      if (prev.size <= 1) return prev; // Don't close the last terminal
      const newMap = new Map(prev);
      newMap.delete(id);
      
      // Set active terminal to another one
      if (activeTerminalId === id) {
        const remaining = Array.from(newMap.keys());
        if (remaining.length > 0) {
          setActiveTerminalId(remaining[0]);
        }
      }
      
      return newMap;
    });

    // Remove from pane structure
    setPaneStructure(prev => removePaneById(prev, id) || prev);
  }, [activeTerminalId]);

  // Split terminal
  const splitTerminal = useCallback((paneId: string, direction: 'horizontal' | 'vertical') => {
    const newTerminal: TerminalInstance = {
      id: generateId(),
      name: `Terminal ${terminals.size + 1}`,
      profile: lastUsedProfile,
      cwd: '/home/project',
      state: {
        cwd: '/home/project',
        isRunning: false,
        exitCode: null,
        lastCommand: '',
        environment: {},
      },
      createdAt: new Date(),
      lastActivity: new Date(),
    };

    setTerminals(prev => {
      const newMap = new Map(prev);
      newMap.set(newTerminal.id, newTerminal);
      return newMap;
    });

    const newPane: TerminalPane = {
      id: generateId(),
      terminalId: newTerminal.id,
    };

    setPaneStructure(prev => addPaneToParent(prev, paneId, newPane, direction));
    setActiveTerminalId(newTerminal.id);
  }, [terminals.size, lastUsedProfile]);

  // Change profile
  const changeProfile = useCallback((terminalId: string, profile: TerminalProfile) => {
    setTerminals(prev => {
      const newMap = new Map(prev);
      const terminal = newMap.get(terminalId);
      if (terminal) {
        newMap.set(terminalId, { ...terminal, profile });
      }
      return newMap;
    });
    setLastUsedProfile(profile);
  }, []);

  // Handle command
  const handleCommand = useCallback((terminalId: string, command: string, exitCode: number | null) => {
    setTerminals(prev => {
      const newMap = new Map(prev);
      const terminal = newMap.get(terminalId);
      if (terminal) {
        newMap.set(terminalId, {
          ...terminal,
          lastActivity: new Date(),
          state: {
            ...terminal.state,
            lastCommand: command,
            exitCode,
            isRunning: false,
          },
        });
      }
      return newMap;
    });
    onCommand?.(terminalId, command, exitCode);
  }, [onCommand]);

  // Handle cwd change
  const handleCwdChange = useCallback((terminalId: string, cwd: string) => {
    setTerminals(prev => {
      const newMap = new Map(prev);
      const terminal = newMap.get(terminalId);
      if (terminal) {
        newMap.set(terminalId, {
          ...terminal,
          cwd,
          state: { ...terminal.state, cwd },
        });
      }
      return newMap;
    });
  }, []);

  // Handle state change
  const handleStateChange = useCallback((terminalId: string, state: TerminalState) => {
    setTerminals(prev => {
      const newMap = new Map(prev);
      const terminal = newMap.get(terminalId);
      if (terminal) {
        newMap.set(terminalId, { ...terminal, state });
      }
      return newMap;
    });
  }, []);

  // Add custom profile
  const addCustomProfile = useCallback((profile: Omit<TerminalProfile, 'id' | 'isCustom'>) => {
    const newProfile: TerminalProfile = {
      ...profile,
      id: `custom-${Date.now()}`,
      isCustom: true,
    };
    setProfiles(prev => [...prev, newProfile]);
    return newProfile;
  }, []);

  // Remove custom profile
  const removeCustomProfile = useCallback((profileId: string) => {
    setProfiles(prev => prev.filter(p => p.id !== profileId));
  }, []);

  // Get active terminal
  const activeTerminal = terminals.get(activeTerminalId);

  return (
    <div className={cn('h-full flex flex-col bg-zinc-950', className)}>
      {/* Tab bar */}
      <div className="flex items-center bg-zinc-900 border-b border-zinc-800 shrink-0">
        <ScrollArea className="flex-1">
          <div className="flex items-center">
            {Array.from(terminals.values()).map(terminal => (
              <TerminalTab
                key={terminal.id}
                terminal={terminal}
                isActive={activeTerminalId === terminal.id}
                onSelect={() => setActiveTerminalId(terminal.id)}
                onClose={() => closeTerminal(terminal.id)}
                onSplit={(dir) => {
                  const pane = findPaneById(paneStructure, terminal.id);
                  if (pane) {
                    splitTerminal(pane.id, dir);
                  }
                }}
                onChangeProfile={(profile) => changeProfile(terminal.id, profile)}
                profiles={profiles}
              />
            ))}
          </div>
        </ScrollArea>

        {/* Actions */}
        <div className="flex items-center gap-0.5 px-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6">
                <Plus className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => createTerminal()}>
                <TerminalIcon className="h-3 w-3 mr-2" />
                New Terminal
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs text-zinc-400">
                New with Profile
              </DropdownMenuLabel>
              {profiles.map(profile => (
                <DropdownMenuItem 
                  key={profile.id}
                  onClick={() => createTerminal(profile)}
                >
                  <span className="mr-2">{profile.icon}</span>
                  {profile.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6">
                <SplitSquareHorizontal className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel className="text-xs">Split Terminal</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => {
                if (isTerminalPane(paneStructure)) {
                  splitTerminal(paneStructure.id, 'horizontal');
                }
              }}>
                <ArrowLeftRight className="h-3 w-3 mr-2" />
                Horizontal (Right)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => {
                if (isTerminalPane(paneStructure)) {
                  splitTerminal(paneStructure.id, 'vertical');
                }
              }}>
                <ArrowUpDown className="h-3 w-3 mr-2" />
                Vertical (Down)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Terminal panes */}
      <div className="flex-1 overflow-hidden">
        <TerminalPaneRenderer
          pane={paneStructure}
          terminals={terminals}
          activeTerminalId={activeTerminalId}
          onTerminalSelect={setActiveTerminalId}
          onTerminalClose={closeTerminal}
          onTerminalSplit={splitTerminal}
          onChangeProfile={changeProfile}
          onCommand={handleCommand}
          onCwdChange={handleCwdChange}
          onStateChange={handleStateChange}
          profiles={profiles}
          fontSize={fontSize}
          fontFamily={fontFamily}
        />
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between px-2 py-0.5 bg-zinc-900 border-t border-zinc-800 text-[10px] text-zinc-500 shrink-0">
        <div className="flex items-center gap-2">
          {activeTerminal && (
            <>
              <span className="flex items-center gap-1">
                <FolderOpen className="h-3 w-3" />
                {activeTerminal.cwd}
              </span>
              {activeTerminal.state.lastCommand && (
                <span className="text-zinc-600">
                  Last: {activeTerminal.state.lastCommand.slice(0, 30)}
                  {activeTerminal.state.lastCommand.length > 30 ? '...' : ''}
                </span>
              )}
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px] h-4 px-1">
            <Layers className="h-2.5 w-2.5 mr-1" />
            {terminals.size} session{terminals.size !== 1 ? 's' : ''}
          </Badge>
          {activeTerminal && (
            <Badge 
              variant="outline" 
              className="text-[10px] h-4 px-1"
              style={{ borderColor: activeTerminal.profile.color }}
            >
              {activeTerminal.profile.icon} {activeTerminal.profile.name}
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}
