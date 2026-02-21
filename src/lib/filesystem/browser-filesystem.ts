/**
 * Browser Filesystem Implementation
 * Uses File System Access API with IndexedDB fallback and virtual filesystem for demos
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
// Types
// ============================================================================

declare global {
  interface Window {
    showOpenFilePicker?: (options?: OpenFilePickerOptions) => Promise<FileSystemFileHandle[]>;
    showSaveFilePicker?: (options?: SaveFilePickerOptions) => Promise<FileSystemFileHandle>;
    showDirectoryPicker?: (options?: DirectoryPickerOptions) => Promise<FileSystemDirectoryHandle>;
  }
}

interface OpenFilePickerOptions {
  multiple?: boolean;
  excludeAcceptAllOption?: boolean;
  types?: FilePickerAcceptType[];
}

interface SaveFilePickerOptions {
  suggestedName?: string;
  excludeAcceptAllOption?: boolean;
  types?: FilePickerAcceptType[];
}

interface DirectoryPickerOptions {
  id?: string;
  mode?: 'read' | 'readwrite';
  startIn?: FileSystemHandle;
}

interface FilePickerAcceptType {
  description?: string;
  accept: Record<string, string[]>;
}

// ============================================================================
// IndexedDB Storage
// ============================================================================

interface StoredFile {
  path: string;
  content: ArrayBuffer;
  mimeType: string;
  lastModified: number;
  created: number;
}

interface StoredDirectory {
  path: string;
  created: number;
}

class IndexedDBStorage {
  private dbName = 'kyro-filesystem';
  private version = 1;
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Files store
        if (!db.objectStoreNames.contains('files')) {
          const filesStore = db.createObjectStore('files', { keyPath: 'path' });
          filesStore.createIndex('parentDir', 'parentDir', { unique: false });
        }

        // Directories store
        if (!db.objectStoreNames.contains('directories')) {
          db.createObjectStore('directories', { keyPath: 'path' });
        }
      };
    });
  }

  async getFile(path: string): Promise<StoredFile | null> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['files'], 'readonly');
      const store = transaction.objectStore('files');
      const request = store.get(path);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || null);
    });
  }

  async setFile(file: StoredFile): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['files'], 'readwrite');
      const store = transaction.objectStore('files');
      const request = store.put(file);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async deleteFile(path: string): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['files'], 'readwrite');
      const store = transaction.objectStore('files');
      const request = store.delete(path);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async getDirectory(path: string): Promise<StoredDirectory | null> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['directories'], 'readonly');
      const store = transaction.objectStore('directories');
      const request = store.get(path);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || null);
    });
  }

  async setDirectory(dir: StoredDirectory): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['directories'], 'readwrite');
      const store = transaction.objectStore('directories');
      const request = store.put(dir);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async deleteDirectory(path: string): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['directories'], 'readwrite');
      const store = transaction.objectStore('directories');
      const request = store.delete(path);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async listFiles(): Promise<StoredFile[]> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['files'], 'readonly');
      const store = transaction.objectStore('files');
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  async listDirectories(): Promise<StoredDirectory[]> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['directories'], 'readonly');
      const store = transaction.objectStore('directories');
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  async clear(): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['files', 'directories'], 'readwrite');
      const filesStore = transaction.objectStore('files');
      const dirsStore = transaction.objectStore('directories');

      const filesRequest = filesStore.clear();
      const dirsRequest = dirsStore.clear();

      let filesDone = false;
      let dirsDone = false;

      const checkDone = () => {
        if (filesDone && dirsDone) resolve();
      };

      filesRequest.onerror = () => reject(filesRequest.error);
      filesRequest.onsuccess = () => {
        filesDone = true;
        checkDone();
      };

      dirsRequest.onerror = () => reject(dirsRequest.error);
      dirsRequest.onsuccess = () => {
        dirsDone = true;
        checkDone();
      };
    });
  }
}

// ============================================================================
// Virtual Filesystem
// ============================================================================

class VirtualFilesystem {
  private files: Map<string, StoredFile> = new Map();
  private directories: Set<string> = new Set(['/']);

  constructor() {
    // Initialize with root directory
  }

  getFile(path: string): StoredFile | null {
    return this.files.get(path) || null;
  }

  setFile(file: StoredFile): void {
    this.files.set(file.path, file);
  }

  deleteFile(path: string): void {
    this.files.delete(path);
  }

  getDirectory(path: string): StoredDirectory | null {
    if (this.directories.has(path)) {
      return {
        path,
        created: Date.now(),
      };
    }
    return null;
  }

  setDirectory(path: string): void {
    this.directories.add(path);
  }

  deleteDirectory(path: string): void {
    this.directories.delete(path);
  }

  listFiles(): StoredFile[] {
    return Array.from(this.files.values());
  }

  listDirectories(): StoredDirectory[] {
    return Array.from(this.directories).map((path) => ({
      path,
      created: Date.now(),
    }));
  }

  clear(): void {
    this.files.clear();
    this.directories.clear();
    this.directories.add('/');
  }
}

// ============================================================================
// Browser Filesystem Provider
// ============================================================================

type FilesystemMode = 'file-system-api' | 'indexeddb' | 'virtual';

export class BrowserFilesystem extends FilesystemProvider {
  private mode: FilesystemMode;
  private rootHandle: FileSystemDirectoryHandle | null = null;
  private indexedDB: IndexedDBStorage;
  private virtualFS: VirtualFilesystem;
  private fileHandles: Map<string, FileSystemFileHandle> = new Map();
  private dirHandles: Map<string, FileSystemDirectoryHandle> = new Map();
  private watchers: Map<string, { callback: WatchCallback; options: WatchOptions; intervalId?: NodeJS.Timeout }> = new Map();
  private watcherIntervals: Map<string, Map<string, FileStats>> = new Map();

  constructor() {
    super();
    this.indexedDB = new IndexedDBStorage();
    this.virtualFS = new VirtualFilesystem();
    this.mode = this.detectMode();
  }

  private detectMode(): FilesystemMode {
    if (typeof window !== 'undefined' && 'showOpenFilePicker' in window) {
      return 'file-system-api';
    }
    if (typeof indexedDB !== 'undefined') {
      return 'indexeddb';
    }
    return 'virtual';
  }

  protected detectCapabilities(): FilesystemCapabilities {
    const hasFileSystemAccess = typeof window !== 'undefined' && 'showOpenFilePicker' in window;
    const hasIndexedDB = typeof indexedDB !== 'undefined';

    return {
      fileSystemAccess: hasFileSystemAccess,
      indexedDB: hasIndexedDB,
      nativeWatching: false, // Browsers don't have native file watching
      symbolicLinks: false,
      permissions: false,
      maxFileSize: 1024 * 1024 * 1024, // 1GB limit for browsers
      streamingRead: hasFileSystemAccess,
      streamingWrite: hasFileSystemAccess,
    };
  }

  get currentMode(): FilesystemMode {
    return this.mode;
  }

  // ============================================================================
  // Directory Handle Management
  // ============================================================================

  /**
   * Request access to a directory using File System Access API
   */
  async requestDirectoryAccess(): Promise<string | null> {
    if (this.mode !== 'file-system-api') {
      return null;
    }

    try {
      const handle = await window.showDirectoryPicker!({
        mode: 'readwrite',
      });
      this.rootHandle = handle;
      this.dirHandles.set('/', handle);
      this._rootPath = handle.name;
      return handle.name;
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        return null;
      }
      throw error;
    }
  }

  /**
   * Request access to a file using File System Access API
   */
  async requestFileAccess(multiple = false): Promise<string[]> {
    if (this.mode !== 'file-system-api') {
      return [];
    }

    try {
      const handles = await window.showOpenFilePicker!({
        multiple,
        excludeAcceptAllOption: false,
      });

      const paths: string[] = [];
      for (const handle of handles) {
        const path = '/' + handle.name;
        this.fileHandles.set(path, handle);
        paths.push(path);
      }

      return paths;
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        return [];
      }
      throw error;
    }
  }

  /**
   * Save a file using File System Access API
   */
  async saveFileAs(
    suggestedName: string,
    content: string | ArrayBuffer | Blob
  ): Promise<string | null> {
    if (this.mode !== 'file-system-api') {
      return null;
    }

    try {
      const handle = await window.showSaveFilePicker!({
        suggestedName,
      });

      const writable = await handle.createWritable();
      const blob = content instanceof Blob ? content : 
        content instanceof ArrayBuffer ? new Blob([content]) :
        new Blob([content], { type: 'text/plain' });
      
      await writable.write(blob);
      await writable.close();

      const path = '/' + handle.name;
      this.fileHandles.set(path, handle);
      return path;
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        return null;
      }
      throw error;
    }
  }

  // ============================================================================
  // File Operations
  // ============================================================================

  async readFile(path: string, options?: ReadOptions): Promise<string> {
    const buffer = await this.readFileBuffer(path, options);
    const encoding = options?.encoding || 'utf-8';
    return new TextDecoder(encoding).decode(buffer);
  }

  async readFileBuffer(path: string, _options?: ReadOptions): Promise<ArrayBuffer> {
    const normalizedPath = this.normalizePath(path);

    try {
      if (this.mode === 'file-system-api' && this.rootHandle) {
        return await this.readFileFromHandle(normalizedPath);
      }

      if (this.mode === 'indexeddb') {
        await this.indexedDB.init();
        const file = await this.indexedDB.getFile(normalizedPath);
        if (!file) {
          throw createFilesystemError(FilesystemErrorCode.NOT_FOUND, normalizedPath);
        }
        return file.content;
      }

      // Virtual filesystem
      const file = this.virtualFS.getFile(normalizedPath);
      if (!file) {
        throw createFilesystemError(FilesystemErrorCode.NOT_FOUND, normalizedPath);
      }
      return file.content;
    } catch (error) {
      if (error instanceof FilesystemError) throw error;
      throw createFilesystemError(FilesystemErrorCode.UNKNOWN, normalizedPath, error as Error);
    }
  }

  private async readFileFromHandle(path: string): Promise<ArrayBuffer> {
    if (!this.rootHandle) {
      throw createFilesystemError(FilesystemErrorCode.NOT_FOUND, path);
    }

    const parts = path.split('/').filter(Boolean);
    let currentHandle: FileSystemDirectoryHandle = this.rootHandle;

    // Navigate to the file
    for (let i = 0; i < parts.length - 1; i++) {
      currentHandle = await currentHandle.getDirectoryHandle(parts[i]);
    }

    const fileName = parts[parts.length - 1];
    const fileHandle = await currentHandle.getFileHandle(fileName);
    const file = await fileHandle.getFile();
    return file.arrayBuffer();
  }

  async writeFile(
    path: string,
    content: string | ArrayBuffer | Blob,
    options?: WriteOptions
  ): Promise<void> {
    const normalizedPath = this.normalizePath(path);

    try {
      // Ensure parent directory exists
      if (options?.createParents !== false) {
        await this.ensureParentDirectory(normalizedPath);
      }

      // Check if file exists and overwrite is not allowed
      if (options?.overwrite === false && await this.exists(normalizedPath)) {
        throw createFilesystemError(FilesystemErrorCode.ALREADY_EXISTS, normalizedPath);
      }

      const contentBuffer = content instanceof ArrayBuffer ? content :
        content instanceof Blob ? await content.arrayBuffer() :
        new TextEncoder().encode(content).buffer;

      const mimeType = options?.mimeType || this.detectMimeType(normalizedPath);
      const now = Date.now();

      if (this.mode === 'file-system-api' && this.rootHandle) {
        await this.writeFileToHandle(normalizedPath, contentBuffer);
        return;
      }

      if (this.mode === 'indexeddb') {
        await this.indexedDB.init();
        const existing = await this.indexedDB.getFile(normalizedPath);
        
        await this.indexedDB.setFile({
          path: normalizedPath,
          content: contentBuffer,
          mimeType,
          lastModified: now,
          created: existing?.created || now,
        });
        return;
      }

      // Virtual filesystem
      const existing = this.virtualFS.getFile(normalizedPath);
      this.virtualFS.setFile({
        path: normalizedPath,
        content: contentBuffer,
        mimeType,
        lastModified: now,
        created: existing?.created || now,
      });

      // Notify watchers
      this.notifyWatchers(normalizedPath, 'changed', false);
    } catch (error) {
      if (error instanceof FilesystemError) throw error;
      throw createFilesystemError(FilesystemErrorCode.UNKNOWN, normalizedPath, error as Error);
    }
  }

  private async writeFileToHandle(path: string, content: ArrayBuffer): Promise<void> {
    if (!this.rootHandle) {
      throw createFilesystemError(FilesystemErrorCode.NOT_FOUND, path);
    }

    const parts = path.split('/').filter(Boolean);
    let currentHandle: FileSystemDirectoryHandle = this.rootHandle;

    // Navigate/create directories
    for (let i = 0; i < parts.length - 1; i++) {
      currentHandle = await currentHandle.getDirectoryHandle(parts[i], { create: true });
    }

    const fileName = parts[parts.length - 1];
    const fileHandle = await currentHandle.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
  }

  async deleteFile(path: string): Promise<void> {
    const normalizedPath = this.normalizePath(path);

    try {
      if (this.mode === 'file-system-api' && this.rootHandle) {
        await this.deleteFileFromHandle(normalizedPath);
        return;
      }

      if (this.mode === 'indexeddb') {
        await this.indexedDB.init();
        const file = await this.indexedDB.getFile(normalizedPath);
        if (!file) {
          throw createFilesystemError(FilesystemErrorCode.NOT_FOUND, normalizedPath);
        }
        await this.indexedDB.deleteFile(normalizedPath);
        this.notifyWatchers(normalizedPath, 'deleted', false);
        return;
      }

      // Virtual filesystem
      const file = this.virtualFS.getFile(normalizedPath);
      if (!file) {
        throw createFilesystemError(FilesystemErrorCode.NOT_FOUND, normalizedPath);
      }
      this.virtualFS.deleteFile(normalizedPath);
      this.notifyWatchers(normalizedPath, 'deleted', false);
    } catch (error) {
      if (error instanceof FilesystemError) throw error;
      throw createFilesystemError(FilesystemErrorCode.UNKNOWN, normalizedPath, error as Error);
    }
  }

  private async deleteFileFromHandle(path: string): Promise<void> {
    if (!this.rootHandle) {
      throw createFilesystemError(FilesystemErrorCode.NOT_FOUND, path);
    }

    const parts = path.split('/').filter(Boolean);
    let currentHandle: FileSystemDirectoryHandle = this.rootHandle;

    // Navigate to parent directory
    for (let i = 0; i < parts.length - 1; i++) {
      currentHandle = await currentHandle.getDirectoryHandle(parts[i]);
    }

    const fileName = parts[parts.length - 1];
    await currentHandle.removeEntry(fileName);
  }

  async exists(path: string): Promise<boolean> {
    const normalizedPath = this.normalizePath(path);

    try {
      if (this.mode === 'file-system-api' && this.rootHandle) {
        return await this.existsInHandle(normalizedPath);
      }

      if (this.mode === 'indexeddb') {
        await this.indexedDB.init();
        const file = await this.indexedDB.getFile(normalizedPath);
        if (file) return true;
        const dir = await this.indexedDB.getDirectory(normalizedPath);
        return !!dir;
      }

      // Virtual filesystem
      return (
        this.virtualFS.getFile(normalizedPath) !== null ||
        this.virtualFS.getDirectory(normalizedPath) !== null
      );
    } catch {
      return false;
    }
  }

  private async existsInHandle(path: string): Promise<boolean> {
    if (!this.rootHandle) return false;

    const parts = path.split('/').filter(Boolean);
    let currentHandle: FileSystemDirectoryHandle = this.rootHandle;

    for (let i = 0; i < parts.length - 1; i++) {
      try {
        currentHandle = await currentHandle.getDirectoryHandle(parts[i]);
      } catch {
        return false;
      }
    }

    const lastPart = parts[parts.length - 1];
    if (!lastPart) return true; // Root directory

    try {
      await currentHandle.getFileHandle(lastPart);
      return true;
    } catch {
      try {
        await currentHandle.getDirectoryHandle(lastPart);
        return true;
      } catch {
        return false;
      }
    }
  }

  async stat(path: string): Promise<FileStats> {
    const normalizedPath = this.normalizePath(path);

    try {
      if (this.mode === 'file-system-api' && this.rootHandle) {
        return await this.statFromHandle(normalizedPath);
      }

      if (this.mode === 'indexeddb') {
        await this.indexedDB.init();
        
        const file = await this.indexedDB.getFile(normalizedPath);
        if (file) {
          return {
            isFile: true,
            isDirectory: false,
            isSymlink: false,
            size: file.content.byteLength,
            lastModified: new Date(file.lastModified),
            created: new Date(file.created),
            mimeType: file.mimeType,
          };
        }

        const dir = await this.indexedDB.getDirectory(normalizedPath);
        if (dir) {
          return {
            isFile: false,
            isDirectory: true,
            isSymlink: false,
            size: 0,
            lastModified: new Date(dir.created),
            created: new Date(dir.created),
          };
        }

        throw createFilesystemError(FilesystemErrorCode.NOT_FOUND, normalizedPath);
      }

      // Virtual filesystem
      const file = this.virtualFS.getFile(normalizedPath);
      if (file) {
        return {
          isFile: true,
          isDirectory: false,
          isSymlink: false,
          size: file.content.byteLength,
          lastModified: new Date(file.lastModified),
          created: new Date(file.created),
          mimeType: file.mimeType,
        };
      }

      const dir = this.virtualFS.getDirectory(normalizedPath);
      if (dir) {
        return {
          isFile: false,
          isDirectory: true,
          isSymlink: false,
          size: 0,
          lastModified: new Date(dir.created),
          created: new Date(dir.created),
        };
      }

      throw createFilesystemError(FilesystemErrorCode.NOT_FOUND, normalizedPath);
    } catch (error) {
      if (error instanceof FilesystemError) throw error;
      throw createFilesystemError(FilesystemErrorCode.UNKNOWN, normalizedPath, error as Error);
    }
  }

  private async statFromHandle(path: string): Promise<FileStats> {
    if (!this.rootHandle) {
      throw createFilesystemError(FilesystemErrorCode.NOT_FOUND, path);
    }

    if (path === '/') {
      return {
        isFile: false,
        isDirectory: true,
        isSymlink: false,
        size: 0,
        lastModified: new Date(),
      };
    }

    const parts = path.split('/').filter(Boolean);
    let currentHandle: FileSystemDirectoryHandle | FileSystemFileHandle = this.rootHandle!;

    for (let i = 0; i < parts.length - 1; i++) {
      currentHandle = await (currentHandle as FileSystemDirectoryHandle).getDirectoryHandle(parts[i]);
    }

    const lastPart = parts[parts.length - 1];
    let isFile = false;
    let file: File | undefined;

    try {
      const fileHandle = await (currentHandle as FileSystemDirectoryHandle).getFileHandle(lastPart);
      isFile = true;
      file = await fileHandle.getFile();
    } catch {
      try {
        await (currentHandle as FileSystemDirectoryHandle).getDirectoryHandle(lastPart);
      } catch {
        throw createFilesystemError(FilesystemErrorCode.NOT_FOUND, path);
      }
    }

    return {
      isFile,
      isDirectory: !isFile,
      isSymlink: false,
      size: file?.size ?? 0,
      lastModified: file ? new Date(file.lastModified) : new Date(),
      mimeType: file?.type,
    };
  }

  async copy(source: string, destination: string, options?: CopyOptions): Promise<void> {
    const normalizedSource = this.normalizePath(source);
    const normalizedDest = this.normalizePath(destination);

    const sourceStats = await this.stat(normalizedSource);
    
    if (sourceStats.isDirectory) {
      await this.copyDirectory(normalizedSource, normalizedDest, options);
      return;
    }

    const content = await this.readFileBuffer(normalizedSource);
    await this.writeFile(normalizedDest, content, {
      createParents: options?.createParents,
      overwrite: options?.overwrite,
    });
  }

  async move(source: string, destination: string, options?: MoveOptions): Promise<void> {
    const normalizedSource = this.normalizePath(source);
    const normalizedDest = this.normalizePath(destination);

    await this.copy(normalizedSource, normalizedDest, options);
    
    const stats = await this.stat(normalizedSource);
    if (stats.isDirectory) {
      await this.deleteDirectory(normalizedSource, true);
    } else {
      await this.deleteFile(normalizedSource);
    }
  }

  async rename(oldPath: string, newPath: string): Promise<void> {
    await this.move(oldPath, newPath, { overwrite: false });
  }

  // ============================================================================
  // Directory Operations
  // ============================================================================

  async createDirectory(path: string, recursive = true): Promise<void> {
    const normalizedPath = this.normalizePath(path);

    if (await this.exists(normalizedPath)) {
      return; // Directory already exists
    }

    if (this.mode === 'file-system-api' && this.rootHandle) {
      // File System API handles this internally
      const parts = normalizedPath.split('/').filter(Boolean);
      let currentHandle: FileSystemDirectoryHandle = this.rootHandle;

      for (const part of parts) {
        currentHandle = await currentHandle.getDirectoryHandle(part, { create: true });
      }
      return;
    }

    if (this.mode === 'indexeddb') {
      await this.indexedDB.init();

      if (recursive) {
        const parts = normalizedPath.split('/').filter(Boolean);
        let currentPath = '';

        for (const part of parts) {
          currentPath += '/' + part;
          const existing = await this.indexedDB.getDirectory(currentPath);
          if (!existing) {
            await this.indexedDB.setDirectory({
              path: currentPath,
              created: Date.now(),
            });
          }
        }
      } else {
        await this.indexedDB.setDirectory({
          path: normalizedPath,
          created: Date.now(),
        });
      }
      return;
    }

    // Virtual filesystem
    this.virtualFS.setDirectory(normalizedPath);
  }

  async deleteDirectory(path: string, recursive = false): Promise<void> {
    const normalizedPath = this.normalizePath(path);

    if (normalizedPath === '/') {
      throw createFilesystemError(FilesystemErrorCode.INVALID_PATH, normalizedPath);
    }

    const stats = await this.stat(normalizedPath);
    if (!stats.isDirectory) {
      throw createFilesystemError(FilesystemErrorCode.NOT_DIRECTORY, normalizedPath);
    }

    if (recursive) {
      await this.deleteDirectoryRecursive(normalizedPath);
      return;
    }

    // Check if directory is empty
    const entries = await this.listDirectory(normalizedPath);
    if (entries.length > 0) {
      throw new FilesystemError(
        'Directory is not empty',
        FilesystemErrorCode.UNKNOWN,
        normalizedPath
      );
    }

    if (this.mode === 'file-system-api' && this.rootHandle) {
      const parts = normalizedPath.split('/').filter(Boolean);
      let currentHandle: FileSystemDirectoryHandle = this.rootHandle;

      for (let i = 0; i < parts.length - 1; i++) {
        currentHandle = await currentHandle.getDirectoryHandle(parts[i]);
      }

      const dirName = parts[parts.length - 1];
      await currentHandle.removeEntry(dirName);
      return;
    }

    if (this.mode === 'indexeddb') {
      await this.indexedDB.deleteDirectory(normalizedPath);
      return;
    }

    this.virtualFS.deleteDirectory(normalizedPath);
  }

  async listDirectory(path: string, options?: ListOptions): Promise<DirectoryEntry[]> {
    const normalizedPath = this.normalizePath(path);
    const entries: DirectoryEntry[] = [];

    try {
      if (this.mode === 'file-system-api' && this.rootHandle) {
        return await this.listDirectoryFromHandle(normalizedPath, options);
      }

      if (this.mode === 'indexeddb') {
        await this.indexedDB.init();
        return await this.listDirectoryFromIndexedDB(normalizedPath, options);
      }

      // Virtual filesystem
      return this.listDirectoryFromVirtual(normalizedPath, options);
    } catch (error) {
      if (error instanceof FilesystemError) throw error;
      throw createFilesystemError(FilesystemErrorCode.UNKNOWN, normalizedPath, error as Error);
    }
  }

  private async listDirectoryFromHandle(
    path: string,
    options?: ListOptions
  ): Promise<DirectoryEntry[]> {
    if (!this.rootHandle) {
      throw createFilesystemError(FilesystemErrorCode.NOT_FOUND, path);
    }

    const entries: DirectoryEntry[] = [];
    let dirHandle: FileSystemDirectoryHandle = this.rootHandle;

    if (path !== '/') {
      const parts = path.split('/').filter(Boolean);
      for (const part of parts) {
        dirHandle = await dirHandle.getDirectoryHandle(part);
      }
    }

    for await (const [name, handle] of dirHandle.entries()) {
      // Skip hidden files if not requested
      if (!options?.includeHidden && name.startsWith('.')) {
        continue;
      }

      const entryPath = path === '/' ? `/${name}` : `${path}/${name}`;
      const isFile = handle.kind === 'file';

      const entry: DirectoryEntry = {
        name,
        path: entryPath,
        isFile,
        isDirectory: !isFile,
      };

      if (options?.includeStats) {
        if (isFile) {
          const file = await (handle as FileSystemFileHandle).getFile();
          entry.stats = {
            isFile: true,
            isDirectory: false,
            isSymlink: false,
            size: file.size,
            lastModified: new Date(file.lastModified),
            mimeType: file.type,
          };
        } else {
          entry.stats = {
            isFile: false,
            isDirectory: true,
            isSymlink: false,
            size: 0,
            lastModified: new Date(),
          };
        }
      }

      entries.push(entry);
    }

    return entries;
  }

  private async listDirectoryFromIndexedDB(
    path: string,
    options?: ListOptions
  ): Promise<DirectoryEntry[]> {
    const entries: DirectoryEntry[] = [];
    const files = await this.indexedDB.listFiles();
    const directories = await this.indexedDB.listDirectories();

    const normalizedPath = path === '/' ? '' : path;

    // Find direct children
    for (const file of files) {
      if (!file.path.startsWith(normalizedPath + '/') && normalizedPath !== '') continue;
      
      const relativePath = normalizedPath === '' ? file.path : file.path.slice(normalizedPath.length + 1);
      const parts = relativePath.split('/');
      
      if (parts.length !== 1) continue;

      const name = parts[0];
      if (!options?.includeHidden && name.startsWith('.')) continue;

      entries.push({
        name,
        path: file.path,
        isFile: true,
        isDirectory: false,
        stats: options?.includeStats ? {
          isFile: true,
          isDirectory: false,
          isSymlink: false,
          size: file.content.byteLength,
          lastModified: new Date(file.lastModified),
          created: new Date(file.created),
          mimeType: file.mimeType,
        } : undefined,
      });
    }

    for (const dir of directories) {
      if (dir.path === path) continue;
      if (!dir.path.startsWith(normalizedPath + '/') && normalizedPath !== '') continue;
      
      const relativePath = normalizedPath === '' ? dir.path : dir.path.slice(normalizedPath.length + 1);
      const parts = relativePath.split('/');
      
      if (parts.length !== 1) continue;

      const name = parts[0];
      if (!options?.includeHidden && name.startsWith('.')) continue;

      entries.push({
        name,
        path: dir.path,
        isFile: false,
        isDirectory: true,
        stats: options?.includeStats ? {
          isFile: false,
          isDirectory: true,
          isSymlink: false,
          size: 0,
          lastModified: new Date(dir.created),
          created: new Date(dir.created),
        } : undefined,
      });
    }

    return entries;
  }

  private listDirectoryFromVirtual(path: string, options?: ListOptions): DirectoryEntry[] {
    const entries: DirectoryEntry[] = [];
    const normalizedPath = path === '/' ? '' : path;

    const files = this.virtualFS.listFiles();
    const directories = this.virtualFS.listDirectories();

    for (const file of files) {
      if (!file.path.startsWith(normalizedPath + '/') && normalizedPath !== '') continue;
      
      const relativePath = normalizedPath === '' ? file.path : file.path.slice(normalizedPath.length + 1);
      const parts = relativePath.split('/');
      
      if (parts.length !== 1) continue;

      const name = parts[0];
      if (!options?.includeHidden && name.startsWith('.')) continue;

      entries.push({
        name,
        path: file.path,
        isFile: true,
        isDirectory: false,
        stats: options?.includeStats ? {
          isFile: true,
          isDirectory: false,
          isSymlink: false,
          size: file.content.byteLength,
          lastModified: new Date(file.lastModified),
          created: new Date(file.created),
          mimeType: file.mimeType,
        } : undefined,
      });
    }

    for (const dir of directories) {
      if (dir.path === path) continue;
      if (!dir.path.startsWith(normalizedPath + '/') && normalizedPath !== '') continue;
      
      const relativePath = normalizedPath === '' ? dir.path : dir.path.slice(normalizedPath.length + 1);
      const parts = relativePath.split('/');
      
      if (parts.length !== 1) continue;

      const name = parts[0];
      if (!options?.includeHidden && name.startsWith('.')) continue;

      entries.push({
        name,
        path: dir.path,
        isFile: false,
        isDirectory: true,
        stats: options?.includeStats ? {
          isFile: false,
          isDirectory: true,
          isSymlink: false,
          size: 0,
          lastModified: new Date(dir.created),
          created: new Date(dir.created),
        } : undefined,
      });
    }

    return entries;
  }

  // ============================================================================
  // Watching
  // ============================================================================

  async watchDirectory(
    path: string,
    callback: WatchCallback,
    options?: WatchOptions
  ): Promise<() => void> {
    const normalizedPath = this.normalizePath(path);
    const watchId = `${normalizedPath}:${Date.now()}`;

    // Browsers don't have native file watching, so we use polling
    const pollInterval = options?.debounceMs ?? 1000;
    
    // Store initial state
    const initialEntries = await this.listDirectory(normalizedPath, { includeStats: true });
    const initialState = new Map<string, FileStats>();
    for (const entry of initialEntries) {
      if (entry.stats) {
        initialState.set(entry.path, entry.stats);
      }
    }
    this.watcherIntervals.set(watchId, initialState);

    const intervalId = setInterval(async () => {
      try {
        const currentEntries = await this.listDirectory(normalizedPath, { includeStats: true });
        const currentState = new Map<string, FileStats>();
        const prevState = this.watcherIntervals.get(watchId) || new Map();

        for (const entry of currentEntries) {
          if (entry.stats) {
            currentState.set(entry.path, entry.stats);
          }
        }

        // Check for changes
        for (const [entryPath, stats] of currentState) {
          const prevStats = prevState.get(entryPath);
          if (!prevStats) {
            // New file
            this.emitWatchEvent(callback, {
              type: 'created',
              path: entryPath,
              isDirectory: stats.isDirectory,
              timestamp: new Date(),
            }, options);
          } else if (stats.lastModified.getTime() !== prevStats.lastModified.getTime()) {
            // Modified file
            this.emitWatchEvent(callback, {
              type: 'changed',
              path: entryPath,
              isDirectory: stats.isDirectory,
              timestamp: new Date(),
            }, options);
          }
        }

        // Check for deleted files
        for (const [entryPath, stats] of prevState) {
          if (!currentState.has(entryPath)) {
            this.emitWatchEvent(callback, {
              type: 'deleted',
              path: entryPath,
              isDirectory: stats.isDirectory,
              timestamp: new Date(),
            }, options);
          }
        }

        this.watcherIntervals.set(watchId, currentState);
      } catch (error) {
        console.error('Watch error:', error);
      }
    }, pollInterval);

    this.watchers.set(watchId, { callback, options: options || {}, intervalId });

    // Emit initial scan events if requested
    if (options?.emitInitial) {
      for (const entry of initialEntries) {
        if (entry.stats) {
          this.emitWatchEvent(callback, {
            type: 'created',
            path: entry.path,
            isDirectory: entry.stats.isDirectory,
            timestamp: new Date(),
          }, options);
        }
      }
    }

    // Return cleanup function
    return () => {
      const watcher = this.watchers.get(watchId);
      if (watcher?.intervalId) {
        clearInterval(watcher.intervalId);
      }
      this.watchers.delete(watchId);
      this.watcherIntervals.delete(watchId);
    };
  }

  private emitWatchEvent(
    callback: WatchCallback,
    event: WatchEvent,
    options?: WatchOptions
  ): void {
    // Check include patterns
    if (options?.includes) {
      const matches = options.includes.some(pattern => 
        this.matchPattern(event.path, pattern)
      );
      if (!matches) return;
    }

    // Check exclude patterns
    if (options?.excludes) {
      const excluded = options.excludes.some(pattern =>
        this.matchPattern(event.path, pattern)
      );
      if (excluded) return;
    }

    callback(event);
  }

  private notifyWatchers(path: string, type: 'created' | 'changed' | 'deleted', isDirectory: boolean): void {
    const event: WatchEvent = {
      type,
      path,
      isDirectory,
      timestamp: new Date(),
    };

    for (const [watchId, watcher] of this.watchers) {
      const watchPath = watchId.split(':')[0];
      if (path.startsWith(watchPath)) {
        this.emitWatchEvent(watcher.callback, event, watcher.options);
      }
    }
  }

  // ============================================================================
  // Utility
  // ============================================================================

  private detectMimeType(path: string): string {
    const ext = this.extname(path).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.txt': 'text/plain',
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.ts': 'application/typescript',
      '.tsx': 'application/typescript',
      '.jsx': 'application/javascript',
      '.json': 'application/json',
      '.md': 'text/markdown',
      '.xml': 'application/xml',
      '.svg': 'image/svg+xml',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.pdf': 'application/pdf',
      '.zip': 'application/zip',
      '.wasm': 'application/wasm',
    };

    return mimeTypes[ext] || 'application/octet-stream';
  }

  /**
   * Clear all stored data (for IndexedDB and virtual filesystem)
   */
  async clear(): Promise<void> {
    if (this.mode === 'indexeddb') {
      await this.indexedDB.clear();
    } else if (this.mode === 'virtual') {
      this.virtualFS.clear();
    }
    
    this.fileHandles.clear();
    this.dirHandles.clear();
  }

  /**
   * Export filesystem contents for download
   */
  async exportAsZip(): Promise<Blob> {
    // This would require a zip library like JSZip
    // For now, return a simple structure
    const entries = await this.readDirectoryTree('/');
    const data = JSON.stringify(entries, null, 2);
    return new Blob([data], { type: 'application/json' });
  }
}
