/**
 * Recent Files Manager - Track recently opened files with persistence
 * Supports both browser (localStorage/IndexedDB) and Tauri environments
 */

// ============================================================================
// Types
// ============================================================================

export interface RecentFile {
  /** Unique identifier */
  id: string;
  /** File path */
  path: string;
  /** File name (display name) */
  name: string;
  /** File extension */
  extension: string;
  /** Last opened timestamp */
  lastOpened: Date;
  /** First opened timestamp */
  firstOpened: Date;
  /** Number of times opened */
  openCount: number;
  /** File size in bytes */
  size?: number;
  /** MIME type */
  mimeType?: string;
  /** Project/workspace path this file belongs to */
  projectPath?: string;
  /** Cursor position when last closed */
  cursorPosition?: { line: number; column: number };
  /** Scroll position when last closed */
  scrollPosition?: { x: number; y: number };
  /** Custom metadata */
  metadata?: Record<string, unknown>;
  /** Whether the file is pinned */
  pinned?: boolean;
  /** Whether the file still exists */
  exists?: boolean;
}

export interface RecentProject {
  /** Unique identifier */
  id: string;
  /** Project path */
  path: string;
  /** Project name */
  name: string;
  /** Last opened timestamp */
  lastOpened: Date;
  /** Number of times opened */
  openCount: number;
  /** Associated files */
  files: string[];
  /** Is this a favorite project */
  favorite?: boolean;
}

export interface RecentFilesConfig {
  /** Maximum number of recent files to track */
  maxRecentFiles: number;
  /** Maximum number of recent projects to track */
  maxRecentProjects: number;
  /** Storage key prefix */
  storageKey: string;
  /** Whether to track projects */
  trackProjects: boolean;
  /** Whether to verify file existence on load */
  verifyExistence: boolean;
  /** Debounce interval for saves */
  saveDebounceMs: number;
}

export interface RecentFilesListener {
  (event: RecentFilesEvent): void;
}

export type RecentFilesEvent =
  | { type: 'file-added'; file: RecentFile }
  | { type: 'file-removed'; path: string }
  | { type: 'file-updated'; file: RecentFile }
  | { type: 'project-added'; project: RecentProject }
  | { type: 'project-removed'; path: string }
  | { type: 'cleared' }
  | { type: 'loaded' };

// ============================================================================
// Storage Backend Interface
// ============================================================================

interface StorageBackend {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
  clear(): Promise<void>;
}

// ============================================================================
// LocalStorage Backend
// ============================================================================

class LocalStorageBackend implements StorageBackend {
  private prefix: string;

  constructor(prefix: string = 'kyro-recent-') {
    this.prefix = prefix;
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const item = localStorage.getItem(this.prefix + key);
      return item ? JSON.parse(item) : null;
    } catch {
      return null;
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    try {
      localStorage.setItem(this.prefix + key, JSON.stringify(value));
    } catch (error) {
      console.warn('Failed to save to localStorage:', error);
    }
  }

  async remove(key: string): Promise<void> {
    localStorage.removeItem(this.prefix + key);
  }

  async clear(): Promise<void> {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(this.prefix)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));
  }
}

// ============================================================================
// IndexedDB Backend
// ============================================================================

class IndexedDBBackend implements StorageBackend {
  private dbName = 'kyro-recent-files';
  private version = 1;
  private db: IDBDatabase | null = null;
  private prefix: string;

  constructor(prefix: string = '') {
    this.prefix = prefix;
  }

  private async init(): Promise<IDBDatabase> {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('recent-data')) {
          db.createObjectStore('recent-data', { keyPath: 'key' });
        }
      };
    });
  }

  async get<T>(key: string): Promise<T | null> {
    const db = await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['recent-data'], 'readonly');
      const store = transaction.objectStore('recent-data');
      const request = store.get(this.prefix + key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        resolve(request.result?.value ?? null);
      };
    });
  }

  async set<T>(key: string, value: T): Promise<void> {
    const db = await this.init();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['recent-data'], 'readwrite');
      const store = transaction.objectStore('recent-data');
      const request = store.put({ key: this.prefix + key, value });

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async remove(key: string): Promise<void> {
    const db = await this.init();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['recent-data'], 'readwrite');
      const store = transaction.objectStore('recent-data');
      const request = store.delete(this.prefix + key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async clear(): Promise<void> {
    const db = await this.init();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['recent-data'], 'readwrite');
      const store = transaction.objectStore('recent-data');
      const request = store.clear();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }
}

// ============================================================================
// Recent Files Manager
// ============================================================================

export class RecentFilesManager {
  private config: Required<RecentFilesConfig>;
  private storage: StorageBackend;
  private recentFiles: RecentFile[] = [];
  private recentProjects: RecentProject[] = [];
  private listeners: Set<RecentFilesListener> = new Set();
  private saveTimeout: NodeJS.Timeout | null = null;
  private isLoaded = false;

  constructor(config?: Partial<RecentFilesConfig>) {
    this.config = {
      maxRecentFiles: config?.maxRecentFiles ?? 50,
      maxRecentProjects: config?.maxRecentProjects ?? 20,
      storageKey: config?.storageKey ?? 'recent-files',
      trackProjects: config?.trackProjects ?? true,
      verifyExistence: config?.verifyExistence ?? false,
      saveDebounceMs: config?.saveDebounceMs ?? 500,
    };

    // Choose storage backend based on environment
    this.storage = typeof indexedDB !== 'undefined'
      ? new IndexedDBBackend()
      : new LocalStorageBackend();
  }

  // ============================================================================
  // Initialization
  // ============================================================================

  /**
   * Load recent files from storage
   */
  async load(): Promise<void> {
    try {
      const [files, projects] = await Promise.all([
        this.storage.get<RecentFile[]>(`${this.config.storageKey}-files`),
        this.storage.get<RecentProject[]>(`${this.config.storageKey}-projects`),
      ]);

      this.recentFiles = this.parseFiles(files || []);
      this.recentProjects = this.parseProjects(projects || []);
      this.isLoaded = true;

      this.emit({ type: 'loaded' });
    } catch (error) {
      console.error('Failed to load recent files:', error);
      this.recentFiles = [];
      this.recentProjects = [];
    }
  }

  private parseFiles(files: RecentFile[]): RecentFile[] {
    return files.map((f) => ({
      ...f,
      lastOpened: new Date(f.lastOpened),
      firstOpened: new Date(f.firstOpened),
    }));
  }

  private parseProjects(projects: RecentProject[]): RecentProject[] {
    return projects.map((p) => ({
      ...p,
      lastOpened: new Date(p.lastOpened),
    }));
  }

  /**
   * Save recent files to storage
   */
  async save(): Promise<void> {
    if (!this.isLoaded) return;

    // Debounce saves
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }

    this.saveTimeout = setTimeout(async () => {
      try {
        await Promise.all([
          this.storage.set(`${this.config.storageKey}-files`, this.recentFiles),
          this.storage.set(`${this.config.storageKey}-projects`, this.recentProjects),
        ]);
      } catch (error) {
        console.error('Failed to save recent files:', error);
      }
    }, this.config.saveDebounceMs);
  }

  // ============================================================================
  // File Operations
  // ============================================================================

  /**
   * Add or update a file in recent files
   */
  async addFile(file: Omit<RecentFile, 'id' | 'lastOpened' | 'firstOpened' | 'openCount'>): Promise<RecentFile> {
    const now = new Date();
    const existingIndex = this.recentFiles.findIndex((f) => f.path === file.path);

    let recentFile: RecentFile;

    if (existingIndex >= 0) {
      // Update existing file
      recentFile = {
        ...this.recentFiles[existingIndex],
        ...file,
        lastOpened: now,
        openCount: this.recentFiles[existingIndex].openCount + 1,
      };

      // Remove and re-add at the beginning
      this.recentFiles.splice(existingIndex, 1);
      this.recentFiles.unshift(recentFile);

      this.emit({ type: 'file-updated', file: recentFile });
    } else {
      // Add new file
      recentFile = {
        ...file,
        id: this.generateId(),
        lastOpened: now,
        firstOpened: now,
        openCount: 1,
      };

      this.recentFiles.unshift(recentFile);

      // Trim if over limit
      if (this.recentFiles.length > this.config.maxRecentFiles) {
        const removed = this.recentFiles.pop();
        if (removed) {
          this.emit({ type: 'file-removed', path: removed.path });
        }
      }

      this.emit({ type: 'file-added', file: recentFile });
    }

    await this.save();
    return recentFile;
  }

  /**
   * Record opening a file
   */
  async recordFileOpen(
    path: string,
    options?: {
      name?: string;
      projectPath?: string;
      size?: number;
      mimeType?: string;
      cursorPosition?: { line: number; column: number };
      scrollPosition?: { x: number; y: number };
    }
  ): Promise<RecentFile> {
    const name = options?.name ?? this.extractFileName(path);
    const extension = this.extractExtension(path);

    return this.addFile({
      path,
      name,
      extension,
      projectPath: options?.projectPath,
      size: options?.size,
      mimeType: options?.mimeType,
      cursorPosition: options?.cursorPosition,
      scrollPosition: options?.scrollPosition,
    });
  }

  /**
   * Remove a file from recent files
   */
  async removeFile(path: string): Promise<boolean> {
    const index = this.recentFiles.findIndex((f) => f.path === path);
    if (index < 0) return false;

    this.recentFiles.splice(index, 1);
    this.emit({ type: 'file-removed', path });

    await this.save();
    return true;
  }

  /**
   * Pin a file
   */
  async pinFile(path: string): Promise<boolean> {
    const file = this.recentFiles.find((f) => f.path === path);
    if (!file) return false;

    file.pinned = true;
    this.emit({ type: 'file-updated', file });

    await this.save();
    return true;
  }

  /**
   * Unpin a file
   */
  async unpinFile(path: string): Promise<boolean> {
    const file = this.recentFiles.find((f) => f.path === path);
    if (!file) return false;

    file.pinned = false;
    this.emit({ type: 'file-updated', file });

    await this.save();
    return true;
  }

  /**
   * Update file metadata
   */
  async updateFile(
    path: string,
    updates: Partial<Pick<RecentFile, 'cursorPosition' | 'scrollPosition' | 'metadata'>>
  ): Promise<boolean> {
    const file = this.recentFiles.find((f) => f.path === path);
    if (!file) return false;

    Object.assign(file, updates);
    this.emit({ type: 'file-updated', file });

    await this.save();
    return true;
  }

  // ============================================================================
  // Project Operations
  // ============================================================================

  /**
   * Add or update a project
   */
  async addProject(path: string, name?: string): Promise<RecentProject> {
    const now = new Date();
    const existingIndex = this.recentProjects.findIndex((p) => p.path === path);

    let project: RecentProject;

    if (existingIndex >= 0) {
      // Update existing project
      project = {
        ...this.recentProjects[existingIndex],
        name: name ?? this.recentProjects[existingIndex].name,
        lastOpened: now,
        openCount: this.recentProjects[existingIndex].openCount + 1,
      };

      // Remove and re-add at the beginning
      this.recentProjects.splice(existingIndex, 1);
      this.recentProjects.unshift(project);

      this.emit({ type: 'project-added', project });
    } else {
      // Add new project
      project = {
        id: this.generateId(),
        path,
        name: name ?? this.extractProjectName(path),
        lastOpened: now,
        openCount: 1,
        files: [],
      };

      this.recentProjects.unshift(project);

      // Trim if over limit
      if (this.recentProjects.length > this.config.maxRecentProjects) {
        const removed = this.recentProjects.pop();
        if (removed) {
          this.emit({ type: 'project-removed', path: removed.path });
        }
      }

      this.emit({ type: 'project-added', project });
    }

    await this.save();
    return project;
  }

  /**
   * Associate a file with a project
   */
  async associateFileWithProject(filePath: string, projectPath: string): Promise<void> {
    const project = this.recentProjects.find((p) => p.path === projectPath);
    if (project && !project.files.includes(filePath)) {
      project.files.push(filePath);
      await this.save();
    }

    // Also update the file's project path
    const file = this.recentFiles.find((f) => f.path === filePath);
    if (file) {
      file.projectPath = projectPath;
      await this.save();
    }
  }

  /**
   * Remove a project
   */
  async removeProject(path: string): Promise<boolean> {
    const index = this.recentProjects.findIndex((p) => p.path === path);
    if (index < 0) return false;

    this.recentProjects.splice(index, 1);
    this.emit({ type: 'project-removed', path });

    await this.save();
    return true;
  }

  /**
   * Toggle project favorite status
   */
  async toggleProjectFavorite(path: string): Promise<boolean> {
    const project = this.recentProjects.find((p) => p.path === path);
    if (!project) return false;

    project.favorite = !project.favorite;
    await this.save();
    return true;
  }

  // ============================================================================
  // Query Operations
  // ============================================================================

  /**
   * Get all recent files
   */
  getRecentFiles(limit?: number): RecentFile[] {
    const sorted = this.sortFiles();
    return limit ? sorted.slice(0, limit) : sorted;
  }

  /**
   * Get recent files for a specific project
   */
  getRecentFilesByProject(projectPath: string, limit?: number): RecentFile[] {
    const files = this.recentFiles.filter((f) => f.projectPath === projectPath);
    const sorted = this.sortFiles(files);
    return limit ? sorted.slice(0, limit) : sorted;
  }

  /**
   * Get recent files by extension
   */
  getRecentFilesByExtension(extension: string, limit?: number): RecentFile[] {
    const files = this.recentFiles.filter(
      (f) => f.extension.toLowerCase() === extension.toLowerCase()
    );
    const sorted = this.sortFiles(files);
    return limit ? sorted.slice(0, limit) : sorted;
  }

  /**
   * Get pinned files
   */
  getPinnedFiles(): RecentFile[] {
    return this.sortFiles(this.recentFiles.filter((f) => f.pinned));
  }

  /**
   * Get all recent projects
   */
  getRecentProjects(limit?: number): RecentProject[] {
    const sorted = [...this.recentProjects].sort(
      (a, b) => b.lastOpened.getTime() - a.lastOpened.getTime()
    );
    return limit ? sorted.slice(0, limit) : sorted;
  }

  /**
   * Get favorite projects
   */
  getFavoriteProjects(): RecentProject[] {
    return this.recentProjects
      .filter((p) => p.favorite)
      .sort((a, b) => b.lastOpened.getTime() - a.lastOpened.getTime());
  }

  /**
   * Get a specific file
   */
  getFile(path: string): RecentFile | undefined {
    return this.recentFiles.find((f) => f.path === path);
  }

  /**
   * Get a specific project
   */
  getProject(path: string): RecentProject | undefined {
    return this.recentProjects.find((p) => p.path === path);
  }

  /**
   * Search recent files
   */
  searchFiles(query: string, limit?: number): RecentFile[] {
    const lowerQuery = query.toLowerCase();
    const matches = this.recentFiles.filter(
      (f) =>
        f.name.toLowerCase().includes(lowerQuery) ||
        f.path.toLowerCase().includes(lowerQuery)
    );
    const sorted = this.sortFiles(matches);
    return limit ? sorted.slice(0, limit) : sorted;
  }

  /**
   * Get most frequently opened files
   */
  getMostOpenedFiles(limit?: number): RecentFile[] {
    const sorted = [...this.recentFiles].sort((a, b) => b.openCount - a.openCount);
    return limit ? sorted.slice(0, limit) : sorted;
  }

  // ============================================================================
  // Cleanup Operations
  // ============================================================================

  /**
   * Clear all recent files
   */
  async clearFiles(): Promise<void> {
    this.recentFiles = [];
    this.emit({ type: 'cleared' });
    await this.save();
  }

  /**
   * Clear all recent projects
   */
  async clearProjects(): Promise<void> {
    this.recentProjects = [];
    await this.save();
  }

  /**
   * Clear everything
   */
  async clearAll(): Promise<void> {
    this.recentFiles = [];
    this.recentProjects = [];
    this.emit({ type: 'cleared' });
    await this.save();
  }

  /**
   * Remove non-existent files
   */
  async cleanupNonExistent(
    existsChecker: (path: string) => Promise<boolean>
  ): Promise<number> {
    const toRemove: string[] = [];

    for (const file of this.recentFiles) {
      if (!(await existsChecker(file.path))) {
        toRemove.push(file.path);
      }
    }

    for (const path of toRemove) {
      await this.removeFile(path);
    }

    return toRemove.length;
  }

  /**
   * Remove files older than a certain age
   */
  async removeOlderThan(days: number): Promise<number> {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const initialLength = this.recentFiles.length;

    this.recentFiles = this.recentFiles.filter(
      (f) => f.lastOpened.getTime() > cutoff || f.pinned
    );

    const removed = initialLength - this.recentFiles.length;
    if (removed > 0) {
      await this.save();
    }

    return removed;
  }

  // ============================================================================
  // Event Handling
  // ============================================================================

  /**
   * Subscribe to recent files events
   */
  subscribe(listener: RecentFilesListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Emit an event to all listeners
   */
  private emit(event: RecentFilesEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (error) {
        console.error('Recent files listener error:', error);
      }
    }
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  }

  private extractFileName(path: string): string {
    const parts = path.split(/[/\\]/);
    return parts[parts.length - 1] || path;
  }

  private extractExtension(path: string): string {
    const name = this.extractFileName(path);
    const dotIndex = name.lastIndexOf('.');
    return dotIndex > 0 ? name.slice(dotIndex + 1) : '';
  }

  private extractProjectName(path: string): string {
    const parts = path.split(/[/\\]/).filter(Boolean);
    return parts[parts.length - 1] || path;
  }

  private sortFiles(files: RecentFile[] = this.recentFiles): RecentFile[] {
    // Sort: pinned first, then by last opened
    return [...files].sort((a, b) => {
      // Pinned files first
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;

      // Then by last opened
      return b.lastOpened.getTime() - a.lastOpened.getTime();
    });
  }

  /**
   * Export recent files data
   */
  exportData(): { files: RecentFile[]; projects: RecentProject[] } {
    return {
      files: [...this.recentFiles],
      projects: [...this.recentProjects],
    };
  }

  /**
   * Import recent files data
   */
  async importData(data: { files?: RecentFile[]; projects?: RecentProject[] }): Promise<void> {
    if (data.files) {
      this.recentFiles = this.parseFiles(data.files);
    }
    if (data.projects) {
      this.recentProjects = this.parseProjects(data.projects);
    }
    await this.save();
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalFiles: number;
    totalProjects: number;
    pinnedFiles: number;
    favoriteProjects: number;
    totalOpenCount: number;
  } {
    return {
      totalFiles: this.recentFiles.length,
      totalProjects: this.recentProjects.length,
      pinnedFiles: this.recentFiles.filter((f) => f.pinned).length,
      favoriteProjects: this.recentProjects.filter((p) => p.favorite).length,
      totalOpenCount: this.recentFiles.reduce((sum, f) => sum + f.openCount, 0),
    };
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let recentFilesManagerInstance: RecentFilesManager | null = null;

/**
 * Get the singleton RecentFilesManager instance
 */
export function getRecentFilesManager(config?: Partial<RecentFilesConfig>): RecentFilesManager {
  if (!recentFilesManagerInstance) {
    recentFilesManagerInstance = new RecentFilesManager(config);
    // Initialize async
    recentFilesManagerInstance.load().catch(console.error);
  }
  return recentFilesManagerInstance;
}

/**
 * Create a new RecentFilesManager instance
 */
export function createRecentFilesManager(config?: Partial<RecentFilesConfig>): RecentFilesManager {
  const manager = new RecentFilesManager(config);
  manager.load().catch(console.error);
  return manager;
}
