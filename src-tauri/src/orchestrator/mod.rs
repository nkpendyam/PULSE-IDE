//! Kyro Orchestrator
//!
//! Unified service that routes user prompts to AirLLM, Ollama, PicoClaw,
//! and coordinates missions across agents. Acts as the central "mission control"
//! for the IDE.
//!
//! ## Quest Mode Pipeline
//! Spec → Planner → Coder → Reviewer → Tester → Done

mod missions;

pub use missions::{Mission, MissionArtifact, MissionPhase, MissionStatus};

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

/// Orchestrator configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrchestratorConfig {
    /// Preferred model backend: "airllm", "ollama", "embedded", "auto"
    pub preferred_backend: String,
    /// VRAM profile: "4gb", "8gb", "16gb"
    pub vram_profile: String,
    /// Max concurrent missions
    pub max_concurrent_missions: usize,
    /// Ollama base URL
    pub ollama_url: String,
    /// Model for planning tasks
    pub planner_model: String,
    /// Model for coding tasks
    pub coder_model: String,
    /// Model for review tasks
    pub reviewer_model: String,
}

impl Default for OrchestratorConfig {
    fn default() -> Self {
        Self {
            preferred_backend: "auto".to_string(),
            vram_profile: "8gb".to_string(),
            max_concurrent_missions: 5,
            ollama_url: "http://localhost:11434".to_string(),
            planner_model: "codellama:7b-instruct".to_string(),
            coder_model: "codellama:7b-instruct".to_string(),
            reviewer_model: "codellama:7b-instruct".to_string(),
        }
    }
}

/// Model info for orchestrator
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelInfo {
    pub id: String,
    pub name: String,
    pub backend: String,
    pub vram_mb: Option<u32>,
    pub available: bool,
}

/// Agent info for orchestrator
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentInfo {
    pub id: String,
    pub name: String,
    pub role: String,
    pub status: String,
    pub model: Option<String>,
}

/// A step in the quest checklist, produced by the Planner agent
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuestStep {
    pub id: String,
    pub description: String,
    pub tool: Option<String>,
    pub file_path: Option<String>,
    pub status: QuestStepStatus,
    pub output: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum QuestStepStatus {
    Pending,
    Running,
    Done,
    Failed,
    Skipped,
}

/// Full quest state (returned to frontend)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuestState {
    pub mission_id: String,
    pub spec: String,
    pub steps: Vec<QuestStep>,
    pub phase: MissionPhase,
    pub status: MissionStatus,
    pub review_notes: Option<String>,
    pub test_output: Option<String>,
}

/// Kyro Orchestrator - central mission control
pub struct KyroOrchestrator {
    config: OrchestratorConfig,
    missions: Arc<RwLock<HashMap<String, Mission>>>,
    quests: Arc<RwLock<HashMap<String, QuestState>>>,
    http: reqwest::Client,
}

impl KyroOrchestrator {
    pub fn new(config: OrchestratorConfig) -> Self {
        Self {
            config,
            missions: Arc::new(RwLock::new(HashMap::new())),
            quests: Arc::new(RwLock::new(HashMap::new())),
            http: reqwest::Client::new(),
        }
    }

    /// Start a new mission
    pub async fn start_mission(&self, goal: String, constraints: Option<Vec<String>>) -> Mission {
        let id = Uuid::new_v4().to_string();
        let mission = Mission {
            id: id.clone(),
            goal,
            constraints: constraints.unwrap_or_default(),
            phase: MissionPhase::Plan,
            status: MissionStatus::Running,
            assigned_agents: Vec::new(),
            artifacts: Vec::new(),
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        };

        let mut missions = self.missions.write().await;
        missions.insert(id.clone(), mission.clone());
        mission
    }

    /// Get mission by ID
    pub async fn get_mission(&self, id: &str) -> Option<Mission> {
        let missions = self.missions.read().await;
        missions.get(id).cloned()
    }

    /// List all missions
    pub async fn list_missions(&self) -> Vec<Mission> {
        let missions = self.missions.read().await;
        missions.values().cloned().collect()
    }

    /// Update mission phase
    pub async fn update_mission_phase(&self, id: &str, phase: MissionPhase) -> Option<Mission> {
        let mut missions = self.missions.write().await;
        if let Some(m) = missions.get_mut(id) {
            m.phase = phase;
            m.updated_at = chrono::Utc::now();
            if phase == MissionPhase::Deploy {
                m.status = MissionStatus::Completed;
            }
            return Some(m.clone());
        }
        None
    }

    /// Get config
    pub fn config(&self) -> &OrchestratorConfig {
        &self.config
    }

    // =========================================================================
    // Quest Mode Pipeline: Planner → Coder → Reviewer → Tester
    // =========================================================================

    /// Start a Quest: full pipeline from user spec to tested code
    pub async fn start_quest(&self, spec: String, project_path: String) -> Result<QuestState, String> {
        // 1. Create mission
        let mission = self.start_mission(spec.clone(), None).await;
        let mission_id = mission.id.clone();

        // 2. Run Planner agent — produce a checklist of steps
        let steps = self.run_planner(&spec, &project_path).await?;

        let quest = QuestState {
            mission_id: mission_id.clone(),
            spec: spec.clone(),
            steps,
            phase: MissionPhase::Plan,
            status: MissionStatus::Running,
            review_notes: None,
            test_output: None,
        };

        self.quests.write().await.insert(mission_id.clone(), quest.clone());
        Ok(quest)
    }

    /// Execute all steps of an existing quest (Coder phase)
    pub async fn execute_quest(&self, mission_id: &str, project_path: &str) -> Result<QuestState, String> {
        let mut quest = {
            let quests = self.quests.read().await;
            quests.get(mission_id).cloned().ok_or("Quest not found")?
        };

        // Advance to Edit phase
        quest.phase = MissionPhase::Edit;
        self.update_mission_phase(mission_id, MissionPhase::Edit).await;

        // Execute each pending step via the Coder agent
        for i in 0..quest.steps.len() {
            if quest.steps[i].status != QuestStepStatus::Pending {
                continue;
            }
            quest.steps[i].status = QuestStepStatus::Running;
            self.save_quest(&quest).await;

            match self.run_coder_step(&quest.steps[i], &quest.spec, project_path).await {
                Ok(output) => {
                    quest.steps[i].status = QuestStepStatus::Done;
                    quest.steps[i].output = Some(output);
                }
                Err(e) => {
                    quest.steps[i].status = QuestStepStatus::Failed;
                    quest.steps[i].error = Some(e);
                }
            }
            self.save_quest(&quest).await;
        }

        // Review phase
        quest.phase = MissionPhase::Review;
        self.update_mission_phase(mission_id, MissionPhase::Review).await;
        let review = self.run_reviewer(&quest, project_path).await.unwrap_or_default();
        quest.review_notes = Some(review);

        // Test phase
        quest.phase = MissionPhase::Test;
        self.update_mission_phase(mission_id, MissionPhase::Test).await;
        let test_out = self.run_tester(project_path).await.unwrap_or_default();
        quest.test_output = Some(test_out);

        // Done
        quest.phase = MissionPhase::Deploy;
        quest.status = MissionStatus::Completed;
        self.update_mission_phase(mission_id, MissionPhase::Deploy).await;
        self.save_quest(&quest).await;

        Ok(quest)
    }

    /// Get quest state
    pub async fn get_quest(&self, mission_id: &str) -> Option<QuestState> {
        self.quests.read().await.get(mission_id).cloned()
    }

    async fn save_quest(&self, quest: &QuestState) {
        self.quests.write().await.insert(quest.mission_id.clone(), quest.clone());
    }

    // ── Agent implementations ───────────────────────────────────────────

    /// Planner agent: sends spec to LLM, returns a checklist of QuestSteps
    async fn run_planner(&self, spec: &str, project_path: &str) -> Result<Vec<QuestStep>, String> {
        let system = "You are a senior software architect. Given a feature specification, produce a numbered checklist of implementation steps. Each step should be a concrete action like 'Create file X', 'Add function Y to Z', 'Write test for W'. Output ONLY the numbered list, one step per line.";
        let prompt = format!("Project: {}\n\nFeature spec:\n{}", project_path, spec);

        let response = self.llm_chat(&self.config.planner_model, system, &prompt).await?;

        // Parse numbered list into QuestSteps
        let steps: Vec<QuestStep> = response
            .lines()
            .filter(|l| !l.trim().is_empty())
            .enumerate()
            .map(|(i, line)| {
                // Strip leading number/bullet
                let desc = line.trim_start_matches(|c: char| c.is_ascii_digit() || c == '.' || c == ')' || c == '-' || c == ' ');
                QuestStep {
                    id: format!("step-{}", i + 1),
                    description: desc.trim().to_string(),
                    tool: None,
                    file_path: None,
                    status: QuestStepStatus::Pending,
                    output: None,
                    error: None,
                }
            })
            .collect();

        if steps.is_empty() {
            return Err("Planner returned no steps".to_string());
        }

        Ok(steps)
    }

    /// Coder agent: executes a single quest step
    async fn run_coder_step(&self, step: &QuestStep, spec: &str, project_path: &str) -> Result<String, String> {
        let system = "You are an expert programmer. Given a task description, produce the exact code changes needed. Show file paths and code. Be concise and precise.";
        let prompt = format!(
            "Project: {}\nOverall spec: {}\n\nCurrent task: {}",
            project_path, spec, step.description
        );

        self.llm_chat(&self.config.coder_model, system, &prompt).await
    }

    /// Reviewer agent: examines completed steps and provides review notes
    async fn run_reviewer(&self, quest: &QuestState, project_path: &str) -> Result<String, String> {
        let completed: Vec<String> = quest.steps.iter()
            .filter(|s| s.status == QuestStepStatus::Done)
            .map(|s| format!("- {}: {}", s.description, s.output.as_deref().unwrap_or("(no output)")))
            .collect();

        let system = "You are a code reviewer. Examine the completed implementation steps and provide a brief review: correctness issues, missing edge cases, style problems. Be concise.";
        let prompt = format!(
            "Project: {}\nSpec: {}\n\nCompleted steps:\n{}",
            project_path, quest.spec, completed.join("\n")
        );

        self.llm_chat(&self.config.reviewer_model, system, &prompt).await
    }

    /// Tester agent: runs the project's test suite and returns output
    async fn run_tester(&self, project_path: &str) -> Result<String, String> {
        // Detect test command based on project files
        let test_cmd = if std::path::Path::new(project_path).join("Cargo.toml").exists() {
            "cargo test 2>&1"
        } else if std::path::Path::new(project_path).join("package.json").exists() {
            "npm test 2>&1"
        } else if std::path::Path::new(project_path).join("go.mod").exists() {
            "go test ./... 2>&1"
        } else if std::path::Path::new(project_path).join("pytest.ini").exists()
            || std::path::Path::new(project_path).join("setup.py").exists()
        {
            "python -m pytest 2>&1"
        } else {
            return Ok("No test runner detected".to_string());
        };

        #[cfg(target_os = "windows")]
        let output = tokio::process::Command::new("cmd")
            .args(["/C", test_cmd])
            .current_dir(project_path)
            .output()
            .await;

        #[cfg(not(target_os = "windows"))]
        let output = tokio::process::Command::new("sh")
            .args(["-c", test_cmd])
            .current_dir(project_path)
            .output()
            .await;

        match output {
            Ok(o) => {
                let stdout = String::from_utf8_lossy(&o.stdout);
                let stderr = String::from_utf8_lossy(&o.stderr);
                let combined = if stderr.is_empty() {
                    stdout.to_string()
                } else {
                    format!("{}\n--- stderr ---\n{}", stdout, stderr)
                };
                // Truncate to 10KB
                Ok(if combined.len() > 10_000 {
                    format!("{}...(truncated)", &combined[..10_000])
                } else {
                    combined
                })
            }
            Err(e) => Err(format!("Failed to run tests: {}", e)),
        }
    }

    /// Unified LLM chat helper — calls Ollama /api/chat
    async fn llm_chat(&self, model: &str, system: &str, prompt: &str) -> Result<String, String> {
        let body = serde_json::json!({
            "model": model,
            "messages": [
                { "role": "system", "content": system },
                { "role": "user", "content": prompt }
            ],
            "stream": false
        });

        let resp = self.http
            .post(format!("{}/api/chat", self.config.ollama_url))
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("Ollama request failed: {}", e))?;

        if !resp.status().is_success() {
            return Err(format!("Ollama returned status {}", resp.status()));
        }

        #[derive(Deserialize)]
        struct OllamaMessage {
            content: String,
        }
        #[derive(Deserialize)]
        struct OllamaChatResponse {
            message: OllamaMessage,
        }

        let parsed: OllamaChatResponse = resp.json().await
            .map_err(|e| format!("Failed to parse Ollama response: {}", e))?;

        Ok(parsed.message.content)
    }
}
