//! Postfix Completion
//!
//! Postfix code completion like IntelliJ IDEA
//! Based on: https://github.com/xylo/intellij-postfix-templates

use std::collections::HashMap;
use serde::{Deserialize, Serialize};

/// Postfix template
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PostfixTemplate {
    pub name: String,
    pub key: String,
    pub description: String,
    pub language: String,
    pub applies_to: Vec<String>,
    pub template: String,
}

/// Postfix completion engine
pub struct PostfixCompletion {
    templates: HashMap<String, Vec<PostfixTemplate>>,
}

impl PostfixCompletion {
    pub fn new() -> Self {
        let mut engine = Self {
            templates: HashMap::new(),
        };
        
        engine.load_default_templates();
        engine
    }
    
    fn load_default_templates(&mut self) {
        // Rust templates
        self.add_templates("rust", vec![
            PostfixTemplate {
                name: "if".to_string(),
                key: "if".to_string(),
                description: "if statement".to_string(),
                language: "rust".to_string(),
                applies_to: vec!["expression", "identifier", "call_expression"].into_iter().map(String::from).collect(),
                template: "if ${expr} {\n    ${cursor}\n}".to_string(),
            },
            PostfixTemplate {
                name: "ifnot".to_string(),
                key: "ifnot".to_string(),
                description: "if not statement".to_string(),
                language: "rust".to_string(),
                applies_to: vec!["expression", "identifier"].into_iter().map(String::from).collect(),
                template: "if !${expr} {\n    ${cursor}\n}".to_string(),
            },
            PostfixTemplate {
                name: "match".to_string(),
                key: "match".to_string(),
                description: "match expression".to_string(),
                language: "rust".to_string(),
                applies_to: vec!["expression", "identifier"].into_iter().map(String::from).collect(),
                template: "match ${expr} {\n    ${cursor}\n}".to_string(),
            },
            PostfixTemplate {
                name: "while".to_string(),
                key: "while".to_string(),
                description: "while loop".to_string(),
                language: "rust".to_string(),
                applies_to: vec!["expression", "identifier"].into_iter().map(String::from).collect(),
                template: "while ${expr} {\n    ${cursor}\n}".to_string(),
            },
            PostfixTemplate {
                name: "loop".to_string(),
                key: "loop".to_string(),
                description: "infinite loop".to_string(),
                language: "rust".to_string(),
                applies_to: vec!["expression"].into_iter().map(String::from).collect(),
                template: "loop {\n    ${expr}\n}".to_string(),
            },
            PostfixTemplate {
                name: "for".to_string(),
                key: "for".to_string(),
                description: "for loop".to_string(),
                language: "rust".to_string(),
                applies_to: vec!["expression"].into_iter().map(String::from).collect(),
                template: "for ${item} in ${expr} {\n    ${cursor}\n}".to_string(),
            },
            PostfixTemplate {
                name: "println".to_string(),
                key: "println".to_string(),
                description: "println! macro".to_string(),
                language: "rust".to_string(),
                applies_to: vec!["expression", "identifier"].into_iter().map(String::from).collect(),
                template: "println!(\"${expr} = {:?}\", ${expr});".to_string(),
            },
            PostfixTemplate {
                name: "dbg".to_string(),
                key: "dbg".to_string(),
                description: "dbg! macro".to_string(),
                language: "rust".to_string(),
                applies_to: vec!["expression", "identifier"].into_iter().map(String::from).collect(),
                template: "dbg!(${expr});".to_string(),
            },
            PostfixTemplate {
                name: "unwrap".to_string(),
                key: "unwrap".to_string(),
                description: "unwrap() call".to_string(),
                language: "rust".to_string(),
                applies_to: vec!["expression", "identifier"].into_iter().map(String::from).collect(),
                template: "${expr}.unwrap()".to_string(),
            },
            PostfixTemplate {
                name: "expect".to_string(),
                key: "expect".to_string(),
                description: "expect() call".to_string(),
                language: "rust".to_string(),
                applies_to: vec!["expression", "identifier"].into_iter().map(String::from).collect(),
                template: "${expr}.expect(\"${message}\")".to_string(),
            },
            PostfixTemplate {
                name: "ok".to_string(),
                key: "ok".to_string(),
                description: "Ok wrapper".to_string(),
                language: "rust".to_string(),
                applies_to: vec!["expression"].into_iter().map(String::from).collect(),
                template: "Ok(${expr})".to_string(),
            },
            PostfixTemplate {
                name: "err".to_string(),
                key: "err".to_string(),
                description: "Err wrapper".to_string(),
                language: "rust".to_string(),
                applies_to: vec!["expression"].into_iter().map(String::from).collect(),
                template: "Err(${expr})".to_string(),
            },
            PostfixTemplate {
                name: "some".to_string(),
                key: "some".to_string(),
                description: "Some wrapper".to_string(),
                language: "rust".to_string(),
                applies_to: vec!["expression"].into_iter().map(String::from).collect(),
                template: "Some(${expr})".to_string(),
            },
            PostfixTemplate {
                name: "box".to_string(),
                key: "box".to_string(),
                description: "Box::new wrapper".to_string(),
                language: "rust".to_string(),
                applies_to: vec!["expression"].into_iter().map(String::from).collect(),
                template: "Box::new(${expr})".to_string(),
            },
            PostfixTemplate {
                name: "vec".to_string(),
                key: "vec".to_string(),
                description: "vec! macro".to_string(),
                language: "rust".to_string(),
                applies_to: vec!["expression"].into_iter().map(String::from).collect(),
                template: "vec![${expr}]".to_string(),
            },
            PostfixTemplate {
                name: "not".to_string(),
                key: "not".to_string(),
                description: "negation".to_string(),
                language: "rust".to_string(),
                applies_to: vec!["expression", "identifier"].into_iter().map(String::from).collect(),
                template: "!${expr}".to_string(),
            },
            PostfixTemplate {
                name: "ref".to_string(),
                key: "ref".to_string(),
                description: "reference".to_string(),
                language: "rust".to_string(),
                applies_to: vec!["expression", "identifier"].into_iter().map(String::from).collect(),
                template: "&${expr}".to_string(),
            },
            PostfixTemplate {
                name: "mut".to_string(),
                key: "mut".to_string(),
                description: "mutable reference".to_string(),
                language: "rust".to_string(),
                applies_to: vec!["expression", "identifier"].into_iter().map(String::from).collect(),
                template: "&mut ${expr}".to_string(),
            },
        ]);
        
        // TypeScript/JavaScript templates
        self.add_templates("typescript", vec![
            PostfixTemplate {
                name: "if".to_string(),
                key: "if".to_string(),
                description: "if statement".to_string(),
                language: "typescript".to_string(),
                applies_to: vec!["expression", "identifier"].into_iter().map(String::from).collect(),
                template: "if (${expr}) {\n    ${cursor}\n}".to_string(),
            },
            PostfixTemplate {
                name: "ifnot".to_string(),
                key: "ifnot".to_string(),
                description: "if not statement".to_string(),
                language: "typescript".to_string(),
                applies_to: vec!["expression", "identifier"].into_iter().map(String::from).collect(),
                template: "if (!${expr}) {\n    ${cursor}\n}".to_string(),
            },
            PostfixTemplate {
                name: "else".to_string(),
                key: "else".to_string(),
                description: "if-else statement".to_string(),
                language: "typescript".to_string(),
                applies_to: vec!["expression"].into_iter().map(String::from).collect(),
                template: "if (${expr}) {\n    ${cursor}\n} else {\n\n}".to_string(),
            },
            PostfixTemplate {
                name: "log".to_string(),
                key: "log".to_string(),
                description: "console.log".to_string(),
                language: "typescript".to_string(),
                applies_to: vec!["expression", "identifier"].into_iter().map(String::from).collect(),
                template: "console.log('${expr}', ${expr});".to_string(),
            },
            PostfixTemplate {
                name: "return".to_string(),
                key: "return".to_string(),
                description: "return statement".to_string(),
                language: "typescript".to_string(),
                applies_to: vec!["expression"].into_iter().map(String::from).collect(),
                template: "return ${expr};".to_string(),
            },
            PostfixTemplate {
                name: "await".to_string(),
                key: "await".to_string(),
                description: "await expression".to_string(),
                language: "typescript".to_string(),
                applies_to: vec!["expression", "call_expression"].into_iter().map(String::from).collect(),
                template: "await ${expr}".to_string(),
            },
            PostfixTemplate {
                name: "async".to_string(),
                key: "async".to_string(),
                description: "async arrow function".to_string(),
                language: "typescript".to_string(),
                applies_to: vec!["expression"].into_iter().map(String::from).collect(),
                template: "async () => ${expr}".to_string(),
            },
            PostfixTemplate {
                name: "arrow".to_string(),
                key: "arrow".to_string(),
                description: "arrow function".to_string(),
                language: "typescript".to_string(),
                applies_to: vec!["expression"].into_iter().map(String::from).collect(),
                template: "() => ${expr}".to_string(),
            },
            PostfixTemplate {
                name: "not".to_string(),
                key: "not".to_string(),
                description: "negation".to_string(),
                language: "typescript".to_string(),
                applies_to: vec!["expression", "identifier"].into_iter().map(String::from).collect(),
                template: "!${expr}".to_string(),
            },
            PostfixTemplate {
                name: "null".to_string(),
                key: "null".to_string(),
                description: "null check".to_string(),
                language: "typescript".to_string(),
                applies_to: vec!["expression", "identifier"].into_iter().map(String::from).collect(),
                template: "${expr} === null".to_string(),
            },
            PostfixTemplate {
                name: "undefined".to_string(),
                key: "undefined".to_string(),
                description: "undefined check".to_string(),
                language: "typescript".to_string(),
                applies_to: vec!["expression", "identifier"].into_iter().map(String::from).collect(),
                template: "${expr} === undefined".to_string(),
            },
            PostfixTemplate {
                name: "json".to_string(),
                key: "json".to_string(),
                description: "JSON.stringify".to_string(),
                language: "typescript".to_string(),
                applies_to: vec!["expression"].into_iter().map(String::from).collect(),
                template: "JSON.stringify(${expr}, null, 2)".to_string(),
            },
            PostfixTemplate {
                name: "map".to_string(),
                key: "map".to_string(),
                description: "map callback".to_string(),
                language: "typescript".to_string(),
                applies_to: vec!["identifier"].into_iter().map(String::from).collect(),
                template: "${expr}.map((item) => ${cursor})".to_string(),
            },
            PostfixTemplate {
                name: "filter".to_string(),
                key: "filter".to_string(),
                description: "filter callback".to_string(),
                language: "typescript".to_string(),
                applies_to: vec!["identifier"].into_iter().map(String::from).collect(),
                template: "${expr}.filter((item) => ${cursor})".to_string(),
            },
        ]);
        
        // Python templates
        self.add_templates("python", vec![
            PostfixTemplate {
                name: "if".to_string(),
                key: "if".to_string(),
                description: "if statement".to_string(),
                language: "python".to_string(),
                applies_to: vec!["expression", "identifier"].into_iter().map(String::from).collect(),
                template: "if ${expr}:\n    ${cursor}".to_string(),
            },
            PostfixTemplate {
                name: "ifnot".to_string(),
                key: "ifnot".to_string(),
                description: "if not statement".to_string(),
                language: "python".to_string(),
                applies_to: vec!["expression", "identifier"].into_iter().map(String::from).collect(),
                template: "if not ${expr}:\n    ${cursor}".to_string(),
            },
            PostfixTemplate {
                name: "while".to_string(),
                key: "while".to_string(),
                description: "while loop".to_string(),
                language: "python".to_string(),
                applies_to: vec!["expression"].into_iter().map(String::from).collect(),
                template: "while ${expr}:\n    ${cursor}".to_string(),
            },
            PostfixTemplate {
                name: "for".to_string(),
                key: "for".to_string(),
                description: "for loop".to_string(),
                language: "python".to_string(),
                applies_to: vec!["identifier"].into_iter().map(String::from).collect(),
                template: "for ${item} in ${expr}:\n    ${cursor}".to_string(),
            },
            PostfixTemplate {
                name: "print".to_string(),
                key: "print".to_string(),
                description: "print statement".to_string(),
                language: "python".to_string(),
                applies_to: vec!["expression"].into_iter().map(String::from).collect(),
                template: "print(f\"${expr} = {${expr}}\")".to_string(),
            },
            PostfixTemplate {
                name: "not".to_string(),
                key: "not".to_string(),
                description: "negation".to_string(),
                language: "python".to_string(),
                applies_to: vec!["expression", "identifier"].into_iter().map(String::from).collect(),
                template: "not ${expr}".to_string(),
            },
            PostfixTemplate {
                name: "len".to_string(),
                key: "len".to_string(),
                description: "len() call".to_string(),
                language: "python".to_string(),
                applies_to: vec!["expression", "identifier"].into_iter().map(String::from).collect(),
                template: "len(${expr})".to_string(),
            },
            PostfixTemplate {
                name: "str".to_string(),
                key: "str".to_string(),
                description: "str() call".to_string(),
                language: "python".to_string(),
                applies_to: vec!["expression"].into_iter().map(String::from).collect(),
                template: "str(${expr})".to_string(),
            },
        ]);
    }
    
    fn add_templates(&mut self, language: &str, templates: Vec<PostfixTemplate>) {
        self.templates.insert(language.to_string(), templates);
    }
    
    /// Get completions for a postfix trigger
    pub fn get_completions(&self, language: &str, expr: &str, trigger: &str) -> Vec<PostfixCompletionItem> {
        let templates = self.templates.get(language).cloned().unwrap_or_default();
        
        templates.iter()
            .filter(|t| t.key.starts_with(trigger))
            .map(|t| PostfixCompletionItem {
                template: t.clone(),
                replacement: self.apply_template(&t.template, expr),
            })
            .collect()
    }
    
    /// Apply template with expression
    fn apply_template(&self, template: &str, expr: &str) -> String {
        template
            .replace("${expr}", expr)
            .replace("${cursor}", "|") // Cursor marker
    }
    
    /// Check if input looks like a postfix completion trigger
    pub fn is_postfix_trigger(&self, text: &str) -> bool {
        text.starts_with('.')
    }
    
    /// Parse postfix input (e.g., "foo.if" -> ("foo", "if"))
    pub fn parse_postfix_input(&self, text: &str) -> Option<(String, String)> {
        let text = text.trim_start_matches('.');
        let parts: Vec<&str> = text.rsplitn(2, '.').collect();
        
        if parts.len() == 2 {
            Some((parts[1].to_string(), parts[0].to_string()))
        } else {
            None
        }
    }
}

impl Default for PostfixCompletion {
    fn default() -> Self {
        Self::new()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PostfixCompletionItem {
    pub template: PostfixTemplate,
    pub replacement: String,
}
