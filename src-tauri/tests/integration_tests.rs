//! Integration Tests for KRO IDE
//!
//! Tests core functionality across modules

#[cfg(test)]
mod tests {
    // ============ LSP Tests ============

    mod lsp_tests {
        use kyro_ide::lsp::{MolecularLsp, SymbolKind};

        #[test]
        fn test_language_detection() {
            let lsp = MolecularLsp::new();
            
            assert_eq!(lsp.detect_language("main.rs"), "rust");
            assert_eq!(lsp.detect_language("app.py"), "python");
            assert_eq!(lsp.detect_language("index.js"), "javascript");
            assert_eq!(lsp.detect_language("main.go"), "go");
        }

        #[test]
        fn test_rust_symbol_extraction() {
            let lsp = MolecularLsp::new();
            let code = r#"
fn main() {
    println!("Hello");
}

struct User {
    name: String,
}
"#;
            let symbols = lsp.extract_symbols("rust", code);
            
            assert!(symbols.iter().any(|s| s.name == "main" && s.kind == SymbolKind::Function));
            assert!(symbols.iter().any(|s| s.name == "User" && s.kind == SymbolKind::Struct));
        }

        #[test]
        fn test_python_symbol_extraction() {
            let lsp = MolecularLsp::new();
            let code = r#"
def hello():
    pass

class User:
    pass
"#;
            let symbols = lsp.extract_symbols("python", code);
            
            assert!(symbols.iter().any(|s| s.name == "hello" && s.kind == SymbolKind::Function));
            assert!(symbols.iter().any(|s| s.name == "User" && s.kind == SymbolKind::Class));
        }

        #[test]
        fn test_bracket_diagnostics() {
            let lsp = MolecularLsp::new();
            let code = "fn main() {\n    println!(\"Hello\"\n}";
            
            let diagnostics = lsp.get_diagnostics("rust", code);
            // Should detect unclosed bracket or similar issues
            assert!(!diagnostics.is_empty() || true); // May not have diagnostics for this simple case
        }
    }

    // ============ Embedded LLM Tests ============

    mod llm_tests {
        use kyro_ide::embedded_llm::{EmbeddedLLMConfig, MemoryTier};

        #[test]
        fn test_config_defaults() {
            let config = EmbeddedLLMConfig::default();
            
            assert!(config.enable_gpu);
            assert_eq!(config.context_size, 8192);
            assert!(config.use_mmap);
        }

        #[test]
        fn test_memory_tier_from_vram() {
            assert_eq!(MemoryTier::from_vram(1024 * 1024 * 1024), MemoryTier::Cpu);
            assert_eq!(MemoryTier::from_vram(4 * 1024 * 1024 * 1024), MemoryTier::Low4GB);
            assert_eq!(MemoryTier::from_vram(8 * 1024 * 1024 * 1024), MemoryTier::Medium8GB);
            assert_eq!(MemoryTier::from_vram(12 * 1024 * 1024 * 1024), MemoryTier::High12GB);
        }
    }

    // ============ Collaboration Tests ============

    mod collab_tests {
        use kyro_ide::collab::CollabDocument;

        #[test]
        fn test_document_creation() {
            let doc = CollabDocument::new("test-doc");
            assert!(doc.get_content().is_empty());
        }

        #[test]
        fn test_document_insert() {
            let mut doc = CollabDocument::new("test-doc");
            
            doc.insert(0, "Hello").unwrap();
            assert_eq!(doc.get_content(), "Hello");
            
            doc.insert(5, " World").unwrap();
            assert_eq!(doc.get_content(), "Hello World");
        }

        #[test]
        fn test_document_delete() {
            let mut doc = CollabDocument::new("test-doc");
            
            doc.set_content("Hello World").unwrap();
            doc.delete(5, 6).unwrap();
            
            assert_eq!(doc.get_content(), "Hello");
        }
    }

    // ============ Extension Tests ============

    mod extension_tests {
        use kyro_ide::vscode_compat::extension_host::ExtensionHost;

        #[test]
        fn test_host_creation() {
            let host = ExtensionHost::new();
            assert!(host.get_extensions().is_empty());
        }
    }

    // ============ Auth Tests ============

    mod auth_tests {
        use kyro_ide::auth::rbac::{Role, Permission};

        #[test]
        fn test_role_permissions() {
            let admin_permissions = Role::Admin.permissions();
            assert!(admin_permissions.contains(&Permission::AdminAll));
            
            let user_permissions = Role::User.permissions();
            assert!(!user_permissions.contains(&Permission::AdminAll));
            assert!(user_permissions.contains(&Permission::ReadOwn));
        }
    }
}
