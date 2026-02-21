// PULSE Permission Manager
// Manages capability-based permissions for entities

import type { Permission, Policy, SourceType, RiskLevel } from '@/types/pulse';
import { v4 as uuidv4 } from 'uuid';

export interface PermissionRequest {
  id: string;
  entityId: string;
  entityType: SourceType;
  permission: string;
  timestamp: Date;
}

export interface PermissionResult {
  granted: boolean;
  permission: string;
  reason?: string;
  riskLevel?: RiskLevel;
}

export class PermissionManager {
  private permissions: Map<string, Permission> = new Map();
  private policies: Map<string, Policy> = new Map();
  private entityPermissions: Map<string, Set<string>> = new Map();

  constructor() {
    this.initializeDefaultPermissions();
  }

  private initializeDefaultPermissions(): void {
    // System permissions
    this.registerPermission({
      id: uuidv4(),
      name: 'kernel:control',
      description: 'Control kernel lifecycle',
      category: 'system',
      riskLevel: 'critical',
      isEnabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    this.registerPermission({
      id: uuidv4(),
      name: 'kernel:read',
      description: 'Read kernel state',
      category: 'system',
      riskLevel: 'low',
      isEnabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Storage permissions
    this.registerPermission({
      id: uuidv4(),
      name: 'storage:read',
      description: 'Read from storage',
      category: 'storage',
      riskLevel: 'low',
      isEnabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    this.registerPermission({
      id: uuidv4(),
      name: 'storage:write',
      description: 'Write to storage',
      category: 'storage',
      riskLevel: 'medium',
      isEnabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    this.registerPermission({
      id: uuidv4(),
      name: 'storage:delete',
      description: 'Delete from storage',
      category: 'storage',
      riskLevel: 'high',
      isEnabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Network permissions
    this.registerPermission({
      id: uuidv4(),
      name: 'network:access',
      description: 'Access external network',
      category: 'network',
      riskLevel: 'high',
      isEnabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Model permissions
    this.registerPermission({
      id: uuidv4(),
      name: 'model:use',
      description: 'Use AI models',
      category: 'model',
      riskLevel: 'medium',
      isEnabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Agent permissions
    this.registerPermission({
      id: uuidv4(),
      name: 'agent:create',
      description: 'Create new agents',
      category: 'agent',
      riskLevel: 'high',
      isEnabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    this.registerPermission({
      id: uuidv4(),
      name: 'agent:control',
      description: 'Control agent lifecycle',
      category: 'agent',
      riskLevel: 'medium',
      isEnabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  // Register a permission
  registerPermission(permission: Permission): void {
    this.permissions.set(permission.name, permission);
  }

  // Register a policy
  registerPolicy(policy: Policy): void {
    this.policies.set(policy.name, policy);
  }

  // Grant permission to entity
  grantPermission(entityId: string, permissionName: string): void {
    if (!this.entityPermissions.has(entityId)) {
      this.entityPermissions.set(entityId, new Set());
    }
    this.entityPermissions.get(entityId)!.add(permissionName);
  }

  // Revoke permission from entity
  revokePermission(entityId: string, permissionName: string): void {
    const perms = this.entityPermissions.get(entityId);
    if (perms) {
      perms.delete(permissionName);
    }
  }

  // Check if entity has permission
  hasPermission(entityId: string, permissionName: string): boolean {
    const perms = this.entityPermissions.get(entityId);
    return perms?.has(permissionName) || false;
  }

  // Request permission (with policy check)
  requestPermission(request: PermissionRequest): PermissionResult {
    const permission = this.permissions.get(request.permission);

    if (!permission) {
      return {
        granted: false,
        permission: request.permission,
        reason: 'Permission does not exist',
      };
    }

    if (!permission.isEnabled) {
      return {
        granted: false,
        permission: request.permission,
        reason: 'Permission is disabled',
        riskLevel: permission.riskLevel,
      };
    }

    // Check entity permissions
    if (this.hasPermission(request.entityId, request.permission)) {
      return {
        granted: true,
        permission: request.permission,
        riskLevel: permission.riskLevel,
      };
    }

    // Check policies
    const applicablePolicies = this.getApplicablePolicies(
      request.entityId,
      request.entityType
    );

    for (const policy of applicablePolicies) {
      if (policy.permissions.includes(request.permission)) {
        // Grant via policy
        this.grantPermission(request.entityId, request.permission);
        return {
          granted: true,
          permission: request.permission,
          reason: `Granted by policy: ${policy.name}`,
          riskLevel: permission.riskLevel,
        };
      }
    }

    return {
      granted: false,
      permission: request.permission,
      reason: 'No permission or policy grants access',
      riskLevel: permission.riskLevel,
    };
  }

  // Get policies applicable to an entity
  private getApplicablePolicies(entityId: string, entityType: SourceType): Policy[] {
    const policies: Policy[] = [];

    for (const policy of this.policies.values()) {
      if (!policy.isEnabled) continue;

      // Global policy for entity type
      if (policy.entityType === entityType && !policy.entityId) {
        policies.push(policy);
      }

      // Specific entity policy
      if (policy.entityId === entityId) {
        policies.push(policy);
      }
    }

    // Sort by priority (higher first)
    policies.sort((a, b) => b.priority - a.priority);
    return policies;
  }

  // Get all permissions for an entity
  getEntityPermissions(entityId: string): string[] {
    return Array.from(this.entityPermissions.get(entityId) || []);
  }

  // Get permission details
  getPermission(name: string): Permission | undefined {
    return this.permissions.get(name);
  }

  // Get all permissions
  getAllPermissions(): Permission[] {
    return Array.from(this.permissions.values());
  }

  // Get all policies
  getAllPolicies(): Policy[] {
    return Array.from(this.policies.values());
  }

  // Clear entity permissions
  clearEntityPermissions(entityId: string): void {
    this.entityPermissions.delete(entityId);
  }

  // Get stats
  getStats(): {
    totalPermissions: number;
    totalPolicies: number;
    entitiesWithPermissions: number;
  } {
    return {
      totalPermissions: this.permissions.size,
      totalPolicies: this.policies.size,
      entitiesWithPermissions: this.entityPermissions.size,
    };
  }
}

// Singleton instance
let permissionManagerInstance: PermissionManager | null = null;

export function getPermissionManager(): PermissionManager {
  if (!permissionManagerInstance) {
    permissionManagerInstance = new PermissionManager();
  }
  return permissionManagerInstance;
}

export function resetPermissionManager(): void {
  permissionManagerInstance = null;
}
