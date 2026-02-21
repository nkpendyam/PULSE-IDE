"""
PULSE Context Manager - Short-term and long-term memory management
"""

import json
import hashlib
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional
import logging
import numpy as np

logger = logging.getLogger(__name__)

# FAISS for vector similarity (optional)
try:
    import faiss
    FAISS_AVAILABLE = True
except ImportError:
    FAISS_AVAILABLE = False
    logger.warning("FAISS not available - vector search disabled")


@dataclass
class MemoryEntry:
    """Memory entry"""
    key: str
    value: Any
    memory_type: str
    importance: float = 0.5
    access_count: int = 0
    created_at: datetime = field(default_factory=datetime.utcnow)
    last_accessed: Optional[datetime] = None
    embedding: Optional[np.ndarray] = None
    tags: List[str] = field(default_factory=list)


class ContextManager:
    """
    Context Manager for agent memory
    
    Manages both short-term (working) and long-term memory with
    optional vector embeddings for semantic search.
    """
    
    def __init__(
        self,
        embedding_dim: int = 384,
        max_short_term: int = 100,
        max_long_term: int = 10000,
        storage_path: Optional[Path] = None,
    ):
        self.embedding_dim = embedding_dim
        self.max_short_term = max_short_term
        self.max_long_term = max_long_term
        self.storage_path = storage_path
        
        # Short-term memory (working context)
        self._short_term: Dict[str, MemoryEntry] = {}
        
        # Long-term memory
        self._long_term: Dict[str, MemoryEntry] = {}
        
        # FAISS index for vector search
        self._index: Optional[Any] = None
        self._id_to_key: Dict[int, str] = {}
        
        if FAISS_AVAILABLE:
            self._index = faiss.IndexFlatIP(embedding_dim)
        
        # Working context for current session
        self._working_context: Dict[str, Any] = {
            "session_id": None,
            "current_task": None,
            "file_changes": {},
            "decisions": [],
        }
    
    def _compute_embedding(self, text: str) -> Optional[np.ndarray]:
        """Compute embedding for text (placeholder - would use actual model)"""
        if not FAISS_AVAILABLE:
            return None
        
        # Placeholder: hash-based pseudo-embedding
        # In production, would use sentence-transformers or similar
        hash_bytes = hashlib.sha256(text.encode()).digest()
        embedding = np.frombuffer(hash_bytes[:self.embedding_dim * 4], dtype=np.float32)
        embedding = embedding / np.linalg.norm(embedding)
        return embedding
    
    # Short-term memory operations
    
    def set_working(self, key: str, value: Any):
        """Set a working memory entry"""
        self._short_term[key] = MemoryEntry(
            key=key,
            value=value,
            memory_type="working",
            created_at=datetime.utcnow(),
        )
        
        # Evict old entries if over limit
        if len(self._short_term) > self.max_short_term:
            self._evict_short_term()
    
    def get_working(self, key: str) -> Optional[Any]:
        """Get a working memory entry"""
        entry = self._short_term.get(key)
        if entry:
            entry.access_count += 1
            entry.last_accessed = datetime.utcnow()
            return entry.value
        return None
    
    def _evict_short_term(self):
        """Evict least recently used entries from short-term memory"""
        # Sort by access count and last accessed time
        sorted_entries = sorted(
            self._short_term.items(),
            key=lambda x: (x[1].access_count, x[1].last_accessed or datetime.min),
        )
        
        # Remove oldest 10%
        to_remove = int(len(sorted_entries) * 0.1)
        for key, _ in sorted_entries[:to_remove]:
            del self._short_term[key]
    
    # Long-term memory operations
    
    def store(self, key: str, value: Any, memory_type: str = "fact", importance: float = 0.5):
        """Store a long-term memory entry"""
        value_str = json.dumps(value) if not isinstance(value, str) else value
        
        embedding = self._compute_embedding(value_str)
        
        entry = MemoryEntry(
            key=key,
            value=value,
            memory_type=memory_type,
            importance=importance,
            created_at=datetime.utcnow(),
            embedding=embedding,
        )
        
        self._long_term[key] = entry
        
        # Add to FAISS index
        if self._index is not None and embedding is not None:
            idx = len(self._id_to_key)
            self._index.add(np.array([embedding]))
            self._id_to_key[idx] = key
        
        # Persist if storage path set
        if self.storage_path:
            self._persist_entry(entry)
    
    def retrieve(self, key: str) -> Optional[Any]:
        """Retrieve a long-term memory entry"""
        entry = self._long_term.get(key)
        if entry:
            entry.access_count += 1
            entry.last_accessed = datetime.utcnow()
            return entry.value
        return None
    
    def search(self, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        """Search memory by similarity"""
        if self._index is None:
            # Fallback to keyword search
            return self._keyword_search(query, limit)
        
        query_embedding = self._compute_embedding(query)
        if query_embedding is None:
            return []
        
        # Search FAISS index
        D, I = self._index.search(np.array([query_embedding]), limit)
        
        results = []
        for score, idx in zip(D[0], I[0]):
            if idx in self._id_to_key:
                key = self._id_to_key[idx]
                entry = self._long_term.get(key)
                if entry:
                    results.append({
                        "key": key,
                        "value": entry.value,
                        "score": float(score),
                        "memory_type": entry.memory_type,
                    })
        
        return results
    
    def _keyword_search(self, query: str, limit: int) -> List[Dict[str, Any]]:
        """Fallback keyword search"""
        query_lower = query.lower()
        results = []
        
        for entry in self._long_term.values():
            value_str = json.dumps(entry.value).lower()
            if query_lower in value_str or query_lower in entry.key.lower():
                results.append({
                    "key": entry.key,
                    "value": entry.value,
                    "score": 0.5,  # Default score for keyword match
                    "memory_type": entry.memory_type,
                })
        
        return results[:limit]
    
    # Working context operations
    
    def set_session(self, session_id: str):
        """Set current session"""
        self._working_context["session_id"] = session_id
    
    def set_current_task(self, task: Dict[str, Any]):
        """Set current task"""
        self._working_context["current_task"] = task
    
    def record_file_change(self, path: str, change_type: str, diff: str):
        """Record a file change"""
        self._working_context["file_changes"][path] = {
            "type": change_type,
            "diff": diff,
            "timestamp": datetime.utcnow().isoformat(),
        }
    
    def record_decision(self, decision: str, reason: str):
        """Record a decision"""
        self._working_context["decisions"].append({
            "decision": decision,
            "reason": reason,
            "timestamp": datetime.utcnow().isoformat(),
        })
    
    def get_working_context(self) -> Dict[str, Any]:
        """Get entire working context"""
        return self._working_context.copy()
    
    def clear_working_context(self):
        """Clear working context for new session"""
        self._working_context = {
            "session_id": None,
            "current_task": None,
            "file_changes": {},
            "decisions": [],
        }
    
    # Persistence
    
    def _persist_entry(self, entry: MemoryEntry):
        """Persist entry to storage"""
        if not self.storage_path:
            return
        
        self.storage_path.mkdir(parents=True, exist_ok=True)
        file_path = self.storage_path / f"{entry.key}.json"
        
        data = {
            "key": entry.key,
            "value": entry.value,
            "memory_type": entry.memory_type,
            "importance": entry.importance,
            "access_count": entry.access_count,
            "created_at": entry.created_at.isoformat(),
            "last_accessed": entry.last_accessed.isoformat() if entry.last_accessed else None,
            "tags": entry.tags,
        }
        
        with open(file_path, "w") as f:
            json.dump(data, f, indent=2)
    
    def load_from_storage(self):
        """Load all entries from storage"""
        if not self.storage_path or not self.storage_path.exists():
            return
        
        for file_path in self.storage_path.glob("*.json"):
            with open(file_path) as f:
                data = json.load(f)
            
            entry = MemoryEntry(
                key=data["key"],
                value=data["value"],
                memory_type=data["memory_type"],
                importance=data.get("importance", 0.5),
                access_count=data.get("access_count", 0),
                created_at=datetime.fromisoformat(data["created_at"]),
                last_accessed=datetime.fromisoformat(data["last_accessed"]) if data.get("last_accessed") else None,
                tags=data.get("tags", []),
            )
            
            self._long_term[entry.key] = entry
