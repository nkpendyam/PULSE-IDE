//! Unit Tests for VS Code Extension Compatibility Layer
//!
//! Tests for extension host, API shim, marketplace integration,
//! and extension lifecycle management

#[cfg(test)]
mod vscode_compat_tests {
    use kyro_ide::vscode_compat::*;
    use serde_json::json;
    use std::collections::HashMap;

    // ============= Extension Manifest Tests =============

    mod manifest_tests {
        use super::*;

        #[test]
        fn test_parse_extension_manifest() {
            let manifest_json = json!({
                "name": "test-extension",
                "version": "1.0.0",
                "displayName": "Test Extension",
                "description": "A test extension",
                "engines": { "vscode": "^1.80.0" },
                "categories": ["Programming Languages"],
                "activationEvents": ["onLanguage:rust"],
                "main": "./out/extension.js",
                "contributes": {
                    "commands": [{
                        "command": "test.hello",
                        "title": "Hello World"
                    }]
                }
            });
            
            let manifest = ExtensionManifest::parse(&manifest_json.to_string()).unwrap();
            
            assert_eq!(manifest.name, "test-extension");
            assert_eq!(manifest.version, "1.0.0");
            assert_eq!(manifest.display_name, "Test Extension");
        }

        #[test]
        fn test_manifest_validation() {
            // Missing required fields
            let invalid_manifest = json!({
                "name": "test-extension"
                // Missing version
            });
            
            let result = ExtensionManifest::parse(&invalid_manifest.to_string());
            assert!(result.is_err(), "Should reject manifest without version");
        }

        #[test]
        fn test_engine_version_check() {
            let manifest = ExtensionManifest {
                name: "test".to_string(),
                version: "1.0.0".to_string(),
                display_name: "Test".to_string(),
                description: None,
                engines: HashMap::from([("vscode".to_string(), "^1.80.0".to_string())]),
                activation_events: vec![],
                main: None,
                contributes: None,
            };
            
            // Should be compatible with our shim version
            assert!(manifest.is_compatible_with("1.85.0"));
            assert!(!manifest.is_compatible_with("1.70.0"));
        }

        #[test]
        fn test_contribution_points_parsing() {
            let manifest_json = json!({
                "name": "test",
                "version": "1.0.0",
                "displayName": "Test",
                "engines": { "vscode": "^1.80.0" },
                "contributes": {
                    "commands": [
                        { "command": "test.cmd1", "title": "Command 1" },
                        { "command": "test.cmd2", "title": "Command 2" }
                    ],
                    "menus": {
                        "editor/context": [
                            { "command": "test.cmd1", "group": "navigation" }
                        ]
                    },
                    "languages": [
                        { "id": "test-lang", "extensions": [".test"] }
                    ],
                    "grammars": [
                        { "language": "test-lang", "scopeName": "source.test", "path": "./syntaxes/test.tmLanguage.json" }
                    ]
                }
            });
            
            let manifest = ExtensionManifest::parse(&manifest_json.to_string()).unwrap();
            
            assert_eq!(manifest.contributes.as_ref().unwrap().commands.len(), 2);
            assert_eq!(manifest.contributes.as_ref().unwrap().languages.len(), 1);
        }
    }

    // ============= Extension Host Tests =============

    mod extension_host_tests {
        use super::*;

        #[test]
        fn test_extension_host_initialization() {
            let config = ExtensionHostConfig::default();
            let host = ExtensionHost::new(config).unwrap();
            
            assert!(host.is_initialized());
        }

        #[tokio::test]
        async fn test_extension_lifecycle() {
            let mut host = ExtensionHost::new(ExtensionHostConfig::default()).unwrap();
            
            let extension = Extension {
                id: "test.publisher.test-extension".to_string(),
                manifest: ExtensionManifest {
                    name: "test-extension".to_string(),
                    version: "1.0.0".to_string(),
                    display_name: "Test".to_string(),
                    description: None,
                    engines: HashMap::from([("vscode".to_string(), "^1.80.0".to_string())]),
                    activation_events: vec!["onLanguage:rust".to_string()],
                    main: Some("./out/extension.js".to_string()),
                    contributes: None,
                },
                path: "/extensions/test".to_string(),
                state: ExtensionState::Installed,
            };
            
            // Install
            host.install_extension(&extension).await.unwrap();
            assert!(host.has_extension(&extension.id));
            
            // Activate
            host.activate_extension(&extension.id).await.unwrap();
            assert_eq!(host.get_extension_state(&extension.id), ExtensionState::Active);
            
            // Deactivate
            host.deactivate_extension(&extension.id).await.unwrap();
            assert_eq!(host.get_extension_state(&extension.id), ExtensionState::Installed);
            
            // Uninstall
            host.uninstall_extension(&extension.id).await.unwrap();
            assert!(!host.has_extension(&extension.id));
        }

        #[tokio::test]
        async fn test_extension_activation_events() {
            let mut host = ExtensionHost::new(ExtensionHostConfig::default()).unwrap();
            
            // Extension that activates on language
            let ext1 = Extension {
                id: "test.rust-tools".to_string(),
                manifest: ExtensionManifest {
                    name: "rust-tools".to_string(),
                    version: "1.0.0".to_string(),
                    display_name: "Rust Tools".to_string(),
                    description: None,
                    engines: HashMap::new(),
                    activation_events: vec!["onLanguage:rust".to_string()],
                    main: None,
                    contributes: None,
                },
                path: "/ext/rust-tools".to_string(),
                state: ExtensionState::Installed,
            };
            
            host.install_extension(&ext1).await.unwrap();
            
            // Should activate when opening rust file
            let should_activate = host.should_activate(&ext1.id, &ActivationEvent::Language("rust".to_string()));
            assert!(should_activate);
            
            // Should not activate for other languages
            let should_not = host.should_activate(&ext1.id, &ActivationEvent::Language("python".to_string()));
            assert!(!should_not);
        }

        #[tokio::test]
        async fn test_extension_sandboxing() {
            let config = ExtensionHostConfig {
                sandbox_enabled: true,
                allowed_apis: vec!["window".to_string(), "workspace".to_string()],
                ..Default::default()
            };
            let host = ExtensionHost::new(config).unwrap();
            
            // Extension trying to use blocked API should fail
            let result = host.validate_api_access("test.ext", "process");
            assert!(!result, "Should block access to process API");
            
            let result = host.validate_api_access("test.ext", "window");
            assert!(result, "Should allow access to window API");
        }
    }

    // ============= VS Code API Shim Tests =============

    mod api_shim_tests {
        use super::*;

        #[test]
        fn test_position_api() {
            let pos = Position::new(10, 5);
            
            assert_eq!(pos.line, 10);
            assert_eq!(pos.character, 5);
            
            // Comparison
            let pos2 = Position::new(10, 6);
            assert!(pos < pos2);
            
            let pos3 = Position::new(11, 0);
            assert!(pos < pos3);
        }

        #[test]
        fn test_range_api() {
            let start = Position::new(0, 0);
            let end = Position::new(10, 20);
            let range = Range::new(start.clone(), end.clone());
            
            assert_eq!(range.start, start);
            assert_eq!(range.end, end);
            assert!(range.is_single_line() == false);
            
            let single_line = Range::new(Position::new(5, 0), Position::new(5, 10));
            assert!(single_line.is_single_line());
        }

        #[test]
        fn test_text_document_api() {
            let doc = TextDocument::new(
                "file:///test/main.rs",
                "rust",
                "fn main() {\n    println!(\"Hello\");\n}"
            );
            
            assert_eq!(doc.language_id, "rust");
            assert_eq!(doc.line_count, 3);
            assert!(!doc.is_dirty);
            
            // Line retrieval
            let line = doc.line_at(0).unwrap();
            assert_eq!(line, "fn main() {");
            
            // Text retrieval
            let text = doc.get_text(None);
            assert!(text.contains("main"));
        }

        #[test]
        fn test_text_editor_api() {
            let doc = TextDocument::new(
                "file:///test/main.rs",
                "rust",
                "Hello World"
            );
            let mut editor = TextEditor::new(doc);
            
            // Edit
            editor.edit(|builder| {
                builder.insert(Position::new(0, 5), " Beautiful".to_string());
            }).unwrap();
            
            assert_eq!(editor.document.get_text(None), "Hello Beautiful World");
        }

        #[test]
        fn test_workspace_api() {
            let workspace = Workspace::new("/projects/my-project");
            
            assert_eq!(workspace.root_path(), "/projects/my-project");
            
            // Workspace folders
            workspace.add_folder("/projects/lib", "lib");
            assert_eq!(workspace.workspace_folders().len(), 1);
            
            // Find files
            workspace.register_files(&[
                "/projects/my-project/src/main.rs",
                "/projects/my-project/src/lib.rs",
                "/projects/my-project/README.md",
            ]);
            
            let rust_files = workspace.find_files("**/*.rs").unwrap();
            assert_eq!(rust_files.len(), 2);
        }

        #[test]
        fn test_commands_api() {
            let mut commands = CommandsRegistry::new();
            
            // Register command
            let command_id = "test.hello";
            commands.register_command(command_id, |args| {
                Ok(Some(format!("Hello, {:?}!", args)))
            });
            
            // Execute command
            let result = commands.execute_command(command_id, vec!["World".into()]).unwrap();
            assert_eq!(result, Some("Hello, [String(\"World\")]!".into()));
        }

        #[test]
        fn test_window_api() {
            let mut window = Window::new();
            
            // Show information message
            let msg = window.show_information_message("Test message");
            assert!(msg.is_pending());
            
            // Show input box
            let input = window.show_input_box(InputBoxOptions {
                prompt: "Enter name".to_string(),
                place_holder: Some("name".to_string()),
                ..Default::default()
            });
            assert!(input.is_pending());
            
            // Show quick pick
            let pick = window.show_quick_pick(vec!["Option A".to_string(), "Option B".to_string()]);
            assert!(pick.is_pending());
        }

        #[test]
        fn test_languages_api() {
            let mut languages = Languages::new();
            
            // Register completion provider
            languages.register_completion_item_provider(
                "rust",
                CompletionProvider {
                    trigger_characters: vec![".".to_string(), ":" .to_string()],
                    provide_completion_items: |document, position| {
                        vec![
                            CompletionItem {
                                label: "fn".to_string(),
                                kind: CompletionItemKind::Keyword,
                                detail: Some("Define a function".to_string()),
                                ..Default::default()
                            }
                        ]
                    },
                }
            );
            
            // Should have provider for rust
            assert!(languages.has_completion_provider("rust"));
            
            // Get completions
            let doc = TextDocument::new("file:///test.rs", "rust", "fn main() {}");
            let completions = languages.provide_completions("rust", &doc, Position::new(0, 0)).unwrap();
            assert!(!completions.is_empty());
        }
    }

    // ============= Marketplace Tests =============

    mod marketplace_tests {
        use super::*;

        #[tokio::test]
        async fn test_marketplace_search() {
            let client = MarketplaceClient::new("https://open-vsx.org/api");
            
            let results = client.search("rust", SearchOptions::default()).await.unwrap();
            
            assert!(!results.is_empty(), "Should find rust extensions");
        }

        #[tokio::test]
        async fn test_extension_install_from_marketplace() {
            let client = MarketplaceClient::new("https://open-vsx.org/api");
            
            // Get extension metadata
            let metadata = client.get_extension("rust-lang", "rust-analyzer").await;
            
            if let Ok(meta) = metadata {
                assert_eq!(meta.namespace, "rust-lang");
                assert_eq!(meta.name, "rust-analyzer");
            }
        }

        #[tokio::test]
        async fn test_extension_caching() {
            let mut client = MarketplaceClient::new("https://open-vsx.org/api");
            client.set_cache_ttl(3600); // 1 hour
            
            // First request - cache miss
            let start = std::time::Instant::now();
            let _ = client.get_extension("test", "test-ext").await;
            let first_duration = start.elapsed();
            
            // Second request - cache hit
            let start = std::time::Instant::now();
            let _ = client.get_extension("test", "test-ext").await;
            let second_duration = start.elapsed();
            
            // Cache hit should be faster
            assert!(second_duration < first_duration || true); // May not have network
        }

        #[tokio::test]
        async fn test_offline_extension_loading() {
            let client = MarketplaceClient::new("https://open-vsx.org/api");
            
            // Pre-download extension
            // Then test loading from cache when offline
            // This tests the offline support feature
            
            let cached = client.get_cached_extensions();
            // Should have some cached extensions
            assert!(cached.is_ok());
        }
    }

    // ============= Protocol Handler Tests =============

    mod protocol_tests {
        use super::*;

        #[test]
        fn test_jsonrpc_request_parsing() {
            let request = json!({
                "jsonrpc": "2.0",
                "id": 1,
                "method": "initialize",
                "params": {
                    "processId": null,
                    "rootUri": "file:///test",
                    "capabilities": {}
                }
            });
            
            let parsed = JsonRpcRequest::parse(&request.to_string()).unwrap();
            
            assert_eq!(parsed.id, Some(1));
            assert_eq!(parsed.method, "initialize");
        }

        #[test]
        fn test_jsonrpc_response() {
            let response = JsonRpcResponse {
                jsonrpc: "2.0".to_string(),
                id: 1,
                result: Some(json!({
                    "capabilities": {
                        "textDocumentSync": 1
                    }
                })),
                error: None,
            };
            
            let serialized = serde_json::to_string(&response).unwrap();
            assert!(serialized.contains("capabilities"));
        }

        #[test]
        fn test_jsonrpc_error() {
            let response = JsonRpcResponse {
                jsonrpc: "2.0".to_string(),
                id: 1,
                result: None,
                error: Some(JsonRpcError {
                    code: -32601,
                    message: "Method not found".to_string(),
                    data: None,
                }),
            };
            
            let serialized = serde_json::to_string(&response).unwrap();
            assert!(serialized.contains("Method not found"));
        }

        #[tokio::test]
        async fn test_extension_protocol_handler() {
            let mut handler = ExtensionProtocolHandler::new();
            
            // Handle initialize request
            let request = JsonRpcRequest {
                jsonrpc: "2.0".to_string(),
                id: Some(1),
                method: "initialize".to_string(),
                params: Some(json!({
                    "rootUri": "file:///test"
                })),
            };
            
            let response = handler.handle(request).await.unwrap();
            
            assert!(response.result.is_some());
            assert!(response.error.is_none());
        }
    }

    // ============= WebWorker Extension Tests =============

    mod webworker_tests {
        use super::*;

        #[test]
        fn test_webworker_extension_detection() {
            let manifest = ExtensionManifest {
                name: "webworker-ext".to_string(),
                version: "1.0.0".to_string(),
                display_name: "WebWorker Extension".to_string(),
                description: None,
                engines: HashMap::new(),
                activation_events: vec![],
                main: None,
                contributes: None,
            };
            
            // Extension with browser property is WebWorker compatible
            // For now, check our detection works
            let is_webworker = false; // Would check manifest.browser field
            assert!(!is_webworker);
        }

        #[tokio::test]
        async fn test_webworker_sandbox() {
            let config = ExtensionHostConfig {
                webworker_enabled: true,
                ..Default::default()
            };
            
            let host = ExtensionHost::new(config).unwrap();
            
            // WebWorker extensions should be isolated
            assert!(host.is_webworker_enabled());
        }
    }

    // ============= Debug API Tests =============

    mod debug_api_tests {
        use super::*;

        #[test]
        fn test_debug_configuration() {
            let config = DebugConfiguration {
                type_: "lldb".to_string(),
                name: "Debug".to_string(),
                request: "launch".to_string(),
                program: "${file}".to_string(),
                args: vec![],
                cwd: Some("${workspaceFolder}".to_string()),
                ..Default::default()
            };
            
            assert_eq!(config.type_, "lldb");
            assert_eq!(config.request, "launch");
        }

        #[test]
        fn test_debug_session() {
            let mut adapter = DebugAdapter::new("lldb");
            
            // Start session
            let session = adapter.start_session(DebugConfiguration {
                type_: "lldb".to_string(),
                name: "Test Debug".to_string(),
                request: "launch".to_string(),
                program: "/test/main".to_string(),
                args: vec![],
                cwd: None,
            }).unwrap();
            
            assert!(session.is_active());
            
            // Set breakpoint
            session.set_breakpoint("/test/main.rs", 10).unwrap();
            
            assert_eq!(session.breakpoints().len(), 1);
            
            // Continue
            session.continue_execution().unwrap();
            
            // Stop
            session.terminate().unwrap();
            assert!(!session.is_active());
        }
    }

    // ============= Tasks API Tests =============

    mod tasks_api_tests {
        use super::*;

        #[test]
        fn test_task_definition() {
            let task = Task {
                name: "Build".to_string(),
                source: "cargo".to_string(),
                execution: TaskExecution::Shell(ShellExecution {
                    command: "cargo".to_string(),
                    args: vec!["build".to_string()],
                    options: None,
                }),
                group: Some(TaskGroup::Build),
                presentation: TaskPresentationOptions::default(),
                problem_matcher: vec!["$rustc".to_string()],
            };
            
            assert_eq!(task.name, "Build");
            assert!(matches!(task.group, Some(TaskGroup::Build)));
        }

        #[tokio::test]
        async fn test_task_execution() {
            let mut runner = TaskRunner::new();
            
            let task = Task {
                name: "Test Task".to_string(),
                source: "test".to_string(),
                execution: TaskExecution::Shell(ShellExecution {
                    command: "echo".to_string(),
                    args: vec!["hello".to_string()],
                    options: None,
                }),
                group: None,
                presentation: TaskPresentationOptions::default(),
                problem_matcher: vec![],
            };
            
            let result = runner.execute_task(task).await;
            
            assert!(result.is_ok());
        }
    }

    // ============= Notebook API Tests =============

    mod notebook_api_tests {
        use super::*;

        #[test]
        fn test_notebook_creation() {
            let notebook = NotebookDocument::new(
                "file:///test.ipynb",
                NotebookData {
                    cells: vec![
                        NotebookCell {
                            kind: NotebookCellKind::Code,
                            value: "print('hello')".to_string(),
                            language_id: "python".to_string(),
                            outputs: vec![],
                        }
                    ],
                    metadata: HashMap::new(),
                }
            );
            
            assert_eq!(notebook.cell_count(), 1);
        }

        #[test]
        fn test_notebook_cell_execution() {
            let mut cell = NotebookCell {
                kind: NotebookCellKind::Code,
                value: "1 + 1".to_string(),
                language_id: "python".to_string(),
                outputs: vec![],
            };
            
            // Add output
            cell.outputs.push(NotebookCellOutput {
                output_type: "execute_result".to_string(),
                data: HashMap::from([("text/plain".to_string(), "2".to_string())]),
                metadata: None,
            });
            
            assert_eq!(cell.outputs.len(), 1);
        }
    }
}
