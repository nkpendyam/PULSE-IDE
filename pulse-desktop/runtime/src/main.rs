//! PULSE Runtime Kernel - Main Entry Point
//!
//! The kernel is the central authority of the PULSE platform.
//! It manages the event loop, state machine, capabilities, and all subsystems.

mod kernel;
mod state;
mod event;
mod capability;
mod scheduler;
mod resource;
mod sandbox;
mod storage;
mod api;
mod picoclaw;
mod policy;
mod metrics;
mod replay;

use clap::{Parser, Subcommand};
use kernel::Kernel;
use tracing::{info, error};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[derive(Parser)]
#[command(name = "pulse-kernel")]
#[command(about = "PULSE Runtime Kernel - Central Authority", long_about = None)]
#[command(version)]
struct Cli {
    #[command(subcommand)]
    command: Option<Commands>,
}

#[derive(Subcommand)]
enum Commands {
    /// Start the kernel and listen for connections
    Start {
        /// Socket path for JSON-RPC
        #[arg(short, long, default_value = "pulse.sock")]
        socket: String,
        /// Port for HTTP API (0 to disable)
        #[arg(short, long, default_value = "0")]
        port: u16,
        /// Enable WebSocket for PicoClaw bridge
        #[arg(long, default_value = "9876")]
        ws_port: u16,
        /// RAM budget in MB
        #[arg(long, default_value = "4096")]
        ram_budget: u64,
        /// Policy mode: off, review, agent
        #[arg(long, default_value = "review")]
        policy: String,
    },
    /// Check kernel health status
    Health {
        /// Socket path
        #[arg(short, long, default_value = "pulse.sock")]
        socket: String,
    },
    /// Stop a running kernel
    Stop {
        /// Socket path
        #[arg(short, long, default_value = "pulse.sock")]
        socket: String,
    },
    /// Replay a recorded session
    Replay {
        /// Path to recorded session file
        #[arg(short, long)]
        file: String,
    },
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize logging
    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::new(
            std::env::var("RUST_LOG").unwrap_or_else(|_| "info".into()),
        ))
        .with(tracing_subscriber::fmt::layer().json())
        .init();

    let cli = Cli::parse();

    match cli.command {
        Some(Commands::Start { socket, port, ws_port, ram_budget, policy }) => {
            info!(
                socket = %socket,
                port = port,
                ws_port = ws_port,
                ram_budget = ram_budget,
                policy = %policy,
                "Starting PULSE kernel"
            );

            let mut kernel = Kernel::new(kernel::KernelConfig {
                socket_path: socket,
                http_port: port,
                ws_port,
                ram_budget_mb: ram_budget,
                policy_mode: policy.parse().unwrap_or(policy::PolicyMode::Review),
            })?;

            // Initialize subsystems
            kernel.initialize().await?;

            // Run the main event loop
            if let Err(e) = kernel.run().await {
                error!(error = %e, "Kernel error");
                return Err(e);
            }
        }
        Some(Commands::Health { socket }) => {
            info!(socket = %socket, "Checking kernel health");
            let client = api::KernelClient::new(&socket);
            match client.health_check().await {
                Ok(status) => {
                    println!("{}", serde_json::to_string_pretty(&status)?);
                }
                Err(e) => {
                    error!(error = %e, "Health check failed");
                    std::process::exit(1);
                }
            }
        }
        Some(Commands::Stop { socket }) => {
            info!(socket = %socket, "Stopping kernel");
            let client = api::KernelClient::new(&socket);
            client.shutdown().await?;
            println!("Kernel shutdown initiated");
        }
        Some(Commands::Replay { file }) => {
            info!(file = %file, "Replaying session");
            let replay_engine = replay::ReplayEngine::new(&file)?;
            replay_engine.run().await?;
        }
        None => {
            // Default: start kernel with defaults
            let mut kernel = Kernel::new(kernel::KernelConfig::default())?;
            kernel.initialize().await?;
            kernel.run().await?;
        }
    }

    Ok(())
}
