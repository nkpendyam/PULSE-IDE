//! Delta Update System for KRO_IDE
//!
//! Binary diffing for bandwidth-efficient updates

use anyhow::{Result, Context};
use std::path::PathBuf;
use std::io::{Read, Write};

/// Delta updater for binary patches
pub struct DeltaUpdater {
    chunk_size: usize,
}

impl DeltaUpdater {
    pub fn new() -> Result<Self> {
        Ok(Self {
            chunk_size: 1024 * 1024, // 1MB chunks
        })
    }
    
    /// Download and apply a delta patch
    pub async fn download_and_apply_delta(
        &self,
        url: &str,
        target_dir: &PathBuf,
        progress: impl Fn(f32) + Send + 'static,
    ) -> Result<PathBuf> {
        use futures_util::StreamExt;
        
        // Download delta file
        let response = reqwest::get(url).await?;
        let total_size = response.content_length().unwrap_or(0);
        
        let delta_path = target_dir.join("patch.delta");
        let mut file = tokio::fs::File::create(&delta_path).await?;
        let mut downloaded: u64 = 0;
        let mut stream = response.bytes_stream();
        
        while let Some(chunk) = stream.next().await {
            let chunk = chunk?;
            use tokio::io::AsyncWriteExt;
            file.write_all(&chunk).await?;
            downloaded += chunk.len() as u64;
            
            if total_size > 0 {
                progress(downloaded as f32 / total_size as f32);
            }
        }
        
        progress(1.0);
        
        // Apply delta
        let current_binary = std::env::current_exe()?;
        let new_binary = target_dir.join("kro_ide");
        
        self.apply_delta(&current_binary, &delta_path, &new_binary)?;
        
        // Clean up delta file
        std::fs::remove_file(&delta_path)?;
        
        Ok(new_binary)
    }
    
    /// Apply a delta patch to create new binary
    pub fn apply_delta(
        &self,
        old_file: &PathBuf,
        delta_file: &PathBuf,
        new_file: &PathBuf,
    ) -> Result<()> {
        // Read old file
        let mut old_data = Vec::new();
        std::fs::File::open(old_file)?.read_to_end(&mut old_data)?;
        
        // Read delta
        let mut delta_data = Vec::new();
        std::fs::File::open(delta_file)?.read_to_end(&mut delta_data)?;
        
        // Parse and apply delta
        let new_data = self.patch(&old_data, &delta_data)?;
        
        // Write new file
        let mut output = std::fs::File::create(new_file)?;
        output.write_all(&new_data)?;
        
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            std::fs::set_permissions(new_file, std::fs::Permissions::from_mode(0o755))?;
        }
        
        Ok(())
    }
    
    /// Create a delta between two files
    pub fn create_delta(
        &self,
        old_file: &PathBuf,
        new_file: &PathBuf,
        delta_file: &PathBuf,
    ) -> Result<()> {
        let mut old_data = Vec::new();
        std::fs::File::open(old_file)?.read_to_end(&mut old_data)?;
        
        let mut new_data = Vec::new();
        std::fs::File::open(new_file)?.read_to_end(&mut new_data)?;
        
        let delta = self.diff(&old_data, &new_data)?;
        
        let mut output = std::fs::File::create(delta_file)?;
        output.write_all(&delta)?;
        
        Ok(())
    }
    
    /// Simple binary diff implementation
    /// Format:
    /// [4 bytes: magic "KROD"]
    /// [4 bytes: version]
    /// [8 bytes: original size]
    /// [8 bytes: new size]
    /// [operations...]
    fn diff(&self, old: &[u8], new: &[u8]) -> Result<Vec<u8>> {
        let mut delta = Vec::new();
        
        // Header
        delta.extend_from_slice(b"KROD"); // Magic
        delta.extend_from_slice(&1u32.to_le_bytes()); // Version
        delta.extend_from_slice(&(old.len() as u64).to_le_bytes());
        delta.extend_from_slice(&(new.len() as u64).to_le_bytes());
        
        // Simple delta: find matching blocks and encode operations
        let mut old_pos = 0usize;
        let mut new_pos = 0usize;
        
        while new_pos < new.len() {
            // Try to find matching block in old
            if let Some(match_offset) = self.find_match(old, new, new_pos) {
                let match_len = self.count_match(old, match_offset, new, new_pos);
                
                // Copy operation
                delta.push(0); // COPY
                delta.extend_from_slice(&(match_offset as u64).to_le_bytes());
                delta.extend_from_slice(&(match_len as u64).to_le_bytes());
                
                new_pos += match_len;
            } else {
                // Insert operation
                let mut insert_len = 0;
                let mut insert_data = Vec::new();
                
                while new_pos + insert_len < new.len() && insert_len < self.chunk_size {
                    if self.find_match(old, new, new_pos + insert_len).is_some() {
                        break;
                    }
                    insert_data.push(new[new_pos + insert_len]);
                    insert_len += 1;
                }
                
                delta.push(1); // INSERT
                delta.extend_from_slice(&(insert_len as u64).to_le_bytes());
                delta.extend(&insert_data);
                
                new_pos += insert_len;
            }
        }
        
        Ok(delta)
    }
    
    /// Apply delta to create new data
    fn patch(&self, old: &[u8], delta: &[u8]) -> Result<Vec<u8>> {
        let mut cursor = 0usize;
        
        // Read header
        if &delta[cursor..cursor+4] != b"KROD" {
            anyhow::bail!("Invalid delta magic");
        }
        cursor += 4;
        
        let _version = u32::from_le_bytes(delta[cursor..cursor+4].try_into()?);
        cursor += 4;
        
        let _old_size = u64::from_le_bytes(delta[cursor..cursor+8].try_into()?);
        cursor += 8;
        
        let new_size = u64::from_le_bytes(delta[cursor..cursor+8].try_into()?) as usize;
        cursor += 8;
        
        let mut new_data = Vec::with_capacity(new_size);
        
        // Apply operations
        while cursor < delta.len() && new_data.len() < new_size {
            let op = delta[cursor];
            cursor += 1;
            
            match op {
                0 => {
                    // COPY
                    let offset = u64::from_le_bytes(delta[cursor..cursor+8].try_into()?) as usize;
                    cursor += 8;
                    let len = u64::from_le_bytes(delta[cursor..cursor+8].try_into()?) as usize;
                    cursor += 8;
                    
                    new_data.extend_from_slice(&old[offset..offset+len]);
                }
                1 => {
                    // INSERT
                    let len = u64::from_le_bytes(delta[cursor..cursor+8].try_into()?) as usize;
                    cursor += 8;
                    
                    new_data.extend_from_slice(&delta[cursor..cursor+len]);
                    cursor += len;
                }
                _ => anyhow::bail!("Unknown operation: {}", op),
            }
        }
        
        Ok(new_data)
    }
    
    /// Find matching block in old data
    fn find_match(&self, old: &[u8], new: &[u8], new_pos: usize) -> Option<usize> {
        if new_pos >= new.len() {
            return None;
        }
        
        // Simple substring search for small blocks
        let search_len = std::cmp::min(64, new.len() - new_pos);
        let search = &new[new_pos..new_pos + search_len];
        
        old.windows(search_len).position(|w| w == search)
    }
    
    /// Count matching bytes
    fn count_match(&self, old: &[u8], old_pos: usize, new: &[u8], new_pos: usize) -> usize {
        let mut count = 0;
        while old_pos + count < old.len() 
            && new_pos + count < new.len() 
            && old[old_pos + count] == new[new_pos + count] 
            && count < self.chunk_size 
        {
            count += 1;
        }
        count
    }
}

impl Default for DeltaUpdater {
    fn default() -> Self {
        Self::new().unwrap()
    }
}
