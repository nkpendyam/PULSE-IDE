/**
 * Kyro IDE - Remote Development
 * SSH and Docker connection management
 */

import { EventEmitter } from 'events';

// ============================================================================
// TYPES
// ============================================================================

export interface SSHConnectionConfig {
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKey?: string;
  passphrase?: string;
  name?: string;
}

export interface DockerContainerConfig {
  containerId: string;
  name?: string;
  image?: string;
  workingDir?: string;
  user?: string;
  env?: Record<string, string>;
}

export interface RemoteSession {
  id: string;
  type: 'ssh' | 'docker';
  name: string;
  connected: boolean;
  config: SSHConnectionConfig | DockerContainerConfig;
  workingDirectory: string;
  connectedAt?: Date;
  error?: string;
}

export interface RemoteFile {
  path: string;
  name: string;
  type: 'file' | 'directory' | 'symlink';
  size: number;
  modifiedAt: Date;
  permissions: string;
  owner?: string;
  group?: string;
}

export interface RemoteTerminal {
  id: string;
  sessionId: string;
  type: 'ssh' | 'docker-exec';
  cwd: string;
  active: boolean;
}

// ============================================================================
// SSH CONNECTION MANAGER
// ============================================================================

class SSHConnectionManager extends EventEmitter {
  private connections: Map<string, RemoteSession> = new Map();

  async connect(config: SSHConnectionConfig): Promise<RemoteSession> {
    const sessionId = `ssh-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const session: RemoteSession = {
      id: sessionId,
      type: 'ssh',
      name: config.name || `${config.username}@${config.host}`,
      connected: false,
      config,
      workingDirectory: '/home/' + config.username,
    };

    try {
      // In Tauri, this would use the ssh2 crate via Rust
      // For web demo, simulate connection
      await this.simulateConnection(config);
      
      session.connected = true;
      session.connectedAt = new Date();
      this.connections.set(sessionId, session);
      
      this.emit('connected', session);
      return session;
    } catch (error) {
      session.error = error instanceof Error ? error.message : 'Connection failed';
      this.emit('error', { session, error });
      throw error;
    }
  }

  private async simulateConnection(config: SSHConnectionConfig): Promise<void> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Validate config
    if (!config.host || !config.username) {
      throw new Error('Host and username are required');
    }
    
    if (!config.password && !config.privateKey) {
      throw new Error('Password or private key is required');
    }
  }

  async disconnect(sessionId: string): Promise<void> {
    const session = this.connections.get(sessionId);
    if (session) {
      session.connected = false;
      this.connections.delete(sessionId);
      this.emit('disconnected', sessionId);
    }
  }

  async executeCommand(sessionId: string, command: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const session = this.connections.get(sessionId);
    if (!session || !session.connected) {
      throw new Error('Session not connected');
    }

    // Simulate command execution
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return {
      stdout: `Command executed: ${command}`,
      stderr: '',
      exitCode: 0,
    };
  }

  async listDirectory(sessionId: string, path: string): Promise<RemoteFile[]> {
    const session = this.connections.get(sessionId);
    if (!session || !session.connected) {
      throw new Error('Session not connected');
    }

    // Simulate directory listing
    return [
      { path: `${path}/src`, name: 'src', type: 'directory', size: 0, modifiedAt: new Date(), permissions: 'drwxr-xr-x' },
      { path: `${path}/package.json`, name: 'package.json', type: 'file', size: 1234, modifiedAt: new Date(), permissions: '-rw-r--r--' },
      { path: `${path}/README.md`, name: 'README.md', type: 'file', size: 5678, modifiedAt: new Date(), permissions: '-rw-r--r--' },
    ];
  }

  async readFile(sessionId: string, path: string): Promise<string> {
    const session = this.connections.get(sessionId);
    if (!session || !session.connected) {
      throw new Error('Session not connected');
    }

    return `// Content of ${path}`;
  }

  async writeFile(sessionId: string, path: string, content: string): Promise<void> {
    const session = this.connections.get(sessionId);
    if (!session || !session.connected) {
      throw new Error('Session not connected');
    }
  }

  getSession(sessionId: string): RemoteSession | undefined {
    return this.connections.get(sessionId);
  }

  getActiveSessions(): RemoteSession[] {
    return Array.from(this.connections.values()).filter(s => s.connected);
  }
}

// ============================================================================
// DOCKER MANAGER
// ============================================================================

class DockerManager extends EventEmitter {
  private containers: Map<string, RemoteSession> = new Map();

  async listContainers(): Promise<DockerContainerConfig[]> {
    // Simulate Docker API call
    return [
      { containerId: 'abc123', name: 'node-app', image: 'node:18', workingDir: '/app' },
      { containerId: 'def456', name: 'python-api', image: 'python:3.11', workingDir: '/api' },
    ];
  }

  async connect(config: DockerContainerConfig): Promise<RemoteSession> {
    const sessionId = `docker-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const session: RemoteSession = {
      id: sessionId,
      type: 'docker',
      name: config.name || config.containerId.slice(0, 12),
      connected: false,
      config,
      workingDirectory: config.workingDir || '/app',
    };

    try {
      // Simulate connection
      await new Promise(resolve => setTimeout(resolve, 300));
      
      session.connected = true;
      session.connectedAt = new Date();
      this.containers.set(sessionId, session);
      
      this.emit('connected', session);
      return session;
    } catch (error) {
      session.error = error instanceof Error ? error.message : 'Connection failed';
      this.emit('error', { session, error });
      throw error;
    }
  }

  async disconnect(sessionId: string): Promise<void> {
    const session = this.containers.get(sessionId);
    if (session) {
      session.connected = false;
      this.containers.delete(sessionId);
      this.emit('disconnected', sessionId);
    }
  }

  async executeInContainer(sessionId: string, command: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const session = this.containers.get(sessionId);
    if (!session || !session.connected) {
      throw new Error('Container not connected');
    }

    return {
      stdout: `Executed: ${command.join(' ')}`,
      stderr: '',
      exitCode: 0,
    };
  }

  async createTerminal(sessionId: string): Promise<RemoteTerminal> {
    const session = this.containers.get(sessionId);
    if (!session || !session.connected) {
      throw new Error('Container not connected');
    }

    return {
      id: `term-${Date.now()}`,
      sessionId,
      type: 'docker-exec',
      cwd: session.workingDirectory,
      active: true,
    };
  }

  getSession(sessionId: string): RemoteSession | undefined {
    return this.containers.get(sessionId);
  }

  getActiveSessions(): RemoteSession[] {
    return Array.from(this.containers.values()).filter(s => s.connected);
  }
}

// ============================================================================
// REMOTE WORKSPACE MANAGER
// ============================================================================

interface RemoteWorkspaceProfile {
  id: string;
  name: string;
  type: 'ssh' | 'docker';
  config: SSHConnectionConfig | DockerContainerConfig;
  lastConnected?: Date;
  favorite: boolean;
}

class RemoteWorkspaceManager extends EventEmitter {
  private profiles: Map<string, RemoteWorkspaceProfile> = new Map();
  private storageKey = 'kyro-remote-profiles';

  constructor() {
    super();
    this.loadProfiles();
  }

  private loadProfiles(): void {
    if (typeof localStorage === 'undefined') return;
    
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const profiles = JSON.parse(stored);
        profiles.forEach((p: RemoteWorkspaceProfile) => {
          this.profiles.set(p.id, p);
        });
      }
    } catch (error) {
      console.error('Failed to load remote profiles:', error);
    }
  }

  private saveProfiles(): void {
    if (typeof localStorage === 'undefined') return;
    
    try {
      const profiles = Array.from(this.profiles.values());
      localStorage.setItem(this.storageKey, JSON.stringify(profiles));
    } catch (error) {
      console.error('Failed to save remote profiles:', error);
    }
  }

  saveProfile(profile: Omit<RemoteWorkspaceProfile, 'id'>): RemoteWorkspaceProfile {
    const id = `profile-${Date.now()}`;
    const newProfile: RemoteWorkspaceProfile = {
      ...profile,
      id,
      favorite: profile.favorite || false,
    };

    this.profiles.set(id, newProfile);
    this.saveProfiles();
    this.emit('profileAdded', newProfile);

    return newProfile;
  }

  updateProfile(id: string, updates: Partial<RemoteWorkspaceProfile>): RemoteWorkspaceProfile | undefined {
    const profile = this.profiles.get(id);
    if (!profile) return undefined;

    const updated = { ...profile, ...updates };
    this.profiles.set(id, updated);
    this.saveProfiles();
    this.emit('profileUpdated', updated);

    return updated;
  }

  deleteProfile(id: string): void {
    this.profiles.delete(id);
    this.saveProfiles();
    this.emit('profileDeleted', id);
  }

  getProfile(id: string): RemoteWorkspaceProfile | undefined {
    return this.profiles.get(id);
  }

  getAllProfiles(): RemoteWorkspaceProfile[] {
    return Array.from(this.profiles.values());
  }

  getFavorites(): RemoteWorkspaceProfile[] {
    return this.getAllProfiles().filter(p => p.favorite);
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const sshManager = new SSHConnectionManager();
export const dockerManager = new DockerManager();
export const remoteWorkspaceManager = new RemoteWorkspaceManager();
