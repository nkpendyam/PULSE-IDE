/**
 * Kyro IDE - Performance Profiler Module
 * CPU profiling, flame graphs, and session management
 */

import {
  PerformanceProfiler,
  getProfiler,
  resetProfiler,
  DEFAULT_PROFILE_CONFIG,
  type ProfileSession,
  type ProfileConfig,
  type ProfileSample,
  type StackFrame,
  type FunctionMetrics,
  type CallTreeNode,
  type FlameGraphNode,
  type ColorCategory,
  type HotSpot,
  type ProfileAnnotation,
  type MemoryStats,
  type GCEvent,
  type MemoryPoint,
  type ProfileComparison,
  type FunctionComparison,
  type ComparisonStatistics,
  type RegressionAlert,
} from './performance-profiler';

import {
  FlameGraphProcessor,
  getFlameGraphProcessor,
  resetFlameGraphProcessor,
  DEFAULT_FLAME_GRAPH_CONFIG,
  type FlameGraphConfig,
  type FlameGraphViewport,
  type FlameFrameData,
  type FlameGraphRenderData,
  type ColorLegendEntry,
  type TimeAggregation,
  type StackAggregation,
  type FlameGraphExport,
  type FlameGraphDiff,
  type DiffFrame,
  type DiffSummary,
} from './flame-graph';

import {
  ProfilerSessionManager,
  InMemorySessionStorage,
  getSessionManager,
  resetSessionManager,
  type SessionStorage,
  type SessionMetadata,
  type CPUProfileFormat,
  type CPUProfileNode,
  type SessionExport,
  type ExportMetadata,
  type SessionImportResult,
  type SessionSearchOptions,
  type SessionGroup,
  type SessionComparison,
  type ComparisonMetrics,
  type FunctionDiff,
} from './profiler-session';

// ============================================
// RE-EXPORTS
// ============================================

// Performance Profiler
export {
  PerformanceProfiler,
  getProfiler,
  resetProfiler,
  DEFAULT_PROFILE_CONFIG,
  type ProfileSession,
  type ProfileConfig,
  type ProfileSample,
  type StackFrame,
  type FunctionMetrics,
  type CallTreeNode,
  type FlameGraphNode,
  type ColorCategory,
  type HotSpot,
  type ProfileAnnotation,
  type MemoryStats,
  type GCEvent,
  type MemoryPoint,
  type ProfileComparison,
  type FunctionComparison,
  type ComparisonStatistics,
  type RegressionAlert,
};

// Flame Graph
export {
  FlameGraphProcessor,
  getFlameGraphProcessor,
  resetFlameGraphProcessor,
  DEFAULT_FLAME_GRAPH_CONFIG,
  type FlameGraphConfig,
  type FlameGraphViewport,
  type FlameFrameData,
  type FlameGraphRenderData,
  type ColorLegendEntry,
  type TimeAggregation,
  type StackAggregation,
  type FlameGraphExport,
  type FlameGraphDiff,
  type DiffFrame,
  type DiffSummary,
};

// Session Manager
export {
  ProfilerSessionManager,
  InMemorySessionStorage,
  getSessionManager,
  resetSessionManager,
  type SessionStorage,
  type SessionMetadata,
  type CPUProfileFormat,
  type CPUProfileNode,
  type SessionExport,
  type ExportMetadata,
  type SessionImportResult,
  type SessionSearchOptions,
  type SessionGroup,
  type SessionComparison,
  type ComparisonMetrics,
  type FunctionDiff,
};

// ============================================
// CONVENIENCE FUNCTIONS
// ============================================

/**
 * Create a new profiler instance with default configuration
 */
export function createProfiler(): {
  profiler: PerformanceProfiler;
  sessionManager: ProfilerSessionManager;
  flameGraph: FlameGraphProcessor;
} {
  return {
    profiler: new PerformanceProfiler(),
    sessionManager: new ProfilerSessionManager(),
    flameGraph: new FlameGraphProcessor(),
  };
}

/**
 * Quick profile utility for one-off profiling
 */
export async function quickProfile(
  fn: () => Promise<unknown> | unknown,
  options?: Partial<ProfileConfig>
): Promise<{
  result: unknown;
  session: ProfileSession;
  duration: number;
}> {
  const profiler = getProfiler();
  const session = profiler.startSession(options);

  const startTime = performance.now();
  const result = await fn();
  const duration = performance.now() - startTime;

  const completedSession = profiler.stopSession(session.id);

  return {
    result,
    session: completedSession!,
    duration,
  };
}

/**
 * Compare two profiling sessions
 */
export function compareProfiles(
  sessionId1: string,
  sessionId2: string
): ProfileComparison | null {
  const profiler = getProfiler();
  return profiler.compareProfiles(sessionId1, sessionId2);
}

/**
 * Export profile to various formats
 */
export function exportProfile(
  sessionId: string,
  format: 'json' | 'cpuprofile' | 'summary' = 'json'
): SessionExport | null {
  const manager = getSessionManager();
  return manager.exportSession(sessionId, format);
}

/**
 * Import profile from file
 */
export async function importProfileFromContent(
  content: string | File,
  format?: 'json' | 'cpuprofile'
): Promise<SessionImportResult> {
  const manager = getSessionManager();
  return manager.importProfile(content, format);
}

// ============================================
// TYPE RE-EXPORTS FOR CONVENIENCE
// ============================================

/**
 * All profiler-related types in one place
 */
export type ProfilerTypes = {
  ProfileSession: ProfileSession;
  ProfileConfig: ProfileConfig;
  ProfileSample: ProfileSample;
  StackFrame: StackFrame;
  FunctionMetrics: FunctionMetrics;
  CallTreeNode: CallTreeNode;
  FlameGraphNode: FlameGraphNode;
  HotSpot: HotSpot;
  ProfileAnnotation: ProfileAnnotation;
  FlameGraphConfig: FlameGraphConfig;
  FlameFrameData: FlameFrameData;
  FlameGraphRenderData: FlameGraphRenderData;
  SessionMetadata: SessionMetadata;
  SessionExport: SessionExport;
  SessionImportResult: SessionImportResult;
  SessionSearchOptions: SessionSearchOptions;
};
