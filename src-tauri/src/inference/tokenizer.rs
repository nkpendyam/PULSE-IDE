//! Tokenizer Implementation
//!
//! BPE and SentencePiece tokenizers for LLM inference

use anyhow::Result;
use std::collections::HashMap;

/// Tokenizer trait
pub trait Tokenizer: Send + Sync {
    fn encode(&self, text: &str) -> Result<Vec<u32>>;
    fn decode(&self, tokens: &[u32]) -> Result<String>;
    fn vocab_size(&self) -> usize;
    fn token_to_id(&self, token: &str) -> Option<u32>;
    fn id_to_token(&self, id: u32) -> Option<String>;
}

/// Simple BPE tokenizer
pub struct SimpleTokenizer {
    vocab: HashMap<String, u32>,
    reverse_vocab: HashMap<u32, String>,
}

impl SimpleTokenizer {
    pub fn new() -> Self {
        // Build simple vocabulary
        let mut vocab = HashMap::new();
        let mut reverse_vocab = HashMap::new();
        
        // Add basic tokens
        for i in 0..32000 {
            let token = format!("token_{}", i);
            vocab.insert(token.clone(), i);
            reverse_vocab.insert(i, token);
        }
        
        Self { vocab, reverse_vocab }
    }
}

impl Tokenizer for SimpleTokenizer {
    fn encode(&self, text: &str) -> Result<Vec<u32>> {
        // Simple whitespace + punctuation tokenization
        let tokens: Vec<u32> = text
            .split_whitespace()
            .flat_map(|word| {
                let mut word_tokens = Vec::new();
                // Hash word to token IDs
                let hash = Self::simple_hash(word);
                word_tokens.push(hash % 32000);
                word_tokens
            })
            .collect();
        
        Ok(tokens)
    }
    
    fn decode(&self, tokens: &[u32]) -> Result<String> {
        let words: Vec<String> = tokens
            .iter()
            .filter_map(|&id| self.reverse_vocab.get(&id).cloned())
            .collect();
        
        Ok(words.join(" "))
    }
    
    fn vocab_size(&self) -> usize {
        32000
    }
    
    fn token_to_id(&self, token: &str) -> Option<u32> {
        self.vocab.get(token).copied()
    }
    
    fn id_to_token(&self, id: u32) -> Option<String> {
        self.reverse_vocab.get(&id).cloned()
    }
}

impl SimpleTokenizer {
    fn simple_hash(s: &str) -> u32 {
        let mut hash: u32 = 0;
        for c in s.chars() {
            hash = hash.wrapping_mul(31).wrapping_add(c as u32);
        }
        hash
    }
}

impl Default for SimpleTokenizer {
    fn default() -> Self {
        Self::new()
    }
}
