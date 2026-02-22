//! Property-based test generator
//!
//! Generates proptest/hypothesis tests from function signatures

use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Property-based test generator
pub struct PropertyGenerator {
    strategies: HashMap<String, Strategy>,
    generated_tests: Vec<GeneratedTest>,
}

/// Test strategy for a type
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Strategy {
    pub type_name: String,
    pub strategy_code: String,
    pub examples: Vec<String>,
}

/// Generated property test
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeneratedTest {
    pub function_name: String,
    pub test_code: String,
    pub properties: Vec<Property>,
    pub language: String,
}

/// A property to test
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Property {
    pub name: String,
    pub description: String,
    pub expression: String,
}

impl PropertyGenerator {
    /// Create a new property generator
    pub fn new() -> Self {
        let mut generator = Self {
            strategies: HashMap::new(),
            generated_tests: Vec::new(),
        };
        
        generator.load_default_strategies();
        generator
    }

    /// Load default strategies for common types
    fn load_default_strategies(&mut self) {
        // Rust strategies
        self.strategies.insert("i32".to_string(), Strategy {
            type_name: "i32".to_string(),
            strategy_code: "any::<i32>()".to_string(),
            examples: vec!["0".to_string(), "-1".to_string(), "i32::MAX".to_string(), "i32::MIN".to_string()],
        });

        self.strategies.insert("u32".to_string(), Strategy {
            type_name: "u32".to_string(),
            strategy_code: "any::<u32>()".to_string(),
            examples: vec!["0".to_string(), "u32::MAX".to_string()],
        });

        self.strategies.insert("bool".to_string(), Strategy {
            type_name: "bool".to_string(),
            strategy_code: "any::<bool>()".to_string(),
            examples: vec!["true".to_string(), "false".to_string()],
        });

        self.strategies.insert("String".to_string(), Strategy {
            type_name: "String".to_string(),
            strategy_code: "\".*\"".to_string(),
            examples: vec!["\"\"".to_string(), "\"hello\"".to_string()],
        });

        self.strategies.insert("Vec<T>".to_string(), Strategy {
            type_name: "Vec<T>".to_string(),
            strategy_code: "proptest::collection::vec(any::<T>(), 0..100)".to_string(),
            examples: vec!["vec![]".to_string(), "vec![T::default()]".to_string()],
        });
    }

    /// Generate property tests for a function
    pub async fn generate(&mut self, code: &str, function_name: &str, language: &str) -> Result<String> {
        // Parse function signature
        let signature = self.parse_signature(code, function_name)?;

        // Generate common properties
        let properties = self.infer_properties(&signature)?;

        // Generate test code based on language
        let test_code = match language {
            "rust" => self.generate_rust_test(&signature, &properties)?,
            "python" => self.generate_python_test(&signature, &properties)?,
            "typescript" => self.generate_typescript_test(&signature, &properties)?,
            _ => self.generate_generic_test(&signature, &properties)?,
        };

        self.generated_tests.push(GeneratedTest {
            function_name: function_name.to_string(),
            test_code: test_code.clone(),
            properties,
            language: language.to_string(),
        });

        Ok(test_code)
    }

    /// Parse function signature from code
    fn parse_signature(&self, code: &str, function_name: &str) -> Result<FunctionSignature> {
        // Find function definition
        for line in code.lines() {
            if line.contains("fn ") && line.contains(function_name) {
                return self.parse_rust_signature(line);
            }
            if line.contains("def ") && line.contains(function_name) {
                return self.parse_python_signature(line);
            }
            if line.contains("function ") && line.contains(function_name) {
                return self.parse_typescript_signature(line);
            }
        }

        Ok(FunctionSignature::default())
    }

    /// Parse Rust function signature
    fn parse_rust_signature(&self, line: &str) -> Result<FunctionSignature> {
        // Simplified parsing - in production would use proper parser
        let params_start = line.find('(').unwrap_or(0);
        let params_end = line.rfind(')').unwrap_or(line.len());
        
        let params_str = &line[params_start + 1..params_end];
        let params: Vec<Parameter> = params_str
            .split(',')
            .filter_map(|p| {
                let parts: Vec<&str> = p.trim().split(':').collect();
                if parts.len() == 2 {
                    Some(Parameter {
                        name: parts[0].trim().to_string(),
                        type_name: parts[1].trim().to_string(),
                    })
                } else {
                    None
                }
            })
            .collect();

        let return_type = if line.contains("->") {
            line.split("->")
                .nth(1)
                .map(|s| s.split('{').next().unwrap_or("").trim().to_string())
        } else {
            None
        };

        Ok(FunctionSignature {
            name: String::new(),
            params,
            return_type,
        })
    }

    /// Parse Python function signature
    fn parse_python_signature(&self, line: &str) -> Result<FunctionSignature> {
        let params_start = line.find('(').unwrap_or(0);
        let params_end = line.find(')').unwrap_or(line.len());
        
        let params_str = &line[params_start + 1..params_end];
        let params: Vec<Parameter> = params_str
            .split(',')
            .filter_map(|p| {
                let trimmed = p.trim();
                if !trimmed.is_empty() {
                    Some(Parameter {
                        name: trimmed.to_string(),
                        type_name: "Any".to_string(),
                    })
                } else {
                    None
                }
            })
            .collect();

        Ok(FunctionSignature {
            name: String::new(),
            params,
            return_type: None,
        })
    }

    /// Parse TypeScript function signature
    fn parse_typescript_signature(&self, line: &str) -> Result<FunctionSignature> {
        self.parse_rust_signature(line) // Similar syntax
    }

    /// Infer properties from signature
    fn infer_properties(&self, signature: &FunctionSignature) -> Result<Vec<Property>> {
        let mut properties = Vec::new();

        // Common properties for all functions
        properties.push(Property {
            name: "no_panic".to_string(),
            description: "Function should not panic for any valid input".to_string(),
            expression: "no_panic".to_string(),
        });

        // Check for specific patterns
        if signature.params.len() == 2 && signature.params.iter().all(|p| p.type_name == signature.params[0].type_name) {
            // Commutativity check for binary functions
            properties.push(Property {
                name: "commutativity".to_string(),
                description: "f(a, b) == f(b, a)".to_string(),
                expression: format!("{}_commutative", signature.name),
            });
        }

        // Idempotence for functions that return same type
        if signature.params.len() == 1 && signature.return_type.as_ref() == Some(&signature.params[0].type_name) {
            properties.push(Property {
                name: "idempotence".to_string(),
                description: "f(f(x)) == f(x)".to_string(),
                expression: format!("{}_idempotent", signature.name),
            });
        }

        Ok(properties)
    }

    /// Generate Rust proptest code
    fn generate_rust_test(&self, signature: &FunctionSignature, properties: &[Property]) -> Result<String> {
        let param_strategies: Vec<String> = signature.params.iter()
            .map(|p| {
                self.strategies.get(&p.type_name)
                    .map(|s| s.strategy_code.clone())
                    .unwrap_or_else(|| "any::<()>()".to_string())
            })
            .collect();

        let param_names: Vec<&str> = signature.params.iter()
            .map(|p| p.name.as_str())
            .collect();

        let test_code = format!(
            r#"#[cfg(test)]
mod tests {{
    use proptest::prelude::*;
    use super::*;

    proptest! {{
        #[test]
        fn test_{}_no_panic({}) {{
            // Property: Function should not panic
            let _ = {}({});
        }}
    }}
}}"#,
            signature.name,
            param_names.iter().zip(&param_strategies)
                .map(|(n, s)| format!("{} in {}", n, s))
                .collect::<Vec<_>>()
                .join(", "),
            signature.name,
            param_names.join(", ")
        );

        Ok(test_code)
    }

    /// Generate Python hypothesis test
    fn generate_python_test(&self, signature: &FunctionSignature, _properties: &[Property]) -> Result<String> {
        let test_code = format!(
            r#"from hypothesis import given, strategies as st
import unittest

class Test{cap_name}(unittest.TestCase):
    @given(st.integers())
    def test_{name}_no_panic(self, x):
        # Property: Function should not panic
        try:
            {name}(x)
        except Exception:
            self.fail("Function panicked")
"#,
            name = signature.name,
            cap_name = signature.name.chars().next().unwrap_or('_').to_uppercase()
        );

        Ok(test_code)
    }

    /// Generate TypeScript test
    fn generate_typescript_test(&self, signature: &FunctionSignature, _properties: &[Property]) -> Result<String> {
        let test_code = format!(
            r#"import {{ property }} from 'fast-check';
import {{ {} }} from './module';

describe('{}', () => {{
    it('should not throw for any input', () => {{
        property(fc.integer(), (x) => {{
            expect(() => {}(x)).not.toThrow();
        }});
    }});
}});
"#,
            signature.name,
            signature.name,
            signature.name
        );

        Ok(test_code)
    }

    /// Generate generic test
    fn generate_generic_test(&self, signature: &FunctionSignature, _properties: &[Property]) -> Result<String> {
        Ok(format!(
            "// Generated test for {}\n// Implement with your testing framework",
            signature.name
        ))
    }

    /// Get generated tests
    pub fn get_tests(&self) -> &[GeneratedTest] {
        &self.generated_tests
    }
}

/// Function signature
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct FunctionSignature {
    pub name: String,
    pub params: Vec<Parameter>,
    pub return_type: Option<String>,
}

/// Function parameter
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Parameter {
    pub name: String,
    pub type_name: String,
}

impl Default for PropertyGenerator {
    fn default() -> Self {
        Self::new()
    }
}
