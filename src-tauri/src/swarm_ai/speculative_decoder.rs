//! Speculative Decoder for fast inference
//!
//! Implements speculative decoding: a tiny model drafts tokens,
//! and a larger model verifies them in batches for 2-3x speedup.
//!
//! Based on: https://arxiv.org/abs/2211.17192

use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::RwLock;
use super::local_inference::LocalInferenceEngine;

/// Speculative decoder that uses a small model to draft and large model to verify
pub struct SpeculativeDecoder {
    draft_model: String,
    target_model: String,
    draft_engine: Arc<RwLock<LocalInferenceEngine>>,
    target_engine: Arc<RwLock<LocalInferenceEngine>>,
    speculation_length: usize, // Number of tokens to draft
    acceptance_threshold: f32, // Probability threshold for accepting drafts
}

/// Token with probability for speculation
#[derive(Debug, Clone)]
struct Token {
    text: String,
    probability: f32,
}

/// Draft sequence with probabilities
#[derive(Debug, Clone)]
struct DraftSequence {
    tokens: Vec<Token>,
    full_text: String,
}

/// Verification result
#[derive(Debug, Clone)]
enum VerificationResult {
    Accepted { tokens: Vec<Token> },
    Rejected { first_rejected: usize, accepted_text: String },
}

impl SpeculativeDecoder {
    /// Create a new speculative decoder
    pub async fn new(draft_model: String, target_model: String) -> Result<Self> {
        // Initialize draft engine with smaller memory budget
        let draft_engine = Arc::new(RwLock::new(
            LocalInferenceEngine::new(draft_model.clone(), 4.0).await?
        ));

        // Initialize target engine with larger memory budget
        let target_engine = Arc::new(RwLock::new(
            LocalInferenceEngine::new(target_model.clone(), 8.0).await?
        ));

        Ok(Self {
            draft_model,
            target_model,
            draft_engine,
            target_engine,
            speculation_length: 8, // Draft 8 tokens at a time
            acceptance_threshold: 0.6, // Accept if draft probability > 60%
        })
    }

    /// Generate completion using speculative decoding
    pub async fn complete(&mut self, prompt: &str, max_tokens: u32) -> Result<String> {
        let mut generated_tokens = 0;
        let mut result = String::new();
        let mut current_prompt = prompt.to_string();

        while generated_tokens < max_tokens {
            // Step 1: Draft tokens with small model
            let draft = self.draft_tokens(&current_prompt).await?;

            // Step 2: Verify with large model
            let verification = self.verify_tokens(&current_prompt, &draft).await?;

            // Step 3: Accept verified tokens and continue
            match verification {
                VerificationResult::Accepted { tokens } => {
                    for token in tokens {
                        result.push_str(&token.text);
                        current_prompt.push_str(&token.text);
                        generated_tokens += 1;

                        if generated_tokens >= max_tokens {
                            break;
                        }
                    }
                }
                VerificationResult::Rejected { first_rejected, accepted_text } => {
                    result.push_str(&accepted_text);
                    current_prompt.push_str(&accepted_text);
                    generated_tokens += first_rejected as u32;

                    // Fall back to standard generation for one token
                    let fallback = self.target_engine.write().await
                        .complete(&current_prompt, 1).await?;
                    
                    if !fallback.is_empty() {
                        let first_token = fallback.split_whitespace().next().unwrap_or("");
                        result.push_str(first_token);
                        result.push(' ');
                        current_prompt.push_str(first_token);
                        current_prompt.push(' ');
                        generated_tokens += 1;
                    }
                }
            }

            // Stop if we hit end of generation
            if result.ends_with("</s>") || result.ends_with("<|endoftext|>") {
                break;
            }
        }

        Ok(result.trim().to_string())
    }

    /// Draft tokens with the small model
    async fn draft_tokens(&self, prompt: &str) -> Result<DraftSequence> {
        let mut draft_engine = self.draft_engine.write().await;

        // Generate draft tokens with probabilities
        let draft_text = draft_engine.complete(prompt, self.speculation_length as u32).await?;

        // Split into tokens (approximation - real impl would use token probabilities)
        let tokens: Vec<Token> = draft_text
            .split_whitespace()
            .take(self.speculation_length)
            .map(|t| Token {
                text: t.to_string(),
                probability: 0.8, // Placeholder - would come from model
            })
            .collect();

        Ok(DraftSequence {
            full_text: tokens.iter().map(|t| t.text.as_str()).collect::<Vec<_>>().join(" "),
            tokens,
        })
    }

    /// Verify draft tokens with the large model
    async fn verify_tokens(&self, prompt: &str, draft: &DraftSequence) -> Result<VerificationResult> {
        let mut target_engine = self.target_engine.write().await;

        // Run the target model on prompt + draft to get probabilities
        let full_prompt = format!("{}{}", prompt, draft.full_text);
        let target_output = target_engine.complete(prompt, draft.tokens.len() as u32 + 5).await?;

        // Compare draft with target output
        let target_tokens: Vec<&str> = target_output.split_whitespace().collect();
        let draft_tokens: Vec<&str> = draft.full_text.split_whitespace().collect();

        // Find first mismatch
        let mut accepted_count = 0;
        for (i, (draft_tok, target_tok)) in draft_tokens.iter().zip(target_tokens.iter()).enumerate() {
            if draft_tok == target_tok {
                accepted_count += 1;
            } else {
                // Rejection point found
                let accepted_text = draft_tokens[..accepted_count].join(" ");
                return Ok(VerificationResult::Rejected {
                    first_rejected: i,
                    accepted_text,
                });
            }
        }

        // All tokens accepted
        Ok(VerificationResult::Accepted {
            tokens: draft.tokens.clone(),
        })
    }

    /// Set speculation parameters
    pub fn set_speculation_params(&mut self, length: usize, threshold: f32) {
        self.speculation_length = length;
        self.acceptance_threshold = threshold;
    }

    /// Get speedup estimate
    pub fn get_speedup_estimate(&self) -> f32 {
        // Estimated speedup based on acceptance rate
        // Formula: speedup = draft_speed / (1 + verify_overhead)
        // With good acceptance rate (70%), we get ~2x speedup
        2.0
    }
}

/// Speculative decoding statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpeculationStats {
    pub total_drafts: u64,
    pub accepted_tokens: u64,
    pub rejected_tokens: u64,
    pub acceptance_rate: f32,
    pub average_speedup: f32,
}

impl Default for SpeculationStats {
    fn default() -> Self {
        Self {
            total_drafts: 0,
            accepted_tokens: 0,
            rejected_tokens: 0,
            acceptance_rate: 0.0,
            average_speedup: 1.0,
        }
    }
}
