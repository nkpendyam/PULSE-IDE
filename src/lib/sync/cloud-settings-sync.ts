/**
 * Kyro IDE - Cloud Settings Sync Service
 * Syncs IDE settings across devices using cloud storage
 */

import { EventEmitter } from 'events';

// ============================================================================
// TYPES
// ============================================================================

export interface SettingsSyncConfig {
  enabled: boolean;
  provider: 'local' | 'github' | 'custom';
  syncInterval: number;
  conflictResolution: 'local' | 'remote' | 'manual';
  lastSync?: number;
}

export interface SyncableSettings {
  editor: {
    fontSize: number;
    fontFamily: string;
    tabSize: number;
    insertSpaces: boolean;
    wordWrap: 'on' | 'off' | 'bounded';
    minimap: boolean;
    lineNumbers: 'on' | 'off' | 'relative';
  };
  theme: {
    id: string;
    customizations?: Record<string, unknown>;
  };
  keybindings: Array<{
    command: string;
    key: string;
    when?: string;
  }>;
  extensions: {
    enabled: string[];
    disabled: string[];
    settings: Record<string, unknown>;
  };
  terminal: {
    fontSize: number;
    fontFamily: string;
    shell: string;
  };
  ai: {
    defaultModel: string;
    temperature: number;
    contextWindow: number;
  };
}

export interface SyncResult {
  success: boolean;
  timestamp: number;
  conflict?: {
    local: Partial<SyncableSettings>;
    remote: Partial<SyncableSettings>;
  };
  error?: string;
}

export interface SyncStatus {
  enabled: boolean;
  lastSync: number | null;
  syncing: boolean;
  error: string | null;
  pendingChanges: boolean;
}

// ============================================================================
// DEFAULT SETTINGS
// ============================================================================

export const DEFAULT_SETTINGS: SyncableSettings = {
  editor: {
    fontSize: 14,
    fontFamily: 'JetBrains Mono, Menlo, monospace',
    tabSize: 2,
    insertSpaces: true,
    wordWrap: 'off',
    minimap: true,
    lineNumbers: 'on',
  },
  theme: {
    id: 'dark-plus',
  },
  keybindings: [],
  extensions: {
    enabled: [],
    disabled: [],
    settings: {},
  },
  terminal: {
    fontSize: 13,
    fontFamily: 'JetBrains Mono, Menlo, monospace',
    shell: 'auto',
  },
  ai: {
    defaultModel: 'claude-3-sonnet',
    temperature: 0.7,
    contextWindow: 4096,
  },
};

// ============================================================================
// CLOUD SETTINGS SYNC SERVICE
// ============================================================================

export class CloudSettingsSyncService extends EventEmitter {
  private config: SettingsSyncConfig;
  private localSettings: SyncableSettings;
  private remoteSettings: SyncableSettings | null = null;
  private syncTimer: ReturnType<typeof setInterval> | null = null;
  private syncing: boolean = false;
  private storageKey: string = 'kyro-ide-settings';
  private pendingChanges: boolean = false;

  constructor(config: Partial<SettingsSyncConfig> = {}) {
    super();
    this.config = {
      enabled: config.enabled ?? false,
      provider: config.provider ?? 'local',
      syncInterval: config.syncInterval ?? 60000,
      conflictResolution: config.conflictResolution ?? 'manual',
      lastSync: config.lastSync,
    };

    this.localSettings = this.loadLocalSettings();
  }

  async enable(): Promise<void> {
    this.config.enabled = true;
    await this.startSync();
    this.emit('enabled');
  }

  disable(): void {
    this.config.enabled = false;
    this.stopSync();
    this.emit('disabled');
  }

  getSettings(): SyncableSettings {
    return { ...this.localSettings };
  }

  async updateSettings(settings: Partial<SyncableSettings>): Promise<void> {
    this.localSettings = { ...this.localSettings, ...settings };
    this.saveLocalSettings();
    this.pendingChanges = true;
    this.emit('settings:changed', this.localSettings);

    if (this.config.enabled) {
      await this.sync();
    }
  }

  async sync(): Promise<SyncResult> {
    if (this.syncing) {
      return { success: false, timestamp: Date.now(), error: 'Sync in progress' };
    }

    this.syncing = true;
    this.emit('sync:start');

    try {
      const remote = await this.loadRemoteSettings();

      if (remote && this.hasConflict(remote)) {
        const resolved = await this.resolveConflict(remote);
        if (!resolved) {
          this.syncing = false;
          return {
            success: false,
            timestamp: Date.now(),
            conflict: { local: this.localSettings, remote },
          };
        }
      }

      const merged = this.mergeSettings(this.localSettings, remote);
      await this.saveRemoteSettings(merged);
      this.remoteSettings = merged;
      this.config.lastSync = Date.now();
      this.pendingChanges = false;

      this.emit('sync:complete', merged);
      return { success: true, timestamp: this.config.lastSync };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.emit('sync:error', errorMessage);
      return { success: false, timestamp: Date.now(), error: errorMessage };
    } finally {
      this.syncing = false;
    }
  }

  getStatus(): SyncStatus {
    return {
      enabled: this.config.enabled,
      lastSync: this.config.lastSync ?? null,
      syncing: this.syncing,
      error: null,
      pendingChanges: this.pendingChanges,
    };
  }

  async resolveConflictManually(resolution: 'local' | 'remote'): Promise<void> {
    if (resolution === 'local') {
      await this.saveRemoteSettings(this.localSettings);
    } else if (this.remoteSettings) {
      this.localSettings = this.remoteSettings;
      this.saveLocalSettings();
    }
    this.emit('conflict:resolved', resolution);
  }

  exportSettings(): string {
    return JSON.stringify({
      version: '1.0.0',
      timestamp: Date.now(),
      settings: this.localSettings,
    }, null, 2);
  }

  async importSettings(json: string): Promise<boolean> {
    try {
      const data = JSON.parse(json);
      if (data.settings) {
        await this.updateSettings(data.settings);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  async resetToDefaults(): Promise<void> {
    this.localSettings = { ...DEFAULT_SETTINGS };
    this.saveLocalSettings();
    this.emit('settings:reset');
  }

  // Private methods
  private loadLocalSettings(): SyncableSettings {
    if (typeof window === 'undefined') return { ...DEFAULT_SETTINGS };

    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
    return { ...DEFAULT_SETTINGS };
  }

  private saveLocalSettings(): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.localSettings));
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  }

  private async loadRemoteSettings(): Promise<SyncableSettings | null> {
    if (typeof window === 'undefined') return null;

    try {
      const db = await this.openDatabase();
      const tx = db.transaction('settings', 'readonly');
      const store = tx.objectStore('settings');
      const result = await this.idbRequestToPromise(store.get('sync'));
      return result?.settings ?? null;
    } catch (error) {
      console.error('Failed to load remote settings:', error);
      return null;
    }
  }

  private async saveRemoteSettings(settings: SyncableSettings): Promise<void> {
    if (typeof window === 'undefined') return;

    try {
      const db = await this.openDatabase();
      const tx = db.transaction('settings', 'readwrite');
      const store = tx.objectStore('settings');
      await this.idbRequestToPromise(store.put({
        id: 'sync',
        settings,
        timestamp: Date.now(),
      }));
    } catch (error) {
      console.error('Failed to save remote settings:', error);
      throw error;
    }
  }

  private openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('kyro-ide-sync', 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'id' });
        }
      };
    });
  }

  private idbRequestToPromise<T>(request: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  private hasConflict(remote: SyncableSettings): boolean {
    return JSON.stringify(remote) !== JSON.stringify(this.localSettings);
  }

  private async resolveConflict(_remote: SyncableSettings): Promise<boolean> {
    switch (this.config.conflictResolution) {
      case 'local':
        await this.saveRemoteSettings(this.localSettings);
        return true;
      case 'remote':
        return true;
      default:
        return false;
    }
  }

  private mergeSettings(local: SyncableSettings, remote: SyncableSettings | null): SyncableSettings {
    if (!remote) return local;
    return {
      ...remote,
      ...local,
      editor: { ...remote.editor, ...local.editor },
      theme: { ...remote.theme, ...local.theme },
      terminal: { ...remote.terminal, ...local.terminal },
      ai: { ...remote.ai, ...local.ai },
    };
  }

  private startSync(): void {
    this.stopSync();
    if (this.config.enabled && this.config.syncInterval > 0) {
      this.syncTimer = setInterval(() => this.sync().catch(console.error), this.config.syncInterval);
    }
  }

  private stopSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }

  dispose(): void {
    this.stopSync();
    this.removeAllListeners();
  }
}

// Singleton
let instance: CloudSettingsSyncService | null = null;

export function getCloudSettingsSync(): CloudSettingsSyncService {
  if (!instance) {
    instance = new CloudSettingsSyncService();
  }
  return instance;
}

export default CloudSettingsSyncService;
