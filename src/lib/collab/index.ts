/**
 * Kyro IDE - Collaboration Module
 * Real-time collaboration with CRDT
 */

export {
  collaborationManager,
  CRDTDocument,
  AwarenessManager,
  CollaborationRoom,
  type Collaborator,
  type CursorPosition,
  type SelectionRange,
  type TextOperation,
  type DocumentState,
  type SyncMessage,
  type RoomOptions,
} from './crdt-engine';

export {
  LiveCursorsManager,
  injectCursorStyles,
  type CursorDecoration,
} from './live-cursors';
