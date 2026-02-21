// PULSE Dependency Resolver
// Resolves module and task dependencies using topological sort

export interface DependencyNode {
  id: string;
  dependencies: string[];
}

export interface ResolvedDependency {
  id: string;
  level: number; // Load order level (0 = no deps, 1 = depends on level 0, etc.)
}

export class DependencyResolver {
  /**
   * Resolve dependencies using topological sort
   * Returns nodes in order they should be loaded/executed
   */
  resolve(nodes: DependencyNode[]): ResolvedDependency[] {
    const result: ResolvedDependency[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const levels = new Map<string, number>();

    // Build adjacency list
    const nodeMap = new Map<string, DependencyNode>();
    for (const node of nodes) {
      nodeMap.set(node.id, node);
    }

    // DFS with cycle detection
    const visit = (nodeId: string, path: string[]): void => {
      if (visited.has(nodeId)) return;
      if (visiting.has(nodeId)) {
        throw new Error(
          `Circular dependency detected: ${[...path, nodeId].join(' -> ')}`
        );
      }

      const node = nodeMap.get(nodeId);
      if (!node) {
        throw new Error(`Unknown dependency: ${nodeId}`);
      }

      visiting.add(nodeId);
      path.push(nodeId);

      // Visit dependencies first
      let maxDepLevel = -1;
      for (const depId of node.dependencies) {
        visit(depId, [...path]);
        maxDepLevel = Math.max(maxDepLevel, levels.get(depId) || 0);
      }

      visiting.delete(nodeId);
      visited.add(nodeId);
      
      const level = maxDepLevel + 1;
      levels.set(nodeId, level);
      result.push({ id: nodeId, level });
    };

    // Visit all nodes
    for (const node of nodes) {
      if (!visited.has(node.id)) {
        visit(node.id, []);
      }
    }

    // Sort by level (load order)
    result.sort((a, b) => a.level - b.level);
    return result;
  }

  /**
   * Check if there are any circular dependencies
   */
  hasCircularDependencies(nodes: DependencyNode[]): boolean {
    try {
      this.resolve(nodes);
      return false;
    } catch {
      return true;
    }
  }

  /**
   * Get dependencies of a specific node (transitive)
   */
  getTransitiveDependencies(nodeId: string, nodes: DependencyNode[]): string[] {
    const nodeMap = new Map<string, DependencyNode>();
    for (const node of nodes) {
      nodeMap.set(node.id, node);
    }

    const visited = new Set<string>();
    const collect = (id: string): void => {
      const node = nodeMap.get(id);
      if (!node || visited.has(id)) return;
      
      visited.add(id);
      for (const depId of node.dependencies) {
        collect(depId);
      }
    };

    const targetNode = nodeMap.get(nodeId);
    if (!targetNode) return [];

    for (const depId of targetNode.dependencies) {
      collect(depId);
    }

    return Array.from(visited);
  }

  /**
   * Get dependents of a specific node (what depends on it)
   */
  getDependents(nodeId: string, nodes: DependencyNode[]): string[] {
    const dependents: string[] = [];
    
    for (const node of nodes) {
      if (node.dependencies.includes(nodeId)) {
        dependents.push(node.id);
      }
    }

    return dependents;
  }

  /**
   * Validate dependencies (check all exist)
   */
  validateDependencies(nodes: DependencyNode[]): {
    valid: boolean;
    missing: Map<string, string[]>;
  } {
    const nodeIds = new Set(nodes.map(n => n.id));
    const missing = new Map<string, string[]>();

    for (const node of nodes) {
      const missingDeps = node.dependencies.filter(d => !nodeIds.has(d));
      if (missingDeps.length > 0) {
        missing.set(node.id, missingDeps);
      }
    }

    return {
      valid: missing.size === 0,
      missing,
    };
  }

  /**
   * Get load order for new module (considering existing modules)
   */
  getLoadOrder(
    newModule: DependencyNode,
    existingModules: DependencyNode[]
  ): string[] {
    const allNodes = [...existingModules, newModule];
    const resolved = this.resolve(allNodes);
    
    // Find where new module appears and return all modules from that point
    const newModuleIndex = resolved.findIndex(r => r.id === newModule.id);
    if (newModuleIndex === -1) return [];

    return resolved.slice(newModuleIndex).map(r => r.id);
  }
}

// Singleton instance
let resolverInstance: DependencyResolver | null = null;

export function getDependencyResolver(): DependencyResolver {
  if (!resolverInstance) {
    resolverInstance = new DependencyResolver();
  }
  return resolverInstance;
}

export function resetDependencyResolver(): void {
  resolverInstance = null;
}
