//! Agent Orchestrator for specialized AI agents
//!
//! KYRO has 8 specialized agents:
//! - CODEGEN: Code generation
//! - REVIEW: Code review
//! - TEST: Test generation
//! - DEBUG: Debugging assistant
//! - DEPLOY: Deployment help
//! - VERIFY: Verification/formal methods
//! - DOCS: Documentation
//! - BROWSER: Web interaction

use anyhow::{Result, Context};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use super::{SwarmAIEngine, ModelInfo};

/// Agent types available in KYRO
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum AgentType {
    CodeGen,
    Review,
    Test,
    Debug,
    Deploy,
    Verify,
    Docs,
    Browser,
}

impl std::fmt::Display for AgentType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AgentType::CodeGen => write!(f, "codegen"),
            AgentType::Review => write!(f, "review"),
            AgentType::Test => write!(f, "test"),
            AgentType::Debug => write!(f, "debug"),
            AgentType::Deploy => write!(f, "deploy"),
            AgentType::Verify => write!(f, "verify"),
            AgentType::Docs => write!(f, "docs"),
            AgentType::Browser => write!(f, "browser"),
        }
    }
}

/// Agent configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentConfig {
    pub agent_type: AgentType,
    pub name: String,
    pub description: String,
    pub system_prompt: String,
    pub preferred_model: String,
    pub temperature: f32,
    pub max_tokens: u32,
    pub tools: Vec<AgentTool>,
}

/// Tool available to agents
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentTool {
    pub name: String,
    pub description: String,
    pub parameters: serde_json::Value,
}

/// Agent execution result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentResult {
    pub agent_type: AgentType,
    pub response: String,
    pub tool_calls: Vec<ToolCall>,
    pub execution_time_ms: u64,
    pub tokens_used: u32,
}

/// Tool call made by agent
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCall {
    pub tool_name: String,
    pub parameters: serde_json::Value,
    pub result: Option<String>,
}

/// Agent Orchestrator
pub struct AgentOrchestrator {
    agents: HashMap<AgentType, AgentConfig>,
    conversation_history: HashMap<AgentType, Vec<ConversationTurn>>,
}

/// A turn in the conversation
#[derive(Debug, Clone)]
struct ConversationTurn {
    role: String,
    content: String,
    timestamp: u64,
}

impl AgentOrchestrator {
    /// Create a new agent orchestrator
    pub fn new() -> Self {
        let mut orchestrator = Self {
            agents: HashMap::new(),
            conversation_history: HashMap::new(),
        };
        
        orchestrator.register_default_agents();
        orchestrator
    }

    /// Register default agents
    fn register_default_agents(&mut self) {
        // CODEGEN Agent
        self.agents.insert(AgentType::CodeGen, AgentConfig {
            agent_type: AgentType::CodeGen,
            name: "KYRO-CODEGEN".to_string(),
            description: "Expert code generation agent. Creates clean, efficient, well-documented code.".to_string(),
            system_prompt: include_str!("prompts/codegen.txt").to_string(),
            preferred_model: "codellama-7b-instruct-q4".to_string(),
            temperature: 0.3,
            max_tokens: 2048,
            tools: vec![
                AgentTool {
                    name: "read_file".to_string(),
                    description: "Read a file from the project".to_string(),
                    parameters: serde_json::json!({"path": "string"}),
                },
                AgentTool {
                    name: "write_file".to_string(),
                    description: "Write content to a file".to_string(),
                    parameters: serde_json::json!({"path": "string", "content": "string"}),
                },
                AgentTool {
                    name: "run_command".to_string(),
                    description: "Run a shell command".to_string(),
                    parameters: serde_json::json!({"command": "string"}),
                },
            ],
        });

        // REVIEW Agent
        self.agents.insert(AgentType::Review, AgentConfig {
            agent_type: AgentType::Review,
            name: "KYRO-REVIEW".to_string(),
            description: "Senior code reviewer. Analyzes code for security, performance, logic errors, and best practices.".to_string(),
            system_prompt: include_str!("prompts/review.txt").to_string(),
            preferred_model: "deepseek-coder-6.7b-instruct-q4".to_string(),
            temperature: 0.2,
            max_tokens: 1024,
            tools: vec![],
        });

        // TEST Agent
        self.agents.insert(AgentType::Test, AgentConfig {
            agent_type: AgentType::Test,
            name: "KYRO-TEST".to_string(),
            description: "Test engineering expert. Generates comprehensive tests with high coverage.".to_string(),
            system_prompt: include_str!("prompts/test.txt").to_string(),
            preferred_model: "codellama-7b-instruct-q4".to_string(),
            temperature: 0.4,
            max_tokens: 2048,
            tools: vec![
                AgentTool {
                    name: "run_tests".to_string(),
                    description: "Run test suite and get results".to_string(),
                    parameters: serde_json::json!({"test_file": "string"}),
                },
            ],
        });

        // DEBUG Agent
        self.agents.insert(AgentType::Debug, AgentConfig {
            agent_type: AgentType::Debug,
            name: "KYRO-DEBUG".to_string(),
            description: "Debugging expert. Analyzes errors, traces execution, and suggests fixes.".to_string(),
            system_prompt: include_str!("prompts/debug.txt").to_string(),
            preferred_model: "deepseek-coder-6.7b-instruct-q4".to_string(),
            temperature: 0.3,
            max_tokens: 1024,
            tools: vec![
                AgentTool {
                    name: "analyze_stack_trace".to_string(),
                    description: "Analyze a stack trace for root cause".to_string(),
                    parameters: serde_json::json!({"trace": "string"}),
                },
                AgentTool {
                    name: "debug_breakpoint".to_string(),
                    description: "Set a debug breakpoint".to_string(),
                    parameters: serde_json::json!({"file": "string", "line": "number"}),
                },
            ],
        });

        // DEPLOY Agent
        self.agents.insert(AgentType::Deploy, AgentConfig {
            agent_type: AgentType::Deploy,
            name: "KYRO-DEPLOY".to_string(),
            description: "Deployment specialist. Helps with CI/CD, Docker, and infrastructure.".to_string(),
            system_prompt: include_str!("prompts/deploy.txt").to_string(),
            preferred_model: "mistral-7b-instruct-q4".to_string(),
            temperature: 0.3,
            max_tokens: 1024,
            tools: vec![
                AgentTool {
                    name: "build_docker".to_string(),
                    description: "Build a Docker image".to_string(),
                    parameters: serde_json::json!({"tag": "string", "dockerfile": "string"}),
                },
                AgentTool {
                    name: "deploy_container".to_string(),
                    description: "Deploy a container".to_string(),
                    parameters: serde_json::json!({"image": "string", "name": "string"}),
                },
            ],
        });

        // VERIFY Agent
        self.agents.insert(AgentType::Verify, AgentConfig {
            agent_type: AgentType::Verify,
            name: "KYRO-VERIFY".to_string(),
            description: "Verification expert. Uses formal methods to prove code correctness.".to_string(),
            system_prompt: include_str!("prompts/verify.txt").to_string(),
            preferred_model: "mistral-7b-instruct-q4".to_string(),
            temperature: 0.1,
            max_tokens: 2048,
            tools: vec![
                AgentTool {
                    name: "run_kani".to_string(),
                    description: "Run Kani verification on a function".to_string(),
                    parameters: serde_json::json!({"function": "string"}),
                },
                AgentTool {
                    name: "generate_invariants".to_string(),
                    description: "Generate loop invariants".to_string(),
                    parameters: serde_json::json!({"code": "string"}),
                },
            ],
        });

        // DOCS Agent
        self.agents.insert(AgentType::Docs, AgentConfig {
            agent_type: AgentType::Docs,
            name: "KYRO-DOCS".to_string(),
            description: "Documentation specialist. Creates clear, comprehensive documentation.".to_string(),
            system_prompt: include_str!("prompts/docs.txt").to_string(),
            preferred_model: "mistral-7b-instruct-q4".to_string(),
            temperature: 0.4,
            max_tokens: 2048,
            tools: vec![],
        });

        // BROWSER Agent
        self.agents.insert(AgentType::Browser, AgentConfig {
            agent_type: AgentType::Browser,
            name: "KYRO-BROWSER".to_string(),
            description: "Web interaction agent. Searches web, reads documentation, downloads resources.".to_string(),
            system_prompt: include_str!("prompts/browser.txt").to_string(),
            preferred_model: "mistral-7b-instruct-q4".to_string(),
            temperature: 0.3,
            max_tokens: 1024,
            tools: vec![
                AgentTool {
                    name: "web_search".to_string(),
                    description: "Search the web for information".to_string(),
                    parameters: serde_json::json!({"query": "string"}),
                },
                AgentTool {
                    name: "fetch_url".to_string(),
                    description: "Fetch content from a URL".to_string(),
                    parameters: serde_json::json!({"url": "string"}),
                },
                AgentTool {
                    name: "download_file".to_string(),
                    description: "Download a file from URL".to_string(),
                    parameters: serde_json::json!({"url": "string", "destination": "string"}),
                },
            ],
        });
    }

    /// Run an agent
    pub async fn run(&self, agent_type: &str, input: &str, engine: &SwarmAIEngine) -> Result<String> {
        let agent_type = Self::parse_agent_type(agent_type)?;
        
        let config = self.agents.get(&agent_type)
            .ok_or_else(|| anyhow::anyhow!("Agent not found: {}", agent_type))?;

        // Build prompt with system message
        let full_prompt = format!(
            "[SYSTEM]\n{}\n\n[USER]\n{}",
            config.system_prompt, input
        );

        // Run inference
        let start = std::time::Instant::now();
        let response = engine.complete(&full_prompt, config.max_tokens).await?;
        let elapsed = start.elapsed();

        println!("Agent {} completed in {:?}", config.name, elapsed);

        Ok(response)
    }

    /// Parse agent type from string
    fn parse_agent_type(s: &str) -> Result<AgentType> {
        match s.to_lowercase().as_str() {
            "codegen" => Ok(AgentType::CodeGen),
            "review" => Ok(AgentType::Review),
            "test" => Ok(AgentType::Test),
            "debug" => Ok(AgentType::Debug),
            "deploy" => Ok(AgentType::Deploy),
            "verify" => Ok(AgentType::Verify),
            "docs" => Ok(AgentType::Docs),
            "browser" => Ok(AgentType::Browser),
            _ => Err(anyhow::anyhow!("Unknown agent type: {}", s)),
        }
    }

    /// Get agent configuration
    pub fn get_config(&self, agent_type: AgentType) -> Option<&AgentConfig> {
        self.agents.get(&agent_type)
    }

    /// List all agents
    pub fn list_agents(&self) -> Vec<&AgentConfig> {
        self.agents.values().collect()
    }

    /// Clear conversation history for an agent
    pub fn clear_history(&mut self, agent_type: AgentType) {
        self.conversation_history.remove(&agent_type);
    }

    /// Clear all conversation history
    pub fn clear_all_history(&mut self) {
        self.conversation_history.clear();
    }
}

impl Default for AgentOrchestrator {
    fn default() -> Self {
        Self::new()
    }
}

/// Agent prompts as embedded strings (would be separate files in production)
pub mod prompts {
    pub const CODEGEN: &str = r#"You are KYRO-CODEGEN, an expert code generation agent.

Your role is to:
- Generate clean, efficient, well-documented code
- Follow language-specific best practices
- Consider edge cases and error handling
- Write self-documenting code with clear naming
- Include appropriate comments for complex logic

Guidelines:
- Always analyze the requirements before coding
- Consider the existing codebase context
- Write tests when appropriate
- Suggest optimizations if you see opportunities
- Explain your design decisions briefly

When generating code:
1. Start with a brief analysis of requirements
2. Present the code with proper formatting
3. Add docstrings/comments
4. Mention any dependencies needed
5. Suggest how to test the code"#;

    pub const REVIEW: &str = r#"You are KYRO-REVIEW, a senior code reviewer.

Your role is to:
- Identify security vulnerabilities
- Find performance issues
- Check for logic errors
- Ensure best practices are followed
- Suggest improvements

Review checklist:
- Security: Input validation, injection risks, authentication
- Performance: Algorithm complexity, memory usage, I/O patterns
- Correctness: Edge cases, error handling, race conditions
- Maintainability: Naming, structure, documentation
- Testing: Coverage, test quality

Provide actionable feedback with:
- Severity (Critical/High/Medium/Low)
- Line number reference
- Explanation of the issue
- Suggested fix"#;

    pub const TEST: &str = r#"You are KYRO-TEST, a test engineering expert.

Your role is to:
- Generate comprehensive test suites
- Achieve high code coverage
- Test edge cases and error conditions
- Write clear, maintainable tests

Test types to consider:
- Unit tests for individual functions
- Integration tests for component interactions
- Property-based tests for invariants
- Performance tests for critical paths

Test structure:
- Arrange: Set up test data and conditions
- Act: Execute the code under test
- Assert: Verify expected outcomes

Include:
- Happy path tests
- Error case tests
- Boundary tests
- Edge case tests"#;

    pub const DEBUG: &str = r#"You are KYRO-DEBUG, a debugging expert.

Your role is to:
- Analyze error messages and stack traces
- Identify root causes of bugs
- Trace execution flow
- Suggest fixes with explanations

Debugging approach:
1. Reproduce the issue
2. Analyze the error/stack trace
3. Identify the root cause
4. Develop a fix
5. Verify the fix works
6. Check for similar issues

Always:
- Ask clarifying questions if needed
- Explain your reasoning
- Provide step-by-step debugging guidance
- Suggest preventive measures"#;

    pub const DEPLOY: &str = r#"You are KYRO-DEPLOY, a deployment specialist.

Your role is to:
- Help with CI/CD pipeline setup
- Create Docker configurations
- Configure infrastructure
- Handle deployment automation

Areas of expertise:
- Docker and containerization
- Kubernetes and orchestration
- CI/CD (GitHub Actions, GitLab CI, Jenkins)
- Cloud platforms (AWS, GCP, Azure)
- Infrastructure as Code (Terraform, Pulumi)

Always consider:
- Security best practices
- Scalability requirements
- Cost optimization
- Monitoring and logging
- Rollback strategies"#;

    pub const VERIFY: &str = r#"You are KYRO-VERIFY, a verification expert.

Your role is to:
- Use formal methods to prove correctness
- Generate invariants and assertions
- Identify potential runtime errors
- Create verification conditions

Tools and techniques:
- Symbolic execution
- Model checking
- Abstract interpretation
- Theorem proving (Z3)
- Runtime verification (Kani)

Focus on:
- Absence of panics
- Memory safety
- Overflow checks
- Assertion verification
- Loop invariant generation"#;

    pub const DOCS: &str = r#"You are KYRO-DOCS, a documentation specialist.

Your role is to:
- Create clear, comprehensive documentation
- Write API documentation
- Generate user guides
- Create code examples

Documentation types:
- API reference documentation
- User guides and tutorials
- Architecture documentation
- README files
- Code comments

Guidelines:
- Start with a brief overview
- Include practical examples
- Explain "why" not just "what"
- Keep it up-to-date with code changes
- Use consistent formatting"#;

    pub const BROWSER: &str = r#"You are KYRO-BROWSER, a web interaction agent.

Your role is to:
- Search the web for information
- Read documentation and tutorials
- Download resources
- Find code examples

Capabilities:
- Web search for current information
- Fetch and parse web pages
- Extract relevant information
- Download files

Guidelines:
- Verify source credibility
- Summarize findings clearly
- Provide citations/links
- Respect rate limits
- Handle errors gracefully"#;
}
