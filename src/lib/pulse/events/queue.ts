// Kyro Event Priority Queue
// High-performance priority queue implementation for events

import type { Event, EventPriority } from '@/types/pulse';

interface QueueNode {
  event: Event;
  priority: number;
  insertionOrder: number;
}

const PRIORITY_VALUES: Record<EventPriority, number> = {
  critical: 100,
  high: 75,
  normal: 50,
  low: 25,
};

export class EventPriorityQueue {
  private heap: QueueNode[] = [];
  private insertionCounter = 0;
  private maxSize: number;

  constructor(maxSize = 10000) {
    this.maxSize = maxSize;
  }

  // Enqueue an event
  enqueue(event: Event): boolean {
    if (this.heap.length >= this.maxSize) {
      return false;
    }

    const priority = PRIORITY_VALUES[event.priority];
    const node: QueueNode = {
      event,
      priority,
      insertionOrder: this.insertionCounter++,
    };

    this.heap.push(node);
    this.bubbleUp(this.heap.length - 1);
    return true;
  }

  // Dequeue the highest priority event
  dequeue(): Event | undefined {
    if (this.heap.length === 0) return undefined;

    const top = this.heap[0];
    const last = this.heap.pop();

    if (this.heap.length > 0 && last) {
      this.heap[0] = last;
      this.bubbleDown(0);
    }

    return top.event;
  }

  // Peek at the highest priority event
  peek(): Event | undefined {
    return this.heap[0]?.event;
  }

  // Get queue length
  get length(): number {
    return this.heap.length;
  }

  // Check if queue is empty
  isEmpty(): boolean {
    return this.heap.length === 0;
  }

  // Check if queue is full
  isFull(): boolean {
    return this.heap.length >= this.maxSize;
  }

  // Clear the queue
  clear(): void {
    this.heap = [];
  }

  // Get all events (for snapshot)
  toArray(): Event[] {
    return [...this.heap]
      .sort((a, b) => {
        if (a.priority !== b.priority) {
          return b.priority - a.priority;
        }
        return a.insertionOrder - b.insertionOrder;
      })
      .map(node => node.event);
  }

  // Get events by priority
  getByPriority(priority: EventPriority): Event[] {
    const priorityValue = PRIORITY_VALUES[priority];
    return this.heap
      .filter(node => node.priority === priorityValue)
      .map(node => node.event);
  }

  // Get queue statistics
  getStats(): {
    total: number;
    critical: number;
    high: number;
    normal: number;
    low: number;
  } {
    const stats = {
      total: this.heap.length,
      critical: 0,
      high: 0,
      normal: 0,
      low: 0,
    };

    for (const node of this.heap) {
      if (node.priority >= 100) stats.critical++;
      else if (node.priority >= 75) stats.high++;
      else if (node.priority >= 50) stats.normal++;
      else stats.low++;
    }

    return stats;
  }

  // Heap operations
  private bubbleUp(index: number): void {
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      
      if (this.compare(index, parentIndex) > 0) {
        this.swap(index, parentIndex);
        index = parentIndex;
      } else {
        break;
      }
    }
  }

  private bubbleDown(index: number): void {
    const length = this.heap.length;

    while (true) {
      const leftChild = 2 * index + 1;
      const rightChild = 2 * index + 2;
      let largest = index;

      if (leftChild < length && this.compare(leftChild, largest) > 0) {
        largest = leftChild;
      }

      if (rightChild < length && this.compare(rightChild, largest) > 0) {
        largest = rightChild;
      }

      if (largest !== index) {
        this.swap(index, largest);
        index = largest;
      } else {
        break;
      }
    }
  }

  private compare(i: number, j: number): number {
    const a = this.heap[i];
    const b = this.heap[j];

    // Higher priority first
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }

    // Earlier insertion first (FIFO within same priority)
    return b.insertionOrder - a.insertionOrder;
  }

  private swap(i: number, j: number): void {
    [this.heap[i], this.heap[j]] = [this.heap[j], this.heap[i]];
  }
}
