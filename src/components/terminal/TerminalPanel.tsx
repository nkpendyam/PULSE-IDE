'use client';

import React, { useRef, useEffect, useCallback, useState } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import 'xterm/css/xterm.css';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Plus, X, Terminal } from 'lucide-react';

interface TerminalInstance {
  id: string;
  name: string;
  cwd?: string;
}

interface TerminalPanelProps {
  className?: string;
  onCommand?: (command: string) => void;
}

export default function TerminalPanel({ className, onCommand }: TerminalPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [terminals, setTerminals] = useState<TerminalInstance[]>([
    { id: 'terminal-1', name: 'Terminal' }
  ]);
  const [activeTerminal, setActiveTerminal] = useState('terminal-1');
  const [inputBuffer, setInputBuffer] = useState('');

  // Initialize terminal
  useEffect(() => {
    if (!containerRef.current || terminalRef.current) return;

    const term = new XTerm({
      theme: {
        background: '#0c0c0c',
        foreground: '#cccccc',
        cursor: '#ffffff',
        cursorAccent: '#000000',
        selectionBackground: 'rgba(255, 255, 255, 0.3)',
        black: '#0c0c0c',
        red: '#c50f1f',
        green: '#13a10e',
        yellow: '#c19c00',
        blue: '#0037da',
        magenta: '#881798',
        cyan: '#3a96dd',
        white: '#cccccc',
        brightBlack: '#767676',
        brightRed: '#e74856',
        brightGreen: '#16c60c',
        brightYellow: '#f9f1a5',
        brightBlue: '#3b78ff',
        brightMagenta: '#b4009e',
        brightCyan: '#61d6d6',
        brightWhite: '#f2f2f2',
      },
      fontFamily: 'JetBrains Mono, Menlo, Monaco, monospace',
      fontSize: 13,
      lineHeight: 1.2,
      cursorBlink: true,
      cursorStyle: 'bar',
      scrollback: 10000,
      allowTransparency: true,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);
    term.open(containerRef.current);

    fitAddon.fit();
    terminalRef.current = term;
    fitAddonRef.current = fitAddon;

    // Welcome message
    term.writeln('\x1b[1;36m╔════════════════════════════════════════╗\x1b[0m');
    term.writeln('\x1b[1;36m║     Kyro IDE Terminal v1.0.0        ║\x1b[0m');
    term.writeln('\x1b[1;36m╚════════════════════════════════════════╝\x1b[0m');
    term.writeln('');
    term.writeln('\x1b[90mType "help" for available commands\x1b[0m');
    term.writeln('');
    term.write('\x1b[1;32m➜\x1b[0m \x1b[1;34m~\x1b[0m $ ');

    // Handle input
    let currentLine = '';
    let cursorPosition = 0;

    term.onKey(({ key, domEvent }) => {
      const printable = !domEvent.altKey && !domEvent.ctrlKey && !domEvent.metaKey;

      if (domEvent.key === 'Enter') {
        term.writeln('');
        if (currentLine.trim()) {
          handleCommand(currentLine.trim(), term);
        }
        currentLine = '';
        cursorPosition = 0;
        term.write('\x1b[1;32m➜\x1b[0m \x1b[1;34m~\x1b[0m $ ');
      } else if (domEvent.key === 'Backspace') {
        if (cursorPosition > 0) {
          currentLine = currentLine.slice(0, cursorPosition - 1) + currentLine.slice(cursorPosition);
          cursorPosition--;
          term.write('\b \b');
        }
      } else if (domEvent.key === 'Delete') {
        if (cursorPosition < currentLine.length) {
          currentLine = currentLine.slice(0, cursorPosition) + currentLine.slice(cursorPosition + 1);
          term.write('\x1b[P');
        }
      } else if (domEvent.key === 'ArrowLeft') {
        if (cursorPosition > 0) {
          cursorPosition--;
          term.write('\x1b[D');
        }
      } else if (domEvent.key === 'ArrowRight') {
        if (cursorPosition < currentLine.length) {
          cursorPosition++;
          term.write('\x1b[C');
        }
      } else if (domEvent.key === 'ArrowUp') {
        // History up
      } else if (domEvent.key === 'ArrowDown') {
        // History down
      } else if (domEvent.key === 'Escape') {
        currentLine = '';
        cursorPosition = 0;
        term.writeln('');
        term.write('\x1b[1;32m➜\x1b[0m \x1b[1;34m~\x1b[0m $ ');
      } else if (printable) {
        currentLine = currentLine.slice(0, cursorPosition) + key + currentLine.slice(cursorPosition);
        cursorPosition++;
        term.write(key);
      }
    });

    // Handle resize
    const handleResize = () => {
      fitAddon.fit();
    };
    window.addEventListener('resize', handleResize);

    // Focus terminal on click
    containerRef.current.addEventListener('click', () => {
      term.focus();
    });

    return () => {
      window.removeEventListener('resize', handleResize);
      term.dispose();
      terminalRef.current = null;
    };
  }, []);

  // Handle commands
  const handleCommand = useCallback((cmd: string, term: XTerm) => {
    const [command, ...args] = cmd.split(' ');

    switch (command) {
      case 'help':
        term.writeln('\x1b[1;33mAvailable Commands:\x1b[0m');
        term.writeln('  \x1b[36mhelp\x1b[0m      - Show this help');
        term.writeln('  \x1b[36mclear\x1b[0m     - Clear terminal');
        term.writeln('  \x1b[36mls\x1b[0m        - List files');
        term.writeln('  \x1b[36mpwd\x1b[0m       - Print working directory');
        term.writeln('  \x1b[36mecho\x1b[0m      - Print text');
        term.writeln('  \x1b[36mdate\x1b[0m      - Show current date/time');
        term.writeln('  \x1b[36mversion\x1b[0m   - Show version info');
        term.writeln('  \x1b[36mexit\x1b[0m      - Close terminal');
        break;
      case 'clear':
        term.clear();
        break;
      case 'ls':
        term.writeln('\x1b[1;34msrc/\x1b[0m  \x1b[1;34mpublic/\x1b[0m  \x1b[1;34mnode_modules/\x1b[0m');
        term.writeln('\x1b[32mpackage.json\x1b[0m  \x1b[32mtsconfig.json\x1b[0m  \x1b[32mREADME.md\x1b[0m');
        break;
      case 'pwd':
        term.writeln('/home/project');
        break;
      case 'echo':
        term.writeln(args.join(' '));
        break;
      case 'date':
        term.writeln(new Date().toString());
        break;
      case 'version':
        term.writeln('\x1b[1;36mKyro IDE Terminal v1.0.0\x1b[0m');
        term.writeln('Built with xterm.js');
        break;
      case 'exit':
        term.writeln('\x1b[90mTerminal closed.\x1b[0m');
        break;
      default:
        term.writeln(`\x1b[1;31mCommand not found: ${command}\x1b[0m`);
        term.writeln(`\x1b[90mType "help" for available commands\x1b[0m`);
    }

    onCommand?.(cmd);
  }, [onCommand]);

  // Create new terminal
  const createTerminal = useCallback(() => {
    const id = `terminal-${Date.now()}`;
    setTerminals(prev => [...prev, { id, name: `Terminal ${prev.length + 1}` }]);
    setActiveTerminal(id);
  }, []);

  // Close terminal
  const closeTerminal = useCallback((id: string) => {
    setTerminals(prev => {
      if (prev.length <= 1) return prev;
      const filtered = prev.filter(t => t.id !== id);
      if (activeTerminal === id) {
        setActiveTerminal(filtered[0].id);
      }
      return filtered;
    });
  }, [activeTerminal]);

  return (
    <div className={cn('h-full flex flex-col bg-zinc-950', className)}>
      {/* Tab bar */}
      <div className="flex items-center bg-zinc-900 border-b border-zinc-800">
        <div className="flex-1 flex items-center overflow-x-auto">
          {terminals.map(t => (
            <div
              key={t.id}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 border-r border-zinc-800 cursor-pointer',
                activeTerminal === t.id ? 'bg-zinc-950 text-white' : 'text-zinc-400 hover:bg-zinc-800'
              )}
              onClick={() => setActiveTerminal(t.id)}
            >
              <Terminal className="h-3 w-3" />
              <span className="text-xs">{t.name}</span>
              {terminals.length > 1 && (
                <X
                  className="h-3 w-3 hover:text-red-400"
                  onClick={(e) => { e.stopPropagation(); closeTerminal(t.id); }}
                />
              )}
            </div>
          ))}
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6 mr-1" onClick={createTerminal}>
          <Plus className="h-3 w-3" />
        </Button>
      </div>

      {/* Terminal container */}
      <div ref={containerRef} className="flex-1 p-1 overflow-hidden" />
    </div>
  );
}
