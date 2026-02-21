'use client';

import React, { useRef, useEffect, useCallback, useState } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import 'xterm/css/xterm.css';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, X, Terminal as TerminalIcon, ChevronDown, SplitSquareHorizontal } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export interface TerminalProfile {
  id: string;
  name: string;
  shell: string;
  args?: string[];
  icon?: string;
  isDefault?: boolean;
}

const defaultProfiles: TerminalProfile[] = [
  { id: 'bash', name: 'Bash', shell: '/bin/bash', isDefault: true },
  { id: 'zsh', name: 'Zsh', shell: '/bin/zsh' },
  { id: 'sh', name: 'Sh', shell: '/bin/sh' },
  { id: 'node', name: 'Node.js', shell: 'node' },
  { id: 'python', name: 'Python', shell: 'python3' },
];

interface TerminalInstanceProps {
  id: string;
  profile: TerminalProfile;
  cwd?: string;
  onClose: (id: string) => void;
  onSplit?: (id: string) => void;
}

function TerminalInstance({ id, profile, cwd, onClose, onSplit }: TerminalInstanceProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [exitCode, setExitCode] = useState<number | null>(null);

  useEffect(() => {
    if (!terminalRef.current || xtermRef.current) return;

    const xterm = new XTerm({
      cursorBlink: true,
      cursorStyle: 'block',
      fontSize: 13,
      fontFamily: 'JetBrains Mono, Menlo, Monaco, monospace',
      theme: {
        background: '#0c0c0c',
        foreground: '#cccccc',
        cursor: '#ffffff',
        cursorAccent: '#000000',
        selectionBackground: 'rgba(255, 255, 255, 0.3)',
        black: '#000000',
        red: '#cd0000',
        green: '#00cd00',
        yellow: '#cdcd00',
        blue: '#0000ee',
        magenta: '#cd00cd',
        cyan: '#00cdcd',
        white: '#e5e5e5',
        brightBlack: '#7f7f7f',
        brightRed: '#ff0000',
        brightGreen: '#00ff00',
        brightYellow: '#ffff00',
        brightBlue: '#5c5cff',
        brightMagenta: '#ff00ff',
        brightCyan: '#00ffff',
        brightWhite: '#ffffff',
      },
      allowTransparency: true,
      scrollback: 10000,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    xterm.loadAddon(fitAddon);
    xterm.loadAddon(webLinksAddon);
    xterm.open(terminalRef.current);

    fitAddon.fit();
    xtermRef.current = xterm;
    fitAddonRef.current = fitAddon;
    setIsReady(true);

    // Welcome message
    xterm.writeln(`\x1b[1;36mKyro IDE Terminal\x1b[0m - ${profile.name}`);
    xterm.writeln(`Profile: ${profile.shell}`);
    xterm.writeln(`Working Directory: ${cwd || '~'}`);
    xterm.writeln('');
    xterm.write('$ ');

    // Handle input
    let currentLine = '';
    let history: string[] = [];
    let historyIndex = -1;

    xterm.onKey(({ key, domEvent }) => {
      const printable = !domEvent.altKey && !domEvent.ctrlKey && !domEvent.metaKey;

      if (domEvent.keyCode === 13) { // Enter
        xterm.writeln('');
        
        if (currentLine.trim()) {
          history.push(currentLine);
          historyIndex = history.length;
          
          // Process command
          const [cmd, ...args] = currentLine.trim().split(' ');
          processCommand(xterm, cmd, args, cwd);
        }
        
        currentLine = '';
        xterm.write('$ ');
      } else if (domEvent.keyCode === 8) { // Backspace
        if (currentLine.length > 0) {
          currentLine = currentLine.slice(0, -1);
          xterm.write('\b \b');
        }
      } else if (domEvent.keyCode === 38) { // Up arrow
        if (historyIndex > 0) {
          historyIndex--;
          const historyLine = history[historyIndex];
          clearLine(xterm, currentLine);
          currentLine = historyLine;
          xterm.write(currentLine);
        }
      } else if (domEvent.keyCode === 40) { // Down arrow
        if (historyIndex < history.length - 1) {
          historyIndex++;
          const historyLine = history[historyIndex];
          clearLine(xterm, currentLine);
          currentLine = historyLine;
          xterm.write(currentLine);
        } else {
          historyIndex = history.length;
          clearLine(xterm, currentLine);
          currentLine = '';
        }
      } else if (printable) {
        currentLine += key;
        xterm.write(key);
      }
    });

    // Handle resize
    const handleResize = () => {
      fitAddon.fit();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      xterm.dispose();
      xtermRef.current = null;
    };
  }, [profile, cwd]);

  // Resize on container size change
  useEffect(() => {
    if (fitAddonRef.current) {
      const timer = setTimeout(() => fitAddonRef.current?.fit(), 100);
      return () => clearTimeout(timer);
    }
  }, []);

  return (
    <div className="flex-1 relative">
      <div ref={terminalRef} className="h-full w-full p-1" />
      {!isReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
          <div className="animate-pulse text-zinc-500 text-sm">Initializing terminal...</div>
        </div>
      )}
      {exitCode !== null && (
        <div className="absolute bottom-0 left-0 right-0 bg-zinc-800 px-2 py-1 text-xs flex items-center gap-2">
          <span className={exitCode === 0 ? 'text-green-500' : 'text-red-500'}>
            Process exited with code {exitCode}
          </span>
          <Button size="sm" variant="ghost" className="h-5 text-xs" onClick={() => setExitCode(null)}>
            Restart
          </Button>
        </div>
      )}
    </div>
  );
}

function clearLine(xterm: XTerm, currentLine: string) {
  for (let i = 0; i < currentLine.length; i++) {
    xterm.write('\b \b');
  }
}

function processCommand(xterm: XTerm, cmd: string, args: string[], cwd?: string) {
  switch (cmd) {
    case 'help':
      xterm.writeln('Available commands:');
      xterm.writeln('  help        - Show this help message');
      xterm.writeln('  clear       - Clear the terminal');
      xterm.writeln('  ls          - List files (mock)');
      xterm.writeln('  pwd         - Print working directory');
      xterm.writeln('  echo        - Print text');
      xterm.writeln('  date        - Show current date');
      xterm.writeln('  whoami      - Show current user');
      break;
    case 'clear':
      xterm.clear();
      return;
    case 'ls':
      xterm.writeln('\x1b[34msrc\x1b[0m  \x1b[34mpublic\x1b[0m  package.json  tsconfig.json  README.md');
      break;
    case 'pwd':
      xterm.writeln(cwd || '/home/project');
      break;
    case 'echo':
      xterm.writeln(args.join(' '));
      break;
    case 'date':
      xterm.writeln(new Date().toString());
      break;
    case 'whoami':
      xterm.writeln('developer');
      break;
    case 'exit':
      xterm.writeln('\x1b[33mTerminal session ended. Press Enter to restart.\x1b[0m');
      break;
    default:
      xterm.writeln(`\x1b[31mCommand not found: ${cmd}\x1b[0m`);
  }
}

export interface XTerminalProps {
  className?: string;
  cwd?: string;
}

export default function XTerminal({ className, cwd }: XTerminalProps) {
  const [terminals, setTerminals] = useState<Array<{ id: string; profile: TerminalProfile }>>([
    { id: 'terminal-1', profile: defaultProfiles[0] }
  ]);
  const [activeTerminal, setActiveTerminal] = useState('terminal-1');
  const [isSplit, setIsSplit] = useState(false);

  const addTerminal = useCallback((profile?: TerminalProfile) => {
    const id = `terminal-${Date.now()}`;
    setTerminals(prev => [...prev, { id, profile: profile || defaultProfiles[0] }]);
    setActiveTerminal(id);
  }, []);

  const closeTerminal = useCallback((id: string) => {
    setTerminals(prev => {
      if (prev.length <= 1) return prev;
      const filtered = prev.filter(t => t.id !== id);
      if (activeTerminal === id) {
        setActiveTerminal(filtered[filtered.length - 1].id);
      }
      return filtered;
    });
  }, [activeTerminal]);

  const activeTerminalData = terminals.find(t => t.id === activeTerminal);

  return (
    <div className={cn('h-full flex flex-col bg-zinc-950', className)}>
      {/* Terminal Tabs */}
      <div className="flex items-center gap-1 px-2 py-1 bg-zinc-900 border-b border-zinc-800 shrink-0">
        {terminals.map(terminal => (
          <button
            key={terminal.id}
            onClick={() => setActiveTerminal(terminal.id)}
            className={cn(
              'flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors',
              activeTerminal === terminal.id
                ? 'bg-zinc-800 text-white'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
            )}
          >
            <TerminalIcon className="h-3 w-3" />
            <span>{terminal.profile.name}</span>
            {terminals.length > 1 && (
              <X
                className="h-3 w-3 ml-1 hover:text-red-400"
                onClick={(e) => {
                  e.stopPropagation();
                  closeTerminal(terminal.id);
                }}
              />
            )}
          </button>
        ))}
        
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6 text-zinc-400 hover:text-white"
          onClick={() => addTerminal()}
        >
          <Plus className="h-3 w-3" />
        </Button>

        <div className="flex-1" />

        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6 text-zinc-400 hover:text-white"
          onClick={() => setIsSplit(!isSplit)}
        >
          <SplitSquareHorizontal className="h-3 w-3" />
        </Button>

        {/* Profile Selector */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="ghost" className="h-6 text-xs text-zinc-400 hover:text-white">
              <TerminalIcon className="h-3 w-3 mr-1" />
              Profile
              <ChevronDown className="h-3 w-3 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-zinc-900 border-zinc-800">
            {defaultProfiles.map(profile => (
              <DropdownMenuItem
                key={profile.id}
                onClick={() => addTerminal(profile)}
                className="text-xs text-zinc-300 hover:text-white hover:bg-zinc-800"
              >
                {profile.name}
                {profile.isDefault && <Badge variant="secondary" className="ml-2 text-[10px]">Default</Badge>}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Terminal Content */}
      <div className={cn('flex-1 flex', isSplit && 'divide-x divide-zinc-800')}>
        {activeTerminalData && (
          <TerminalInstance
            key={activeTerminal}
            id={activeTerminal}
            profile={activeTerminalData.profile}
            cwd={cwd}
            onClose={closeTerminal}
            onSplit={() => setIsSplit(true)}
          />
        )}
        {isSplit && terminals.length > 1 && (
          <TerminalInstance
            key={terminals[terminals.length - 2].id}
            id={terminals[terminals.length - 2].id}
            profile={terminals[terminals.length - 2].profile}
            cwd={cwd}
            onClose={closeTerminal}
          />
        )}
      </div>
    </div>
  );
}
