//! API - REST API for model proxy

use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
    routing::{get, post},
    Router,
};
use serde::{Serialize, Deserialize};
use std::sync::Arc;
use tower_http::cors::{Any, CorsLayer};
use tracing::info;

use super::proxy::{ModelProxy, InferenceRequest, InferenceResponse, ModelInfo};

/// API state
pub struct AppState {
    pub proxy: ModelProxy,
}

/// Start the API server
pub async fn start_server(port: u16, proxy: ModelProxy) -> anyhow::Result<()> {
    let state = Arc::new(AppState { proxy });

    let app = Router::new()
        .route("/health", get(health))
        .route("/models", get(list_models))
        .route("/models/:name", get(get_model))
        .route("/models/:name/load", post(load_model))
        .route("/models/:name/unload", post(unload_model))
        .route("/inference", post(inference))
        .route("/memory", get(memory_status))
        .layer(CorsLayer::new().allow_origin(Any).allow_methods(Any))
        .with_state(state);

    let addr = format!("127.0.0.1:{}", port);
    info!("Model proxy API listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(&addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

/// Health check
async fn health() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "status": "healthy",
        "service": "pulse-model-proxy",
        "version": env!("CARGO_PKG_VERSION")
    }))
}

/// List all models
async fn list_models(
    State(state): State<Arc<AppState>>,
) -> Json<Vec<ModelInfo>> {
    let models = state.proxy.list_models().await;
    Json(models)
}

/// Get specific model info
async fn get_model(
    State(state): State<Arc<AppState>>,
    Path(name): Path<String>,
) -> Result<Json<ModelInfo>, StatusCode> {
    match state.proxy.get_model_info(&name).await {
        Some(info) => Ok(Json(info)),
        None => Err(StatusCode::NOT_FOUND),
    }
}

/// Load a model
async fn load_model(
    State(state): State<Arc<AppState>>,
    Path(name): Path<String>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    match state.proxy.load_model(&name).await {
        Ok(_) => Ok(Json(serde_json::json!({
            "success": true,
            "model": name
        }))),
        Err(e) => {
            tracing::error!("Failed to load model: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

/// Unload a model
async fn unload_model(
    State(state): State<Arc<AppState>>,
    Path(name): Path<String>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    match state.proxy.unload_model(&name).await {
        Ok(_) => Ok(Json(serde_json::json!({
            "success": true,
            "model": name
        }))),
        Err(e) => {
            tracing::error!("Failed to unload model: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

/// Run inference
async fn inference(
    State(state): State<Arc<AppState>>,
    Json(request): Json<InferenceRequest>,
) -> Result<Json<InferenceResponse>, StatusCode> {
    match state.proxy.infer(request).await {
        Ok(response) => Ok(Json(response)),
        Err(e) => {
            tracing::error!("Inference failed: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

/// Get memory status
async fn memory_status(
    State(state): State<Arc<AppState>>,
) -> Json<super::memory::MemoryStatus> {
    let status = state.proxy.memory_status().await;
    Json(status)
}
