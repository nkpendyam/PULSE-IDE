//! Open VSX Registry Client
//!
//! Client for querying and downloading extensions from Open VSX Registry.
//! Open VSX is an open-source alternative to the VS Code Marketplace.
//!
//! Based on: https://github.com/eclipse/openvsx

use anyhow::{Result, Context, bail};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// Open VSX API base URL
const OPENVSX_API_URL: &str = "https://open-vsx.org/api";

/// Open VSX Registry client
#[derive(Debug, Clone)]
pub struct OpenVsxClient {
    client: reqwest::Client,
    api_url: String,
}

/// Search query parameters
#[derive(Debug, Clone, Default)]
pub struct OpenVsxQuery {
    pub search_text: Option<String>,
    pub category: Option<String>,
    pub namespace: Option<String>,
    pub extension: Option<String>,
    pub size: u32,
    pub offset: u32,
    pub sort_by: Option<String>,
    pub sort_order: Option<String>,
}

/// Extension from Open VSX
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenVsxExtension {
    pub namespace: String,
    pub name: String,
    pub version: String,
    pub display_name: Option<String>,
    pub description: Option<String>,
    pub publisher: OpenVsxPublisher,
    pub files: OpenVsxFiles,
    pub statistics: OpenVsxStatistics,
    pub categories: Vec<String>,
    pub tags: Vec<String>,
    pub license: Option<String>,
    pub repository: Option<String>,
    pub homepage: Option<String>,
    pub bug_tracker: Option<String>,
    pub readme: Option<String>,
    pub download_count: u64,
    pub review_count: u32,
    pub average_rating: Option<f32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenVsxPublisher {
    pub name: String,
    pub verified: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenVsxFiles {
    pub download: Option<String>,
    pub icon: Option<String>,
    pub readme: Option<String>,
    pub license: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenVsxStatistics {
    #[serde(default)]
    pub download_count: u64,
    #[serde(default)]
    pub review_count: u32,
    #[serde(default)]
    pub average_rating: Option<f32>,
}

/// Search result from Open VSX
#[derive(Debug, Clone, Serialize, Deserialize)]
struct SearchResponse {
    extensions: Vec<ExtensionData>,
    total_size: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ExtensionData {
    namespace: String,
    name: String,
    version: String,
    #[serde(default)]
    display_name: Option<String>,
    #[serde(default)]
    description: Option<String>,
    files: Option<FileData>,
    statistics: Option<StatisticsData>,
    #[serde(default)]
    categories: Vec<String>,
    #[serde(default)]
    tags: Vec<String>,
    #[serde(default)]
    license: Option<String>,
    #[serde(default)]
    repository: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct FileData {
    download: Option<String>,
    icon: Option<String>,
    readme: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct StatisticsData {
    #[serde(default)]
    download_count: u64,
}

impl OpenVsxClient {
    /// Create a new Open VSX client
    pub fn new() -> Self {
        Self {
            client: reqwest::Client::builder()
                .user_agent("KyroIDE/1.0")
                .build()
                .unwrap_or_else(|_| reqwest::Client::new()),
            api_url: OPENVSX_API_URL.to_string(),
        }
    }

    /// Create with custom API URL (for testing)
    pub fn with_url(api_url: String) -> Self {
        Self {
            client: reqwest::Client::new(),
            api_url,
        }
    }

    /// Search for extensions
    pub async fn search(&self, query: &OpenVsxQuery) -> Result<Vec<OpenVsxExtension>> {
        log::info!("Searching Open VSX: {:?}", query);

        let mut params = vec![];

        if let Some(ref text) = query.search_text {
            params.push(("query", text.as_str()));
        }

        if let Some(ref category) = query.category {
            params.push(("category", category.as_str()));
        }

        if let Some(ref namespace) = query.namespace {
            params.push(("namespace", namespace.as_str()));
        }

        params.push(("size", query.size.to_string().as_str()));
        params.push(("offset", query.offset.to_string().as_str()));

        if let Some(ref sort_by) = query.sort_by {
            params.push(("sortBy", sort_by.as_str()));
        }

        if let Some(ref sort_order) = query.sort_order {
            params.push(("sortOrder", sort_order.as_str()));
        }

        let url = format!("{}/-/search", self.api_url);
        
        let response = self.client
            .get(&url)
            .query(&params)
            .header("Accept", "application/json")
            .send()
            .await
            .context("Failed to query Open VSX")?;

        if !response.status().is_success() {
            bail!("Open VSX query failed: {}", response.status());
        }

        let search_response: SearchResponse = response.json().await
            .context("Failed to parse Open VSX response")?;

        let extensions = search_response.extensions.into_iter().map(|ext| {
            OpenVsxExtension {
                namespace: ext.namespace,
                name: ext.name,
                version: ext.version,
                display_name: ext.display_name,
                description: ext.description,
                publisher: OpenVsxPublisher {
                    name: ext.namespace.clone(),
                    verified: false,
                },
                files: OpenVsxFiles {
                    download: ext.files.as_ref().and_then(|f| f.download.clone()),
                    icon: ext.files.as_ref().and_then(|f| f.icon.clone()),
                    readme: ext.files.as_ref().and_then(|f| f.readme.clone()),
                    license: None,
                },
                statistics: OpenVsxStatistics {
                    download_count: ext.statistics.as_ref().map(|s| s.download_count).unwrap_or(0),
                    review_count: 0,
                    average_rating: None,
                },
                categories: ext.categories,
                tags: ext.tags,
                license: ext.license,
                repository: ext.repository,
                homepage: None,
                bug_tracker: None,
                readme: None,
                download_count: ext.statistics.as_ref().map(|s| s.download_count).unwrap_or(0),
                review_count: 0,
                average_rating: None,
            }
        }).collect();

        log::info!("Found {} extensions from Open VSX", extensions.len());
        Ok(extensions)
    }

    /// Get extension by namespace and name
    pub async fn get_extension(&self, namespace: &str, name: &str) -> Result<Option<OpenVsxExtension>> {
        let url = format!("{}/{}/{}", self.api_url, namespace, name);

        let response = self.client
            .get(&url)
            .header("Accept", "application/json")
            .send()
            .await?;

        if response.status() == 404 {
            return Ok(None);
        }

        if !response.status().is_success() {
            bail!("Failed to get extension: {}", response.status());
        }

        let ext_data: ExtensionData = response.json().await?;

        Ok(Some(OpenVsxExtension {
            namespace: ext_data.namespace,
            name: ext_data.name,
            version: ext_data.version,
            display_name: ext_data.display_name,
            description: ext_data.description,
            publisher: OpenVsxPublisher {
                name: ext_data.namespace.clone(),
                verified: false,
            },
            files: OpenVsxFiles {
                download: ext_data.files.as_ref().and_then(|f| f.download.clone()),
                icon: ext_data.files.as_ref().and_then(|f| f.icon.clone()),
                readme: ext_data.files.as_ref().and_then(|f| f.readme.clone()),
                license: None,
            },
            statistics: OpenVsxStatistics {
                download_count: ext_data.statistics.as_ref().map(|s| s.download_count).unwrap_or(0),
                review_count: 0,
                average_rating: None,
            },
            categories: ext_data.categories,
            tags: ext_data.tags,
            license: ext_data.license,
            repository: ext_data.repository,
            homepage: None,
            bug_tracker: None,
            readme: None,
            download_count: ext_data.statistics.as_ref().map(|s| s.download_count).unwrap_or(0),
            review_count: 0,
            average_rating: None,
        }))
    }

    /// Get specific version of an extension
    pub async fn get_extension_version(
        &self,
        namespace: &str,
        name: &str,
        version: &str,
    ) -> Result<Option<OpenVsxExtension>> {
        let url = format!("{}/{}/{}/{}", self.api_url, namespace, name, version);

        let response = self.client
            .get(&url)
            .header("Accept", "application/json")
            .send()
            .await?;

        if response.status() == 404 {
            return Ok(None);
        }

        if !response.status().is_success() {
            bail!("Failed to get extension version: {}", response.status());
        }

        let ext_data: ExtensionData = response.json().await?;

        Ok(Some(OpenVsxExtension {
            namespace: ext_data.namespace,
            name: ext_data.name,
            version: ext_data.version,
            display_name: ext_data.display_name,
            description: ext_data.description,
            publisher: OpenVsxPublisher {
                name: ext_data.namespace.clone(),
                verified: false,
            },
            files: OpenVsxFiles {
                download: ext_data.files.as_ref().and_then(|f| f.download.clone()),
                icon: ext_data.files.as_ref().and_then(|f| f.icon.clone()),
                readme: ext_data.files.as_ref().and_then(|f| f.readme.clone()),
                license: None,
            },
            statistics: OpenVsxStatistics {
                download_count: ext_data.statistics.as_ref().map(|s| s.download_count).unwrap_or(0),
                review_count: 0,
                average_rating: None,
            },
            categories: ext_data.categories,
            tags: ext_data.tags,
            license: ext_data.license,
            repository: ext_data.repository,
            homepage: None,
            bug_tracker: None,
            readme: None,
            download_count: ext_data.statistics.as_ref().map(|s| s.download_count).unwrap_or(0),
            review_count: 0,
            average_rating: None,
        }))
    }

    /// Download extension VSIX
    pub async fn download_extension(
        &self,
        namespace: &str,
        name: &str,
        version: &str,
    ) -> Result<PathBuf> {
        log::info!("Downloading Open VSX extension: {}/{}@{}", namespace, name, version);

        let url = format!(
            "{}/{}/{}/{}?targetPlatform=universal",
            self.api_url, namespace, name, version
        );

        let response = self.client
            .get(&url)
            .header("Accept", "application/octet-stream")
            .send()
            .await
            .context("Failed to download extension")?;

        if !response.status().is_success() {
            bail!("Extension download failed: {}", response.status());
        }

        // Save to temp file
        let temp_dir = std::env::temp_dir();
        let vsix_path = temp_dir.join(format!("{}-{}-{}.vsix", namespace, name, version));

        let bytes = response.bytes().await?;
        std::fs::write(&vsix_path, bytes)?;

        log::info!("Extension downloaded to: {:?}", vsix_path);
        Ok(vsix_path)
    }

    /// Download extension by URL
    pub async fn download_from_url(&self, url: &str) -> Result<PathBuf> {
        log::info!("Downloading extension from URL: {}", url);

        let response = self.client
            .get(url)
            .send()
            .await
            .context("Failed to download extension")?;

        if !response.status().is_success() {
            bail!("Extension download failed: {}", response.status());
        }

        // Extract filename from URL
        let filename = url.split('/')
            .last()
            .unwrap_or("extension.vsix");

        let temp_dir = std::env::temp_dir();
        let vsix_path = temp_dir.join(filename);

        let bytes = response.bytes().await?;
        std::fs::write(&vsix_path, bytes)?;

        log::info!("Extension downloaded to: {:?}", vsix_path);
        Ok(vsix_path)
    }

    /// Get popular extensions
    pub async fn get_popular(&self, count: u32) -> Result<Vec<OpenVsxExtension>> {
        let query = OpenVsxQuery {
            size: count,
            sort_by: Some("downloadCount".to_string()),
            sort_order: Some("desc".to_string()),
            ..Default::default()
        };

        self.search(&query).await
    }

    /// Get extensions by category
    pub async fn get_by_category(&self, category: &str, count: u32) -> Result<Vec<OpenVsxExtension>> {
        let query = OpenVsxQuery {
            category: Some(category.to_string()),
            size: count,
            ..Default::default()
        };

        self.search(&query).await
    }

    /// Get extensions by namespace (publisher)
    pub async fn get_by_namespace(&self, namespace: &str, count: u32) -> Result<Vec<OpenVsxExtension>> {
        let query = OpenVsxQuery {
            namespace: Some(namespace.to_string()),
            size: count,
            ..Default::default()
        };

        self.search(&query).await
    }
}

impl Default for OpenVsxClient {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    #[ignore] // Requires network access
    async fn test_search_openvsx() {
        let client = OpenVsxClient::new();
        let query = OpenVsxQuery {
            search_text: Some("python".to_string()),
            size: 10,
            ..Default::default()
        };

        let results = client.search(&query).await.unwrap();
        assert!(!results.is_empty());
    }

    #[tokio::test]
    #[ignore]
    async fn test_get_extension() {
        let client = OpenVsxClient::new();
        
        // Test with a known extension
        let ext = client.get_extension("vscodevim", "vim").await.unwrap();
        assert!(ext.is_some());
    }
}
