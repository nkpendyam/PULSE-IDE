/**
 * Kyro IDE Workspace Manager
 * Multi-root workspace support with project configuration
 */

export interface WorkspaceFolder {
  uri: string;
  name: string;
  path: string;
}

export interface WorkspaceConfig {
  folders: WorkspaceFolder[];
  settings: Record<string, unknown>;
  extensions?: { recommendations?: string[]; unwanted?: string[] };
  tasks?: TaskConfig[];
  launch?: LaunchConfig[];
}

export interface TaskConfig {
  label: string;
  type: string;
  command: string;
  args?: string[];
  options?: { cwd?: string; env?: Record<string, string> };
  problemMatcher?: string;
  group?: { kind: 'build' | 'test'; isDefault?: boolean };
}

export interface LaunchConfig {
  type: string;
  request: 'launch' | 'attach';
  name: string;
  program?: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  console?: 'internalConsole' | 'integratedTerminal' | 'externalTerminal';
}

export interface RecentWorkspace {
  path: string;
  name: string;
  lastOpened: Date;
  folderCount: number;
}

class WorkspaceManager {
  private current: WorkspaceConfig | null = null;
  private recent: RecentWorkspace[] = [];
  private maxRecent = 20;

  create(folders: WorkspaceFolder[], settings: Record<string, unknown> = {}): WorkspaceConfig {
    return { folders, settings, extensions: { recommendations: [] }, tasks: [], launch: [] };
  }

  async open(path: string): Promise<WorkspaceConfig> {
    const config: WorkspaceConfig = {
      folders: [{ uri: `file://${path}`, name: path.split('/').pop() || 'Project', path }],
      settings: {},
    };
    this.current = config;
    this.addRecent(path, 1);
    return config;
  }

  close(): void { this.current = null; }
  get(): WorkspaceConfig | null { return this.current; }
  getFolders(): WorkspaceFolder[] { return this.current?.folders || []; }

  addFolder(f: WorkspaceFolder): void { this.current?.folders.push(f); }
  removeFolder(uri: string): void {
    if (this.current) this.current.folders = this.current.folders.filter(f => f.uri !== uri);
  }

  getSettings(): Record<string, unknown> { return this.current?.settings || {}; }
  updateSettings(s: Record<string, unknown>): void {
    if (this.current) this.current.settings = { ...this.current.settings, ...s };
  }

  getTasks(): TaskConfig[] { return this.current?.tasks || []; }
  addTask(t: TaskConfig): void { this.current?.tasks?.push(t); }
  getLaunchConfigs(): LaunchConfig[] { return this.current?.launch || []; }
  addLaunchConfig(c: LaunchConfig): void { this.current?.launch?.push(c); }

  private addRecent(path: string, count: number): void {
    const name = path.split('/').pop() || 'Workspace';
    this.recent = this.recent.filter(w => w.path !== path);
    this.recent.unshift({ path, name, lastOpened: new Date(), folderCount: count });
    if (this.recent.length > this.maxRecent) this.recent.pop();
  }

  getRecent(): RecentWorkspace[] { return [...this.recent]; }
  clearRecent(): void { this.recent = []; }
  export(): string { return JSON.stringify(this.current, null, 2); }
  import(json: string): WorkspaceConfig { return this.current = JSON.parse(json); }
}

export const workspaceManager = new WorkspaceManager();

export const defaultTasks: TaskConfig[] = [
  { label: 'dev', type: 'shell', command: 'npm', args: ['run', 'dev'], group: { kind: 'build', isDefault: true } },
  { label: 'build', type: 'shell', command: 'npm', args: ['run', 'build'], group: { kind: 'build' } },
  { label: 'test', type: 'shell', command: 'npm', args: ['test'], group: { kind: 'test', isDefault: true } },
];

export const defaultLaunchConfigs: LaunchConfig[] = [
  { type: 'node', request: 'launch', name: 'Launch', program: '${workspaceFolder}/src/index.ts', console: 'integratedTerminal' },
];
