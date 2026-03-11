//! Git Manager - Manages Git repositories

use kyro_core::{KyroResult, Service};
use async_trait::async_trait;
use dashmap::DashMap;
use std::path::{Path, PathBuf};

/// Git Manager service
///
/// Note: git2::Repository is not Send/Sync, so we don't cache repository instances.
/// Instead, we open repositories on-demand for each operation.
pub struct GitManager {
    // Track which paths have been opened (for listing purposes)
    tracked_repos: DashMap<PathBuf, ()>,
}

impl GitManager {
    /// Create a new Git manager
    pub fn new() -> Self {
        Self {
            tracked_repos: DashMap::new(),
        }
    }

    /// Open a Git repository and perform an operation
    ///
    /// This opens the repository, performs the operation, and closes it.
    /// git2::Repository is not Send/Sync, so we can't store it across threads.
    pub async fn with_repo<F, R>(&self, path: &Path, f: F) -> KyroResult<R>
    where
        F: FnOnce(&crate::repository::Repository) -> KyroResult<R>,
    {
        let repo = crate::repository::Repository::open(path)?;
        self.tracked_repos.insert(path.to_path_buf(), ());
        f(&repo)
    }

    /// Close/untrack a Git repository
    pub async fn close_repo(&self, path: &Path) -> KyroResult<()> {
        if let Some((_, _)) = self.tracked_repos.remove(path) {
            log::info!("Untracked Git repository: {}", path.display());
        }
        Ok(())
    }

    /// List all tracked repositories
    pub fn list_repos(&self) -> Vec<PathBuf> {
        self.tracked_repos.iter().map(|e| e.key().clone()).collect()
    }
}

impl Default for GitManager {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Service for GitManager {
    fn name(&self) -> &str {
        "GitManager"
    }

    async fn init(&mut self) -> KyroResult<()> {
        log::info!("Initializing Git Manager");
        Ok(())
    }

    async fn shutdown(&mut self) -> KyroResult<()> {
        log::info!("Shutting down Git Manager");
        self.tracked_repos.clear();
        Ok(())
    }

    async fn health_check(&self) -> KyroResult<()> {
        Ok(())
    }
}

#[cfg(all(test, feature = "fixme_tests"))]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_git_manager() {
        let manager = GitManager::new();
        assert_eq!(manager.list_repos().len(), 0);
    }
}
