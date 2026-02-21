/**
 * Filesystem Module - Complete file system abstraction for Kyro IDE
 * 
 * This module provides a unified filesystem interface that works in both
 * browser and Tauri desktop environments. It includes:
 * 
 * - Abstract filesystem provider interface
 * - Browser implementation with File System Access API and IndexedDB fallback
 * - Tauri desktop implementation with native file operations
 * - File watching with debouncing and pattern matching
 * - Recent files management with persistence
 * 
 * @module filesystem
 */

// ============================================================================
// Core Types and Interfaces
// ============================================================================

export {
  // Interfaces
  type FileStats,
  type DirectoryEntry,
  type WatchOptions,
  type WatchEvent,
  type WatchCallback,
  type FilesystemCapabilities,
  type WriteOptions,
  type ReadOptions,
  type CopyOptions,
  type MoveOptions,
  type ListOptions,
  
  // Classes
  FilesystemProvider,
  FilesystemError,
  FilesystemErrorCode,
  createFilesystemError,
} from './filesystem-provider';

// ============================================================================
// Browser Filesystem
// ============================================================================

export {
  BrowserFilesystem,
  type FilesystemMode,
} from './browser-filesystem';

// ============================================================================
// Tauri Filesystem
// ============================================================================

export {
  TauriFilesystem,
  getTauriFilesystem,
  isTauriAvailable,
} from './tauri-filesystem';

// ============================================================================
// File Watcher
// ============================================================================

export {
  // Main classes
  FileWatcher,
  EventDebouncer,
  GlobPatternMatcher,
  WatchEventAggregator,
  
  // Types
  type FileWatcherConfig,
  type PatternMatcher,
  type WatchSubscription,
  type DebouncedEvent,
  type AggregatedWatchCallback,
  
  // Factory functions
  createFileWatcher,
  createPatternMatcher,
  createEventAggregator,
} from './file-watcher';

// ============================================================================
// Recent Files Manager
// ============================================================================

export {
  // Main class
  RecentFilesManager,
  
  // Types
  type RecentFile,
  type RecentProject,
  type RecentFilesConfig,
  type RecentFilesListener,
  type RecentFilesEvent,
  
  // Factory functions
  getRecentFilesManager,
  createRecentFilesManager,
} from './recent-files-manager';

// ============================================================================
// Unified Filesystem Factory
// ============================================================================

import { FilesystemProvider } from './filesystem-provider';
import { BrowserFilesystem } from './browser-filesystem';
import { TauriFilesystem, isTauriAvailable } from './tauri-filesystem';

export interface FilesystemFactoryOptions {
  /** Force use of a specific filesystem type */
  type?: 'browser' | 'tauri' | 'auto';
  /** Initialize Tauri filesystem if available */
  initializeTauri?: boolean;
}

/**
 * Create the appropriate filesystem provider based on the environment
 */
export async function createFilesystem(
  options?: FilesystemFactoryOptions
): Promise<FilesystemProvider> {
  const type = options?.type ?? 'auto';

  if (type === 'browser') {
    return new BrowserFilesystem();
  }

  if (type === 'tauri') {
    const fs = new TauriFilesystem();
    await fs.initialize();
    return fs;
  }

  // Auto-detect
  if (options?.initializeTauri !== false) {
    const available = await isTauriAvailable();
    if (available) {
      const { getTauriFilesystem } = await import('./tauri-filesystem');
      return getTauriFilesystem();
    }
  }

  return new BrowserFilesystem();
}

// ============================================================================
// Convenience Exports
// ============================================================================

/**
 * Default filesystem instance (lazy-initialized)
 */
let defaultFilesystem: FilesystemProvider | null = null;

/**
 * Get the default filesystem instance
 */
export async function getFilesystem(): Promise<FilesystemProvider> {
  if (!defaultFilesystem) {
    defaultFilesystem = await createFilesystem();
  }
  return defaultFilesystem;
}

/**
 * Reset the default filesystem instance
 */
export function resetFilesystem(): void {
  defaultFilesystem = null;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if running in Tauri environment
 */
export async function isTauriEnvironment(): Promise<boolean> {
  return isTauriAvailable();
}

/**
 * Check if File System Access API is available
 */
export function hasFileSystemAccessAPI(): boolean {
  return typeof window !== 'undefined' && 'showOpenFilePicker' in window;
}

/**
 * Check if IndexedDB is available
 */
export function hasIndexedDB(): boolean {
  return typeof indexedDB !== 'undefined';
}

/**
 * Get filesystem capabilities description
 */
export function getFilesystemCapabilitiesDescription(
  capabilities: import('./filesystem-provider').FilesystemCapabilities
): string[] {
  const descriptions: string[] = [];

  if (capabilities.fileSystemAccess) {
    descriptions.push('File System Access API');
  }
  if (capabilities.indexedDB) {
    descriptions.push('IndexedDB persistence');
  }
  if (capabilities.nativeWatching) {
    descriptions.push('Native file watching');
  }
  if (capabilities.symbolicLinks) {
    descriptions.push('Symbolic links');
  }
  if (capabilities.permissions) {
    descriptions.push('File permissions');
  }
  if (capabilities.streamingRead) {
    descriptions.push('Streaming reads');
  }
  if (capabilities.streamingWrite) {
    descriptions.push('Streaming writes');
  }

  return descriptions;
}
