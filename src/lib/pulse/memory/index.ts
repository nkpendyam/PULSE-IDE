/**
 * Kyro IDE Memory Profiling Module
 *
 * Provides comprehensive memory analysis tools:
 * - Heap snapshot capture and analysis
 * - Memory timeline tracking
 * - Leak detection and reporting
 * - Dominator tree analysis
 */

// Core profiler
export {
  MemoryProfiler,
  getMemoryProfiler,
  type MemorySnapshot,
  type HeapNode,
  type HeapNodeType,
  type HeapEdge,
  type EdgeType,
  type SourceLocation,
  type MemoryMetrics,
  type MemoryTimeline,
  type GCEvent,
  type AllocationSample,
  type RetainerPath,
  type RetainerNode,
  type DominatorTreeNode,
  type MemoryProfilerConfig,
  type MemoryProfilerListener,
  type SnapshotComparison,
} from './memory-profiler';

// Heap snapshot processing
export {
  HeapSnapshotProcessor,
  getHeapSnapshotProcessor,
  formatBytes,
  getPercentage,
  type HeapSnapshotHeader,
  type SnapshotMeta,
  type ParsedSnapshot,
  type ObjectGroup,
  type AggregationResult,
  type RetainerInfo,
  type Retainer,
} from './heap-snapshot';

// Leak detection
export {
  MemoryLeakDetector,
  getMemoryLeakDetector,
  type LeakPattern,
  type LeakFinding,
  type SourceLocation as LeakSourceLocation,
  type LeakSuggestion,
  type LeakReport,
  type LeakSummary,
  type DetectorConfig,
} from './memory-leak-detector';
