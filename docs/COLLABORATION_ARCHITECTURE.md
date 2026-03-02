# Kyro IDE - Live Collaboration Architecture

## Overview

Kyro supports live sharing and collaboration for **50+ participants** using CRDT-based sync.

## Stack

- **CRDT**: Yrs (Yjs Rust port), Loro, optional Automerge
- **Transport**: WebSocket (commands::websocket, commands::collaboration)
- **Presence**: Awareness protocol (cursors, selections, names, colors)

## Components

| Component | Location | Role |
|-----------|----------|------|
| CollabRoom | src-tauri/src/collab/mod.rs | Document + awareness state per room |
| CollaborationState | src-tauri/src/commands/collaboration.rs | Room management, join/leave |
| WebSocket | commands::websocket | Connection to collab server |
| Git CRDT | src-tauri/src/git_crdt | Git persistence for CRDT docs |

## Scaling to 50+ Participants

1. **Delta-based sync**: Broadcast only CRDT deltas, not full document
2. **Room sharding**: One document per file; multiple rooms per session
3. **Awareness batching**: Batch presence updates to reduce message volume
4. **WebSocket server**: Can be scaled via multiple instances + Redis pub/sub

## API (Tauri Commands)

- `create_room` - Create room with optional max_users (default 50+)
- `join_room` - Join by room ID
- `leave_room` - Leave current room
- `send_operation` - Send CRDT operation
- `update_presence` - Update cursor/selection
- `get_room_users` - List participants

## Monaco Integration

The frontend should bind Monaco editor to the CRDT document via:
1. Yjs/Yrs document as single source of truth
2. Monaco `onDidChangeModelContent` → emit operations to backend
3. Backend broadcasts to other clients
4. Apply remote operations to local Yrs doc → Monaco updates
