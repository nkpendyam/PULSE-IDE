/**
 * Kyro IDE - Profiler Session Management
 * Session storage, import/export, and profile management
 */

import type {
  ProfileSession,
  ProfileConfig,
  ProfileSample,
  StackFrame,
  ProfileAnnotation,
  FunctionMetrics,
  CallTreeNode,
  FlameGraphNode,
  MemoryStats,
} from './performance-profiler';
import { DEFAULT_PROFILE_CONFIG } from './performance-profiler';

// ============================================
// TYPES AND INTERFACES
// ============================================

export interface SessionStorage {
  /** Save session to storage */
  save(session: ProfileSession): Promise<void>;
  /** Load session from storage */
  load(sessionId: string): Promise<ProfileSession | null>;
  /** Delete session from storage */
  delete(sessionId: string): Promise<boolean>;
  /** List all stored sessions */
  list(): Promise<SessionMetadata[]>;
  /** Clear all stored sessions */
  clear(): Promise<void>;
}

export interface SessionMetadata {
  /** Session ID */
  id: string;
  /** Session name */
  name: string;
  /** Creation time */
  createdAt: Date;
  /** Last modified time */
  modifiedAt: Date;
  /** Session duration in milliseconds */
  duration: number;
  /** Sample count */
  sampleCount: number;
  /** Session status */
  status: ProfileSession['status'];
  /** Session size in bytes */
  size: number;
  /** Tags for organization */
  tags: string[];
}

export interface CPUProfileFormat {
  /** Profile nodes */
  nodes: CPUProfileNode[];
  /** Start time */
  startTime: number;
  /** End time */
  endTime: number;
  /** Samples array (node IDs) */
  samples: number[];
  /** Time deltas between samples */
  timeDeltas: number[];
  /** Profile metadata */
  metadata?: {
    productId?: string;
    tool?: string;
    version?: string;
  };
}

export interface CPUProfileNode {
  /** Node ID */
  id: number;
  /** Call frame info */
  callFrame: {
    functionName: string;
    scriptId: string;
    url: string;
    lineNumber: number;
    columnNumber: number;
  };
  /** Hit count */
  hitCount: number;
  /** Children node IDs */
  children: number[];
  /** Parent node ID */
  parent?: number;
}

export interface SessionExport {
  /** Export format */
  format: 'json' | 'cpuprofile' | 'summary';
  /** Export data */
  data: string | object;
  /** Filename suggestion */
  filename: string;
  /** MIME type */
  mimeType: string;
  /** Export metadata */
  metadata: ExportMetadata;
}

export interface ExportMetadata {
  exportedAt: Date;
  appVersion: string;
  formatVersion: string;
  sessionId: string;
  sessionName: string;
}

export interface SessionImportResult {
  success: boolean;
  session?: ProfileSession;
  errors?: string[];
  warnings?: string[];
}

export interface SessionSearchOptions {
  /** Filter by status */
  status?: ProfileSession['status'][];
  /** Filter by name pattern */
  namePattern?: string;
  /** Filter by date range */
  dateRange?: {
    start: Date;
    end: Date;
  };
  /** Filter by minimum duration */
  minDuration?: number;
  /** Filter by maximum duration */
  maxDuration?: number;
  /** Filter by tags */
  tags?: string[];
  /** Sort by field */
  sortBy?: 'name' | 'createdAt' | 'duration' | 'sampleCount';
  /** Sort direction */
  sortOrder?: 'asc' | 'desc';
  /** Limit results */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
}

export interface SessionGroup {
  /** Group ID */
  id: string;
  /** Group name */
  name: string;
  /** Session IDs in group */
  sessionIds: string[];
  /** Group description */
  description?: string;
  /** Group color */
  color?: string;
  /** Created at */
  createdAt: Date;
}

export interface SessionComparison {
  /** Session 1 */
  session1: ProfileSession;
  /** Session 2 */
  session2: ProfileSession;
  /** Comparison metrics */
  metrics: ComparisonMetrics;
  /** Function-level comparison */
  functionDiff: FunctionDiff[];
}

export interface ComparisonMetrics {
  /** Duration difference */
  durationDiff: number;
  /** Duration change percent */
  durationChangePercent: number;
  /** Sample count difference */
  sampleCountDiff: number;
  /** Memory usage difference */
  memoryDiff?: number;
  /** Improvement/regression flag */
  isImprovement: boolean;
}

export interface FunctionDiff {
  /** Function name */
  functionName: string;
  /** Script URL */
  scriptUrl?: string;
  /** Session 1 metrics */
  session1: {
    selfTime: number;
    totalTime: number;
    callCount: number;
  };
  /** Session 2 metrics */
  session2: {
    selfTime: number;
    totalTime: number;
    callCount: number;
  };
  /** Difference */
  diff: {
    selfTime: number;
    totalTime: number;
    callCount: number;
  };
  /** Change type */
  changeType: 'new' | 'removed' | 'improved' | 'regressed' | 'unchanged';
}

// ============================================
// IN-MEMORY STORAGE IMPLEMENTATION
// ============================================

export class InMemorySessionStorage implements SessionStorage {
  private sessions: Map<string, ProfileSession> = new Map();
  private metadata: Map<string, SessionMetadata> = new Map();

  async save(session: ProfileSession): Promise<void> {
    this.sessions.set(session.id, this.deepClone(session));

    const meta = this.createMetadata(session);
    this.metadata.set(session.id, meta);
  }

  async load(sessionId: string): Promise<ProfileSession | null> {
    const session = this.sessions.get(sessionId);
    return session ? this.deepClone(session) : null;
  }

  async delete(sessionId: string): Promise<boolean> {
    const deleted = this.sessions.delete(sessionId);
    this.metadata.delete(sessionId);
    return deleted;
  }

  async list(): Promise<SessionMetadata[]> {
    return Array.from(this.metadata.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
  }

  async clear(): Promise<void> {
    this.sessions.clear();
    this.metadata.clear();
  }

  private createMetadata(session: ProfileSession): SessionMetadata {
    const duration = session.endTime
      ? session.endTime.getTime() - session.startTime.getTime()
      : Date.now() - session.startTime.getTime();

    return {
      id: session.id,
      name: session.name,
      createdAt: session.startTime,
      modifiedAt: new Date(),
      duration,
      sampleCount: session.samples.length,
      status: session.status,
      size: this.estimateSize(session),
      tags: [],
    };
  }

  private estimateSize(session: ProfileSession): number {
    // Rough estimate of session size
    const samplesSize = session.samples.length * 500; // ~500 bytes per sample
    const metricsSize = session.functionMetrics.size * 200;
    return samplesSize + metricsSize + 1000;
  }

  private deepClone<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj, (key, value) => {
      if (value instanceof Map) {
        return { __type: 'Map', data: Array.from(value.entries()) };
      }
      return value;
    }, (key, value) => {
      if (value?.__type === 'Map') {
        return new Map(value.data);
      }
      return value;
    }));
  }
}

// ============================================
// SESSION MANAGER CLASS
// ============================================

export class ProfilerSessionManager {
  private storage: SessionStorage;
  private activeSessionId: string | null = null;
  private sessions: Map<string, ProfileSession> = new Map();
  private groups: Map<string, SessionGroup> = new Map();
  private onChangeCallbacks: Set<(sessionId: string) => void> = new Set();

  constructor(storage?: SessionStorage) {
    this.storage = storage || new InMemorySessionStorage();
  }

  /**
   * Register change callback
   */
  onChange(callback: (sessionId: string) => void): () => void {
    this.onChangeCallbacks.add(callback);
    return () => this.onChangeCallbacks.delete(callback);
  }

  /**
   * Notify listeners of change
   */
  private notifyChange(sessionId: string): void {
    this.onChangeCallbacks.forEach((cb) => cb(sessionId));
  }

  /**
   * Create a new profiling session
   */
  createSession(config: Partial<ProfileConfig> = {}): ProfileSession {
    const fullConfig: ProfileConfig = {
      ...DEFAULT_PROFILE_CONFIG,
      ...config,
    };

    const session: ProfileSession = {
      id: this.generateId(),
      name: fullConfig.name || `Profile ${this.sessions.size + 1}`,
      description: fullConfig.description,
      startTime: new Date(),
      status: 'pending',
      config: fullConfig,
      samples: [],
      functionMetrics: new Map(),
      hotSpots: [],
      annotations: [],
      totalExecutionTime: 0,
    };

    this.sessions.set(session.id, session);
    this.storage.save(session);
    this.notifyChange(session.id);

    return session;
  }

  /**
   * Generate unique session ID
   */
  private generateId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): ProfileSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get all sessions
   */
  getAllSessions(): ProfileSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Get active session
   */
  getActiveSession(): ProfileSession | undefined {
    if (!this.activeSessionId) return undefined;
    return this.sessions.get(this.activeSessionId);
  }

  /**
   * Set active session
   */
  setActiveSession(sessionId: string): boolean {
    if (!this.sessions.has(sessionId)) return false;
    this.activeSessionId = sessionId;
    this.notifyChange(sessionId);
    return true;
  }

  /**
   * Update session
   */
  updateSession(
    sessionId: string,
    updates: Partial<Pick<ProfileSession, 'name' | 'description' | 'annotations'>>
  ): ProfileSession | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    if (updates.name !== undefined) session.name = updates.name;
    if (updates.description !== undefined) session.description = updates.description;
    if (updates.annotations !== undefined) session.annotations = updates.annotations;

    this.storage.save(session);
    this.notifyChange(sessionId);

    return session;
  }

  /**
   * Delete session
   */
  async deleteSession(sessionId: string): Promise<boolean> {
    if (this.activeSessionId === sessionId) {
      this.activeSessionId = null;
    }

    const deleted = this.sessions.delete(sessionId);
    await this.storage.delete(sessionId);

    // Remove from groups
    this.groups.forEach((group) => {
      const index = group.sessionIds.indexOf(sessionId);
      if (index >= 0) {
        group.sessionIds.splice(index, 1);
      }
    });

    if (deleted) {
      this.notifyChange(sessionId);
    }

    return deleted;
  }

  /**
   * Duplicate session
   */
  async duplicateSession(sessionId: string, newName?: string): Promise<ProfileSession | null> {
    const original = this.sessions.get(sessionId);
    if (!original) return null;

    const duplicate: ProfileSession = {
      ...original,
      id: this.generateId(),
      name: newName || `${original.name} (copy)`,
      startTime: new Date(),
      endTime: undefined,
      status: 'pending',
      samples: [...original.samples],
      functionMetrics: new Map(original.functionMetrics),
      annotations: [...original.annotations],
    };

    this.sessions.set(duplicate.id, duplicate);
    await this.storage.save(duplicate);
    this.notifyChange(duplicate.id);

    return duplicate;
  }

  // ============================================
  // IMPORT/EXPORT
  // ============================================

  /**
   * Export session to format
   */
  exportSession(
    sessionId: string,
    format: 'json' | 'cpuprofile' | 'summary' = 'json'
  ): SessionExport | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    switch (format) {
      case 'cpuprofile':
        return this.exportToCPUProfile(session);
      case 'summary':
        return this.exportToSummary(session);
      case 'json':
      default:
        return this.exportToJSON(session);
    }
  }

  /**
   * Export to JSON format
   */
  private exportToJSON(session: ProfileSession): SessionExport {
    const exportData = {
      id: session.id,
      name: session.name,
      description: session.description,
      startTime: session.startTime.toISOString(),
      endTime: session.endTime?.toISOString(),
      status: session.status,
      config: session.config,
      samples: session.samples,
      functionMetrics: Array.from(session.functionMetrics.entries()),
      annotations: session.annotations,
      totalExecutionTime: session.totalExecutionTime,
      hotSpots: session.hotSpots,
    };

    return {
      format: 'json',
      data: JSON.stringify(exportData, null, 2),
      filename: `${session.name.replace(/\s+/g, '_')}.json`,
      mimeType: 'application/json',
      metadata: {
        exportedAt: new Date(),
        appVersion: '1.0.0',
        formatVersion: '1.0',
        sessionId: session.id,
        sessionName: session.name,
      },
    };
  }

  /**
   * Export to Chrome CPU Profile format
   */
  private exportToCPUProfile(session: ProfileSession): SessionExport {
    const nodeIdMap = new Map<string, number>();
    const nodes: CPUProfileNode[] = [];
    let nextNodeId = 1;

    // Build nodes from samples
    session.samples.forEach((sample) => {
      let parentId: number | undefined;

      sample.stack.forEach((frame, index) => {
        const key = `${frame.functionName}:${frame.scriptId}:${frame.lineNumber}`;
        let nodeId = nodeIdMap.get(key);

        if (!nodeId) {
          nodeId = nextNodeId++;
          nodeIdMap.set(key, nodeId);

          nodes.push({
            id: nodeId,
            callFrame: {
              functionName: frame.functionName,
              scriptId: frame.scriptId,
              url: frame.url || '',
              lineNumber: frame.lineNumber - 1, // 0-based for Chrome
              columnNumber: frame.columnNumber - 1,
            },
            hitCount: 0,
            children: [],
            parent: parentId,
          });
        }

        // Add child relationship
        if (parentId !== undefined) {
          const parentNode = nodes.find((n) => n.id === parentId);
          if (parentNode && !parentNode.children.includes(nodeId)) {
            parentNode.children.push(nodeId);
          }
        }

        // Increment hit count for leaf
        if (index === sample.stack.length - 1) {
          const node = nodes.find((n) => n.id === nodeId);
          if (node) node.hitCount++;
        }

        parentId = nodeId;
      });
    });

    // Build samples array (pointing to leaf nodes)
    const samples: number[] = session.samples.map((sample) => {
      const leafFrame = sample.stack[sample.stack.length - 1];
      if (!leafFrame) return 0;
      const key = `${leafFrame.functionName}:${leafFrame.scriptId}:${leafFrame.lineNumber}`;
      return nodeIdMap.get(key) || 0;
    });

    // Build time deltas
    const timeDeltas = session.samples.map((sample, index) => {
      if (index === 0) return 0;
      return sample.timestamp - session.samples[index - 1].timestamp;
    });

    const profile: CPUProfileFormat = {
      nodes,
      startTime: 0,
      endTime: session.totalExecutionTime * 1000, // Convert to microseconds
      samples,
      timeDeltas,
      metadata: {
        productId: 'KYRO-IDE',
        tool: 'Performance Profiler',
        version: '1.0.0',
      },
    };

    return {
      format: 'cpuprofile',
      data: JSON.stringify(profile, null, 2),
      filename: `${session.name.replace(/\s+/g, '_')}.cpuprofile`,
      mimeType: 'application/json',
      metadata: {
        exportedAt: new Date(),
        appVersion: '1.0.0',
        formatVersion: '1.0',
        sessionId: session.id,
        sessionName: session.name,
      },
    };
  }

  /**
   * Export to summary format
   */
  private exportToSummary(session: ProfileSession): SessionExport {
    const lines: string[] = [
      `# Profile Summary: ${session.name}`,
      '',
      `**Session ID:** ${session.id}`,
      `**Status:** ${session.status}`,
      `**Start Time:** ${session.startTime.toISOString()}`,
      `**Duration:** ${(session.totalExecutionTime / 1000).toFixed(2)}s`,
      `**Total Samples:** ${session.samples.length}`,
      `**Functions Profiled:** ${session.functionMetrics.size}`,
      '',
      '## Top Functions by Self Time',
      '',
      '| Function | Self Time | % Total | Calls |',
      '|----------|-----------|---------|-------|',
    ];

    const totalTime = session.totalExecutionTime * 1000;
    const sortedMetrics = Array.from(session.functionMetrics.values())
      .sort((a, b) => b.selfTime - a.selfTime)
      .slice(0, 20);

    sortedMetrics.forEach((metrics) => {
      const percent = ((metrics.selfTime / totalTime) * 100).toFixed(2);
      lines.push(
        `| ${metrics.name} | ${(metrics.selfTime / 1000).toFixed(2)}ms | ${percent}% | ${metrics.callCount} |`
      );
    });

    if (session.hotSpots.length > 0) {
      lines.push('', '## Hot Spots', '');
      session.hotSpots.slice(0, 10).forEach((spot) => {
        lines.push(
          `- **${spot.functionName}** (${spot.severity}): ${spot.selfTimePercent.toFixed(2)}% self time`
        );
        spot.suggestions.forEach((s) => {
          lines.push(`  - ${s}`);
        });
      });
    }

    if (session.annotations.length > 0) {
      lines.push('', '## Annotations', '');
      session.annotations.forEach((ann) => {
        lines.push(`- [${ann.type}] ${ann.label}: ${ann.description || ''}`);
      });
    }

    return {
      format: 'summary',
      data: lines.join('\n'),
      filename: `${session.name.replace(/\s+/g, '_')}_summary.md`,
      mimeType: 'text/markdown',
      metadata: {
        exportedAt: new Date(),
        appVersion: '1.0.0',
        formatVersion: '1.0',
        sessionId: session.id,
        sessionName: session.name,
      },
    };
  }

  /**
   * Import profile from file
   */
  async importProfile(
    file: File | string,
    format?: 'json' | 'cpuprofile'
  ): Promise<SessionImportResult> {
    try {
      let content: string;

      if (typeof file === 'string') {
        content = file;
      } else {
        content = await this.readFileContent(file);
      }

      // Detect format from content
      const detectedFormat = format || this.detectFormat(content);

      switch (detectedFormat) {
        case 'cpuprofile':
          return this.importFromCPUProfile(content);
        case 'json':
        default:
          return this.importFromJSON(content);
      }
    } catch (error) {
      return {
        success: false,
        errors: [
          `Import failed: ${error instanceof Error ? error.message : String(error)}`,
        ],
      };
    }
  }

  /**
   * Read file content
   */
  private readFileContent(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }

  /**
   * Detect format from content
   */
  private detectFormat(content: string): 'json' | 'cpuprofile' {
    try {
      const parsed = JSON.parse(content);

      // Check for CPU profile markers
      if (parsed.nodes && parsed.samples && parsed.timeDeltas) {
        return 'cpuprofile';
      }

      return 'json';
    } catch {
      return 'json';
    }
  }

  /**
   * Import from JSON format
   */
  private importFromJSON(content: string): SessionImportResult {
    const warnings: string[] = [];
    const errors: string[] = [];

    try {
      const parsed = JSON.parse(content);

      // Validate required fields
      if (!parsed.name) {
        warnings.push('Session name missing, using default');
      }

      // Convert function metrics back to Map
      const functionMetrics = new Map<string, FunctionMetrics>();
      if (Array.isArray(parsed.functionMetrics)) {
        parsed.functionMetrics.forEach(([key, value]: [string, FunctionMetrics]) => {
          functionMetrics.set(key, value);
        });
      }

      // Create session
      const session: ProfileSession = {
        id: parsed.id || this.generateId(),
        name: parsed.name || 'Imported Profile',
        description: parsed.description,
        startTime: new Date(parsed.startTime || Date.now()),
        endTime: parsed.endTime ? new Date(parsed.endTime) : undefined,
        status: parsed.status || 'completed',
        config: { ...DEFAULT_PROFILE_CONFIG, ...parsed.config },
        samples: parsed.samples || [],
        functionMetrics,
        hotSpots: parsed.hotSpots || [],
        annotations: parsed.annotations || [],
        totalExecutionTime: parsed.totalExecutionTime || 0,
      };

      this.sessions.set(session.id, session);
      this.storage.save(session);
      this.notifyChange(session.id);

      return {
        success: true,
        session,
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    } catch (error) {
      errors.push(
        `Failed to parse JSON: ${error instanceof Error ? error.message : String(error)}`
      );
      return { success: false, errors };
    }
  }

  /**
   * Import from Chrome CPU Profile format
   */
  private importFromCPUProfile(content: string): SessionImportResult {
    const warnings: string[] = [];
    const errors: string[] = [];

    try {
      const profile: CPUProfileFormat = JSON.parse(content);

      // Validate profile structure
      if (!profile.nodes || !Array.isArray(profile.nodes)) {
        errors.push('Invalid CPU profile: missing nodes array');
        return { success: false, errors };
      }

      // Build node lookup
      const nodeMap = new Map<number, CPUProfileNode>();
      profile.nodes.forEach((node) => {
        nodeMap.set(node.id, node);
      });

      // Convert to samples
      const samples: ProfileSample[] = [];
      let sampleId = 0;

      profile.samples.forEach((nodeId, index) => {
        const stack = this.buildStackFromNode(nodeId, nodeMap);
        const timeDelta = profile.timeDeltas[index] || 0;
        const timestamp = index === 0
          ? 0
          : samples[index - 1].timestamp + timeDelta;

        samples.push({
          id: `imported-sample-${++sampleId}`,
          timestamp,
          stack,
          cpuTime: timeDelta,
          threadId: 0,
        });
      });

      // Create session
      const session: ProfileSession = {
        id: this.generateId(),
        name: 'Imported CPU Profile',
        description: `Imported from CPU profile with ${samples.length} samples`,
        startTime: new Date(profile.startTime || Date.now()),
        endTime: new Date(profile.endTime || Date.now()),
        status: 'completed',
        config: DEFAULT_PROFILE_CONFIG,
        samples,
        functionMetrics: new Map(),
        hotSpots: [],
        annotations: [],
        totalExecutionTime: (profile.endTime - profile.startTime) / 1000 || 0,
      };

      this.sessions.set(session.id, session);
      this.storage.save(session);
      this.notifyChange(session.id);

      return {
        success: true,
        session,
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    } catch (error) {
      errors.push(
        `Failed to parse CPU profile: ${error instanceof Error ? error.message : String(error)}`
      );
      return { success: false, errors };
    }
  }

  /**
   * Build stack from node ID
   */
  private buildStackFromNode(
    nodeId: number,
    nodeMap: Map<number, CPUProfileNode>
  ): StackFrame[] {
    const stack: StackFrame[] = [];
    let currentId: number | undefined = nodeId;

    while (currentId !== undefined) {
      const node = nodeMap.get(currentId);
      if (!node) break;

      stack.push({
        functionName: node.callFrame.functionName,
        scriptId: node.callFrame.scriptId,
        url: node.callFrame.url,
        lineNumber: node.callFrame.lineNumber + 1, // Convert to 1-based
        columnNumber: node.callFrame.columnNumber + 1,
        moduleName: this.extractModuleName(node.callFrame.url),
        isNative: node.callFrame.scriptId === '0',
        hash: `${node.callFrame.functionName}:${node.callFrame.scriptId}:${node.callFrame.lineNumber}`,
      });

      currentId = node.parent;
    }

    return stack.reverse();
  }

  /**
   * Extract module name from URL
   */
  private extractModuleName(url: string): string | undefined {
    if (!url) return undefined;
    const match = url.match(/node_modules\/([^/]+)/);
    return match ? match[1] : undefined;
  }

  // ============================================
  // SESSION GROUPS
  // ============================================

  /**
   * Create a session group
   */
  createGroup(name: string, description?: string): SessionGroup {
    const group: SessionGroup = {
      id: `group-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      name,
      description,
      sessionIds: [],
      createdAt: new Date(),
    };

    this.groups.set(group.id, group);
    return group;
  }

  /**
   * Get all groups
   */
  getGroups(): SessionGroup[] {
    return Array.from(this.groups.values());
  }

  /**
   * Add session to group
   */
  addToGroup(sessionId: string, groupId: string): boolean {
    const group = this.groups.get(groupId);
    if (!group || !this.sessions.has(sessionId)) return false;

    if (!group.sessionIds.includes(sessionId)) {
      group.sessionIds.push(sessionId);
    }

    return true;
  }

  /**
   * Remove session from group
   */
  removeFromGroup(sessionId: string, groupId: string): boolean {
    const group = this.groups.get(groupId);
    if (!group) return false;

    const index = group.sessionIds.indexOf(sessionId);
    if (index >= 0) {
      group.sessionIds.splice(index, 1);
      return true;
    }

    return false;
  }

  /**
   * Delete group
   */
  deleteGroup(groupId: string): boolean {
    return this.groups.delete(groupId);
  }

  // ============================================
  // ANNOTATIONS
  // ============================================

  /**
   * Add annotation to session
   */
  addAnnotation(
    sessionId: string,
    annotation: Omit<ProfileAnnotation, 'id'>
  ): ProfileAnnotation | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    const fullAnnotation: ProfileAnnotation = {
      ...annotation,
      id: `ann-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    };

    session.annotations.push(fullAnnotation);
    this.storage.save(session);
    this.notifyChange(sessionId);

    return fullAnnotation;
  }

  /**
   * Update annotation
   */
  updateAnnotation(
    sessionId: string,
    annotationId: string,
    updates: Partial<Omit<ProfileAnnotation, 'id'>>
  ): ProfileAnnotation | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    const annotation = session.annotations.find((a) => a.id === annotationId);
    if (!annotation) return null;

    Object.assign(annotation, updates);
    this.storage.save(session);
    this.notifyChange(sessionId);

    return annotation;
  }

  /**
   * Delete annotation
   */
  deleteAnnotation(sessionId: string, annotationId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    const index = session.annotations.findIndex((a) => a.id === annotationId);
    if (index < 0) return false;

    session.annotations.splice(index, 1);
    this.storage.save(session);
    this.notifyChange(sessionId);

    return true;
  }

  // ============================================
  // SEARCH AND FILTER
  // ============================================

  /**
   * Search sessions
   */
  searchSessions(options: SessionSearchOptions = {}): ProfileSession[] {
    let sessions = Array.from(this.sessions.values());

    // Filter by status
    if (options.status && options.status.length > 0) {
      sessions = sessions.filter((s) => options.status!.includes(s.status));
    }

    // Filter by name pattern
    if (options.namePattern) {
      const pattern = new RegExp(options.namePattern, 'i');
      sessions = sessions.filter((s) => pattern.test(s.name));
    }

    // Filter by date range
    if (options.dateRange) {
      sessions = sessions.filter((s) => {
        const time = s.startTime.getTime();
        return (
          time >= options.dateRange!.start.getTime() &&
          time <= options.dateRange!.end.getTime()
        );
      });
    }

    // Filter by duration
    if (options.minDuration !== undefined) {
      sessions = sessions.filter(
        (s) => s.totalExecutionTime >= options.minDuration!
      );
    }
    if (options.maxDuration !== undefined) {
      sessions = sessions.filter(
        (s) => s.totalExecutionTime <= options.maxDuration!
      );
    }

    // Sort
    const sortBy = options.sortBy || 'createdAt';
    const sortOrder = options.sortOrder || 'desc';

    sessions.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'createdAt':
          comparison = a.startTime.getTime() - b.startTime.getTime();
          break;
        case 'duration':
          comparison = a.totalExecutionTime - b.totalExecutionTime;
          break;
        case 'sampleCount':
          comparison = a.samples.length - b.samples.length;
          break;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    // Paginate
    if (options.offset !== undefined) {
      sessions = sessions.slice(options.offset);
    }
    if (options.limit !== undefined) {
      sessions = sessions.slice(0, options.limit);
    }

    return sessions;
  }

  // ============================================
  // COMPARISON
  // ============================================

  /**
   * Compare two sessions
   */
  compareSessions(sessionId1: string, sessionId2: string): SessionComparison | null {
    const session1 = this.sessions.get(sessionId1);
    const session2 = this.sessions.get(sessionId2);

    if (!session1 || !session2) return null;

    // Calculate metrics
    const metrics: ComparisonMetrics = {
      durationDiff: session2.totalExecutionTime - session1.totalExecutionTime,
      durationChangePercent:
        session1.totalExecutionTime > 0
          ? ((session2.totalExecutionTime - session1.totalExecutionTime) /
              session1.totalExecutionTime) *
            100
          : 0,
      sampleCountDiff: session2.samples.length - session1.samples.length,
      isImprovement: session2.totalExecutionTime < session1.totalExecutionTime,
    };

    // Compare functions
    const functionDiff: FunctionDiff[] = [];
    const allFunctions = new Set<string>();

    session1.functionMetrics.forEach((_, key) => allFunctions.add(key));
    session2.functionMetrics.forEach((_, key) => allFunctions.add(key));

    allFunctions.forEach((key) => {
      const m1 = session1.functionMetrics.get(key);
      const m2 = session2.functionMetrics.get(key);

      const s1 = {
        selfTime: m1?.selfTime || 0,
        totalTime: m1?.totalTime || 0,
        callCount: m1?.callCount || 0,
      };

      const s2 = {
        selfTime: m2?.selfTime || 0,
        totalTime: m2?.totalTime || 0,
        callCount: m2?.callCount || 0,
      };

      let changeType: FunctionDiff['changeType'];
      if (!m1) changeType = 'new';
      else if (!m2) changeType = 'removed';
      else if (s2.selfTime < s1.selfTime * 0.9) changeType = 'improved';
      else if (s2.selfTime > s1.selfTime * 1.1) changeType = 'regressed';
      else changeType = 'unchanged';

      functionDiff.push({
        functionName: m1?.name || m2?.name || 'unknown',
        scriptUrl: m1?.scriptUrl || m2?.scriptUrl,
        session1: s1,
        session2: s2,
        diff: {
          selfTime: s2.selfTime - s1.selfTime,
          totalTime: s2.totalTime - s1.totalTime,
          callCount: s2.callCount - s1.callCount,
        },
        changeType,
      });
    });

    // Sort by diff magnitude
    functionDiff.sort((a, b) => Math.abs(b.diff.selfTime) - Math.abs(a.diff.selfTime));

    return {
      session1,
      session2,
      metrics,
      functionDiff,
    };
  }

  // ============================================
  // STATISTICS
  // ============================================

  /**
   * Get manager statistics
   */
  getStats(): {
    totalSessions: number;
    activeSession: string | null;
    totalSamples: number;
    totalDuration: number;
    groupCount: number;
  } {
    let totalSamples = 0;
    let totalDuration = 0;

    this.sessions.forEach((session) => {
      totalSamples += session.samples.length;
      totalDuration += session.totalExecutionTime;
    });

    return {
      totalSessions: this.sessions.size,
      activeSession: this.activeSessionId,
      totalSamples,
      totalDuration,
      groupCount: this.groups.size,
    };
  }

  /**
   * Clear all sessions
   */
  async clearAll(): Promise<void> {
    this.sessions.clear();
    this.groups.clear();
    this.activeSessionId = null;
    await this.storage.clear();
  }
}

// ============================================
// SINGLETON INSTANCE
// ============================================

let sessionManagerInstance: ProfilerSessionManager | null = null;

export function getSessionManager(): ProfilerSessionManager {
  if (!sessionManagerInstance) {
    sessionManagerInstance = new ProfilerSessionManager();
  }
  return sessionManagerInstance;
}

export function resetSessionManager(): void {
  sessionManagerInstance = null;
}
