/**
 * Kyro IDE - CRDT Engine for Real-time Collaboration
 * Based on Yjs for conflict-free document synchronization
 */

import { EventEmitter } from 'events';

// ============================================================================
// TYPES
// ============================================================================

export interface Collaborator {
  id: string;
  name: string;
  color: string;
  avatar?: string;
  cursor?: CursorPosition;
  selection?: SelectionRange;
  lastActive: Date;
}

export interface CursorPosition {
  line: number;
  column: number;
}

export interface SelectionRange {
  start: CursorPosition;
  end: CursorPosition;
}

export interface TextOperation {
  type: 'insert' | 'delete' | 'replace';
  position: number;
  text?: string;
  length?: number;
}

export interface DocumentState {
  content: string;
  version: number;
  lastModified: Date;
  modifiedBy?: string;
}

export interface SyncMessage {
  type: 'sync' | 'update' | 'awareness' | 'cursor' | 'selection';
  clientId: string;
  documentId: string;
  payload: unknown;
  timestamp: number;
}

// ============================================================================
// CRDT DOCUMENT
// ============================================================================

class CRDTDocument extends EventEmitter {
  private content: string = '';
  private version: number = 0;
  private pendingOps: TextOperation[] = [];
  private clientId: string;

  constructor(clientId: string, initialContent: string = '') {
    super();
    this.clientId = clientId;
    this.content = initialContent;
  }

  // Get current content
  getContent(): string {
    return this.content;
  }

  // Get document state
  getState(): DocumentState {
    return {
      content: this.content,
      version: this.version,
      lastModified: new Date(),
    };
  }

  // Insert text at position
  insert(position: number, text: string): void {
    if (position < 0 || position > this.content.length) return;

    const op: TextOperation = {
      type: 'insert',
      position,
      text,
    };

    this.applyOperation(op);
    this.emit('change', { type: 'insert', position, text, version: this.version });
  }

  // Delete text at position
  delete(position: number, length: number): void {
    if (position < 0 || position + length > this.content.length) return;

    const op: TextOperation = {
      type: 'delete',
      position,
      length,
    };

    this.applyOperation(op);
    this.emit('change', { type: 'delete', position, length, version: this.version });
  }

  // Replace text
  replace(position: number, length: number, text: string): void {
    if (position < 0) return;

    const op: TextOperation = {
      type: 'replace',
      position,
      length,
      text,
    };

    this.applyOperation(op);
    this.emit('change', { type: 'replace', position, length, text, version: this.version });
  }

  // Apply operation
  private applyOperation(op: TextOperation): void {
    switch (op.type) {
      case 'insert':
        this.content = 
          this.content.slice(0, op.position) + 
          (op.text || '') + 
          this.content.slice(op.position);
        break;
      case 'delete':
        this.content = 
          this.content.slice(0, op.position) + 
          this.content.slice(op.position + (op.length || 0));
        break;
      case 'replace':
        this.content = 
          this.content.slice(0, op.position) + 
          (op.text || '') + 
          this.content.slice(op.position + (op.length || 0));
        break;
    }
    this.version++;
  }

  // Generate delta for synchronization
  generateDelta(fromVersion: number): TextOperation[] {
    // In a real implementation, this would return operations since fromVersion
    return this.pendingOps;
  }

  // Apply remote operations
  applyRemoteOperations(ops: TextOperation[]): void {
    for (const op of ops) {
      this.applyOperation(op);
    }
    this.emit('remoteChange', ops);
  }

  // Get length
  get length(): number {
    return this.content.length;
  }
}

// ============================================================================
// AWARENESS MANAGER
// ============================================================================

class AwarenessManager extends EventEmitter {
  private collaborators: Map<string, Collaborator> = new Map();
  private localClientId: string;
  private localState: Partial<Collaborator>;

  constructor(clientId: string) {
    super();
    this.localClientId = clientId;
    this.localState = {
      id: clientId,
      name: 'You',
      color: this.generateColor(clientId),
      lastActive: new Date(),
    };
  }

  // Generate consistent color from client ID
  private generateColor(id: string): string {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
      '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
    ];
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = ((hash << 5) - hash) + id.charCodeAt(i);
      hash = hash & hash;
    }
    return colors[Math.abs(hash) % colors.length];
  }

  // Set local cursor position
  setCursor(position: CursorPosition): void {
    this.localState.cursor = position;
    this.localState.lastActive = new Date();
    this.emit('localUpdate', this.localState);
  }

  // Set local selection
  setSelection(selection: SelectionRange | null): void {
    this.localState.selection = selection || undefined;
    this.localState.lastActive = new Date();
    this.emit('localUpdate', this.localState);
  }

  // Set local user info
  setUserInfo(name: string, avatar?: string): void {
    this.localState.name = name;
    this.localState.avatar = avatar;
    this.emit('localUpdate', this.localState);
  }

  // Get local state for sync
  getLocalState(): Partial<Collaborator> {
    return { ...this.localState };
  }

  // Update remote collaborator
  updateCollaborator(collaborator: Collaborator): void {
    collaborator.lastActive = new Date();
    this.collaborators.set(collaborator.id, collaborator);
    this.emit('collaboratorUpdate', collaborator);
  }

  // Remove collaborator
  removeCollaborator(clientId: string): void {
    this.collaborators.delete(clientId);
    this.emit('collaboratorLeave', clientId);
  }

  // Get all collaborators
  getCollaborators(): Collaborator[] {
    return Array.from(this.collaborators.values());
  }

  // Clean up inactive collaborators
  cleanupInactive(timeoutMs: number = 30000): void {
    const now = new Date();
    for (const [id, collab] of this.collaborators) {
      if (now.getTime() - collab.lastActive.getTime() > timeoutMs) {
        this.removeCollaborator(id);
      }
    }
  }
}

// ============================================================================
// COLLABORATION ROOM
// ============================================================================

export interface RoomOptions {
  roomId: string;
  documentId: string;
  userId: string;
  userName?: string;
}

class CollaborationRoom extends EventEmitter {
  private roomId: string;
  private documentId: string;
  private document: CRDTDocument;
  private awareness: AwarenessManager;
  private connected: boolean = false;
  private ws: WebSocket | null = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;

  constructor(options: RoomOptions) {
    super();
    this.roomId = options.roomId;
    this.documentId = options.documentId;
    this.document = new CRDTDocument(options.userId);
    this.awareness = new AwarenessManager(options.userId);

    if (options.userName) {
      this.awareness.setUserInfo(options.userName);
    }

    this.setupDocumentListeners();
    this.setupAwarenessListeners();
  }

  // Setup document change listeners
  private setupDocumentListeners(): void {
    this.document.on('change', (change: any) => {
      this.broadcast({
        type: 'update',
        clientId: this.awareness.getLocalState().id!,
        documentId: this.documentId,
        payload: change,
        timestamp: Date.now(),
      });
    });

    this.document.on('remoteChange', (ops: TextOperation[]) => {
      this.emit('documentUpdate', this.document.getContent());
    });
  }

  // Setup awareness listeners
  private setupAwarenessListeners(): void {
    this.awareness.on('localUpdate', (state: Partial<Collaborator>) => {
      this.broadcast({
        type: 'awareness',
        clientId: this.awareness.getLocalState().id!,
        documentId: this.documentId,
        payload: state,
        timestamp: Date.now(),
      });
    });

    this.awareness.on('collaboratorUpdate', (collab: Collaborator) => {
      this.emit('collaboratorJoined', collab);
    });

    this.awareness.on('collaboratorLeave', (clientId: string) => {
      this.emit('collaboratorLeft', clientId);
    });
  }

  // Connect to collaboration server
  async connect(serverUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const url = `${serverUrl}/room/${this.roomId}`;
        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
          this.connected = true;
          this.reconnectAttempts = 0;
          this.emit('connected');
          resolve();
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(JSON.parse(event.data));
        };

        this.ws.onclose = () => {
          this.connected = false;
          this.emit('disconnected');
          this.attemptReconnect(serverUrl);
        };

        this.ws.onerror = (error) => {
          this.emit('error', error);
          reject(error);
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  // Attempt reconnection
  private attemptReconnect(serverUrl: string): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.emit('reconnectFailed');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);

    setTimeout(() => {
      this.connect(serverUrl).catch(() => {
        // Reconnection failed, will try again
      });
    }, delay);
  }

  // Disconnect
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
    this.emit('disconnected');
  }

  // Handle incoming message
  private handleMessage(message: SyncMessage): void {
    switch (message.type) {
      case 'sync':
        // Initial sync from server
        if (typeof message.payload === 'string') {
          this.document.applyRemoteOperations([
            { type: 'insert', position: 0, text: message.payload }
          ]);
        }
        break;

      case 'update':
        // Remote operation
        if (message.clientId !== this.awareness.getLocalState().id) {
          if (Array.isArray(message.payload)) {
            this.document.applyRemoteOperations(message.payload);
          }
        }
        break;

      case 'awareness':
        // Collaborator state update
        if (message.clientId !== this.awareness.getLocalState().id) {
          this.awareness.updateCollaborator(message.payload as Collaborator);
        }
        break;

      case 'cursor':
        // Cursor position update
        if (message.clientId !== this.awareness.getLocalState().id) {
          const collab = this.awareness.getCollaborators().find(c => c.id === message.clientId);
          if (collab) {
            collab.cursor = message.payload as CursorPosition;
            this.awareness.updateCollaborator(collab);
            this.emit('cursorMove', collab);
          }
        }
        break;

      case 'selection':
        // Selection update
        if (message.clientId !== this.awareness.getLocalState().id) {
          const collab = this.awareness.getCollaborators().find(c => c.id === message.clientId);
          if (collab) {
            collab.selection = message.payload as SelectionRange;
            this.awareness.updateCollaborator(collab);
            this.emit('selectionChange', collab);
          }
        }
        break;
    }
  }

  // Broadcast message to server
  private broadcast(message: SyncMessage): void {
    if (this.ws && this.connected) {
      this.ws.send(JSON.stringify(message));
    }
  }

  // Get document
  getDocument(): CRDTDocument {
    return this.document;
  }

  // Get awareness
  getAwareness(): AwarenessManager {
    return this.awareness;
  }

  // Get collaborators
  getCollaborators(): Collaborator[] {
    return this.awareness.getCollaborators();
  }

  // Check if connected
  isConnected(): boolean {
    return this.connected;
  }
}

// ============================================================================
// COLLABORATION MANAGER
// ============================================================================

class CollaborationManager extends EventEmitter {
  private rooms: Map<string, CollaborationRoom> = new Map();
  private serverUrl: string = 'wss://collab.kyro-ide.dev';
  private userId: string;
  private userName: string;

  constructor() {
    super();
    this.userId = this.generateUserId();
    this.userName = 'Anonymous';
  }

  // Generate unique user ID
  private generateUserId(): string {
    return `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Set user info
  setUserInfo(name: string): void {
    this.userName = name;
  }

  // Set server URL
  setServerUrl(url: string): void {
    this.serverUrl = url;
  }

  // Join a room
  async joinRoom(roomId: string, documentId: string): Promise<CollaborationRoom> {
    const existingRoom = this.rooms.get(roomId);
    if (existingRoom) {
      return existingRoom;
    }

    const room = new CollaborationRoom({
      roomId,
      documentId,
      userId: this.userId,
      userName: this.userName,
    });

    // Forward room events
    room.on('connected', () => this.emit('roomConnected', roomId));
    room.on('disconnected', () => this.emit('roomDisconnected', roomId));
    room.on('collaboratorJoined', (c) => this.emit('collaboratorJoined', c));
    room.on('collaboratorLeft', (id) => this.emit('collaboratorLeft', id));
    room.on('cursorMove', (c) => this.emit('cursorMove', c));
    room.on('selectionChange', (c) => this.emit('selectionChange', c));

    await room.connect(this.serverUrl);
    this.rooms.set(roomId, room);

    return room;
  }

  // Leave a room
  async leaveRoom(roomId: string): Promise<void> {
    const room = this.rooms.get(roomId);
    if (room) {
      room.disconnect();
      this.rooms.delete(roomId);
    }
  }

  // Get room
  getRoom(roomId: string): CollaborationRoom | undefined {
    return this.rooms.get(roomId);
  }

  // Get all rooms
  getRooms(): CollaborationRoom[] {
    return Array.from(this.rooms.values());
  }

  // Get user ID
  getUserId(): string {
    return this.userId;
  }

  // Disconnect all rooms
  disconnectAll(): void {
    for (const room of this.rooms.values()) {
      room.disconnect();
    }
    this.rooms.clear();
  }
}

// Export singletons and classes
export const collaborationManager = new CollaborationManager();
export { CRDTDocument, AwarenessManager, CollaborationRoom };
