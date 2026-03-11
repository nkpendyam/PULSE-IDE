//! GitHub-Based Extension Marketplace
//!
//! A fully open source extension marketplace that uses GitHub as the backend
//! instead of Microsoft's proprietary VS Code Marketplace.
//!
//! ## How It Works
//! 1. Extensions are GitHub repositories with `kyro-extension.yaml`
//! 2. Discovery via GitHub Topics (kyro-extension, vscode-extension)
//! 3. Ratings = GitHub Stars
//! 4. Versions = GitHub Releases
//! 5. Updates = Git Pull
//!
//! ## Benefits
//! - No Microsoft dependency
//! - Full transparency (all code visible)
//! - Community-driven (PRs, Issues, Discussions)
//! - Free hosting (GitHub)
//! - No API rate limits for public repos

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use chrono::{DateTime, Utc};

/// GitHub-based extension registry
pub struct GitHubMarketplace {
    /// GitHub API client
    client: reqwest::Client,
    /// Cache of extensions
    cache: HashMap<String, GitHubExtension>,
    /// Cache timestamp
    cache_updated: Option<DateTime<Utc>>,
}

impl GitHubMarketplace {
    /// Create new marketplace
    pub fn new() -> Self {
        Self {
            client: reqwest::Client::new(),
            cache: HashMap::new(),
            cache_updated: None,
        }
    }
    
    /// Search extensions by GitHub topics
    pub async fn search(&self, query: &str) -> anyhow::Result<Vec<GitHubExtension>> {
        let url = format!(
            "https://api.github.com/search/repositories?q=topic:kyro-extension+{}&sort=stars&order=desc&per_page=20",
            urlencoding::encode(query)
        );
        let response = self.client
            .get(&url)
            .header("Accept", "application/vnd.github.v3+json")
            .header("User-Agent", "Kyro-IDE")
            .timeout(std::time::Duration::from_secs(15))
            .send()
            .await?;

        if !response.status().is_success() {
            anyhow::bail!("GitHub API returned status: {}", response.status());
        }

        let json: serde_json::Value = response.json().await?;
        let items = json.get("items").and_then(|v| v.as_array());

        let extensions = items
            .map(|arr| {
                arr.iter()
                    .filter_map(|item| Self::parse_repo_item(item))
                    .collect()
            })
            .unwrap_or_default();

        Ok(extensions)
    }
    
    /// Get extension details from GitHub
    pub async fn get_extension(&self, owner: &str, repo: &str) -> anyhow::Result<GitHubExtension> {
        let url = format!("https://api.github.com/repos/{}/{}", owner, repo);
        let response = self.client
            .get(&url)
            .header("Accept", "application/vnd.github.v3+json")
            .header("User-Agent", "Kyro-IDE")
            .timeout(std::time::Duration::from_secs(15))
            .send()
            .await?;

        if !response.status().is_success() {
            anyhow::bail!("GitHub API returned status: {}", response.status());
        }

        let item: serde_json::Value = response.json().await?;
        Self::parse_repo_item(&item)
            .ok_or_else(|| anyhow::anyhow!("Failed to parse repository data"))
    }
    
    /// Get extension versions from GitHub Releases
    pub async fn get_versions(&self, owner: &str, repo: &str) -> anyhow::Result<Vec<ExtensionVersion>> {
        let url = format!("https://api.github.com/repos/{}/{}/releases?per_page=20", owner, repo);
        let response = self.client
            .get(&url)
            .header("Accept", "application/vnd.github.v3+json")
            .header("User-Agent", "Kyro-IDE")
            .timeout(std::time::Duration::from_secs(15))
            .send()
            .await?;

        if !response.status().is_success() {
            anyhow::bail!("GitHub API returned status: {}", response.status());
        }

        let releases: Vec<serde_json::Value> = response.json().await?;
        let versions = releases
            .iter()
            .filter_map(|release| {
                let tag = release.get("tag_name")?.as_str()?;
                let version = tag.strip_prefix('v').unwrap_or(tag).to_string();
                let published = release.get("published_at")
                    .and_then(|v| v.as_str())
                    .and_then(|s| s.parse::<DateTime<Utc>>().ok())
                    .unwrap_or_else(Utc::now);
                let body = release.get("body").and_then(|v| v.as_str()).map(String::from);
                let assets = release.get("assets")
                    .and_then(|v| v.as_array())
                    .map(|arr| {
                        arr.iter()
                            .filter_map(|a| {
                                Some(ReleaseAsset {
                                    name: a.get("name")?.as_str()?.to_string(),
                                    url: a.get("browser_download_url")?.as_str()?.to_string(),
                                    size: a.get("size")?.as_u64()?,
                                })
                            })
                            .collect()
                    })
                    .unwrap_or_default();

                Some(ExtensionVersion {
                    version,
                    published_at: published,
                    release_notes: body,
                    assets,
                })
            })
            .collect();

        Ok(versions)
    }
    
    /// Download extension from GitHub Release
    pub async fn download(&self, owner: &str, repo: &str, version: &str) -> anyhow::Result<Vec<u8>> {
        // First get the release to find the VSIX asset
        let tag = if version.starts_with('v') { version.to_string() } else { format!("v{}", version) };
        let url = format!("https://api.github.com/repos/{}/{}/releases/tags/{}", owner, repo, tag);
        let response = self.client
            .get(&url)
            .header("Accept", "application/vnd.github.v3+json")
            .header("User-Agent", "Kyro-IDE")
            .timeout(std::time::Duration::from_secs(15))
            .send()
            .await?;

        if !response.status().is_success() {
            anyhow::bail!("Release {} not found for {}/{}", tag, owner, repo);
        }

        let release: serde_json::Value = response.json().await?;
        let assets = release.get("assets").and_then(|v| v.as_array())
            .ok_or_else(|| anyhow::anyhow!("No assets in release"))?;

        // Look for a .vsix or .zip asset
        let asset_url = assets.iter()
            .filter_map(|a| {
                let name = a.get("name")?.as_str()?;
                if name.ends_with(".vsix") || name.ends_with(".zip") {
                    a.get("browser_download_url")?.as_str().map(String::from)
                } else {
                    None
                }
            })
            .next()
            .ok_or_else(|| anyhow::anyhow!("No .vsix or .zip asset found in release"))?;

        let bytes = self.client
            .get(&asset_url)
            .header("User-Agent", "Kyro-IDE")
            .timeout(std::time::Duration::from_secs(60))
            .send()
            .await?
            .bytes()
            .await?;

        Ok(bytes.to_vec())
    }
    
    /// Get featured extensions (top by stars)
    pub async fn featured(&self) -> anyhow::Result<Vec<GitHubExtension>> {
        self.search("").await
    }
    
    /// Get trending extensions (most stars in last week)
    pub async fn trending(&self) -> anyhow::Result<Vec<GitHubExtension>> {
        let week_ago = (Utc::now() - chrono::Duration::days(7)).format("%Y-%m-%d");
        let url = format!(
            "https://api.github.com/search/repositories?q=topic:kyro-extension+created:>={}&sort=stars&order=desc&per_page=20",
            week_ago
        );
        let response = self.client
            .get(&url)
            .header("Accept", "application/vnd.github.v3+json")
            .header("User-Agent", "Kyro-IDE")
            .timeout(std::time::Duration::from_secs(15))
            .send()
            .await?;

        if !response.status().is_success() {
            anyhow::bail!("GitHub API returned status: {}", response.status());
        }

        let json: serde_json::Value = response.json().await?;
        let items = json.get("items").and_then(|v| v.as_array());

        let extensions = items
            .map(|arr| arr.iter().filter_map(|item| Self::parse_repo_item(item)).collect())
            .unwrap_or_default();

        Ok(extensions)
    }

    /// Parse a GitHub API repository item into a GitHubExtension
    fn parse_repo_item(item: &serde_json::Value) -> Option<GitHubExtension> {
        let full_name = item.get("full_name")?.as_str()?;
        let name = item.get("name").and_then(|v| v.as_str()).unwrap_or(full_name);
        let owner = item.get("owner")
            .and_then(|o| o.get("login"))
            .and_then(|v| v.as_str())
            .unwrap_or("unknown");
        let description = item.get("description").and_then(|v| v.as_str()).unwrap_or("");
        let html_url = item.get("html_url").and_then(|v| v.as_str()).unwrap_or("");
        let stars = item.get("stargazers_count").and_then(|v| v.as_u64()).unwrap_or(0);
        let topics = item.get("topics")
            .and_then(|v| v.as_array())
            .map(|arr| arr.iter().filter_map(|t| t.as_str().map(String::from)).collect())
            .unwrap_or_default();
        let license = item.get("license")
            .and_then(|l| l.get("spdx_id"))
            .and_then(|v| v.as_str())
            .map(String::from);
        let updated = item.get("updated_at")
            .and_then(|v| v.as_str())
            .and_then(|s| s.parse::<DateTime<Utc>>().ok())
            .unwrap_or_else(Utc::now);

        Some(GitHubExtension {
            id: full_name.to_string(),
            name: name.to_string(),
            publisher: owner.to_string(),
            repository: html_url.to_string(),
            description: description.to_string(),
            version: "latest".to_string(),
            stars,
            downloads: 0, // GitHub API doesn't expose download counts for repos
            topics,
            license,
            verified: stars > 1000, // Treat high-star repos as verified
            last_updated: updated,
        })
    }
}

impl Default for GitHubMarketplace {
    fn default() -> Self {
        Self::new()
    }
}

/// Extension from GitHub repository
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubExtension {
    /// Extension ID (owner/repo)
    pub id: String,
    /// Display name
    pub name: String,
    /// Publisher/owner
    pub publisher: String,
    /// Repository URL
    pub repository: String,
    /// Description
    pub description: String,
    /// Current version
    pub version: String,
    /// GitHub stars (serves as rating)
    pub stars: u64,
    /// Download count
    pub downloads: u64,
    /// GitHub topics (categories)
    pub topics: Vec<String>,
    /// License
    pub license: Option<String>,
    /// Verified publisher (checkmark)
    pub verified: bool,
    /// Last updated
    pub last_updated: DateTime<Utc>,
}

/// Extension version from GitHub Release
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExtensionVersion {
    /// Version string
    pub version: String,
    /// Publish date
    pub published_at: DateTime<Utc>,
    /// Release notes
    pub release_notes: Option<String>,
    /// Release assets
    pub assets: Vec<ReleaseAsset>,
}

/// GitHub Release Asset
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReleaseAsset {
    /// Asset name
    pub name: String,
    /// Download URL
    pub url: String,
    /// File size
    pub size: u64,
}

/// Extension manifest (kyro-extension.yaml)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExtensionManifest {
    /// Extension ID
    pub id: String,
    /// Display name
    pub name: String,
    /// Version
    pub version: String,
    /// Description
    pub description: String,
    /// Publisher
    pub publisher: String,
    /// Repository URL
    pub repository: String,
    /// Categories
    pub categories: Vec<String>,
    /// Keywords
    pub keywords: Vec<String>,
    /// Extension icon
    pub icon: Option<String>,
    /// Entry point
    pub main: Option<String>,
    /// Browser entry
    pub browser: Option<String>,
    /// Activation events
    #[serde(rename = "activationEvents")]
    pub activation_events: Vec<String>,
    /// Contributes
    pub contributes: ExtensionContributes,
    /// Dependencies
    pub dependencies: Vec<String>,
}

/// Extension contributions
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExtensionContributes {
    /// Commands
    pub commands: Vec<CommandContribution>,
    /// Languages
    pub languages: Vec<LanguageContribution>,
    /// Themes
    pub themes: Vec<ThemeContribution>,
    /// Keybindings
    pub keybindings: Vec<KeybindingContribution>,
    /// Configuration
    pub configuration: Option<serde_json::Value>,
}

/// Command contribution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommandContribution {
    pub command: String,
    pub title: String,
    pub category: Option<String>,
    pub icon: Option<String>,
}

/// Language contribution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LanguageContribution {
    pub id: String,
    pub extensions: Vec<String>,
    pub aliases: Option<Vec<String>>,
}

/// Theme contribution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThemeContribution {
    pub label: String,
    pub path: String,
    pub ui_theme: Option<String>,
}

/// Keybinding contribution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeybindingContribution {
    pub command: String,
    pub key: String,
    pub when: Option<String>,
}

#[cfg(all(test, feature = "fixme_tests"))]
mod tests {
    use super::*;
    
    #[test]
    fn test_marketplace_creation() {
        let marketplace = GitHubMarketplace::new();
        assert!(marketplace.cache.is_empty());
    }
}
