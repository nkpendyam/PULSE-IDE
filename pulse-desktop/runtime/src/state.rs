//! PULSE Runtime Kernel - State Machine
//!
//! Manages kernel lifecycle states with valid transitions.

use anyhow::{Result, bail};
use serde::{Serialize, Deserialize};

/// Kernel states
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum KernelState {
    /// Initial boot state
    Boot,
    /// Initializing subsystems
    Initializing,
    /// Normal operation
    Running,
    /// Paused - no event processing
    Paused,
    /// Shutting down
    ShuttingDown,
    /// Fully stopped
    Shutdown,
}

impl Default for KernelState {
    fn default() -> Self {
        Self::Boot
    }
}

impl std::fmt::Display for KernelState {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{:?}", self)
    }
}

/// State transition record
#[derive(Debug, Clone)]
pub struct StateTransition {
    pub from: KernelState,
    pub to: KernelState,
    pub timestamp: chrono::DateTime<chrono::Utc>,
}

/// State machine managing kernel lifecycle
pub struct StateMachine {
    current: KernelState,
    history: Vec<StateTransition>,
}

impl StateMachine {
    /// Create a new state machine starting at Boot
    pub fn new() -> Self {
        Self {
            current: KernelState::Boot,
            history: Vec::new(),
        }
    }

    /// Get current state
    pub fn current_state(&self) -> KernelState {
        self.current
    }

    /// Check if transition is valid
    pub fn can_transition(&self, to: KernelState) -> bool {
        Self::is_valid_transition(self.current, to)
    }

    /// Perform state transition
    pub fn transition(&mut self, to: KernelState) -> Result<()> {
        if !self.can_transition(to) {
            bail!(
                "Invalid state transition: {} -> {}",
                self.current,
                to
            );
        }

        let from = self.current;
        self.current = to;

        self.history.push(StateTransition {
            from,
            to,
            timestamp: chrono::Utc::now(),
        });

        tracing::info!(
            from = %from,
            to = %to,
            "State transition"
        );

        Ok(())
    }

    /// Check if a transition between two states is valid
    fn is_valid_transition(from: KernelState, to: KernelState) -> bool {
        matches!(
            (from, to),
            // Normal startup flow
            (KernelState::Boot, KernelState::Initializing) |
            (KernelState::Initializing, KernelState::Running) |

            // Running <-> Paused
            (KernelState::Running, KernelState::Paused) |
            (KernelState::Paused, KernelState::Running) |

            // Shutdown paths
            (KernelState::Running, KernelState::ShuttingDown) |
            (KernelState::Paused, KernelState::ShuttingDown) |
            (KernelState::ShuttingDown, KernelState::Shutdown) |

            // Restart path
            (KernelState::Shutdown, KernelState::Boot)
        )
    }

    /// Get transition history
    pub fn history(&self) -> &[StateTransition] {
        &self.history
    }

    /// Check if kernel is operational (can process events)
    pub fn is_operational(&self) -> bool {
        matches!(self.current, KernelState::Running)
    }

    /// Check if kernel is shutting down
    pub fn is_shutting_down(&self) -> bool {
        matches!(self.current, KernelState::ShuttingDown | KernelState::Shutdown)
    }
}

impl Default for StateMachine {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_valid_transitions() {
        let mut sm = StateMachine::new();
        assert!(sm.can_transition(KernelState::Initializing));
        assert!(!sm.can_transition(KernelState::Running));

        sm.transition(KernelState::Initializing).unwrap();
        assert!(sm.can_transition(KernelState::Running));
        assert!(!sm.can_transition(KernelState::Boot));

        sm.transition(KernelState::Running).unwrap();
        assert!(sm.can_transition(KernelState::Paused));
        assert!(sm.can_transition(KernelState::ShuttingDown));
    }

    #[test]
    fn test_pause_resume() {
        let mut sm = StateMachine::new();
        sm.transition(KernelState::Initializing).unwrap();
        sm.transition(KernelState::Running).unwrap();
        sm.transition(KernelState::Paused).unwrap();
        assert_eq!(sm.current_state(), KernelState::Paused);
        sm.transition(KernelState::Running).unwrap();
        assert_eq!(sm.current_state(), KernelState::Running);
    }

    #[test]
    fn test_invalid_transition() {
        let mut sm = StateMachine::new();
        assert!(sm.transition(KernelState::Running).is_err());
    }
}
