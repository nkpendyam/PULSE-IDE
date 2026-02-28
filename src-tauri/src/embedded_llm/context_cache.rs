//! Context Cache for KRO_IDE
//!
//! LRU cache for inference results to avoid redundant computation

use std::collections::HashMap;
use std::time::SystemTime;

/// Cached inference context
#[derive(Debug, Clone)]
pub struct CachedContext {
    pub response: String,
    pub tokens: u32,
    pub model: String,
    pub timestamp: SystemTime,
}

/// LRU Cache for inference results
pub struct ContextCache {
    cache: HashMap<String, CachedContext>,
    lru_order: Vec<String>,
    max_entries: usize,
    hits: u64,
    misses: u64,
}

impl ContextCache {
    pub fn new(max_entries: usize) -> Self {
        Self {
            cache: HashMap::new(),
            lru_order: Vec::new(),
            max_entries,
            hits: 0,
            misses: 0,
        }
    }
    
    /// Get cached result
    pub fn get(&mut self, key: &str) -> Option<CachedContext> {
        if let Some(cached) = self.cache.get(key) {
            // Check if still fresh (5 minute TTL)
            if let Ok(elapsed) = cached.timestamp.elapsed() {
                if elapsed.as_secs() < 300 {
                    self.hits += 1;
                    self.touch(key);
                    return Some(cached.clone());
                }
            }
        }
        self.misses += 1;
        None
    }
    
    /// Insert into cache
    pub fn insert(&mut self, key: String, context: CachedContext) {
        // Remove oldest if at capacity
        if self.cache.len() >= self.max_entries {
            if let Some(oldest) = self.lru_order.first().cloned() {
                self.cache.remove(&oldest);
                self.lru_order.remove(0);
            }
        }
        
        // Remove old key if exists
        if self.cache.contains_key(&key) {
            self.lru_order.retain(|k| k != &key);
        }
        
        self.cache.insert(key.clone(), context);
        self.lru_order.push(key);
    }
    
    /// Touch an entry (move to end of LRU)
    fn touch(&mut self, key: &str) {
        self.lru_order.retain(|k| k != key);
        self.lru_order.push(key.to_string());
    }
    
    /// Clear cache
    pub fn clear(&mut self) {
        self.cache.clear();
        self.lru_order.clear();
    }
    
    /// Get cache statistics
    pub fn stats(&self) -> CacheStats {
        CacheStats {
            entries: self.cache.len(),
            max_entries: self.max_entries,
            hits: self.hits,
            misses: self.misses,
            hit_rate: if self.hits + self.misses > 0 {
                self.hits as f64 / (self.hits + self.misses) as f64
            } else {
                0.0
            },
        }
    }
    
    /// Get total cached size
    pub fn total_size(&self) -> usize {
        self.cache.values()
            .map(|c| c.response.len())
            .sum()
    }
}

/// Cache statistics
#[derive(Debug, Clone)]
pub struct CacheStats {
    pub entries: usize,
    pub max_entries: usize,
    pub hits: u64,
    pub misses: u64,
    pub hit_rate: f64,
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_cache_insert_get() {
        let mut cache = ContextCache::new(10);
        
        cache.insert("key1".to_string(), CachedContext {
            response: "test response".to_string(),
            tokens: 5,
            model: "test".to_string(),
            timestamp: SystemTime::now(),
        });
        
        let cached = cache.get("key1");
        assert!(cached.is_some());
        assert_eq!(cached.unwrap().response, "test response");
    }
    
    #[test]
    fn test_cache_lru_eviction() {
        let mut cache = ContextCache::new(2);
        
        cache.insert("key1".to_string(), CachedContext {
            response: "r1".to_string(),
            tokens: 1,
            model: "test".to_string(),
            timestamp: SystemTime::now(),
        });
        
        cache.insert("key2".to_string(), CachedContext {
            response: "r2".to_string(),
            tokens: 2,
            model: "test".to_string(),
            timestamp: SystemTime::now(),
        });
        
        cache.insert("key3".to_string(), CachedContext {
            response: "r3".to_string(),
            tokens: 3,
            model: "test".to_string(),
            timestamp: SystemTime::now(),
        });
        
        // key1 should be evicted
        assert!(cache.get("key1").is_none());
        assert!(cache.get("key2").is_some());
        assert!(cache.get("key3").is_some());
    }
}
