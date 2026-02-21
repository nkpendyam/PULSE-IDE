/**
 * Kyro IDE Debugger Module
 * 
 * Advanced debugging capabilities including:
 * - Time Travel Debugging (TTD)
 * - Visual Debugging with Variable Watches
 * - Debug Session Management
 * - Variable Inspection
 */

// ============================================================================
// Time Travel Debugging
// ============================================================================

export {
  ExecutionRecorder,
  TimeTravelReplayer,
  SnapshotDebugger,
  executionRecorder,
  timeTravelReplayer,
  snapshotDebugger,
  // Types
  type ExecutionSnapshot,
  type SourceLocation as TTDSourceLocation,
  type CallFrame as TTDCallFrame,
  type RuntimeValue,
  type MemoryState,
  type HeapObject,
  type RegisterState,
  type ExecutionEventType,
  type TimeTravelBreakpoint,
  type ReplaySession,
  type TimelineEvent,
  type VariableChange,
  type ObjectChange,
  type ProductionSnapshot,
  type SnapshotDiff,
} from './ttd';

// ============================================================================
// Visual Debugger
// ============================================================================

export {
  VariableWatchManager,
  WatchExpressionEvaluator,
  BreakpointManager,
  CallStackVisualizer,
  StepExecutor,
  ScopeInspector,
  VisualDebugger,
  visualDebugger,
  // Types
  type VariableWatch,
  type WatchValue,
  type ValueType,
  type VariableScope,
  type ValueChangeRecord,
  type WatchExpression,
  type CompiledExpression,
  type ExpressionNode,
  type CallStackFrame,
  type SourceLocation,
  type SourceInfo,
  type Scope,
  type Breakpoint,
  type BreakpointCondition,
  type BreakpointState,
  type BreakpointHitResult,
  type StepResult,
  type ExecutionEvent,
  type ExecutionEventType as VisualExecutionEventType,
  type VariableUpdate,
  type EvaluationContext,
  type DebugContext,
  type DebugState,
} from './visual-debugger';

// ============================================================================
// Debug Session Manager
// ============================================================================

export {
  DebugSessionManager,
  debugSessionManager,
  // Types
  type SessionState,
  type StopReason,
  type ExceptionBreakMode,
  type DebugSession,
  type DebugConfiguration,
  type Thread,
  type ThreadState,
  type ExceptionInfo,
  type ExceptionDetails,
  type VariablesContainer,
  type DebugVariable,
  type VariablePresentationHint,
  type DebugAdapterCapabilities,
  type StoppedEvent,
  type ContinuedEvent,
  type ThreadEvent,
  type OutputEvent,
  type BreakpointEvent,
  type DebugProtocolBreakpoint,
  type SourceInfo as DebugSourceInfo,
  type Checksum,
  type ModuleEvent,
  type ModuleInfo,
  type LoadedSourceEvent,
  type DAPRequest,
  type DAPResponse,
  type DAPEvent,
  type DAPMessage,
} from './debug-session';

// ============================================================================
// Variable Inspector
// ============================================================================

export {
  VariableInspector,
  variableInspector,
  // Types
  type InspectionNode,
  type InspectedValue,
  type ValueTypeName,
  type NodeMetadata,
  type EditState,
  type WatchExpressionEntry,
  type SearchResult,
  type InspectionOptions,
  type VariableEditResult,
} from './variable-inspector';
