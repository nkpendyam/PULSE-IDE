// Kyro Event Validator
// Validates events before processing

import type { Event, ExecutionContext } from '@/types/pulse';

// Event type definition
export interface EventTypeDefinition {
  type: string;
  category: string;
  description: string;
  minPriority?: 'low' | 'normal' | 'high' | 'critical';
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// Built-in event types
const BUILTIN_EVENT_TYPES: Map<string, EventTypeDefinition> = new Map([
  // Kernel events
  ['kernel:start', { type: 'kernel:start', category: 'system', description: 'Kernel started' }],
  ['kernel:stop', { type: 'kernel:stop', category: 'system', description: 'Kernel stopped' }],
  ['kernel:pause', { type: 'kernel:pause', category: 'system', description: 'Kernel paused' }],
  ['kernel:resume', { type: 'kernel:resume', category: 'system', description: 'Kernel resumed' }],
  ['kernel:heartbeat', { type: 'kernel:heartbeat', category: 'system', description: 'Kernel heartbeat' }],
  
  // Task events
  ['task:created', { type: 'task:created', category: 'task', description: 'Task created' }],
  ['task:started', { type: 'task:started', category: 'task', description: 'Task started' }],
  ['task:completed', { type: 'task:completed', category: 'task', description: 'Task completed' }],
  ['task:failed', { type: 'task:failed', category: 'task', description: 'Task failed' }],
  ['task:cancelled', { type: 'task:cancelled', category: 'task', description: 'Task cancelled' }],
  
  // Module events
  ['module:loaded', { type: 'module:loaded', category: 'module', description: 'Module loaded' }],
  ['module:unloaded', { type: 'module:unloaded', category: 'module', description: 'Module unloaded' }],
  ['module:error', { type: 'module:error', category: 'module', description: 'Module error' }],
  
  // Agent events
  ['agent:spawned', { type: 'agent:spawned', category: 'agent', description: 'Agent spawned' }],
  ['agent:terminated', { type: 'agent:terminated', category: 'agent', description: 'Agent terminated' }],
  ['agent:status', { type: 'agent:status', category: 'agent', description: 'Agent status change' }],
  ['agent:message', { type: 'agent:message', category: 'agent', description: 'Agent message' }],
  
  // Model events
  ['model:request', { type: 'model:request', category: 'model', description: 'Model request' }],
  ['model:response', { type: 'model:response', category: 'model', description: 'Model response' }],
  ['model:error', { type: 'model:error', category: 'model', description: 'Model error' }],
  
  // System events
  ['system:error', { type: 'system:error', category: 'system', description: 'System error', minPriority: 'high' }],
  ['system:warning', { type: 'system:warning', category: 'system', description: 'System warning' }],
  ['system:info', { type: 'system:info', category: 'system', description: 'System info' }],
]);

export class EventValidator {
  private eventTypes: Map<string, EventTypeDefinition>;
  private strictMode: boolean;

  constructor(strictMode = false) {
    this.eventTypes = new Map(BUILTIN_EVENT_TYPES);
    this.strictMode = strictMode;
  }

  // Register a new event type
  registerEventType(definition: EventTypeDefinition): void {
    this.eventTypes.set(definition.type, definition);
  }

  // Validate an event
  validate(event: Event): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check required fields
    if (!event.id || typeof event.id !== 'string') {
      errors.push('Event must have a valid id');
    }

    if (!event.eventType || typeof event.eventType !== 'string') {
      errors.push('Event must have a valid eventType');
    }

    if (!event.sourceId || typeof event.sourceId !== 'string') {
      errors.push('Event must have a valid sourceId');
    }

    if (!event.timestamp || !(event.timestamp instanceof Date)) {
      errors.push('Event must have a valid timestamp');
    }

    // Check event type
    const typeDefinition = this.eventTypes.get(event.eventType);
    if (!typeDefinition) {
      if (this.strictMode) {
        errors.push(`Unknown event type: ${event.eventType}`);
      } else {
        warnings.push(`Unknown event type: ${event.eventType}`);
      }
    } else {
      // Check minimum priority
      if (typeDefinition.minPriority) {
        const priorityOrder = ['low', 'normal', 'high', 'critical'];
        const minIndex = priorityOrder.indexOf(typeDefinition.minPriority);
        const eventIndex = priorityOrder.indexOf(event.priority);
        
        if (eventIndex < minIndex) {
          warnings.push(
            `Event priority ${event.priority} is below minimum ${typeDefinition.minPriority} for type ${event.eventType}`
          );
        }
      }
    }

    // Validate payload
    if (event.payload === undefined || event.payload === null) {
      warnings.push('Event has no payload');
    } else if (typeof event.payload !== 'object') {
      errors.push('Event payload must be an object');
    }

    // Validate execution context
    if (event.executionContext) {
      const ctxErrors = this.validateExecutionContext(event.executionContext);
      errors.push(...ctxErrors);
    }

    // Validate priority
    const validPriorities = ['critical', 'high', 'normal', 'low'];
    if (!validPriorities.includes(event.priority)) {
      errors.push(`Invalid priority: ${event.priority}`);
    }

    // Validate source type
    const validSourceTypes = ['kernel', 'module', 'agent', 'user', 'system'];
    if (!validSourceTypes.includes(event.sourceType)) {
      errors.push(`Invalid sourceType: ${event.sourceType}`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  // Validate execution context
  private validateExecutionContext(ctx: ExecutionContext): string[] {
    const errors: string[] = [];

    if (ctx.parentId && typeof ctx.parentId !== 'string') {
      errors.push('ExecutionContext parentId must be a string');
    }

    if (ctx.sessionId && typeof ctx.sessionId !== 'string') {
      errors.push('ExecutionContext sessionId must be a string');
    }

    if (ctx.correlationId && typeof ctx.correlationId !== 'string') {
      errors.push('ExecutionContext correlationId must be a string');
    }

    if (ctx.metadata && typeof ctx.metadata !== 'object') {
      errors.push('ExecutionContext metadata must be an object');
    }

    return errors;
  }

  // Get event type definition
  getEventType(type: string): EventTypeDefinition | undefined {
    return this.eventTypes.get(type);
  }

  // Get all registered event types
  getAllEventTypes(): EventTypeDefinition[] {
    return Array.from(this.eventTypes.values());
  }

  // Get event types by category
  getEventTypesByCategory(category: string): EventTypeDefinition[] {
    return Array.from(this.eventTypes.values()).filter(
      def => def.category === category
    );
  }

  // Check if event type exists
  hasEventType(type: string): boolean {
    return this.eventTypes.has(type);
  }

  // Set strict mode
  setStrictMode(strict: boolean): void {
    this.strictMode = strict;
  }
}

// Singleton instance
let validatorInstance: EventValidator | null = null;

export function getEventValidator(): EventValidator {
  if (!validatorInstance) {
    validatorInstance = new EventValidator();
  }
  return validatorInstance;
}

export function resetEventValidator(): void {
  validatorInstance = null;
}
