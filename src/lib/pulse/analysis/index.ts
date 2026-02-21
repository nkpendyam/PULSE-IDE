/**
 * Kyro IDE Analysis Module
 * 
 * Code analysis capabilities including Code Maps, Dependency Analysis,
 * and Semantic Clone Detection.
 */

// Code Maps and Dependency Analysis
export {
  DependencyGraphBuilder,
  CallHierarchyAnalyzer,
  ImpactAnalyzer,
  CodeMapVisualizer,
  createGraphBuilder,
  createCallHierarchyAnalyzer,
  createImpactAnalyzer,
  createCodeMapVisualizer,
  // Types
  type CodeNode,
  type NodeType,
  type NodeLocation,
  type NodeMetrics,
  type CodeEdge,
  type EdgeType,
  type DependencyGraph,
  type ArchitecturalLayer,
  type ArchitecturalViolation,
  type ArchitecturalRule,
  type ImpactAnalysis,
  type CircularDependency,
  type CallHierarchyNode,
} from './codemaps';

// Clone Detection
export {
  TokenBasedDetector,
  CloneClassBuilder,
  CloneDetector,
  cloneDetector,
  // Types
  type ClonePair,
  type CloneType,
  type CloneLocation,
  type RefactoringSuggestion,
  type CloneClass,
  type Token,
  type ASTFingerprint,
  type CloneReport,
} from './clonedetect';
