//! Rate Limiter Module
//! 
//! Implements rate limiting to prevent brute-force attacks

use std::collections::HashMap;
use std::time::Instant;

/// Rate limiter for authentication endpoints
pub struct RateLimiter {
    /// Requests per minute allowed
    max_requests: u32,
    /// Request tracking by client identifier (IP)
    requests: HashMap<String, Vec<Instant>>,
}

impl RateLimiter {
    pub fn new(max_requests_per_minute: u32) -> Self {
        Self {
            max_requests: max_requests_per_minute,
            requests: HashMap::new(),
        }
    }

    /// Check if a request is allowed
    pub fn check(&mut self, client_id: &str) -> bool {
        let now = Instant::now();
        let minute_ago = now - std::time::Duration::from_secs(60);

        // Get or create entry for this client
        let timestamps = self.requests.entry(client_id.to_string())
            .or_insert_with(Vec::new);

        // Remove timestamps older than 1 minute
        timestamps.retain(|&t| t > minute_ago);

        // Check if under limit
        if timestamps.len() < self.max_requests as usize {
            timestamps.push(now);
            true
        } else {
            false
        }
    }

    /// Get remaining requests for a client
    pub fn remaining(&self, client_id: &str) -> u32 {
        let now = Instant::now();
        let minute_ago = now - std::time::Duration::from_secs(60);

        if let Some(timestamps) = self.requests.get(client_id) {
            let recent_count = timestamps.iter().filter(|&&t| t > minute_ago).count() as u32;
            self.max_requests.saturating_sub(recent_count)
        } else {
            self.max_requests
        }
    }

    /// Reset rate limit for a client
    pub fn reset(&mut self, client_id: &str) {
        self.requests.remove(client_id);
    }

    /// Clean up old entries (call periodically)
    pub fn cleanup(&mut self) {
        let now = Instant::now();
        let minute_ago = now - std::time::Duration::from_secs(60);

        self.requests.retain(|_, timestamps| {
            timestamps.retain(|&t| t > minute_ago);
            !timestamps.is_empty()
        });
    }
}

impl Default for RateLimiter {
    fn default() -> Self {
        Self::new(60) // 60 requests per minute default
    }
}

/// Sliding window rate limiter with burst support
pub struct SlidingWindowRateLimiter {
    /// Maximum requests in window
    max_requests: u32,
    /// Window duration in seconds
    window_secs: u64,
    /// Burst allowance (extra requests for short bursts)
    burst_allowance: u32,
    /// Request tracking
    requests: HashMap<String, SlidingWindow>,
}

#[derive(Clone)]
struct SlidingWindow {
    timestamps: Vec<Instant>,
    burst_used: u32,
}

impl SlidingWindowRateLimiter {
    pub fn new(max_requests: u32, window_secs: u64, burst_allowance: u32) -> Self {
        Self {
            max_requests,
            window_secs,
            burst_allowance,
            requests: HashMap::new(),
        }
    }

    pub fn check(&mut self, client_id: &str) -> RateLimitResult {
        let now = Instant::now();
        let window_start = now - std::time::Duration::from_secs(self.window_secs);

        let window = self.requests.entry(client_id.to_string())
            .or_insert_with(|| SlidingWindow {
                timestamps: Vec::new(),
                burst_used: 0,
            });

        // Remove old timestamps
        window.timestamps.retain(|&t| t > window_start);

        let regular_count = window.timestamps.len() as u32;
        let burst_remaining = self.burst_allowance.saturating_sub(window.burst_used);

        if regular_count < self.max_requests {
            window.timestamps.push(now);
            RateLimitResult::Allowed {
                remaining: self.max_requests - regular_count - 1,
                burst_remaining,
            }
        } else if burst_remaining > 0 {
            window.burst_used += 1;
            window.timestamps.push(now);
            RateLimitResult::BurstAllowed {
                burst_remaining: burst_remaining - 1,
            }
        } else {
            let retry_after = self.window_secs; // Simplified
            RateLimitResult::Denied {
                retry_after_secs: retry_after,
            }
        }
    }
}

/// Result of rate limit check
#[derive(Debug, Clone)]
pub enum RateLimitResult {
    Allowed {
        remaining: u32,
        burst_remaining: u32,
    },
    BurstAllowed {
        burst_remaining: u32,
    },
    Denied {
        retry_after_secs: u64,
    },
}

impl RateLimitResult {
    pub fn is_allowed(&self) -> bool {
        !matches!(self, RateLimitResult::Denied { .. })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_rate_limiter_allows_under_limit() {
        let mut limiter = RateLimiter::new(5);
        
        for _ in 0..5 {
            assert!(limiter.check("client1"));
        }
    }

    #[test]
    fn test_rate_limiter_denies_over_limit() {
        let mut limiter = RateLimiter::new(3);
        
        assert!(limiter.check("client1"));
        assert!(limiter.check("client1"));
        assert!(limiter.check("client1"));
        assert!(!limiter.check("client1")); // 4th should be denied
    }

    #[test]
    fn test_rate_limiter_independent_per_client() {
        let mut limiter = RateLimiter::new(2);
        
        assert!(limiter.check("client1"));
        assert!(limiter.check("client1"));
        assert!(!limiter.check("client1"));
        
        assert!(limiter.check("client2"));
        assert!(limiter.check("client2"));
    }

    #[test]
    fn test_rate_limiter_remaining() {
        let mut limiter = RateLimiter::new(5);
        
        assert_eq!(limiter.remaining("client1"), 5);
        limiter.check("client1");
        assert_eq!(limiter.remaining("client1"), 4);
    }

    #[test]
    fn test_sliding_window_rate_limiter() {
        let mut limiter = SlidingWindowRateLimiter::new(3, 60, 2);
        
        // Regular requests
        assert!(limiter.check("client1").is_allowed());
        assert!(limiter.check("client1").is_allowed());
        assert!(limiter.check("client1").is_allowed());
        
        // Burst requests
        assert!(limiter.check("client1").is_allowed());
        assert!(limiter.check("client1").is_allowed());
        
        // Should be denied now
        assert!(!limiter.check("client1").is_allowed());
    }
}
