// Kyro Event Router
// Routes events to appropriate handlers with priority-based processing

import type { Event, EventPriority, ExecutionContext } from '@/types/pulse';
import { v4 as uuidv4 } from 'uuid';

export type EventHandler = (event: Event) => Promise<void> | void;

interface EventHandlerEntry {
  id: string;
  eventType: string | '*';
  handler: EventHandler;
  priority: number;
}

const PRIORITY_VALUES: Record<EventPriority, number> = {
  critical: 100,
  high: 75,
  normal: 50,
  low: 25,
};

export class EventRouter {
  private handlers: EventHandlerEntry[] = [];
  private eventQueue: Event[] = [];
  private processing = false;
  private maxQueueSize = 10000;

  constructor(maxQueueSize = 10000) {
    this.maxQueueSize = maxQueueSize;
  }

  // Register an event handler
  on(eventType: string | '*', handler: EventHandler, priority = 0): () => void {
    const id = uuidv4();
    this.handlers.push({ id, eventType, handler, priority });
    
    // Sort handlers by priority (higher first)
    this.handlers.sort((a, b) => b.priority - a.priority);

    // Return unsubscribe function
    return () => {
      this.handlers = this.handlers.filter(h => h.id !== id);
    };
  }

  // Create a new event
  createEvent(
    eventType: string,
    sourceId: string,
    sourceType: Event['sourceType'],
    payload: Record<string, unknown>,
    priority: EventPriority = 'normal',
    executionCtx?: ExecutionContext
  ): Event {
    return {
      id: uuidv4(),
      timestamp: new Date(),
      eventType,
      sourceId,
      sourceType,
      priority,
      payload,
      executionCtx: executionCtx || this.createContext(),
      status: 'pending',
      retryCount: 0,
      createdAt: new Date(),
    };
  }

  // Create default execution context
  private createContext(): ExecutionContext {
    return {
      correlationId: uuidv4(),
      metadata: {},
    };
  }

  // Emit an event to the queue
  emit(event: Event): boolean {
    if (this.eventQueue.length >= this.maxQueueSize) {
      console.error('Event queue overflow, dropping event:', event.eventType);
      return false;
    }

    // Insert event based on priority
    const eventPriority = PRIORITY_VALUES[event.priority];
    let inserted = false;

    for (let i = 0; i < this.eventQueue.length; i++) {
      const queuePriority = PRIORITY_VALUES[this.eventQueue[i].priority];
      if (eventPriority > queuePriority) {
        this.eventQueue.splice(i, 0, event);
        inserted = true;
        break;
      }
    }

    if (!inserted) {
      this.eventQueue.push(event);
    }

    return true;
  }

  // Get next event from queue
  dequeue(): Event | undefined {
    return this.eventQueue.shift();
  }

  // Get queue length
  getQueueLength(): number {
    return this.eventQueue.length;
  }

  // Get queue snapshot
  getQueueSnapshot(): Event[] {
    return [...this.eventQueue];
  }

  // Process a single event
  async processEvent(event: Event): Promise<void> {
    const matchingHandlers = this.handlers.filter(
      h => h.eventType === '*' || h.eventType === event.eventType
    );

    event.status = 'processing';

    try {
      for (const entry of matchingHandlers) {
        await entry.handler(event);
      }
      event.status = 'processed';
      event.processedAt = new Date();
    } catch (error) {
      event.status = 'failed';
      event.retryCount++;
      console.error(`Event processing error (${event.eventType}):`, error);
      throw error;
    }
  }

  // Process all events in queue
  async processQueue(): Promise<number> {
    if (this.processing) {
      return 0;
    }

    this.processing = true;
    let processed = 0;

    try {
      while (this.eventQueue.length > 0) {
        const event = this.dequeue();
        if (event) {
          try {
            await this.processEvent(event);
            processed++;
          } catch (error) {
            // Re-queue for retry if under limit
            if (event.retryCount < 3) {
              this.emit(event);
            }
          }
        }
      }
    } finally {
      this.processing = false;
    }

    return processed;
  }

  // Clear the queue
  clearQueue(): void {
    this.eventQueue = [];
  }

  // Get handler count
  getHandlerCount(): number {
    return this.handlers.length;
  }
}

// Singleton instance
let eventRouterInstance: EventRouter | null = null;

export function getEventRouter(): EventRouter {
  if (!eventRouterInstance) {
    eventRouterInstance = new EventRouter();
  }
  return eventRouterInstance;
}

export function resetEventRouter(): void {
  eventRouterInstance = null;
}
