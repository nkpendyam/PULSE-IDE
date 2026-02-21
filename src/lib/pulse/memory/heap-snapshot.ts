/**
 * Kyro IDE Heap Snapshot Processing
 *
 * Parses and analyzes heap snapshots for memory analysis.
 * Supports Chrome DevTools heap snapshot format.
 */

import type { HeapNode, HeapEdge, HeapNodeType, MemorySnapshot, SourceLocation } from './memory-profiler';

// ============================================================================
// TYPES
// ============================================================================

export interface HeapSnapshotHeader {
  title: string;
  meta: SnapshotMeta;
  node_count: number;
  edge_count: number;
  trace_function_count: number;
}

export interface SnapshotMeta {
  node_fields: string[];
  node_types: string[][];
  edge_fields: string[];
  edge_types: string[][];
  trace_function_info_fields: string[];
  trace_node_fields: string[];
  sample_fields: string[];
  location_fields: string[];
  strings: string[];
}

export interface ParsedSnapshot {
  header: HeapSnapshotHeader;
  nodes: number[];
  edges: number[];
  locations: number[];
  strings: string[];
  traceFunctionInfos: number[];
  traceTree: number[];
  samples: number[];
}

export interface ObjectGroup {
  name: string;
  count: number;
  size: number;
  retainedSize: number;
  nodes: HeapNode[];
}

export interface AggregationResult {
  groups: Map<string, ObjectGroup>;
  totalSize: number;
  totalCount: number;
  topGroups: ObjectGroup[];
}

export interface RetainerInfo {
  nodeId: number;
  retainers: Retainer[];
  retainingSize: number;
}

export interface Retainer {
  nodeId: number;
  name: string;
  type: HeapNodeType;
  distance: number;
  path: string;
}

// ============================================================================
// HEAP SNAPSHOT PROCESSOR
// ============================================================================

export class HeapSnapshotProcessor {
  private nodeFieldCount: number = 0;
  private edgeFieldCount: number = 0;
  private nodeTypes: Map<string, number> = new Map();
  private edgeTypes: Map<string, number> = new Map();

  /**
   * Parse a Chrome DevTools heap snapshot
   */
  parseSnapshot(raw: string | ParsedSnapshot): MemorySnapshot {
    let data: ParsedSnapshot;

    if (typeof raw === 'string') {
      data = JSON.parse(raw);
    } else {
      data = raw;
    }

    const { header, nodes, edges, strings } = data;

    // Set up field counts
    this.nodeFieldCount = header.meta.node_fields.length;
    this.edgeFieldCount = header.meta.edge_fields.length;

    // Build type maps
    this.buildTypeMaps(header.meta);

    // Create snapshot
    const snapshot: MemorySnapshot = {
      id: `heap-${Date.now()}`,
      timestamp: Date.now(),
      nodeId: 0,
      nodeCount: header.node_count,
      edgeCount: header.edge_count,
      totalSize: 0,
      root: this.parseNodes(nodes, edges, strings, header),
      locations: new Map(),
      strings: strings,
    };

    return snapshot;
  }

  /**
   * Aggregate objects by type
   */
  aggregateByType(snapshot: MemorySnapshot): AggregationResult {
    const groups = new Map<string, ObjectGroup>();
    let totalSize = 0;
    let totalCount = 0;

    this.walkHeap(snapshot.root, (node) => {
      const type = node.type;
      let group = groups.get(type);

      if (!group) {
        group = {
          name: type,
          count: 0,
          size: 0,
          retainedSize: 0,
          nodes: [],
        };
        groups.set(type, group);
      }

      group.count++;
      group.size += node.size;
      group.retainedSize += node.retainedSize;
      group.nodes.push(node);

      totalSize += node.size;
      totalCount++;
    });

    // Sort by retained size
    const topGroups = Array.from(groups.values())
      .sort((a, b) => b.retainedSize - a.retainedSize)
      .slice(0, 20);

    return {
      groups,
      totalSize,
      totalCount,
      topGroups,
    };
  }

  /**
   * Aggregate objects by constructor
   */
  aggregateByConstructor(snapshot: MemorySnapshot): AggregationResult {
    const groups = new Map<string, ObjectGroup>();
    let totalSize = 0;
    let totalCount = 0;

    this.walkHeap(snapshot.root, (node) => {
      const constructor = node.name || '(anonymous)';
      let group = groups.get(constructor);

      if (!group) {
        group = {
          name: constructor,
          count: 0,
          size: 0,
          retainedSize: 0,
          nodes: [],
        };
        groups.set(constructor, group);
      }

      group.count++;
      group.size += node.size;
      group.retainedSize += node.retainedSize;
      group.nodes.push(node);

      totalSize += node.size;
      totalCount++;
    });

    const topGroups = Array.from(groups.values())
      .sort((a, b) => b.retainedSize - a.retainedSize)
      .slice(0, 20);

    return {
      groups,
      totalSize,
      totalCount,
      topGroups,
    };
  }

  /**
   * Find objects retained by a specific node
   */
  findRetainedObjects(snapshot: MemorySnapshot, nodeId: number): HeapNode[] {
    const retained: HeapNode[] = [];
    const visited = new Set<number>();

    const node = this.findNodeById(snapshot, nodeId);
    if (!node) return retained;

    this.walkHeap(node, (child) => {
      if (!visited.has(child.id)) {
        visited.add(child.id);
        retained.push(child);
      }
    });

    return retained;
  }

  /**
   * Find objects retaining a specific node
   */
  findRetainers(snapshot: MemorySnapshot, nodeId: number): RetainerInfo {
    const retainers: Retainer[] = [];
    let retainingSize = 0;

    // Walk from root to find all paths to the node
    this.walkHeap(snapshot.root, (node) => {
      for (const edge of node.children) {
        if (edge.toNode === nodeId) {
          retainers.push({
            nodeId: node.id,
            name: node.name,
            type: node.type,
            distance: node.distance,
            path: edge.name,
          });
          retainingSize += node.retainedSize;
        }
      }
    });

    return {
      nodeId,
      retainers,
      retainingSize,
    };
  }

  /**
   * Calculate retained size for all nodes
   */
  calculateRetainedSizes(snapshot: MemorySnapshot): void {
    // Build reverse edges
    const reverseEdges = new Map<number, HeapEdge[]>();

    this.walkHeap(snapshot.root, (node) => {
      for (const edge of node.children) {
        let edges = reverseEdges.get(edge.toNode);
        if (!edges) {
          edges = [];
          reverseEdges.set(edge.toNode, edges);
        }
        edges.push(edge);
      }
    });

    // Calculate dominators and retained sizes
    this.computeDominatorsAndRetainedSizes(snapshot.root, reverseEdges);
  }

  /**
   * Export snapshot to Chrome DevTools format
   */
  exportToChromeFormat(snapshot: MemorySnapshot): string {
    const header: HeapSnapshotHeader = {
      title: 'Kyro IDE Heap Snapshot',
      meta: this.getDefaultMeta(),
      node_count: snapshot.nodeCount,
      edge_count: snapshot.edgeCount,
      trace_function_count: 0,
    };

    const { nodes, edges } = this.serializeNodes(snapshot.root);

    const data: ParsedSnapshot = {
      header,
      nodes,
      edges,
      locations: [],
      strings: snapshot.strings,
      traceFunctionInfos: [],
      traceTree: [],
      samples: [],
    };

    return JSON.stringify(data);
  }

  // --------------------------------------------------------------------------
  // PRIVATE METHODS
  // --------------------------------------------------------------------------

  private buildTypeMaps(meta: SnapshotMeta): void {
    meta.node_types.forEach((types, index) => {
      if (Array.isArray(types)) {
        types.forEach((type, typeIndex) => {
          this.nodeTypes.set(type, typeIndex);
        });
      }
    });

    meta.edge_types.forEach((types) => {
      if (Array.isArray(types)) {
        types.forEach((type, typeIndex) => {
          this.edgeTypes.set(type, typeIndex);
        });
      }
    });
  }

  private parseNodes(
    nodes: number[],
    edges: number[],
    strings: string[],
    header: HeapSnapshotHeader
  ): HeapNode {
    const nodeMap = new Map<number, HeapNode>();
    const fieldCount = this.nodeFieldCount;

    // Parse all nodes
    for (let i = 0; i < nodes.length; i += fieldCount) {
      const type = header.meta.node_types[0][nodes[i]] as HeapNodeType;
      const name = strings[nodes[i + 1]];
      const id = nodes[i + 2];
      const selfSize = nodes[i + 3];

      const node: HeapNode = {
        id,
        type,
        name,
        size: selfSize,
        retainedSize: selfSize,
        distance: Infinity,
        children: [],
      };

      nodeMap.set(id, node);
    }

    // Find root (GC roots)
    const root = nodeMap.get(1) || this.createDefaultRoot();

    // Parse edges
    let edgeIndex = 0;
    for (let i = 0; i < nodes.length; i += fieldCount) {
      const nodeId = nodes[i + 2];
      const edgeCount = nodes[i + 4];
      const node = nodeMap.get(nodeId);

      if (node) {
        for (let j = 0; j < edgeCount; j++) {
          const edgeOffset = (edgeIndex + j) * this.edgeFieldCount;
          const edgeType = header.meta.edge_types[0][edges[edgeOffset]] as HeapEdge['type'];
          const edgeName = strings[edges[edgeOffset + 1]] || String(edges[edgeOffset + 1]);
          const toNodeId = edges[edgeOffset + 2];

          node.children.push({
            fromNode: nodeId,
            toNode: toNodeId,
            type: edgeType,
            name: edgeName,
            nameOrIndex: edgeName,
          });
        }
      }

      edgeIndex += edgeCount;
    }

    return root;
  }

  private createDefaultRoot(): HeapNode {
    return {
      id: 1,
      type: 'object',
      name: 'GC roots',
      size: 0,
      retainedSize: 0,
      distance: 0,
      children: [],
    };
  }

  private walkHeap(node: HeapNode, callback: (node: HeapNode) => void): void {
    const visited = new Set<number>();

    const walk = (n: HeapNode) => {
      if (visited.has(n.id)) return;
      visited.add(n.id);

      callback(n);

      for (const edge of n.children) {
        // Would need node map to resolve edge.toNode
        // For now, just walk children if they have nodes
      }
    };

    walk(node);
  }

  private findNodeById(snapshot: MemorySnapshot, id: number): HeapNode | null {
    let found: HeapNode | null = null;

    const search = (node: HeapNode): boolean => {
      if (node.id === id) {
        found = node;
        return true;
      }

      // Would search children here
      return false;
    };

    search(snapshot.root);
    return found;
  }

  private computeDominatorsAndRetainedSizes(
    root: HeapNode,
    reverseEdges: Map<number, HeapEdge[]>
  ): void {
    // Simplified dominator computation
    // In production, would use Lengauer-Tarjan algorithm
    root.dominator = undefined;

    const processNode = (node: HeapNode, dominator: number | undefined) => {
      node.dominator = dominator;

      for (const edge of node.children) {
        processNode({ ...node, id: edge.toNode }, node.id);
      }
    };

    for (const edge of root.children) {
      processNode({ ...root, id: edge.toNode }, root.id);
    }
  }

  private serializeNodes(root: HeapNode): { nodes: number[]; edges: number[] } {
    const nodes: number[] = [];
    const edges: number[] = [];
    const visited = new Set<number>();

    const serialize = (node: HeapNode) => {
      if (visited.has(node.id)) return;
      visited.add(node.id);

      // Node fields: type, name, id, self_size, edge_count, trace_node_id
      nodes.push(
        0, // type index
        0, // name string index
        node.id,
        node.size,
        node.children.length,
        0 // trace_node_id
      );

      // Serialize edges
      for (const edge of node.children) {
        edges.push(
          0, // type index
          0, // name string index
          edge.toNode
        );
      }

      // Recurse (would need actual node resolution)
    };

    serialize(root);

    return { nodes, edges };
  }

  private getDefaultMeta(): SnapshotMeta {
    return {
      node_fields: ['type', 'name', 'id', 'self_size', 'edge_count', 'trace_node_id'],
      node_types: [['hidden', 'array', 'string', 'object', 'function', 'native', 'synthetic']],
      edge_fields: ['type', 'name_or_index', 'to_node'],
      edge_types: [['context', 'element', 'property', 'internal', 'hidden', 'shortcut', 'weak']],
      trace_function_info_fields: [],
      trace_node_fields: [],
      sample_fields: [],
      location_fields: [],
      strings: [],
    };
  }
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Format bytes to human readable string
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
}

/**
 * Get percentage of total
 */
export function getPercentage(value: number, total: number): string {
  if (total === 0) return '0%';
  return `${((value / total) * 100).toFixed(1)}%`;
}

// ============================================================================
// SINGLETON
// ============================================================================

let processorInstance: HeapSnapshotProcessor | null = null;

export function getHeapSnapshotProcessor(): HeapSnapshotProcessor {
  if (!processorInstance) {
    processorInstance = new HeapSnapshotProcessor();
  }
  return processorInstance;
}
