/**
 * Kyro Security Architecture
 * Capability-based permission system with policy enforcement
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  Permission,
  PermissionCategory,
  RiskLevel,
  Policy,
  AuditLog,
  AuditAction,
  AuditOutcome,
} from '@/types/pulse';
import { EventEmitter } from 'events';

// ============================================
// PERMISSION REGISTRY
// ============================================

class PermissionRegistry {
  private permissions: Map<string, Permission> = new Map();
  private emitter = new EventEmitter();

  register(permission: Permission): void {
    this.permissions.set(permission.name, permission);
    this.emitter.emit('registered', permission);
  }

  get(name: string): Permission | undefined {
    return this.permissions.get(name);
  }

  getAll(): Permission[] {
    return Array.from(this.permissions.values());
  }

  getByCategory(category: PermissionCategory): Permission[] {
    return this.getAll().filter((p) => p.category === category);
  }

  getByRiskLevel(riskLevel: RiskLevel): Permission[] {
    return this.getAll().filter((p) => p.riskLevel === riskLevel);
  }

  exists(name: string): boolean {
    return this.permissions.has(name);
  }

  enable(name: string): boolean {
    const permission = this.permissions.get(name);
    if (!permission) return false;
    permission.isEnabled = true;
    return true;
  }

  disable(name: string): boolean {
    const permission = this.permissions.get(name);
    if (!permission) return false;
    permission.isEnabled = false;
    return true;
  }
}

// ============================================
// POLICY ENGINE
// ============================================

interface PolicyEvaluationContext {
  entityType: 'module' | 'agent' | 'user';
  entityId: string;
  permission: string;
  resource?: string;
  metadata?: Record<string, unknown>;
}

interface PolicyEvaluationResult {
  allowed: boolean;
  policy?: Policy;
  reason: string;
}

class PolicyEngine {
  private policies: Map<string, Policy> = new Map();
  private permissionRegistry: PermissionRegistry;
  private emitter = new EventEmitter();

  constructor(permissionRegistry: PermissionRegistry) {
    this.permissionRegistry = permissionRegistry;
  }

  register(policy: Policy): void {
    this.policies.set(policy.id, policy);
    this.emitter.emit('policyRegistered', policy);
  }

  unregister(policyId: string): boolean {
    const policy = this.policies.get(policyId);
    if (!policy) return false;

    this.policies.delete(policyId);
    this.emitter.emit('policyUnregistered', policy);
    return true;
  }

  evaluate(context: PolicyEvaluationContext): PolicyEvaluationResult {
    // Check if permission exists
    const permission = this.permissionRegistry.get(context.permission);
    if (!permission) {
      return {
        allowed: false,
        reason: `Unknown permission: ${context.permission}`,
      };
    }

    if (!permission.isEnabled) {
      return {
        allowed: false,
        reason: `Permission ${context.permission} is disabled`,
      };
    }

    // Find applicable policies
    const applicablePolicies = this.findApplicablePolicies(context);

    if (applicablePolicies.length === 0) {
      // Default deny
      return {
        allowed: false,
        reason: 'No applicable policy found',
      };
    }

    // Evaluate policies in priority order
    for (const policy of applicablePolicies) {
      const result = this.evaluatePolicy(policy, context);
      if (result.allowed) {
        return { ...result, policy };
      }
    }

    return {
      allowed: false,
      reason: 'All policies denied access',
    };
  }

  private findApplicablePolicies(context: PolicyEvaluationContext): Policy[] {
    const policies: Policy[] = [];

    for (const policy of this.policies.values()) {
      if (!policy.isEnabled) continue;

      // Check if policy applies to this entity
      if (policy.entityType === context.entityType) {
        if (policy.entityId === context.entityId || !policy.entityId) {
          policies.push(policy);
        }
      }
    }

    // Sort by priority (higher first)
    policies.sort((a, b) => b.priority - a.priority);

    return policies;
  }

  private evaluatePolicy(
    policy: Policy,
    context: PolicyEvaluationContext
  ): PolicyEvaluationResult {
    // Check if permission is in the allowed list
    if (!policy.permissions.includes(context.permission)) {
      return {
        allowed: false,
        reason: `Permission ${context.permission} not in policy`,
      };
    }

    // Check constraints
    if (policy.constraints) {
      const constraintResult = this.evaluateConstraints(policy.constraints, context);
      if (!constraintResult.allowed) {
        return constraintResult;
      }
    }

    return {
      allowed: true,
      policy,
      reason: 'Access granted by policy',
    };
  }

  private evaluateConstraints(
    constraints: Record<string, unknown>,
    context: PolicyEvaluationContext
  ): PolicyEvaluationResult {
    // Time constraints
    if (constraints.timeWindow) {
      const now = new Date();
      const hour = now.getHours();
      const window = constraints.timeWindow as { start: number; end: number };
      if (hour < window.start || hour >= window.end) {
        return {
          allowed: false,
          reason: 'Outside allowed time window',
        };
      }
    }

    // Rate limiting
    if (constraints.rateLimit) {
      // In a real implementation, would check actual rate
      // For now, just pass
    }

    // Resource constraints
    if (constraints.resources && context.resource) {
      const allowedResources = constraints.resources as string[];
      if (!allowedResources.includes(context.resource)) {
        return {
          allowed: false,
          reason: `Resource ${context.resource} not allowed`,
        };
      }
    }

    return { allowed: true, reason: 'Constraints satisfied' };
  }

  getPolicy(policyId: string): Policy | undefined {
    return this.policies.get(policyId);
  }

  getAllPolicies(): Policy[] {
    return Array.from(this.policies.values());
  }

  onPolicyRegistered(callback: (policy: Policy) => void): () => void {
    this.emitter.on('policyRegistered', callback);
    return () => this.emitter.off('policyRegistered', callback);
  }
}

// ============================================
// AUDIT LOGGER
// ============================================

class AuditLogger {
  private logs: AuditLog[] = [];
  private maxLogs: number = 10000;
  private emitter = new EventEmitter();

  log(entry: Omit<AuditLog, 'id' | 'timestamp'>): AuditLog {
    const auditLog: AuditLog = {
      id: uuidv4(),
      timestamp: new Date(),
      ...entry,
    };

    this.logs.push(auditLog);

    // Trim old logs
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    this.emitter.emit('audit', auditLog);
    return auditLog;
  }

  getLogs(limit: number = 100, filters?: {
    entityType?: string;
    entityId?: string;
    action?: string;
    outcome?: string;
  }): AuditLog[] {
    let filtered = this.logs;

    if (filters) {
      filtered = filtered.filter((log) => {
        if (filters.entityType && log.entityType !== filters.entityType) return false;
        if (filters.entityId && log.entityId !== filters.entityId) return false;
        if (filters.action && log.action !== filters.action) return false;
        if (filters.outcome && log.outcome !== filters.outcome) return false;
        return true;
      });
    }

    return filtered.slice(-limit);
  }

  getStats() {
    const last24h = this.logs.filter(
      (log) => Date.now() - log.timestamp.getTime() < 24 * 60 * 60 * 1000
    );

    return {
      total: this.logs.length,
      last24h: last24h.length,
      allowed: last24h.filter((log) => log.outcome === 'allowed').length,
      denied: last24h.filter((log) => log.outcome === 'denied').length,
      byEntity: this.groupBy(last24h, 'entityType'),
      byAction: this.groupBy(last24h, 'action'),
    };
  }

  private groupBy(logs: AuditLog[], field: keyof AuditLog): Record<string, number> {
    const groups: Record<string, number> = {};
    for (const log of logs) {
      const key = String(log[field]);
      groups[key] = (groups[key] || 0) + 1;
    }
    return groups;
  }

  onAudit(callback: (log: AuditLog) => void): () => void {
    this.emitter.on('audit', callback);
    return () => this.emitter.off('audit', callback);
  }
}

// ============================================
// SECURITY MANAGER
// ============================================

export class SecurityManager {
  private permissionRegistry: PermissionRegistry;
  private policyEngine: PolicyEngine;
  private auditLogger: AuditLogger;
  private emitter = new EventEmitter();

  constructor() {
    this.permissionRegistry = new PermissionRegistry();
    this.policyEngine = new PolicyEngine(this.permissionRegistry);
    this.auditLogger = new AuditLogger();

    this.initializeDefaultPermissions();
    this.initializeDefaultPolicies();

    // Forward events
    this.auditLogger.onAudit((log) => this.emitter.emit('audit', log));
  }

  private initializeDefaultPermissions(): void {
    const defaultPermissions: Permission[] = [
      // System permissions
      {
        id: uuidv4(),
        name: 'system:read',
        description: 'Read system state and configuration',
        category: 'system',
        riskLevel: 'low',
        isEnabled: true,
      },
      {
        id: uuidv4(),
        name: 'system:write',
        description: 'Modify system configuration',
        category: 'system',
        riskLevel: 'high',
        isEnabled: true,
      },
      {
        id: uuidv4(),
        name: 'system:admin',
        description: 'Full system administration',
        category: 'system',
        riskLevel: 'critical',
        isEnabled: true,
      },
      // Storage permissions
      {
        id: uuidv4(),
        name: 'storage:read',
        description: 'Read from storage',
        category: 'storage',
        riskLevel: 'low',
        isEnabled: true,
      },
      {
        id: uuidv4(),
        name: 'storage:write',
        description: 'Write to storage',
        category: 'storage',
        riskLevel: 'medium',
        isEnabled: true,
      },
      {
        id: uuidv4(),
        name: 'storage:delete',
        description: 'Delete from storage',
        category: 'storage',
        riskLevel: 'high',
        isEnabled: true,
      },
      // Model permissions
      {
        id: uuidv4(),
        name: 'model:use',
        description: 'Use AI models',
        category: 'model',
        riskLevel: 'low',
        isEnabled: true,
      },
      {
        id: uuidv4(),
        name: 'model:configure',
        description: 'Configure AI models',
        category: 'model',
        riskLevel: 'medium',
        isEnabled: true,
      },
      // Agent permissions
      {
        id: uuidv4(),
        name: 'agent:spawn',
        description: 'Create new agents',
        category: 'agent',
        riskLevel: 'medium',
        isEnabled: true,
      },
      {
        id: uuidv4(),
        name: 'agent:control',
        description: 'Control agent lifecycle',
        category: 'agent',
        riskLevel: 'high',
        isEnabled: true,
      },
    ];

    for (const permission of defaultPermissions) {
      this.permissionRegistry.register(permission);
    }
  }

  private initializeDefaultPolicies(): void {
    // Default admin policy
    const adminPolicy: Policy = {
      id: uuidv4(),
      name: 'Default Admin Policy',
      description: 'Full access for admin entities',
      entityType: 'user',
      entityId: 'admin',
      permissions: ['system:read', 'system:write', 'system:admin', 'storage:read', 'storage:write', 'storage:delete', 'model:use', 'model:configure', 'agent:spawn', 'agent:control'],
      priority: 100,
      isEnabled: true,
    };

    this.policyEngine.register(adminPolicy);
  }

  // ============================================
  // PERMISSION OPERATIONS
  // ============================================

  registerPermission(permission: Permission): void {
    this.permissionRegistry.register(permission);
  }

  getPermission(name: string): Permission | undefined {
    return this.permissionRegistry.get(name);
  }

  getAllPermissions(): Permission[] {
    return this.permissionRegistry.getAll();
  }

  getPermissionsByCategory(category: PermissionCategory): Permission[] {
    return this.permissionRegistry.getByCategory(category);
  }

  // ============================================
  // POLICY OPERATIONS
  // ============================================

  registerPolicy(policy: Policy): void {
    this.policyEngine.register(policy);
  }

  unregisterPolicy(policyId: string): boolean {
    return this.policyEngine.unregister(policyId);
  }

  getPolicy(policyId: string): Policy | undefined {
    return this.policyEngine.getPolicy(policyId);
  }

  getAllPolicies(): Policy[] {
    return this.policyEngine.getAllPolicies();
  }

  // ============================================
  // ACCESS CONTROL
  // ============================================

  checkPermission(
    entityType: 'module' | 'agent' | 'user',
    entityId: string,
    permission: string,
    resource?: string
  ): { allowed: boolean; reason: string } {
    const result = this.policyEngine.evaluate({
      entityType,
      entityId,
      permission,
      resource,
    });

    // Log the access attempt
    this.auditLogger.log({
      action: 'access',
      entityType,
      entityId,
      permission,
      resource,
      outcome: result.allowed ? 'allowed' : 'denied',
      reason: result.reason,
    });

    if (result.allowed) {
      this.emitter.emit('accessGranted', { entityType, entityId, permission, resource });
    } else {
      this.emitter.emit('accessDenied', { entityType, entityId, permission, resource, reason: result.reason });
    }

    return { allowed: result.allowed, reason: result.reason };
  }

  requestPermission(
    entityType: 'module' | 'agent' | 'user',
    entityId: string,
    permission: string,
    resource?: string
  ): boolean {
    const result = this.checkPermission(entityType, entityId, permission, resource);
    return result.allowed;
  }

  // ============================================
  // AUDIT OPERATIONS
  // ============================================

  getAuditLogs(limit?: number, filters?: {
    entityType?: string;
    entityId?: string;
    action?: string;
    outcome?: string;
  }): AuditLog[] {
    return this.auditLogger.getLogs(limit, filters);
  }

  getAuditStats() {
    return this.auditLogger.getStats();
  }

  // ============================================
  // EVENTS
  // ============================================

  onAudit(callback: (log: AuditLog) => void): () => void {
    this.emitter.on('audit', callback);
    return () => this.emitter.off('audit', callback);
  }

  onAccessGranted(callback: (data: { entityType: string; entityId: string; permission: string; resource?: string }) => void): () => void {
    this.emitter.on('accessGranted', callback);
    return () => this.emitter.off('accessGranted', callback);
  }

  onAccessDenied(callback: (data: { entityType: string; entityId: string; permission: string; resource?: string; reason: string }) => void): () => void {
    this.emitter.on('accessDenied', callback);
    return () => this.emitter.off('accessDenied', callback);
  }
}

export const getSecurityManager = (): SecurityManager => new SecurityManager();
