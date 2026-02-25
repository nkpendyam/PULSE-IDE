//! Double Ratchet Implementation
//! 
//! Based on Signal Protocol's Double Ratchet algorithm
//! Provides forward secrecy for encrypted messaging

use serde::{Deserialize, Serialize};
use hkdf::Hkdf;
use sha2::Sha256;

/// Double Ratchet state for a session
#[derive(Debug, Clone)]
pub struct DoubleRatchetState {
    /// Root key (32 bytes)
    root_key: [u8; 32],
    /// Sending chain key
    sending_chain: Option<ChainState>,
    /// Receiving chain key
    receiving_chain: Option<ChainState>,
    /// Message number for sending
    send_message_number: u32,
    /// Message number for receiving
    recv_message_number: u32,
    /// Skipped message keys (for out-of-order messages)
    skipped_keys: std::collections::HashMap<(Vec<u8>, u32), [u8; 32]>,
    /// Maximum skipped keys to store
    max_skipped: usize,
}

/// Chain state for sending/receiving
#[derive(Debug, Clone)]
pub struct ChainState {
    /// Chain key
    chain_key: [u8; 32],
    /// Current message key
    message_key: Option<[u8; 32]>,
    /// Current index
    index: u32,
}

impl DoubleRatchetState {
    /// Create a new double ratchet state as initiator
    pub fn new_initiator(root_key: [u8; 32]) -> Self {
        Self {
            root_key,
            sending_chain: Some(ChainState::new()),
            receiving_chain: None,
            send_message_number: 0,
            recv_message_number: 0,
            skipped_keys: std::collections::HashMap::new(),
            max_skipped: 1000,
        }
    }

    /// Create a new double ratchet state as responder
    pub fn new_responder(root_key: [u8; 32]) -> Self {
        Self {
            root_key,
            sending_chain: None,
            receiving_chain: Some(ChainState::new()),
            send_message_number: 0,
            recv_message_number: 0,
            skipped_keys: std::collections::HashMap::new(),
            max_skipped: 1000,
        }
    }

    /// Get the next sending key
    pub fn get_sending_key(&mut self) -> anyhow::Result<([u8; 32], u32)> {
        let chain = self.sending_chain.as_mut()
            .ok_or_else(|| anyhow::anyhow!("Sending chain not initialized"))?;
        
        let key = chain.advance()?;
        let msg_num = self.send_message_number;
        self.send_message_number += 1;
        
        Ok((key, msg_num))
    }

    /// Get receiving key for a specific message number
    pub fn get_receiving_key(&mut self, message_number: u32) -> anyhow::Result<[u8; 32]> {
        // Check if we have a skipped key
        let chain_key = self.receiving_chain.as_ref()
            .map(|c| c.chain_key)
            .ok_or_else(|| anyhow::anyhow!("Receiving chain not initialized"))?;
        
        let key = if let Some(skipped) = self.skipped_keys.remove(&(chain_key.to_vec(), message_number)) {
            skipped
        } else {
            // Advance chain to the correct message number
            let chain = self.receiving_chain.as_mut().unwrap();
            
            // Skip keys for out-of-order messages
            while chain.index < message_number {
                let key = chain.advance()?;
                self.skipped_keys.insert((chain_key.to_vec(), chain.index - 1), key);
                
                if self.skipped_keys.len() > self.max_skipped {
                    // Remove oldest skipped keys
                    let oldest = self.skipped_keys.keys().next().cloned();
                    if let Some(k) = oldest {
                        self.skipped_keys.remove(&k);
                    }
                }
            }
            
            chain.advance()?
        };
        
        self.recv_message_number = message_number + 1;
        Ok(key)
    }

    /// Perform a DH ratchet step
    pub fn ratchet_step(&mut self, dh_output: &[u8]) -> anyhow::Result<()> {
        // Derive new root key and chain key from DH output
        let (new_root, new_chain) = Self::kdf_rk(&self.root_key, dh_output)?;
        
        self.root_key = new_root;
        self.sending_chain = Some(ChainState::with_key(new_chain));
        self.send_message_number = 0;
        
        Ok(())
    }

    /// KDF for root key derivation
    fn kdf_rk(root_key: &[u8; 32], dh_output: &[u8]) -> anyhow::Result<([u8; 32], [u8; 32])> {
        let hkdf = Hkdf::<Sha256>::new(Some(root_key), dh_output);
        
        let mut output = [0u8; 64];
        hkdf.expand(b"kyro-ide-ratchet", &mut output)
            .map_err(|e| anyhow::anyhow!("KDF failed: {}", e))?;
        
        let mut new_root = [0u8; 32];
        let mut new_chain = [0u8; 32];
        new_root.copy_from_slice(&output[..32]);
        new_chain.copy_from_slice(&output[32..]);
        
        Ok((new_root, new_chain))
    }
}

impl ChainState {
    /// Create a new chain state
    pub fn new() -> Self {
        // Generate initial chain key
        let chain_key: [u8; 32] = rand::random();
        Self {
            chain_key,
            message_key: None,
            index: 0,
        }
    }

    /// Create a chain state with a specific key
    pub fn with_key(chain_key: [u8; 32]) -> Self {
        Self {
            chain_key,
            message_key: None,
            index: 0,
        }
    }

    /// Advance the chain and return the next message key
    pub fn advance(&mut self) -> anyhow::Result<[u8; 32]> {
        // Derive message key from chain key
        let hkdf = Hkdf::<Sha256>::new(None, &self.chain_key);
        
        let mut message_key = [0u8; 32];
        hkdf.expand(b"message-key", &mut message_key)
            .map_err(|e| anyhow::anyhow!("KDF failed: {}", e))?;
        
        // Derive next chain key
        let mut next_chain_key = [0u8; 32];
        hkdf.expand(b"chain-key", &mut next_chain_key)
            .map_err(|e| anyhow::anyhow!("KDF failed: {}", e))?;
        
        self.chain_key = next_chain_key;
        self.message_key = Some(message_key);
        self.index += 1;
        
        Ok(message_key)
    }
}

impl Default for ChainState {
    fn default() -> Self {
        Self::new()
    }
}

/// Encrypted message with ratchet info
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RatchetMessage {
    /// Header containing ratchet public key and message number
    pub header: RatchetHeader,
    /// Encrypted ciphertext
    pub ciphertext: Vec<u8>,
    /// Authentication tag
    pub tag: Vec<u8>,
}

/// Ratchet header
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RatchetHeader {
    /// Sender's current ratchet public key
    pub public_key: Vec<u8>,
    /// Previous chain length (for skipped messages)
    pub prev_chain_len: u32,
    /// Message number in current chain
    pub message_number: u32,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_double_ratchet_initiator() {
        let root_key = [0u8; 32];
        let ratchet = DoubleRatchetState::new_initiator(root_key);
        
        assert!(ratchet.sending_chain.is_some());
        assert!(ratchet.receiving_chain.is_none());
        assert_eq!(ratchet.send_message_number, 0);
    }

    #[test]
    fn test_chain_advance() {
        let mut chain = ChainState::new();
        
        let key1 = chain.advance().unwrap();
        let key2 = chain.advance().unwrap();
        
        // Each advance should produce a different key
        assert_ne!(key1, key2);
        assert_eq!(chain.index, 2);
    }

    #[test]
    fn test_sending_key_sequence() {
        let root_key = [0u8; 32];
        let mut ratchet = DoubleRatchetState::new_initiator(root_key);
        
        let (key1, num1) = ratchet.get_sending_key().unwrap();
        let (key2, num2) = ratchet.get_sending_key().unwrap();
        
        assert_ne!(key1, key2);
        assert_eq!(num1, 0);
        assert_eq!(num2, 1);
    }
}
