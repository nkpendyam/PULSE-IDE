// Kyro IDE - Memories System
// Persistent memory management for AI context (like Windsurf's Memories)

import { EventEmitter } from 'events';

// ============================================================================
// TYPES
// ============================================================================

export interface Memory {
  id: string;
  content: string;
  type: MemoryType;
  scope: MemoryScope;
  tags: string[];
  importance: number; // 0-1
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
  accessCount: number;
  lastAccessedAt?: Date;
  metadata?: Record<string, unknown>;
}

export type MemoryType = 
  | 'preference'    // User preferences
  | 'context'       // Project/context information
  | 'fact'          // Facts about codebase
  | 'pattern'       // Code patterns discovered
  | 'decision'      // Architecture decisions
  | 'todo'          // Tasks to remember
  | 'snippet'       // Code snippets
  | 'conversation'  // Important conversation points
  | 'learned';      // Learned from interactions

export type MemoryScope = 
  | 'global'    // Across all projects
  | 'project'   // Current project only
  | 'session';  // Current session only

export interface MemorySearchResult {
  memory: Memory;
  score: number;
  highlights?: string[];
}

// ============================================================================
// MEMORIES MANAGER
// ============================================================================

export class MemoriesManager extends EventEmitter {
  private memories: Map<string, Memory> = new Map();
  private projectMemories: Set<string> = new Set();
  private maxMemories: number = 1000;
  private storageKey: string = 'kyro-ide-memories';

  constructor() {
    super();
    this.loadFromStorage();
  }

  // Create a new memory
  createMemory(
    content: string,
    type: MemoryType = 'fact',
    scope: MemoryScope = 'project',
    options: {
      tags?: string[];
      importance?: number;
      expiresAt?: Date;
      metadata?: Record<string, unknown>;
    } = {}
  ): Memory {
    const memory: Memory = {
      id: `mem-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      content,
      type,
      scope,
      tags: options.tags || [],
      importance: options.importance ?? 0.5,
      createdAt: new Date(),
      updatedAt: new Date(),
      expiresAt: options.expiresAt,
      accessCount: 0,
      metadata: options.metadata
    };

    this.memories.set(memory.id, memory);
    
    if (scope === 'project') {
      this.projectMemories.add(memory.id);
    }

    this.saveToStorage();
    this.emit('memory:created', memory);

    // Enforce max memories
    this.enforceLimit();

    return memory;
  }

  // Get memory by ID
  getMemory(id: string): Memory | undefined {
    const memory = this.memories.get(id);
    if (memory) {
      memory.accessCount++;
      memory.lastAccessedAt = new Date();
    }
    return memory;
  }

  // Update memory
  updateMemory(id: string, updates: Partial<Pick<Memory, 'content' | 'tags' | 'importance' | 'metadata'>>): Memory | undefined {
    const memory = this.memories.get(id);
    if (!memory) return undefined;

    Object.assign(memory, updates, { updatedAt: new Date() });
    this.saveToStorage();
    this.emit('memory:updated', memory);

    return memory;
  }

  // Delete memory
  deleteMemory(id: string): boolean {
    const memory = this.memories.get(id);
    if (!memory) return false;

    this.memories.delete(id);
    this.projectMemories.delete(id);
    this.saveToStorage();
    this.emit('memory:deleted', id);

    return true;
  }

  // Get all memories
  getAllMemories(): Memory[] {
    return Array.from(this.memories.values());
  }

  // Get memories by type
  getMemoriesByType(type: MemoryType): Memory[] {
    return this.getAllMemories().filter(m => m.type === type);
  }

  // Get memories by scope
  getMemoriesByScope(scope: MemoryScope): Memory[] {
    return this.getAllMemories().filter(m => m.scope === scope);
  }

  // Get project memories
  getProjectMemories(): Memory[] {
    return Array.from(this.projectMemories)
      .map(id => this.memories.get(id))
      .filter((m): m is Memory => m !== undefined);
  }

  // Search memories
  searchMemories(query: string, options: {
    types?: MemoryType[];
    scope?: MemoryScope;
    tags?: string[];
    limit?: number;
  } = {}): MemorySearchResult[] {
    const queryLower = query.toLowerCase();
    const queryTerms = queryLower.split(/\s+/);

    let memories = this.getAllMemories();

    // Filter by type
    if (options.types?.length) {
      memories = memories.filter(m => options.types!.includes(m.type));
    }

    // Filter by scope
    if (options.scope) {
      memories = memories.filter(m => m.scope === options.scope);
    }

    // Filter by tags
    if (options.tags?.length) {
      memories = memories.filter(m => 
        options.tags!.some(tag => m.tags.includes(tag))
      );
    }

    // Score and rank
    const results: MemorySearchResult[] = memories.map(memory => {
      let score = 0;
      const contentLower = memory.content.toLowerCase();

      // Exact match bonus
      if (contentLower.includes(queryLower)) {
        score += 10;
      }

      // Term matches
      for (const term of queryTerms) {
        if (contentLower.includes(term)) {
          score += 2;
        }
        for (const tag of memory.tags) {
          if (tag.toLowerCase().includes(term)) {
            score += 1;
          }
        }
      }

      // Importance boost
      score += memory.importance * 3;

      // Recency boost
      const ageHours = (Date.now() - memory.createdAt.getTime()) / (1000 * 60 * 60);
      score += Math.max(0, 2 - ageHours / 24); // Decay over 24 hours

      // Access count boost
      score += Math.min(memory.accessCount * 0.1, 2);

      return { memory, score };
    });

    // Sort by score and limit
    results.sort((a, b) => b.score - a.score);
    
    return results.slice(0, options.limit || 10);
  }

  // Get context for AI (relevant memories)
  getContextForAI(maxTokens: number = 2000): string {
    const memories = this.getAllMemories()
      .filter(m => !m.expiresAt || m.expiresAt > new Date())
      .sort((a, b) => {
        // Sort by importance and recency
        const scoreA = a.importance + (a.accessCount * 0.1) + (Date.now() - a.createdAt.getTime()) / (1000 * 60 * 60 * 24 * -0.1);
        const scoreB = b.importance + (b.accessCount * 0.1) + (Date.now() - b.createdAt.getTime()) / (1000 * 60 * 60 * 24 * -0.1);
        return scoreB - scoreA;
      });

    let context = '# Relevant Context\n\n';
    let currentTokens = 0;

    for (const memory of memories) {
      const memoryText = `## ${memory.type}: ${memory.content}\n`;
      const tokens = memoryText.length / 4; // Rough estimate

      if (currentTokens + tokens > maxTokens) break;

      context += memoryText;
      currentTokens += tokens;
    }

    return context;
  }

  // Learn from conversation
  learnFromConversation(message: string, response: string): void {
    // Extract potential learnings from the conversation
    // This is a simplified version - could use AI to extract insights
    
    const patterns = [
      { regex: /I prefer\s+(.+)/i, type: 'preference' as MemoryType },
      { regex: /remember (?:that\s+)?(.+)/i, type: 'fact' as MemoryType },
      { regex: /we decided\s+(?:that\s+)?(.+)/i, type: 'decision' as MemoryType },
      { regex: /always\s+(.+)\s+when\s+(.+)/i, type: 'pattern' as MemoryType },
    ];

    for (const { regex, type } of patterns) {
      const match = message.match(regex);
      if (match) {
        this.createMemory(match[1] || match[0], type, 'project', {
          importance: 0.8,
          tags: ['learned', 'conversation']
        });
      }
    }
  }

  // Add preference
  addPreference(preference: string, importance: number = 0.7): Memory {
    return this.createMemory(preference, 'preference', 'global', {
      importance,
      tags: ['preference']
    });
  }

  // Add code pattern
  addPattern(pattern: string, description?: string): Memory {
    return this.createMemory(
      description ? `${description}: ${pattern}` : pattern,
      'pattern',
      'project',
      { importance: 0.6, tags: ['pattern'] }
    );
  }

  // Add architecture decision
  addDecision(decision: string, rationale?: string): Memory {
    return this.createMemory(
      rationale ? `${decision}\nRationale: ${rationale}` : decision,
      'decision',
      'project',
      { importance: 0.9, tags: ['decision', 'architecture'] }
    );
  }

  // Clean expired memories
  cleanExpired(): number {
    const now = new Date();
    let cleaned = 0;

    for (const [id, memory] of this.memories) {
      if (memory.expiresAt && memory.expiresAt < now) {
        this.memories.delete(id);
        this.projectMemories.delete(id);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.saveToStorage();
      this.emit('memories:cleaned', cleaned);
    }

    return cleaned;
  }

  // Enforce max memories limit
  private enforceLimit(): void {
    if (this.memories.size <= this.maxMemories) return;

    // Remove least important, oldest memories
    const sorted = this.getAllMemories()
      .sort((a, b) => {
        const scoreA = a.importance - (Date.now() - a.createdAt.getTime()) / (1000 * 60 * 60 * 24 * 10);
        const scoreB = b.importance - (Date.now() - b.createdAt.getTime()) / (1000 * 60 * 60 * 24 * 10);
        return scoreA - scoreB;
      });

    const toRemove = sorted.slice(0, this.memories.size - this.maxMemories);
    for (const memory of toRemove) {
      this.memories.delete(memory.id);
      this.projectMemories.delete(memory.id);
    }

    this.saveToStorage();
  }

  // Save to storage
  private saveToStorage(): void {
    try {
      const data = {
        memories: Array.from(this.memories.entries()),
        projectMemories: Array.from(this.projectMemories)
      };
      // In real implementation, would save to file or localStorage
      // localStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch (error) {
      this.emit('error', error);
    }
  }

  // Load from storage
  private loadFromStorage(): void {
    try {
      // In real implementation, would load from file or localStorage
      // const data = JSON.parse(localStorage.getItem(this.storageKey) || '{}');
      // if (data.memories) {
      //   this.memories = new Map(data.memories);
      //   this.projectMemories = new Set(data.projectMemories || []);
      // }
    } catch (error) {
      this.emit('error', error);
    }
  }

  // Export memories
  exportMemories(): string {
    return JSON.stringify({
      memories: this.getAllMemories(),
      exportedAt: new Date()
    }, null, 2);
  }

  // Import memories
  importMemories(json: string): number {
    try {
      const data = JSON.parse(json);
      let imported = 0;

      for (const memory of data.memories || []) {
        if (!this.memories.has(memory.id)) {
          this.memories.set(memory.id, {
            ...memory,
            createdAt: new Date(memory.createdAt),
            updatedAt: new Date(memory.updatedAt),
            expiresAt: memory.expiresAt ? new Date(memory.expiresAt) : undefined,
            lastAccessedAt: memory.lastAccessedAt ? new Date(memory.lastAccessedAt) : undefined
          });
          if (memory.scope === 'project') {
            this.projectMemories.add(memory.id);
          }
          imported++;
        }
      }

      this.saveToStorage();
      this.emit('memories:imported', imported);

      return imported;
    } catch (error) {
      this.emit('error', error);
      return 0;
    }
  }
}

// Singleton
let memoriesManagerInstance: MemoriesManager | null = null;

export function getMemoriesManager(): MemoriesManager {
  if (!memoriesManagerInstance) {
    memoriesManagerInstance = new MemoriesManager();
  }
  return memoriesManagerInstance;
}
