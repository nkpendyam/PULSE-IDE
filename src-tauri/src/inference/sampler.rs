//! Sampling Strategies for Text Generation
//!
//! Temperature, Top-P, Top-K, and repetition penalty

use anyhow::Result;
use rand::Rng;
use std::collections::HashSet;

/// Sampler configuration
#[derive(Debug, Clone)]
pub struct SamplerConfig {
    pub temperature: f32,
    pub top_p: f32,
    pub top_k: usize,
    pub repeat_penalty: f32,
    pub repeat_penalty_last_n: usize,
}

impl Default for SamplerConfig {
    fn default() -> Self {
        Self {
            temperature: 0.7,
            top_p: 0.9,
            top_k: 40,
            repeat_penalty: 1.1,
            repeat_penalty_last_n: 64,
        }
    }
}

/// Token sampler
pub struct Sampler {
    config: SamplerConfig,
    recent_tokens: Vec<u32>,
}

impl Sampler {
    pub fn new(config: SamplerConfig) -> Self {
        Self {
            config,
            recent_tokens: Vec::new(),
        }
    }
    
    /// Sample next token from logits
    pub fn sample(&mut self, logits: &[f32]) -> Result<u32> {
        let mut logits = logits.to_vec();
        
        // Apply repetition penalty
        self.apply_repeat_penalty(&mut logits);
        
        // Apply temperature
        self.apply_temperature(&mut logits);
        
        // Apply top-k
        self.apply_top_k(&mut logits);
        
        // Apply top-p
        self.apply_top_p(&mut logits);
        
        // Sample from distribution
        let token = self.sample_from_distribution(&logits)?;
        
        // Track recent tokens
        self.recent_tokens.push(token);
        if self.recent_tokens.len() > self.config.repeat_penalty_last_n {
            self.recent_tokens.remove(0);
        }
        
        Ok(token)
    }
    
    fn apply_temperature(&self, logits: &mut [f32]) {
        if self.config.temperature > 0.0 {
            for logit in logits.iter_mut() {
                *logit /= self.config.temperature;
            }
        }
    }
    
    fn apply_top_k(&self, logits: &mut [f32]) {
        if self.config.top_k > 0 && self.config.top_k < logits.len() {
            // Find threshold
            let mut sorted = logits.to_vec();
            sorted.sort_by(|a, b| b.partial_cmp(a).unwrap());
            let threshold = sorted[self.config.top_k];
            
            // Zero out tokens below threshold
            for logit in logits.iter_mut() {
                if *logit < threshold {
                    *logit = f32::NEG_INFINITY;
                }
            }
        }
    }
    
    fn apply_top_p(&self, logits: &mut [f32]) {
        if self.config.top_p < 1.0 {
            // Apply softmax
            let max_logit = logits.iter().cloned().fold(f32::NEG_INFINITY, f32::max);
            let exp_logits: Vec<f32> = logits.iter().map(|&l| (l - max_logit).exp()).collect();
            let sum: f32 = exp_logits.iter().sum();
            
            // Sort by probability
            let mut indexed: Vec<_> = exp_logits.iter().enumerate().collect();
            indexed.sort_by(|a, b| b.1.partial_cmp(a.1).unwrap());
            
            // Find cutoff
            let mut cumsum = 0.0;
            let mut cutoff = indexed.len();
            for (i, (_, &prob)) in indexed.iter().enumerate() {
                cumsum += prob / sum;
                if cumsum > self.config.top_p {
                    cutoff = i + 1;
                    break;
                }
            }
            
            // Zero out tokens above cutoff
            let keep: HashSet<usize> = indexed.iter().take(cutoff).map(|(i, _)| *i).collect();
            for (i, logit) in logits.iter_mut().enumerate() {
                if !keep.contains(&i) {
                    *logit = f32::NEG_INFINITY;
                }
            }
        }
    }
    
    fn apply_repeat_penalty(&self, logits: &mut [f32]) {
        for &token in &self.recent_tokens {
            if (token as usize) < logits.len() {
                if logits[token as usize] > 0.0 {
                    logits[token as usize] /= self.config.repeat_penalty;
                } else {
                    logits[token as usize] *= self.config.repeat_penalty;
                }
            }
        }
    }
    
    fn sample_from_distribution(&self, logits: &[f32]) -> Result<u32> {
        // Apply softmax
        let max_logit = logits.iter().cloned().fold(f32::NEG_INFINITY, f32::max);
        let exp_logits: Vec<f32> = logits.iter().map(|&l| (l - max_logit).exp()).collect();
        let sum: f32 = exp_logits.iter().sum();
        
        // Sample
        let mut rng = rand::thread_rng();
        let mut r = rng.gen::<f32>() * sum;
        
        for (i, &prob) in exp_logits.iter().enumerate() {
            r -= prob;
            if r <= 0.0 {
                return Ok(i as u32);
            }
        }
        
        // Fallback to argmax
        Ok(logits.iter()
            .enumerate()
            .max_by(|(_, a), (_, b)| a.partial_cmp(b).unwrap())
            .map(|(i, _)| i as u32)
            .unwrap_or(0))
    }
    
    /// Reset recent tokens
    pub fn reset(&mut self) {
        self.recent_tokens.clear();
    }
}

impl Default for Sampler {
    fn default() -> Self {
        Self::new(SamplerConfig::default())
    }
}
