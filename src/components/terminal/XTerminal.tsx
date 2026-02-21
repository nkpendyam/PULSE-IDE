'use client';

import React, { useRef, useEffect, useCallback, useState } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import { SearchAddon } from 'xterm-addon-search';
import { Unicode11Addon } from 'xterm-addon-unicode11';
import 'xterm/css/xterm.css';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, X, Terminal as TerminalIcon, ChevronDown, SplitSquareHorizontal, Maximize2, Minimize2, Copy, Trash2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { BrowserPseudoPTY, detectDefaultShell, getAvailableShells } from '@/lib/terminal/pty-service';

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
  onTitleChange?: (title: string) => void;
}

function TerminalInstance({ id, profile, cwd, onClose, onSplit, onTitleChange }: TerminalInstanceProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const ptyRef = useRef<BrowserPseudoPTY | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [exitCode, setExitCode] = useState<number | null>(null);
  const [isRunning, setIsRunning] = useState(true);

  useEffect(() => {
    if (!terminalRef.current || xtermRef.current) return;

    const xterm = new XTerm({
      cursorBlink: true,
      cursorStyle: 'block',
      fontSize: 13,
      fontFamily: 'JetBrains Mono, Menlo, Monaco, "Cascadia Code", monospace',
      theme: {
        background: '#0c0c0c',
        foreground: '#cccccc',
        cursor: '#ffffff',
        cursorAccent: '#000000',
        selectionBackground: 'rgba(255, 255, 255, 0.3)',
        selectionForeground: '#000000',
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
      convertEol: true,
      windowsMode: false,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    const searchAddon = new SearchAddon();
    const unicode11Addon = new Unicode11Addon();

    xterm.loadAddon(fitAddon);
    xterm.loadAddon(webLinksAddon);
    xterm.loadAddon(searchAddon);
    xterm.loadAddon(unicode11Addon);
    xterm.open(terminalRef.current);
    xterm.unicode.activeVersion = '11';

    fitAddon.fit();
    xtermRef.current = xterm;
    fitAddonRef.current = fitAddon;
    setIsReady(true);

    // Initialize PTY
    ptyRef.current = new BrowserPseudoPTY(cwd);

    // Welcome message
    xterm.writeln('\x1b[1;36m╭───────────────────────────────────────╮\x1b[0m');
    xterm.writeln('\x1b[1;36m│\x1b[0m       \x1b[1;32mKyro IDE Terminal\x1b[0m            \x1b[1;36m│\x1b[0m');
    xterm.writeln('\x1b[1;36m│\x1b[0m   \x1b[90mPrivacy-First AI-Powered IDE\x1b[0m     \x1b[1;36m│\x1b[0m');
    xterm.writeln('\x1b[1;36m╰───────────────────────────────────────╯\x1b[0m');
    xterm.writeln('');
    xterm.writeln(`  \x1b[90mShell:\x1b[0m ${profile.name} (${profile.shell})`);
    xterm.writeln(`  \x1b[90mDirectory:\x1b[0m ${cwd || ptyRef.current.getCwd()}`);
    xterm.writeln(`  \x1b[90mType 'help' for available commands\x1b[0m`);
    xterm.writeln('');
    xterm.write(`\x1b[1;34m${ptyRef.current.getCwd()}\x1b[0m $ `);

    let currentLine = '';

    // Handle input
    xterm.onData(async (data) => {
      if (!ptyRef.current || !isRunning) return;

      // Handle special keys
      if (data === '\r') { // Enter
        xterm.writeln('');
        
        if (currentLine.trim()) {
          const output = await ptyRef.current.execute(currentLine);
          
          // Handle clear command
          if (output.includes('\x1b[2J')) {
            xterm.clear();
            xterm.write(`\x1b[1;34m${ptyRef.current.getCwd()}\x1b[0m $ `);
          } else if (output) {
            xterm.writeln(output);
            xterm.write(`\x1b[1;34m${ptyRef.current.getCwd()}\x1b[0m $ `);
          } else {
            xterm.write(`\x1b[1;34m${ptyRef.current.getCwd()}\x1b[0m $ `);
          }
        } else {
          xterm.write(`\x1b[1;34m${ptyRef.current.getCwd()}\x1b[0m $ `);
        }
        
        currentLine = '';
      } else if (data === '\x7f') { // Backspace
        if (currentLine.length > 0) {
          currentLine = currentLine.slice(0, -1);
          xterm.write('\b \b');
        }
      } else if (data === '\x1b[A') { // Up arrow
        const historyLine = ptyRef.current.navigateHistory('up', currentLine);
        clearLine(xterm, currentLine);
        currentLine = historyLine;
        xterm.write(currentLine);
      } else if (data === '\x1b[B') { // Down arrow
        const historyLine = ptyRef.current.navigateHistory('down', currentLine);
        clearLine(xterm, currentLine);
        currentLine = historyLine;
        xterm.write(currentLine);
      } else if (data === '\x1b[C') { // Right arrow
        xterm.write(data);
      } else if (data === '\x1b[D') { // Left arrow
        xterm.write(data);
      } else if (data === '\x03') { // Ctrl+C
        xterm.writeln('^C');
        currentLine = '';
        xterm.write(`\x1b[1;34m${ptyRef.current.getCwd()}\x1b[0m $ `);
      } else if (data === '\x04') { // Ctrl+D
        xterm.writeln('\x1b[33mGoodbye!\x1b[0m');
        setExitCode(0);
        setIsRunning(false);
      } else if (data === '\x0c') { // Ctrl+L (clear)
        xterm.clear();
        xterm.write(`\x1b[1;34m${ptyRef.current.getCwd()}\x1b[0m $ `);
        if (currentLine) xterm.write(currentLine);
      } else if (data.charCodeAt(0) >= 32) { // Printable characters
        currentLine += data;
        xterm.write(data);
      }
    });

    // Handle resize
    const handleResize = () => {
      fitAddon.fit();
    };
    window.addEventListener('resize', handleResize);

    // Initial fit after a short delay
    setTimeout(() => fitAddon.fit(), 100);

    return () => {
      window.removeEventListener('resize', handleResize);
      xterm.dispose();
      xtermRef.current = null;
      ptyRef.current = null;
    };
  }, [profile, cwd, isRunning]);

  // Resize on container size change
  useEffect(() => {
    if (fitAddonRef.current) {
      const timer = setTimeout(() => fitAddonRef.current?.fit(), 100);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleCopy = useCallback(() => {
    const selection = xtermRef.current?.getSelection();
    if (selection) {
      navigator.clipboard.writeText(selection);
    }
  }, []);

  const handleClear = useCallback(() => {
    xtermRef.current?.clear();
    xtermRef.current?.write(`\x1b[1;34m${ptyRef.current?.getCwd() || '~'}\x1b[0m $ `);
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
          <Button size="sm" variant="ghost" className="h-5 text-xs" onClick={() => { setExitCode(null); setIsRunning(true); }}>
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

export interface XTerminalProps {
  className?: string;
  cwd?: string;
}

export default function XTerminal({ className, cwd }: XTerminalProps) {
  const [terminals, setTerminals] = useState<Array<{ id: string; profile: TerminalProfile; title: string }>>([
    { id: 'terminal-1', profile: defaultProfiles[0], title: 'Bash' }
  ]);
  const [activeTerminal, setActiveTerminal] = useState('terminal-1');
  const [isSplit, setIsSplit] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);

  const addTerminal = useCallback((profile?: TerminalProfile) => {
    const id = `terminal-${Date.now()}`;
    const newProfile = profile || defaultProfiles[0];
    setTerminals(prev => [...prev, { id, profile: newProfile, title: newProfile.name }]);
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
    <div className={cn('h-full flex flex-col bg-zinc-950', isMaximized && 'fixed inset-0 z-50', className)}>
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
            <span>{terminal.title}</span>
            {terminals.length > 1 && (
              <X
                className="h-3 w-3 ml-1 hover:text-red-400"
                onClick={(e) => { e.stopPropagation(); closeTerminal(terminal.id); }}
              />
            )}
          </button>
        ))}
        
        <Button size="icon" variant="ghost" className="h-6 w-6 text-zinc-400 hover:text-white" onClick={() => addTerminal()}>
          <Plus className="h-3 w-3" />
        </Button>

        <div className="flex-1" />

        <Button size="icon" variant="ghost" className="h-6 w-6 text-zinc-400 hover:text-white" onClick={() => setIsSplit(!isSplit)}>
          <SplitSquareHorizontal className="h-3 w-3" />
        </Button>

        <Button size="icon" variant="ghost" className="h-6 w-6 text-zinc-400 hover:text-white" onClick={() => setIsMaximized(!isMaximized)}>
          {isMaximized ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
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
