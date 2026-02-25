/**
 * Extended KRO IDE State Management
 * 
 * Manages state for all modules: Auth, Collaboration, E2EE, Extensions, MCP, Plugins, Updates
 */

import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';

// ============ Types ============

// Auth Types
export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  avatar?: string;
  created_at: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

// Collaboration Types
export interface Room {
  id: string;
  name: string;
  owner_id: string;
  user_count: number;
  max_users: number;
  created_at: string;
  is_encrypted: boolean;
}

export interface Collaborator {
  id: string;
  name: string;
  email?: string;
  avatar?: string;
  color: string;
}

export interface Presence {
  user_id: string;
  cursor_line: number;
  cursor_column: number;
  active_file?: string;
}

// Extension Types
export interface Extension {
  id: string;
  name: string;
  display_name: string;
  version: string;
  description?: string;
  publisher: string;
  enabled: boolean;
  installed: boolean;
  state: string;
  icon_url?: string;
  download_count?: number;
  rating?: number;
}

// Agent Types
export interface Agent {
  id: string;
  name: string;
  role: string;
  status: string;
  model: string;
}

export interface Task {
  id: string;
  description: string;
  status: string;
  assigned_agents: string[];
  result?: string;
  created_at: string;
}

// Plugin Types
export interface Plugin {
  id: string;
  name: string;
  version: string;
  author: string;
  description?: string;
  enabled: boolean;
  state: string;
  capabilities: string[];
  memory_limit_mb: number;
}

// Update Types
export interface UpdateInfo {
  version: string;
  current_version: string;
  release_date: string;
  release_notes: string;
  channel: string;
  size_mb: number;
  mandatory: boolean;
}

// ============ Store State ============

interface ExtendedKyroState {
  // Auth State
  user: User | null;
  isAuthenticated: boolean;
  authLoading: boolean;
  authError: string | null;

  // Collaboration State
  currentRoom: Room | null;
  rooms: Room[];
  collaborators: Collaborator[];
  presence: Presence[];
  collabConnected: boolean;

  // Extension State
  installedExtensions: Extension[];
  availableExtensions: Extension[];
  extensionLoading: boolean;

  // Agent State
  agents: Agent[];
  tasks: Task[];
  mcpTools: { name: string; description: string }[];

  // Plugin State
  plugins: Plugin[];
  pluginLoading: boolean;

  // Update State
  availableUpdate: UpdateInfo | null;
  updateProgress: number;
  updateChannel: string;
  autoUpdateEnabled: boolean;

  // Theme State
  theme: 'dark' | 'light' | 'system';

  // Settings State
  settings: {
    fontSize: number;
    tabSize: number;
    wordWrap: boolean;
    minimap: boolean;
    formatOnSave: boolean;
    autoSave: boolean;
    autoSaveDelay: number;
  };

  // ============ Auth Actions ============
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;

  // ============ Collaboration Actions ============
  createRoom: (name: string) => Promise<Room>;
  joinRoom: (roomId: string) => Promise<void>;
  leaveRoom: () => Promise<void>;
  fetchRooms: () => Promise<void>;
  updatePresence: (line: number, column: number, file?: string) => Promise<void>;

  // ============ Extension Actions ============
  fetchExtensions: () => Promise<void>;
  searchExtensions: (query: string) => Promise<void>;
  installExtension: (extensionId: string) => Promise<void>;
  uninstallExtension: (extensionId: string) => Promise<void>;
  toggleExtension: (extensionId: string, enabled: boolean) => Promise<void>;

  // ============ Agent Actions ============
  fetchAgents: () => Promise<void>;
  createAgent: (name: string, role: string) => Promise<void>;
  runAgent: (agentId: string, prompt: string) => Promise<string>;

  // ============ Plugin Actions ============
  fetchPlugins: () => Promise<void>;
  installPlugin: (wasmPath: string) => Promise<void>;
  togglePlugin: (pluginId: string, enabled: boolean) => Promise<void>;

  // ============ Update Actions ============
  checkForUpdates: () => Promise<void>;
  downloadUpdate: () => Promise<void>;
  installUpdate: () => Promise<void>;
  setUpdateChannel: (channel: string) => Promise<void>;

  // ============ Settings Actions ============
  updateSettings: (settings: Partial<ExtendedKyroState['settings']>) => void;
  setTheme: (theme: 'dark' | 'light' | 'system') => void;
}

export const useExtendedKyroStore = create<ExtendedKyroState>((set, get) => ({
  // Initial State
  user: null,
  isAuthenticated: false,
  authLoading: false,
  authError: null,

  currentRoom: null,
  rooms: [],
  collaborators: [],
  presence: [],
  collabConnected: false,

  installedExtensions: [],
  availableExtensions: [],
  extensionLoading: false,

  agents: [],
  tasks: [],
  mcpTools: [],

  plugins: [],
  pluginLoading: false,

  availableUpdate: null,
  updateProgress: 0,
  updateChannel: 'stable',
  autoUpdateEnabled: true,

  theme: 'dark',

  settings: {
    fontSize: 14,
    tabSize: 4,
    wordWrap: true,
    minimap: true,
    formatOnSave: true,
    autoSave: true,
    autoSaveDelay: 1000,
  },

  // Auth Actions
  login: async (email: string, password: string) => {
    set({ authLoading: true, authError: null });
    try {
      const response = await invoke<{ user: User; token: string }>('login_user', {
        request: { email, password }
      });
      set({ user: response.user, isAuthenticated: true, authLoading: false });
    } catch (error) {
      set({ authError: String(error), authLoading: false });
      throw error;
    }
  },

  register: async (email: string, password: string, name: string) => {
    set({ authLoading: true, authError: null });
    try {
      const response = await invoke<{ user: User; token: string }>('register_user', {
        request: { email, password, name }
      });
      set({ user: response.user, isAuthenticated: true, authLoading: false });
    } catch (error) {
      set({ authError: String(error), authLoading: false });
      throw error;
    }
  },

  logout: async () => {
    await invoke('logout_user');
    set({ user: null, isAuthenticated: false });
  },

  checkAuth: async () => {
    try {
      const user = await invoke<User | null>('get_current_user');
      set({ user, isAuthenticated: !!user });
    } catch {
      set({ user: null, isAuthenticated: false });
    }
  },

  // Collaboration Actions
  createRoom: async (name: string) => {
    const room = await invoke<Room>('create_room', {
      request: { name, maxUsers: 50, enableE2ee: true }
    });
    set((state) => ({ rooms: [...state.rooms, room] }));
    return room;
  },

  joinRoom: async (roomId: string) => {
    const user = get().user;
    if (!user) throw new Error('Not authenticated');

    await invoke('join_room', {
      request: {
        roomId,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          avatar: user.avatar,
          color: `#${Math.floor(Math.random()*16777215).toString(16)}`
        }
      }
    });
    
    const collaborators = await invoke<Collaborator[]>('get_room_users', { roomId });
    set({ currentRoom: { id: roomId } as Room, collaborators, collabConnected: true });
  },

  leaveRoom: async () => {
    const room = get().currentRoom;
    if (room) {
      await invoke('leave_room', { roomId: room.id });
    }
    set({ currentRoom: null, collaborators: [], presence: [], collabConnected: false });
  },

  fetchRooms: async () => {
    const rooms = await invoke<Room[]>('list_rooms');
    set({ rooms });
  },

  updatePresence: async (line: number, column: number, file?: string) => {
    const room = get().currentRoom;
    const user = get().user;
    if (!room || !user) return;

    await invoke('update_presence', {
      roomId: room.id,
      presence: {
        user_id: user.id,
        cursor_line: line,
        cursor_column: column,
        active_file: file
      }
    });
  },

  // Extension Actions
  fetchExtensions: async () => {
    set({ extensionLoading: true });
    const installed = await invoke<Extension[]>('list_installed_extensions');
    set({ installedExtensions: installed, extensionLoading: false });
  },

  searchExtensions: async (query: string) => {
    const result = await invoke<{ extensions: Extension[] }>('search_extensions', { query });
    set({ availableExtensions: result.extensions });
  },

  installExtension: async (extensionId: string) => {
    await invoke('install_extension', { request: { extensionId } });
    await get().fetchExtensions();
  },

  uninstallExtension: async (extensionId: string) => {
    await invoke('uninstall_extension', { extensionId });
    await get().fetchExtensions();
  },

  toggleExtension: async (extensionId: string, enabled: boolean) => {
    if (enabled) {
      await invoke('enable_extension', { extensionId });
    } else {
      await invoke('disable_extension', { extensionId });
    }
    await get().fetchExtensions();
  },

  // Agent Actions
  fetchAgents: async () => {
    const agents = await invoke<Agent[]>('list_agents');
    set({ agents });
  },

  createAgent: async (name: string, role: string) => {
    await invoke('create_agent', { name, role });
    await get().fetchAgents();
  },

  runAgent: async (agentId: string, prompt: string) => {
    const response = await invoke<{ response: string }>('run_agent', {
      request: { agentId, prompt }
    });
    return response.response;
  },

  // Plugin Actions
  fetchPlugins: async () => {
    set({ pluginLoading: true });
    const plugins = await invoke<Plugin[]>('list_plugins');
    set({ plugins, pluginLoading: false });
  },

  installPlugin: async (wasmPath: string) => {
    await invoke('install_plugin', { request: { wasmPath } });
    await get().fetchPlugins();
  },

  togglePlugin: async (pluginId: string, enabled: boolean) => {
    if (enabled) {
      await invoke('enable_plugin', { pluginId });
    } else {
      await invoke('disable_plugin', { pluginId });
    }
    await get().fetchPlugins();
  },

  // Update Actions
  checkForUpdates: async () => {
    const update = await invoke<UpdateInfo | null>('check_for_updates');
    set({ availableUpdate: update });
  },

  downloadUpdate: async () => {
    await invoke('download_update');
    // Progress would be tracked via events
  },

  installUpdate: async () => {
    await invoke('install_update');
  },

  setUpdateChannel: async (channel: string) => {
    await invoke('set_update_channel', { channel });
    set({ updateChannel: channel });
  },

  // Settings Actions
  updateSettings: (newSettings) => {
    set((state) => ({
      settings: { ...state.settings, ...newSettings }
    }));
  },

  setTheme: (theme) => {
    set({ theme });
    // Persist to localStorage
    localStorage.setItem('kro-theme', theme);
  },
}));
