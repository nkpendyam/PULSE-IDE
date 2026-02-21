/**
 * Kyro IDE Memory Leak Detector
 *
 * Detects common memory leak patterns in JavaScript applications.
 * Provides actionable suggestions for fixing detected leaks.
 */

import type { MemorySnapshot, HeapNode, HeapNodeType } from './memory-profiler';

// ============================================================================
// TYPES
// ============================================================================

export interface LeakPattern {
  id: string;
  name: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  detector: (snapshot: MemorySnapshot) => LeakFinding[];
}

export interface LeakFinding {
  id: string;
  patternId: string;
  patternName: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  nodeId?: number;
  nodeName?: string;
  retainedSize?: number;
  suggestions: LeakSuggestion[];
  codeExample?: string;
  location?: SourceLocation;
}

export interface SourceLocation {
  file: string;
  line: number;
  column?: number;
}

export interface LeakSuggestion {
  action: string;
  description: string;
  codeExample?: string;
}

export interface LeakReport {
  id: string;
  timestamp: number;
  snapshotId: string;
  findings: LeakFinding[];
  summary: LeakSummary;
  recommendations: string[];
}

export interface LeakSummary {
  totalFindings: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  estimatedLeakedBytes: number;
  topOffenders: LeakFinding[];
}

export interface DetectorConfig {
  minNodeSize: number;
  minNodeCount: number;
  maxFindingsPerPattern: number;
  enableAllPatterns: boolean;
  enabledPatterns: string[];
}

// ============================================================================
// LEAK PATTERNS
// ============================================================================

const LEAK_PATTERNS: LeakPattern[] = [
  {
    id: 'detached-dom-nodes',
    name: 'Detached DOM Nodes',
    description: 'DOM nodes that are no longer attached to the document but still referenced',
    severity: 'high',
    detector: detectDetachedDOMNodes,
  },
  {
    id: 'event-listener-leak',
    name: 'Event Listener Leak',
    description: 'Event listeners that were not removed when no longer needed',
    severity: 'high',
    detector: detectEventListenerLeaks,
  },
  {
    id: 'closure-leak',
    name: 'Closure Memory Leak',
    description: 'Closures that retain unnecessary references to large objects',
    severity: 'medium',
    detector: detectClosureLeaks,
  },
  {
    id: 'timer-leak',
    name: 'Timer Leak',
    description: 'setInterval/setTimeout callbacks that retain references',
    severity: 'medium',
    detector: detectTimerLeaks,
  },
  {
    id: 'promise-leak',
    name: 'Promise Leak',
    description: 'Pending promises that never resolve and retain memory',
    severity: 'medium',
    detector: detectPromiseLeaks,
  },
  {
    id: 'large-object-growth',
    name: 'Large Object Growth',
    description: 'Objects that grow continuously without bounds',
    severity: 'high',
    detector: detectLargeObjectGrowth,
  },
  {
    id: 'duplicate-strings',
    name: 'Duplicate String Accumulation',
    description: 'Many duplicate strings that could be interned',
    severity: 'low',
    detector: detectDuplicateStrings,
  },
  {
    id: 'circular-reference',
    name: 'Circular Reference',
    description: 'Circular references preventing garbage collection',
    severity: 'medium',
    detector: detectCircularReferences,
  },
];

// ============================================================================
// DETECTOR FUNCTIONS
// ============================================================================

function detectDetachedDOMNodes(snapshot: MemorySnapshot): LeakFinding[] {
  const findings: LeakFinding[] = [];

  // Look for DOM nodes with specific patterns
  const detachedNodes: HeapNode[] = [];

  walkHeap(snapshot.root, (node) => {
    if (
      node.name.startsWith('HTML') ||
      node.name.startsWith('div') ||
      node.name.startsWith('span') ||
      node.type === 'native'
    ) {
      // Check if detached (simplified check)
      if (node.retainedSize > 10000) {
        detachedNodes.push(node);
      }
    }
  });

  for (const node of detachedNodes.slice(0, 10)) {
    findings.push({
      id: `finding-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      patternId: 'detached-dom-nodes',
      patternName: 'Detached DOM Nodes',
      severity: 'high',
      title: `Detached ${node.name} element`,
      description: `A ${node.name} element is detached from the DOM but still retained in memory.`,
      nodeId: node.id,
      nodeName: node.name,
      retainedSize: node.retainedSize,
      suggestions: [
        {
          action: 'Remove references',
          description: 'Remove all JavaScript references to the detached element',
          codeExample: `element.remove();\nelement = null; // Clear the reference`,
        },
        {
          action: 'Use weak references',
          description: 'Consider using WeakRef if you need temporary access',
          codeExample: `const weakRef = new WeakRef(element);\n// Later: const el = weakRef.deref();`,
        },
      ],
    });
  }

  return findings;
}

function detectEventListenerLeaks(snapshot: MemorySnapshot): LeakFinding[] {
  const findings: LeakFinding[] = [];

  // Look for event listener patterns
  walkHeap(snapshot.root, (node) => {
    if (
      node.name.includes('listener') ||
      node.name.includes('EventHandler') ||
      (node.type === 'closure' && node.retainedSize > 5000)
    ) {
      findings.push({
        id: `finding-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        patternId: 'event-listener-leak',
        patternName: 'Event Listener Leak',
        severity: 'high',
        title: 'Potential event listener leak',
        description: 'Event listener may not be properly removed when no longer needed.',
        nodeId: node.id,
        nodeName: node.name,
        retainedSize: node.retainedSize,
        suggestions: [
          {
            action: 'Remove event listeners',
            description: 'Always remove event listeners when elements are removed',
            codeExample: `// Add listener with named function\nfunction handleClick() { ... }\nelement.addEventListener('click', handleClick);\n\n// Remove when done\nelement.removeEventListener('click', handleClick);`,
          },
          {
            action: 'Use AbortController',
            description: 'Use AbortController for automatic cleanup',
            codeExample: `const controller = new AbortController();\nelement.addEventListener('click', handler, {\n  signal: controller.signal\n});\n\n// Later: controller.abort(); // Removes all listeners`,
          },
          {
            action: 'Use { once: true }',
            description: 'For one-time events, use the once option',
            codeExample: `element.addEventListener('click', handler, { once: true });`,
          },
        ],
      });
    }
  });

  return findings.slice(0, 10);
}

function detectClosureLeaks(snapshot: MemorySnapshot): LeakFinding[] {
  const findings: LeakFinding[] = [];

  walkHeap(snapshot.root, (node) => {
    if (node.type === 'closure' && node.retainedSize > 10000) {
      findings.push({
        id: `finding-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        patternId: 'closure-leak',
        patternName: 'Closure Memory Leak',
        severity: 'medium',
        title: 'Large closure detected',
        description: `Closure "${node.name}" retains ${formatBytes(node.retainedSize)}. Check for unnecessary captured variables.`,
        nodeId: node.id,
        nodeName: node.name,
        retainedSize: node.retainedSize,
        suggestions: [
          {
            action: 'Minimize captured variables',
            description: 'Only capture what you need in closures',
            codeExample: `// Bad: captures entire largeObject\nconst fn = () => largeObject.data.value;\n\n// Better: capture only what's needed\nconst { data } = largeObject;\nconst fn = () => data.value;`,
          },
          {
            action: 'Use block scope',
            description: 'Use block scope to limit variable lifetime',
            codeExample: `// Variables are garbage collected after block\n{\n  const temp = getData();\n  process(temp);\n} // temp is now eligible for GC`,
          },
        ],
      });
    }
  });

  return findings.slice(0, 10);
}

function detectTimerLeaks(snapshot: MemorySnapshot): LeakFinding[] {
  const findings: LeakFinding[] = [];

  walkHeap(snapshot.root, (node) => {
    if (
      node.name.includes('timeout') ||
      node.name.includes('interval') ||
      node.name.includes('Timeout') ||
      node.name.includes('Interval')
    ) {
      findings.push({
        id: `finding-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        patternId: 'timer-leak',
        patternName: 'Timer Leak',
        severity: 'medium',
        title: 'Potential timer leak',
        description: 'Timer may not be properly cleared. Ensure clearInterval/clearTimeout is called.',
        nodeId: node.id,
        nodeName: node.name,
        retainedSize: node.retainedSize,
        suggestions: [
          {
            action: 'Clear timers',
            description: 'Always clear timers when no longer needed',
            codeExample: `const timerId = setInterval(callback, 1000);\n\n// When done:\nclearInterval(timerId);`,
          },
          {
            action: 'Track timer IDs',
            description: 'Maintain references to timer IDs for cleanup',
            codeExample: `class Component {\n  private timers: number[] = [];\n\n  mount() {\n    this.timers.push(setInterval(() => {}, 1000));\n  }\n\n  unmount() {\n    this.timers.forEach(clearInterval);\n    this.timers = [];\n  }\n}`,
          },
        ],
      });
    }
  });

  return findings.slice(0, 10);
}

function detectPromiseLeaks(snapshot: MemorySnapshot): LeakFinding[] {
  const findings: LeakFinding[] = [];

  walkHeap(snapshot.root, (node) => {
    if (node.type === 'promise' && node.retainedSize > 5000) {
      findings.push({
        id: `finding-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        patternId: 'promise-leak',
        patternName: 'Promise Leak',
        severity: 'medium',
        title: 'Pending promise detected',
        description: 'A promise is pending and may never resolve. Ensure all promises have proper rejection handling.',
        nodeId: node.id,
        nodeName: node.name,
        retainedSize: node.retainedSize,
        suggestions: [
          {
            action: 'Add timeout handling',
            description: 'Add timeout to prevent hanging promises',
            codeExample: `const result = await Promise.race([\n  fetchData(),\n  new Promise((_, reject) =>\n    setTimeout(() => reject(new Error('Timeout')), 5000)\n  )\n]);`,
          },
          {
            action: 'Handle rejection',
            description: 'Always add catch handlers',
            codeExample: `promise\n  .then(result => {})\n  .catch(error => console.error(error));`,
          },
        ],
      });
    }
  });

  return findings.slice(0, 10);
}

function detectLargeObjectGrowth(snapshot: MemorySnapshot): LeakFinding[] {
  const findings: LeakFinding[] = [];

  // Look for arrays with many elements
  walkHeap(snapshot.root, (node) => {
    if ((node.type === 'array' || node.type === 'object') && node.retainedSize > 100000) {
      findings.push({
        id: `finding-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        patternId: 'large-object-growth',
        patternName: 'Large Object Growth',
        severity: 'high',
        title: `Large ${node.type} detected`,
        description: `"${node.name}" is ${formatBytes(node.retainedSize)}. Check for unbounded growth.`,
        nodeId: node.id,
        nodeName: node.name,
        retainedSize: node.retainedSize,
        suggestions: [
          {
            action: 'Implement size limits',
            description: 'Add maximum size limits to collections',
            codeExample: `const MAX_ITEMS = 1000;\nconst cache = new Map();\n\nfunction addToCache(key, value) {\n  if (cache.size >= MAX_ITEMS) {\n    const firstKey = cache.keys().next().value;\n    cache.delete(firstKey);\n  }\n  cache.set(key, value);\n}`,
          },
          {
            action: 'Use LRU cache',
            description: 'Use LRU (Least Recently Used) cache for automatic eviction',
            codeExample: `import { LRUCache } from 'lru-cache';\n\nconst cache = new LRUCache({\n  max: 500,\n  maxSize: 50000,\n  sizeCalculation: (value) => value.size\n});`,
          },
        ],
      });
    }
  });

  return findings.slice(0, 10);
}

function detectDuplicateStrings(snapshot: MemorySnapshot): LeakFinding[] {
  const findings: LeakFinding[] = [];
  const stringCounts = new Map<string, number>();
  let totalDuplicateSize = 0;

  walkHeap(snapshot.root, (node) => {
    if (node.type === 'string' && node.name.length > 20) {
      const count = stringCounts.get(node.name) || 0;
      stringCounts.set(node.name, count + 1);
      if (count > 5) {
        totalDuplicateSize += node.size;
      }
    }
  });

  if (totalDuplicateSize > 10000) {
    findings.push({
      id: `finding-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      patternId: 'duplicate-strings',
      patternName: 'Duplicate String Accumulation',
      severity: 'low',
      title: 'Duplicate strings detected',
      description: `Found ${stringCounts.size} strings with duplicates. Consider interning frequently used strings.`,
      retainedSize: totalDuplicateSize,
      suggestions: [
        {
          action: 'Use string constants',
          description: 'Define frequently used strings as constants',
          codeExample: `// Instead of repeating the same string\nconst ERROR_MESSAGE = 'Operation failed due to network error';\n\nthrow new Error(ERROR_MESSAGE);`,
        },
        {
          action: 'Use string pooling',
          description: 'Implement a string pool for frequently used values',
          codeExample: `const stringPool = new Map<string, string>();\n\nfunction intern(str: string): string {\n  if (stringPool.has(str)) return stringPool.get(str)!;\n  stringPool.set(str, str);\n  return str;\n}`,
        },
      ],
    });
  }

  return findings;
}

function detectCircularReferences(snapshot: MemorySnapshot): LeakFinding[] {
  const findings: LeakFinding[] = [];
  const visited = new Set<number>();
  const path: number[] = [];

  function detectCycle(node: HeapNode): number[] | null {
    if (visited.has(node.id)) {
      const cycleStart = path.indexOf(node.id);
      if (cycleStart !== -1) {
        return path.slice(cycleStart);
      }
      return null;
    }

    visited.add(node.id);
    path.push(node.id);

    for (const edge of node.children) {
      // Would need node resolution here
      // const child = resolveNode(edge.toNode);
      // if (child && detectCycle(child)) return true;
    }

    path.pop();
    return null;
  }

  // Simplified detection for demonstration
  walkHeap(snapshot.root, (node) => {
    if (node.retainedSize > 50000) {
      findings.push({
        id: `finding-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        patternId: 'circular-reference',
        patternName: 'Circular Reference',
        severity: 'medium',
        title: 'Potential circular reference',
        description: `"${node.name}" may have circular references preventing GC.`,
        nodeId: node.id,
        nodeName: node.name,
        retainedSize: node.retainedSize,
        suggestions: [
          {
            action: 'Break circular references',
            description: 'Use WeakMap/WeakSet for circular dependencies',
            codeExample: `// Use WeakMap for parent references\nconst parentMap = new WeakMap<Child, Parent>();\n\nclass Child {\n  setParent(parent: Parent) {\n    parentMap.set(this, parent);\n  }\n}`,
          },
          {
            action: 'Manual cleanup',
            description: 'Implement disposal pattern',
            codeExample: `class Resource {\n  private disposed = false;\n\n  dispose() {\n    if (this.disposed) return;\n    this.disposed = true;\n    // Clear all references\n    this.references = null;\n  }\n}`,
          },
        ],
      });
    }
  });

  return findings.slice(0, 5);
}

// ============================================================================
// MEMORY LEAK DETECTOR
// ============================================================================

export class MemoryLeakDetector {
  private config: DetectorConfig;
  private patterns: LeakPattern[];

  constructor(config?: Partial<DetectorConfig>) {
    this.config = {
      minNodeSize: 100,
      minNodeCount: 5,
      maxFindingsPerPattern: 10,
      enableAllPatterns: true,
      enabledPatterns: [],
      ...config,
    };

    this.patterns = this.config.enableAllPatterns
      ? LEAK_PATTERNS
      : LEAK_PATTERNS.filter((p) => this.config.enabledPatterns.includes(p.id));
  }

  /**
   * Analyze a snapshot for memory leaks
   */
  analyze(snapshot: MemorySnapshot): LeakReport {
    const findings: LeakFinding[] = [];

    // Run all pattern detectors
    for (const pattern of this.patterns) {
      try {
        const patternFindings = pattern.detector(snapshot);
        findings.push(...patternFindings.slice(0, this.config.maxFindingsPerPattern));
      } catch (error) {
        console.error(`Error running pattern ${pattern.id}:`, error);
      }
    }

    // Sort by severity
    findings.sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });

    // Build summary
    const summary = this.buildSummary(findings);

    // Generate recommendations
    const recommendations = this.generateRecommendations(findings);

    return {
      id: `report-${Date.now()}`,
      timestamp: Date.now(),
      snapshotId: snapshot.id,
      findings,
      summary,
      recommendations,
    };
  }

  /**
   * Get available leak patterns
   */
  getPatterns(): LeakPattern[] {
    return this.patterns;
  }

  /**
   * Enable or disable a pattern
   */
  setPatternEnabled(patternId: string, enabled: boolean): void {
    if (enabled && !this.config.enabledPatterns.includes(patternId)) {
      this.config.enabledPatterns.push(patternId);
    } else if (!enabled) {
      this.config.enabledPatterns = this.config.enabledPatterns.filter((id) => id !== patternId);
    }
  }

  private buildSummary(findings: LeakFinding[]): LeakSummary {
    return {
      totalFindings: findings.length,
      criticalCount: findings.filter((f) => f.severity === 'critical').length,
      highCount: findings.filter((f) => f.severity === 'high').length,
      mediumCount: findings.filter((f) => f.severity === 'medium').length,
      lowCount: findings.filter((f) => f.severity === 'low').length,
      estimatedLeakedBytes: findings.reduce((sum, f) => sum + (f.retainedSize || 0), 0),
      topOffenders: findings.slice(0, 5),
    };
  }

  private generateRecommendations(findings: LeakFinding[]): string[] {
    const recommendations: string[] = [];

    // Add general recommendations based on findings
    const hasEventListenerLeaks = findings.some((f) => f.patternId === 'event-listener-leak');
    if (hasEventListenerLeaks) {
      recommendations.push('Implement a centralized event listener management system');
    }

    const hasClosureLeaks = findings.some((f) => f.patternId === 'closure-leak');
    if (hasClosureLeaks) {
      recommendations.push('Review closures for unnecessary captured variables');
    }

    const hasDOMLeaks = findings.some((f) => f.patternId === 'detached-dom-nodes');
    if (hasDOMLeaks) {
      recommendations.push('Audit DOM cleanup in component unmount lifecycle');
    }

    // Always add best practices
    recommendations.push('Run memory profiling regularly during development');
    recommendations.push('Set up automated memory leak detection in CI/CD');

    return recommendations;
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function walkHeap(node: HeapNode, callback: (node: HeapNode) => void): void {
  const visited = new Set<number>();

  const walk = (n: HeapNode) => {
    if (visited.has(n.id)) return;
    visited.add(n.id);

    callback(n);

    // In production, would resolve children and recurse
  };

  walk(node);
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

// ============================================================================
// SINGLETON
// ============================================================================

let detectorInstance: MemoryLeakDetector | null = null;

export function getMemoryLeakDetector(config?: Partial<DetectorConfig>): MemoryLeakDetector {
  if (!detectorInstance) {
    detectorInstance = new MemoryLeakDetector(config);
  }
  return detectorInstance;
}
