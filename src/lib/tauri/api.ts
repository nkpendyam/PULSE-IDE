// Kyro IDE - Tauri IPC Bridge
// Provides type-safe communication between frontend and Rust backend

import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

// ============================================================================
// TYPES
// ============================================================================

export interface FileInfo {
  name: string;
  path: string;
  isDir: boolean;
  isFile: boolean;
  size: number;
  modified?: number;
  created?: number;
  extension?: string;
}

export interface DirectoryListing {
  path: string;
  entries: FileInfo[];
}

export interface GitStatus {
  branch: string;
  ahead: number;
  behind: number;
  staged: string[];
  unstaged: string[];
  untracked: string[];
  conflicts: string[];
}

export interface GitCommit {
  id: string;
  message: string;
  author: string;
  email: string;
  time: number;
}

export interface GitBranch {
  name: string;
  isCurrent: boolean;
  isRemote: boolean;
}

export interface OllamaModel {
  name: string;
  size: number;
  digest: string;
  modifiedAt: string;
}

export interface OllamaStatus {
  running: boolean;
  version?: string;
  modelsCount: number;
}

export interface SystemInfo {
  os: string;
  osVersion: string;
  arch: string;
  hostname: string;
  username: string;
  homeDir: string;
  totalMemory: number;
  availableMemory: number;
  cpuCores: number;
}

export interface Settings {
  theme: string;
  fontSize: number;
  fontFamily: string;
  tabSize: number;
  wordWrap: boolean;
  minimap: boolean;
  lineNumbers: boolean;
  autoSave: boolean;
  autoSaveDelay: number;
  defaultModel: string;
  ollamaHost: string;
  recentProjects: string[];
  recentFiles: string[];
}

// ============================================================================
// FILE SYSTEM API
// ============================================================================

export const fs = {
  async readFile(path: string): Promise<string> {
    return invoke('read_file', { path });
  },

  async writeFile(path: string, content: string): Promise<void> {
    return invoke('write_file', { path, content });
  },

  async deleteFile(path: string): Promise<void> {
    return invoke('delete_file', { path });
  },

  async createDir(path: string): Promise<void> {
    return invoke('create_dir', { path });
  },

  async deleteDir(path: string, recursive = false): Promise<void> {
    return invoke('delete_dir', { path, recursive });
  },

  async listDir(path: string, showHidden = false): Promise<DirectoryListing> {
    return invoke('list_dir', { path, showHidden });
  },

  async fileExists(path: string): Promise<boolean> {
    return invoke('file_exists', { path });
  },

  async copyFile(source: string, destination: string): Promise<void> {
    return invoke('copy_file', { source, destination });
  },

  async moveFile(source: string, destination: string): Promise<void> {
    return invoke('move_file', { source, destination });
  },

  async renameFile(path: string, newName: string): Promise<void> {
    return invoke('rename_file', { path, newName });
  },

  async getFileInfo(path: string): Promise<FileInfo> {
    return invoke('get_file_info', { path });
  },

  async watchDirectory(
    path: string,
    callback: (path: string) => void
  ): Promise<string> {
    const watcherId = await invoke<string>('watch_directory', { path });
    
    const unlisten = await listen<string>(`fs:change:${watcherId}`, (event) => {
      callback(event.payload);
    });

    return watcherId;
  },

  async unwatchDirectory(watcherId: string): Promise<void> {
    return invoke('unwatch_directory', { watcherId });
  },
};

// ============================================================================
// TERMINAL API
// ============================================================================

export const terminal = {
  async create(id: string, cwd?: string, shell?: string, cols = 80, rows = 24): Promise<void> {
    return invoke('create_terminal', { id, cwd, shell, cols, rows });
  },

  async write(id: string, data: string): Promise<void> {
    return invoke('write_terminal', { id, data });
  },

  async resize(id: string, cols: number, rows: number): Promise<void> {
    return invoke('resize_terminal', { id, cols, rows });
  },

  async destroy(id: string): Promise<void> {
    return invoke('destroy_terminal', { id });
  },
};

// ============================================================================
// GIT API
// ============================================================================

export const git = {
  async status(path: string): Promise<GitStatus> {
    return invoke('git_status', { path });
  },

  async log(path: string, limit = 50): Promise<GitCommit[]> {
    return invoke('git_log', { path, limit });
  },

  async diff(path: string, file?: string): Promise<string> {
    return invoke('git_diff', { path, file });
  },

  async add(path: string, files: string[]): Promise<void> {
    return invoke('git_add', { path, files });
  },

  async reset(path: string, files: string[]): Promise<void> {
    return invoke('git_reset', { path, files });
  },

  async commit(path: string, message: string): Promise<string> {
    return invoke('git_commit', { path, message });
  },

  async branch(path: string): Promise<GitBranch[]> {
    return invoke('git_branch', { path });
  },

  async checkout(path: string, branch: string): Promise<void> {
    return invoke('git_checkout', { path, branch });
  },

  async pull(path: string, remote?: string, branch?: string): Promise<void> {
    return invoke('git_pull', { path, remote, branch });
  },

  async push(path: string, remote?: string, branch?: string): Promise<void> {
    return invoke('git_push', { path, remote, branch });
  },
};

// ============================================================================
// AI API
// ============================================================================

export const ai = {
  async ollamaStatus(host?: string): Promise<OllamaStatus> {
    return invoke('ollama_status', { host });
  },

  async ollamaModels(host?: string): Promise<OllamaModel[]> {
    return invoke('ollama_models', { host });
  },

  async ollamaChat(
    model: string,
    messages: Array<{ role: string; content: string }>,
    host?: string,
    stream?: boolean
  ): Promise<string> {
    return invoke('ollama_chat', { model, messages, host, stream });
  },

  async ollamaPull(
    model: string,
    host?: string,
    onProgress?: (status: string) => void
  ): Promise<void> {
    if (onProgress) {
      listen<string>('ollama:pull:progress', (event) => {
        onProgress(event.payload);
      });
    }
    return invoke('ollama_pull', { model, host });
  },
};

// ============================================================================
// SYSTEM API
// ============================================================================

export const system = {
  async getSystemInfo(): Promise<SystemInfo> {
    return invoke('get_system_info');
  },

  async openExternal(url: string): Promise<void> {
    return invoke('open_external', { url });
  },

  async getSettings(): Promise<Settings> {
    return invoke('get_settings');
  },

  async saveSettings(settings: Settings): Promise<void> {
    return invoke('save_settings', { settings });
  },
};

// ============================================================================
// DETECT ENVIRONMENT
// ============================================================================

export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window;
}

// Export a unified API that works in both Tauri and web mode
export const api = {
  fs,
  terminal,
  git,
  ai,
  system,
  isTauri: isTauri(),
};
