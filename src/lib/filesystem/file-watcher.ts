/**
 * File Watcher - Unified file change watching with debouncing and pattern matching
 * Works with both browser and Tauri filesystem implementations
 */

import { FilesystemProvider, WatchEvent, WatchCallback, WatchOptions } from './filesystem-provider';

// ============================================================================
// Types
// ============================================================================

export interface FileWatcherConfig {
  /** Default debounce interval in milliseconds */
  defaultDebounceMs?: number;
  /** Maximum number of events to batch */
  maxBatchSize?: number;
  /** Whether to coalesce similar events */
  coalesceEvents?: boolean;
  /** Pattern matching implementation */
  patternMatcher?: PatternMatcher;
}

export interface PatternMatcher {
  match(path: string, pattern: string): boolean;
}

export interface WatchSubscription {
  id: string;
  path: string;
  callback: WatchCallback;
  options: Required<WatchOptions>;
  cleanup: () => void;
}

export interface DebouncedEvent {
  event: WatchEvent;
  count: number;
  firstSeen: number;
  lastSeen: number;
}

export type AggregatedWatchCallback = (events: WatchEvent[]) => void;

// ============================================================================
// Glob Pattern Matcher
// ============================================================================

export class GlobPatternMatcher implements PatternMatcher {
  private cache: Map<string, RegExp> = new Map();

  match(path: string, pattern: string): boolean {
    const regex = this.patternToRegex(pattern);
    return regex.test(path);
  }

  private patternToRegex(pattern: string): RegExp {
    const cached = this.cache.get(pattern);
    if (cached) return cached;

    // Convert glob pattern to regex
    let regexStr = pattern
      // Escape special regex characters (except * and ?)
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      // Convert ** to match any path segments
      .replace(/\*\*/g, '{{DOUBLESTAR}}')
      // Convert * to match anything except /
      .replace(/\*/g, '[^/]*')
      // Convert ? to match any single character except /
      .replace(/\?/g, '[^/]')
      // Restore ** pattern
      .replace(/\{\{DOUBLESTAR\}\}/g, '.*')
      // Match at the end of string
      .replace(/\/$/, '');

    // Handle patterns that should match from any directory
    if (!pattern.startsWith('/')) {
      regexStr = '(^|/)' + regexStr;
    }

    const regex = new RegExp(regexStr + '$');
    this.cache.set(pattern, regex);
    return regex;
  }

  clearCache(): void {
    this.cache.clear();
  }
}

// ============================================================================
// Event Debouncer
// ============================================================================

export class EventDebouncer {
  private pendingEvents: Map<string, DebouncedEvent> = new Map();
  private timeoutId: NodeJS.Timeout | null = null;
  private readonly debounceMs: number;
  private readonly maxBatchSize: number;
  private readonly coalesce: boolean;

  constructor(
    debounceMs: number = 100,
    maxBatchSize: number = 100,
    coalesce: boolean = true
  ) {
    this.debounceMs = debounceMs;
    this.maxBatchSize = maxBatchSize;
    this.coalesce = coalesce;
  }

  /**
   * Add an event to the debouncer
   */
  addEvent(event: WatchEvent): void {
    const key = this.getEventKey(event);
    const now = Date.now();

    const existing = this.pendingEvents.get(key);

    if (existing && this.coalesce) {
      // Update existing event
      existing.event = event; // Keep the latest event data
      existing.count++;
      existing.lastSeen = now;
    } else {
      // Add new event
      this.pendingEvents.set(key, {
        event,
        count: 1,
        firstSeen: now,
        lastSeen: now,
      });
    }

    // Check if we should flush due to batch size
    if (this.pendingEvents.size >= this.maxBatchSize) {
      this.flush();
      return;
    }

    // Reset the debounce timer
    this.resetTimer();
  }

  /**
   * Get event key for coalescing
   */
  private getEventKey(event: WatchEvent): string {
    // Coalesce by path and type
    // For renames, include oldPath to distinguish different rename operations
    if (event.type === 'renamed' && event.oldPath) {
      return `${event.type}:${event.oldPath}:${event.path}`;
    }
    return `${event.type}:${event.path}`;
  }

  /**
   * Reset the debounce timer
   */
  private resetTimer(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }

    this.timeoutId = setTimeout(() => {
      this.flush();
    }, this.debounceMs);
  }

  /**
   * Flush pending events and return them
   */
  flush(): WatchEvent[] {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

    const events = Array.from(this.pendingEvents.values()).map((de) => de.event);
    this.pendingEvents.clear();

    return events;
  }

  /**
   * Get the number of pending events
   */
  getPendingCount(): number {
    return this.pendingEvents.size;
  }

  /**
   * Clear all pending events
   */
  clear(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    this.pendingEvents.clear();
  }
}

// ============================================================================
// File Watcher
// ============================================================================

export class FileWatcher {
  private filesystem: FilesystemProvider;
  private subscriptions: Map<string, WatchSubscription> = new Map();
  private debouncers: Map<string, EventDebouncer> = new Map();
  private patternMatcher: PatternMatcher;
  private config: Required<FileWatcherConfig>;
  private subscriptionCounter = 0;

  constructor(filesystem: FilesystemProvider, config?: FileWatcherConfig) {
    this.filesystem = filesystem;
    this.patternMatcher = config?.patternMatcher ?? new GlobPatternMatcher();
    this.config = {
      defaultDebounceMs: config?.defaultDebounceMs ?? 100,
      maxBatchSize: config?.maxBatchSize ?? 100,
      coalesceEvents: config?.coalesceEvents ?? true,
      patternMatcher: this.patternMatcher,
    };
  }

  /**
   * Watch a directory for changes
   */
  async watchDirectory(
    path: string,
    callback: WatchCallback | AggregatedWatchCallback,
    options?: WatchOptions
  ): Promise<string> {
    const subscriptionId = `watch-${++this.subscriptionCounter}`;
    const resolvedOptions: Required<WatchOptions> = {
      recursive: options?.recursive ?? true,
      includes: options?.includes ?? [],
      excludes: options?.excludes ?? [],
      debounceMs: options?.debounceMs ?? this.config.defaultDebounceMs,
      emitInitial: options?.emitInitial ?? false,
    };

    // Create debouncer for this subscription
    const debouncer = new EventDebouncer(
      resolvedOptions.debounceMs,
      this.config.maxBatchSize,
      this.config.coalesceEvents
    );
    this.debouncers.set(subscriptionId, debouncer);

    // Create wrapped callback that applies filters and debouncing
    const wrappedCallback = (event: WatchEvent) => {
      // Apply include filters
      if (resolvedOptions.includes.length > 0) {
        const matches = resolvedOptions.includes.some((pattern) =>
          this.patternMatcher.match(event.path, pattern)
        );
        if (!matches) return;
      }

      // Apply exclude filters
      if (resolvedOptions.excludes.length > 0) {
        const excluded = resolvedOptions.excludes.some((pattern) =>
          this.patternMatcher.match(event.path, pattern)
        );
        if (excluded) return;
      }

      // Add to debouncer
      debouncer.addEvent(event);

      // For immediate callback (non-aggregated), we need to flush manually
      // This allows the caller to receive debounced events
      setTimeout(() => {
        const events = debouncer.flush();
        if (events.length > 0) {
          if (this.isAggregatedCallback(callback)) {
            (callback as AggregatedWatchCallback)(events);
          } else {
            events.forEach((e) => (callback as WatchCallback)(e));
          }
        }
      }, resolvedOptions.debounceMs);
    };

    // Start watching
    const cleanup = await this.filesystem.watchDirectory(path, wrappedCallback, resolvedOptions);

    // Store subscription
    const subscription: WatchSubscription = {
      id: subscriptionId,
      path,
      callback: wrappedCallback,
      options: resolvedOptions,
      cleanup,
    };

    this.subscriptions.set(subscriptionId, subscription);

    return subscriptionId;
  }

  /**
   * Watch a specific file for changes
   */
  async watchFile(
    path: string,
    callback: WatchCallback | AggregatedWatchCallback,
    options?: Omit<WatchOptions, 'recursive'>
  ): Promise<string> {
    const subscriptionId = `file-watch-${++this.subscriptionCounter}`;
    const resolvedOptions: Required<WatchOptions> = {
      recursive: false,
      includes: options?.includes ?? [],
      excludes: options?.excludes ?? [],
      debounceMs: options?.debounceMs ?? this.config.defaultDebounceMs,
      emitInitial: options?.emitInitial ?? false,
    };

    // Create debouncer
    const debouncer = new EventDebouncer(
      resolvedOptions.debounceMs,
      this.config.maxBatchSize,
      this.config.coalesceEvents
    );
    this.debouncers.set(subscriptionId, debouncer);

    // Create wrapped callback
    const wrappedCallback = (event: WatchEvent) => {
      debouncer.addEvent(event);

      setTimeout(() => {
        const events = debouncer.flush();
        if (events.length > 0) {
          if (this.isAggregatedCallback(callback)) {
            (callback as AggregatedWatchCallback)(events);
          } else {
            events.forEach((e) => (callback as WatchCallback)(e));
          }
        }
      }, resolvedOptions.debounceMs);
    };

    // Start watching if filesystem supports file watching
    let cleanup: () => void;

    if (this.filesystem.watchFile) {
      cleanup = await this.filesystem.watchFile(path, wrappedCallback, resolvedOptions);
    } else {
      // Fallback to directory watching with path filtering
      const dirPath = this.filesystem.dirname(path);
      const dirCleanup = await this.filesystem.watchDirectory(
        dirPath,
        (event) => {
          if (event.path === path) {
            wrappedCallback(event);
          }
        },
        { ...resolvedOptions, recursive: false }
      );
      cleanup = dirCleanup;
    }

    // Store subscription
    const subscription: WatchSubscription = {
      id: subscriptionId,
      path,
      callback: wrappedCallback,
      options: resolvedOptions,
      cleanup,
    };

    this.subscriptions.set(subscriptionId, subscription);

    return subscriptionId;
  }

  /**
   * Watch multiple paths
   */
  async watchMultiple(
    paths: string[],
    callback: WatchCallback | AggregatedWatchCallback,
    options?: WatchOptions
  ): Promise<string[]> {
    const subscriptionIds: string[] = [];

    for (const path of paths) {
      const id = await this.watchDirectory(path, callback, options);
      subscriptionIds.push(id);
    }

    return subscriptionIds;
  }

  /**
   * Unwatch by subscription ID
   */
  async unwatch(subscriptionId: string): Promise<boolean> {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) return false;

    // Run cleanup
    subscription.cleanup();

    // Remove debouncer
    const debouncer = this.debouncers.get(subscriptionId);
    if (debouncer) {
      debouncer.clear();
      this.debouncers.delete(subscriptionId);
    }

    // Remove subscription
    this.subscriptions.delete(subscriptionId);

    return true;
  }

  /**
   * Unwatch all subscriptions for a path
   */
  async unwatchPath(path: string): Promise<number> {
    const toRemove: string[] = [];

    for (const [id, subscription] of this.subscriptions) {
      if (subscription.path === path || subscription.path.startsWith(path)) {
        toRemove.push(id);
      }
    }

    for (const id of toRemove) {
      await this.unwatch(id);
    }

    return toRemove.length;
  }

  /**
   * Unwatch all subscriptions
   */
  async unwatchAll(): Promise<void> {
    for (const subscriptionId of Array.from(this.subscriptions.keys())) {
      await this.unwatch(subscriptionId);
    }
  }

  /**
   * Get all active subscriptions
   */
  getSubscriptions(): WatchSubscription[] {
    return Array.from(this.subscriptions.values());
  }

  /**
   * Get subscription by ID
   */
  getSubscription(id: string): WatchSubscription | undefined {
    return this.subscriptions.get(id);
  }

  /**
   * Check if a callback is aggregated
   */
  private isAggregatedCallback(callback: WatchCallback | AggregatedWatchCallback): boolean {
    // This is a heuristic - aggregated callbacks typically expect an array
    return callback.length === 1;
  }

  /**
   * Flush all pending events
   */
  flushAll(): Map<string, WatchEvent[]> {
    const results = new Map<string, WatchEvent[]>();

    for (const [id, debouncer] of this.debouncers) {
      const events = debouncer.flush();
      if (events.length > 0) {
        results.set(id, events);
      }
    }

    return results;
  }

  /**
   * Cleanup and dispose
   */
  async dispose(): Promise<void> {
    await this.unwatchAll();
    this.debouncers.clear();
  }
}

// ============================================================================
// Watch Event Aggregator
// ============================================================================

export class WatchEventAggregator {
  private events: WatchEvent[] = [];
  private maxEvents: number;

  constructor(maxEvents: number = 1000) {
    this.maxEvents = maxEvents;
  }

  /**
   * Add an event
   */
  add(event: WatchEvent): void {
    this.events.push(event);

    // Trim if over limit
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }
  }

  /**
   * Add multiple events
   */
  addMany(events: WatchEvent[]): void {
    this.events.push(...events);

    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }
  }

  /**
   * Get all events
   */
  getAll(): WatchEvent[] {
    return [...this.events];
  }

  /**
   * Get events filtered by type
   */
  getByType(type: WatchEvent['type']): WatchEvent[] {
    return this.events.filter((e) => e.type === type);
  }

  /**
   * Get events for a specific path
   */
  getByPath(path: string): WatchEvent[] {
    return this.events.filter(
      (e) => e.path === path || e.path.startsWith(path + '/') || e.oldPath === path
    );
  }

  /**
   * Get events within a time range
   */
  getByTimeRange(start: Date, end: Date): WatchEvent[] {
    return this.events.filter((e) => {
      const time = e.timestamp.getTime();
      return time >= start.getTime() && time <= end.getTime();
    });
  }

  /**
   * Get the most recent events
   */
  getRecent(count: number = 10): WatchEvent[] {
    return this.events.slice(-count);
  }

  /**
   * Clear all events
   */
  clear(): void {
    this.events = [];
  }

  /**
   * Get event count
   */
  getCount(): number {
    return this.events.length;
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create a simple file watcher
 */
export function createFileWatcher(
  filesystem: FilesystemProvider,
  config?: FileWatcherConfig
): FileWatcher {
  return new FileWatcher(filesystem, config);
}

/**
 * Create a pattern matcher
 */
export function createPatternMatcher(): GlobPatternMatcher {
  return new GlobPatternMatcher();
}

/**
 * Create an event aggregator
 */
export function createEventAggregator(maxEvents?: number): WatchEventAggregator {
  return new WatchEventAggregator(maxEvents);
}
