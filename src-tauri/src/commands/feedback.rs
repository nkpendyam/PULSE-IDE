//! Tauri commands for the Learning Flywheel (Feedback DB)

use crate::feedback::{FeedbackDB, FeedbackStats, Suggestion};
use tauri::command;

lazy_static::lazy_static! {
    static ref FEEDBACK_DB: Option<FeedbackDB> = FeedbackDB::open_default().ok();
}

fn db() -> Result<&'static FeedbackDB, String> {
    FEEDBACK_DB.as_ref().ok_or_else(|| "Feedback DB not initialised".to_string())
}

#[command]
pub fn feedback_log_suggestion(
    model: String,
    task_kind: String,
    prompt_hash: String,
    prompt_preview: String,
    response_preview: String,
    tokens_used: u32,
    latency_ms: u32,
) -> Result<i64, String> {
    db()?.log_suggestion(&model, &task_kind, &prompt_hash, &prompt_preview, &response_preview, tokens_used, latency_ms)
        .map_err(|e| e.to_string())
}

#[command]
pub fn feedback_accept(id: i64) -> Result<(), String> {
    db()?.accept(id).map_err(|e| e.to_string())
}

#[command]
pub fn feedback_reject(id: i64) -> Result<(), String> {
    db()?.reject(id).map_err(|e| e.to_string())
}

#[command]
pub fn feedback_correct(id: i64, user_fix: String) -> Result<(), String> {
    db()?.correct(id, &user_fix).map_err(|e| e.to_string())
}

#[command]
pub fn feedback_stats(model: Option<String>, task_kind: Option<String>) -> Result<FeedbackStats, String> {
    db()?.stats(model.as_deref(), task_kind.as_deref())
        .map_err(|e| e.to_string())
}

#[command]
pub fn feedback_recent(limit: Option<u32>) -> Result<Vec<Suggestion>, String> {
    db()?.recent(limit.unwrap_or(50))
        .map_err(|e| e.to_string())
}
