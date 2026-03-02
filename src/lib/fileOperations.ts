/**
 * File Operations Module
 * 
 * Provides utilities for file operations integrated with Monaco editor:
 * - Open files from file tree
 * - Save files with Cmd+S
 * - Handle multiple open files with tabs
 * - Integrate with Tauri file system commands
 */

import { invoke } from '@tauri-apps/api/core';

export interface FileContent {
  path: string;
  content: string;
  language: string;
}

export interface FileNode {
  name: string;
  path: string;
  is_directory: boolean;
  children?: FileNode[];
  extension?: string;
  size?: number;
}

/**
 * Read a file from the file system
 */
export async function readFile(path: string): Promise<FileContent> {
  try {
    const result = await invoke<FileContent>('read_file', { path });
    return result;
  } catch (error) {
    console.error('Failed to read file:', error);
    throw new Error(`Failed to read file: ${error}`);
  }
}

/**
 * Write content to a file
 */
export async function writeFile(path: string, content: string): Promise<void> {
  try {
    await invoke('write_file', { path, content });
  } catch (error) {
    console.error('Failed to write file:', error);
    throw new Error(`Failed to write file: ${error}`);
  }
}

/**
 * Create a new file
 */
export async function createFile(path: string): Promise<void> {
  try {
    await invoke('create_file', { path });
  } catch (error) {
    console.error('Failed to create file:', error);
    throw new Error(`Failed to create file: ${error}`);
  }
}

/**
 * Delete a file
 */
export async function deleteFile(path: string): Promise<void> {
  try {
    await invoke('delete_file', { path });
  } catch (error) {
    console.error('Failed to delete file:', error);
    throw new Error(`Failed to delete file: ${error}`);
  }
}

/**
 * Rename a file
 */
export async function renameFile(oldPath: string, newPath: string): Promise<void> {
  try {
    await invoke('rename_file', { oldPath, newPath });
  } catch (error) {
    console.error('Failed to rename file:', error);
    throw new Error(`Failed to rename file: ${error}`);
  }
}

/**
 * Get file tree for a directory
 */
export async function getFileTree(path: string, maxDepth?: number): Promise<FileNode> {
  try {
    const result = await invoke<FileNode>('get_file_tree', { 
      path, 
      maxDepth: maxDepth || 10 
    });
    return result;
  } catch (error) {
    console.error('Failed to get file tree:', error);
    throw new Error(`Failed to get file tree: ${error}`);
  }
}

/**
 * List directory contents
 */
export async function listDirectory(path: string): Promise<FileNode[]> {
  try {
    const result = await invoke<FileNode[]>('list_directory', { path });
    return result;
  } catch (error) {
    console.error('Failed to list directory:', error);
    throw new Error(`Failed to list directory: ${error}`);
  }
}

/**
 * Check if a path exists
 */
export async function pathExists(path: string): Promise<boolean> {
  try {
    const result = await invoke<boolean>('path_exists', { path });
    return result;
  } catch (error) {
    console.error('Failed to check path existence:', error);
    return false;
  }
}

/**
 * Detect language from file extension
 */
export function detectLanguage(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  
  const languageMap: Record<string, string> = {
    // Programming languages
    'rs': 'rust',
    'py': 'python',
    'js': 'javascript',
    'jsx': 'javascript',
    'ts': 'typescript',
    'tsx': 'typescript',
    'go': 'go',
    'java': 'java',
    'kt': 'kotlin',
    'swift': 'swift',
    'c': 'c',
    'cpp': 'cpp',
    'cc': 'cpp',
    'cxx': 'cpp',
    'h': 'cpp',
    'hpp': 'cpp',
    'cs': 'csharp',
    'rb': 'ruby',
    'php': 'php',
    'lua': 'lua',
    'scala': 'scala',
    'r': 'r',
    'dart': 'dart',
    'ex': 'elixir',
    'exs': 'elixir',
    'erl': 'erlang',
    'hrl': 'erlang',
    'hs': 'haskell',
    'ml': 'ocaml',
    'fs': 'fsharp',
    'clj': 'clojure',
    'cljs': 'clojure',
    
    // Shell scripts
    'sh': 'shell',
    'bash': 'shell',
    'zsh': 'shell',
    'fish': 'shell',
    'ps1': 'powershell',
    'psm1': 'powershell',
    'bat': 'bat',
    'cmd': 'bat',
    
    // Web technologies
    'html': 'html',
    'htm': 'html',
    'css': 'css',
    'scss': 'scss',
    'sass': 'scss',
    'less': 'less',
    'vue': 'vue',
    'svelte': 'svelte',
    
    // Data formats
    'json': 'json',
    'yaml': 'yaml',
    'yml': 'yaml',
    'xml': 'xml',
    'toml': 'toml',
    'ini': 'ini',
    'cfg': 'ini',
    'conf': 'ini',
    
    // Documentation
    'md': 'markdown',
    'markdown': 'markdown',
    'rst': 'restructuredtext',
    'tex': 'latex',
    
    // Database
    'sql': 'sql',
    
    // Other
    'dockerfile': 'dockerfile',
    'makefile': 'makefile',
    'graphql': 'graphql',
    'proto': 'protobuf',
  };
  
  return languageMap[ext || ''] || 'plaintext';
}

/**
 * Get file icon based on extension
 */
export function getFileIcon(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  
  const iconMap: Record<string, string> = {
    // Programming languages
    'rs': '🦀',
    'py': '🐍',
    'js': '📜',
    'jsx': '⚛️',
    'ts': '📘',
    'tsx': '⚛️',
    'go': '🔵',
    'java': '☕',
    'kt': '🅺',
    'swift': '🦅',
    'c': '©️',
    'cpp': '©️',
    'cs': '#️⃣',
    'rb': '💎',
    'php': '🐘',
    
    // Web
    'html': '🌐',
    'css': '🎨',
    'vue': '💚',
    'svelte': '🧡',
    
    // Data
    'json': '📋',
    'yaml': '📋',
    'yml': '📋',
    'toml': '📋',
    'xml': '📄',
    'sql': '🗄️',
    
    // Documentation
    'md': '📝',
    'txt': '📄',
    
    // Media
    'png': '🖼️',
    'jpg': '🖼️',
    'jpeg': '🖼️',
    'gif': '🖼️',
    'svg': '🎨',
    'ico': '🖼️',
    
    // Other
    'sh': '🔧',
    'lock': '🔒',
    'gitignore': '🚫',
    'env': '🔐',
  };
  
  return iconMap[ext || ''] || '📄';
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Check if file is binary based on extension
 */
export function isBinaryFile(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase();
  
  const binaryExtensions = [
    'png', 'jpg', 'jpeg', 'gif', 'bmp', 'ico', 'svg',
    'mp3', 'mp4', 'avi', 'mov', 'wav', 'flac',
    'zip', 'tar', 'gz', 'rar', '7z',
    'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
    'exe', 'dll', 'so', 'dylib',
    'wasm', 'bin', 'dat',
  ];
  
  return binaryExtensions.includes(ext || '');
}

/**
 * Get relative path from base path
 */
export function getRelativePath(basePath: string, fullPath: string): string {
  if (fullPath.startsWith(basePath)) {
    return fullPath.slice(basePath.length).replace(/^[\/\\]/, '');
  }
  return fullPath;
}

/**
 * Get file name from path
 */
export function getFileName(path: string): string {
  return path.split(/[\/\\]/).pop() || path;
}

/**
 * Get directory name from path
 */
export function getDirName(path: string): string {
  const parts = path.split(/[\/\\]/);
  parts.pop();
  return parts.join('/');
}

/**
 * Join path segments
 */
export function joinPath(...segments: string[]): string {
  return segments
    .join('/')
    .replace(/\/+/g, '/')
    .replace(/\\/g, '/');
}
