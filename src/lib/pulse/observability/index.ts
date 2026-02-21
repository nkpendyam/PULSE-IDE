/**
 * Kyro Observability System
 * Structured logging, metrics, and replay capabilities
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  LogLevel,
  LogCategory,
  LogEntry,
  Metric,
  MetricType,
  SourceType,
} from '@/types/pulse';
import { EventEmitter } from 'events';

// ============================================
// STRUCTURED LOGGER
// ============================================

interface LogOptions {
  level?: LogLevel;
  category?: LogCategory;
  sourceId?: string;
  sourceType?: SourceType;
  metadata?: Record<string, unknown>;
  duration?: number;
  outcome?: 'success' | 'failure' | 'partial';
}

class StructuredLogger {
  private logs: LogEntry[] = [];
  private maxLogs: number = 10000;
  private emitter = new EventEmitter();
  private levelPriority: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
    critical: 4,
  };
  private minLevel: LogLevel = 'debug';

  setMinLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  private shouldLog(level: LogLevel): boolean {
    return this.levelPriority[level] >= this.levelPriority[this.minLevel];
  }

  log(level: LogLevel, message: string, options: LogOptions = {}): LogEntry {
    if (!this.shouldLog(level)) {
      return {} as LogEntry;
    }

    const entry: LogEntry = {
      id: uuidv4(),
      timestamp: new Date(),
      level,
      message,
      sourceId: options.sourceId,
      sourceType: options.sourceType,
      category: options.category,
      metadata: options.metadata,
      duration: options.duration,
      outcome: options.outcome,
    };

    this.logs.push(entry);

    // Trim old logs
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    this.emitter.emit('log', entry);

    // Also log to console in development
    if (process.env.NODE_ENV !== 'production') {
      const consoleMethod = level === 'critical' ? 'error' : level;
      console[consoleMethod](`[${level.toUpperCase()}] ${message}`, options.metadata || '');
    }

    return entry;
  }

  debug(message: string, options?: LogOptions): LogEntry {
    return this.log('debug', message, { ...options, level: 'debug' });
  }

  info(message: string, options?: LogOptions): LogEntry {
    return this.log('info', message, { ...options, level: 'info' });
  }

  warn(message: string, options?: LogOptions): LogEntry {
    return this.log('warn', message, { ...options, level: 'warn' });
  }

  error(message: string, options?: LogOptions): LogEntry {
    return this.log('error', message, { ...options, level: 'error' });
  }

  critical(message: string, options?: LogOptions): LogEntry {
    return this.log('critical', message, { ...options, level: 'critical' });
  }

  // Convenience methods for common patterns
  event(eventType: string, details: Record<string, unknown>, options?: Omit<LogOptions, 'category'>): LogEntry {
    return this.info(`Event: ${eventType}`, {
      ...options,
      category: 'event',
      metadata: details,
    });
  }

  taskStart(taskId: string, taskName: string, options?: Omit<LogOptions, 'category'>): LogEntry {
    return this.debug(`Task started: ${taskName}`, {
      ...options,
      category: 'task',
      sourceId: taskId,
    });
  }

  taskComplete(taskId: string, taskName: string, duration: number, success: boolean, options?: Omit<LogOptions, 'category' | 'duration' | 'outcome'>): LogEntry {
    return this.debug(`Task completed: ${taskName}`, {
      ...options,
      category: 'task',
      sourceId: taskId,
      duration,
      outcome: success ? 'success' : 'failure',
    });
  }

  security(action: string, details: Record<string, unknown>, allowed: boolean, options?: Omit<LogOptions, 'category' | 'outcome'>): LogEntry {
    return this.info(`Security: ${action}`, {
      ...options,
      category: 'security',
      metadata: details,
      outcome: allowed ? 'success' : 'failure',
    });
  }

  getLogs(limit: number = 100, filters?: {
    level?: LogLevel;
    category?: LogCategory;
    sourceId?: string;
    since?: Date;
  }): LogEntry[] {
    let filtered = this.logs;

    if (filters) {
      filtered = filtered.filter((log) => {
        if (filters.level && log.level !== filters.level) return false;
        if (filters.category && log.category !== filters.category) return false;
        if (filters.sourceId && log.sourceId !== filters.sourceId) return false;
        if (filters.since && log.timestamp < filters.since) return false;
        return true;
      });
    }

    return filtered.slice(-limit);
  }

  getStats() {
    const now = Date.now();
    const lastHour = this.logs.filter(
      (log) => now - log.timestamp.getTime() < 60 * 60 * 1000
    );

    return {
      total: this.logs.length,
      lastHour: lastHour.length,
      byLevel: this.groupBy(lastHour, 'level'),
      byCategory: this.groupBy(lastHour, 'category'),
      errors: lastHour.filter((log) => log.level === 'error' || log.level === 'critical').length,
    };
  }

  private groupBy(logs: LogEntry[], field: keyof LogEntry): Record<string, number> {
    const groups: Record<string, number> = {};
    for (const log of logs) {
      const key = String(log[field] || 'unknown');
      groups[key] = (groups[key] || 0) + 1;
    }
    return groups;
  }

  onLog(callback: (log: LogEntry) => void): () => void {
    this.emitter.on('log', callback);
    return () => this.emitter.off('log', callback);
  }

  clear(): void {
    this.logs = [];
  }
}

// ============================================
// METRICS COLLECTOR
// ============================================

interface MetricAggregation {
  min: number;
  max: number;
  avg: number;
  sum: number;
  count: number;
}

class MetricsCollector {
  private metrics: Metric[] = [];
  private maxMetrics: number = 50000;
  private emitter = new EventEmitter();

  record(
    metricType: MetricType,
    value: number,
    unit: string,
    options?: {
      sourceId?: string;
      sourceType?: SourceType;
      tags?: Record<string, string>;
    }
  ): Metric {
    const metric: Metric = {
      id: uuidv4(),
      timestamp: new Date(),
      metricType,
      value,
      unit,
      sourceId: options?.sourceId,
      sourceType: options?.sourceType,
      tags: options?.tags,
    };

    this.metrics.push(metric);

    // Trim old metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics.shift();
    }

    this.emitter.emit('metric', metric);
    return metric;
  }

  // Convenience methods for common metrics
  cpu(value: number, sourceId?: string): Metric {
    return this.record('cpu', value, 'percent', { sourceId });
  }

  memory(value: number, sourceId?: string): Metric {
    return this.record('memory', value, 'mb', { sourceId });
  }

  latency(value: number, sourceId?: string): Metric {
    return this.record('latency', value, 'ms', { sourceId });
  }

  queueLength(value: number, queueType?: string): Metric {
    return this.record('queue_length', value, 'count', {
      tags: queueType ? { queueType } : undefined,
    });
  }

  throughput(value: number, operation?: string): Metric {
    return this.record('throughput', value, 'ops/sec', {
      tags: operation ? { operation } : undefined,
    });
  }

  errorRate(value: number, sourceId?: string): Metric {
    return this.record('error_rate', value, 'percent', { sourceId });
  }

  taskDuration(value: number, taskType?: string): Metric {
    return this.record('task_duration', value, 'ms', {
      tags: taskType ? { taskType } : undefined,
    });
  }

  getMetrics(limit: number = 1000, filters?: {
    metricType?: MetricType;
    sourceId?: string;
    from?: Date;
    to?: Date;
  }): Metric[] {
    let filtered = this.metrics;

    if (filters) {
      filtered = filtered.filter((metric) => {
        if (filters.metricType && metric.metricType !== filters.metricType) return false;
        if (filters.sourceId && metric.sourceId !== filters.sourceId) return false;
        if (filters.from && metric.timestamp < filters.from) return false;
        if (filters.to && metric.timestamp > filters.to) return false;
        return true;
      });
    }

    return filtered.slice(-limit);
  }

  getAggregation(
    metricType: MetricType,
    durationMs: number = 60000
  ): MetricAggregation {
    const cutoff = new Date(Date.now() - durationMs);
    const relevantMetrics = this.metrics.filter(
      (m) => m.metricType === metricType && m.timestamp >= cutoff
    );

    if (relevantMetrics.length === 0) {
      return { min: 0, max: 0, avg: 0, sum: 0, count: 0 };
    }

    const values = relevantMetrics.map((m) => m.value);
    const sum = values.reduce((a, b) => a + b, 0);

    return {
      min: Math.min(...values),
      max: Math.max(...values),
      avg: sum / values.length,
      sum,
      count: values.length,
    };
  }

  getLatest(metricType: MetricType): Metric | undefined {
    for (let i = this.metrics.length - 1; i >= 0; i--) {
      if (this.metrics[i].metricType === metricType) {
        return this.metrics[i];
      }
    }
    return undefined;
  }

  onMetric(callback: (metric: Metric) => void): () => void {
    this.emitter.on('metric', callback);
    return () => this.emitter.off('metric', callback);
  }

  clear(): void {
    this.metrics = [];
  }
}

// ============================================
// REPLAY SYSTEM
// ============================================

interface ReplayEvent {
  id: string;
  timestamp: number;
  type: string;
  data: unknown;
}

class ReplaySystem {
  private events: ReplayEvent[] = [];
  private isRecording: boolean = false;
  private isReplaying: boolean = false;
  private replayIndex: number = 0;
  private emitter = new EventEmitter();

  startRecording(): void {
    this.events = [];
    this.isRecording = true;
    this.emitter.emit('recordingStarted');
  }

  stopRecording(): ReplayEvent[] {
    this.isRecording = false;
    this.emitter.emit('recordingStopped', this.events);
    return this.events;
  }

  recordEvent(type: string, data: unknown): void {
    if (!this.isRecording) return;

    this.events.push({
      id: uuidv4(),
      timestamp: Date.now(),
      type,
      data,
    });
  }

  loadRecording(events: ReplayEvent[]): void {
    this.events = events;
    this.replayIndex = 0;
  }

  startReplay(): void {
    if (this.events.length === 0) return;

    this.isReplaying = true;
    this.replayIndex = 0;
    this.emitter.emit('replayStarted');
  }

  stopReplay(): void {
    this.isReplaying = false;
    this.emitter.emit('replayStopped');
  }

  async step(): Promise<ReplayEvent | null> {
    if (!this.isReplaying || this.replayIndex >= this.events.length) {
      this.stopReplay();
      return null;
    }

    const event = this.events[this.replayIndex];
    this.replayIndex++;
    this.emitter.emit('replayStep', event);

    return event;
  }

  async play(speed: number = 1): Promise<void> {
    if (!this.isReplaying) {
      this.startReplay();
    }

    let previousTimestamp = this.events[0]?.timestamp;

    while (this.isReplaying && this.replayIndex < this.events.length) {
      const event = await this.step();
      if (!event) break;

      if (previousTimestamp && speed > 0) {
        const delay = (event.timestamp - previousTimestamp) / speed;
        if (delay > 0) {
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }

      previousTimestamp = event.timestamp;
    }

    this.stopReplay();
  }

  seek(index: number): void {
    this.replayIndex = Math.max(0, Math.min(index, this.events.length - 1));
  }

  getProgress(): { current: number; total: number; percentage: number } {
    return {
      current: this.replayIndex,
      total: this.events.length,
      percentage: this.events.length > 0
        ? (this.replayIndex / this.events.length) * 100
        : 0,
    };
  }

  isCurrentlyRecording(): boolean {
    return this.isRecording;
  }

  isCurrentlyReplaying(): boolean {
    return this.isReplaying;
  }

  onRecordingStarted(callback: () => void): () => void {
    this.emitter.on('recordingStarted', callback);
    return () => this.emitter.off('recordingStarted', callback);
  }

  onRecordingStopped(callback: (events: ReplayEvent[]) => void): () => void {
    this.emitter.on('recordingStopped', callback);
    return () => this.emitter.off('recordingStopped', callback);
  }

  onReplayStarted(callback: () => void): () => void {
    this.emitter.on('replayStarted', callback);
    return () => this.emitter.off('replayStarted', callback);
  }

  onReplayStep(callback: (event: ReplayEvent) => void): () => void {
    this.emitter.on('replayStep', callback);
    return () => this.emitter.off('replayStep', callback);
  }

  onReplayStopped(callback: () => void): () => void {
    this.emitter.on('replayStopped', callback);
    return () => this.emitter.off('replayStopped', callback);
  }
}

// ============================================
// OBSERVABILITY MANAGER
// ============================================

export class ObservabilityManager {
  private logger: StructuredLogger;
  private metrics: MetricsCollector;
  private replay: ReplaySystem;
  private emitter = new EventEmitter();

  constructor() {
    this.logger = new StructuredLogger();
    this.metrics = new MetricsCollector();
    this.replay = new ReplaySystem();

    // Forward events
    this.logger.onLog((log) => this.emitter.emit('log', log));
    this.metrics.onMetric((metric) => this.emitter.emit('metric', metric));
    this.replay.onReplayStep((event) => this.emitter.emit('replayStep', event));
  }

  // ============================================
  // LOGGING
  // ============================================

  get log(): StructuredLogger {
    return this.logger;
  }

  // ============================================
  // METRICS
  // ============================================

  get metric(): MetricsCollector {
    return this.metrics;
  }

  // ============================================
  // REPLAY
  // ============================================

  get recorder(): ReplaySystem {
    return this.replay;
  }

  // ============================================
  // DASHBOARD DATA
  // ============================================

  getDashboardData() {
    return {
      logs: this.logger.getStats(),
      metrics: {
        cpu: this.metrics.getAggregation('cpu', 60000),
        memory: this.metrics.getAggregation('memory', 60000),
        latency: this.metrics.getAggregation('latency', 60000),
        throughput: this.metrics.getAggregation('throughput', 60000),
        errorRate: this.metrics.getAggregation('error_rate', 60000),
      },
      replay: this.replay.getProgress(),
    };
  }

  // ============================================
  // EVENTS
  // ============================================

  onLog(callback: (log: LogEntry) => void): () => void {
    this.emitter.on('log', callback);
    return () => this.emitter.off('log', callback);
  }

  onMetric(callback: (metric: Metric) => void): () => void {
    this.emitter.on('metric', callback);
    return () => this.emitter.off('metric', callback);
  }

  onReplayStep(callback: (event: ReplayEvent) => void): () => void {
    this.emitter.on('replayStep', callback);
    return () => this.emitter.off('replayStep', callback);
  }
}

export type { LogOptions, MetricAggregation, ReplayEvent };
export const getObservability = (): ObservabilityManager => new ObservabilityManager();
