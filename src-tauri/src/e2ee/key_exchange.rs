//! Key Exchange Module
//! 
//! X3DH (Extended Triple Diffie-Hellman) key agreement
//! Based on Signal Protocol specification

use x25519_dalek::{EphemeralSecret, PublicKey, StaticSecret};
use hkdf::Hkdf;
use sha2::Sha256;
use serde::{Deserialize, Serialize};

/// X3DH key exchange result
#[derive(Debug)]
pub struct X3DHResult {
    /// Shared secret (32 bytes)
    pub shared_secret: [u8; 32],
    /// Associated data for AEAD
    pub associated_data: Vec<u8>,
}

/// User's key bundle for X3DH
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeyBundle {
    /// Identity public key (long-term)
    pub identity_key: Vec<u8>,
    /// Signed pre-key (medium-term)
    pub signed_pre_key: Vec<u8>,
    /// Pre-key signature
    pub pre_key_signature: Vec<u8>,
    /// One-time pre-key (optional, for additional security)
    pub one_time_pre_key: Option<Vec<u8>>,
}

/// X3DH initiator (Alice)
pub struct X3DHInitiator {
    /// Identity keypair (long-term)
    identity_keypair: (StaticSecret, PublicKey),
    /// Ephemeral keypair (single use)
    ephemeral_keypair: (EphemeralSecret, PublicKey),
}

impl X3DHInitiator {
    /// Create a new X3DH initiator
    pub fn new() -> Self {
        let mut rng = rand::thread_rng();
        
        let identity_secret = StaticSecret::random_from_rng(&mut rng);
        let identity_public = PublicKey::from(&identity_secret);
        
        let ephemeral_secret = EphemeralSecret::random_from_rng(&mut rng);
        let ephemeral_public = PublicKey::from(&ephemeral_secret);
        
        Self {
            identity_keypair: (identity_secret, identity_public),
            ephemeral_keypair: (ephemeral_secret, ephemeral_public),
        }
    }

    /// Perform X3DH key exchange with responder's bundle
    pub fn perform_x3dh(&self, responder_bundle: &KeyBundle) -> anyhow::Result<X3DHResult> {
        // Parse responder's public keys
        let responder_identity = PublicKey::from(<[u8; 32]>::try_from(
            responder_bundle.identity_key.as_slice()
        ).map_err(|_| anyhow::anyhow!("Invalid identity key length"))?);
        
        let responder_signed_pre_key = PublicKey::from(<[u8; 32]>::try_from(
            responder_bundle.signed_pre_key.as_slice()
        ).map_err(|_| anyhow::anyhow!("Invalid signed pre-key length"))?);
        
        // X3DH: DH1 = DH(IK_A, SPK_B)
        let dh1 = self.identity_keypair.0.diffie_hellman(&responder_signed_pre_key);
        
        // X3DH: DH2 = DH(EK_A, IK_B)
        let dh2 = self.ephemeral_keypair.0.diffie_hellman(&responder_identity);
        
        // X3DH: DH3 = DH(EK_A, SPK_B)
        let dh3 = self.ephemeral_keypair.0.diffie_hellman(&responder_signed_pre_key);
        
        // X3DH: DH4 = DH(EK_A, OPK_B) (optional)
        let dh4 = if let Some(opk) = &responder_bundle.one_time_pre_key {
            let responder_opk = PublicKey::from(<[u8; 32]>::try_from(opk.as_slice())
                .map_err(|_| anyhow::anyhow!("Invalid one-time pre-key length"))?);
            Some(self.ephemeral_keypair.0.diffie_hellman(&responder_opk))
        } else {
            None
        };
        
        // Derive shared secret using HKDF
        let mut input_key_material = Vec::new();
        input_key_material.extend_from_slice(dh1.as_bytes());
        input_key_material.extend_from_slice(dh2.as_bytes());
        input_key_material.extend_from_slice(dh3.as_bytes());
        if let Some(dh4) = dh4 {
            input_key_material.extend_from_slice(dh4.as_bytes());
        }
        
        let hkdf = Hkdf::<Sha256>::new(None, &input_key_material);
        let mut shared_secret = [0u8; 32];
        hkdf.expand(b"kyro-ide-x3dh", &mut shared_secret)
            .map_err(|e| anyhow::anyhow!("KDF failed: {}", e))?;
        
        // Create associated data
        let associated_data = [
            &self.identity_keypair.1.as_bytes()[..],
            &responder_bundle.identity_key[..],
        ].concat();
        
        Ok(X3DHResult {
            shared_secret,
            associated_data,
        })
    }

    /// Get identity public key
    pub fn get_identity_public(&self) -> Vec<u8> {
        self.identity_keypair.1.as_bytes().to_vec()
    }

    /// Get ephemeral public key
    pub fn get_ephemeral_public(&self) -> Vec<u8> {
        self.ephemeral_keypair.1.as_bytes().to_vec()
    }
}

/// X3DH responder (Bob)
pub struct X3DHResponder {
    /// Identity keypair (long-term)
    identity_keypair: (StaticSecret, PublicKey),
    /// Signed pre-keypair (medium-term)
    signed_pre_keypair: (StaticSecret, PublicKey),
    /// One-time pre-keypair (optional, single use)
    one_time_pre_keypair: Option<(StaticSecret, PublicKey)>,
}

impl X3DHResponder {
    /// Create a new X3DH responder
    pub fn new() -> Self {
        let mut rng = rand::thread_rng();
        
        let identity_secret = StaticSecret::random_from_rng(&mut rng);
        let identity_public = PublicKey::from(&identity_secret);
        
        let signed_pre_secret = StaticSecret::random_from_rng(&mut rng);
        let signed_pre_public = PublicKey::from(&signed_pre_secret);
        
        // Generate one-time pre-key
        let otp_secret = StaticSecret::random_from_rng(&mut rng);
        let otp_public = PublicKey::from(&otp_secret);
        
        Self {
            identity_keypair: (identity_secret, identity_public),
            signed_pre_keypair: (signed_pre_secret, signed_pre_public),
            one_time_pre_keypair: Some((otp_secret, otp_public)),
        }
    }

    /// Get the key bundle for sharing
    pub fn get_bundle(&self) -> KeyBundle {
        KeyBundle {
            identity_key: self.identity_keypair.1.as_bytes().to_vec(),
            signed_pre_key: self.signed_pre_keypair.1.as_bytes().to_vec(),
            pre_key_signature: vec![], // Would be signed with identity key
            one_time_pre_key: self.one_time_pre_keypair.as_ref()
                .map(|(_, pk)| pk.as_bytes().to_vec()),
        }
    }

    /// Complete X3DH from initiator's keys
    pub fn complete_x3dh(
        &self,
        initiator_identity: &[u8],
        initiator_ephemeral: &[u8],
    ) -> anyhow::Result<X3DHResult> {
        // Parse initiator's public keys
        let initiator_ik = PublicKey::from(<[u8; 32]>::try_from(initiator_identity)
            .map_err(|_| anyhow::anyhow!("Invalid initiator identity key"))?);
        let initiator_ek = PublicKey::from(<[u8; 32]>::try_from(initiator_ephemeral)
            .map_err(|_| anyhow::anyhow!("Invalid initiator ephemeral key"))?);
        
        // X3DH: DH1 = DH(IK_A, SPK_B) = DH(SPK_B, IK_A)
        let dh1 = self.signed_pre_keypair.0.diffie_hellman(&initiator_ik);
        
        // X3DH: DH2 = DH(EK_A, IK_B) = DH(IK_B, EK_A)
        let dh2 = self.identity_keypair.0.diffie_hellman(&initiator_ek);
        
        // X3DH: DH3 = DH(EK_A, SPK_B) = DH(SPK_B, EK_A)
        let dh3 = self.signed_pre_keypair.0.diffie_hellman(&initiator_ek);
        
        // X3DH: DH4 = DH(EK_A, OPK_B) (if available)
        let dh4 = if let Some((otp_secret, _)) = &self.one_time_pre_keypair {
            Some(otp_secret.diffie_hellman(&initiator_ek))
        } else {
            None
        };
        
        // Derive shared secret
        let mut input_key_material = Vec::new();
        input_key_material.extend_from_slice(dh1.as_bytes());
        input_key_material.extend_from_slice(dh2.as_bytes());
        input_key_material.extend_from_slice(dh3.as_bytes());
        if let Some(dh4) = dh4 {
            input_key_material.extend_from_slice(dh4.as_bytes());
        }
        
        let hkdf = Hkdf::<Sha256>::new(None, &input_key_material);
        let mut shared_secret = [0u8; 32];
        hkdf.expand(b"kyro-ide-x3dh", &mut shared_secret)
            .map_err(|e| anyhow::anyhow!("KDF failed: {}", e))?;
        
        // Create associated data
        let associated_data = [
            initiator_identity,
            &self.identity_keypair.1.as_bytes()[..],
        ].concat();
        
        Ok(X3DHResult {
            shared_secret,
            associated_data,
        })
    }
}

impl Default for X3DHInitiator {
    fn default() -> Self {
        Self::new()
    }
}

impl Default for X3DHResponder {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_x3dh_key_exchange() {
        // Create initiator and responder
        let initiator = X3DHInitiator::new();
        let responder = X3DHResponder::new();
        
        // Get responder's bundle
        let bundle = responder.get_bundle();
        
        // Initiator performs X3DH
        let result1 = initiator.perform_x3dh(&bundle).unwrap();
        
        // Responder completes X3DH
        let result2 = responder.complete_x3dh(
            &initiator.get_identity_public(),
            &initiator.get_ephemeral_public(),
        ).unwrap();
        
        // Both should derive the same shared secret
        assert_eq!(result1.shared_secret, result2.shared_secret);
    }

    #[test]
    fn test_key_bundle_creation() {
        let responder = X3DHResponder::new();
        let bundle = responder.get_bundle();
        
        assert_eq!(bundle.identity_key.len(), 32);
        assert_eq!(bundle.signed_pre_key.len(), 32);
        assert!(bundle.one_time_pre_key.is_some());
    }
}
