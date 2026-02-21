/**
 * PULSE Storage Manager
 * Persistent storage with transactional guarantees
 */

import { db } from '@/lib/db';
import type {
  Event,
  Task,
  Module,
  Agent,
  LogEntry,
  Metric,
  MemoryRecord,
  Permission,
  Policy,
  AuditLog,
  FailureRecord,
  Checkpoint,
  SystemConfiguration,
} from '@/types/pulse';
import { EventEmitter } from 'events';

// ============================================
// STORAGE MANAGER
// ============================================

export class StorageManager {
  private static instance: StorageManager | null = null;
  private emitter = new EventEmitter();
  private writeQueue: Array<() => Promise<void>> = [];
  private isProcessing: boolean = false;

  private constructor() {}

  static getInstance(): StorageManager {
    if (!StorageManager.instance) {
      StorageManager.instance = new StorageManager();
    }
    return StorageManager.instance;
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.writeQueue.length === 0) return;

    this.isProcessing = true;
    while (this.writeQueue.length > 0) {
      const operation = this.writeQueue.shift();
      if (operation) {
        try {
          await operation();
        } catch (error) {
          console.error('Storage operation failed:', error);
        }
      }
    }
    this.isProcessing = false;
  }

  private enqueue(operation: () => Promise<void>): void {
    this.writeQueue.push(operation);
    this.processQueue();
  }

  // ============================================
  // SYSTEM STATE
  // ============================================

  async getSystemState() {
    const state = await db.systemState.findFirst();
    if (!state) {
      return db.systemState.create({
        data: {
          kernelState: 'init',
          monotonicClock: 0,
          version: '1.0.0',
          uptime: 0,
        },
      });
    }
    return state;
  }

  async updateSystemState(data: {
    kernelState?: string;
    monotonicClock?: number;
    uptime?: number;
    lastHeartbeat?: Date;
  }) {
    const state = await this.getSystemState();
    return db.systemState.update({
      where: { id: state.id },
      data: {
        ...data,
        lastHeartbeat: data.lastHeartbeat || new Date(),
      },
    });
  }

  // ============================================
  // CONFIGURATION
  // ============================================

  async getConfiguration(key: string): Promise<SystemConfiguration | null> {
    const config = await db.configuration.findUnique({ where: { key } });
    if (!config) return null;
    return {
      key: config.key,
      value: config.value,
      category: config.category,
      description: config.description || undefined,
      isSecret: config.isSecret,
    };
  }

  async setConfiguration(key: string, value: string, category: string = 'general', description?: string, isSecret: boolean = false) {
    return db.configuration.upsert({
      where: { key },
      update: { value, category, description, isSecret },
      create: { key, value, category, description, isSecret },
    });
  }

  async getAllConfigurations(category?: string) {
    return db.configuration.findMany({
      where: category ? { category } : undefined,
    });
  }

  // ============================================
  // EVENTS
  // ============================================

  async storeEvent(event: Event): Promise<void> {
    this.enqueue(async () => {
      await db.event.create({
        data: {
          id: event.id,
          timestamp: event.timestamp,
          eventType: event.eventType,
          sourceId: event.sourceId,
          sourceType: event.sourceType,
          priority: this.priorityToNumber(event.priority),
          payload: JSON.stringify(event.payload),
          executionCtx: JSON.stringify(event.executionContext),
          status: event.status,
          processedAt: event.processedAt,
          result: event.result ? JSON.stringify(event.result) : null,
          retryCount: event.retryCount,
        },
      });
    });
  }

  async getEvents(limit: number = 100, offset: number = 0, filters?: {
    eventType?: string;
    sourceId?: string;
    status?: string;
  }) {
    return db.event.findMany({
      where: {
        eventType: filters?.eventType,
        sourceId: filters?.sourceId,
        status: filters?.status,
      },
      take: limit,
      skip: offset,
      orderBy: { timestamp: 'desc' },
    });
  }

  async updateEventStatus(eventId: string, status: string, result?: unknown): Promise<void> {
    this.enqueue(async () => {
      await db.event.update({
        where: { id: eventId },
        data: {
          status,
          processedAt: new Date(),
          result: result ? JSON.stringify(result) : null,
        },
      });
    });
  }

  private priorityToNumber(priority: string): number {
    const map: Record<string, number> = {
      critical: 4,
      high: 3,
      normal: 2,
      low: 1,
    };
    return map[priority] || 2;
  }

  // ============================================
  // TASKS
  // ============================================

  async storeTask(task: Task): Promise<void> {
    this.enqueue(async () => {
      await db.task.upsert({
        where: { id: task.id },
        update: {
          name: task.name,
          description: task.description,
          type: task.type,
          priority: task.priority,
          status: task.status,
          payload: JSON.stringify(task.payload),
          result: task.result ? JSON.stringify(task.result) : null,
          error: task.error,
          sourceId: task.sourceId,
          sourceType: task.sourceType,
          dependencies: JSON.stringify(task.dependencies),
          scheduledAt: task.scheduledAt,
          startedAt: task.startedAt,
          completedAt: task.completedAt,
          timeout: task.timeout,
          retryCount: task.retryCount,
          maxRetries: task.maxRetries,
          resourceBudget: JSON.stringify(task.resourceBudget),
        },
        create: {
          id: task.id,
          name: task.name,
          description: task.description,
          type: task.type,
          priority: task.priority,
          status: task.status,
          payload: JSON.stringify(task.payload),
          sourceId: task.sourceId,
          sourceType: task.sourceType,
          dependencies: JSON.stringify(task.dependencies),
          scheduledAt: task.scheduledAt,
          timeout: task.timeout,
          maxRetries: task.maxRetries,
          resourceBudget: JSON.stringify(task.resourceBudget),
        },
      });
    });
  }

  async getTasks(limit: number = 100, offset: number = 0, filters?: {
    status?: string;
    type?: string;
    sourceId?: string;
  }) {
    return db.task.findMany({
      where: {
        status: filters?.status,
        type: filters?.type,
        sourceId: filters?.sourceId,
      },
      take: limit,
      skip: offset,
      orderBy: { createdAt: 'desc' },
    });
  }

  async getTask(taskId: string) {
    return db.task.findUnique({ where: { id: taskId } });
  }

  async updateTaskStatus(taskId: string, status: string, result?: unknown, error?: string): Promise<void> {
    this.enqueue(async () => {
      await db.task.update({
        where: { id: taskId },
        data: {
          status,
          result: result ? JSON.stringify(result) : null,
          error,
          completedAt: status === 'completed' || status === 'failed' ? new Date() : null,
        },
      });
    });
  }

  // ============================================
  // MODULES
  // ============================================

  async storeModule(module: Module): Promise<void> {
    this.enqueue(async () => {
      await db.module.upsert({
        where: { id: module.id },
        update: {
          name: module.name,
          version: module.version,
          description: module.description,
          entryPoint: module.entryPoint,
          manifest: JSON.stringify(module.manifest),
          permissions: JSON.stringify(module.permissions),
          dependencies: JSON.stringify(module.dependencies),
          status: module.status,
          isEnabled: module.isEnabled,
          lastError: module.lastError,
          resourceUsage: JSON.stringify(module.resourceUsage),
        },
        create: {
          id: module.id,
          name: module.name,
          version: module.version,
          description: module.description,
          entryPoint: module.entryPoint,
          manifest: JSON.stringify(module.manifest),
          permissions: JSON.stringify(module.permissions),
          dependencies: JSON.stringify(module.dependencies),
          status: module.status,
          isEnabled: module.isEnabled,
          resourceUsage: JSON.stringify(module.resourceUsage),
        },
      });
    });
  }

  async getModules(filters?: { status?: string; isEnabled?: boolean }) {
    return db.module.findMany({
      where: {
        status: filters?.status,
        isEnabled: filters?.isEnabled,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getModule(moduleId: string) {
    return db.module.findUnique({ where: { id: moduleId } });
  }

  async deleteModule(moduleId: string): Promise<void> {
    this.enqueue(async () => {
      await db.module.delete({ where: { id: moduleId } });
    });
  }

  // ============================================
  // AGENTS
  // ============================================

  async storeAgent(agent: Agent): Promise<void> {
    this.enqueue(async () => {
      await db.agent.upsert({
        where: { id: agent.id },
        update: {
          name: agent.name,
          type: agent.type,
          description: agent.description,
          config: JSON.stringify(agent.config),
          status: agent.status,
          health: agent.health,
          lastHeartbeat: agent.lastHeartbeat,
          lastError: agent.lastError,
          taskCount: agent.taskCount,
          successCount: agent.successCount,
          failureCount: agent.failureCount,
          currentTask: agent.currentTask,
          state: JSON.stringify(agent.state),
        },
        create: {
          id: agent.id,
          name: agent.name,
          type: agent.type,
          description: agent.description,
          config: JSON.stringify(agent.config),
          status: agent.status,
          health: agent.health,
          taskCount: agent.taskCount,
          successCount: agent.successCount,
          failureCount: agent.failureCount,
          state: JSON.stringify(agent.state),
        },
      });
    });
  }

  async getAgents(filters?: { status?: string; health?: string }) {
    return db.agent.findMany({
      where: {
        status: filters?.status,
        health: filters?.health,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getAgent(agentId: string) {
    return db.agent.findUnique({ where: { id: agentId } });
  }

  async deleteAgent(agentId: string): Promise<void> {
    this.enqueue(async () => {
      await db.agent.delete({ where: { id: agentId } });
    });
  }

  // ============================================
  // LOGS
  // ============================================

  async storeLog(log: LogEntry): Promise<void> {
    this.enqueue(async () => {
      await db.log.create({
        data: {
          timestamp: log.timestamp,
          level: log.level,
          message: log.message,
          sourceId: log.sourceId,
          sourceType: log.sourceType,
          category: log.category,
          metadata: log.metadata ? JSON.stringify(log.metadata) : null,
          duration: log.duration,
          outcome: log.outcome,
        },
      });
    });
  }

  async getLogs(limit: number = 100, offset: number = 0, filters?: {
    level?: string;
    sourceId?: string;
    category?: string;
  }) {
    return db.log.findMany({
      where: {
        level: filters?.level,
        sourceId: filters?.sourceId,
        category: filters?.category,
      },
      take: limit,
      skip: offset,
      orderBy: { timestamp: 'desc' },
    });
  }

  async clearOldLogs(beforeDate: Date): Promise<number> {
    const result = await db.log.deleteMany({
      where: { timestamp: { lt: beforeDate } },
    });
    return result.count;
  }

  // ============================================
  // METRICS
  // ============================================

  async storeMetric(metric: Metric): Promise<void> {
    this.enqueue(async () => {
      await db.metric.create({
        data: {
          timestamp: metric.timestamp,
          metricType: metric.metricType,
          value: metric.value,
          unit: metric.unit,
          sourceId: metric.sourceId,
          sourceType: metric.sourceType,
          tags: metric.tags ? JSON.stringify(metric.tags) : null,
        },
      });
    });
  }

  async getMetrics(limit: number = 100, filters?: {
    metricType?: string;
    sourceId?: string;
    from?: Date;
    to?: Date;
  }) {
    return db.metric.findMany({
      where: {
        metricType: filters?.metricType,
        sourceId: filters?.sourceId,
        timestamp: {
          gte: filters?.from,
          lte: filters?.to,
        },
      },
      take: limit,
      orderBy: { timestamp: 'asc' },
    });
  }

  // ============================================
  // MEMORY RECORDS
  // ============================================

  async storeMemory(record: MemoryRecord): Promise<void> {
    this.enqueue(async () => {
      await db.memoryRecord.upsert({
        where: { key: record.key },
        update: {
          value: JSON.stringify(record.value),
          type: record.type,
          source: record.source,
          importance: record.importance,
          accessCount: record.accessCount,
          lastAccessed: record.lastAccessed,
          expiresAt: record.expiresAt,
          tags: JSON.stringify(record.tags),
        },
        create: {
          key: record.key,
          value: JSON.stringify(record.value),
          type: record.type,
          source: record.source,
          importance: record.importance,
          tags: JSON.stringify(record.tags),
        },
      });
    });
  }

  async getMemory(key: string): Promise<MemoryRecord | null> {
    const record = await db.memoryRecord.findUnique({ where: { key } });
    if (!record) return null;

    // Update access count
    this.enqueue(async () => {
      await db.memoryRecord.update({
        where: { key },
        data: {
          accessCount: { increment: 1 },
          lastAccessed: new Date(),
        },
      });
    });

    return {
      id: record.id,
      key: record.key,
      value: JSON.parse(record.value),
      type: record.type as MemoryRecord['type'],
      source: record.source || undefined,
      importance: record.importance,
      accessCount: record.accessCount,
      lastAccessed: record.lastAccessed || undefined,
      expiresAt: record.expiresAt || undefined,
      tags: JSON.parse(record.tags || '[]'),
    };
  }

  async searchMemory(query: string, limit: number = 10): Promise<MemoryRecord[]> {
    const records = await db.memoryRecord.findMany({
      where: {
        OR: [
          { key: { contains: query } },
          { value: { contains: query } },
        ],
      },
      take: limit,
      orderBy: { importance: 'desc' },
    });

    return records.map((r) => ({
      id: r.id,
      key: r.key,
      value: JSON.parse(r.value),
      type: r.type as MemoryRecord['type'],
      source: r.source || undefined,
      importance: r.importance,
      accessCount: r.accessCount,
      lastAccessed: r.lastAccessed || undefined,
      expiresAt: r.expiresAt || undefined,
      tags: JSON.parse(r.tags || '[]'),
    }));
  }

  // ============================================
  // SECURITY
  // ============================================

  async storePermission(permission: Permission): Promise<void> {
    this.enqueue(async () => {
      await db.permission.upsert({
        where: { id: permission.id },
        update: {
          name: permission.name,
          description: permission.description,
          category: permission.category,
          riskLevel: permission.riskLevel,
          isEnabled: permission.isEnabled,
        },
        create: {
          id: permission.id,
          name: permission.name,
          description: permission.description,
          category: permission.category,
          riskLevel: permission.riskLevel,
          isEnabled: permission.isEnabled,
        },
      });
    });
  }

  async getPermissions() {
    return db.permission.findMany({ where: { isEnabled: true } });
  }

  async storePolicy(policy: Policy): Promise<void> {
    this.enqueue(async () => {
      await db.policy.upsert({
        where: { id: policy.id },
        update: {
          name: policy.name,
          description: policy.description,
          entityType: policy.entityType,
          entityId: policy.entityId,
          permissions: JSON.stringify(policy.permissions),
          constraints: policy.constraints ? JSON.stringify(policy.constraints) : null,
          priority: policy.priority,
          isEnabled: policy.isEnabled,
        },
        create: {
          id: policy.id,
          name: policy.name,
          description: policy.description,
          entityType: policy.entityType,
          entityId: policy.entityId,
          permissions: JSON.stringify(policy.permissions),
          constraints: policy.constraints ? JSON.stringify(policy.constraints) : null,
          priority: policy.priority,
          isEnabled: policy.isEnabled,
        },
      });
    });
  }

  async getPolicies(entityType?: string, entityId?: string) {
    return db.policy.findMany({
      where: {
        entityType,
        entityId,
        isEnabled: true,
      },
      orderBy: { priority: 'desc' },
    });
  }

  async storeAuditLog(audit: AuditLog): Promise<void> {
    this.enqueue(async () => {
      await db.auditLog.create({
        data: {
          timestamp: audit.timestamp,
          action: audit.action,
          entityType: audit.entityType,
          entityId: audit.entityId,
          permission: audit.permission,
          resource: audit.resource,
          outcome: audit.outcome,
          reason: audit.reason,
          metadata: audit.metadata ? JSON.stringify(audit.metadata) : null,
        },
      });
    });
  }

  async getAuditLogs(limit: number = 100, filters?: {
    entityType?: string;
    action?: string;
  }) {
    return db.auditLog.findMany({
      where: {
        entityType: filters?.entityType,
        action: filters?.action,
      },
      take: limit,
      orderBy: { timestamp: 'desc' },
    });
  }

  // ============================================
  // RECOVERY
  // ============================================

  async storeFailure(failure: FailureRecord): Promise<void> {
    this.enqueue(async () => {
      await db.failureRecord.create({
        data: {
          timestamp: failure.timestamp,
          entityType: failure.entityType,
          entityId: failure.entityId,
          failureType: failure.failureType,
          severity: failure.severity,
          message: failure.message,
          stackTrace: failure.stackTrace,
          recoveryAction: failure.recoveryAction,
          recoveryStatus: failure.recoveryStatus,
        },
      });
    });
  }

  async getFailures(limit: number = 50) {
    return db.failureRecord.findMany({
      take: limit,
      orderBy: { timestamp: 'desc' },
    });
  }

  async storeCheckpoint(checkpoint: Checkpoint): Promise<void> {
    this.enqueue(async () => {
      await db.checkpoint.upsert({
        where: {
          entityType_entityId: {
            entityType: checkpoint.entityType,
            entityId: checkpoint.entityId,
          },
        },
        update: {
          state: JSON.stringify(checkpoint.state),
          version: checkpoint.version,
        },
        create: {
          entityType: checkpoint.entityType,
          entityId: checkpoint.entityId,
          state: JSON.stringify(checkpoint.state),
          version: checkpoint.version,
        },
      });
    });
  }

  async getCheckpoint(entityType: string, entityId: string): Promise<Checkpoint | null> {
    const checkpoint = await db.checkpoint.findUnique({
      where: {
        entityType_entityId: { entityType, entityId },
      },
    });

    if (!checkpoint) return null;

    return {
      id: checkpoint.id,
      entityType: checkpoint.entityType as Checkpoint['entityType'],
      entityId: checkpoint.entityId,
      state: JSON.parse(checkpoint.state),
      version: checkpoint.version,
    };
  }

  // ============================================
  // CLEANUP
  // ============================================

  async cleanup(olderThanDays: number = 30): Promise<{
    logs: number;
    metrics: number;
    events: number;
  }> {
    const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);

    const logs = await db.log.deleteMany({ where: { timestamp: { lt: cutoff } } });
    const metrics = await db.metric.deleteMany({ where: { timestamp: { lt: cutoff } } });
    const events = await db.event.deleteMany({
      where: {
        timestamp: { lt: cutoff },
        status: { in: ['processed', 'failed'] },
      },
    });

    return {
      logs: logs.count,
      metrics: metrics.count,
      events: events.count,
    };
  }
}

export const getStorage = (): StorageManager => StorageManager.getInstance();
