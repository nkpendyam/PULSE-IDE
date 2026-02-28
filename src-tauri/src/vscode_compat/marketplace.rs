//! VS Code Marketplace Client
//!
//! Client for querying and downloading extensions from VS Code Marketplace.

use anyhow::{Result, Context, bail};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::path::PathBuf;

/// Marketplace API base URL
const MARKETPLACE_API_URL: &str = "https://marketplace.visualstudio.com/_apis/public/gallery";
const MARKETPLACE_CDN_URL: &str = "https://marketplace.visualstudio.com/_apis/public/gallery/publishers";

/// Marketplace client
#[derive(Debug, Clone)]
pub struct MarketplaceClient {
    client: reqwest::Client,
    api_url: String,
}

/// Extension query parameters
#[derive(Debug, Clone, Default)]
pub struct ExtensionQuery {
    pub extension_id: Option<String>,
    pub publisher_name: Option<String>,
    pub extension_name: Option<String>,
    pub search_text: Option<String>,
    pub category: Option<String>,
    pub target: Option<String>,
    pub include_versions: bool,
    pub include_files: bool,
    pub include_category: bool,
    pub include_statistics: bool,
}

/// Extension result from marketplace
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarketplaceExtension {
    pub extension_id: String,
    pub extension_name: String,
    pub publisher_name: String,
    pub display_name: String,
    pub short_description: String,
    pub version: String,
    pub last_updated: String,
    pub download_count: u64,
    pub install_count: u64,
    pub average_rating: Option<f32>,
    pub rating_count: u32,
    pub categories: Vec<String>,
    pub tags: Vec<String>,
    pub icon_url: Option<String>,
    pub readme_url: Option<String>,
    pub license: Option<String>,
    pub repository: Option<String>,
}

/// Extension version
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExtensionVersion {
    pub version: String,
    pub last_updated: String,
    pub asset_uri: String,
    pub fallback_asset_uri: String,
    pub files: Vec<ExtensionFile>,
    pub properties: Vec<ExtensionProperty>,
}

/// Extension file
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExtensionFile {
    pub asset_type: String,
    pub source: String,
}

/// Extension property
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExtensionProperty {
    pub key: String,
    pub value: String,
}

/// Marketplace query response
#[derive(Debug, Clone, Serialize, Deserialize)]
struct QueryResponse {
    results: Vec<QueryResult>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct QueryResult {
    extensions: Vec<ExtensionData>,
    result_metadata: Option<Vec<ResultMetadata>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ExtensionData {
    extension_id: String,
    extension_name: String,
    display_name: String,
    short_description: String,
    publisher: PublisherData,
    versions: Vec<VersionData>,
    statistics: Option<Vec<StatisticData>>,
    categories: Option<Vec<String>>,
    tags: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct PublisherData {
    publisher_name: String,
    display_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct VersionData {
    version: String,
    last_updated: String,
    asset_uri: String,
    fallback_asset_uri: String,
    files: Vec<FileData>,
    properties: Option<Vec<PropertyData>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct FileData {
    asset_type: String,
    source: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct PropertyData {
    key: String,
    value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct StatisticData {
    statistic_name: String,
    value: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ResultMetadata {
    metadata_type: String,
    metadata_items: Vec<MetadataItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct MetadataItem {
    name: String,
    count: u64,
}

impl MarketplaceClient {
    /// Create a new marketplace client
    pub fn new() -> Self {
        Self {
            client: reqwest::Client::builder()
                .user_agent("KyroIDE/1.0")
                .build()
                .unwrap_or_else(|_| reqwest::Client::new()),
            api_url: MARKETPLACE_API_URL.to_string(),
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
    pub async fn search(&self, query: &ExtensionQuery) -> Result<Vec<MarketplaceExtension>> {
        log::info!("Searching marketplace: {:?}", query);
        
        // Build query payload
        let payload = self.build_query_payload(query);
        
        // Send request
        let response = self.client
            .post(format!("{}/extensionquery", self.api_url))
            .header("Accept", "application/json;api-version=6.0-preview.1")
            .header("Content-Type", "application/json")
            .json(&payload)
            .send()
            .await
            .context("Failed to query marketplace")?;
        
        if !response.status().is_success() {
            bail!("Marketplace query failed: {}", response.status());
        }
        
        let query_response: QueryResponse = response.json().await
            .context("Failed to parse marketplace response")?;
        
        // Parse results
        let extensions = self.parse_query_response(query_response);
        
        log::info!("Found {} extensions", extensions.len());
        Ok(extensions)
    }
    
    /// Get extension by ID
    pub async fn get_extension(&self, extension_id: &str) -> Result<Option<MarketplaceExtension>> {
        let query = ExtensionQuery {
            extension_id: Some(extension_id.to_string()),
            include_versions: true,
            include_files: true,
            ..Default::default()
        };
        
        let results = self.search(&query).await?;
        Ok(results.into_iter().next())
    }
    
    /// Download extension VSIX
    pub async fn download_extension(&self, publisher: &str, name: &str, version: &str) -> Result<PathBuf> {
        log::info!("Downloading extension: {}/{}@{}", publisher, name, version);
        
        // Construct download URL
        let url = format!(
            "https://marketplace.visualstudio.com/_apis/public/gallery/publishers/{}/vsextensions/{}/{}?targetPlatform=universal",
            publisher, name, version
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
        let vsix_path = temp_dir.join(format!("{}-{}-{}.vsix", publisher, name, version));
        
        let bytes = response.bytes().await?;
        std::fs::write(&vsix_path, bytes)?;
        
        log::info!("Extension downloaded to: {:?}", vsix_path);
        Ok(vsix_path)
    }
    
    /// Get extension readme
    pub async fn get_readme(&self, publisher: &str, name: &str, version: &str) -> Result<String> {
        let url = format!(
            "{}/{}/{}/README.md",
            MARKETPLACE_CDN_URL, publisher, name
        );
        
        let response = self.client
            .get(&url)
            .send()
            .await?;
        
        if response.status().is_success() {
            Ok(response.text().await?)
        } else {
            Ok("No readme available".to_string())
        }
    }
    
    /// Get popular extensions
    pub async fn get_popular(&self, count: u32) -> Result<Vec<MarketplaceExtension>> {
        let query = ExtensionQuery {
            include_statistics: true,
            ..Default::default()
        };
        
        let mut results = self.search(&query).await?;
        results.sort_by(|a, b| b.install_count.cmp(&a.install_count));
        results.truncate(count as usize);
        
        Ok(results)
    }
    
    /// Get extensions by category
    pub async fn get_by_category(&self, category: &str, count: u32) -> Result<Vec<MarketplaceExtension>> {
        let query = ExtensionQuery {
            category: Some(category.to_string()),
            include_category: true,
            ..Default::default()
        };
        
        let mut results = self.search(&query).await?;
        results.truncate(count as usize);
        
        Ok(results)
    }
    
    /// Build query payload
    fn build_query_payload(&self, query: &ExtensionQuery) -> serde_json::Value {
        let mut filters = vec![];
        
        // Build filter criteria
        let mut criteria = vec![];
        
        if let Some(ref id) = query.extension_id {
            criteria.push(json!({
                "filterType": 7,
                "value": id
            }));
        }
        
        if let Some(ref search) = query.search_text {
            criteria.push(json!({
                "filterType": 8,
                "value": search
            }));
        }
        
        if let Some(ref category) = query.category {
            criteria.push(json!({
                "filterType": 5,
                "value": category
            }));
        }
        
        if let Some(ref target) = query.target {
            criteria.push(json!({
                "filterType": 15,
                "value": target
            }));
        }
        
        // Default sort by install count
        criteria.push(json!({
            "filterType": 12,
            "value": "4096"
        }));
        
        // Build flags
        let mut flags = 0x1; // Include versions
        if query.include_files {
            flags |= 0x2;
        }
        if query.include_category {
            flags |= 0x4;
        }
        if query.include_statistics {
            flags |= 0x8;
        }
        
        filters.push(json!({
            "criteria": criteria,
            "pageSize": 100,
            "pageNumber": 1,
            "sortBy": 4, // Install count
            "sortOrder": 1 // Descending
        }));
        
        json!({
            "filters": filters,
            "assetTypes": [],
            "flags": flags
        })
    }
    
    /// Parse query response
    fn parse_query_response(&self, response: QueryResponse) -> Vec<MarketplaceExtension> {
        let mut extensions = Vec::new();
        
        for result in response.results {
            for ext in result.extensions {
                let latest_version = ext.versions.first();
                
                let install_count = ext.statistics.as_ref()
                    .and_then(|stats| stats.iter().find(|s| s.statistic_name == "install"))
                    .map(|s| s.value)
                    .unwrap_or(0);
                
                let download_count = ext.statistics.as_ref()
                    .and_then(|stats| stats.iter().find(|s| s.statistic_name == "downloadCount"))
                    .map(|s| s.value)
                    .unwrap_or(0);
                
                let average_rating = ext.statistics.as_ref()
                    .and_then(|stats| stats.iter().find(|s| s.statistic_name == "averagerating"))
                    .map(|s| s.value as f32);
                
                let rating_count = ext.statistics.as_ref()
                    .and_then(|stats| stats.iter().find(|s| s.statistic_name == "ratingcount"))
                    .map(|s| s.value as u32)
                    .unwrap_or(0);
                
                let icon_url = latest_version
                    .and_then(|v| v.files.iter().find(|f| f.asset_type == "Microsoft.VisualStudio.Services.Icons.Default"))
                    .map(|f| f.source.clone());
                
                let readme_url = latest_version
                    .and_then(|v| v.files.iter().find(|f| f.asset_type == "Microsoft.VisualStudio.Services.Content.Details"))
                    .map(|f| f.source.clone());
                
                let repository = latest_version
                    .and_then(|v| v.properties.as_ref())
                    .and_then(|props| props.iter().find(|p| p.key == "Microsoft.VisualStudio.Services.Links.Source"))
                    .map(|p| p.value.clone());
                
                extensions.push(MarketplaceExtension {
                    extension_id: ext.extension_id,
                    extension_name: ext.extension_name,
                    publisher_name: ext.publisher.publisher_name,
                    display_name: ext.display_name,
                    short_description: ext.short_description,
                    version: latest_version.map(|v| v.version.clone()).unwrap_or_default(),
                    last_updated: latest_version.map(|v| v.last_updated.clone()).unwrap_or_default(),
                    download_count,
                    install_count,
                    average_rating,
                    rating_count,
                    categories: ext.categories.unwrap_or_default(),
                    tags: ext.tags.unwrap_or_default(),
                    icon_url,
                    readme_url,
                    license: None,
                    repository,
                });
            }
        }
        
        extensions
    }
}

impl Default for MarketplaceClient {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[tokio::test]
    #[ignore] // Requires network access
    async fn test_search_extensions() {
        let client = MarketplaceClient::new();
        let query = ExtensionQuery {
            search_text: Some("python".to_string()),
            ..Default::default()
        };
        
        let results = client.search(&query).await.unwrap();
        assert!(!results.is_empty());
    }
    
    #[test]
    fn test_build_query_payload() {
        let client = MarketplaceClient::new();
        let query = ExtensionQuery {
            search_text: Some("rust".to_string()),
            include_statistics: true,
            ..Default::default()
        };
        
        let payload = client.build_query_payload(&query);
        assert!(payload["filters"].as_array().unwrap().len() > 0);
    }
}
