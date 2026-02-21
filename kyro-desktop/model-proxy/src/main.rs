//! PULSE Model Proxy - Lightweight model routing with hot-swap
//!
//! Provides a unified REST API for model inference with memory-aware loading.

mod proxy;
mod router;
mod memory;
mod api;

use clap::Parser;
use tracing::{info, error};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[derive(Parser)]
#[command(name = "pulse-model-proxy")]
#[command(about = "PULSE Model Proxy - Lightweight model routing", long_about = None)]
#[command(version)]
struct Cli {
    /// HTTP port
    #[arg(short, long, default_value = "8080")]
    port: u16,

    /// RAM budget in MB
    #[arg(long, default_value = "4096")]
    ram_budget: u64,

    /// Model cache directory
    #[arg(long, default_value = "./models")]
    model_dir: String,

    /// Ollama host (if using Ollama backend)
    #[arg(long, default_value = "http://localhost:11434")]
    ollama_host: String,

    /// Enable external API fallback
    #[arg(long)]
    enable_external: bool,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::new(
            std::env::var("RUST_LOG").unwrap_or_else(|_| "info".into()),
        ))
        .with(tracing_subscriber::fmt::layer())
        .init();

    let cli = Cli::parse();

    info!(
        port = cli.port,
        ram_budget_mb = cli.ram_budget,
        model_dir = %cli.model_dir,
        "Starting PULSE Model Proxy"
    );

    // Create proxy
    let proxy = proxy::ModelProxy::new(proxy::ProxyConfig {
        ram_budget_mb: cli.ram_budget,
        model_dir: cli.model_dir,
        ollama_host: cli.ollama_host,
        enable_external: cli.enable_external,
    })?;

    // Start API server
    api::start_server(cli.port, proxy).await?;

    Ok(())
}
