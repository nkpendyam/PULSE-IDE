//! App state management

use std::sync::Arc;
use tokio::sync::Mutex;

use crate::kernel::KernelClient;

/// Application state shared across Tauri commands
pub struct AppState {
    pub kernel: Mutex<KernelClient>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            kernel: Mutex::new(KernelClient::new("pulse.sock")),
        }
    }
}

impl Default for AppState {
    fn default() -> Self {
        Self::new()
    }
}
