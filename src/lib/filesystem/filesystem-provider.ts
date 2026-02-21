/**
 * File System Provider - Abstract interface for file system operations
 * Supports both browser and Tauri environments
 */

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface FileStats {
  /** Whether this is a file */
  isFile: boolean;
  /** Whether this is a directory */
  isDirectory: boolean;
  /** Whether this is a symbolic link */
  isSymlink: boolean;
  /** File size in bytes */
  size: number;
  /** Last modification time */
  lastModified: Date;
  /** Creation time */
  created?: Date;
  /** File permissions (Unix-style, optional) */
  permissions?: number;
  /** MIME type if available */
  mimeType?: string;
}

export interface DirectoryEntry {
  /** Entry name */
  name: string;
  /** Full path */
  path: string;
  /** Whether this is a file */
  isFile: boolean;
  /** Whether this is a directory */
  isDirectory: boolean;
  /** File stats if available */
  stats?: FileStats;
}

export interface WatchOptions {
  /** Watch recursively */
  recursive?: boolean;
  /** File patterns to include (glob patterns) */
  includes?: string[];
  /** File patterns to exclude (glob patterns) */
  excludes?: string[];
  /** Debounce interval in milliseconds */
  debounceMs?: number;
  /** Whether to emit initial scan events */
  emitInitial?: boolean;
}

export interface WatchEvent {
  /** Event type */
  type: 'created' | 'changed' | 'deleted' | 'renamed';
  /** File/directory path */
  path: string;
  /** Old path for rename events */
  oldPath?: string;
  /** Whether this is a directory */
  isDirectory: boolean;
  /** Timestamp */
  timestamp: Date;
}

export type WatchCallback = (event: WatchEvent) => void;

export interface FilesystemCapabilities {
  /** Supports File System Access API */
  fileSystemAccess: boolean;
  /** Supports IndexedDB persistence */
  indexedDB: boolean;
  /** Supports native file watching */
  nativeWatching: boolean;
  /** Supports symbolic links */
  symbolicLinks: boolean;
  /** Supports file permissions */
  permissions: boolean;
  /** Maximum file size in bytes (0 = unlimited) */
  maxFileSize: number;
  /** Supports streaming reads */
  streamingRead: boolean;
  /** Supports streaming writes */
  streamingWrite: boolean;
}

export interface WriteOptions {
  /** Create parent directories if they don't exist */
  createParents?: boolean;
  /** Overwrite existing file */
  overwrite?: boolean;
  /** Encoding for text files */
  encoding?: string;
  /** MIME type */
  mimeType?: string;
}

export interface ReadOptions {
  /** Encoding for text files (default: utf-8) */
  encoding?: string;
  /** Start position for partial reads */
  start?: number;
  /** End position for partial reads */
  end?: number;
}

export interface CopyOptions {
  /** Overwrite destination if it exists */
  overwrite?: boolean;
  /** Create parent directories */
  createParents?: boolean;
}

export interface MoveOptions {
  /** Overwrite destination if it exists */
  overwrite?: boolean;
  /** Create parent directories */
  createParents?: boolean;
}

export interface ListOptions {
  /** Include hidden files */
  includeHidden?: boolean;
  /** Include file stats */
  includeStats?: boolean;
  /** Filter pattern (glob) */
  pattern?: string;
  /** Maximum depth for recursive listing */
  maxDepth?: number;
}

// ============================================================================
// Abstract Filesystem Provider
// ============================================================================

/**
 * Abstract base class for filesystem providers
 * Implementations: BrowserFilesystem, TauriFilesystem
 */
export abstract class FilesystemProvider {
  protected _rootPath: string = '/';
  protected _capabilities: FilesystemCapabilities;

  constructor() {
    this._capabilities = this.detectCapabilities();
  }

  /**
   * Get the root path for this filesystem
   */
  get rootPath(): string {
    return this._rootPath;
  }

  /**
   * Get filesystem capabilities
   */
  get capabilities(): FilesystemCapabilities {
    return this._capabilities;
  }

  /**
   * Detect filesystem capabilities (implemented by subclasses)
   */
  protected abstract detectCapabilities(): FilesystemCapabilities;

  // ============================================================================
  // File Operations
  // ============================================================================

  /**
   * Read file contents as string
   */
  abstract readFile(path: string, options?: ReadOptions): Promise<string>;

  /**
   * Read file contents as ArrayBuffer
   */
  abstract readFileBuffer(path: string, options?: ReadOptions): Promise<ArrayBuffer>;

  /**
   * Read file as stream (if supported)
   */
  abstract readFileStream?(path: string): Promise<ReadableStream<Uint8Array>>;

  /**
   * Write string content to file
   */
  abstract writeFile(path: string, content: string | ArrayBuffer | Blob, options?: WriteOptions): Promise<void>;

  /**
   * Write to file using a stream (if supported)
   */
  abstract writeFileStream?(path: string): Promise<WritableStream<Uint8Array>>;

  /**
   * Delete a file
   */
  abstract deleteFile(path: string): Promise<void>;

  /**
   * Check if file exists
   */
  abstract exists(path: string): Promise<boolean>;

  /**
   * Get file statistics
   */
  abstract stat(path: string): Promise<FileStats>;

  /**
   * Copy file or directory
   */
  abstract copy(source: string, destination: string, options?: CopyOptions): Promise<void>;

  /**
   * Move file or directory
   */
  abstract move(source: string, destination: string, options?: MoveOptions): Promise<void>;

  /**
   * Rename file or directory
   */
  abstract rename(oldPath: string, newPath: string): Promise<void>;

  // ============================================================================
  // Directory Operations
  // ============================================================================

  /**
   * Create a directory
   */
  abstract createDirectory(path: string, recursive?: boolean): Promise<void>;

  /**
   * Delete a directory
   */
  abstract deleteDirectory(path: string, recursive?: boolean): Promise<void>;

  /**
   * List directory contents
   */
  abstract listDirectory(path: string, options?: ListOptions): Promise<DirectoryEntry[]>;

  /**
   * Check if path is a directory
   */
  async isDirectory(path: string): Promise<boolean> {
    const stats = await this.stat(path);
    return stats.isDirectory;
  }

  /**
   * Check if path is a file
   */
  async isFile(path: string): Promise<boolean> {
    const stats = await this.stat(path);
    return stats.isFile;
  }

  // ============================================================================
  // Watching
  // ============================================================================

  /**
   * Watch a directory for changes
   */
  abstract watchDirectory(path: string, callback: WatchCallback, options?: WatchOptions): Promise<() => void>;

  /**
   * Watch a specific file for changes
   */
  abstract watchFile?(path: string, callback: WatchCallback, options?: WatchOptions): Promise<() => void>;

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Normalize a path (resolve . and .., remove trailing slash)
   */
  normalizePath(path: string): string {
    // Handle empty or root path
    if (!path || path === '/') return '/';
    
    // Remove duplicate slashes
    let normalized = path.replace(/\/+/g, '/');
    
    // Ensure leading slash for absolute paths
    if (!normalized.startsWith('/')) {
      normalized = '/' + normalized;
    }
    
    // Remove trailing slash (except for root)
    if (normalized.length > 1 && normalized.endsWith('/')) {
      normalized = normalized.slice(0, -1);
    }
    
    // Resolve . and ..
    const parts = normalized.split('/').filter(Boolean);
    const result: string[] = [];
    
    for (const part of parts) {
      if (part === '.') continue;
      if (part === '..') {
        if (result.length > 0) {
          result.pop();
        }
      } else {
        result.push(part);
      }
    }
    
    return '/' + result.join('/');
  }

  /**
   * Join path segments
   */
  joinPath(...segments: string[]): string {
    return this.normalizePath(segments.join('/'));
  }

  /**
   * Get the parent directory of a path
   */
  dirname(path: string): string {
    const normalized = this.normalizePath(path);
    const lastSlash = normalized.lastIndexOf('/');
    
    if (lastSlash === 0) return '/';
    return normalized.slice(0, lastSlash);
  }

  /**
   * Get the base name of a path
   */
  basename(path: string): string {
    const normalized = this.normalizePath(path);
    const lastSlash = normalized.lastIndexOf('/');
    return normalized.slice(lastSlash + 1);
  }

  /**
   * Get the file extension
   */
  extname(path: string): string {
    const name = this.basename(path);
    const lastDot = name.lastIndexOf('.');
    if (lastDot <= 0) return '';
    return name.slice(lastDot);
  }

  /**
   * Check if path matches a glob pattern
   */
  matchPattern(path: string, pattern: string): boolean {
    // Convert glob pattern to regex
    const regexPattern = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(path);
  }

  /**
   * Resolve a relative path to absolute
   */
  resolvePath(basePath: string, relativePath: string): string {
    if (relativePath.startsWith('/')) {
      return this.normalizePath(relativePath);
    }
    return this.normalizePath(this.joinPath(basePath, relativePath));
  }

  /**
   * Get relative path from one path to another
   */
  relativePath(from: string, to: string): string {
    const fromNorm = this.normalizePath(from);
    const toNorm = this.normalizePath(to);
    
    const fromParts = fromNorm.split('/').filter(Boolean);
    const toParts = toNorm.split('/').filter(Boolean);
    
    let commonLength = 0;
    for (let i = 0; i < Math.min(fromParts.length, toParts.length); i++) {
      if (fromParts[i] === toParts[i]) {
        commonLength++;
      } else {
        break;
      }
    }
    
    const upParts = fromParts.slice(commonLength).map(() => '..');
    const downParts = toParts.slice(commonLength);
    
    return [...upParts, ...downParts].join('/') || '.';
  }

  /**
   * Ensure a directory exists
   */
  async ensureDirectory(path: string): Promise<void> {
    if (!(await this.exists(path))) {
      await this.createDirectory(path, true);
    }
  }

  /**
   * Ensure parent directory exists for a file
   */
  async ensureParentDirectory(filePath: string): Promise<void> {
    const parentDir = this.dirname(filePath);
    await this.ensureDirectory(parentDir);
  }

  /**
   * Read entire directory tree recursively
   */
  async readDirectoryTree(
    path: string,
    options?: ListOptions & { maxDepth?: number },
    currentDepth: number = 0
  ): Promise<DirectoryEntry[]> {
    const maxDepth = options?.maxDepth ?? Infinity;
    if (currentDepth >= maxDepth) return [];

    const entries = await this.listDirectory(path, options);
    const result: DirectoryEntry[] = [];

    for (const entry of entries) {
      result.push(entry);
      if (entry.isDirectory) {
        const children = await this.readDirectoryTree(
          entry.path,
          options,
          currentDepth + 1
        );
        result.push(...children);
      }
    }

    return result;
  }

  /**
   * Copy directory recursively
   */
  async copyDirectory(
    source: string,
    destination: string,
    options?: CopyOptions
  ): Promise<void> {
    await this.createDirectory(destination, true);
    
    const entries = await this.listDirectory(source);
    
    for (const entry of entries) {
      const destPath = this.joinPath(destination, entry.name);
      
      if (entry.isDirectory) {
        await this.copyDirectory(entry.path, destPath, options);
      } else {
        await this.copy(entry.path, destPath, options);
      }
    }
  }

  /**
   * Delete directory recursively
   */
  async deleteDirectoryRecursive(path: string): Promise<void> {
    const entries = await this.listDirectory(path);
    
    for (const entry of entries) {
      if (entry.isDirectory) {
        await this.deleteDirectoryRecursive(entry.path);
      } else {
        await this.deleteFile(entry.path);
      }
    }
    
    await this.deleteDirectory(path);
  }
}

// ============================================================================
// Error Types
// ============================================================================

export class FilesystemError extends Error {
  constructor(
    message: string,
    public readonly code: FilesystemErrorCode,
    public readonly path?: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'FilesystemError';
  }
}

export enum FilesystemErrorCode {
  NOT_FOUND = 'NOT_FOUND',
  ALREADY_EXISTS = 'ALREADY_EXISTS',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  IS_DIRECTORY = 'IS_DIRECTORY',
  NOT_DIRECTORY = 'NOT_DIRECTORY',
  INVALID_PATH = 'INVALID_PATH',
  OUT_OF_SPACE = 'OUT_OF_SPACE',
  READ_ONLY = 'READ_ONLY',
  NOT_SUPPORTED = 'NOT_SUPPORTED',
  UNKNOWN = 'UNKNOWN',
}

/**
 * Create a standardized filesystem error
 */
export function createFilesystemError(
  code: FilesystemErrorCode,
  path?: string,
  cause?: Error
): FilesystemError {
  const messages: Record<FilesystemErrorCode, string> = {
    [FilesystemErrorCode.NOT_FOUND]: `File or directory not found: ${path}`,
    [FilesystemErrorCode.ALREADY_EXISTS]: `File or directory already exists: ${path}`,
    [FilesystemErrorCode.PERMISSION_DENIED]: `Permission denied: ${path}`,
    [FilesystemErrorCode.IS_DIRECTORY]: `Path is a directory: ${path}`,
    [FilesystemErrorCode.NOT_DIRECTORY]: `Path is not a directory: ${path}`,
    [FilesystemErrorCode.INVALID_PATH]: `Invalid path: ${path}`,
    [FilesystemErrorCode.OUT_OF_SPACE]: `Out of disk space`,
    [FilesystemErrorCode.READ_ONLY]: `Filesystem is read-only`,
    [FilesystemErrorCode.NOT_SUPPORTED]: `Operation not supported`,
    [FilesystemErrorCode.UNKNOWN]: `Unknown error`,
  };

  return new FilesystemError(messages[code], code, path, cause);
}
