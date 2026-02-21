//! PULSE Runtime Kernel - Metrics Collection
//!
//! Real-time metrics collection and reporting.

use crate::event::Event;
use anyhow::Result;
use serde::{Serialize, Deserialize};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Instant;
use tokio::sync::RwLock;
use tracing::debug;

/// Metric type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum MetricType {
    Counter,
    Gauge,
    Histogram,
    Timer,
}

/// Metric sample
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MetricSample {
    pub name: String,
    pub value: f64,
    pub metric_type: MetricType,
    pub timestamp: i64,
    pub tags: HashMap<String, String>,
}

/// Metrics collector
pub struct MetricsCollector {
    /// Counter values
    counters: Arc<RwLock<HashMap<String, f64>>>,
    /// Gauge values
    gauges: Arc<RwLock<HashMap<String, f64>>>,
    /// Histogram values
    histograms: Arc<RwLock<HashMap<String, Vec<f64>>>>,
    /// Timer values
    timers: Arc<RwLock<HashMap<String, Vec<f64>>>>,
    /// Agent heartbeats
    heartbeats: Arc<RwLock<HashMap<String, Instant>>>,
    /// Running flag
    running: Arc<RwLock<bool>>,
}

impl MetricsCollector {
    /// Create a new metrics collector
    pub fn new() -> Self {
        Self {
            counters: Arc::new(RwLock::new(HashMap::new())),
            gauges: Arc::new(RwLock::new(HashMap::new())),
            histograms: Arc::new(RwLock::new(HashMap::new())),
            timers: Arc::new(RwLock::new(HashMap::new())),
            heartbeats: Arc::new(RwLock::new(HashMap::new())),
            running: Arc::new(RwLock::new(false)),
        }
    }

    /// Start metrics collection
    pub fn start(&self) -> Result<()> {
        let mut running = self.running.blocking_write();
        *running = true;
        Ok(())
    }

    /// Stop metrics collection
    pub fn stop(&self) {
        let mut running = self.running.blocking_write();
        *running = false;
    }

    /// Record an event
    pub fn record_event(&self, event: &Event) {
        let counters = Arc::clone(&self.counters);
        let event_type = event.event_type.to_string();

        tokio::spawn(async move {
            let mut counters = counters.write().await;
            *counters.entry(event_type).or_insert(0.0) += 1.0;
        });
    }

    /// Record a heartbeat from an agent
    pub fn record_heartbeat(&self, agent_id: &str) {
        let heartbeats = Arc::clone(&self.heartbeats);
        let agent_id = agent_id.to_string();

        tokio::spawn(async move {
            let mut heartbeats = heartbeats.write().await;
            heartbeats.insert(agent_id, Instant::now());
        });
    }

    /// Increment a counter
    pub fn record_counter(&self, name: &str, value: f64) {
        let counters = Arc::clone(&self.counters);
        let name = name.to_string();

        tokio::spawn(async move {
            let mut counters = counters.write().await;
            *counters.entry(name).or_insert(0.0) += value;
        });
    }

    /// Record a gauge value
    pub fn record_gauge(&self, name: &str, value: f64) {
        let gauges = Arc::clone(&self.gauges);
        let name = name.to_string();

        tokio::spawn(async move {
            let mut gauges = gauges.write().await;
            gauges.insert(name, value);
        });
    }

    /// Record a timing value
    pub fn record_timer(&self, name: &str, value_ms: f64) {
        let timers = Arc::clone(&self.timers);
        let name = name.to_string();

        tokio::spawn(async move {
            let mut timers = timers.write().await;
            timers.entry(name).or_insert_with(Vec::new).push(value_ms);
        });
    }

    /// Record a histogram value
    pub fn record_histogram(&self, name: &str, value: f64) {
        let histograms = Arc::clone(&self.histograms);
        let name = name.to_string();

        tokio::spawn(async move {
            let mut histograms = histograms.write().await;
            histograms.entry(name).or_insert_with(Vec::new).push(value);
        });
    }

    /// Get counter value
    pub async fn get_counter(&self, name: &str) -> f64 {
        let counters = self.counters.read().await;
        counters.get(name).copied().unwrap_or(0.0)
    }

    /// Get gauge value
    pub async fn get_gauge(&self, name: &str) -> f64 {
        let gauges = self.gauges.read().await;
        gauges.get(name).copied().unwrap_or(0.0)
    }

    /// Get all metrics
    pub async fn get_all(&self) -> MetricsSnapshot {
        let counters = self.counters.read().await;
        let gauges = self.gauges.read().await;
        let timers = self.timers.read().await;

        MetricsSnapshot {
            counters: counters.clone(),
            gauges: gauges.clone(),
            timer_summaries: timers.iter().map(|(k, v)| {
                (k.clone(), TimerSummary::from_values(v))
            }).collect(),
        }
    }

    /// Get agent health based on heartbeats
    pub async fn get_agent_health(&self, agent_id: &str, timeout_secs: u64) -> AgentHealth {
        let heartbeats = self.heartbeats.read().await;

        match heartbeats.get(agent_id) {
            Some(last_heartbeat) => {
                let elapsed = last_heartbeat.elapsed().as_secs();
                if elapsed > timeout_secs * 3 {
                    AgentHealth::Unhealthy
                } else if elapsed > timeout_secs * 2 {
                    AgentHealth::Degraded
                } else {
                    AgentHealth::Healthy
                }
            }
            None => AgentHealth::Unknown,
        }
    }

    /// Export metrics in Prometheus format
    pub async fn export_prometheus(&self) -> String {
        let counters = self.counters.read().await;
        let gauges = self.gauges.read().await;

        let mut output = String::new();

        // Export counters
        for (name, value) in counters.iter() {
            output.push_str(&format!("# TYPE {} counter\n", name));
            output.push_str(&format!("{} {}\n", name, value));
        }

        // Export gauges
        for (name, value) in gauges.iter() {
            output.push_str(&format!("# TYPE {} gauge\n", name));
            output.push_str(&format!("{} {}\n", name, value));
        }

        output
    }
}

impl Default for MetricsCollector {
    fn default() -> Self {
        Self::new()
    }
}

/// Metrics snapshot
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MetricsSnapshot {
    pub counters: HashMap<String, f64>,
    pub gauges: HashMap<String, f64>,
    pub timer_summaries: HashMap<String, TimerSummary>,
}

/// Timer statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimerSummary {
    pub count: usize,
    pub sum: f64,
    pub min: f64,
    pub max: f64,
    pub avg: f64,
    pub p50: f64,
    pub p95: f64,
    pub p99: f64,
}

impl TimerSummary {
    fn from_values(values: &[f64]) -> Self {
        if values.is_empty() {
            return Self {
                count: 0,
                sum: 0.0,
                min: 0.0,
                max: 0.0,
                avg: 0.0,
                p50: 0.0,
                p95: 0.0,
                p99: 0.0,
            };
        }

        let mut sorted: Vec<_> = values.to_vec();
        sorted.sort_by(|a, b| a.partial_cmp(b).unwrap());

        let sum: f64 = values.iter().sum();
        let count = values.len();

        Self {
            count,
            sum,
            min: sorted[0],
            max: sorted[count - 1],
            avg: sum / count as f64,
            p50: sorted[(count as f64 * 0.50) as usize],
            p95: sorted[(count as f64 * 0.95) as usize.min(count - 1)],
            p99: sorted[(count as f64 * 0.99) as usize.min(count - 1)],
        }
    }
}

/// Agent health status
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum AgentHealth {
    Healthy,
    Degraded,
    Unhealthy,
    Unknown,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_counter() {
        let collector = MetricsCollector::new();
        collector.record_counter("test.events", 1.0);
        collector.record_counter("test.events", 2.0);

        tokio::time::sleep(tokio::time::Duration::from_millis(10)).await;

        let value = collector.get_counter("test.events").await;
        assert_eq!(value, 3.0);
    }

    #[tokio::test]
    async fn test_gauge() {
        let collector = MetricsCollector::new();
        collector.record_gauge("test.memory", 1024.0);
        collector.record_gauge("test.memory", 2048.0);

        tokio::time::sleep(tokio::time::Duration::from_millis(10)).await;

        let value = collector.get_gauge("test.memory").await;
        assert_eq!(value, 2048.0);
    }

    #[tokio::test]
    async fn test_prometheus_export() {
        let collector = MetricsCollector::new();
        collector.record_counter("events_total", 10.0);
        collector.record_gauge("memory_bytes", 1024.0);

        tokio::time::sleep(tokio::time::Duration::from_millis(10)).await;

        let export = collector.export_prometheus().await;
        assert!(export.contains("events_total"));
        assert!(export.contains("memory_bytes"));
    }
}
