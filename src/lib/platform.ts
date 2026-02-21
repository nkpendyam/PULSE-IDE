/**
 * Kyro IDE - Platform Adapter
 * Unified API that works in both web and Tauri desktop modes
 */

import { isTauri } from './tauri/api';

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
}

export interface GitStatus {
  branch: string;
  ahead: number;
  behind: number;
  staged: string[];
  unstaged: string[];
  untracked: string[];
}

export interface AIModel {
  id: string;
  name: string;
  provider: string;
  isLocal: boolean;
}

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIResponse {
  content: string;
  model: string;
  latency: number;
}

// ============================================================================
// FILE SYSTEM
// ============================================================================

export const filesystem = {
  async readFile(path: string): Promise<string> {
    if (isTauri()) {
      const { fs } = await import('./tauri/api');
      return fs.readFile(path);
    }
    // Web mode: use fetch to API route
    const response = await fetch('/api/fs?action=read&path=' + encodeURIComponent(path));
    return response.text();
  },

  async writeFile(path: string, content: string): Promise<void> {
    if (isTauri()) {
      const { fs } = await import('./tauri/api');
      return fs.writeFile(path, content);
    }
    // Web mode: use fetch to API route
    await fetch('/api/fs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'write', path, content })
    });
  },

  async listDir(path: string): Promise<FileInfo[]> {
    if (isTauri()) {
      const { fs } = await import('./tauri/api');
      const result = await fs.listDir(path);
      return result.entries;
    }
    // Web mode
    const response = await fetch('/api/fs?action=list&path=' + encodeURIComponent(path));
    return response.json();
  },

  async createDir(path: string): Promise<void> {
    if (isTauri()) {
      const { fs } = await import('./tauri/api');
      return fs.createDir(path);
    }
    await fetch('/api/fs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'mkdir', path })
    });
  },

  async delete(path: string): Promise<void> {
    if (isTauri()) {
      const { fs } = await import('./tauri/api');
      return fs.deleteFile(path);
    }
    await fetch('/api/fs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', path })
    });
  },
};

// ============================================================================
// GIT
// ============================================================================

export const git = {
  async status(path: string): Promise<GitStatus> {
    if (isTauri()) {
      const { git: tauriGit } = await import('./tauri/api');
      return tauriGit.status(path);
    }
    const response = await fetch('/api/git?action=status&path=' + encodeURIComponent(path));
    return response.json();
  },

  async commit(path: string, message: string): Promise<string> {
    if (isTauri()) {
      const { git: tauriGit } = await import('./tauri/api');
      return tauriGit.commit(path, message);
    }
    const response = await fetch('/api/git', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'commit', path, message })
    });
    return response.json();
  },

  async add(path: string, files: string[]): Promise<void> {
    if (isTauri()) {
      const { git: tauriGit } = await import('./tauri/api');
      return tauriGit.add(path, files);
    }
    await fetch('/api/git', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'add', path, files })
    });
  },
};

// ============================================================================
// AI
// ============================================================================

export const ai = {
  async chat(messages: AIMessage[], model?: string): Promise<AIResponse> {
    const startTime = Date.now();

    if (isTauri()) {
      const { ai: tauriAi } = await import('./tauri/api');
      const content = await tauriAi.ollamaChat(model || 'llama3', messages);
      return { content, model: model || 'llama3', latency: Date.now() - startTime };
    }

    // Web mode: use API route
    const response = await fetch('/api/ide', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'chat', messages, model })
    });
    const data = await response.json();
    return {
      content: data.content || data.response || '',
      model: data.model || model || 'unknown',
      latency: Date.now() - startTime
    };
  },

  async complete(code: string, language: string): Promise<string> {
    if (isTauri()) {
      // Use local Ollama for code completion
      const { ai: tauriAi } = await import('./tauri/api');
      const messages = [{ role: 'user', content: `Complete this ${language} code:\n\`\`\`${language}\n${code}` }];
      const result = await tauriAi.ollamaChat('codellama', messages);
      return result;
    }

    // Web mode
    const response = await fetch('/api/ide', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'complete', code, language })
    });
    const data = await response.json();
    return data.completion || '';
  },

  async getModels(): Promise<AIModel[]> {
    if (isTauri()) {
      const { ai: tauriAi } = await import('./tauri/api');
      const status = await tauriAi.ollamaStatus();
      if (status.running) {
        const models = await tauriAi.ollamaModels();
        return models.map(m => ({
          id: m.name,
          name: m.name,
          provider: 'ollama',
          isLocal: true
        }));
      }
      return [];
    }

    // Web mode
    const response = await fetch('/api/ide?action=models');
    const data = await response.json();
    return data.models || [];
  },
};

// ============================================================================
// TERMINAL
// ============================================================================

export const terminal = {
  async create(id: string, cwd?: string): Promise<void> {
    if (isTauri()) {
      const { terminal: tauriTerm } = await import('./tauri/api');
      return tauriTerm.create(id, cwd);
    }
    // Web mode: terminal is handled by xterm.js with WebSocket
    console.log('Terminal created:', id);
  },

  async write(id: string, data: string): Promise<void> {
    if (isTauri()) {
      const { terminal: tauriTerm } = await import('./tauri/api');
      return tauriTerm.write(id, data);
    }
    console.log('Terminal write:', id, data);
  },

  async destroy(id: string): Promise<void> {
    if (isTauri()) {
      const { terminal: tauriTerm } = await import('./tauri/api');
      return tauriTerm.destroy(id);
    }
    console.log('Terminal destroyed:', id);
  },
};

// ============================================================================
// SYSTEM
// ============================================================================

export const system = {
  isDesktop: isTauri(),

  async getInfo() {
    if (isTauri()) {
      const { system: tauriSystem } = await import('./tauri/api');
      return tauriSystem.getSystemInfo();
    }
    return {
      os: 'web',
      arch: 'unknown',
      hostname: 'browser',
      username: 'user'
    };
  },

  openExternal(url: string) {
    if (isTauri()) {
      import('./tauri/api').then(({ system }) => system.openExternal(url));
    } else {
      window.open(url, '_blank');
    }
  }
};

// Default export
export default {
  filesystem,
  git,
  ai,
  terminal,
  system,
  isTauri: isTauri()
};
