//! Streaming Response Handler
//!
//! Handles real-time streaming of LLM responses to the frontend

use super::*;
use tokio::sync::mpsc::{channel, Sender, Receiver};
use anyhow::Result;
use std::sync::Arc;
use tokio::sync::RwLock;

/// Streaming responder for real-time responses
pub struct StreamingResponder {
    config: ChatConfig,
    active_streams: Arc<RwLock<Vec<String>>>,
}

impl StreamingResponder {
    pub fn new(config: ChatConfig) -> Self {
        Self {
            config,
            active_streams: Vec::new(),
        }
    }

    /// Create a new stream channel
    pub fn create_stream(&self) -> (Sender<StreamChunk>, Receiver<StreamChunk>) {
        channel(256)
    }

    /// Start streaming response
    pub async fn start_stream(
        &self,
        session_id: &str,
        message_id: &str,
        llm_stream: impl futures::Stream<Item = Result<String>> + Send + 'static,
        sender: Sender<StreamChunk>,
    ) -> Result<()> {
        let session_id = session_id.to_string();
        let message_id = message_id.to_string();

        // Mark stream as active
        self.active_streams.write().await.push(message_id.clone());

        // Process stream
        tokio::spawn(async move {
            let mut thinking = false;
            let mut full_content = String::new();

            let mut stream = std::pin::pin!(llm_stream);

            while let Some(chunk_result) = futures_util::StreamExt::next(&mut stream).await {
                match chunk_result {
                    Ok(token) => {
                        // Detect thinking tags
                        if token.contains("<think") {
                            thinking = true;
                        } else if token.contains("</think") {
                            thinking = false;
                        }

                        full_content.push_str(&token);

                        let chunk = StreamChunk {
                            session_id: session_id.clone(),
                            message_id: message_id.clone(),
                            delta: token,
                            is_thinking: thinking,
                            is_done: false,
                            rag_sources: vec![],
                        };

                        if sender.send(chunk).await.is_err() {
                            log::warn!("Stream receiver dropped");
                            break;
                        }
                    }
                    Err(e) => {
                        log::error!("Stream error: {}", e);
                        break;
                    }
                }
            }

            // Send final chunk
            let _ = sender.send(StreamChunk {
                session_id,
                message_id,
                delta: String::new(),
                is_thinking: false,
                is_done: true,
                rag_sources: vec![],
            }).await;
        });

        Ok(())
    }

    /// Cancel active stream
    pub async fn cancel_stream(&self, message_id: &str) -> Result<()> {
        let mut streams = self.active_streams.write().await;
        streams.retain(|id| id != message_id);
        Ok(())
    }

    /// Check if stream is active
    pub async fn is_stream_active(&self, message_id: &str) -> bool {
        self.active_streams.read().await.contains(message_id)
    }

    /// Get all active streams
    pub async fn get_active_streams(&self) -> Vec<String> {
        self.active_streams.read().await.clone()
    }
}

impl Default for StreamingResponder {
    fn default() -> Self {
        Self::new(ChatConfig::default())
    }
}

/// Stream accumulator for building complete responses
pub struct StreamAccumulator {
    content: String,
    thinking: String,
    is_thinking: bool,
}

impl StreamAccumulator {
    pub fn new() -> Self {
        Self {
            content: String::new(),
            thinking: String::new(),
            is_thinking: false,
        }
    }

    /// Add a chunk to the accumulator
    pub fn add(&mut self, chunk: &StreamChunk) {
        if chunk.is_thinking {
            self.is_thinking = true;
            self.thinking.push_str(&chunk.delta);
        } else {
            self.is_thinking = false;
            self.content.push_str(&chunk.delta);
        }
    }

    /// Get accumulated content
    pub fn content(&self) -> &str {
        &self.content
    }

    /// Get thinking content
    pub fn thinking(&self) -> &str {
        &self.thinking
    }

    /// Check if currently in thinking mode
    pub fn is_thinking(&self) -> bool {
        self.is_thinking
    }

    /// Check if stream is complete
    pub fn is_complete(&self, chunk: &StreamChunk) -> bool {
        chunk.is_done
    }

    /// Reset accumulator
    pub fn reset(&mut self) {
        self.content.clear();
        self.thinking.clear();
        self.is_thinking = false;
    }
}

impl Default for StreamAccumulator {
    fn default() -> Self {
        Self::new()
    }
}

/// Rate limiter for streaming
pub struct StreamRateLimiter {
    min_chunk_interval_ms: u64,
    last_chunk_time: std::time::Instant,
    buffer: String,
}

impl StreamRateLimiter {
    pub fn new(min_chunk_interval_ms: u64) -> Self {
        Self {
            min_chunk_interval_ms,
            last_chunk_time: std::time::Instant::now()
                .checked_sub(std::time::Duration::from_millis(min_chunk_interval_ms))
                .unwrap_or_else(std::time::Instant::now),
            buffer: String::new(),
        }
    }

    /// Add token to buffer, returns Some if ready to emit
    pub fn add(&mut self, token: &str) -> Option<String> {
        self.buffer.push_str(token);

        let now = std::time::Instant::now();
        let elapsed = now.duration_since(self.last_chunk_time);

        if elapsed.as_millis() as u64 >= self.min_chunk_interval_ms {
            self.last_chunk_time = now;
            let output = self.buffer.clone();
            self.buffer.clear();
            Some(output)
        } else {
            None
        }
    }

    /// Flush remaining buffer
    pub fn flush(&mut self) -> Option<String> {
        if self.buffer.is_empty() {
            None
        } else {
            let output = self.buffer.clone();
            self.buffer.clear();
            Some(output)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_stream_accumulator() {
        let mut acc = StreamAccumulator::new();

        acc.add(&StreamChunk {
            session_id: "s1".to_string(),
            message_id: "m1".to_string(),
            delta: "Hello".to_string(),
            is_thinking: false,
            is_done: false,
            rag_sources: vec![],
        });

        assert_eq!(acc.content(), "Hello");
        assert!(!acc.is_thinking());
    }

    #[test]
    fn test_rate_limiter() {
        let mut limiter = StreamRateLimiter::new(100);

        // First add should emit immediately
        let result = limiter.add("test");
        assert!(result.is_some());
    }
}
