//! MCP Resources for KRO_IDE
//!
//! Resource registry for exposing files, buffers, and other content

use super::*;
use anyhow::Result;
use std::collections::HashMap;

/// Resource handler
pub struct Resource {
    pub uri: String,
    pub name: String,
    pub description: Option<String>,
    pub mime_type: Option<String>,
    handler: Box<dyn Fn() -> Pin<Box<dyn Future<Output = Result<ResourceContents>> + Send>> + Send + Sync>,
}

impl Resource {
    /// Create a new resource
    pub fn new<F, Fut>(
        uri: impl Into<String>,
        name: impl Into<String>,
        description: Option<String>,
        mime_type: Option<String>,
        handler: F,
    ) -> Self
    where
        F: Fn() -> Fut + Send + Sync + 'static,
        Fut: Future<Output = Result<ResourceContents>> + Send + 'static,
    {
        Self {
            uri: uri.into(),
            name: name.into(),
            description,
            mime_type,
            handler: Box::new(move || Box::pin(handler())),
        }
    }
    
    /// Read the resource
    pub async fn read(&self) -> Result<ResourceContents> {
        (self.handler)().await
    }
}

/// Resource registry
pub struct ResourceRegistry {
    resources: HashMap<String, Resource>,
    subscriptions: HashMap<String, Vec<String>>, // resource_uri -> subscriber_ids
}

impl ResourceRegistry {
    pub fn new() -> Self {
        Self {
            resources: HashMap::new(),
            subscriptions: HashMap::new(),
        }
    }
    
    /// Register a resource
    pub fn register(&mut self, resource: Resource) {
        self.resources.insert(resource.uri.clone(), resource);
    }
    
    /// Unregister a resource
    pub fn unregister(&mut self, uri: &str) -> Option<Resource> {
        self.subscriptions.remove(uri);
        self.resources.remove(uri)
    }
    
    /// List all resources
    pub fn list(&self) -> Vec<&Resource> {
        self.resources.values().collect()
    }
    
    /// Read a resource
    pub async fn read(&self, uri: &str) -> Result<ResourceContents> {
        let resource = self.resources.get(uri)
            .ok_or_else(|| anyhow::anyhow!("Resource not found: {}", uri))?;
        
        resource.read().await
    }
    
    /// Subscribe to resource updates
    pub fn subscribe(&mut self, uri: &str, subscriber_id: &str) -> Result<()> {
        if !self.resources.contains_key(uri) {
            anyhow::bail!("Resource not found: {}", uri);
        }
        
        self.subscriptions
            .entry(uri.to_string())
            .or_default()
            .push(subscriber_id.to_string());
        
        Ok(())
    }
    
    /// Unsubscribe from resource updates
    pub fn unsubscribe(&mut self, uri: &str, subscriber_id: &str) {
        if let Some(subscribers) = self.subscriptions.get_mut(uri) {
            subscribers.retain(|s| s != subscriber_id);
        }
    }
    
    /// Get subscribers for a resource
    pub fn get_subscribers(&self, uri: &str) -> Vec<&String> {
        self.subscriptions
            .get(uri)
            .map(|s| s.iter().collect())
            .unwrap_or_default()
    }
}

impl Default for ResourceRegistry {
    fn default() -> Self {
        Self::new()
    }
}
