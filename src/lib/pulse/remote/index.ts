/**
 * Kyro IDE Remote Development Architecture
 * 
 * Remote development support similar to GitHub Codespaces, Gitpod, and
 * VS Code Remote. Enables development on remote machines with local UI.
 * 
 * Features:
 * - Remote file system access
 * - Remote terminal support
 * - Port forwarding
 * - Container-based dev environments
 */

// ============================================================================
// TYPES
// ============================================================================

export interface RemoteHost {
  id: string;
  name: string;
  host: string;
  port: number;
  user?: string;
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  lastConnected?: Date;
  environment: DevEnvironment;
  resources: RemoteResources;
}

export interface DevEnvironment {
  type: 'ssh' | 'container' | 'wsl' | 'codespace';
  os: 'linux' | 'macos' | 'windows';
  shell: string;
  workdir: string;
  gitConfig?: {
    name?: string;
    email?: string;
  };
  tools: InstalledTool[];
  envVars: Record<string, string>;
}

export interface InstalledTool {
  name: string;
  version: string;
  path: string;
}

export interface RemoteResources {
  cpuCores: number;
  memoryGB: number;
  diskGB: number;
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
}

export interface PortForward {
  id: string;
  localPort: number;
  remotePort: number;
  remoteHost: string;
  protocol: 'tcp' | 'udp';
  status: 'active' | 'inactive' | 'error';
  label?: string;
}

export interface RemoteFile {
  path: string;
  name: string;
  isDirectory: boolean;
  size: number;
  modified: Date;
  permissions: string;
  content?: string;
}

export interface RemoteTerminal {
  id: string;
  name: string;
  cwd: string;
  shell: string;
  status: 'running' | 'exited' | 'error';
  pid?: number;
}

export interface ContainerSpec {
  image: string;
  name?: string;
  workdir?: string;
  ports?: number[];
  volumes?: Array<{ host: string; container: string }>;
  env?: Record<string, string>;
  commands?: string[];
}

// ============================================================================
// REMOTE CONNECTION MANAGER
// ============================================================================

export class RemoteConnectionManager {
  private hosts: Map<string, RemoteHost> = new Map();
  private portForwards: Map<string, PortForward> = new Map();
  private terminals: Map<string, RemoteTerminal> = new Map();
  private currentHost: RemoteHost | null = null;
  private ws: WebSocket | null = null;
  private messageHandlers: Map<string, (msg: any) => void> = new Map();

  /**
   * Add a remote host configuration
   */
  addHost(config: Omit<RemoteHost, 'id' | 'status'>): RemoteHost {
    const host: RemoteHost = {
      ...config,
      id: `host-${Date.now()}`,
      status: 'disconnected',
    };
    this.hosts.set(host.id, host);
    return host;
  }

  /**
   * Connect to a remote host
   */
  async connect(hostId: string): Promise<RemoteHost> {
    const host = this.hosts.get(hostId);
    if (!host) throw new Error(`Host ${hostId} not found`);

    host.status = 'connecting';

    try {
      const wsUrl = `ws://${host.host}:${host.port}/agent`;
      
      await new Promise<void>((resolve, reject) => {
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          this.sendMessage({
            type: 'auth',
            user: host.user,
            timestamp: Date.now(),
          });
        };

        this.ws.onmessage = (event) => {
          const msg = JSON.parse(event.data);
          if (msg.type === 'auth_success') {
            resolve();
          } else if (msg.type === 'auth_failed') {
            reject(new Error('Authentication failed'));
          }
        };

        this.ws.onerror = () => {
          reject(new Error('Connection failed'));
        };

        setTimeout(() => reject(new Error('Connection timeout')), 30000);
      });

      host.status = 'connected';
      host.lastConnected = new Date();
      this.currentHost = host;

      this.ws.onmessage = (event) => {
        this.handleMessage(JSON.parse(event.data));
      };

      return host;
    } catch (error) {
      host.status = 'error';
      throw error;
    }
  }

  /**
   * Disconnect from current host
   */
  async disconnect(): Promise<void> {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    if (this.currentHost) {
      this.currentHost.status = 'disconnected';
    }

    this.currentHost = null;
    this.portForwards.clear();
    this.terminals.clear();
  }

  /**
   * Get current host
   */
  getCurrentHost(): RemoteHost | null {
    return this.currentHost;
  }

  /**
   * Get all hosts
   */
  getHosts(): RemoteHost[] {
    return Array.from(this.hosts.values());
  }

  // =========================================================================
  // FILE SYSTEM OPERATIONS
  // =========================================================================

  /**
   * List files in directory
   */
  async listFiles(path: string): Promise<RemoteFile[]> {
    const response = await this.request('fs:list', { path });
    return response.files.map((f: RemoteFile) => ({
      ...f,
      modified: new Date(f.modified),
    }));
  }

  /**
   * Read file content
   */
  async readFile(path: string): Promise<string> {
    const response = await this.request('fs:read', { path });
    return response.content;
  }

  /**
   * Write file content
   */
  async writeFile(path: string, content: string): Promise<void> {
    await this.request('fs:write', { path, content });
  }

  /**
   * Delete file or directory
   */
  async delete(path: string, recursive: boolean = false): Promise<void> {
    await this.request('fs:delete', { path, recursive });
  }

  /**
   * Create directory
   */
  async mkdir(path: string): Promise<void> {
    await this.request('fs:mkdir', { path });
  }

  /**
   * Move/rename file or directory
   */
  async move(source: string, destination: string): Promise<void> {
    await this.request('fs:move', { source, destination });
  }

  /**
   * Copy file or directory
   */
  async copy(source: string, destination: string): Promise<void> {
    await this.request('fs:copy', { source, destination });
  }

  /**
   * Search files
   */
  async searchFiles(query: string, options: {
    path?: string;
    caseSensitive?: boolean;
    regex?: boolean;
    includeHidden?: boolean;
  } = {}): Promise<RemoteFile[]> {
    const response = await this.request('fs:search', { query, ...options });
    return response.results.map((f: RemoteFile) => ({
      ...f,
      modified: new Date(f.modified),
    }));
  }

  // =========================================================================
  // TERMINAL OPERATIONS
  // =========================================================================

  /**
   * Create a new terminal
   */
  async createTerminal(options: {
    name?: string;
    cwd?: string;
    shell?: string;
  } = {}): Promise<RemoteTerminal> {
    const response = await this.request('terminal:create', {
      name: options.name || `Terminal ${this.terminals.size + 1}`,
      cwd: options.cwd || this.currentHost?.environment.workdir,
      shell: options.shell || this.currentHost?.environment.shell,
    });

    const terminal: RemoteTerminal = {
      id: response.terminalId,
      name: options.name || `Terminal ${this.terminals.size + 1}`,
      cwd: options.cwd || this.currentHost?.environment.workdir || '/',
      shell: options.shell || this.currentHost?.environment.shell || '/bin/bash',
      status: 'running',
      pid: response.pid,
    };

    this.terminals.set(terminal.id, terminal);
    return terminal;
  }

  /**
   * Send data to terminal
   */
  async sendTerminalData(terminalId: string, data: string): Promise<void> {
    await this.sendMessage({
      type: 'terminal:data',
      terminalId,
      data,
    });
  }

  /**
   * Resize terminal
   */
  async resizeTerminal(terminalId: string, cols: number, rows: number): Promise<void> {
    await this.sendMessage({
      type: 'terminal:resize',
      terminalId,
      cols,
      rows,
    });
  }

  /**
   * Close terminal
   */
  async closeTerminal(terminalId: string): Promise<void> {
    await this.request('terminal:close', { terminalId });
    this.terminals.delete(terminalId);
  }

  /**
   * Get all terminals
   */
  getTerminals(): RemoteTerminal[] {
    return Array.from(this.terminals.values());
  }

  // =========================================================================
  // PORT FORWARDING
  // =========================================================================

  /**
   * Create port forward
   */
  async createPortForward(options: {
    localPort: number;
    remotePort: number;
    remoteHost?: string;
    protocol?: 'tcp' | 'udp';
    label?: string;
  }): Promise<PortForward> {
    const forward: PortForward = {
      id: `pf-${Date.now()}`,
      localPort: options.localPort,
      remotePort: options.remotePort,
      remoteHost: options.remoteHost || 'localhost',
      protocol: options.protocol || 'tcp',
      status: 'active',
      label: options.label,
    };

    await this.request('portforward:create', {
      localPort: forward.localPort,
      remotePort: forward.remotePort,
      remoteHost: forward.remoteHost,
      protocol: forward.protocol,
    });

    this.portForwards.set(forward.id, forward);
    return forward;
  }

  /**
   * Stop port forward
   */
  async stopPortForward(forwardId: string): Promise<void> {
    const forward = this.portForwards.get(forwardId);
    if (!forward) return;

    await this.request('portforward:stop', {
      localPort: forward.localPort,
      remotePort: forward.remotePort,
    });

    forward.status = 'inactive';
  }

  /**
   * Get all port forwards
   */
  getPortForwards(): PortForward[] {
    return Array.from(this.portForwards.values());
  }

  // =========================================================================
  // CONTAINER OPERATIONS
  // =========================================================================

  /**
   * Create and start a dev container
   */
  async startDevContainer(spec: ContainerSpec): Promise<RemoteHost> {
    const response = await this.request('container:start', spec);

    const containerHost: RemoteHost = {
      id: `container-${response.containerId}`,
      name: spec.name || response.containerId,
      host: 'localhost',
      port: 22,
      status: 'connected',
      environment: {
        type: 'container',
        os: 'linux',
        shell: '/bin/bash',
        workdir: spec.workdir || '/workspace',
        tools: [],
        envVars: spec.env || {},
      },
      resources: {
        cpuCores: 0,
        memoryGB: 0,
        diskGB: 0,
        cpuUsage: 0,
        memoryUsage: 0,
        diskUsage: 0,
      },
    };

    return containerHost;
  }

  /**
   * Stop dev container
   */
  async stopDevContainer(containerId: string): Promise<void> {
    await this.request('container:stop', { containerId });
  }

  /**
   * Get container logs
   */
  async getContainerLogs(containerId: string, tail?: number): Promise<string[]> {
    const response = await this.request('container:logs', { containerId, tail });
    return response.logs;
  }

  /**
   * Register message handler
   */
  onMessage(type: string, handler: (msg: any) => void): void {
    this.messageHandlers.set(type, handler);
  }

  // =========================================================================
  // HELPER METHODS
  // =========================================================================

  /**
   * Send message to remote agent
   */
  private sendMessage(message: object): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  /**
   * Request-response pattern
   */
  private async request(type: string, payload: object): Promise<any> {
    return new Promise((resolve, reject) => {
      const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      const handler = (event: MessageEvent) => {
        const msg = JSON.parse(event.data);
        if (msg.requestId === requestId) {
          this.ws?.removeEventListener('message', handler);

          if (msg.error) {
            reject(new Error(msg.error));
          } else {
            resolve(msg.payload);
          }
        }
      };

      this.ws?.addEventListener('message', handler);

      this.sendMessage({
        type,
        requestId,
        payload,
      });

      setTimeout(() => {
        this.ws?.removeEventListener('message', handler);
        reject(new Error('Request timeout'));
      }, 30000);
    });
  }

  /**
   * Handle incoming messages
   */
  private handleMessage(message: any): void {
    const handler = this.messageHandlers.get(message.type);
    if (handler) {
      handler(message);
    }

    switch (message.type) {
      case 'terminal:output':
        console.log(`Terminal ${message.terminalId}:`, message.data);
        break;

      case 'terminal:exit':
        const term = this.terminals.get(message.terminalId);
        if (term) {
          term.status = 'exited';
        }
        break;

      case 'fs:watch':
        console.log(`FS Event: ${message.event} on ${message.path}`);
        break;

      case 'resources':
        if (this.currentHost) {
          this.currentHost.resources = {
            ...this.currentHost.resources,
            ...message.resources,
          };
        }
        break;
    }
  }
}

// ============================================================================
// DEV CONTAINER SPEC BUILDER
// ============================================================================

export class DevContainerBuilder {
  private spec: ContainerSpec;

  constructor(image: string) {
    this.spec = { image };
  }

  name(name: string): this {
    this.spec.name = name;
    return this;
  }

  workdir(path: string): this {
    this.spec.workdir = path;
    return this;
  }

  port(port: number): this {
    this.spec.ports = [...(this.spec.ports || []), port];
    return this;
  }

  volume(host: string, container: string): this {
    this.spec.volumes = [...(this.spec.volumes || []), { host, container }];
    return this;
  }

  env(key: string, value: string): this {
    this.spec.env = { ...this.spec.env, [key]: value };
    return this;
  }

  run(command: string): this {
    this.spec.commands = [...(this.spec.commands || []), command];
    return this;
  }

  build(): ContainerSpec {
    return this.spec;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const createRemoteManager = () => new RemoteConnectionManager();
export const createDevContainer = (image: string) => new DevContainerBuilder(image);
