/**
 * Kyro IDE Code Maps and Dependency Analysis
 * 
 * Architectural visualization and validation similar to Visual Studio Code Maps
 * and JetBrains Diagrams. Provides real-time dependency tracking and
 * architectural rule enforcement.
 * 
 * Features:
 * - Dependency graph construction
 * - Call hierarchy visualization
 * - Architectural layer validation
 * - Impact analysis
 * - Circular dependency detection
 */

// ============================================================================
// TYPES
// ============================================================================

export interface CodeNode {
  id: string;
  name: string;
  type: NodeType;
  location: NodeLocation;
  metrics?: NodeMetrics;
  layer?: string;
  group?: string;
}

export type NodeType =
  | 'module'
  | 'class'
  | 'interface'
  | 'function'
  | 'variable'
  | 'enum'
  | 'type'
  | 'namespace'
  | 'file'
  | 'folder'
  | 'package';

export interface NodeLocation {
  file: string;
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
}

export interface NodeMetrics {
  complexity?: number;
  linesOfCode?: number;
  fanIn?: number;
  fanOut?: number;
  instability?: number;
  abstractness?: number;
  distance?: number;
  testCoverage?: number;
}

export interface CodeEdge {
  id: string;
  source: string;
  target: string;
  type: EdgeType;
  weight: number;
  location?: NodeLocation;
  isViolation?: boolean;
}

export type EdgeType =
  | 'calls'
  | 'imports'
  | 'extends'
  | 'implements'
  | 'references'
  | 'creates'
  | 'uses'
  | 'contains'
  | 'depends_on';

export interface DependencyGraph {
  nodes: Map<string, CodeNode>;
  edges: Map<string, CodeEdge>;
  layers: ArchitecturalLayer[];
  groups: Map<string, string[]>;
  violations: ArchitecturalViolation[];
}

export interface ArchitecturalLayer {
  id: string;
  name: string;
  color: string;
  allowedDependencies: string[];
  nodes: string[];
  order: number;
}

export interface ArchitecturalViolation {
  id: string;
  rule: string;
  source: string;
  target: string;
  edge: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
}

export interface ArchitecturalRule {
  id: string;
  name: string;
  description: string;
  sourceLayer: string;
  allowedTargets: string[];
  deniedTargets: string[];
  enabled: boolean;
}

export interface ImpactAnalysis {
  changedNode: string;
  directImpacts: string[];
  transitiveImpacts: string[];
  testImpacts: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  summary: string;
}

export interface CircularDependency {
  nodes: string[];
  edges: string[];
  severity: 'minor' | 'major' | 'critical';
  suggestedFix?: string;
}

// ============================================================================
// DEPENDENCY GRAPH BUILDER
// ============================================================================

export class DependencyGraphBuilder {
  private nodes: Map<string, CodeNode> = new Map();
  private edges: Map<string, CodeEdge> = new Map();
  private layers: ArchitecturalLayer[] = [];
  private rules: ArchitecturalRule[] = [];
  private violations: ArchitecturalViolation[] = [];

  /**
   * Add a node to the graph
   */
  addNode(node: CodeNode): void {
    this.nodes.set(node.id, node);
  }

  /**
   * Add an edge to the graph
   */
  addEdge(edge: CodeEdge): void {
    this.edges.set(edge.id, edge);
  }

  /**
   * Define an architectural layer
   */
  defineLayer(layer: ArchitecturalLayer): void {
    this.layers.push(layer);
    this.layers.sort((a, b) => a.order - b.order);
  }

  /**
   * Add an architectural rule
   */
  addRule(rule: ArchitecturalRule): void {
    this.rules.push(rule);
  }

  /**
   * Build the complete dependency graph
   */
  build(): DependencyGraph {
    this.assignLayers();
    this.validateArchitecture();
    this.calculateMetrics();

    const circularDeps = this.detectCircularDependencies();

    for (const circular of circularDeps) {
      for (const edgeId of circular.edges) {
        const edge = this.edges.get(edgeId);
        if (edge) {
          edge.isViolation = true;
        }
      }
    }

    return {
      nodes: this.nodes,
      edges: this.edges,
      layers: this.layers,
      groups: this.createGroups(),
      violations: this.violations,
    };
  }

  /**
   * Assign nodes to layers based on naming conventions or explicit config
   */
  private assignLayers(): void {
    for (const [id, node] of this.nodes) {
      for (const layer of this.layers) {
        if (this.matchesLayerPattern(node, layer)) {
          node.layer = layer.id;
          layer.nodes.push(id);
          break;
        }
      }
    }
  }

  /**
   * Check if node matches layer pattern
   */
  private matchesLayerPattern(node: CodeNode, layer: ArchitecturalLayer): boolean {
    const layerPatterns: Record<string, RegExp[]> = {
      presentation: [/components?\/?$/i, /pages?\/?$/i, /views?\/?$/i, /ui\/?$/i],
      business: [/services?\/?$/i, /domain\/?$/i, /usecases?\/?$/i, /logic\/?$/i],
      data: [/data\/?$/i, /repositories?\/?$/i, /models?\/?$/i, /entities?\/?$/i],
      infrastructure: [/infrastructure\/?$/i, /config\/?$/i, /utils?\/?$/i, /helpers?\/?$/i],
    };

    const patterns = layerPatterns[layer.name.toLowerCase()] || [];
    return patterns.some(p => p.test(node.location.file));
  }

  /**
   * Validate architecture against rules
   */
  private validateArchitecture(): void {
    this.violations = [];

    for (const [edgeId, edge] of this.edges) {
      const sourceNode = this.nodes.get(edge.source);
      const targetNode = this.nodes.get(edge.target);

      if (!sourceNode || !targetNode) continue;

      if (sourceNode.layer && targetNode.layer) {
        const sourceLayer = this.layers.find(l => l.id === sourceNode.layer);
        const targetLayer = this.layers.find(l => l.id === targetNode.layer);

        if (sourceLayer && targetLayer) {
          if (!sourceLayer.allowedDependencies.includes(targetLayer.id)) {
            const rule = this.rules.find(r => 
              r.sourceLayer === sourceLayer.id && 
              r.deniedTargets.includes(targetLayer.id)
            );

            if (rule || !sourceLayer.allowedDependencies.includes('*')) {
              this.violations.push({
                id: `violation-${edgeId}`,
                rule: rule?.name || 'layer-dependency',
                source: edge.source,
                target: edge.target,
                edge: edgeId,
                severity: rule ? 'error' : 'warning',
                message: `${sourceLayer.name} layer should not depend on ${targetLayer.name} layer`,
              });

              edge.isViolation = true;
            }
          }
        }
      }
    }
  }

  /**
   * Calculate code metrics for nodes
   */
  private calculateMetrics(): void {
    for (const [id, node] of this.nodes) {
      const metrics: NodeMetrics = {};

      metrics.fanOut = Array.from(this.edges.values())
        .filter(e => e.source === id).length;

      metrics.fanIn = Array.from(this.edges.values())
        .filter(e => e.target === id).length;

      const totalConnections = metrics.fanIn + metrics.fanOut;
      metrics.instability = totalConnections > 0 
        ? metrics.fanOut / totalConnections 
        : 0;

      metrics.complexity = Math.round(
        (metrics.fanIn * 0.3 + metrics.fanOut * 0.5 + (node.type === 'class' ? 5 : 2))
      );

      node.metrics = metrics;
    }
  }

  /**
   * Detect circular dependencies
   */
  private detectCircularDependencies(): CircularDependency[] {
    const circular: CircularDependency[] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    for (const [nodeId] of this.nodes) {
      const cycle = this.findCycle(nodeId, visited, recursionStack, [], []);
      if (cycle) {
        circular.push(cycle);
      }
    }

    return circular;
  }

  /**
   * Find cycle starting from a node using DFS
   */
  private findCycle(
    nodeId: string,
    visited: Set<string>,
    recursionStack: Set<string>,
    path: string[],
    edgePath: string[]
  ): CircularDependency | null {
    if (recursionStack.has(nodeId)) {
      const cycleStart = path.indexOf(nodeId);
      if (cycleStart === -1) return null;

      const cycleNodes = path.slice(cycleStart);
      const cycleEdges = edgePath.slice(cycleStart);

      return {
        nodes: cycleNodes,
        edges: cycleEdges,
        severity: cycleNodes.length <= 3 ? 'critical' : cycleNodes.length <= 6 ? 'major' : 'minor',
        suggestedFix: this.suggestCircularFix(cycleNodes),
      };
    }

    if (visited.has(nodeId)) return null;

    visited.add(nodeId);
    recursionStack.add(nodeId);

    for (const [edgeId, edge] of this.edges) {
      if (edge.source === nodeId) {
        const result = this.findCycle(
          edge.target,
          visited,
          recursionStack,
          [...path, nodeId],
          [...edgePath, edgeId]
        );

        if (result) return result;
      }
    }

    recursionStack.delete(nodeId);
    return null;
  }

  /**
   * Suggest a fix for circular dependency
   */
  private suggestCircularFix(nodes: string[]): string {
    if (nodes.length === 2) {
      return `Consider extracting shared functionality into a separate module to break the dependency between ${nodes[0]} and ${nodes[1]}.`;
    }

    return `Consider introducing an interface or abstraction to break the cycle: ${nodes.join(' -> ')}.`;
  }

  /**
   * Create node groups by layer
   */
  private createGroups(): Map<string, string[]> {
    const groups = new Map<string, string[]>();

    for (const [id, node] of this.nodes) {
      const groupKey = node.layer || 'unassigned';
      const group = groups.get(groupKey) || [];
      group.push(id);
      groups.set(groupKey, group);
    }

    return groups;
  }

  /**
   * Clear the graph
   */
  clear(): void {
    this.nodes.clear();
    this.edges.clear();
    this.violations = [];
  }
}

// ============================================================================
// CALL HIERARCHY ANALYZER
// ============================================================================

export class CallHierarchyAnalyzer {
  private graph: DependencyGraph;

  constructor(graph: DependencyGraph) {
    this.graph = graph;
  }

  /**
   * Get callers of a function (who calls this?)
   */
  getCallers(nodeId: string, depth: number = 3): CallHierarchyNode {
    const node = this.graph.nodes.get(nodeId);
    if (!node) throw new Error(`Node ${nodeId} not found`);

    return this.buildCallerTree(nodeId, depth);
  }

  /**
   * Get callees of a function (what does this call?)
   */
  getCallees(nodeId: string, depth: number = 3): CallHierarchyNode {
    const node = this.graph.nodes.get(nodeId);
    if (!node) throw new Error(`Node ${nodeId} not found`);

    return this.buildCalleeTree(nodeId, depth);
  }

  /**
   * Build caller tree recursively
   */
  private buildCallerTree(nodeId: string, remainingDepth: number): CallHierarchyNode {
    const node = this.graph.nodes.get(nodeId)!;

    const callers: CallHierarchyNode[] = [];

    if (remainingDepth > 0) {
      for (const [, edge] of this.graph.edges) {
        if (edge.target === nodeId && edge.type === 'calls') {
          callers.push(this.buildCallerTree(edge.source, remainingDepth - 1));
        }
      }
    }

    return {
      node,
      children: callers,
      edgeType: 'incoming',
    };
  }

  /**
   * Build callee tree recursively
   */
  private buildCalleeTree(nodeId: string, remainingDepth: number): CallHierarchyNode {
    const node = this.graph.nodes.get(nodeId)!;

    const callees: CallHierarchyNode[] = [];

    if (remainingDepth > 0) {
      for (const [, edge] of this.graph.edges) {
        if (edge.source === nodeId && edge.type === 'calls') {
          callees.push(this.buildCalleeTree(edge.target, remainingDepth - 1));
        }
      }
    }

    return {
      node,
      children: callees,
      edgeType: 'outgoing',
    };
  }
}

export interface CallHierarchyNode {
  node: CodeNode;
  children: CallHierarchyNode[];
  edgeType: 'incoming' | 'outgoing';
}

// ============================================================================
// IMPACT ANALYZER
// ============================================================================

export class ImpactAnalyzer {
  private graph: DependencyGraph;

  constructor(graph: DependencyGraph) {
    this.graph = graph;
  }

  /**
   * Analyze impact of changing a node
   */
  analyzeImpact(nodeId: string): ImpactAnalysis {
    const directImpacts = this.getDirectImpacts(nodeId);
    const transitiveImpacts = this.getTransitiveImpacts(nodeId);
    const testImpacts = this.getTestImpacts(nodeId);

    const riskLevel = this.calculateRiskLevel(
      nodeId,
      directImpacts.length,
      transitiveImpacts.length
    );

    return {
      changedNode: nodeId,
      directImpacts,
      transitiveImpacts,
      testImpacts,
      riskLevel,
      summary: this.generateSummary(nodeId, directImpacts, transitiveImpacts, testImpacts),
    };
  }

  /**
   * Get direct dependents
   */
  private getDirectImpacts(nodeId: string): string[] {
    const impacts: string[] = [];

    for (const [, edge] of this.graph.edges) {
      if (edge.target === nodeId) {
        impacts.push(edge.source);
      }
    }

    return [...new Set(impacts)];
  }

  /**
   * Get all transitive dependents
   */
  private getTransitiveImpacts(nodeId: string): string[] {
    const impacts = new Set<string>();
    const queue = [nodeId];

    while (queue.length > 0) {
      const current = queue.shift()!;

      for (const [, edge] of this.graph.edges) {
        if (edge.target === current && !impacts.has(edge.source)) {
          impacts.add(edge.source);
          queue.push(edge.source);
        }
      }
    }

    return Array.from(impacts);
  }

  /**
   * Get affected tests
   */
  private getTestImpacts(nodeId: string): string[] {
    const tests: string[] = [];

    for (const [id, node] of this.graph.nodes) {
      if (node.location.file.includes('.test.') || 
          node.location.file.includes('.spec.') ||
          node.name.startsWith('test') ||
          node.name.startsWith('it ') ||
          node.name.startsWith('describe')) {
        
        const deps = this.getAllDependencies(id);
        if (deps.has(nodeId)) {
          tests.push(id);
        }
      }
    }

    return tests;
  }

  /**
   * Get all dependencies of a node
   */
  private getAllDependencies(nodeId: string): Set<string> {
    const deps = new Set<string>();
    const queue = [nodeId];

    while (queue.length > 0) {
      const current = queue.shift()!;

      for (const [, edge] of this.graph.edges) {
        if (edge.source === current && !deps.has(edge.target)) {
          deps.add(edge.target);
          queue.push(edge.target);
        }
      }
    }

    return deps;
  }

  /**
   * Calculate risk level
   */
  private calculateRiskLevel(
    nodeId: string,
    directCount: number,
    transitiveCount: number
  ): 'low' | 'medium' | 'high' | 'critical' {
    const node = this.graph.nodes.get(nodeId);

    const criticalLayers = ['business', 'domain', 'core'];
    if (node?.layer && criticalLayers.includes(node.layer.toLowerCase())) {
      return transitiveCount > 20 ? 'critical' : 'high';
    }

    if (transitiveCount > 50) return 'critical';
    if (transitiveCount > 20) return 'high';
    if (transitiveCount > 10) return 'medium';
    if (directCount > 5) return 'medium';

    return 'low';
  }

  /**
   * Generate impact summary
   */
  private generateSummary(
    nodeId: string,
    direct: string[],
    transitive: string[],
    tests: string[]
  ): string {
    const node = this.graph.nodes.get(nodeId);
    const nodeName = node?.name || nodeId;

    if (transitive.length === 0) {
      return `Changing ${nodeName} has minimal impact - no dependent code found.`;
    }

    return `Changing ${nodeName} will affect ${direct.length} direct dependents, ` +
           `${transitive.length} total components, and ${tests.length} test files. ` +
           `Review all impacts carefully before making changes.`;
  }
}

// ============================================================================
// CODE MAP VISUALIZER
// ============================================================================

export class CodeMapVisualizer {
  private graph: DependencyGraph;

  constructor(graph: DependencyGraph) {
    this.graph = graph;
  }

  /**
   * Generate Graphviz DOT format
   */
  toDot(): string {
    const lines: string[] = ['digraph CodeMap {'];
    lines.push('  rankdir=TB;');
    lines.push('  node [shape=box, style=filled];');
    lines.push('');

    for (const layer of this.graph.layers) {
      lines.push(`  subgraph cluster_${layer.id} {`);
      lines.push(`    label="${layer.name}";`);
      lines.push(`    style=filled;`);
      lines.push(`    color="${layer.color}";`);
      
      for (const nodeId of layer.nodes) {
        const node = this.graph.nodes.get(nodeId);
        if (node) {
          lines.push(`    "${nodeId}" [label="${node.name}"];`);
        }
      }
      
      lines.push('  }');
      lines.push('');
    }

    const assignedNodes = new Set(this.graph.layers.flatMap(l => l.nodes));
    for (const [id, node] of this.graph.nodes) {
      if (!assignedNodes.has(id)) {
        lines.push(`  "${id}" [label="${node.name}", color=gray];`);
      }
    }
    lines.push('');

    for (const [, edge] of this.graph.edges) {
      const color = edge.isViolation ? 'red' : this.getEdgeColor(edge.type);
      const style = edge.isViolation ? 'dashed' : 'solid';
      
      lines.push(
        `  "${edge.source}" -> "${edge.target}" ` +
        `[label="${edge.type}", color=${color}, style=${style}];`
      );
    }

    lines.push('}');
    return lines.join('\n');
  }

  /**
   * Generate Mermaid format
   */
  toMermaid(): string {
    const lines: string[] = ['graph TD'];

    for (const [id, node] of this.graph.nodes) {
      const shape = this.getMermaidShape(node.type);
      lines.push(`    ${id}${shape.open}"${node.name}"${shape.close}`);
    }

    for (const [, edge] of this.graph.edges) {
      const arrow = this.getMermaidArrow(edge.type);
      lines.push(`    ${edge.source} ${arrow} ${edge.target}`);
    }

    return lines.join('\n');
  }

  /**
   * Generate JSON format for visualization
   */
  toJson(): object {
    return {
      nodes: Array.from(this.graph.nodes.values()).map(n => ({
        id: n.id,
        name: n.name,
        type: n.type,
        layer: n.layer,
        location: n.location,
        metrics: n.metrics,
      })),
      edges: Array.from(this.graph.edges.values()).map(e => ({
        id: e.id,
        source: e.source,
        target: e.target,
        type: e.type,
        weight: e.weight,
        isViolation: e.isViolation,
      })),
      layers: this.graph.layers,
      violations: this.graph.violations,
    };
  }

  /**
   * Get edge color based on type
   */
  private getEdgeColor(type: EdgeType): string {
    const colors: Record<EdgeType, string> = {
      calls: '#4CAF50',
      imports: '#2196F3',
      extends: '#FF9800',
      implements: '#9C27B0',
      references: '#607D8B',
      creates: '#E91E63',
      uses: '#00BCD4',
      contains: '#795548',
      depends_on: '#FF5722',
    };
    return colors[type] || '#333';
  }

  /**
   * Get Mermaid shape for node type
   */
  private getMermaidShape(type: NodeType): { open: string; close: string } {
    const shapes: Record<NodeType, { open: string; close: string }> = {
      module: { open: '[', close: ']' },
      class: { open: '[', close: ']' },
      interface: { open: '[[', close: ']]' },
      function: { open: '(', close: ')' },
      variable: { open: '[', close: ']' },
      enum: { open: '{', close: '}' },
      type: { open: '{{', close: '}}' },
      namespace: { open: '[', close: ']' },
      file: { open: '(', close: ')' },
      folder: { open: '[', close: ']' },
      package: { open: '[', close: ']' },
    };
    return shapes[type] || { open: '[', close: ']' };
  }

  /**
   * Get Mermaid arrow for edge type
   */
  private getMermaidArrow(type: EdgeType): string {
    const arrows: Record<EdgeType, string> = {
      calls: '-->',
      imports: '-..->',
      extends: '--|>',
      implements: '-..|>',
      references: '-->',
      creates: '-->',
      uses: '-..->',
      contains: '--',
      depends_on: '-..->',
    };
    return arrows[type] || '-->';
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const createGraphBuilder = () => new DependencyGraphBuilder();
export const createCallHierarchyAnalyzer = (graph: DependencyGraph) => new CallHierarchyAnalyzer(graph);
export const createImpactAnalyzer = (graph: DependencyGraph) => new ImpactAnalyzer(graph);
export const createCodeMapVisualizer = (graph: DependencyGraph) => new CodeMapVisualizer(graph);
