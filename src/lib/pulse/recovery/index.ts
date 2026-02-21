/**
 * Kyro Failure Recovery System
 * Failure detection, isolation, and state restoration
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  FailureRecord,
  FailureType,
  Severity,
  RecoveryAction,
  RecoveryStatus,
  Checkpoint,
  Agent,
  Module,
  Task,
} from '@/types/pulse';
import { EventEmitter } from 'events';

// ============================================
// FAILURE DETECTOR
// ============================================

interface FailureDetection {
  entityId: string;
  entityType: 'module' | 'agent' | 'task';
  failureType: FailureType;
  severity: Severity;
  message: string;
  stackTrace?: string;
  context?: Record<string, unknown>;
}

class FailureDetector {
  private failures: FailureRecord[] = [];
  private maxFailures: number = 1000;
  private emitter = new EventEmitter();

  // Thresholds for automatic detection
  private thresholds = {
    heartbeatTimeout: 90000, // 90 seconds
    errorRateThreshold: 0.5, // 50% error rate
    consecutiveErrors: 5,
  };

  detect(detection: FailureDetection): FailureRecord {
    const record: FailureRecord = {
      id: uuidv4(),
      timestamp: new Date(),
      entityType: detection.entityType,
      entityId: detection.entityId,
      failureType: detection.failureType,
      severity: detection.severity,
      message: detection.message,
      stackTrace: detection.stackTrace,
      recoveryStatus: 'pending',
    };

    this.failures.push(record);

    // Trim old failures
    if (this.failures.length > this.maxFailures) {
      this.failures.shift();
    }

    this.emitter.emit('failure', record);

    // Auto-determine recovery action
    const action = this.determineRecoveryAction(record);
    this.emitter.emit('recoveryAction', { record, action });

    return record;
  }

  private determineRecoveryAction(record: FailureRecord): RecoveryAction {
    // Severity-based decision
    if (record.severity === 'critical') {
      return 'escalate';
    }

    // Failure type-based decision
    switch (record.failureType) {
      case 'crash':
        return 'restart';
      case 'timeout':
        return 'skip';
      case 'resource_exhaustion':
        return 'reload';
      case 'error':
        if (record.severity === 'high') {
          return 'restart';
        }
        return 'skip';
      default:
        return 'restart';
    }
  }

  checkHeartbeat(
    entityType: 'module' | 'agent',
    entityId: string,
    lastHeartbeat: Date | null
  ): boolean {
    if (!lastHeartbeat) return true;

    const timeSinceLastHeartbeat = Date.now() - lastHeartbeat.getTime();

    if (timeSinceLastHeartbeat > this.thresholds.heartbeatTimeout) {
      this.detect({
        entityId,
        entityType,
        failureType: 'timeout',
        severity: timeSinceLastHeartbeat > this.thresholds.heartbeatTimeout * 2 ? 'critical' : 'high',
        message: `Heartbeat timeout: ${Math.floor(timeSinceLastHeartbeat / 1000)}s since last heartbeat`,
      });
      return false;
    }

    return true;
  }

  checkErrorRate(
    entityType: 'module' | 'agent',
    entityId: string,
    successCount: number,
    failureCount: number
  ): boolean {
    const total = successCount + failureCount;
    if (total < 10) return true; // Not enough data

    const errorRate = failureCount / total;

    if (errorRate > this.thresholds.errorRateThreshold) {
      this.detect({
        entityId,
        entityType,
        failureType: 'error',
        severity: errorRate > 0.75 ? 'critical' : 'high',
        message: `High error rate: ${(errorRate * 100).toFixed(1)}% (${failureCount}/${total})`,
      });
      return false;
    }

    return true;
  }

  getFailures(limit: number = 50, filters?: {
    entityType?: string;
    failureType?: string;
    severity?: string;
  }): FailureRecord[] {
    let filtered = this.failures;

    if (filters) {
      filtered = filtered.filter((f) => {
        if (filters.entityType && f.entityType !== filters.entityType) return false;
        if (filters.failureType && f.failureType !== filters.failureType) return false;
        if (filters.severity && f.severity !== filters.severity) return false;
        return true;
      });
    }

    return filtered.slice(-limit);
  }

  getStats() {
    const now = Date.now();
    const last24h = this.failures.filter(
      (f) => now - f.timestamp.getTime() < 24 * 60 * 60 * 1000
    );

    return {
      total: this.failures.length,
      last24h: last24h.length,
      pending: this.failures.filter((f) => f.recoveryStatus === 'pending').length,
      recovered: this.failures.filter((f) => f.recoveryStatus === 'recovered').length,
      failed: this.failures.filter((f) => f.recoveryStatus === 'failed').length,
      byType: this.groupBy(last24h, 'failureType'),
      bySeverity: this.groupBy(last24h, 'severity'),
    };
  }

  private groupBy(records: FailureRecord[], field: keyof FailureRecord): Record<string, number> {
    const groups: Record<string, number> = {};
    for (const record of records) {
      const key = String(record[field]);
      groups[key] = (groups[key] || 0) + 1;
    }
    return groups;
  }

  onFailure(callback: (record: FailureRecord) => void): () => void {
    this.emitter.on('failure', callback);
    return () => this.emitter.off('failure', callback);
  }

  onRecoveryAction(callback: (data: { record: FailureRecord; action: RecoveryAction }) => void): () => void {
    this.emitter.on('recoveryAction', callback);
    return () => this.emitter.off('recoveryAction', callback);
  }
}

// ============================================
// STATE RESTORER
// ============================================

class StateRestorer {
  private checkpoints: Map<string, Checkpoint> = new Map();
  private emitter = new EventEmitter();

  saveCheckpoint(
    entityType: 'kernel' | 'module' | 'agent',
    entityId: string,
    state: Record<string, unknown>
  ): Checkpoint {
    const key = `${entityType}:${entityId}`;
    const existing = this.checkpoints.get(key);

    const checkpoint: Checkpoint = {
      id: existing?.id || uuidv4(),
      entityType,
      entityId,
      state,
      version: (existing?.version || 0) + 1,
    };

    this.checkpoints.set(key, checkpoint);
    this.emitter.emit('checkpointSaved', checkpoint);

    return checkpoint;
  }

  restore(entityType: 'kernel' | 'module' | 'agent', entityId: string): Checkpoint | null {
    const key = `${entityType}:${entityId}`;
    const checkpoint = this.checkpoints.get(key);

    if (!checkpoint) {
      this.emitter.emit('restoreFailed', { entityType, entityId, reason: 'No checkpoint found' });
      return null;
    }

    this.emitter.emit('restored', checkpoint);
    return checkpoint;
  }

  getCheckpoint(entityType: 'kernel' | 'module' | 'agent', entityId: string): Checkpoint | undefined {
    return this.checkpoints.get(`${entityType}:${entityId}`);
  }

  getAllCheckpoints(): Checkpoint[] {
    return Array.from(this.checkpoints.values());
  }

  clearCheckpoint(entityType: 'kernel' | 'module' | 'agent', entityId: string): boolean {
    const key = `${entityType}:${entityId}`;
    const existed = this.checkpoints.has(key);
    this.checkpoints.delete(key);
    return existed;
  }

  onCheckpointSaved(callback: (checkpoint: Checkpoint) => void): () => void {
    this.emitter.on('checkpointSaved', callback);
    return () => this.emitter.off('checkpointSaved', callback);
  }

  onRestored(callback: (checkpoint: Checkpoint) => void): () => void {
    this.emitter.on('restored', callback);
    return () => this.emitter.off('restored', callback);
  }

  onRestoreFailed(callback: (data: { entityType: string; entityId: string; reason: string }) => void): () => void {
    this.emitter.on('restoreFailed', callback);
    return () => this.emitter.off('restoreFailed', callback);
  }
}

// ============================================
// RECOVERY EXECUTOR
// ============================================

interface RecoveryResult {
  success: boolean;
  record: FailureRecord;
  action: RecoveryAction;
  error?: string;
}

class RecoveryExecutor {
  private detector: FailureDetector;
  private restorer: StateRestorer;
  private actionHandlers: Map<RecoveryAction, (record: FailureRecord) => Promise<boolean>> = new Map();
  private emitter = new EventEmitter();

  constructor(detector: FailureDetector, restorer: StateRestorer) {
    this.detector = detector;
    this.restorer = restorer;

    // Set up default handlers
    this.setDefaultHandlers();
  }

  private setDefaultHandlers(): void {
    // Restart handler
    this.actionHandlers.set('restart', async (record) => {
      // In a real implementation, would restart the entity
      this.emitter.emit('actionExecuted', { action: 'restart', record });
      return true;
    });

    // Reload handler
    this.actionHandlers.set('reload', async (record) => {
      const checkpoint = this.restorer.restore(
        record.entityType as 'module' | 'agent',
        record.entityId
      );
      this.emitter.emit('actionExecuted', { action: 'reload', record, checkpoint });
      return !!checkpoint;
    });

    // Skip handler
    this.actionHandlers.set('skip', async () => {
      // Just mark as recovered
      return true;
    });

    // Escalate handler
    this.actionHandlers.set('escalate', async (record) => {
      this.emitter.emit('escalation', record);
      return false; // Cannot auto-recover
    });
  }

  setHandler(action: RecoveryAction, handler: (record: FailureRecord) => Promise<boolean>): void {
    this.actionHandlers.set(action, handler);
  }

  async execute(record: FailureRecord, action: RecoveryAction): Promise<RecoveryResult> {
    const handler = this.actionHandlers.get(action);

    if (!handler) {
      return {
        success: false,
        record,
        action,
        error: `No handler for action: ${action}`,
      };
    }

    try {
      const success = await handler(record);

      // Update failure record
      const updatedRecord = {
        ...record,
        recoveryAction: action,
        recoveryStatus: success ? 'recovered' : 'failed',
        recoveredAt: success ? new Date() : undefined,
      } as FailureRecord;

      this.emitter.emit('recoveryComplete', { success, record: updatedRecord, action });

      return {
        success,
        record: updatedRecord,
        action,
      };
    } catch (error) {
      return {
        success: false,
        record,
        action,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  onActionExecuted(callback: (data: { action: RecoveryAction; record: FailureRecord; checkpoint?: Checkpoint }) => void): () => void {
    this.emitter.on('actionExecuted', callback);
    return () => this.emitter.off('actionExecuted', callback);
  }

  onEscalation(callback: (record: FailureRecord) => void): () => void {
    this.emitter.on('escalation', callback);
    return () => this.emitter.off('escalation', callback);
  }

  onRecoveryComplete(callback: (data: { success: boolean; record: FailureRecord; action: RecoveryAction }) => void): () => void {
    this.emitter.on('recoveryComplete', callback);
    return () => this.emitter.off('recoveryComplete', callback);
  }
}

// ============================================
// RECOVERY MANAGER
// ============================================

export class RecoveryManager {
  private detector: FailureDetector;
  private restorer: StateRestorer;
  private executor: RecoveryExecutor;
  private emitter = new EventEmitter();
  private autoRecoveryEnabled: boolean = true;

  constructor() {
    this.detector = new FailureDetector();
    this.restorer = new StateRestorer();
    this.executor = new RecoveryExecutor(this.detector, this.restorer);

    // Set up automatic recovery
    this.detector.onRecoveryAction(async ({ record, action }) => {
      if (this.autoRecoveryEnabled) {
        await this.recover(record, action);
      }
    });

    // Forward events
    this.detector.onFailure((record) => this.emitter.emit('failure', record));
    this.restorer.onCheckpointSaved((checkpoint) => this.emitter.emit('checkpoint', checkpoint));
    this.restorer.onRestored((checkpoint) => this.emitter.emit('restored', checkpoint));
    this.executor.onRecoveryComplete((data) => this.emitter.emit('recovery', data));
    this.executor.onEscalation((record) => this.emitter.emit('escalation', record));
  }

  // ============================================
  // FAILURE DETECTION
  // ============================================

  detectFailure(detection: FailureDetection): FailureRecord {
    return this.detector.detect(detection);
  }

  checkHeartbeat(entityType: 'module' | 'agent', entityId: string, lastHeartbeat: Date | null): boolean {
    return this.detector.checkHeartbeat(entityType, entityId, lastHeartbeat);
  }

  checkErrorRate(entityType: 'module' | 'agent', entityId: string, successCount: number, failureCount: number): boolean {
    return this.detector.checkErrorRate(entityType, entityId, successCount, failureCount);
  }

  // ============================================
  // STATE MANAGEMENT
  // ============================================

  saveState(entityType: 'kernel' | 'module' | 'agent', entityId: string, state: Record<string, unknown>): Checkpoint {
    return this.restorer.saveCheckpoint(entityType, entityId, state);
  }

  restoreState(entityType: 'kernel' | 'module' | 'agent', entityId: string): Checkpoint | null {
    return this.restorer.restore(entityType, entityId);
  }

  getCheckpoint(entityType: 'kernel' | 'module' | 'agent', entityId: string): Checkpoint | undefined {
    return this.restorer.getCheckpoint(entityType, entityId);
  }

  // ============================================
  // RECOVERY
  // ============================================

  async recover(record: FailureRecord, action?: RecoveryAction): Promise<RecoveryResult> {
    const recoveryAction = action || record.recoveryAction || 'restart';
    const result = await this.executor.execute(record, recoveryAction);
    return result;
  }

  setAutoRecovery(enabled: boolean): void {
    this.autoRecoveryEnabled = enabled;
  }

  setRecoveryHandler(action: RecoveryAction, handler: (record: FailureRecord) => Promise<boolean>): void {
    this.executor.setHandler(action, handler);
  }

  // ============================================
  // QUERY
  // ============================================

  getFailures(limit?: number, filters?: {
    entityType?: string;
    failureType?: string;
    severity?: string;
  }): FailureRecord[] {
    return this.detector.getFailures(limit, filters);
  }

  getCheckpoints(): Checkpoint[] {
    return this.restorer.getAllCheckpoints();
  }

  getStats() {
    return this.detector.getStats();
  }

  // ============================================
  // EVENTS
  // ============================================

  onFailure(callback: (record: FailureRecord) => void): () => void {
    this.emitter.on('failure', callback);
    return () => this.emitter.off('failure', callback);
  }

  onCheckpoint(callback: (checkpoint: Checkpoint) => void): () => void {
    this.emitter.on('checkpoint', callback);
    return () => this.emitter.off('checkpoint', callback);
  }

  onRestored(callback: (checkpoint: Checkpoint) => void): () => void {
    this.emitter.on('restored', callback);
    return () => this.emitter.off('restored', callback);
  }

  onRecovery(callback: (data: { success: boolean; record: FailureRecord; action: RecoveryAction }) => void): () => void {
    this.emitter.on('recovery', callback);
    return () => this.emitter.off('recovery', callback);
  }

  onEscalation(callback: (record: FailureRecord) => void): () => void {
    this.emitter.on('escalation', callback);
    return () => this.emitter.off('escalation', callback);
  }
}

export type { FailureDetection, RecoveryResult };
export const getRecoveryManager = (): RecoveryManager => new RecoveryManager();
