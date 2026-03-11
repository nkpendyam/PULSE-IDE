//! Git Repository - Individual repository instance

use kyro_core::{KyroError, KyroResult};
use std::path::Path;

/// Git Repository
pub struct Repository {
    path: std::path::PathBuf,
    repo: git2::Repository,
}

impl Repository {
    /// Open a Git repository at the given path
    pub fn open(path: &Path) -> KyroResult<Self> {
        let repo = git2::Repository::open(path)
            .map_err(|e| KyroError::git(format!("Failed to open repository: {}", e)))?;

        Ok(Self {
            path: path.to_path_buf(),
            repo,
        })
    }

    /// Get the repository path
    pub fn path(&self) -> &Path {
        &self.path
    }

    /// Get the repository status
    pub fn status(&self) -> KyroResult<Vec<String>> {
        let statuses = self.repo.statuses(None)
            .map_err(|e| KyroError::git(format!("Failed to get status: {}", e)))?;

        let mut result = Vec::new();
        for entry in statuses.iter() {
            if let Some(path) = entry.path() {
                result.push(path.to_string());
            }
        }

        Ok(result)
    }

    /// Stage a file
    pub fn stage(&self, path: &Path) -> KyroResult<()> {
        let mut index = self.repo.index()
            .map_err(|e| KyroError::git(format!("Failed to get index: {}", e)))?;

        index.add_path(path)
            .map_err(|e| KyroError::git(format!("Failed to stage file: {}", e)))?;

        index.write()
            .map_err(|e| KyroError::git(format!("Failed to write index: {}", e)))?;

        Ok(())
    }

    /// Commit changes
    pub fn commit(&self, message: &str) -> KyroResult<String> {
        let mut index = self.repo.index()
            .map_err(|e| KyroError::git(format!("Failed to get index: {}", e)))?;

        let tree_id = index.write_tree()
            .map_err(|e| KyroError::git(format!("Failed to write tree: {}", e)))?;

        let tree = self.repo.find_tree(tree_id)
            .map_err(|e| KyroError::git(format!("Failed to find tree: {}", e)))?;

        let signature = self.repo.signature()
            .map_err(|e| KyroError::git(format!("Failed to get signature: {}", e)))?;

        let parent_commit = self.repo.head()
            .ok()
            .and_then(|head| head.peel_to_commit().ok());

        let parents = if let Some(ref parent) = parent_commit {
            vec![parent]
        } else {
            vec![]
        };

        let oid = self.repo.commit(
            Some("HEAD"),
            &signature,
            &signature,
            message,
            &tree,
            &parents,
        ).map_err(|e| KyroError::git(format!("Failed to commit: {}", e)))?;

        Ok(oid.to_string())
    }
}

#[cfg(all(test, feature = "fixme_tests"))]
mod tests {
    use super::*;

    #[test]
    fn test_repository_open_nonexistent() {
        let result = Repository::open(Path::new("/nonexistent/path"));
        assert!(result.is_err());
    }
}
