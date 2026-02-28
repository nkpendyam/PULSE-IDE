//! MCP Prompts for KRO_IDE
//!
//! Prompt templates for consistent AI agent behavior

use super::*;
use anyhow::Result;
use std::collections::HashMap;

/// Prompt template
#[derive(Debug, Clone)]
pub struct PromptTemplate {
    pub name: String,
    pub description: String,
    pub arguments: Vec<PromptArgument>,
    template: String,
}

impl PromptTemplate {
    /// Create a new prompt template
    pub fn new(
        name: impl Into<String>,
        description: impl Into<String>,
        arguments: Vec<PromptArgument>,
        template: impl Into<String>,
    ) -> Self {
        Self {
            name: name.into(),
            description: description.into(),
            arguments,
            template: template.into(),
        }
    }
    
    /// Render the prompt with arguments
    pub fn render(&self, args: &HashMap<String, String>) -> anyhow::Result<GetPromptResult> {
        let mut rendered = self.template.clone();
        
        // Simple template substitution
        for (key, value) in args {
            // Replace {{key}}
            rendered = rendered.replace(&format!("{{{{{}}}}}", key), value);
            
            // Replace {{#if key}}...{{/if}}
            let if_pattern = regex::Regex::new(&format!(
                r"\{{{{#if {}\}}}}(.*?)\{{{{/if\}}}}", 
                regex::escape(key)
            ))?;
            
            if value.is_empty() {
                rendered = if_pattern.replace_all(&rendered, "").to_string();
            } else {
                rendered = if_pattern.replace_all(&rendered, "$1").to_string();
            }
        }
        
        // Check for missing required arguments
        for arg in &self.arguments {
            if arg.required && !args.contains_key(&arg.name) {
                anyhow::bail!("Missing required argument: {}", arg.name);
            }
        }
        
        Ok(GetPromptResult {
            description: Some(self.description.clone()),
            messages: vec![PromptMessage {
                role: Role::User,
                content: ContentBlock::Text { text: rendered },
            }],
        })
    }
}

/// Prompt registry
pub struct PromptRegistry {
    prompts: HashMap<String, PromptTemplate>,
}

impl PromptRegistry {
    pub fn new() -> Self {
        Self {
            prompts: HashMap::new(),
        }
    }
    
    /// Register a prompt
    pub fn register(&mut self, prompt: PromptTemplate) {
        self.prompts.insert(prompt.name.clone(), prompt);
    }
    
    /// Unregister a prompt
    pub fn unregister(&mut self, name: &str) -> Option<PromptTemplate> {
        self.prompts.remove(name)
    }
    
    /// List all prompts
    pub fn list(&self) -> Vec<&PromptTemplate> {
        self.prompts.values().collect()
    }
    
    /// Get a prompt by name
    pub fn get(&self, name: &str) -> Option<&PromptTemplate> {
        self.prompts.get(name)
    }
    
    /// Render a prompt with arguments
    pub fn get_rendered(
        &self, 
        name: &str, 
        args: HashMap<String, String>
    ) -> anyhow::Result<GetPromptResult> {
        let prompt = self.prompts.get(name)
            .ok_or_else(|| anyhow::anyhow!("Prompt not found: {}", name))?;
        
        prompt.render(&args)
    }
    
    /// Alias for get_rendered for backwards compatibility
    pub fn get(&self, name: &str, args: HashMap<String, String>) -> anyhow::Result<GetPromptResult> {
        self.get_rendered(name, args)
    }
}

impl Default for PromptRegistry {
    fn default() -> Self {
        Self::new()
    }
}

/// Built-in prompt templates
pub fn builtin_prompts() -> Vec<PromptTemplate> {
    vec![
        // Code generation prompts
        PromptTemplate::new(
            "generate_function",
            "Generate a function from a description",
            vec![
                PromptArgument {
                    name: "description".to_string(),
                    description: Some("What the function should do".to_string()),
                    required: true,
                },
                PromptArgument {
                    name: "language".to_string(),
                    description: Some("Programming language".to_string()),
                    required: true,
                },
                PromptArgument {
                    name: "name".to_string(),
                    description: Some("Function name".to_string()),
                    required: false,
                },
            ],
            r#"Generate a {{language}} function that: {{description}}

{{#if name}}The function should be named '{{name}}'.{{/if}}

Include:
- Proper type annotations
- Error handling
- Documentation comments
- Example usage"#,
        ),
        
        // Code review prompts
        PromptTemplate::new(
            "security_review",
            "Perform a security-focused code review",
            vec![
                PromptArgument {
                    name: "code".to_string(),
                    description: Some("Code to review".to_string()),
                    required: true,
                },
                PromptArgument {
                    name: "language".to_string(),
                    description: Some("Programming language".to_string()),
                    required: true,
                },
            ],
            r#"Perform a comprehensive security review of this {{language}} code:

```
{{code}}
```

Check for:
1. **Injection vulnerabilities** (SQL, command, XSS, etc.)
2. **Authentication/Authorization issues**
3. **Data validation** problems
4. **Cryptographic weaknesses**
5. **Information disclosure**
6. **Race conditions**

Rate each finding as Critical/High/Medium/Low and provide fixes."#,
        ),
        
        // Refactoring prompts
        PromptTemplate::new(
            "refactor_clean",
            "Refactor code for cleanliness and maintainability",
            vec![
                PromptArgument {
                    name: "code".to_string(),
                    description: Some("Code to refactor".to_string()),
                    required: true,
                },
            ],
            r#"Refactor this code for better cleanliness and maintainability:

```
{{code}}
```

Apply these principles:
- Single Responsibility Principle
- DRY (Don't Repeat Yourself)
- Meaningful naming
- Small, focused functions
- Clear control flow

Show the refactored code with explanations of changes."#,
        ),
        
        // Test generation prompts
        PromptTemplate::new(
            "generate_unit_tests",
            "Generate comprehensive unit tests",
            vec![
                PromptArgument {
                    name: "code".to_string(),
                    description: Some("Code to test".to_string()),
                    required: true,
                },
                PromptArgument {
                    name: "framework".to_string(),
                    description: Some("Test framework to use".to_string()),
                    required: true,
                },
            ],
            r#"Generate comprehensive unit tests using {{framework}} for:

```
{{code}}
```

Include tests for:
- Happy path scenarios
- Edge cases
- Error conditions
- Boundary values
- Invalid inputs

Use descriptive test names and include assertions with meaningful error messages."#,
        ),
        
        // Documentation prompts
        PromptTemplate::new(
            "document_api",
            "Generate API documentation",
            vec![
                PromptArgument {
                    name: "code".to_string(),
                    description: Some("API code to document".to_string()),
                    required: true,
                },
                PromptArgument {
                    name: "format".to_string(),
                    description: Some("Documentation format (markdown, openapi, etc.)".to_string()),
                    required: false,
                },
            ],
            r#"Generate API documentation for:

```
{{code}}
```

{{#if format}}Format: {{format}}{{/if}}

Include:
- Endpoint descriptions
- Request/response schemas
- Authentication requirements
- Error responses
- Usage examples
- Rate limiting info (if applicable)"#,
        ),
    ]
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_prompt_render() {
        let prompt = PromptTemplate::new(
            "test",
            "A test prompt",
            vec![PromptArgument {
                name: "name".to_string(),
                description: None,
                required: true,
            }],
            "Hello, {{name}}!",
        );
        
        let mut args = HashMap::new();
        args.insert("name".to_string(), "World".to_string());
        
        let result = prompt.render(&args).unwrap();
        assert_eq!(result.messages[0].content, ContentBlock::Text { text: "Hello, World!".to_string() });
    }
    
    #[test]
    fn test_missing_required_arg() {
        let prompt = PromptTemplate::new(
            "test",
            "A test prompt",
            vec![PromptArgument {
                name: "required".to_string(),
                description: None,
                required: true,
            }],
            "Value: {{required}}",
        );
        
        let args = HashMap::new();
        let result = prompt.render(&args);
        assert!(result.is_err());
    }
}
