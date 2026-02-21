/**
 * Kyro IDE PTY Service
 * 
 * Provides real terminal functionality via WebSocket connection to
 * a backend PTY server. Supports multiple shells and process management.
 */

// ============================================================================
// TYPES
// ============================================================================

export interface PTYOptions {
  shell: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  cols?: number;
  rows?: number;
}

export interface PTYProcess {
  id: string;
  pid: number;
  shell: string;
  cwd: string;
  status: 'running' | 'exited' | 'error';
  exitCode?: number;
}

export interface PTYOutput {
  pid: string;
  data: string;
  type: 'stdout' | 'stderr';
}

export interface PTYExit {
  pid: string;
  exitCode: number;
  signal?: number;
}

export type PTYEventHandler = {
  onOutput?: (output: PTYOutput) => void;
  onExit?: (exit: PTYExit) => void;
  onError?: (error: Error) => void;
};

// ============================================================================
// SHELL DETECTION
// ============================================================================

export function detectDefaultShell(): string {
  if (typeof window === 'undefined') return '/bin/bash';
  const platform = navigator.platform.toLowerCase();
  if (platform.includes('win')) return 'powershell.exe';
  if (platform.includes('mac')) return '/bin/zsh';
  return '/bin/bash';
}

export function getAvailableShells(): string[] {
  if (typeof window === 'undefined') return ['/bin/bash'];
  const platform = navigator.platform.toLowerCase();
  if (platform.includes('win')) return ['powershell.exe', 'cmd.exe', 'bash.exe'];
  if (platform.includes('mac')) return ['/bin/zsh', '/bin/bash', '/bin/sh'];
  return ['/bin/bash', '/bin/zsh', '/bin/sh'];
}

// ============================================================================
// PTY SERVICE (WebSocket-based for Tauri backend)
// ============================================================================

class PTYService {
  private ws: WebSocket | null = null;
  private processes: Map<string, PTYProcess> = new Map();
  private handlers: Map<string, PTYEventHandler> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private messageQueue: string[] = [];
  private isConnected = false;
  private url: string;

  constructor(url?: string) {
    this.url = url || 'ws://localhost:3001/pty';
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);
        this.ws.onopen = () => {
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.flushMessageQueue();
          resolve();
        };
        this.ws.onmessage = (event) => this.handleMessage(JSON.parse(event.data));
        this.ws.onclose = () => {
          this.isConnected = false;
          this.attemptReconnect();
        };
        this.ws.onerror = () => reject(new Error('Failed to connect to PTY server'));
      } catch (error) {
        reject(error);
      }
    });
  }

  disconnect(): void {
    if (this.ws) { this.ws.close(); this.ws = null; }
    this.processes.clear();
    this.handlers.clear();
    this.isConnected = false;
  }

  spawn(options: PTYOptions, handlers: PTYEventHandler = {}): Promise<PTYProcess> {
    return new Promise((resolve) => {
      const id = `pty-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const process: PTYProcess = { id, pid: 0, shell: options.shell, cwd: options.cwd || '/', status: 'running' };
      this.processes.set(id, process);
      this.handlers.set(id, handlers);
      this.send({ type: 'spawn', id, payload: { shell: options.shell, args: options.args || [], cwd: options.cwd, env: options.env, cols: options.cols || 80, rows: options.rows || 24 } });
      resolve(process);
    });
  }

  write(pid: string, data: string): void { this.send({ type: 'input', pid, data }); }
  resize(pid: string, cols: number, rows: number): void { this.send({ type: 'resize', pid, cols, rows }); }
  kill(pid: string, signal?: string): void {
    this.send({ type: 'kill', pid, signal: signal || 'SIGTERM' });
    const process = this.processes.get(pid);
    if (process) process.status = 'exited';
  }

  getProcesses(): PTYProcess[] { return Array.from(this.processes.values()).filter(p => p.status === 'running'); }
  getProcess(id: string): PTYProcess | undefined { return this.processes.get(id); }
  connected(): boolean { return this.isConnected; }

  private send(message: object): void {
    const data = JSON.stringify(message);
    if (this.isConnected && this.ws?.readyState === WebSocket.OPEN) this.ws.send(data);
    else this.messageQueue.push(data);
  }

  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0 && this.isConnected) this.ws?.send(this.messageQueue.shift()!);
  }

  private handleMessage(message: any): void {
    if (message.type === 'spawned') {
      const process = this.processes.get(message.id);
      if (process) process.pid = message.pid;
    } else if (message.type === 'output') {
      this.handlers.get(message.pid)?.onOutput?.(message);
    } else if (message.type === 'exit') {
      const process = this.processes.get(message.pid);
      if (process) { process.status = 'exited'; process.exitCode = message.exitCode; }
      this.handlers.get(message.pid)?.onExit?.(message);
      this.processes.delete(message.pid);
      this.handlers.delete(message.pid);
    } else if (message.type === 'error') {
      const process = this.processes.get(message.pid);
      if (process) process.status = 'error';
      this.handlers.get(message.pid)?.onError?.(new Error(message.error));
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return;
    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    setTimeout(() => this.connect().catch(() => {}), delay);
  }
}

export const ptyService = new PTYService();

// ============================================================================
// BROWSER PTY FALLBACK (simulated shell for preview mode)
// ============================================================================

export class BrowserPseudoPTY {
  private cwd: string;
  private env: Record<string, string>;
  private history: string[] = [];
  private historyIndex = -1;
  private variables: Record<string, string> = {};
  private aliases: Record<string, string> = {};
  private fileSystem: Map<string, string>;

  constructor(cwd: string = '/home/project', env: Record<string, string> = {}) {
    this.cwd = cwd;
    this.env = { HOME: '/home/user', USER: 'developer', SHELL: '/bin/bash', PWD: cwd, PATH: '/usr/local/bin:/usr/bin:/bin', ...env };
    this.aliases = { ll: 'ls -la', la: 'ls -a', l: 'ls', cls: 'clear' };
    this.fileSystem = new Map([
      ['package.json', JSON.stringify({ name: 'kyro-ide', version: '0.1.0', scripts: { dev: 'next dev', build: 'next build' }, dependencies: { next: '14.0.0', react: '18.2.0' } }, null, 2)],
      ['tsconfig.json', JSON.stringify({ compilerOptions: { target: 'es5', lib: ['dom', 'esnext'], strict: true, module: 'esnext', jsx: 'preserve' } }, null, 2)],
      ['README.md', '# Kyro IDE\n\nPrivacy-first AI-powered IDE\n'],
      ['.gitignore', 'node_modules/\n.next/\n.env\n'],
    ]);
  }

  async execute(input: string): Promise<string> {
    const trimmed = input.trim();
    if (!trimmed) return '';
    this.history.push(trimmed);
    this.historyIndex = this.history.length;
    return this.processCommand(trimmed);
  }

  private processCommand(input: string): string {
    const parts = input.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || [];
    const cmd = parts[0];
    const args = parts.slice(1).map(a => a.replace(/^["']|["']$/g, ''));
    const resolved = this.aliases[cmd] ? `${this.aliases[cmd]} ${args.join(' ')}` : input;
    if (resolved !== input) return this.processCommand(resolved);

    switch (cmd) {
      case 'pwd': return this.cwd;
      case 'cd': return this.cd(args[0]);
      case 'ls': return this.ls(args);
      case 'cat': return this.cat(args[0]);
      case 'echo': return args.join(' ').replace(/\$(\w+)/g, (_, n) => this.env[n] || '');
      case 'env': return Object.entries(this.env).map(([k, v]) => `${k}=${v}`).join('\n');
      case 'date': return new Date().toString();
      case 'whoami': return this.env.USER;
      case 'hostname': return 'kyro-ide';
      case 'uname': return args.includes('-a') ? 'Linux kyro-ide 5.15.0 x86_64' : 'Linux';
      case 'history': return this.history.map((h, i) => `  ${i + 1}  ${h}`).join('\n');
      case 'clear': return '\x1b[2J\x1b[H';
      case 'exit': return '\x1b[33mGoodbye!\x1b[0m';
      case 'help': return this.help();
      case 'mkdir': return '';
      case 'touch': return '';
      case 'rm': return '';
      case 'head': return this.cat(args[args.length - 1]).split('\n').slice(0, 10).join('\n');
      case 'tail': return this.cat(args[args.length - 1]).split('\n').slice(-10).join('\n');
      case 'wc': { const c = this.cat(args[1]); return `  ${c.split('\n').length}  ${c.split(/\s+/).length} ${c.length} ${args[1]}`; }
      case 'grep': { const p = args[0]; const c = this.cat(args[1]); return c.split('\n').filter(l => l.includes(p)).join('\n'); }
      case 'find': return '.\n./src\n./src/app\n./src/components\n./src/lib';
      case 'which': return `/${cmd}: shell builtin`;
      case 'type': return this.aliases[args[0]] ? `${args[0]} is aliased to \`${this.aliases[args[0]]}'` : `${args[0]}: shell builtin`;
      default:
        const assign = input.match(/^([A-Za-z_]\w*)=(.*)$/);
        if (assign) { this.variables[assign[1]] = assign[2]; return ''; }
        return `\x1b[31mbash: ${cmd}: command not found\x1b[0m`;
    }
  }

  private cd(path?: string): string {
    if (!path || path === '~') this.cwd = this.env.HOME;
    else if (path === '..') this.cwd = this.cwd.split('/').slice(0, -1).join('/') || '/';
    else if (path.startsWith('/')) this.cwd = path;
    else this.cwd = `${this.cwd}/${path}`.replace(/\/+/g, '/');
    this.env.PWD = this.cwd;
    return '';
  }

  private ls(args: string[]): string {
    const dirs = ['\x1b[34msrc\x1b[0m', '\x1b[34mpublic\x1b[0m', '\x1b[34mnode_modules\x1b[0m'];
    const files = ['package.json', 'tsconfig.json', 'README.md', '.gitignore'];
    const all = args.includes('-a') || args.includes('-la');
    const long = args.includes('-l') || args.includes('-la');
    const items = [...dirs, ...files];
    if (long) return `total ${items.length}\n${items.map(f => `drwxr-xr-x 1 developer developer 4096 Jan  5 10:00 ${f}`).join('\n')}`;
    return items.join('  ');
  }

  private cat(file?: string): string {
    if (!file) return 'cat: missing file';
    return this.fileSystem.get(file) || `cat: ${file}: No such file`;
  }

  private help(): string {
    return `Kyro IDE Terminal - Built-in Commands

Navigation: cd, pwd, ls
Files: cat, head, tail, grep, wc, find
System: env, date, whoami, uname
Shell: history, clear, help, exit`;
  }

  getCwd(): string { return this.cwd; }
  getHistory(): string[] { return [...this.history]; }
  navigateHistory(dir: 'up' | 'down', cur: string): string {
    if (dir === 'up' && this.historyIndex > 0) return this.history[--this.historyIndex];
    if (dir === 'down' && this.historyIndex < this.history.length - 1) return this.history[++this.historyIndex];
    if (dir === 'down') { this.historyIndex = this.history.length; return cur; }
    return cur;
  }
}

export const browserPty = new BrowserPseudoPTY();
