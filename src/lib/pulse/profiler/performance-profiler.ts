/**
 * Kyro IDE - Performance Profiler
 * CPU Profiling Engine with function timing, call tree, and hot spot detection
 */

// ============================================
// TYPES AND INTERFACES
// ============================================

export interface ProfileConfig {
  /** Sampling interval in milliseconds */
  samplingInterval: number;
  /** Maximum profiling duration in milliseconds */
  maxDuration: number;
  /** Include native frames in profile */
  includeNativeFrames: boolean;
  /** Capture stack traces */
  captureStackTraces: boolean;
  /** Maximum stack depth to capture */
  maxStackDepth: number;
  /** Record memory usage during profiling */
  recordMemory: boolean;
  /** Filter by file patterns */
  fileFilters?: string[];
  /** Filter by function patterns */
  functionFilters?: string[];
  /** Profile name */
  name?: string;
  /** Profile description */
  description?: string;
}

export interface ProfileSession {
  /** Unique session identifier */
  id: string;
  /** Session name */
  name: string;
  /** Session description */
  description?: string;
  /** Session start time */
  startTime: Date;
  /** Session end time */
  endTime?: Date;
  /** Session status */
  status: 'pending' | 'running' | 'paused' | 'completed' | 'cancelled' | 'error';
  /** Profile configuration */
  config: ProfileConfig;
  /** Collected samples */
  samples: ProfileSample[];
  /** Function metrics */
  functionMetrics: Map<string, FunctionMetrics>;
  /** Call tree root */
  callTree?: CallTreeNode;
  /** Flame graph data */
  flameGraphData?: FlameGraphNode;
  /** Hot spots detected */
  hotSpots: HotSpot[];
  /** Session annotations */
  annotations: ProfileAnnotation[];
  /** Total execution time */
  totalExecutionTime: number;
  /** Memory statistics */
  memoryStats?: MemoryStats;
  /** Error message if failed */
  errorMessage?: string;
}

export interface ProfileSample {
  /** Sample ID */
  id: string;
  /** Timestamp of the sample */
  timestamp: number;
  /** Stack trace at sample point */
  stack: StackFrame[];
  /** CPU time at sample (microseconds) */
  cpuTime: number;
  /** Memory usage at sample (bytes) */
  memoryUsage?: number;
  /** Thread ID */
  threadId: number;
}

export interface StackFrame {
  /** Function name */
  functionName: string;
  /** Script/URL where function is defined */
  scriptId: string;
  /** Script URL/path */
  url?: string;
  /** Line number (1-based) */
  lineNumber: number;
  /** Column number (1-based) */
  columnNumber: number;
  /** Module name */
  moduleName?: string;
  /** Is native frame */
  isNative: boolean;
  /** Frame hash for comparison */
  hash: string;
}

export interface FunctionMetrics {
  /** Function name */
  name: string;
  /** Script URL */
  scriptUrl?: string;
  /** Line number */
  lineNumber?: number;
  /** Column number */
  columnNumber?: number;
  /** Module name */
  moduleName?: string;
  /** Total self time (microseconds) */
  selfTime: number;
  /** Total time including children (microseconds) */
  totalTime: number;
  /** Average time per call */
  avgTime: number;
  /** Number of calls */
  callCount: number;
  /** Minimum execution time */
  minTime: number;
  /** Maximum execution time */
  maxTime: number;
  /** Self time percentage */
  selfTimePercent: number;
  /** Total time percentage */
  totalTimePercent: number;
  /** Aggregated by module */
  moduleAggregation?: Map<string, number>;
  /** Flame graph node reference */
  flameNode?: FlameGraphNode;
}

export interface CallTreeNode {
  /** Node ID */
  id: string;
  /** Function name */
  functionName: string;
  /** Script URL */
  scriptUrl?: string;
  /** Line number */
  lineNumber?: number;
  /** Column number */
  columnNumber?: number;
  /** Module name */
  moduleName?: string;
  /** Self time (microseconds) */
  selfTime: number;
  /** Total time including children */
  totalTime: number;
  /** Number of calls */
  callCount: number;
  /** Child nodes */
  children: CallTreeNode[];
  /** Parent reference */
  parent?: CallTreeNode;
  /** Is a hot spot */
  isHotSpot: boolean;
  /** Hit count from samples */
  hitCount: number;
}

export interface FlameGraphNode {
  /** Node ID */
  id: string;
  /** Function name */
  name: string;
  /** Module/package name */
  module?: string;
  /** Script URL */
  scriptUrl?: string;
  /** Line number */
  line?: number;
  /** Column number */
  column?: number;
  /** Self time value */
  value: number;
  /** Total time value */
  totalValue: number;
  /** Color index for rendering */
  colorIndex: number;
  /** Color category */
  colorCategory: ColorCategory;
  /** Child nodes */
  children: FlameGraphNode[];
  /** X position in flame graph */
  x?: number;
  /** Width in flame graph */
  width?: number;
  /** Depth level in stack */
  depth?: number;
  /** Is a hot spot */
  isHotSpot?: boolean;
  /** Tooltip text */
  tooltip?: string;
}

export type ColorCategory =
  | 'javascript'
  | 'typescript'
  | 'native'
  | 'nodejs'
  | 'library'
  | 'test'
  | 'config'
  | 'other';

export interface HotSpot {
  /** Function name */
  functionName: string;
  /** Script URL */
  scriptUrl?: string;
  /** Line number */
  lineNumber?: number;
  /** Column number */
  columnNumber?: number;
  /** Module name */
  moduleName?: string;
  /** Self time */
  selfTime: number;
  /** Self time percentage */
  selfTimePercent: number;
  /** Total time */
  totalTime: number;
  /** Total time percentage */
  totalTimePercent: number;
  /** Call count */
  callCount: number;
  /** Severity level */
  severity: 'critical' | 'high' | 'medium' | 'low';
  /** Suggested optimization */
  suggestions: string[];
  /** Related flame graph node */
  flameNodeId?: string;
}

export interface ProfileAnnotation {
  /** Annotation ID */
  id: string;
  /** Timestamp */
  timestamp: number;
  /** Annotation type */
  type: 'marker' | 'note' | 'range' | 'bookmark';
  /** Label text */
  label: string;
  /** Description */
  description?: string;
  /** Color for visualization */
  color?: string;
  /** Range end timestamp (for range type) */
  endTimestamp?: number;
  /** Associated sample IDs */
  sampleIds?: string[];
}

export interface MemoryStats {
  /** Initial heap size */
  initialHeapSize: number;
  /** Peak heap size */
  peakHeapSize: number;
  /** Final heap size */
  finalHeapSize: number;
  /** Total allocated memory */
  totalAllocated: number;
  /** Garbage collection events */
  gcEvents: GCEvent[];
  /** Memory timeline */
  memoryTimeline: MemoryPoint[];
}

export interface GCEvent {
  /** Timestamp */
  timestamp: number;
  /** GC type */
  type: 'scavenge' | 'mark-sweep' | 'mark-sweep-compact';
  /** Duration in microseconds */
  duration: number;
  /** Memory before GC */
  beforeMemory: number;
  /** Memory after GC */
  afterMemory: number;
}

export interface MemoryPoint {
  /** Timestamp */
  timestamp: number;
  /** Used heap size */
  usedHeapSize: number;
  /** Total heap size */
  totalHeapSize: number;
  /** External memory */
  externalMemory?: number;
}

export interface ProfileComparison {
  /** Base profile session */
  baseSession: ProfileSession;
  /** Comparison profile session */
  compareSession: ProfileSession;
  /** Function comparisons */
  functionComparisons: FunctionComparison[];
  /** Overall statistics */
  statistics: ComparisonStatistics;
  /** Regression alerts */
  regressions: RegressionAlert[];
}

export interface FunctionComparison {
  /** Function name */
  functionName: string;
  /** Script URL */
  scriptUrl?: string;
  /** Base self time */
  baseSelfTime: number;
  /** Compare self time */
  compareSelfTime: number;
  /** Self time difference */
  selfTimeDiff: number;
  /** Self time change percentage */
  selfTimeChangePercent: number;
  /** Base total time */
  baseTotalTime: number;
  /** Compare total time */
  compareTotalTime: number;
  /** Total time difference */
  totalTimeDiff: number;
  /** Total time change percentage */
  totalTimeChangePercent: number;
  /** Base call count */
  baseCallCount: number;
  /** Compare call count */
  compareCallCount: number;
  /** Call count difference */
  callCountDiff: number;
  /** Is regression */
  isRegression: boolean;
  /** Significance level */
  significance: 'major' | 'moderate' | 'minor' | 'unchanged';
}

export interface ComparisonStatistics {
  /** Total duration change */
  totalDurationDiff: number;
  /** Total duration change percent */
  totalDurationChangePercent: number;
  /** Number of improved functions */
  improvedFunctions: number;
  /** Number of regressed functions */
  regressedFunctions: number;
  /** Number of new functions */
  newFunctions: number;
  /** Number of removed functions */
  removedFunctions: number;
  /** Average change percent */
  averageChangePercent: number;
}

export interface RegressionAlert {
  /** Function name */
  functionName: string;
  /** Alert severity */
  severity: 'critical' | 'high' | 'medium';
  /** Regression percentage */
  regressionPercent: number;
  /** Details */
  details: string;
  /** Suggested actions */
  suggestions: string[];
}

// ============================================
// DEFAULT CONFIGURATION
// ============================================

export const DEFAULT_PROFILE_CONFIG: ProfileConfig = {
  samplingInterval: 100,
  maxDuration: 60000,
  includeNativeFrames: false,
  captureStackTraces: true,
  maxStackDepth: 64,
  recordMemory: true,
  name: 'Untitled Profile',
  description: '',
};

// ============================================
// PERFORMANCE PROFILER CLASS
// ============================================

export class PerformanceProfiler {
  private sessions: Map<string, ProfileSession> = new Map();
  private activeSessionId: string | null = null;
  private sampleCounter: number = 0;
  private isProfiling: boolean = false;
  private samplingTimer: ReturnType<typeof setInterval> | null = null;
  private startTime: number = 0;
  private onSessionChange?: (session: ProfileSession) => void;

  constructor() {
    this.sessions = new Map();
  }

  /**
   * Set callback for session changes
   */
  setOnSessionChange(callback: (session: ProfileSession) => void): void {
    this.onSessionChange = callback;
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `profile-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Generate unique sample ID
   */
  private generateSampleId(): string {
    return `sample-${++this.sampleCounter}`;
  }

  /**
   * Create hash for stack frame
   */
  private hashFrame(frame: StackFrame): string {
    return `${frame.functionName}:${frame.scriptId}:${frame.lineNumber}:${frame.columnNumber}`;
  }

  /**
   * Start a new profiling session
   */
  startSession(config: Partial<ProfileConfig> = {}): ProfileSession {
    const fullConfig: ProfileConfig = {
      ...DEFAULT_PROFILE_CONFIG,
      ...config,
    };

    const session: ProfileSession = {
      id: this.generateSessionId(),
      name: fullConfig.name || 'Untitled Profile',
      description: fullConfig.description,
      startTime: new Date(),
      status: 'running',
      config: fullConfig,
      samples: [],
      functionMetrics: new Map(),
      hotSpots: [],
      annotations: [],
      totalExecutionTime: 0,
    };

    this.sessions.set(session.id, session);
    this.activeSessionId = session.id;
    this.isProfiling = true;
    this.startTime = performance.now();

    // Start sampling
    this.startSampling(session, fullConfig);

    // Set max duration timeout
    if (fullConfig.maxDuration > 0) {
      setTimeout(() => {
        if (this.activeSessionId === session.id && session.status === 'running') {
          this.stopSession(session.id);
        }
      }, fullConfig.maxDuration);
    }

    this.notifySessionChange(session);
    return session;
  }

  /**
   * Start sampling loop
   */
  private startSampling(session: ProfileSession, config: ProfileConfig): void {
    this.samplingTimer = setInterval(() => {
      if (this.isProfiling && session.status === 'running') {
        this.captureSample(session, config);
      }
    }, config.samplingInterval);
  }

  /**
   * Capture a single sample
   */
  private captureSample(session: ProfileSession, config: ProfileConfig): void {
    const now = performance.now();
    const elapsed = now - this.startTime;

    // Create a sample with current call stack
    // In a real implementation, this would capture the actual call stack
    const sample: ProfileSample = {
      id: this.generateSampleId(),
      timestamp: elapsed,
      stack: this.getCurrentStack(config),
      cpuTime: elapsed * 1000, // Convert to microseconds
      memoryUsage: config.recordMemory ? this.getMemoryUsage() : undefined,
      threadId: 0,
    };

    session.samples.push(sample);

    // Process sample for function metrics
    this.processSample(session, sample);

    // Notify listeners periodically
    if (session.samples.length % 100 === 0) {
      this.notifySessionChange(session);
    }
  }

  /**
   * Get current call stack (simulated)
   * In a real implementation, this would use V8's profiler API
   */
  private getCurrentStack(config: ProfileConfig): StackFrame[] {
    // This is a placeholder - real implementation would use
    // Chrome DevTools Protocol or Node.js inspector
    const stack: StackFrame[] = [];

    // Simulate stack depth limit
    const depth = Math.min(Math.floor(Math.random() * 10) + 1, config.maxStackDepth);

    for (let i = 0; i < depth; i++) {
      const frame: StackFrame = {
        functionName: `function_${Math.floor(Math.random() * 100)}`,
        scriptId: `script_${Math.floor(Math.random() * 10)}`,
        url: `/src/module_${Math.floor(Math.random() * 5)}.ts`,
        lineNumber: Math.floor(Math.random() * 100) + 1,
        columnNumber: Math.floor(Math.random() * 80) + 1,
        moduleName: `module_${Math.floor(Math.random() * 5)}`,
        isNative: config.includeNativeFrames && Math.random() > 0.9,
        hash: '',
      };
      frame.hash = this.hashFrame(frame);

      if (!frame.isNative || config.includeNativeFrames) {
        stack.push(frame);
      }
    }

    return stack;
  }

  /**
   * Get memory usage
   */
  private getMemoryUsage(): number {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage().heapUsed;
    }
    if (typeof performance !== 'undefined' && (performance as any).memory) {
      return (performance as any).memory.usedJSHeapSize;
    }
    return 0;
  }

  /**
   * Process a sample for metrics
   */
  private processSample(session: ProfileSession, sample: ProfileSample): void {
    const stack = sample.stack;

    // Update metrics for each frame in the stack
    stack.forEach((frame, index) => {
      const key = frame.hash;
      let metrics = session.functionMetrics.get(key);

      if (!metrics) {
        metrics = {
          name: frame.functionName,
          scriptUrl: frame.url,
          lineNumber: frame.lineNumber,
          columnNumber: frame.columnNumber,
          moduleName: frame.moduleName,
          selfTime: 0,
          totalTime: 0,
          avgTime: 0,
          callCount: 0,
          minTime: Infinity,
          maxTime: 0,
          selfTimePercent: 0,
          totalTimePercent: 0,
        };
        session.functionMetrics.set(key, metrics);
      }

      // Self time is only for leaf functions
      if (index === 0) {
        metrics.selfTime += session.config.samplingInterval * 1000; // microseconds
      }

      // Total time for all functions in stack
      metrics.totalTime += session.config.samplingInterval * 1000; // microseconds
      metrics.callCount++;
      metrics.minTime = Math.min(metrics.minTime, session.config.samplingInterval * 1000);
      metrics.maxTime = Math.max(metrics.maxTime, session.config.samplingInterval * 1000);
      metrics.avgTime = metrics.totalTime / metrics.callCount;
    });
  }

  /**
   * Stop the active profiling session
   */
  stopSession(sessionId?: string): ProfileSession | null {
    const id = sessionId || this.activeSessionId;
    if (!id) return null;

    const session = this.sessions.get(id);
    if (!session) return null;

    // Stop sampling
    if (this.samplingTimer) {
      clearInterval(this.samplingTimer);
      this.samplingTimer = null;
    }

    this.isProfiling = false;
    session.status = 'completed';
    session.endTime = new Date();
    session.totalExecutionTime = performance.now() - this.startTime;

    // Calculate final metrics
    this.calculateFinalMetrics(session);

    // Generate call tree
    session.callTree = this.generateCallTree(session);

    // Generate flame graph data
    session.flameGraphData = this.generateFlameGraphData(session);

    // Detect hot spots
    session.hotSpots = this.detectHotSpots(session);

    if (this.activeSessionId === id) {
      this.activeSessionId = null;
    }

    this.notifySessionChange(session);
    return session;
  }

  /**
   * Pause profiling session
   */
  pauseSession(sessionId?: string): boolean {
    const id = sessionId || this.activeSessionId;
    if (!id) return false;

    const session = this.sessions.get(id);
    if (!session || session.status !== 'running') return false;

    session.status = 'paused';
    this.isProfiling = false;

    if (this.samplingTimer) {
      clearInterval(this.samplingTimer);
      this.samplingTimer = null;
    }

    this.notifySessionChange(session);
    return true;
  }

  /**
   * Resume paused session
   */
  resumeSession(sessionId?: string): boolean {
    const id = sessionId || this.activeSessionId;
    if (!id) return false;

    const session = this.sessions.get(id);
    if (!session || session.status !== 'paused') return false;

    session.status = 'running';
    this.isProfiling = true;
    this.startSampling(session, session.config);

    this.notifySessionChange(session);
    return true;
  }

  /**
   * Cancel profiling session
   */
  cancelSession(sessionId?: string): boolean {
    const id = sessionId || this.activeSessionId;
    if (!id) return false;

    const session = this.sessions.get(id);
    if (!session) return false;

    if (this.samplingTimer) {
      clearInterval(this.samplingTimer);
      this.samplingTimer = null;
    }

    session.status = 'cancelled';
    session.endTime = new Date();
    this.isProfiling = false;

    if (this.activeSessionId === id) {
      this.activeSessionId = null;
    }

    this.notifySessionChange(session);
    return true;
  }

  /**
   * Calculate final metrics after profiling
   */
  private calculateFinalMetrics(session: ProfileSession): void {
    const totalTime = session.totalExecutionTime * 1000; // microseconds

    session.functionMetrics.forEach((metrics) => {
      metrics.selfTimePercent = (metrics.selfTime / totalTime) * 100;
      metrics.totalTimePercent = (metrics.totalTime / totalTime) * 100;
    });
  }

  /**
   * Generate call tree from samples
   */
  private generateCallTree(session: ProfileSession): CallTreeNode {
    const root: CallTreeNode = {
      id: 'root',
      functionName: '(root)',
      selfTime: 0,
      totalTime: session.totalExecutionTime * 1000,
      callCount: 1,
      children: [],
      isHotSpot: false,
      hitCount: session.samples.length,
    };

    // Process each sample
    session.samples.forEach((sample) => {
      let currentNode = root;
      const stack = [...sample.stack].reverse(); // Bottom to top

      stack.forEach((frame) => {
        let child = currentNode.children.find(
          (c) => c.functionName === frame.functionName &&
                 c.lineNumber === frame.lineNumber
        );

        if (!child) {
          child = {
            id: `${currentNode.id}-${frame.functionName}-${frame.lineNumber}`,
            functionName: frame.functionName,
            scriptUrl: frame.url,
            lineNumber: frame.lineNumber,
            columnNumber: frame.columnNumber,
            moduleName: frame.moduleName,
            selfTime: 0,
            totalTime: 0,
            callCount: 0,
            children: [],
            parent: currentNode,
            isHotSpot: false,
            hitCount: 0,
          };
          currentNode.children.push(child);
        }

        child.hitCount++;
        currentNode = child;
      });

      // Add self time to leaf
      if (currentNode !== root) {
        currentNode.selfTime += session.config.samplingInterval * 1000;
      }
    });

    // Calculate total times
    this.calculateNodeTotalTimes(root);

    // Mark hot spots
    const avgHitCount = session.samples.length / this.countNodes(root);
    this.markHotSpots(root, avgHitCount);

    return root;
  }

  /**
   * Calculate total times for call tree nodes
   */
  private calculateNodeTotalTimes(node: CallTreeNode): number {
    let total = node.selfTime;

    node.children.forEach((child) => {
      total += this.calculateNodeTotalTimes(child);
    });

    node.totalTime = total;
    return total;
  }

  /**
   * Count nodes in tree
   */
  private countNodes(node: CallTreeNode): number {
    let count = 1;
    node.children.forEach((child) => {
      count += this.countNodes(child);
    });
    return count;
  }

  /**
   * Mark hot spots in call tree
   */
  private markHotSpots(node: CallTreeNode, threshold: number): void {
    node.isHotSpot = node.hitCount > threshold * 2;
    node.children.forEach((child) => {
      this.markHotSpots(child, threshold);
    });
  }

  /**
   * Generate flame graph data
   */
  private generateFlameGraphData(session: ProfileSession): FlameGraphNode {
    const stackMap = new Map<string, { count: number; frames: StackFrame[] }>();

    // Aggregate stacks
    session.samples.forEach((sample) => {
      const stackKey = sample.stack.map((f) => f.hash).join('|');
      const existing = stackMap.get(stackKey);

      if (existing) {
        existing.count++;
      } else {
        stackMap.set(stackKey, {
          count: 1,
          frames: sample.stack,
        });
      }
    });

    // Build flame graph tree
    const root: FlameGraphNode = {
      id: 'flame-root',
      name: '(root)',
      value: session.samples.length,
      totalValue: session.samples.length,
      colorIndex: 0,
      colorCategory: 'other',
      children: [],
    };

    stackMap.forEach(({ count, frames }) => {
      let current = root;
      const reversedFrames = [...frames].reverse();

      reversedFrames.forEach((frame) => {
        let child = current.children.find((c) => c.name === frame.functionName);

        if (!child) {
          child = {
            id: `flame-${frame.hash}`,
            name: frame.functionName,
            module: frame.moduleName,
            scriptUrl: frame.url,
            line: frame.lineNumber,
            column: frame.columnNumber,
            value: 0,
            totalValue: count,
            colorIndex: this.getColorIndex(frame),
            colorCategory: this.getColorCategory(frame),
            children: [],
            isHotSpot: false,
            tooltip: this.generateTooltip(frame),
          };
          current.children.push(child);
        }

        child.value += count;
        current = child;
      });
    });

    // Calculate total values and mark hot spots
    this.calculateFlameValues(root);
    const avgValue = session.samples.length / stackMap.size;
    this.markFlameHotSpots(root, avgValue * 2);

    return root;
  }

  /**
   * Get color index for frame
   */
  private getColorIndex(frame: StackFrame): number {
    const colors = [
      'javascript', 'typescript', 'native', 'nodejs', 'library', 'test', 'config', 'other'
    ];
    const category = this.getColorCategory(frame);
    return colors.indexOf(category);
  }

  /**
   * Get color category for frame
   */
  private getColorCategory(frame: StackFrame): ColorCategory {
    if (frame.isNative) return 'native';
    if (frame.url?.includes('node_modules')) return 'library';
    if (frame.url?.includes('.test.') || frame.url?.includes('.spec.')) return 'test';
    if (frame.url?.includes('config')) return 'config';
    if (frame.url?.endsWith('.ts') || frame.url?.endsWith('.tsx')) return 'typescript';
    if (frame.url?.endsWith('.js') || frame.url?.endsWith('.jsx')) return 'javascript';
    if (frame.moduleName?.includes('node:')) return 'nodejs';
    return 'other';
  }

  /**
   * Generate tooltip for frame
   */
  private generateTooltip(frame: StackFrame): string {
    const parts = [frame.functionName];
    if (frame.url) parts.push(`at ${frame.url}:${frame.lineNumber}:${frame.columnNumber}`);
    if (frame.moduleName) parts.push(`[${frame.moduleName}]`);
    return parts.join(' ');
  }

  /**
   * Calculate flame graph values
   */
  private calculateFlameValues(node: FlameGraphNode): number {
    let childSum = 0;
    node.children.forEach((child) => {
      childSum += this.calculateFlameValues(child);
    });

    // Value is self + children total
    if (node.children.length === 0) {
      // Leaf node - value is already set
    } else {
      node.value = node.totalValue - childSum;
    }

    return node.totalValue;
  }

  /**
   * Mark hot spots in flame graph
   */
  private markFlameHotSpots(node: FlameGraphNode, threshold: number): void {
    node.isHotSpot = (node.totalValue || 0) > threshold;
    node.children.forEach((child) => {
      this.markFlameHotSpots(child, threshold);
    });
  }

  /**
   * Detect hot spots from profiling data
   */
  private detectHotSpots(session: ProfileSession): HotSpot[] {
    const hotSpots: HotSpot[] = [];
    const totalTime = session.totalExecutionTime * 1000; // microseconds
    const threshold = 0.05; // 5% threshold for hot spot

    session.functionMetrics.forEach((metrics, key) => {
      const selfTimePercent = (metrics.selfTime / totalTime) * 100;

      if (selfTimePercent > threshold * 100) {
        let severity: 'critical' | 'high' | 'medium' | 'low';

        if (selfTimePercent > 20) severity = 'critical';
        else if (selfTimePercent > 10) severity = 'high';
        else if (selfTimePercent > 5) severity = 'medium';
        else severity = 'low';

        const hotSpot: HotSpot = {
          functionName: metrics.name,
          scriptUrl: metrics.scriptUrl,
          lineNumber: metrics.lineNumber,
          columnNumber: metrics.columnNumber,
          moduleName: metrics.moduleName,
          selfTime: metrics.selfTime,
          selfTimePercent,
          totalTime: metrics.totalTime,
          totalTimePercent: (metrics.totalTime / totalTime) * 100,
          callCount: metrics.callCount,
          severity,
          suggestions: this.generateOptimizationSuggestions(metrics),
          flameNodeId: key,
        };

        hotSpots.push(hotSpot);
      }
    });

    // Sort by self time descending
    hotSpots.sort((a, b) => b.selfTime - a.selfTime);

    return hotSpots;
  }

  /**
   * Generate optimization suggestions for hot spot
   */
  private generateOptimizationSuggestions(metrics: FunctionMetrics): string[] {
    const suggestions: string[] = [];

    if (metrics.callCount > 10000) {
      suggestions.push('High call count detected. Consider caching results or memoization.');
    }

    if (metrics.avgTime > 1000) {
      suggestions.push('High average execution time. Consider optimizing algorithm complexity.');
    }

    if (metrics.maxTime > metrics.avgTime * 10) {
      suggestions.push('High variance in execution time. Check for edge cases or cache misses.');
    }

    if (suggestions.length === 0) {
      suggestions.push('Profile this function to identify specific bottlenecks.');
    }

    return suggestions;
  }

  /**
   * Compare two profile sessions
   */
  compareProfiles(
    baseSessionId: string,
    compareSessionId: string
  ): ProfileComparison | null {
    const baseSession = this.sessions.get(baseSessionId);
    const compareSession = this.sessions.get(compareSessionId);

    if (!baseSession || !compareSession) return null;

    const functionComparisons: FunctionComparison[] = [];
    const regressions: RegressionAlert[] = [];

    // Compare all functions from both sessions
    const allFunctions = new Set<string>();
    baseSession.functionMetrics.forEach((_, key) => allFunctions.add(key));
    compareSession.functionMetrics.forEach((_, key) => allFunctions.add(key));

    const baseTotalDuration = baseSession.totalExecutionTime * 1000;
    const compareTotalDuration = compareSession.totalExecutionTime * 1000;

    allFunctions.forEach((key) => {
      const baseMetrics = baseSession.functionMetrics.get(key);
      const compareMetrics = compareSession.functionMetrics.get(key);

      const comparison: FunctionComparison = {
        functionName: baseMetrics?.name || compareMetrics?.name || 'unknown',
        scriptUrl: baseMetrics?.scriptUrl || compareMetrics?.scriptUrl,
        baseSelfTime: baseMetrics?.selfTime || 0,
        compareSelfTime: compareMetrics?.selfTime || 0,
        selfTimeDiff: (compareMetrics?.selfTime || 0) - (baseMetrics?.selfTime || 0),
        selfTimeChangePercent: this.calculateChangePercent(
          baseMetrics?.selfTime || 0,
          compareMetrics?.selfTime || 0
        ),
        baseTotalTime: baseMetrics?.totalTime || 0,
        compareTotalTime: compareMetrics?.totalTime || 0,
        totalTimeDiff: (compareMetrics?.totalTime || 0) - (baseMetrics?.totalTime || 0),
        totalTimeChangePercent: this.calculateChangePercent(
          baseMetrics?.totalTime || 0,
          compareMetrics?.totalTime || 0
        ),
        baseCallCount: baseMetrics?.callCount || 0,
        compareCallCount: compareMetrics?.callCount || 0,
        callCountDiff: (compareMetrics?.callCount || 0) - (baseMetrics?.callCount || 0),
        isRegression: false,
        significance: 'unchanged',
      };

      // Determine significance
      if (Math.abs(comparison.selfTimeChangePercent) > 50) {
        comparison.significance = 'major';
      } else if (Math.abs(comparison.selfTimeChangePercent) > 20) {
        comparison.significance = 'moderate';
      } else if (Math.abs(comparison.selfTimeChangePercent) > 5) {
        comparison.significance = 'minor';
      }

      // Check for regression
      if (comparison.selfTimeChangePercent > 20) {
        comparison.isRegression = true;

        const severity = comparison.selfTimeChangePercent > 100 ? 'critical' :
                        comparison.selfTimeChangePercent > 50 ? 'high' : 'medium';

        regressions.push({
          functionName: comparison.functionName,
          severity,
          regressionPercent: comparison.selfTimeChangePercent,
          details: `Self time increased by ${comparison.selfTimeChangePercent.toFixed(1)}%`,
          suggestions: [
            'Compare code changes between profiles',
            'Check for new dependencies or imports',
            'Verify caching is still effective',
          ],
        });
      }

      functionComparisons.push(comparison);
    });

    // Calculate statistics
    const improvedFunctions = functionComparisons.filter(
      (c) => c.selfTimeChangePercent < -5
    ).length;
    const regressedFunctions = functionComparisons.filter(
      (c) => c.selfTimeChangePercent > 5
    ).length;
    const newFunctions = functionComparisons.filter(
      (c) => c.baseSelfTime === 0 && c.compareSelfTime > 0
    ).length;
    const removedFunctions = functionComparisons.filter(
      (c) => c.baseSelfTime > 0 && c.compareSelfTime === 0
    ).length;

    const statistics: ComparisonStatistics = {
      totalDurationDiff: compareTotalDuration - baseTotalDuration,
      totalDurationChangePercent: this.calculateChangePercent(
        baseTotalDuration,
        compareTotalDuration
      ),
      improvedFunctions,
      regressedFunctions,
      newFunctions,
      removedFunctions,
      averageChangePercent: functionComparisons.reduce(
        (sum, c) => sum + Math.abs(c.selfTimeChangePercent), 0
      ) / functionComparisons.length,
    };

    return {
      baseSession,
      compareSession,
      functionComparisons,
      statistics,
      regressions,
    };
  }

  /**
   * Calculate percentage change
   */
  private calculateChangePercent(base: number, compare: number): number {
    if (base === 0) {
      return compare > 0 ? 100 : 0;
    }
    return ((compare - base) / base) * 100;
  }

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
      id: `annotation-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    };

    session.annotations.push(fullAnnotation);
    this.notifySessionChange(session);

    return fullAnnotation;
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
   * Delete session
   */
  deleteSession(sessionId: string): boolean {
    if (this.activeSessionId === sessionId) {
      this.cancelSession(sessionId);
    }
    return this.sessions.delete(sessionId);
  }

  /**
   * Notify session change listeners
   */
  private notifySessionChange(session: ProfileSession): void {
    if (this.onSessionChange) {
      this.onSessionChange(session);
    }
  }

  /**
   * Get profiler statistics
   */
  getStats(): {
    totalSessions: number;
    activeSessions: number;
    completedSessions: number;
    isProfiling: boolean;
  } {
    let active = 0;
    let completed = 0;

    this.sessions.forEach((session) => {
      if (session.status === 'running') active++;
      if (session.status === 'completed') completed++;
    });

    return {
      totalSessions: this.sessions.size,
      activeSessions: active,
      completedSessions,
      isProfiling: this.isProfiling,
    };
  }
}

// ============================================
// SINGLETON INSTANCE
// ============================================

let profilerInstance: PerformanceProfiler | null = null;

export function getProfiler(): PerformanceProfiler {
  if (!profilerInstance) {
    profilerInstance = new PerformanceProfiler();
  }
  return profilerInstance;
}

export function resetProfiler(): void {
  if (profilerInstance) {
    profilerInstance.cancelSession();
  }
  profilerInstance = null;
}
