'use client';

import React, { useRef, useEffect, useCallback, useState, useImperativeHandle, forwardRef } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import 'xterm/css/xterm.css';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Plus, X, Terminal as TerminalIcon, Maximize2, Minimize2, 
  Copy, Clipboard, TerminalSquare, ChevronDown, FolderOpen,
  CheckCircle, XCircle, AlertCircle
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

export interface TerminalProfile {
  id: string;
  name: string;
  shell: string;
  args?: string[];
  icon?: string;
  color?: string;
  isDefault?: boolean;
  isCustom?: boolean;
}

export interface TerminalSession {
  id: string;
  name: string;
  profile: TerminalProfile;
  cwd?: string;
  createdAt: Date;
  lastActivity: Date;
  exitCode?: number;
  commandHistory: string[];
  currentCommand?: string;
}

export interface TerminalState {
  cwd: string;
  isRunning: boolean;
  exitCode: number | null;
  lastCommand: string;
  environment: Record<string, string>;
}

export interface TerminalProps {
  className?: string;
  onCommand?: (command: string, exitCode: number | null) => void;
  onCwdChange?: (cwd: string) => void;
  profile?: TerminalProfile;
  sessionId?: string;
  onStateChange?: (state: TerminalState) => void;
  fontSize?: number;
  fontFamily?: string;
}

// ============================================================================
// DEFAULT PROFILES
// ============================================================================

export const DEFAULT_PROFILES: TerminalProfile[] = [
  {
    id: 'bash',
    name: 'Bash',
    shell: '/bin/bash',
    args: ['-l'],
    icon: '🐚',
    color: '#4EAA25',
    isDefault: true,
  },
  {
    id: 'zsh',
    name: 'Zsh',
    shell: '/bin/zsh',
    args: ['-l'],
    icon: '⚡',
    color: '#F40009',
  },
  {
    id: 'powershell',
    name: 'PowerShell',
    shell: 'pwsh',
    args: ['-NoLogo'],
    icon: '💻',
    color: '#5391FE',
  },
  {
    id: 'node',
    name: 'Node.js REPL',
    shell: 'node',
    args: [],
    icon: '🟢',
    color: '#339933',
  },
  {
    id: 'sh',
    name: 'Sh',
    shell: '/bin/sh',
    args: [],
    icon: '📜',
    color: '#888888',
  },
];

// ============================================================================
// TERMINAL THEME
// ============================================================================

const TERMINAL_THEME = {
  background: '#0c0c0c',
  foreground: '#cccccc',
  cursor: '#ffffff',
  cursorAccent: '#000000',
  selectionBackground: 'rgba(255, 255, 255, 0.3)',
  selectionForeground: '#ffffff',
  // Standard ANSI colors
  black: '#0c0c0c',
  red: '#c50f1f',
  green: '#13a10e',
  yellow: '#c19c00',
  blue: '#0037da',
  magenta: '#881798',
  cyan: '#3a96dd',
  white: '#cccccc',
  // Bright ANSI colors
  brightBlack: '#767676',
  brightRed: '#e74856',
  brightGreen: '#16c60c',
  brightYellow: '#f9f1a5',
  brightBlue: '#3b78ff',
  brightMagenta: '#b4009e',
  brightCyan: '#61d6d6',
  brightWhite: '#f2f2f2',
  // Extended colors
  extendedAnsi: [
    '#0c0c0c', '#c50f1f', '#13a10e', '#c19c00', '#0037da', '#881798', '#3a96dd', '#cccccc',
    '#767676', '#e74856', '#16c60c', '#f9f1a5', '#3b78ff', '#b4009e', '#61d6d6', '#f2f2f2',
  ],
};

// ============================================================================
// TERMINAL COMPONENT
// ============================================================================

const Terminal = forwardRef<{
  focus: () => void;
  clear: () => void;
  write: (data: string) => void;
  writeln: (data: string) => void;
  resize: () => void;
  getState: () => TerminalState;
}, TerminalProps>(function Terminal(
  { 
    className, 
    onCommand, 
    onCwdChange, 
    profile = DEFAULT_PROFILES[0],
    sessionId,
    onStateChange,
    fontSize = 13,
    fontFamily = 'JetBrains Mono, Menlo, Monaco, Consolas, monospace'
  },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  
  // State
  const [cwd, setCwd] = useState<string>('/home/project');
  const [isRunning, setIsRunning] = useState(false);
  const [exitCode, setExitCode] = useState<number | null>(null);
  const [lastCommand, setLastCommand] = useState('');
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [currentInput, setCurrentInput] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);
  const [isFocused, setIsFocused] = useState(false);

  // Expose terminal methods
  useImperativeHandle(ref, () => ({
    focus: () => terminalRef.current?.focus(),
    clear: () => terminalRef.current?.clear(),
    write: (data: string) => terminalRef.current?.write(data),
    writeln: (data: string) => terminalRef.current?.writeln(data),
    resize: () => fitAddonRef.current?.fit(),
    getState: () => ({
      cwd,
      isRunning,
      exitCode,
      lastCommand,
      environment: {},
    }),
  }), [cwd, isRunning, exitCode, lastCommand]);

  // Notify state changes
  useEffect(() => {
    onStateChange?.({
      cwd,
      isRunning,
      exitCode,
      lastCommand,
      environment: {},
    });
  }, [cwd, isRunning, exitCode, lastCommand, onStateChange]);

  // Initialize terminal
  useEffect(() => {
    if (!containerRef.current || terminalRef.current) return;

    const term = new XTerm({
      theme: TERMINAL_THEME,
      fontFamily,
      fontSize,
      lineHeight: 1.2,
      cursorBlink: true,
      cursorStyle: 'bar',
      cursorWidth: 2,
      scrollback: 10000,
      allowTransparency: true,
      allowProposedApi: true,
      macOptionIsMeta: true,
      altClickMovesCursor: true,
      rightClickSelectsWord: true,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon((event, uri) => {
      window.open(uri, '_blank', 'noopener,noreferrer');
    });

    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);
    term.open(containerRef.current);
    fitAddon.fit();

    terminalRef.current = term;
    fitAddonRef.current = fitAddon;

    // Welcome message with profile info
    term.writeln('\x1b[1;36m╔══════════════════════════════════════════════════════════╗\x1b[0m');
    term.writeln('\x1b[1;36m║\x1b[0m  \x1b[1;32mKyro IDE Terminal v2.0\x1b[0m                              \x1b[1;36m║\x1b[0m');
    term.writeln('\x1b[1;36m║\x1b[0m  \x1b[90mProfile: \x1b[33m' + profile.name + '\x1b[0m' + ' '.repeat(Math.max(0, 46 - profile.name.length)) + '\x1b[1;36m║\x1b[0m');
    term.writeln('\x1b[1;36m╚══════════════════════════════════════════════════════════╝\x1b[0m');
    term.writeln('');
    term.writeln('\x1b[90mType "help" for available commands\x1b[0m');
    term.writeln('\x1b[90mUse Ctrl+C to cancel current command\x1b[0m');
    term.writeln('');
    writePrompt(term);

    // Handle keyboard input
    let inputBuffer = '';
    let cursorPos = 0;

    term.onKey(({ key, domEvent }) => {
      const printable = !domEvent.altKey && !domEvent.ctrlKey && !domEvent.metaKey;

      // Handle keyboard shortcuts
      if (domEvent.ctrlKey) {
        switch (domEvent.key.toLowerCase()) {
          case 'c':
            // Ctrl+C - interrupt
            if (inputBuffer.length > 0) {
              term.writeln('^C');
              inputBuffer = '';
              cursorPos = 0;
              writePrompt(term);
            }
            return;
          case 'l':
            // Ctrl+L - clear screen
            term.clear();
            writePrompt(term, inputBuffer, cursorPos);
            return;
          case 'u':
            // Ctrl+U - clear line before cursor
            if (cursorPos > 0) {
              inputBuffer = inputBuffer.slice(cursorPos);
              cursorPos = 0;
              rewriteLine(term, inputBuffer, cursorPos);
            }
            return;
          case 'k':
            // Ctrl+K - clear line after cursor
            if (cursorPos < inputBuffer.length) {
              inputBuffer = inputBuffer.slice(0, cursorPos);
              rewriteLine(term, inputBuffer, cursorPos);
            }
            return;
          case 'a':
            // Ctrl+A - go to beginning
            cursorPos = 0;
            updateCursorPosition(term, inputBuffer.length, cursorPos);
            return;
          case 'e':
            // Ctrl+E - go to end
            cursorPos = inputBuffer.length;
            updateCursorPosition(term, inputBuffer.length, cursorPos);
            return;
          case 'w':
            // Ctrl+W - delete word before cursor
            if (cursorPos > 0) {
              let newCursorPos = cursorPos;
              // Skip spaces
              while (newCursorPos > 0 && inputBuffer[newCursorPos - 1] === ' ') {
                newCursorPos--;
              }
              // Find word boundary
              while (newCursorPos > 0 && inputBuffer[newCursorPos - 1] !== ' ') {
                newCursorPos--;
              }
              inputBuffer = inputBuffer.slice(0, newCursorPos) + inputBuffer.slice(cursorPos);
              cursorPos = newCursorPos;
              rewriteLine(term, inputBuffer, cursorPos);
            }
            return;
          case 'r':
            // Ctrl+R - reverse search (simplified)
            term.write('\x1b[33m(reverse-i-search)`\x1b[0m');
            return;
        }
      }

      switch (domEvent.key) {
        case 'Enter':
          term.writeln('');
          if (inputBuffer.trim()) {
            // Add to history
            setCommandHistory(prev => [...prev, inputBuffer.trim()]);
            setHistoryIndex(-1);
            setLastCommand(inputBuffer.trim());
            setCurrentInput('');
            
            // Execute command
            const result = executeCommand(inputBuffer.trim(), term, cwd, setCwd);
            setExitCode(result.exitCode);
            setIsRunning(false);
            onCommand?.(inputBuffer.trim(), result.exitCode);
          }
          inputBuffer = '';
          cursorPos = 0;
          writePrompt(term);
          break;

        case 'Backspace':
          if (cursorPos > 0) {
            inputBuffer = inputBuffer.slice(0, cursorPos - 1) + inputBuffer.slice(cursorPos);
            cursorPos--;
            rewriteLine(term, inputBuffer, cursorPos);
          }
          break;

        case 'Delete':
          if (cursorPos < inputBuffer.length) {
            inputBuffer = inputBuffer.slice(0, cursorPos) + inputBuffer.slice(cursorPos + 1);
            rewriteLine(term, inputBuffer, cursorPos);
          }
          break;

        case 'ArrowLeft':
          if (cursorPos > 0) {
            cursorPos--;
            term.write('\x1b[D');
          }
          break;

        case 'ArrowRight':
          if (cursorPos < inputBuffer.length) {
            cursorPos++;
            term.write('\x1b[C');
          }
          break;

        case 'ArrowUp':
          // History navigation
          setCommandHistory(prev => {
            if (prev.length === 0) return prev;
            const newIndex = historyIndex < prev.length - 1 ? historyIndex + 1 : historyIndex;
            setHistoryIndex(newIndex);
            const historyItem = prev[prev.length - 1 - newIndex];
            if (historyItem !== undefined) {
              inputBuffer = historyItem;
              cursorPos = inputBuffer.length;
              rewriteLine(term, inputBuffer, cursorPos);
            }
            return prev;
          });
          break;

        case 'ArrowDown':
          // History navigation down
          if (historyIndex > 0) {
            setHistoryIndex(historyIndex - 1);
            const historyItem = commandHistory[commandHistory.length - historyIndex];
            if (historyItem !== undefined) {
              inputBuffer = historyItem;
              cursorPos = inputBuffer.length;
              rewriteLine(term, inputBuffer, cursorPos);
            }
          } else if (historyIndex === 0) {
            setHistoryIndex(-1);
            inputBuffer = '';
            cursorPos = 0;
            rewriteLine(term, inputBuffer, cursorPos);
          }
          break;

        case 'Home':
          cursorPos = 0;
          updateCursorPosition(term, inputBuffer.length, cursorPos);
          break;

        case 'End':
          cursorPos = inputBuffer.length;
          updateCursorPosition(term, inputBuffer.length, cursorPos);
          break;

        case 'Escape':
          // Cancel current input
          inputBuffer = '';
          cursorPos = 0;
          term.writeln('');
          writePrompt(term);
          break;

        case 'Tab':
          // Tab completion (simplified)
          term.write('\x1b[33m[TAB]\x1b[0m');
          break;

        default:
          if (printable && key.length === 1) {
            inputBuffer = inputBuffer.slice(0, cursorPos) + key + inputBuffer.slice(cursorPos);
            cursorPos++;
            rewriteLine(term, inputBuffer, cursorPos);
          }
      }
    });

    // Handle paste
    term.onPaste((data) => {
      const lines = data.split('\n');
      if (lines.length === 1) {
        inputBuffer = inputBuffer.slice(0, cursorPos) + data + inputBuffer.slice(cursorPos);
        cursorPos += data.length;
        rewriteLine(term, inputBuffer, cursorPos);
      } else {
        // Multi-line paste
        term.writeln('');
        lines.forEach((line, index) => {
          if (line.trim()) {
            executeCommand(line, term, cwd, setCwd);
          }
          if (index < lines.length - 1) {
            term.writeln('');
          }
        });
        inputBuffer = '';
        cursorPos = 0;
        writePrompt(term);
      }
    });

    // Focus handling
    term.onFocus(() => setIsFocused(true));
    term.onBlur(() => setIsFocused(false));

    // Resize handling
    const handleResize = () => {
      fitAddon.fit();
    };
    window.addEventListener('resize', handleResize);

    // Click to focus
    containerRef.current.addEventListener('click', () => {
      term.focus();
    });

    // Right-click context menu (copy/paste)
    containerRef.current.addEventListener('contextmenu', async (e) => {
      e.preventDefault();
      const selection = term.getSelection();
      if (selection) {
        await navigator.clipboard.writeText(selection);
        term.write('\x1b[32m[Copied]\x1b[0m');
      }
    });

    return () => {
      window.removeEventListener('resize', handleResize);
      term.dispose();
      terminalRef.current = null;
    };
  }, [profile, fontSize, fontFamily]);

  // Resize on container resize
  useEffect(() => {
    if (fitAddonRef.current) {
      const timer = setTimeout(() => fitAddonRef.current?.fit(), 100);
      return () => clearTimeout(timer);
    }
  }, [className]);

  // Helper functions
  const writePrompt = useCallback((term: XTerm, input: string = '', cursor: number = input.length) => {
    const promptCwd = cwd === process.env.HOME ? '~' : cwd.split('/').pop() || cwd;
    term.write(`\x1b[1;32m➜\x1b[0m \x1b[1;34m${promptCwd}\x1b[0m $ `);
    if (input) {
      term.write(input);
      if (cursor < input.length) {
        updateCursorPosition(term, input.length, cursor);
      }
    }
  }, [cwd]);

  const rewriteLine = useCallback((term: XTerm, input: string, cursor: number) => {
    // Clear current line and rewrite
    term.write('\x1b[2K\r'); // Clear line
    const promptCwd = cwd === process.env.HOME ? '~' : cwd.split('/').pop() || cwd;
    term.write(`\x1b[1;32m➜\x1b[0m \x1b[1;34m${promptCwd}\x1b[0m $ ${input}`);
    // Move cursor to correct position
    const promptLength = 3 + promptCwd.length + 3; // ➜ + space + cwd + space + $ + space
    const totalLength = promptLength + input.length;
    const targetPos = promptLength + cursor;
    if (cursor < input.length) {
      term.write(`\x1b[${totalLength - targetPos}D`);
    }
  }, [cwd]);

  const updateCursorPosition = useCallback((term: XTerm, inputLength: number, cursor: number) => {
    const promptCwd = cwd === process.env.HOME ? '~' : cwd.split('/').pop() || cwd;
    const promptLength = 3 + promptCwd.length + 3;
    const totalLength = promptLength + inputLength;
    const targetPos = promptLength + cursor;
    const diff = totalLength - targetPos;
    if (diff > 0) {
      term.write(`\x1b[${diff}D`);
    } else if (diff < 0) {
      term.write(`\x1b[${-diff}C`);
    }
  }, [cwd]);

  const executeCommand = useCallback((
    cmd: string, 
    term: XTerm, 
    currentCwd: string,
    setCwd: (cwd: string) => void
  ): { exitCode: number; output?: string } => {
    const [command, ...args] = cmd.split(' ');
    let exitCode = 0;
    let newCwd = currentCwd;

    // Track commands for history
    setLastCommand(cmd);
    setIsRunning(true);

    switch (command) {
      case 'help':
        term.writeln('\x1b[1;33m═══════════════════════════════════════════════════════════\x1b[0m');
        term.writeln('\x1b[1;33m                    Available Commands                      \x1b[0m');
        term.writeln('\x1b[1;33m═══════════════════════════════════════════════════════════\x1b[0m');
        term.writeln('  \x1b[36mhelp\x1b[0m        Show this help message');
        term.writeln('  \x1b[36mclear\x1b[0m       Clear terminal screen');
        term.writeln('  \x1b[36mls\x1b[0m          List directory contents');
        term.writeln('  \x1b[36mcd\x1b[0m          Change directory');
        term.writeln('  \x1b[36mpwd\x1b[0m         Print working directory');
        term.writeln('  \x1b[36mecho\x1b[0m        Print text to terminal');
        term.writeln('  \x1b[36mcat\x1b[0m         Display file contents');
        term.writeln('  \x1b[36mmkdir\x1b[0m       Create directory');
        term.writeln('  \x1b[36mtouch\x1b[0m       Create empty file');
        term.writeln('  \x1b[36mrm\x1b[0m          Remove file');
        term.writeln('  \x1b[36mdate\x1b[0m        Show current date/time');
        term.writeln('  \x1b[36mversion\x1b[0m     Show terminal version');
        term.writeln('  \x1b[36menv\x1b[0m         Show environment variables');
        term.writeln('  \x1b[36mexport\x1b[0m      Set environment variable');
        term.writeln('  \x1b[36mhistory\x1b[0m     Show command history');
        term.writeln('  \x1b[36mexit\x1b[0m        Close terminal session');
        term.writeln('\x1b[1;33m═══════════════════════════════════════════════════════════\x1b[0m');
        break;

      case 'clear':
        term.clear();
        return { exitCode: 0 };

      case 'ls':
        term.writeln('\x1b[1;34msrc/\x1b[0m  \x1b[1;34mpublic/\x1b[0m  \x1b[1;34mnode_modules/\x1b[0m  \x1b[1;34m.lib/\x1b[0m');
        term.writeln('\x1b[32mpackage.json\x1b[0m  \x1b[32mtsconfig.json\x1b[0m  \x1b[32mREADME.md\x1b[0m  \x1b[32m.next.config.js\x1b[0m');
        term.writeln('\x1b[33m.env.local\x1b[0m  \x1b[33m.env.example\x1b[0m  \x1b[33m.gitignore\x1b[0m');
        break;

      case 'cd':
        if (args.length === 0 || args[0] === '~') {
          newCwd = '/home/project';
        } else if (args[0] === '..') {
          newCwd = currentCwd.split('/').slice(0, -1).join('/') || '/';
        } else if (args[0].startsWith('/')) {
          newCwd = args[0];
        } else {
          newCwd = `${currentCwd}/${args[0]}`.replace(/\/+/g, '/');
        }
        setCwd(newCwd);
        onCwdChange?.(newCwd);
        break;

      case 'pwd':
        term.writeln(currentCwd);
        break;

      case 'echo':
        term.writeln(args.join(' '));
        break;

      case 'cat':
        if (args.length === 0) {
          term.writeln('\x1b[1;31mError: Missing file operand\x1b[0m');
          exitCode = 1;
        } else {
          term.writeln(`\x1b[90m// Contents of ${args[0]}\x1b[0m`);
          term.writeln('\x1b[32mimport React from "react";\x1b[0m');
          term.writeln('\x1b[32mexport default function Component() {\x1b[0m');
          term.writeln('\x1b[32m  return <div>Hello World</div>;\x1b[0m');
          term.writeln('\x1b[32m}\x1b[0m');
        }
        break;

      case 'mkdir':
        if (args.length === 0) {
          term.writeln('\x1b[1;31mError: Missing directory name\x1b[0m');
          exitCode = 1;
        } else {
          term.writeln(`\x1b[32mDirectory '${args[0]}' created\x1b[0m`);
        }
        break;

      case 'touch':
        if (args.length === 0) {
          term.writeln('\x1b[1;31mError: Missing file name\x1b[0m');
          exitCode = 1;
        } else {
          term.writeln(`\x1b[32mFile '${args[0]}' created\x1b[0m`);
        }
        break;

      case 'rm':
        if (args.length === 0) {
          term.writeln('\x1b[1;31mError: Missing file operand\x1b[0m');
          exitCode = 1;
        } else {
          term.writeln(`\x1b[32mRemoved '${args[0]}'\x1b[0m`);
        }
        break;

      case 'date':
        term.writeln(new Date().toString());
        break;

      case 'version':
        term.writeln('\x1b[1;36mKyro IDE Terminal v2.0\x1b[0m');
        term.writeln(`\x1b[90mProfile: ${profile.name}\x1b[0m`);
        term.writeln('\x1b[90mBuilt with xterm.js\x1b[0m');
        term.writeln('\x1b[90mFeatures: ANSI colors, scrollback, copy/paste, links\x1b[0m');
        break;

      case 'env':
        term.writeln('\x1b[1;36mEnvironment Variables:\x1b[0m');
        term.writeln('  \x1b[33mNODE_ENV\x1b[0m=development');
        term.writeln('  \x1b[33mHOME\x1b[0m=/home/project');
        term.writeln('  \x1b[33mPATH\x1b[0m=/usr/local/bin:/usr/bin:/bin');
        term.writeln('  \x1b[33mSHELL\x1b[0m=' + profile.shell);
        break;

      case 'export':
        if (args.length === 0) {
          term.writeln('\x1b[1;31mError: Missing variable assignment\x1b[0m');
          exitCode = 1;
        } else {
          const [varName, ...varValue] = args.join(' ').split('=');
          term.writeln(`\x1b[32mSet ${varName}=${varValue.join('=')}\x1b[0m`);
        }
        break;

      case 'history':
        term.writeln('\x1b[1;36mCommand History:\x1b[0m');
        commandHistory.slice(-10).forEach((cmd, i) => {
          term.writeln(`  ${(commandHistory.length - 10 + i + 1).toString().padStart(4)}  ${cmd}`);
        });
        break;

      case 'exit':
        term.writeln('\x1b[90mSession closed. Press Enter to start new session.\x1b[0m');
        break;

      case 'npm':
      case 'yarn':
      case 'pnpm':
      case 'bun':
        term.writeln(`\x1b[1;36m${command}\x1b[0m ${args.join(' ')}`);
        term.writeln('\x1b[90m⠋ Running...\x1b[0m');
        setTimeout(() => {
          term.writeln('\x1b[32m✓ Done in 0.5s\x1b[0m');
        }, 500);
        break;

      case 'git':
        term.writeln(`\x1b[1;36mgit\x1b[0m ${args.join(' ')}`);
        if (args[0] === 'status') {
          term.writeln('On branch \x1b[1;33mmain\x1b[0m');
          term.writeln('Your branch is up to date with \'origin/main\'.');
          term.writeln('');
          term.writeln('Changes not staged for commit:');
          term.writeln('  \x1b[31mmodified:   src/app/page.tsx\x1b[0m');
        } else if (args[0] === 'log') {
          term.writeln('\x1b[33mcommit abc123\x1b[0m Author: Developer <dev@example.com>');
          term.writeln('    Initial commit');
        }
        break;

      default:
        term.writeln(`\x1b[1;31mCommand not found: ${command}\x1b[0m`);
        term.writeln('\x1b[90mType "help" for available commands\x1b[0m');
        exitCode = 127;
    }

    return { exitCode };
  }, [profile, commandHistory, onCwdChange]);

  // Copy to clipboard
  const handleCopy = useCallback(async () => {
    const selection = terminalRef.current?.getSelection();
    if (selection) {
      await navigator.clipboard.writeText(selection);
    }
  }, []);

  // Paste from clipboard
  const handlePaste = useCallback(async () => {
    const text = await navigator.clipboard.readText();
    terminalRef.current?.paste(text);
  }, []);

  return (
    <div className={cn('h-full flex flex-col bg-zinc-950', className)}>
      {/* Terminal content */}
      <div 
        ref={containerRef} 
        className={cn(
          'flex-1 p-1 overflow-hidden',
          isFocused && 'ring-1 ring-primary/20'
        )} 
      />
    </div>
  );
});

export default Terminal;
