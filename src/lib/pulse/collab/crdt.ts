/**
 * Kyro IDE CRDT-based Collaborative Editing
 * 
 * Conflict-Free Replicated Data Types implementation for real-time
 * collaborative editing, similar to Figma, Google Docs, and Notion.
 * 
 * Features:
 * - YATA/Yjs-style CRDT for text
 * - Operation transformation
 * - Presence awareness
 * - Offline support with sync
 */

// ============================================================================
// TYPES
// ============================================================================

export interface CRDTNode {
  id: OperationId;
  origin: string; // Client ID
  left: OperationId | null;
  right: OperationId | null;
  content: string;
  deleted: boolean;
  attributes: Map<string, string>;
}

export interface OperationId {
  clientId: string;
  clock: number;
}

export interface TextOperation {
  type: 'insert' | 'delete' | 'retain';
  id: OperationId;
  position?: number;
  content?: string;
  length?: number;
  attributes?: Map<string, string>;
}

export interface Cursor {
  userId: string;
  userName: string;
  color: string;
  position: number;
  selection?: { start: number; end: number };
  lastSeen: number;
}

export interface UserPresence {
  userId: string;
  userName: string;
  color: string;
  cursor: Cursor | null;
  selections: Array<{ start: number; end: number }>;
  lastActive: number;
}

export interface DocumentState {
  documentId: string;
  version: number;
  content: string;
  nodes: CRDTNode[];
  cursors: Map<string, Cursor>;
  history: TextOperation[];
}

export interface SyncMessage {
  type: 'sync' | 'update' | 'awareness';
  documentId: string;
  clientId: string;
  version: number;
  operations?: TextOperation[];
  presence?: UserPresence;
  timestamp: number;
}

// ============================================================================
// YATA CRDT IMPLEMENTATION
// ============================================================================

export class YATACRDT {
  private nodes: CRDTNode[] = [];
  private clientId: string;
  private clock: number = 0;
  private pendingOps: TextOperation[] = [];

  constructor(clientId: string) {
    this.clientId = clientId;
    // Create initial boundary nodes
    this.nodes.push({
      id: { clientId: 'system', clock: 0 },
      origin: 'system',
      left: null,
      right: null,
      content: '',
      deleted: false,
      attributes: new Map(),
    });
  }

  /**
   * Insert text at position
   */
  insert(position: number, content: string, attributes?: Map<string, string>): TextOperation[] {
    const ops: TextOperation[] = [];
    
    // Find the node at position
    const { leftNode, rightNode } = this.findPosition(position);
    
    // Create operation
    const op: TextOperation = {
      type: 'insert',
      id: { clientId: this.clientId, clock: ++this.clock },
      position,
      content,
      attributes,
    };

    // Create new node
    const newNode: CRDTNode = {
      id: op.id,
      origin: this.clientId,
      left: leftNode?.id || null,
      right: rightNode?.id || null,
      content,
      deleted: false,
      attributes: attributes || new Map(),
    };

    // Integrate node
    this.integrateNode(newNode, leftNode, rightNode);
    ops.push(op);

    return ops;
  }

  /**
   * Delete text at position
   */
  delete(position: number, length: number): TextOperation[] {
    const ops: TextOperation[] = [];
    
    let currentPos = 0;
    for (const node of this.nodes) {
      if (node.deleted) continue;
      
      const nodeLength = node.content.length;
      const nodeStart = currentPos;
      const nodeEnd = currentPos + nodeLength;
      
      // Check if node overlaps with deletion range
      if (position < nodeEnd && position + length > nodeStart) {
        const deleteStart = Math.max(position, nodeStart);
        const deleteEnd = Math.min(position + length, nodeEnd);
        
        // Mark node as deleted
        node.deleted = true;
        
        ops.push({
          type: 'delete',
          id: { clientId: this.clientId, clock: ++this.clock },
          position: deleteStart,
          length: deleteEnd - deleteStart,
        });
      }
      
      currentPos = nodeEnd;
    }

    return ops;
  }

  /**
   * Apply remote operation
   */
  applyRemote(op: TextOperation): void {
    if (op.type === 'insert' && op.content) {
      const leftNode = op.id ? this.findNodeById({ clientId: '', clock: 0 }) : null;
      const newNode: CRDTNode = {
        id: op.id,
        origin: op.id.clientId,
        left: null,
        right: null,
        content: op.content,
        deleted: false,
        attributes: op.attributes || new Map(),
      };
      
      this.integrateNode(newNode, null, null);
    } else if (op.type === 'delete') {
      // Find and mark nodes as deleted
      let currentPos = 0;
      for (const node of this.nodes) {
        if (node.deleted) continue;
        
        if (currentPos >= op.position! && 
            currentPos < op.position! + (op.length || 0)) {
          node.deleted = true;
        }
        
        currentPos += node.content.length;
      }
    }
  }

  /**
   * Get current text content
   */
  getText(): string {
    return this.nodes
      .filter(n => !n.deleted && n.content)
      .map(n => n.content)
      .join('');
  }

  /**
   * Get all nodes
   */
  getNodes(): CRDTNode[] {
    return this.nodes;
  }

  /**
   * Find position in document
   */
  private findPosition(position: number): { leftNode: CRDTNode | null; rightNode: CRDTNode | null } {
    let currentPos = 0;
    let leftNode: CRDTNode | null = null;
    
    for (const node of this.nodes) {
      if (node.deleted) continue;
      
      if (currentPos === position) {
        return { leftNode, rightNode: node };
      }
      
      currentPos += node.content.length;
      leftNode = node;
    }
    
    return { leftNode, rightNode: null };
  }

  /**
   * Find node by ID
   */
  private findNodeById(id: OperationId): CRDTNode | null {
    return this.nodes.find(n => 
      n.id.clientId === id.clientId && n.id.clock === id.clock
    ) || null;
  }

  /**
   * Integrate new node using YATA algorithm
   */
  private integrateNode(
    newNode: CRDTNode,
    leftNode: CRDTNode | null,
    rightNode: CRDTNode | null
  ): void {
    // Find insertion position using YATA's scanning approach
    let insertIndex = 0;
    
    if (leftNode) {
      const leftIndex = this.nodes.indexOf(leftNode);
      insertIndex = leftIndex + 1;
    }
    
    // Scan for conflicts and resolve using client ID
    while (insertIndex < this.nodes.length) {
      const currentNode = this.nodes[insertIndex];
      
      if (this.shouldInsertBefore(newNode, currentNode, leftNode)) {
        break;
      }
      
      insertIndex++;
    }
    
    // Update links
    if (insertIndex > 0) {
      newNode.left = this.nodes[insertIndex - 1]?.id || null;
    }
    if (insertIndex < this.nodes.length) {
      newNode.right = this.nodes[insertIndex]?.id || null;
    }
    
    // Insert node
    this.nodes.splice(insertIndex, 0, newNode);
  }

  /**
   * Determine if new node should be inserted before current node
   */
  private shouldInsertBefore(
    newNode: CRDTNode,
    currentNode: CRDTNode,
    leftOrigin: CRDTNode | null
  ): boolean {
    // YATA's conflict resolution rules
    const leftOriginIndex = leftOrigin ? this.nodes.indexOf(leftOrigin) : -1;
    const currentIndex = this.nodes.indexOf(currentNode);
    
    // If current is leftOrigin's right neighbor, compare clocks
    if (leftOrigin && currentNode.left?.clientId === leftOrigin.id.clientId) {
      if (currentNode.id.clock < newNode.id.clock) {
        return false;
      }
      if (currentNode.id.clock === newNode.id.clock) {
        // Tie-break using client ID
        return newNode.id.clientId < currentNode.id.clientId;
      }
    }
    
    return currentIndex > leftOriginIndex;
  }

  /**
   * Get pending operations
   */
  getPendingOperations(): TextOperation[] {
    return this.pendingOps;
  }

  /**
   * Clear pending operations
   */
  clearPendingOperations(): void {
    this.pendingOps = [];
  }
}

// ============================================================================
// COLLABORATIVE DOCUMENT
// ============================================================================

export class CollaborativeDocument {
  private crdt: YATACRDT;
  private documentId: string;
  private users: Map<string, UserPresence> = new Map();
  private history: TextOperation[] = [];
  private version: number = 0;
  private undoStack: TextOperation[][] = [];
  private redoStack: TextOperation[][] = [];

  constructor(documentId: string, clientId: string) {
    this.documentId = documentId;
    this.crdt = new YATACRDT(clientId);
  }

  /**
   * Insert text at position
   */
  insert(position: number, content: string): TextOperation[] {
    const ops = this.crdt.insert(position, content);
    this.history.push(...ops);
    this.version++;
    this.undoStack.push(ops);
    this.redoStack = [];
    return ops;
  }

  /**
   * Delete text at position
   */
  delete(position: number, length: number): TextOperation[] {
    const ops = this.crdt.delete(position, length);
    this.history.push(...ops);
    this.version++;
    this.undoStack.push(ops);
    this.redoStack = [];
    return ops;
  }

  /**
   * Apply remote operations
   */
  applyRemote(operations: TextOperation[]): void {
    for (const op of operations) {
      this.crdt.applyRemote(op);
      this.history.push(op);
    }
    this.version++;
  }

  /**
   * Undo last operation
   */
  undo(): TextOperation[] | null {
    const lastOps = this.undoStack.pop();
    if (!lastOps) return null;
    
    // Create inverse operations
    const inverseOps: TextOperation[] = [];
    for (const op of lastOps.reverse()) {
      if (op.type === 'insert') {
        inverseOps.push(...this.crdt.delete(op.position!, op.content?.length || 0));
      } else if (op.type === 'delete') {
        // For delete, we'd need to store the deleted content
      }
    }
    
    this.redoStack.push(lastOps);
    return inverseOps;
  }

  /**
   * Redo last undone operation
   */
  redo(): TextOperation[] | null {
    const ops = this.redoStack.pop();
    if (!ops) return null;
    
    this.undoStack.push(ops);
    return ops;
  }

  /**
   * Get document content
   */
  getContent(): string {
    return this.crdt.getText();
  }

  /**
   * Set document content (for initial load)
   */
  setContent(content: string): void {
    this.crdt = new YATACRDT(this.crdt['clientId']);
    this.crdt.insert(0, content);
    this.version = 1;
  }

  /**
   * Update user presence
   */
  updatePresence(userId: string, presence: Partial<UserPresence>): void {
    const existing = this.users.get(userId) || {
      userId,
      userName: presence.userName || 'Anonymous',
      color: presence.color || this.generateUserColor(),
      cursor: null,
      selections: [],
      lastActive: Date.now(),
    };

    this.users.set(userId, {
      ...existing,
      ...presence,
      lastActive: Date.now(),
    });
  }

  /**
   * Remove user presence
   */
  removeUser(userId: string): void {
    this.users.delete(userId);
  }

  /**
   * Get all active users
   */
  getActiveUsers(): UserPresence[] {
    const now = Date.now();
    return Array.from(this.users.values())
      .filter(u => now - u.lastActive < 60000); // Active in last minute
  }

  /**
   * Get user cursors
   */
  getCursors(): Map<string, Cursor> {
    const cursors = new Map<string, Cursor>();
    for (const [userId, presence] of this.users) {
      if (presence.cursor) {
        cursors.set(userId, presence.cursor);
      }
    }
    return cursors;
  }

  /**
   * Get document state for sync
   */
  getState(): DocumentState {
    return {
      documentId: this.documentId,
      version: this.version,
      content: this.getContent(),
      nodes: this.crdt.getNodes(),
      cursors: this.getCursors(),
      history: this.history,
    };
  }

  /**
   * Generate user color
   */
  private generateUserColor(): string {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
      '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
      '#BB8FCE', '#85C1E9', '#F8B500', '#00CED1',
    ];
    return colors[this.users.size % colors.length];
  }
}

// ============================================================================
// COLLABORATION MANAGER
// ============================================================================

export class CollaborationManager {
  private documents: Map<string, CollaborativeDocument> = new Map();
  private clientId: string;
  private ws: WebSocket | null = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private offlineQueue: SyncMessage[] = [];

  constructor(clientId?: string) {
    this.clientId = clientId || this.generateClientId();
  }

  /**
   * Connect to collaboration server
   */
  connect(serverUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(serverUrl);

        this.ws.onopen = () => {
          console.log('Connected to collaboration server');
          this.reconnectAttempts = 0;
          this.flushOfflineQueue();
          resolve();
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(JSON.parse(event.data));
        };

        this.ws.onclose = () => {
          console.log('Disconnected from collaboration server');
          this.attemptReconnect(serverUrl);
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          reject(error);
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Disconnect from server
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Open or join a document
   */
  openDocument(documentId: string): CollaborativeDocument {
    let doc = this.documents.get(documentId);
    
    if (!doc) {
      doc = new CollaborativeDocument(documentId, this.clientId);
      this.documents.set(documentId, doc);
    }

    // Request sync from server
    this.send({
      type: 'sync',
      documentId,
      clientId: this.clientId,
      version: 0,
      timestamp: Date.now(),
    });

    return doc;
  }

  /**
   * Close a document
   */
  closeDocument(documentId: string): void {
    const doc = this.documents.get(documentId);
    if (doc) {
      // Save any pending changes
      this.documents.delete(documentId);
    }
  }

  /**
   * Broadcast operations to other clients
   */
  broadcastOperations(documentId: string, operations: TextOperation[]): void {
    const message: SyncMessage = {
      type: 'update',
      documentId,
      clientId: this.clientId,
      version: this.documents.get(documentId)?.['version'] || 0,
      operations,
      timestamp: Date.now(),
    };

    this.send(message);
  }

  /**
   * Update cursor position
   */
  updateCursor(documentId: string, position: number, selection?: { start: number; end: number }): void {
    const doc = this.documents.get(documentId);
    if (!doc) return;

    const cursor: Cursor = {
      userId: this.clientId,
      userName: 'User', // Would get from auth
      color: '', // Would get from user profile
      position,
      selection,
      lastSeen: Date.now(),
    };

    doc.updatePresence(this.clientId, { cursor });

    this.send({
      type: 'awareness',
      documentId,
      clientId: this.clientId,
      version: doc['version'],
      presence: {
        userId: this.clientId,
        userName: 'User',
        color: '',
        cursor,
        selections: selection ? [selection] : [],
        lastActive: Date.now(),
      },
      timestamp: Date.now(),
    });
  }

  /**
   * Handle incoming message
   */
  private handleMessage(message: SyncMessage): void {
    const doc = this.documents.get(message.documentId);
    if (!doc) return;

    switch (message.type) {
      case 'sync':
        // Initial sync - set document state
        if (message.operations) {
          doc.applyRemote(message.operations);
        }
        break;

      case 'update':
        // Apply remote operations
        if (message.operations && message.clientId !== this.clientId) {
          doc.applyRemote(message.operations);
        }
        break;

      case 'awareness':
        // Update user presence
        if (message.presence && message.clientId !== this.clientId) {
          doc.updatePresence(message.clientId, message.presence);
        }
        break;
    }
  }

  /**
   * Send message
   */
  private send(message: SyncMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      // Queue for later
      this.offlineQueue.push(message);
    }
  }

  /**
   * Flush offline queue
   */
  private flushOfflineQueue(): void {
    while (this.offlineQueue.length > 0) {
      const message = this.offlineQueue.shift()!;
      this.send(message);
    }
  }

  /**
   * Attempt to reconnect
   */
  private attemptReconnect(serverUrl: string): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);

    setTimeout(() => {
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      this.connect(serverUrl);
    }, delay);
  }

  /**
   * Generate unique client ID
   */
  private generateClientId(): string {
    return `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get connected status
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const createCollaborationManager = (clientId?: string) => 
  new CollaborationManager(clientId);

export const createCollaborativeDocument = (documentId: string, clientId: string) =>
  new CollaborativeDocument(documentId, clientId);
