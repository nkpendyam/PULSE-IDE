//! OAuth Integration
//! 
//! OAuth providers for social login (GitHub, Google, GitLab)
//! Based on standard OAuth 2.0 flows

use serde::{Deserialize, Serialize};

/// OAuth provider configuration
#[derive(Debug, Clone)]
pub struct OAuthConfig {
    pub github: Option<GitHubOAuthConfig>,
    pub google: Option<GoogleOAuthConfig>,
    pub gitlab: Option<GitLabOAuthConfig>,
}

/// GitHub OAuth configuration
#[derive(Debug, Clone)]
pub struct GitHubOAuthConfig {
    pub client_id: String,
    pub client_secret: String,
    pub redirect_uri: String,
}

/// Google OAuth configuration
#[derive(Debug, Clone)]
pub struct GoogleOAuthConfig {
    pub client_id: String,
    pub client_secret: String,
    pub redirect_uri: String,
}

/// GitLab OAuth configuration
#[derive(Debug, Clone)]
pub struct GitLabOAuthConfig {
    pub client_id: String,
    pub client_secret: String,
    pub redirect_uri: String,
    pub gitlab_url: String, // For self-hosted GitLab
}

/// OAuth provider types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum OAuthProvider {
    GitHub,
    Google,
    GitLab,
}

/// OAuth authorization URL response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OAuthAuthUrl {
    pub provider: OAuthProvider,
    pub url: String,
    pub state: String,
}

/// OAuth callback data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OAuthCallback {
    pub provider: OAuthProvider,
    pub code: String,
    pub state: String,
}

/// OAuth user profile from provider
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OAuthProfile {
    pub provider: OAuthProvider,
    pub provider_user_id: String,
    pub username: String,
    pub email: Option<String>,
    pub name: Option<String>,
    pub avatar_url: Option<String>,
}

/// OAuth manager
pub struct OAuthManager {
    config: OAuthConfig,
}

impl OAuthManager {
    pub fn new(config: OAuthConfig) -> Self {
        Self { config }
    }

    /// Generate authorization URL for provider
    pub fn get_authorization_url(&self, provider: &OAuthProvider) -> Option<OAuthAuthUrl> {
        let state = generate_state_token();

        match provider {
            OAuthProvider::GitHub => {
                let config = self.config.github.as_ref()?;
                let url = format!(
                    "https://github.com/login/oauth/authorize?client_id={}&redirect_uri={}&scope=user:email&state={}",
                    config.client_id,
                    urlencoding::encode(&config.redirect_uri),
                    state
                );
                Some(OAuthAuthUrl {
                    provider: provider.clone(),
                    url,
                    state,
                })
            }
            OAuthProvider::Google => {
                let config = self.config.google.as_ref()?;
                let url = format!(
                    "https://accounts.google.com/o/oauth2/v2/auth?client_id={}&redirect_uri={}&response_type=code&scope=email%20profile&state={}",
                    config.client_id,
                    urlencoding::encode(&config.redirect_uri),
                    state
                );
                Some(OAuthAuthUrl {
                    provider: provider.clone(),
                    url,
                    state,
                })
            }
            OAuthProvider::GitLab => {
                let config = self.config.gitlab.as_ref()?;
                let url = format!(
                    "{}/oauth/authorize?client_id={}&redirect_uri={}&response_type=code&scope=read_user&state={}",
                    config.gitlab_url,
                    config.client_id,
                    urlencoding::encode(&config.redirect_uri),
                    state
                );
                Some(OAuthAuthUrl {
                    provider: provider.clone(),
                    url,
                    state,
                })
            }
        }
    }

    /// Exchange authorization code for access token
    pub async fn exchange_code(&self, callback: OAuthCallback) -> anyhow::Result<OAuthProfile> {
        match callback.provider {
            OAuthProvider::GitHub => self.exchange_github_code(callback.code).await,
            OAuthProvider::Google => self.exchange_google_code(callback.code).await,
            OAuthProvider::GitLab => self.exchange_gitlab_code(callback.code).await,
        }
    }

    async fn exchange_github_code(&self, code: String) -> anyhow::Result<OAuthProfile> {
        let config = self.config.github.as_ref()
            .ok_or_else(|| anyhow::anyhow!("GitHub OAuth not configured"))?;

        // Exchange code for access token
        let token_url = "https://github.com/login/oauth/access_token";
        let client = reqwest::Client::new();
        
        let response = client.post(token_url)
            .header("Accept", "application/json")
            .json(&serde_json::json!({
                "client_id": config.client_id,
                "client_secret": config.client_secret,
                "code": code,
                "redirect_uri": config.redirect_uri,
            }))
            .send()
            .await?;

        #[derive(Deserialize)]
        struct TokenResponse {
            access_token: String,
        }

        let token: TokenResponse = response.json().await?;

        // Get user profile
        let user_response = client.get("https://api.github.com/user")
            .header("Authorization", format!("token {}", token.access_token))
            .header("User-Agent", "KYRO-IDE")
            .send()
            .await?;

        #[derive(Deserialize)]
        struct GitHubUser {
            id: i64,
            login: String,
            email: Option<String>,
            name: Option<String>,
            avatar_url: Option<String>,
        }

        let user: GitHubUser = user_response.json().await?;

        Ok(OAuthProfile {
            provider: OAuthProvider::GitHub,
            provider_user_id: user.id.to_string(),
            username: user.login,
            email: user.email,
            name: user.name,
            avatar_url: user.avatar_url,
        })
    }

    async fn exchange_google_code(&self, code: String) -> anyhow::Result<OAuthProfile> {
        let config = self.config.google.as_ref()
            .ok_or_else(|| anyhow::anyhow!("Google OAuth not configured"))?;

        let client = reqwest::Client::new();
        
        let response = client.post("https://oauth2.googleapis.com/token")
            .form(&[
                ("client_id", config.client_id.as_str()),
                ("client_secret", config.client_secret.as_str()),
                ("code", code.as_str()),
                ("redirect_uri", config.redirect_uri.as_str()),
                ("grant_type", "authorization_code"),
            ])
            .send()
            .await?;

        #[derive(Deserialize)]
        struct TokenResponse {
            access_token: String,
        }

        let token: TokenResponse = response.json().await?;

        let user_response = client.get("https://www.googleapis.com/oauth2/v2/userinfo")
            .header("Authorization", format!("Bearer {}", token.access_token))
            .send()
            .await?;

        #[derive(Deserialize)]
        struct GoogleUser {
            id: String,
            email: String,
            name: Option<String>,
            picture: Option<String>,
        }

        let user: GoogleUser = user_response.json().await?;

        Ok(OAuthProfile {
            provider: OAuthProvider::Google,
            provider_user_id: user.id,
            username: user.email.split('@').next().unwrap_or("user").to_string(),
            email: Some(user.email),
            name: user.name,
            avatar_url: user.picture,
        })
    }

    async fn exchange_gitlab_code(&self, code: String) -> anyhow::Result<OAuthProfile> {
        let config = self.config.gitlab.as_ref()
            .ok_or_else(|| anyhow::anyhow!("GitLab OAuth not configured"))?;

        let client = reqwest::Client::new();
        let token_url = format!("{}/oauth/token", config.gitlab_url);
        
        let response = client.post(&token_url)
            .form(&[
                ("client_id", config.client_id.as_str()),
                ("client_secret", config.client_secret.as_str()),
                ("code", code.as_str()),
                ("redirect_uri", config.redirect_uri.as_str()),
                ("grant_type", "authorization_code"),
            ])
            .send()
            .await?;

        #[derive(Deserialize)]
        struct TokenResponse {
            access_token: String,
        }

        let token: TokenResponse = response.json().await?;

        let user_url = format!("{}/api/v4/user", config.gitlab_url);
        let user_response = client.get(&user_url)
            .header("Authorization", format!("Bearer {}", token.access_token))
            .send()
            .await?;

        #[derive(Deserialize)]
        struct GitLabUser {
            id: i64,
            username: String,
            email: Option<String>,
            name: Option<String>,
            avatar_url: Option<String>,
        }

        let user: GitLabUser = user_response.json().await?;

        Ok(OAuthProfile {
            provider: OAuthProvider::GitLab,
            provider_user_id: user.id.to_string(),
            username: user.username,
            email: user.email,
            name: user.name,
            avatar_url: user.avatar_url,
        })
    }
}

/// Generate a secure state token for OAuth
fn generate_state_token() -> String {
    use rand::Rng;
    let mut rng = rand::thread_rng();
    (0..32)
        .map(|_| rng.sample(rand::distributions::Alphanumeric) as char)
        .collect()
}

/// URL encoding helper
mod urlencoding {
    pub fn encode(s: &str) -> String {
        urlencoding::encode(s).into_owned()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_state_token_generation() {
        let state = generate_state_token();
        assert_eq!(state.len(), 32);
        assert!(state.chars().all(|c| c.is_alphanumeric()));
    }
}
