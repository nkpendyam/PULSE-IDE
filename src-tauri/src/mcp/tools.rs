//! MCP Tools for KRO_IDE
//!
//! Tool registry and execution for MCP

use anyhow::Result;
use std::collections::HashMap;
use std::future::Future;
use std::pin::Pin;

/// Tool function type
pub type ToolFn = Box<dyn Fn(HashMap<String, serde_json::Value>) -> Pin<Box<dyn Future<Output = Result<serde_json::Value>> + Send>> + Send + Sync>;

/// Tool definition with handler
pub struct Tool {
    pub name: String,
    pub description: String,
    pub input_schema: serde_json::Value,
    handler: ToolFn,
}

impl Tool {
    /// Create a new tool
    pub fn new<F, Fut>(
        name: impl Into<String>,
        description: impl Into<String>,
        input_schema: serde_json::Value,
        handler: F,
    ) -> Self
    where
        F: Fn(HashMap<String, serde_json::Value>) -> Fut + Send + Sync + 'static,
        Fut: Future<Output = Result<serde_json::Value>> + Send + 'static,
    {
        Self {
            name: name.into(),
            description: description.into(),
            input_schema,
            handler: Box::new(move |args| Box::pin(handler(args))),
        }
    }
    
    /// Execute the tool
    pub async fn execute(&self, arguments: HashMap<String, serde_json::Value>) -> Result<serde_json::Value> {
        (self.handler)(arguments).await
    }
}

/// Tool registry
pub struct ToolRegistry {
    tools: HashMap<String, Tool>,
}

impl ToolRegistry {
    pub fn new() -> Self {
        Self {
            tools: HashMap::new(),
        }
    }
    
    /// Register a tool
    pub fn register(&mut self, tool: Tool) {
        self.tools.insert(tool.name.clone(), tool);
    }
    
    /// Unregister a tool
    pub fn unregister(&mut self, name: &str) -> Option<Tool> {
        self.tools.remove(name)
    }
    
    /// List all tools
    pub fn list(&self) -> Vec<&Tool> {
        self.tools.values().collect()
    }
    
    /// Get a tool by name
    pub fn get(&self, name: &str) -> Option<&Tool> {
        self.tools.get(name)
    }
    
    /// Call a tool
    pub async fn call(
        &self, 
        name: &str, 
        arguments: HashMap<String, serde_json::Value>
    ) -> Result<serde_json::Value> {
        let tool = self.tools.get(name)
            .ok_or_else(|| anyhow::anyhow!("Tool not found: {}", name))?;
        
        // Validate arguments against schema
        self.validate_arguments(&tool.input_schema, &arguments)?;
        
        // Execute tool
        tool.execute(arguments).await
    }
    
    /// Validate arguments against JSON schema
    fn validate_arguments(
        &self, 
        schema: &serde_json::Value, 
        args: &HashMap<String, serde_json::Value>
    ) -> Result<()> {
        let required = schema.get("required")
            .and_then(|r| r.as_array())
            .map(|arr| arr.iter().filter_map(|v| v.as_str()).collect::<Vec<_>>())
            .unwrap_or_default();
        
        for req in required {
            if !args.contains_key(req) {
                anyhow::bail!("Missing required argument: {}", req);
            }
        }
        
        Ok(())
    }
    
    /// Check if a tool exists
    pub fn contains(&self, name: &str) -> bool {
        self.tools.contains_key(name)
    }
    
    /// Get tool count
    pub fn len(&self) -> usize {
        self.tools.len()
    }
    
    /// Check if registry is empty
    pub fn is_empty(&self) -> bool {
        self.tools.is_empty()
    }
}

/// Tool result wrapper
#[derive(Debug, Clone)]
pub struct ToolResult {
    pub success: bool,
    pub data: serde_json::Value,
    pub error: Option<String>,
}

impl ToolResult {
    pub fn ok(data: serde_json::Value) -> Self {
        Self {
            success: true,
            data,
            error: None,
        }
    }
    
    pub fn err(error: impl Into<String>) -> Self {
        Self {
            success: false,
            data: serde_json::json!(null),
            error: Some(error.into()),
        }
    }
}

impl Default for ToolRegistry {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[tokio::test]
    async fn test_tool_registry() {
        let mut registry = ToolRegistry::new();
        
        let tool = Tool::new(
            "test_tool",
            "A test tool",
            serde_json::json!({
                "type": "object",
                "properties": {
                    "input": { "type": "string" }
                },
                "required": ["input"]
            }),
            |args| async move {
                let input = args.get("input").and_then(|v| v.as_str()).unwrap_or("");
                Ok(serde_json::json!({ "output": input.to_uppercase() }))
            },
        );
        
        registry.register(tool);
        
        let mut args = HashMap::new();
        args.insert("input".to_string(), serde_json::json!("hello"));
        
        let result = registry.call("test_tool", args).await;
        assert!(result.is_ok());
        
        let response = result.unwrap();
        assert_eq!(response["output"], "HELLO");
    }
}
