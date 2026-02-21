/**
 * Kyro IDE Collaboration Module
 * 
 * Real-time collaborative editing using CRDT (Conflict-Free Replicated Data Types)
 * for conflict-free concurrent editing.
 */

// CRDT-based Collaboration
export {
  YATACRDT,
  CollaborativeDocument,
  CollaborationManager,
  createCollaborationManager,
  createCollaborativeDocument,
  // Types
  type CRDTNode,
  type OperationId,
  type TextOperation,
  type Cursor,
  type UserPresence,
  type DocumentState,
  type SyncMessage,
} from './crdt';
