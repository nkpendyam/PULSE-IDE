// Kyro IDE - Performance Monitor
// Real-time performance tracking and optimization

import { EventEmitter } from 'events';

// ============================================================================
// TYPES
// ============================================================================

export interface PerformanceMetrics {
  // Memory
  heapUsed: number;
  heapTotal: number;
  external: number;
  arrayBuffers: number;
  
  // CPU
  userCPUTime: number;
  systemCPUTime: number;
  
  // Timing
  uptime: number;
  responseTime: number;
  
  // Operations
  operationsPerSecond: number;
  avgLatency: number;
  p95Latency: number;
  p99Latency: number;
  
  // Errors
  errorRate: number;
  errorCount: number;
  
  // Resources
  activeConnections: number;
  pendingOperations: number;
  cacheHitRate: number;
}

export interface PerformanceSample {
  timestamp: number;
  metrics: PerformanceMetrics;
}

export interface PerformanceAlert {
  id: string;
  type: 'memory' | 'cpu' | 'latency' | 'error';
  severity: 'warning' | 'critical';
  message: string;
  value: number;
  threshold: number;
  timestamp: Date;
}

export interface PerformanceConfig {
  sampleInterval: number;
  maxSamples: number;
  memoryWarningThreshold: number;
  memoryCriticalThreshold: number;
  latencyWarningThreshold: number;
  latencyCriticalThreshold: number;
  errorRateWarningThreshold: number;
  errorRateCriticalThreshold: number;
}

// ============================================================================
// PERFORMANCE MONITOR
// ============================================================================

export class PerformanceMonitor extends EventEmitter {
  private samples: PerformanceSample[] = [];
  private alerts: PerformanceAlert[] = [];
  private config: PerformanceConfig;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private operations: number[] = [];
  private latencies: number[] = [];
  private errors: number = 0;
  private cacheHits: number = 0;
  private cacheMisses: number = 0;

  constructor(config: Partial<PerformanceConfig> = {}) {
    super();
    this.config = {
      sampleInterval: config.sampleInterval ?? 5000,
      maxSamples: config.maxSamples ?? 1000,
      memoryWarningThreshold: config.memoryWarningThreshold ?? 0.7,
      memoryCriticalThreshold: config.memoryCriticalThreshold ?? 0.9,
      latencyWarningThreshold: config.latencyWarningThreshold ?? 100,
      latencyCriticalThreshold: config.latencyCriticalThreshold ?? 500,
      errorRateWarningThreshold: config.errorRateWarningThreshold ?? 0.05,
      errorRateCriticalThreshold: config.errorRateCriticalThreshold ?? 0.1,
    };
  }

  // Start monitoring
  start(): void {
    if (this.intervalId) return;
    
    this.intervalId = setInterval(() => {
      this.collectSample();
    }, this.config.sampleInterval);
    
    this.emit('monitor:started');
  }

  // Stop monitoring
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.emit('monitor:stopped');
  }

  // Record an operation
  recordOperation(latency: number, isError: boolean = false): void {
    this.operations.push(Date.now());
    this.latencies.push(latency);
    
    if (isError) {
      this.errors++;
    }
    
    // Clean old operations (older than 1 minute)
    const oneMinuteAgo = Date.now() - 60000;
    this.operations = this.operations.filter(t => t > oneMinuteAgo);
    
    // Keep only last 100 latencies
    if (this.latencies.length > 100) {
      this.latencies = this.latencies.slice(-100);
    }
  }

  // Record cache access
  recordCacheAccess(hit: boolean): void {
    if (hit) {
      this.cacheHits++;
    } else {
      this.cacheMisses++;
    }
  }

  // Get current metrics
  getMetrics(): PerformanceMetrics {
    const memory = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    const uptime = process.uptime();
    
    // Calculate operations per second
    const now = Date.now();
    const oneSecondAgo = now - 1000;
    const opsPerSecond = this.operations.filter(t => t > oneSecondAgo).length;
    
    // Calculate latencies
    const sortedLatencies = [...this.latencies].sort((a, b) => a - b);
    const avgLatency = this.latencies.length > 0
      ? this.latencies.reduce((a, b) => a + b, 0) / this.latencies.length
      : 0;
    const p95Index = Math.floor(sortedLatencies.length * 0.95);
    const p99Index = Math.floor(sortedLatencies.length * 0.99);
    
    // Calculate error rate
    const totalOps = this.operations.length;
    const errorRate = totalOps > 0 ? this.errors / totalOps : 0;
    
    // Calculate cache hit rate
    const totalCache = this.cacheHits + this.cacheMisses;
    const cacheHitRate = totalCache > 0 ? this.cacheHits / totalCache : 0;
    
    return {
      heapUsed: memory.heapUsed,
      heapTotal: memory.heapTotal,
      external: memory.external,
      arrayBuffers: memory.arrayBuffers,
      userCPUTime: cpuUsage.user,
      systemCPUTime: cpuUsage.system,
      uptime,
      responseTime: avgLatency,
      operationsPerSecond: opsPerSecond,
      avgLatency,
      p95Latency: sortedLatencies[p95Index] ?? 0,
      p99Latency: sortedLatencies[p99Index] ?? 0,
      errorRate,
      errorCount: this.errors,
      activeConnections: 0,
      pendingOperations: 0,
      cacheHitRate,
    };
  }

  // Get samples history
  getSamples(limit: number = 100): PerformanceSample[] {
    return this.samples.slice(-limit);
  }

  // Get alerts
  getAlerts(): PerformanceAlert[] {
    return [...this.alerts];
  }

  // Clear alerts
  clearAlerts(): void {
    this.alerts = [];
  }

  // Export metrics for analysis
  export(): string {
    return JSON.stringify({
      config: this.config,
      samples: this.samples,
      alerts: this.alerts,
    }, null, 2);
  }

  // Private methods
  private collectSample(): void {
    const metrics = this.getMetrics();
    const sample: PerformanceSample = {
      timestamp: Date.now(),
      metrics,
    };
    
    // Add to samples
    this.samples.push(sample);
    
    // Trim samples
    if (this.samples.length > this.config.maxSamples) {
      this.samples = this.samples.slice(-this.config.maxSamples);
    }
    
    // Check thresholds
    this.checkThresholds(metrics);
    
    this.emit('sample:collected', sample);
  }

  private checkThresholds(metrics: PerformanceMetrics): void {
    // Memory check
    const memoryUsage = metrics.heapUsed / metrics.heapTotal;
    if (memoryUsage > this.config.memoryCriticalThreshold) {
      this.addAlert('memory', 'critical', 
        `Critical memory usage: ${(memoryUsage * 100).toFixed(1)}%`,
        memoryUsage, this.config.memoryCriticalThreshold);
    } else if (memoryUsage > this.config.memoryWarningThreshold) {
      this.addAlert('memory', 'warning',
        `High memory usage: ${(memoryUsage * 100).toFixed(1)}%`,
        memoryUsage, this.config.memoryWarningThreshold);
    }
    
    // Latency check
    if (metrics.avgLatency > this.config.latencyCriticalThreshold) {
      this.addAlert('latency', 'critical',
        `Critical latency: ${metrics.avgLatency.toFixed(0)}ms`,
        metrics.avgLatency, this.config.latencyCriticalThreshold);
    } else if (metrics.avgLatency > this.config.latencyWarningThreshold) {
      this.addAlert('latency', 'warning',
        `High latency: ${metrics.avgLatency.toFixed(0)}ms`,
        metrics.avgLatency, this.config.latencyWarningThreshold);
    }
    
    // Error rate check
    if (metrics.errorRate > this.config.errorRateCriticalThreshold) {
      this.addAlert('error', 'critical',
        `Critical error rate: ${(metrics.errorRate * 100).toFixed(1)}%`,
        metrics.errorRate, this.config.errorRateCriticalThreshold);
    } else if (metrics.errorRate > this.config.errorRateWarningThreshold) {
      this.addAlert('error', 'warning',
        `High error rate: ${(metrics.errorRate * 100).toFixed(1)}%`,
        metrics.errorRate, this.config.errorRateWarningThreshold);
    }
  }

  private addAlert(
    type: PerformanceAlert['type'],
    severity: PerformanceAlert['severity'],
    message: string,
    value: number,
    threshold: number
  ): void {
    const alert: PerformanceAlert = {
      id: `alert-${Date.now()}`,
      type,
      severity,
      message,
      value,
      threshold,
      timestamp: new Date(),
    };
    
    this.alerts.push(alert);
    this.emit('alert', alert);
  }
}

// Singleton
let monitorInstance: PerformanceMonitor | null = null;

export function getPerformanceMonitor(): PerformanceMonitor {
  if (!monitorInstance) {
    monitorInstance = new PerformanceMonitor();
  }
  return monitorInstance;
}

// ============================================================================
// PERFORMANCE UTILITIES
// ============================================================================

// Debounce with performance tracking
export function perfDebounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): T {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let callCount = 0;
  
  return ((...args: Parameters<T>) => {
    callCount++;
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      const start = performance.now();
      fn(...args);
      const latency = performance.now() - start;
      getPerformanceMonitor().recordOperation(latency);
    }, delay);
  }) as T;
}

// Throttle with performance tracking
export function perfThrottle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  limit: number
): T {
  let lastRun = 0;
  
  return ((...args: Parameters<T>) => {
    const now = Date.now();
    if (now - lastRun >= limit) {
      lastRun = now;
      const start = performance.now();
      fn(...args);
      const latency = performance.now() - start;
      getPerformanceMonitor().recordOperation(latency);
    }
  }) as T;
}

// Measure execution time
export async function measureAsync<T>(
  name: string,
  fn: () => Promise<T>
): Promise<{ result: T; duration: number }> {
  const start = performance.now();
  try {
    const result = await fn();
    const duration = performance.now() - start;
    getPerformanceMonitor().recordOperation(duration);
    return { result, duration };
  } catch (error) {
    const duration = performance.now() - start;
    getPerformanceMonitor().recordOperation(duration, true);
    throw error;
  }
}

// Memory-efficient batch processor
export async function processBatch<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  batchSize: number = 10,
  delayBetweenBatches: number = 0
): Promise<R[]> {
  const results: R[] = [];
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(processor));
    results.push(...batchResults);
    
    if (delayBetweenBatches > 0 && i + batchSize < items.length) {
      await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
    }
  }
  
  return results;
}
