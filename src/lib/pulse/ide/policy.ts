// Kyro IDE - Policy Engine
// User control over AI actions and safety features

import { Policy, PolicyRule, PolicyDecision, PolicyMode } from '@/types/ide';
import { EventEmitter } from 'events';

// ============================================================================
// DEFAULT POLICIES
// ============================================================================

const DEFAULT_POLICIES: Policy[] = [
  {
    id: 'file-write',
    name: 'File Write Protection',
    description: 'Control which files AI agents can modify',
    mode: 'review',
    rules: [
      {
        id: 'protect-config',
        type: 'ask',
        resource: 'file',
        pattern: '**/{package.json,tsconfig.json,.env*,*.config.*}',
        message: 'AI is trying to modify a configuration file'
      },
      {
        id: 'allow-src',
        type: 'allow',
        resource: 'file',
        pattern: 'src/**/*'
      },
      {
        id: 'deny-system',
        type: 'deny',
        resource: 'file',
        pattern: '**/{.git/**,node_modules/**}'
      }
    ],
    enabled: true,
    priority: 100
  },
  {
    id: 'command-execution',
    name: 'Command Execution Control',
    description: 'Control which commands AI agents can execute',
    mode: 'review',
    rules: [
      {
        id: 'ask-install',
        type: 'ask',
        resource: 'command',
        pattern: '{npm,yarn,pnpm,pipeg,bun} {install,add,remove,uninstall}*',
        message: 'AI is trying to install/remove packages'
      },
      {
        id: 'deny-dangerous',
        type: 'deny',
        resource: 'command',
        pattern: '{rm,del,format,shutdown,reboot}*',
        message: 'Dangerous command blocked'
      },
      {
        id: 'allow-safe',
        type: 'allow',
        resource: 'command',
        pattern: '{git,ls,cat,echo,npm test,npm run}*'
      }
    ],
    enabled: true,
    priority: 100
  },
  {
    id: 'network-access',
    name: 'Network Access Control',
    description: 'Control network requests made by AI agents',
    mode: 'review',
    rules: [
      {
        id: 'ask-external',
        type: 'ask',
        resource: 'network',
        pattern: 'https://*',
        message: 'AI is trying to make an external network request'
      },
      {
        id: 'allow-local',
        type: 'allow',
        resource: 'network',
        pattern: 'http://localhost*'
      }
    ],
    enabled: true,
    priority: 90
  },
  {
    id: 'model-access',
    name: 'Model Access Control',
    description: 'Control which AI models can be used',
    mode: 'off',
    rules: [
      {
        id: 'allow-all-models',
        type: 'allow',
        resource: 'model',
        pattern: '*'
      }
    ],
    enabled: true,
    priority: 50
  }
];

// ============================================================================
// POLICY ENGINE
// ============================================================================

export class PolicyEngine extends EventEmitter {
  private policies: Map<string, Policy> = new Map();
  private mode: PolicyMode = 'review';
  private pendingApprovals: Map<string, { resolve: (allowed: boolean) => void; action: string }> = new Map();

  constructor() {
    super();
    this.initializePolicies();
  }

  private initializePolicies(): void {
    DEFAULT_POLICIES.forEach(policy => {
      this.policies.set(policy.id, policy);
    });
  }

  // Get all policies
  getPolicies(): Policy[] {
    return Array.from(this.policies.values()).sort((a, b) => b.priority - a.priority);
  }

  // Get specific policy
  getPolicy(id: string): Policy | undefined {
    return this.policies.get(id);
  }

  // Add or update policy
  setPolicy(policy: Policy): void {
    this.policies.set(policy.id, policy);
    this.emit('policy:updated', policy);
  }

  // Remove policy
  removePolicy(id: string): boolean {
    const removed = this.policies.delete(id);
    if (removed) {
      this.emit('policy:removed', id);
    }
    return removed;
  }

  // Set global mode
  setMode(mode: PolicyMode): void {
    this.mode = mode;
    this.emit('mode:changed', mode);
  }

  // Get current mode
  getMode(): PolicyMode {
    return this.mode;
  }

  // Evaluate an action against policies
  evaluate(resource: 'file' | 'command' | 'network' | 'model' | 'tool', action: string): PolicyDecision {
    // If mode is off, allow everything
    if (this.mode === 'off') {
      return {
        allowed: true,
        reason: 'Policy mode is off - all actions allowed',
        requiresApproval: false
      };
    }

    // If mode is strict, require approval for everything
    if (this.mode === 'strict') {
      return {
        allowed: false,
        reason: 'Strict mode - all actions require approval',
        requiresApproval: true
      };
    }

    const policies = this.getPolicies()
      .filter(p => p.enabled)
      .filter(p => p.rules.some(r => r.resource === resource));

    for (const policy of policies) {
      for (const rule of policy.rules) {
        if (rule.resource !== resource) continue;

        if (this.matchesPattern(action, rule.pattern)) {
          switch (rule.type) {
            case 'allow':
              return {
                allowed: true,
                reason: `Allowed by rule: ${rule.id} (${policy.name})`,
                rule,
                requiresApproval: false
              };
            case 'deny':
              return {
                allowed: false,
                reason: rule.message || `Denied by rule: ${rule.id} (${policy.name})`,
                rule,
                requiresApproval: false
              };
            case 'ask':
              if (this.mode === 'agent') {
                // In agent mode, AI decides
                return {
                  allowed: true,
                  reason: `Auto-approved in agent mode: ${rule.id}`,
                  rule,
                  requiresApproval: false
                };
              }
              // In review mode, require user approval
              return {
                allowed: false,
                reason: rule.message || `Requires approval: ${rule.id} (${policy.name})`,
                rule,
                requiresApproval: true
              };
          }
        }
      }
    }

    // Default: allow if no rules match
    return {
      allowed: true,
      reason: 'No matching policy - default allow',
      requiresApproval: this.mode === 'review'
    };
  }

  // Check if action matches pattern
  private matchesPattern(action: string, pattern: string): boolean {
    // Convert glob pattern to regex
    const regexPattern = pattern
      .replace(/\*\*/g, '<<DOUBLESTAR>>')
      .replace(/\*/g, '[^/]*')
      .replace(/<<DOUBLESTAR>>/g, '.*')
      .replace(/{([^}]+)}/g, (_, group: string) => {
        const options = group.split(',').map(o => o.trim());
        return `(${options.join('|')})`;
      });

    const regex = new RegExp(`^${regexPattern}$`, 'i');
    return regex.test(action);
  }

  // Request user approval
  async requestApproval(actionId: string, action: string, description: string): Promise<boolean> {
    return new Promise((resolve) => {
      this.pendingApprovals.set(actionId, { resolve, action });
      this.emit('approval:requested', { actionId, action, description });
    });
  }

  // Approve a pending action
  approve(actionId: string): void {
    const pending = this.pendingApprovals.get(actionId);
    if (pending) {
      pending.resolve(true);
      this.pendingApprovals.delete(actionId);
      this.emit('approval:granted', actionId);
    }
  }

  // Deny a pending action
  deny(actionId: string): void {
    const pending = this.pendingApprovals.get(actionId);
    if (pending) {
      pending.resolve(false);
      this.pendingApprovals.delete(actionId);
      this.emit('approval:denied', actionId);
    }
  }

  // Get pending approvals
  getPendingApprovals(): Array<{ actionId: string; action: string }> {
    return Array.from(this.pendingApprovals.entries()).map(([id, { action }]) => ({
      actionId: id,
      action
    }));
  }

  // Create a policy from template
  createPolicyFromTemplate(template: 'read-only' | 'full-access' | 'safe-development'): Policy[] {
    switch (template) {
      case 'read-only':
        return [
          {
            id: 'readonly-files',
            name: 'Read Only Mode',
            description: 'Prevent all file modifications',
            mode: 'off',
            rules: [{ id: 'deny-write', type: 'deny', resource: 'file', pattern: '**/*' }],
            enabled: true,
            priority: 1000
          }
        ];
      case 'full-access':
        return [
          {
            id: 'full-access',
            name: 'Full Access',
            description: 'Allow all actions without restrictions',
            mode: 'off',
            rules: [{ id: 'allow-all', type: 'allow', resource: 'file', pattern: '*' }],
            enabled: true,
            priority: 1
          }
        ];
      case 'safe-development':
        return DEFAULT_POLICIES;
    }
  }

  // Export policies
  exportPolicies(): string {
    return JSON.stringify(Array.from(this.policies.values()), null, 2);
  }

  // Import policies
  importPolicies(json: string): void {
    try {
      const policies = JSON.parse(json) as Policy[];
      policies.forEach(policy => {
        this.policies.set(policy.id, policy);
      });
      this.emit('policies:imported', policies.length);
    } catch (error) {
      this.emit('policies:import-error', error);
    }
  }
}

// Singleton instance
let policyEngineInstance: PolicyEngine | null = null;

export function getPolicyEngine(): PolicyEngine {
  if (!policyEngineInstance) {
    policyEngineInstance = new PolicyEngine();
  }
  return policyEngineInstance;
}
