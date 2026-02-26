//! P2P Document Synchronization
//!
//! Implements CRDT-based document synchronization for collaborative editing.
//! Uses Yrs (Yjs Rust port) for conflict-free replicated data types.

use anyhow::{Result, Context, bail};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{RwLock, Mutex, broadcast};
use serde::{Deserialize, Serialize};
use yrs::{Doc, ReadTxn, Transact, Transaction, Text, Map, Array, XmlText};
use yrs::updates::decoder::Decode;
use yrs::updates::encoder::Encode;
use yrs::sync::{Awareness, AwarenessUpdate};
use yrs::sync::protocol::SyncMessage;

use super::{PeerId, PeerMessage, DocumentEdit, EditOperation, CursorPosition, Selection};

/// Document ID
pub type DocumentId = String;

/// Sync configuration
#[derive(Debug, Clone)]
pub struct SyncConfig {
    /// Maximum document size in bytes
    pub max_doc_size: usize,
    /// Sync interval in milliseconds
    pub sync_interval_ms: u64,
    /// Enable presence awareness
    pub enable_awareness: bool,
    /// Keep history for undo/redo
    pub history_size: usize,
}

impl Default for SyncConfig {
    fn default() -> Self {
        Self {
            max_doc_size: 10 * 1024 * 1024, // 10MB
            sync_interval_ms: 100,
            enable_awareness: true,
            history_size: 100,
        }
    }
}

/// Document sync state
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocumentState {
    pub id: DocumentId,
    pub version: u64,
    pub checksum: String,
    pub last_modified: u64,
    pub modified_by: Option<PeerId>,
}

/// Sync event
#[derive(Debug, Clone)]
pub enum SyncEvent {
    DocumentOpened { doc_id: DocumentId },
    DocumentClosed { doc_id: DocumentId },
    DocumentSynced { doc_id: DocumentId, version: u64 },
    DocumentConflict { doc_id: DocumentId, resolution: String },
    RemoteEdit { doc_id: DocumentId, from: PeerId, edit: DocumentEdit },
    CursorUpdate { doc_id: DocumentId, from: PeerId, position: CursorPosition },
    SelectionUpdate { doc_id: DocumentId, from: PeerId, selection: Selection },
    SyncError { doc_id: DocumentId, error: String },
}

/// Local awareness state
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocalAwareness {
    pub peer_id: PeerId,
    pub display_name: String,
    pub cursor: Option<CursorPosition>,
    pub selection: Option<Selection>,
    pub color: String,
}

/// Document synchronizer using CRDT
pub struct DocumentSynchronizer {
    config: SyncConfig,
    local_peer_id: PeerId,
    /// Open documents
    documents: Arc<RwLock<HashMap<DocumentId, SyncedDocument>>>,
    /// Awareness state per document
    awareness: Arc<RwLock<HashMap<DocumentId, Awareness>>>,
    /// Local awareness
    local_awareness: Arc<Mutex<LocalAwareness>>,
    /// Event broadcaster
    event_tx: broadcast::Sender<SyncEvent>,
}

/// A synchronized document
struct SyncedDocument {
    /// Yrs document
    doc: Doc,
    /// Main text content
    text: Text,
    /// Document state
    state: DocumentState,
    /// Pending local changes
    pending_changes: Vec<EditOperation>,
    /// Last sync timestamp
    last_sync: std::time::Instant,
}

impl DocumentSynchronizer {
    /// Create a new document synchronizer
    pub fn new(local_peer_id: PeerId, config: SyncConfig) -> Self {
        let (event_tx, _) = broadcast::channel(128);
        
        let local_awareness = LocalAwareness {
            peer_id: local_peer_id.clone(),
            display_name: "User".to_string(),
            cursor: None,
            selection: None,
            color: Self::generate_peer_color(&local_peer_id),
        };
        
        Self {
            config,
            local_peer_id,
            documents: Arc::new(RwLock::new(HashMap::new())),
            awareness: Arc::new(RwLock::new(HashMap::new())),
            local_awareness: Arc::new(Mutex::new(local_awareness)),
            event_tx,
        }
    }
    
    /// Generate a consistent color for a peer
    fn generate_peer_color(peer_id: &PeerId) -> String {
        // Generate color based on peer ID hash
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};
        
        let mut hasher = DefaultHasher::new();
        peer_id.as_str().hash(&mut hasher);
        let hash = hasher.finish();
        
        let colors = [
            "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4",
            "#FFEAA7", "#DDA0DD", "#98D8C8", "#F7DC6F",
        ];
        
        colors[(hash % colors.len() as u64) as usize].to_string()
    }
    
    /// Open a document for editing
    pub async fn open_document(&self, doc_id: DocumentId, initial_content: Option<String>) -> Result<()> {
        let doc = Doc::new();
        let text = doc.get_or_insert_text("content");
        
        // Set initial content if provided
        if let Some(content) = initial_content {
            let mut txn = doc.transact_mut();
            text.push(&mut txn, &content);
        }
        
        let state = DocumentState {
            id: doc_id.clone(),
            version: 0,
            checksum: String::new(),
            last_modified: chrono::Utc::now().timestamp() as u64,
            modified_by: None,
        };
        
        let synced_doc = SyncedDocument {
            doc,
            text,
            state,
            pending_changes: Vec::new(),
            last_sync: std::time::Instant::now(),
        };
        
        self.documents.write().await.insert(doc_id.clone(), synced_doc);
        
        // Initialize awareness
        if self.config.enable_awareness {
            let awareness = Awareness::new();
            self.awareness.write().await.insert(doc_id.clone(), awareness);
        }
        
        let _ = self.event_tx.send(SyncEvent::DocumentOpened { doc_id });
        
        Ok(())
    }
    
    /// Close a document
    pub async fn close_document(&self, doc_id: &DocumentId) -> Result<()> {
        self.documents.write().await.remove(doc_id);
        self.awareness.write().await.remove(doc_id);
        
        let _ = self.event_tx.send(SyncEvent::DocumentClosed { doc_id: doc_id.clone() });
        
        Ok(())
    }
    
    /// Get document content
    pub async fn get_content(&self, doc_id: &DocumentId) -> Result<String> {
        let docs = self.documents.read().await;
        let synced = docs.get(doc_id)
            .context("Document not open")?;
        
        let txn = synced.doc.transact();
        let content = synced.text.get_string(&txn);
        
        Ok(content)
    }
    
    /// Apply local edit
    pub async fn apply_local_edit(&self, doc_id: &DocumentId, edit: EditOperation) -> Result<()> {
        let mut docs = self.documents.write().await;
        let synced = docs.get_mut(doc_id)
            .context("Document not open")?;
        
        let mut txn = synced.doc.transact_mut();
        
        // Apply edit to Yrs document
        match edit {
            EditOperation::Insert { position, text } => {
                synced.text.insert(&mut txn, position as u32, &text)?;
            }
            EditOperation::Delete { position, length } => {
                synced.text.remove_range(&mut txn, position as u32, length as u32)?;
            }
            EditOperation::Replace { position, length, text } => {
                synced.text.remove_range(&mut txn, position as u32, length as u32)?;
                synced.text.insert(&mut txn, position as u32, &text)?;
            }
            EditOperation::Batch { operations } => {
                for op in operations {
                    match op {
                        EditOperation::Insert { position, text } => {
                            synced.text.insert(&mut txn, position as u32, &text)?;
                        }
                        EditOperation::Delete { position, length } => {
                            synced.text.remove_range(&mut txn, position as u32, length as u32)?;
                        }
                        EditOperation::Replace { position, length, text } => {
                            synced.text.remove_range(&mut txn, position as u32, length as u32)?;
                            synced.text.insert(&mut txn, position as u32, &text)?;
                        }
                        EditOperation::Batch { .. } => {
                            // Nested batches not supported
                        }
                    }
                }
            }
        }
        
        // Update state
        synced.state.version += 1;
        synced.state.last_modified = chrono::Utc::now().timestamp() as u64;
        synced.state.modified_by = Some(self.local_peer_id.clone());
        
        // Generate checksum
        let content = synced.text.get_string(&txn);
        synced.state.checksum = Self::compute_checksum(&content);
        
        log::debug!("Applied local edit to document {}, version {}", 
            doc_id, synced.state.version);
        
        Ok(())
    }
    
    /// Handle remote edit from peer
    pub async fn handle_remote_edit(&self, doc_id: &DocumentId, from: PeerId, edit: DocumentEdit) -> Result<()> {
        // Decode and apply Yjs update
        let docs = self.documents.read().await;
        let synced = docs.get(doc_id)
            .context("Document not open")?;
        
        // Apply operations
        for op in &edit.operations {
            let mut txn = synced.doc.transact_mut();
            match op {
                EditOperation::Insert { position, text } => {
                    synced.text.insert(&mut txn, *position as u32, text)?;
                }
                EditOperation::Delete { position, length } => {
                    synced.text.remove_range(&mut txn, *position as u32, *length as u32)?;
                }
                EditOperation::Replace { position, length, text } => {
                    synced.text.remove_range(&mut txn, *position as u32, *length as u32)?;
                    synced.text.insert(&mut txn, *position as u32, text)?;
                }
                EditOperation::Batch { operations } => {
                    for inner_op in operations {
                        match inner_op {
                            EditOperation::Insert { position, text } => {
                                synced.text.insert(&mut txn, *position as u32, text)?;
                            }
                            EditOperation::Delete { position, length } => {
                                synced.text.remove_range(&mut txn, *position as u32, *length as u32)?;
                            }
                            EditOperation::Replace { position, length, text } => {
                                synced.text.remove_range(&mut txn, *position as u32, *length as u32)?;
                                synced.text.insert(&mut txn, *position as u32, text)?;
                            }
                            EditOperation::Batch { .. } => {}
                        }
                    }
                }
            }
        }
        
        let _ = self.event_tx.send(SyncEvent::RemoteEdit {
            doc_id: doc_id.clone(),
            from,
            edit,
        });
        
        Ok(())
    }
    
    /// Get document state for sync
    pub async fn get_sync_state(&self, doc_id: &DocumentId) -> Result<DocumentState> {
        let docs = self.documents.read().await;
        let synced = docs.get(doc_id)
            .context("Document not open")?;
        
        Ok(synced.state.clone())
    }
    
    /// Get encoded document state for transmission
    pub async fn get_encoded_state(&self, doc_id: &DocumentId) -> Result<Vec<u8>> {
        let docs = self.documents.read().await;
        let synced = docs.get(doc_id)
            .context("Document not open")?;
        
        let txn = synced.doc.transact();
        let state = txn.encode_state_as_update_v1(&synced.doc.state_vector());
        
        Ok(state)
    }
    
    /// Apply remote state update
    pub async fn apply_remote_state(&self, doc_id: &DocumentId, state: &[u8]) -> Result<()> {
        let docs = self.documents.read().await;
        let synced = docs.get(doc_id)
            .context("Document not open")?;
        
        let update = yrs::updates::Update::decode_v1(state)
            .context("Failed to decode state update")?;
        
        let mut txn = synced.doc.transact_mut();
        txn.apply_update(update);
        
        let _ = self.event_tx.send(SyncEvent::DocumentSynced {
            doc_id: doc_id.clone(),
            version: synced.state.version,
        });
        
        Ok(())
    }
    
    /// Update cursor position
    pub async fn update_cursor(&self, doc_id: &DocumentId, position: CursorPosition) -> Result<()> {
        let mut awareness_state = self.local_awareness.lock().await;
        awareness_state.cursor = Some(position.clone());
        
        let _ = self.event_tx.send(SyncEvent::CursorUpdate {
            doc_id: doc_id.clone(),
            from: self.local_peer_id.clone(),
            position,
        });
        
        Ok(())
    }
    
    /// Update selection
    pub async fn update_selection(&self, doc_id: &DocumentId, selection: Selection) -> Result<()> {
        let mut awareness_state = self.local_awareness.lock().await;
        awareness_state.selection = Some(selection.clone());
        
        let _ = self.event_tx.send(SyncEvent::SelectionUpdate {
            doc_id: doc_id.clone(),
            from: self.local_peer_id.clone(),
            selection,
        });
        
        Ok(())
    }
    
    /// Handle remote cursor update
    pub async fn handle_remote_cursor(&self, doc_id: &DocumentId, from: PeerId, position: CursorPosition) -> Result<()> {
        let _ = self.event_tx.send(SyncEvent::CursorUpdate {
            doc_id: doc_id.clone(),
            from,
            position,
        });
        
        Ok(())
    }
    
    /// Handle remote selection update
    pub async fn handle_remote_selection(&self, doc_id: &DocumentId, from: PeerId, selection: Selection) -> Result<()> {
        let _ = self.event_tx.send(SyncEvent::SelectionUpdate {
            doc_id: doc_id.clone(),
            from,
            selection,
        });
        
        Ok(())
    }
    
    /// Get local awareness
    pub async fn get_local_awareness(&self) -> LocalAwareness {
        self.local_awareness.lock().await.clone()
    }
    
    /// Set display name
    pub async fn set_display_name(&self, name: String) {
        self.local_awareness.lock().await.display_name = name;
    }
    
    /// Subscribe to sync events
    pub fn subscribe(&self) -> broadcast::Receiver<SyncEvent> {
        self.event_tx.subscribe()
    }
    
    /// Get open documents
    pub async fn get_open_documents(&self) -> Vec<DocumentId> {
        self.documents.read().await.keys().cloned().collect()
    }
    
    /// Check if document is open
    pub async fn is_document_open(&self, doc_id: &DocumentId) -> bool {
        self.documents.read().await.contains_key(doc_id)
    }
    
    /// Compute checksum for content
    fn compute_checksum(content: &str) -> String {
        use sha2::{Sha256, Digest};
        let mut hasher = Sha256::new();
        hasher.update(content.as_bytes());
        format!("{:x}", hasher.finalize())
    }
}

/// Edit operation types for CRDT
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum EditOperation {
    Insert {
        position: usize,
        text: String,
    },
    Delete {
        position: usize,
        length: usize,
    },
    Replace {
        position: usize,
        length: usize,
        text: String,
    },
    Batch {
        operations: Vec<EditOperation>,
    },
}

impl EditOperation {
    /// Create an insert operation
    pub fn insert(position: usize, text: impl Into<String>) -> Self {
        Self::Insert {
            position,
            text: text.into(),
        }
    }
    
    /// Create a delete operation
    pub fn delete(position: usize, length: usize) -> Self {
        Self::Delete { position, length }
    }
    
    /// Create a replace operation
    pub fn replace(position: usize, length: usize, text: impl Into<String>) -> Self {
        Self::Replace {
            position,
            length,
            text: text.into(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[tokio::test]
    async fn test_document_sync() {
        let peer_id = PeerId::new();
        let sync = DocumentSynchronizer::new(peer_id, SyncConfig::default());
        
        // Open document
        sync.open_document("test-doc".to_string(), Some("Hello".to_string())).await.unwrap();
        
        // Get content
        let content = sync.get_content(&"test-doc".to_string()).await.unwrap();
        assert_eq!(content, "Hello");
        
        // Apply edit
        sync.apply_local_edit(&"test-doc".to_string(), EditOperation::insert(5, " World")).await.unwrap();
        
        let content = sync.get_content(&"test-doc".to_string()).await.unwrap();
        assert_eq!(content, "Hello World");
    }
    
    #[tokio::test]
    async fn test_awareness() {
        let peer_id = PeerId::new();
        let sync = DocumentSynchronizer::new(peer_id.clone(), SyncConfig::default());
        
        sync.open_document("test".to_string(), None).await.unwrap();
        
        sync.update_cursor(&"test".to_string(), CursorPosition { line: 1, column: 5 }).await.unwrap();
        
        let awareness = sync.get_local_awareness().await;
        assert!(awareness.cursor.is_some());
        assert_eq!(awareness.cursor.unwrap().column, 5);
    }
    
    #[test]
    fn test_edit_operations() {
        let insert = EditOperation::insert(0, "Hello");
        match insert {
            EditOperation::Insert { position, text } => {
                assert_eq!(position, 0);
                assert_eq!(text, "Hello");
            }
            _ => panic!("Wrong operation type"),
        }
    }
}
