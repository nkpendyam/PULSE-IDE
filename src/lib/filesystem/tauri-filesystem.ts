/**
 * Tauri Filesystem Implementation
 * Bridge to Rust backend for native file operations
 */

import {
  FilesystemProvider,
  FileStats,
  DirectoryEntry,
  WatchOptions,
  WatchEvent,
  WatchCallback,
  FilesystemCapabilities,
  WriteOptions,
  ReadOptions,
  CopyOptions,
  MoveOptions,
  ListOptions,
  FilesystemError,
  FilesystemErrorCode,
  createFilesystemError,
} from './filesystem-provider';

// ============================================================================
// Tauri API Types
// ============================================================================

interface TauriFs {
  readFile(path: string): Promise<{ data: number[]; mime?: string }>;
  readTextFile(path: string): Promise<string>;
  writeFile(path: string, data: number[]): Promise<void>;
  writeTextFile(path: string, contents: string): Promise<void>;
  removeFile(path: string): Promise<void>;
  removeDir(path: string, options?: { recursive: boolean }): Promise<void>;
  createDir(path: string, options?: { recursive: boolean }): Promise<void>;
  readDir(path: string): Promise<TauriDirEntry[]>;
  exists(path: string): Promise<boolean>;
  copyFile(source: string, destination: string): Promise<void>;
  renameFile(source: string, destination: string): Promise<void>;
  stat(path: string): Promise<TauriFileMetadata>;
}

interface TauriDirEntry {
  name: string;
  path: string;
  children?: TauriDirEntry[];
}

interface TauriFileMetadata {
  isFile: boolean;
  isDir: boolean;
  isSymlink: boolean;
  size: number;
  lastModified: number;
  lastAccessed: number;
  created: number;
  readonly: boolean;
}

interface TauriDialog {
  open(options: TauriOpenOptions): Promise<string | string[] | null>;
  save(options: TauriSaveOptions): Promise<string | null>;
}

interface TauriOpenOptions {
  defaultPath?: string;
  directory?: boolean;
  multiple?: boolean;
  filters?: TauriFilter[];
  title?: string;
}

interface TauriSaveOptions {
  defaultPath?: string;
  filters?: TauriFilter[];
  title?: string;
}

interface TauriFilter {
  name: string;
  extensions: string[];
}

interface TauriEvent {
  listen<T = unknown>(event: string, handler: (event: { payload: T }) => void): Promise<() => void>;
}

// ============================================================================
// Tauri API Bridge
// ============================================================================

class TauriBridge {
  private fs: TauriFs | null = null;
  private dialog: TauriDialog | null = null;
  private event: TauriEvent | null = null;
  private initialized = false;

  async initialize(): Promise<boolean> {
    if (this.initialized) return true;

    try {
      // Check if running in Tauri environment
      if (typeof window !== 'undefined' && '__TAURI__' in window) {
        // Dynamic import of Tauri APIs
        const tauriFs = await import('@tauri-apps/plugin-fs');
        const tauriDialog = await import('@tauri-apps/plugin-dialog');
        const tauriEvent = await import('@tauri-apps/api/event');

        this.fs = {
          readFile: async (path: string) => {
            const data = await tauriFs.readFile(path);
            return { data: Array.from(data) };
          },
          readTextFile: async (path: string) => tauriFs.readTextFile(path),
          writeFile: async (path: string, data: number[]) => {
            await tauriFs.writeFile(path, new Uint8Array(data));
          },
          writeTextFile: async (path: string, contents: string) => {
            await tauriFs.writeTextFile(path, contents);
          },
          removeFile: async (path: string) => tauriFs.remove(path),
          removeDir: async (path: string, options?: { recursive: boolean }) => {
            await tauriFs.remove(path, { recursive: options?.recursive ?? false });
          },
          createDir: async (path: string, options?: { recursive: boolean }) => {
            await tauriFs.mkdir(path, { recursive: options?.recursive ?? false });
          },
          readDir: async (path: string) => {
            const entries = await tauriFs.readDir(path);
            return entries.map((e) => ({
              name: e.name ?? '',
              path: e.path,
              children: e.children,
            }));
          },
          exists: async (path: string) => tauriFs.exists(path),
          copyFile: async (source: string, destination: string) => {
            await tauriFs.copyFile(source, destination);
          },
          renameFile: async (source: string, destination: string) => {
            await tauriFs.rename(source, destination);
          },
          stat: async (path: string) => {
            const meta = await tauriFs.stat(path);
            return {
              isFile: meta.isFile,
              isDir: meta.isDirectory,
              isSymlink: meta.isSymlink,
              size: meta.size,
              lastModified: meta.mtime?.getTime() ?? Date.now(),
              lastAccessed: meta.atime?.getTime() ?? Date.now(),
              created: meta.birthtime?.getTime() ?? Date.now(),
              readonly: meta.readonly ?? false,
            };
          },
        };

        this.dialog = {
          open: async (options: TauriOpenOptions) => {
            return tauriDialog.open(options);
          },
          save: async (options: TauriSaveOptions) => {
            return tauriDialog.save(options);
          },
        };

        this.event = {
          listen: async <T = unknown>(event: string, handler: (event: { payload: T }) => void) => {
            return tauriEvent.listen<T>(event, handler);
          },
        };

        this.initialized = true;
        return true;
      }
      return false;
    } catch (error) {
      console.warn('Tauri API not available:', error);
      return false;
    }
  }

  getFs(): TauriFs {
    if (!this.fs) {
      throw new Error('Tauri filesystem not initialized');
    }
    return this.fs;
  }

  getDialog(): TauriDialog {
    if (!this.dialog) {
      throw new Error('Tauri dialog not initialized');
    }
    return this.dialog;
  }

  getEvent(): TauriEvent {
    if (!this.event) {
      throw new Error('Tauri event not initialized');
    }
    return this.event;
  }

  isAvailable(): boolean {
    return this.initialized && this.fs !== null;
  }
}

// ============================================================================
// File Watcher via Tauri Events
// ============================================================================

interface WatcherPayload {
  path: string;
  type: 'created' | 'changed' | 'deleted' | 'renamed';
  oldPath?: string;
  isDirectory: boolean;
}

// ============================================================================
// Tauri Filesystem Provider
// ============================================================================

export class TauriFilesystem extends FilesystemProvider {
  private bridge: TauriBridge;
  private watchers: Map<string, () => void> = new Map();
  private _isAvailable: boolean = false;

  constructor() {
    super();
    this.bridge = new TauriBridge();
  }

  /**
   * Initialize the Tauri filesystem
   * Must be called before using any filesystem operations
   */
  async initialize(): Promise<boolean> {
    this._isAvailable = await this.bridge.initialize();
    if (this._isAvailable) {
      this._rootPath = await this.getHomeDirectory();
    }
    return this._isAvailable;
  }

  /**
   * Check if Tauri filesystem is available
   */
  isAvailable(): boolean {
    return this._isAvailable;
  }

  protected detectCapabilities(): FilesystemCapabilities {
    return {
      fileSystemAccess: true,
      indexedDB: true, // Fallback available
      nativeWatching: true, // Tauri supports native file watching
      symbolicLinks: true,
      permissions: true,
      maxFileSize: 0, // Unlimited
      streamingRead: true,
      streamingWrite: true,
    };
  }

  // ============================================================================
  // Native Dialog Integration
  // ============================================================================

  /**
   * Show native open file dialog
   */
  async showOpenDialog(options?: {
    defaultPath?: string;
    multiple?: boolean;
    directory?: boolean;
    filters?: Array<{ name: string; extensions: string[] }>;
    title?: string;
  }): Promise<string | string[] | null> {
    if (!this._isAvailable) return null;

    try {
      return await this.bridge.getDialog().open({
        defaultPath: options?.defaultPath,
        multiple: options?.multiple,
        directory: options?.directory,
        filters: options?.filters,
        title: options?.title,
      });
    } catch (error) {
      console.error('Open dialog error:', error);
      return null;
    }
  }

  /**
   * Show native save file dialog
   */
  async showSaveDialog(options?: {
    defaultPath?: string;
    filters?: Array<{ name: string; extensions: string[] }>;
    title?: string;
  }): Promise<string | null> {
    if (!this._isAvailable) return null;

    try {
      return await this.bridge.getDialog().save({
        defaultPath: options?.defaultPath,
        filters: options?.filters,
        title: options?.title,
      });
    } catch (error) {
      console.error('Save dialog error:', error);
      return null;
    }
  }

  // ============================================================================
  // File Operations
  // ============================================================================

  async readFile(path: string, options?: ReadOptions): Promise<string> {
    const normalizedPath = this.normalizePath(path);

    try {
      if (!this._isAvailable) {
        throw createFilesystemError(FilesystemErrorCode.NOT_SUPPORTED, normalizedPath);
      }

      const content = await this.bridge.getFs().readTextFile(normalizedPath);
      
      // Handle partial reads if specified
      if (options?.start !== undefined || options?.end !== undefined) {
        const start = options.start ?? 0;
        const end = options.end ?? content.length;
        return content.slice(start, end);
      }

      return content;
    } catch (error) {
      if (error instanceof FilesystemError) throw error;
      if ((error as Error).message?.includes('not found')) {
        throw createFilesystemError(FilesystemErrorCode.NOT_FOUND, normalizedPath);
      }
      throw createFilesystemError(FilesystemErrorCode.UNKNOWN, normalizedPath, error as Error);
    }
  }

  async readFileBuffer(path: string, _options?: ReadOptions): Promise<ArrayBuffer> {
    const normalizedPath = this.normalizePath(path);

    try {
      if (!this._isAvailable) {
        throw createFilesystemError(FilesystemErrorCode.NOT_SUPPORTED, normalizedPath);
      }

      const result = await this.bridge.getFs().readFile(normalizedPath);
      return new Uint8Array(result.data).buffer;
    } catch (error) {
      if (error instanceof FilesystemError) throw error;
      if ((error as Error).message?.includes('not found')) {
        throw createFilesystemError(FilesystemErrorCode.NOT_FOUND, normalizedPath);
      }
      throw createFilesystemError(FilesystemErrorCode.UNKNOWN, normalizedPath, error as Error);
    }
  }

  async writeFile(
    path: string,
    content: string | ArrayBuffer | Blob,
    options?: WriteOptions
  ): Promise<void> {
    const normalizedPath = this.normalizePath(path);

    try {
      if (!this._isAvailable) {
        throw createFilesystemError(FilesystemErrorCode.NOT_SUPPORTED, normalizedPath);
      }

      // Ensure parent directory exists
      if (options?.createParents !== false) {
        await this.ensureParentDirectory(normalizedPath);
      }

      // Check if file exists and overwrite is not allowed
      if (options?.overwrite === false && await this.exists(normalizedPath)) {
        throw createFilesystemError(FilesystemErrorCode.ALREADY_EXISTS, normalizedPath);
      }

      if (typeof content === 'string') {
        await this.bridge.getFs().writeTextFile(normalizedPath, content);
      } else {
        let buffer: ArrayBuffer;
        if (content instanceof Blob) {
          buffer = await content.arrayBuffer();
        } else {
          buffer = content;
        }
        await this.bridge.getFs().writeFile(normalizedPath, Array.from(new Uint8Array(buffer)));
      }
    } catch (error) {
      if (error instanceof FilesystemError) throw error;
      throw createFilesystemError(FilesystemErrorCode.UNKNOWN, normalizedPath, error as Error);
    }
  }

  async deleteFile(path: string): Promise<void> {
    const normalizedPath = this.normalizePath(path);

    try {
      if (!this._isAvailable) {
        throw createFilesystemError(FilesystemErrorCode.NOT_SUPPORTED, normalizedPath);
      }

      if (!(await this.exists(normalizedPath))) {
        throw createFilesystemError(FilesystemErrorCode.NOT_FOUND, normalizedPath);
      }

      await this.bridge.getFs().removeFile(normalizedPath);
    } catch (error) {
      if (error instanceof FilesystemError) throw error;
      throw createFilesystemError(FilesystemErrorCode.UNKNOWN, normalizedPath, error as Error);
    }
  }

  async exists(path: string): Promise<boolean> {
    const normalizedPath = this.normalizePath(path);

    try {
      if (!this._isAvailable) return false;
      return await this.bridge.getFs().exists(normalizedPath);
    } catch {
      return false;
    }
  }

  async stat(path: string): Promise<FileStats> {
    const normalizedPath = this.normalizePath(path);

    try {
      if (!this._isAvailable) {
        throw createFilesystemError(FilesystemErrorCode.NOT_SUPPORTED, normalizedPath);
      }

      const meta = await this.bridge.getFs().stat(normalizedPath);

      return {
        isFile: meta.isFile,
        isDirectory: meta.isDir,
        isSymlink: meta.isSymlink,
        size: meta.size,
        lastModified: new Date(meta.lastModified),
        created: new Date(meta.created),
        permissions: meta.readonly ? 0o444 : 0o644,
      };
    } catch (error) {
      if (error instanceof FilesystemError) throw error;
      if ((error as Error).message?.includes('not found')) {
        throw createFilesystemError(FilesystemErrorCode.NOT_FOUND, normalizedPath);
      }
      throw createFilesystemError(FilesystemErrorCode.UNKNOWN, normalizedPath, error as Error);
    }
  }

  async copy(source: string, destination: string, options?: CopyOptions): Promise<void> {
    const normalizedSource = this.normalizePath(source);
    const normalizedDest = this.normalizePath(destination);

    try {
      if (!this._isAvailable) {
        throw createFilesystemError(FilesystemErrorCode.NOT_SUPPORTED, normalizedSource);
      }

      // Ensure parent directory exists for destination
      if (options?.createParents !== false) {
        await this.ensureParentDirectory(normalizedDest);
      }

      const sourceStats = await this.stat(normalizedSource);

      if (sourceStats.isDirectory) {
        // Copy directory recursively
        await this.copyDirectory(normalizedSource, normalizedDest, options);
        return;
      }

      // Check overwrite
      if (options?.overwrite === false && await this.exists(normalizedDest)) {
        throw createFilesystemError(FilesystemErrorCode.ALREADY_EXISTS, normalizedDest);
      }

      await this.bridge.getFs().copyFile(normalizedSource, normalizedDest);
    } catch (error) {
      if (error instanceof FilesystemError) throw error;
      throw createFilesystemError(FilesystemErrorCode.UNKNOWN, normalizedSource, error as Error);
    }
  }

  async move(source: string, destination: string, options?: MoveOptions): Promise<void> {
    const normalizedSource = this.normalizePath(source);
    const normalizedDest = this.normalizePath(destination);

    try {
      if (!this._isAvailable) {
        throw createFilesystemError(FilesystemErrorCode.NOT_SUPPORTED, normalizedSource);
      }

      // Ensure parent directory exists for destination
      if (options?.createParents !== false) {
        await this.ensureParentDirectory(normalizedDest);
      }

      // Check overwrite
      if (options?.overwrite === false && await this.exists(normalizedDest)) {
        throw createFilesystemError(FilesystemErrorCode.ALREADY_EXISTS, normalizedDest);
      }

      // Use rename for atomic move
      await this.bridge.getFs().renameFile(normalizedSource, normalizedDest);
    } catch (error) {
      if (error instanceof FilesystemError) throw error;
      throw createFilesystemError(FilesystemErrorCode.UNKNOWN, normalizedSource, error as Error);
    }
  }

  async rename(oldPath: string, newPath: string): Promise<void> {
    await this.move(oldPath, newPath);
  }

  // ============================================================================
  // Directory Operations
  // ============================================================================

  async createDirectory(path: string, recursive = true): Promise<void> {
    const normalizedPath = this.normalizePath(path);

    try {
      if (!this._isAvailable) {
        throw createFilesystemError(FilesystemErrorCode.NOT_SUPPORTED, normalizedPath);
      }

      await this.bridge.getFs().createDir(normalizedPath, { recursive });
    } catch (error) {
      if (error instanceof FilesystemError) throw error;
      if ((error as Error).message?.includes('already exists')) {
        return; // Directory already exists, not an error
      }
      throw createFilesystemError(FilesystemErrorCode.UNKNOWN, normalizedPath, error as Error);
    }
  }

  async deleteDirectory(path: string, recursive = false): Promise<void> {
    const normalizedPath = this.normalizePath(path);

    try {
      if (!this._isAvailable) {
        throw createFilesystemError(FilesystemErrorCode.NOT_SUPPORTED, normalizedPath);
      }

      if (!(await this.exists(normalizedPath))) {
        throw createFilesystemError(FilesystemErrorCode.NOT_FOUND, normalizedPath);
      }

      const stats = await this.stat(normalizedPath);
      if (!stats.isDirectory) {
        throw createFilesystemError(FilesystemErrorCode.NOT_DIRECTORY, normalizedPath);
      }

      await this.bridge.getFs().removeDir(normalizedPath, { recursive });
    } catch (error) {
      if (error instanceof FilesystemError) throw error;
      throw createFilesystemError(FilesystemErrorCode.UNKNOWN, normalizedPath, error as Error);
    }
  }

  async listDirectory(path: string, options?: ListOptions): Promise<DirectoryEntry[]> {
    const normalizedPath = this.normalizePath(path);

    try {
      if (!this._isAvailable) {
        throw createFilesystemError(FilesystemErrorCode.NOT_SUPPORTED, normalizedPath);
      }

      const entries = await this.bridge.getFs().readDir(normalizedPath);
      const result: DirectoryEntry[] = [];

      for (const entry of entries) {
        // Skip hidden files if not requested
        if (!options?.includeHidden && entry.name.startsWith('.')) {
          continue;
        }

        // Apply pattern filter
        if (options?.pattern && !this.matchPattern(entry.name, options.pattern)) {
          continue;
        }

        const fullPath = this.joinPath(normalizedPath, entry.name);
        const stats = await this.stat(fullPath);

        result.push({
          name: entry.name,
          path: fullPath,
          isFile: stats.isFile,
          isDirectory: stats.isDirectory,
          stats: options?.includeStats ? stats : undefined,
        });
      }

      return result;
    } catch (error) {
      if (error instanceof FilesystemError) throw error;
      if ((error as Error).message?.includes('not found')) {
        throw createFilesystemError(FilesystemErrorCode.NOT_FOUND, normalizedPath);
      }
      if ((error as Error).message?.includes('not a directory')) {
        throw createFilesystemError(FilesystemErrorCode.NOT_DIRECTORY, normalizedPath);
      }
      throw createFilesystemError(FilesystemErrorCode.UNKNOWN, normalizedPath, error as Error);
    }
  }

  // ============================================================================
  // Native File Watching
  // ============================================================================

  async watchDirectory(
    path: string,
    callback: WatchCallback,
    options?: WatchOptions
  ): Promise<() => void> {
    const normalizedPath = this.normalizePath(path);

    if (!this._isAvailable) {
      // Return a no-op cleanup function if not available
      return () => {};
    }

    try {
      // Listen to file system events from Tauri backend
      const unlisten = await this.bridge.getEvent().listen<WatcherPayload>(
        'fs:watch',
        (event) => {
          const payload = event.payload;

          // Check if the event is for our watched path
          if (!payload.path.startsWith(normalizedPath)) {
            return;
          }

          // Apply filters
          if (options?.includes) {
            const matches = options.includes.some(pattern =>
              this.matchPattern(payload.path, pattern)
            );
            if (!matches) return;
          }

          if (options?.excludes) {
            const excluded = options.excludes.some(pattern =>
              this.matchPattern(payload.path, pattern)
            );
            if (excluded) return;
          }

          const watchEvent: WatchEvent = {
            type: payload.type,
            path: payload.path,
            oldPath: payload.oldPath,
            isDirectory: payload.isDirectory,
            timestamp: new Date(),
          };

          callback(watchEvent);
        }
      );

      const watchId = `watch:${normalizedPath}:${Date.now()}`;
      this.watchers.set(watchId, unlisten);

      // Emit initial scan if requested
      if (options?.emitInitial) {
        const entries = await this.listDirectory(normalizedPath, { includeStats: true });
        for (const entry of entries) {
          callback({
            type: 'created',
            path: entry.path,
            isDirectory: entry.isDirectory,
            timestamp: new Date(),
          });
        }
      }

      // Return cleanup function
      return () => {
        const cleanup = this.watchers.get(watchId);
        if (cleanup) {
          cleanup();
          this.watchers.delete(watchId);
        }
      };
    } catch (error) {
      console.error('Watch error:', error);
      return () => {};
    }
  }

  async watchFile(
    path: string,
    callback: WatchCallback,
    options?: WatchOptions
  ): Promise<() => void> {
    const normalizedPath = this.normalizePath(path);

    if (!this._isAvailable) {
      return () => {};
    }

    try {
      let lastModified: number | null = null;

      // Get initial stats
      if (await this.exists(normalizedPath)) {
        const stats = await this.stat(normalizedPath);
        lastModified = stats.lastModified.getTime();
      }

      const unlisten = await this.bridge.getEvent().listen<WatcherPayload>(
        'fs:watch',
        (event) => {
          const payload = event.payload;

          if (payload.path !== normalizedPath) {
            return;
          }

          const watchEvent: WatchEvent = {
            type: payload.type,
            path: payload.path,
            isDirectory: payload.isDirectory,
            timestamp: new Date(),
          };

          callback(watchEvent);
        }
      );

      const watchId = `file-watch:${normalizedPath}:${Date.now()}`;
      this.watchers.set(watchId, unlisten);

      return () => {
        const cleanup = this.watchers.get(watchId);
        if (cleanup) {
          cleanup();
          this.watchers.delete(watchId);
        }
      };
    } catch (error) {
      console.error('File watch error:', error);
      return () => {};
    }
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Get the home directory path
   */
  async getHomeDirectory(): Promise<string> {
    // In Tauri, we can use the home directory from the backend
    // For now, return a default path
    if (typeof process !== 'undefined' && process.env) {
      return process.env.HOME || process.env.USERPROFILE || '/';
    }
    return '/home/user';
  }

  /**
   * Get the documents directory path
   */
  async getDocumentsDirectory(): Promise<string> {
    const home = await this.getHomeDirectory();
    return this.joinPath(home, 'Documents');
  }

  /**
   * Get the downloads directory path
   */
  async getDownloadsDirectory(): Promise<string> {
    const home = await this.getHomeDirectory();
    return this.joinPath(home, 'Downloads');
  }

  /**
   * Get the temp directory path
   */
  async getTempDirectory(): Promise<string> {
    if (typeof process !== 'undefined' && process.env) {
      return process.env.TMPDIR || process.env.TEMP || '/tmp';
    }
    return '/tmp';
  }

  /**
   * Get the application data directory
   */
  async getAppDataDirectory(): Promise<string> {
    const home = await this.getHomeDirectory();
    if (typeof process !== 'undefined' && process.platform === 'win32') {
      return process.env.APPDATA || this.joinPath(home, 'AppData', 'Roaming');
    } else if (typeof process !== 'undefined' && process.platform === 'darwin') {
      return this.joinPath(home, 'Library', 'Application Support');
    }
    return this.joinPath(home, '.local', 'share');
  }

  /**
   * Cleanup all watchers
   */
  async cleanup(): Promise<void> {
    for (const [watchId, cleanup] of this.watchers) {
      cleanup();
    }
    this.watchers.clear();
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let tauriFilesystemInstance: TauriFilesystem | null = null;

/**
 * Get the singleton TauriFilesystem instance
 */
export async function getTauriFilesystem(): Promise<TauriFilesystem> {
  if (!tauriFilesystemInstance) {
    tauriFilesystemInstance = new TauriFilesystem();
    await tauriFilesystemInstance.initialize();
  }
  return tauriFilesystemInstance;
}

/**
 * Check if Tauri environment is available
 */
export async function isTauriAvailable(): Promise<boolean> {
  try {
    const fs = await getTauriFilesystem();
    return fs.isAvailable();
  } catch {
    return false;
  }
}
