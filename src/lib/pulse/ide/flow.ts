// Kyro IDE - Flow Awareness System
// Tracks all user actions for deep contextual awareness (like Windsurf's Cascade)

import { EventEmitter } from 'events';

// ============================================================================
// TYPES
// ============================================================================

export interface FlowEvent {
  id: string;
  type: FlowEventType;
  timestamp: Date;
  data: Record<string, unknown>;
  context?: {
    file?: string;
    line?: number;
    column?: number;
    selection?: string;
    agent?: string;
  };
}

export type FlowEventType =
  | 'file.open'
  | 'file.close'
  | 'file.save'
  | 'file.edit'
  | 'file.delete'
  | 'file.create'
  | 'selection.change'
  | 'cursor.move'
  | 'scroll'
  | 'search.query'
  | 'search.result_click'
  | 'terminal.command'
  | 'terminal.output'
  | 'git.commit'
  | 'git.branch'
  | 'git.checkout'
  | 'ai.chat'
  | 'ai.complete'
  | 'ai.suggestion_accept'
  | 'ai.suggestion_reject'
  | 'ai.agent_start'
  | 'ai.agent_complete'
  | 'clipboard.copy'
  | 'clipboard.paste'
  | 'shortcut.use'
  | 'panel.open'
  | 'panel.close'
  | 'settings.change'
  | 'project.open'
  | 'error';

export interface FlowSession {
  id: string;
  startTime: Date;
  endTime?: Date;
  events: FlowEvent[];
  summary?: FlowSummary;
}

export interface FlowSummary {
  filesOpened: string[];
  filesEdited: string[];
  commandsExecuted: string[];
  aiInteractions: number;
  tokensUsed: number;
  errors: number;
  totalTime: number;
  primaryLanguage?: string;
  primaryTask?: string;
}

export interface FlowContext {
  recentFiles: string[];
  recentEdits: Array<{ file: string; timestamp: Date }>;
  recentSearches: string[];
  recentCommands: string[];
  clipboardHistory: string[];
  activeAgents: string[];
  currentIntent?: string;
  relatedFiles: string[];
}

// ============================================================================
// FLOW AWARENESS MANAGER
// ============================================================================

export class FlowAwareness extends EventEmitter {
  private events: FlowEvent[] = [];
  private currentSession: FlowSession | null = null;
  private maxEvents: number = 10000;
  private contextCache: FlowContext | null = null;
  private intentDetector: IntentDetector;

  constructor() {
    super();
    this.intentDetector = new IntentDetector();
    this.startSession();
  }

  // Start a new flow session
  startSession(): void {
    this.currentSession = {
      id: `session-${Date.now()}`,
      startTime: new Date(),
      events: []
    };
    this.events = [];
    this.contextCache = null;
    this.emit('session:started', this.currentSession);
  }

  // End current session
  endSession(): FlowSummary | null {
    if (!this.currentSession) return null;

    this.currentSession.endTime = new Date();
    this.currentSession.summary = this.generateSummary();
    
    this.emit('session:ended', this.currentSession);
    return this.currentSession.summary;
  }

  // Record a flow event
  recordEvent(
    type: FlowEventType,
    data: Record<string, unknown>,
    context?: FlowEvent['context']
  ): FlowEvent {
    const event: FlowEvent = {
      id: `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      timestamp: new Date(),
      data,
      context
    };

    this.events.push(event);
    if (this.currentSession) {
      this.currentSession.events.push(event);
    }

    // Invalidate context cache
    this.contextCache = null;

    // Trim old events
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }

    // Detect intent
    this.detectIntent(event);

    this.emit('event:recorded', event);

    return event;
  }

  // Get all events
  getEvents(): FlowEvent[] {
    return [...this.events];
  }

  // Get events by type
  getEventsByType(type: FlowEventType): FlowEvent[] {
    return this.events.filter(e => e.type === type);
  }

  // Get events in time range
  getEventsInRange(start: Date, end: Date): FlowEvent[] {
    return this.events.filter(e => 
      e.timestamp >= start && e.timestamp <= end
    );
  }

  // Get recent events
  getRecentEvents(count: number = 50): FlowEvent[] {
    return this.events.slice(-count);
  }

  // Get flow context for AI
  getFlowContext(): FlowContext {
    if (this.contextCache) return this.contextCache;

    const recentEvents = this.events.slice(-100);
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

    const recentFilesSet = new Set<string>();
    const recentEdits: Array<{ file: string; timestamp: Date }> = [];
    const recentSearches: string[] = [];
    const recentCommands: string[] = [];
    const clipboardHistory: string[] = [];
    const activeAgents = new Set<string>();

    for (const event of recentEvents) {
      // Recent files
      if (event.type === 'file.open' && event.data.path) {
        recentFilesSet.add(event.data.path as string);
      }

      // Recent edits
      if (event.type === 'file.edit' && event.context?.file) {
        recentEdits.push({
          file: event.context.file,
          timestamp: event.timestamp
        });
      }

      // Recent searches
      if (event.type === 'search.query' && event.data.query) {
        recentSearches.push(event.data.query as string);
      }

      // Recent commands
      if (event.type === 'terminal.command' && event.data.command) {
        recentCommands.push(event.data.command as string);
      }

      // Clipboard
      if (event.type === 'clipboard.copy' && event.data.text) {
        clipboardHistory.push(event.data.text as string);
      }

      // Active agents
      if (event.type === 'ai.agent_start' && event.data.agentId) {
        activeAgents.add(event.data.agentId as string);
      }
    }

    this.contextCache = {
      recentFiles: Array.from(recentFilesSet).slice(-10),
      recentEdits: recentEdits.slice(-20),
      recentSearches: recentSearches.slice(-5),
      recentCommands: recentCommands.slice(-10),
      clipboardHistory: clipboardHistory.slice(-5),
      activeAgents: Array.from(activeAgents),
      currentIntent: this.intentDetector.getCurrentIntent(),
      relatedFiles: this.findRelatedFiles()
    };

    return this.contextCache;
  }

  // Find related files based on edit patterns
  private findRelatedFiles(): string[] {
    const editCounts = new Map<string, number>();
    
    for (const event of this.events.slice(-200)) {
      if (event.type === 'file.edit' && event.context?.file) {
        const count = editCounts.get(event.context.file) || 0;
        editCounts.set(event.context.file, count + 1);
      }
    }

    return Array.from(editCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([file]) => file);
  }

  // Detect user intent from events
  private detectIntent(event: FlowEvent): void {
    this.intentDetector.processEvent(event);
  }

  // Get current detected intent
  getCurrentIntent(): string | undefined {
    return this.intentDetector.getCurrentIntent();
  }

  // Generate session summary
  private generateSummary(): FlowSummary {
    const filesOpened = new Set<string>();
    const filesEdited = new Set<string>();
    const commandsExecuted: string[] = [];
    let aiInteractions = 0;
    let tokensUsed = 0;
    let errors = 0;

    for (const event of this.events) {
      switch (event.type) {
        case 'file.open':
          if (event.data.path) filesOpened.add(event.data.path as string);
          break;
        case 'file.edit':
          if (event.context?.file) filesEdited.add(event.context.file);
          break;
        case 'terminal.command':
          if (event.data.command) commandsExecuted.push(event.data.command as string);
          break;
        case 'ai.chat':
        case 'ai.complete':
          aiInteractions++;
          if (event.data.tokens) tokensUsed += event.data.tokens as number;
          break;
        case 'error':
          errors++;
          break;
      }
    }

    return {
      filesOpened: Array.from(filesOpened),
      filesEdited: Array.from(filesEdited),
      commandsExecuted,
      aiInteractions,
      tokensUsed,
      errors,
      totalTime: this.currentSession 
        ? (this.currentSession.endTime?.getTime() || Date.now()) - this.currentSession.startTime.getTime()
        : 0
    };
  }

  // Clear history
  clearHistory(): void {
    this.events = [];
    this.contextCache = null;
    this.emit('history:cleared');
  }

  // Export session for replay
  exportSession(): string {
    return JSON.stringify({
      session: this.currentSession,
      events: this.events
    }, null, 2);
  }

  // Import session
  importSession(json: string): void {
    try {
      const data = JSON.parse(json);
      if (data.events) {
        this.events = data.events.map((e: FlowEvent) => ({
          ...e,
          timestamp: new Date(e.timestamp)
        }));
      }
      this.contextCache = null;
      this.emit('session:imported');
    } catch (error) {
      this.emit('error', error);
    }
  }
}

// ============================================================================
// INTENT DETECTOR
// ============================================================================

class IntentDetector {
  private recentIntents: Array<{ intent: string; confidence: number; timestamp: Date }> = [];
  private patterns: Array<{
    pattern: FlowEventType[];
    intent: string;
  }> = [
    {
      pattern: ['file.open', 'file.edit', 'file.edit', 'file.edit'],
      intent: 'refactoring'
    },
    {
      pattern: ['search.query', 'search.result_click', 'file.open'],
      intent: 'exploration'
    },
    {
      pattern: ['ai.chat', 'ai.suggestion_accept', 'file.edit'],
      intent: 'ai_assisted_coding'
    },
    {
      pattern: ['terminal.command', 'terminal.output', 'error'],
      intent: 'debugging'
    },
    {
      pattern: ['file.create', 'file.edit', 'ai.agent_start'],
      intent: 'feature_development'
    },
    {
      pattern: ['git.commit', 'git.push'],
      intent: 'deployment'
    }
  ];

  processEvent(event: FlowEvent): void {
    // Simple intent detection based on event patterns
    // In a real implementation, this could use ML
    const recentTypes = this.recentIntents.length > 0 
      ? this.eventsToTypes(this.getRecentEventTypes(10))
      : [event.type];

    for (const pattern of this.patterns) {
      if (this.matchesPattern(recentTypes, pattern.pattern)) {
        this.recentIntents.push({
          intent: pattern.intent,
          confidence: 0.7,
          timestamp: new Date()
        });
      }
    }
  }

  private eventsToTypes(types: FlowEventType[]): FlowEventType[] {
    return types;
  }

  private getRecentEventTypes(count: number): FlowEventType[] {
    // Would access recent events
    return [];
  }

  private matchesPattern(recent: FlowEventType[], pattern: FlowEventType[]): boolean {
    if (recent.length < pattern.length) return false;
    const recentSlice = recent.slice(-pattern.length);
    return pattern.every((type, i) => recentSlice[i] === type);
  }

  getCurrentIntent(): string | undefined {
    // Return the most recent high-confidence intent
    const recent = this.recentIntents
      .filter(i => Date.now() - i.timestamp.getTime() < 60000) // Last minute
      .sort((a, b) => b.confidence - a.confidence);
    
    return recent[0]?.intent;
  }
}

// Singleton
let flowAwarenessInstance: FlowAwareness | null = null;

export function getFlowAwareness(): FlowAwareness {
  if (!flowAwarenessInstance) {
    flowAwarenessInstance = new FlowAwareness();
  }
  return flowAwarenessInstance;
}
