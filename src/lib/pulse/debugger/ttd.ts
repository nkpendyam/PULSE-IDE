/**
 * Kyro IDE Time Travel Debugging (TTD)
 * 
 * Record and replay debugging similar to WinDbg TTD and Mozilla rr.
 * Captures full execution state for bidirectional debugging.
 * 
 * Features:
 * - Non-deterministic execution recording
 * - Memory state snapshots
 * - Reverse step/continue operations
 * - Event timeline visualization
 * - Breakpoint time travel
 */

// ============================================================================
// TYPES
// ============================================================================

export interface ExecutionSnapshot {
  id: string;
  timestamp: number;
  sequenceNumber: number;
  location: SourceLocation;
  callStack: CallFrame[];
  memory: MemoryState;
  registers: RegisterState;
  eventType: ExecutionEventType;
  eventPayload?: unknown;
}

export interface SourceLocation {
  file: string;
  line: number;
  column: number;
  function?: string;
}

export interface CallFrame {
  id: string;
  name: string;
  location: SourceLocation;
  locals: Map<string, RuntimeValue>;
  arguments: Map<string, RuntimeValue>;
  thisValue?: RuntimeValue;
}

export interface RuntimeValue {
  type: 'number' | 'string' | 'boolean' | 'object' | 'array' | 'function' | 'undefined' | 'null';
  value: unknown;
  objectId?: string;
}

export interface MemoryState {
  heap: Map<string, HeapObject>;
  globals: Map<string, RuntimeValue>;
  allocationCount: number;
  deallocationCount: number;
}

export interface HeapObject {
  id: string;
  type: string;
  size: number;
  fields: Map<string, RuntimeValue>;
  allocatedAt: number;
  freedAt?: number;
}

export interface RegisterState {
  programCounter: number;
  stackPointer: number;
  basePointer: number;
  flags: {
    carry: boolean;
    zero: boolean;
    overflow: boolean;
    negative: boolean;
  };
}

export type ExecutionEventType =
  | 'step'
  | 'function_call'
  | 'function_return'
  | 'branch'
  | 'exception'
  | 'memory_read'
  | 'memory_write'
  | 'breakpoint'
  | 'watchpoint'
  | 'async_await'
  | 'async_resume'
  | 'promise_create'
  | 'promise_resolve'
  | 'promise_reject';

export interface TimeTravelBreakpoint {
  id: string;
  location?: SourceLocation;
  condition?: string;
  hitCount: number;
  enabled: boolean;
  hitTimestamps: number[];
}

export interface ReplaySession {
  id: string;
  startTime: Date;
  endTime?: Date;
  status: 'recording' | 'replaying' | 'paused' | 'completed';
  snapshots: ExecutionSnapshot[];
  breakpoints: Map<string, TimeTravelBreakpoint>;
  currentPosition: number;
  recordingFile?: string;
}

// ============================================================================
// EXECUTION RECORDER
// ============================================================================

export class ExecutionRecorder {
  private snapshots: ExecutionSnapshot[] = [];
  private sequenceNumber: number = 0;
  private isRecording: boolean = false;
  private currentSession: ReplaySession | null = null;
  private heap: Map<string, HeapObject> = new Map();
  private globals: Map<string, RuntimeValue> = new Map();
  private objectCounter: number = 0;

  /**
   * Start a new recording session
   */
  startSession(): ReplaySession {
    this.snapshots = [];
    this.sequenceNumber = 0;
    this.heap.clear();
    this.globals.clear();
    this.objectCounter = 0;
    this.isRecording = true;

    this.currentSession = {
      id: `session-${Date.now()}`,
      startTime: new Date(),
      status: 'recording',
      snapshots: this.snapshots,
      breakpoints: new Map(),
      currentPosition: 0,
    };

    return this.currentSession;
  }

  /**
   * Stop recording and return session
   */
  stopSession(): ReplaySession | null {
    if (!this.currentSession) return null;

    this.isRecording = false;
    this.currentSession.endTime = new Date();
    this.currentSession.status = 'completed';

    const session = this.currentSession;
    this.currentSession = null;
    return session;
  }

  /**
   * Record a step execution
   */
  recordStep(
    location: SourceLocation,
    callStack: CallFrame[],
    eventType: ExecutionEventType = 'step',
    payload?: unknown
  ): ExecutionSnapshot {
    const snapshot: ExecutionSnapshot = {
      id: `snapshot-${++this.sequenceNumber}`,
      timestamp: Date.now(),
      sequenceNumber: this.sequenceNumber,
      location,
      callStack: callStack.map(frame => ({
        ...frame,
        locals: new Map(frame.locals),
        arguments: new Map(frame.arguments),
      })),
      memory: {
        heap: new Map(this.heap),
        globals: new Map(this.globals),
        allocationCount: this.objectCounter,
        deallocationCount: 0,
      },
      registers: this.captureRegisters(),
      eventType,
      eventPayload: payload,
    };

    this.snapshots.push(snapshot);
    this.checkBreakpoints(snapshot);

    return snapshot;
  }

  /**
   * Record function call
   */
  recordFunctionCall(
    location: SourceLocation,
    functionName: string,
    args: Map<string, RuntimeValue>,
    callStack: CallFrame[]
  ): ExecutionSnapshot {
    const newFrame: CallFrame = {
      id: `frame-${Date.now()}`,
      name: functionName,
      location,
      locals: new Map(),
      arguments: new Map(args),
    };

    return this.recordStep(location, [...callStack, newFrame], 'function_call', {
      functionName,
      arguments: Array.from(args.entries()),
    });
  }

  /**
   * Record function return
   */
  recordFunctionReturn(
    location: SourceLocation,
    returnValue: RuntimeValue | undefined,
    callStack: CallFrame[]
  ): ExecutionSnapshot {
    return this.recordStep(location, callStack.slice(0, -1), 'function_return', {
      returnValue,
    });
  }

  /**
   * Record branch decision
   */
  recordBranch(
    location: SourceLocation,
    condition: RuntimeValue,
    taken: boolean,
    callStack: CallFrame[]
  ): ExecutionSnapshot {
    return this.recordStep(location, callStack, 'branch', {
      condition,
      branchTaken: taken,
    });
  }

  /**
   * Record exception
   */
  recordException(
    location: SourceLocation,
    exception: RuntimeValue,
    callStack: CallFrame[]
  ): ExecutionSnapshot {
    return this.recordStep(location, callStack, 'exception', {
      exception,
    });
  }

  /**
   * Record memory operation
   */
  recordMemoryAccess(
    location: SourceLocation,
    address: string,
    value: RuntimeValue,
    isWrite: boolean,
    callStack: CallFrame[]
  ): ExecutionSnapshot {
    if (isWrite) {
      this.heap.set(address, {
        id: address,
        type: value.type,
        size: this.estimateSize(value),
        fields: new Map([['value', value]]),
        allocatedAt: this.sequenceNumber,
      });
    }

    return this.recordStep(location, callStack, isWrite ? 'memory_write' : 'memory_read', {
      address,
      value,
      isWrite,
    });
  }

  /**
   * Record async operation
   */
  recordAsyncOperation(
    location: SourceLocation,
    operation: 'await' | 'resume' | 'create' | 'resolve' | 'reject',
    promiseId: string,
    callStack: CallFrame[]
  ): ExecutionSnapshot {
    const eventMap: Record<string, ExecutionEventType> = {
      await: 'async_await',
      resume: 'async_resume',
      create: 'promise_create',
      resolve: 'promise_resolve',
      reject: 'promise_reject',
    };

    return this.recordStep(location, callStack, eventMap[operation], {
      promiseId,
      operation,
    });
  }

  /**
   * Allocate object in heap
   */
  allocateObject(type: string, fields: Map<string, RuntimeValue>): string {
    const id = `obj-${++this.objectCounter}`;
    this.heap.set(id, {
      id,
      type,
      size: this.estimateObjectSize(fields),
      fields: new Map(fields),
      allocatedAt: this.sequenceNumber,
    });
    return id;
  }

  /**
   * Free object from heap
   */
  freeObject(id: string): void {
    const obj = this.heap.get(id);
    if (obj) {
      obj.freedAt = this.sequenceNumber;
    }
  }

  /**
   * Set global variable
   */
  setGlobal(name: string, value: RuntimeValue): void {
    this.globals.set(name, value);
  }

  /**
   * Capture current register state
   */
  private captureRegisters(): RegisterState {
    return {
      programCounter: this.sequenceNumber,
      stackPointer: 0,
      basePointer: 0,
      flags: {
        carry: false,
        zero: false,
        overflow: false,
        negative: false,
      },
    };
  }

  /**
   * Estimate size of a runtime value
   */
  private estimateSize(value: RuntimeValue): number {
    switch (value.type) {
      case 'number':
        return 8;
      case 'string':
        return (value.value as string).length * 2;
      case 'boolean':
        return 1;
      case 'object':
      case 'array':
        return 64;
      default:
        return 0;
    }
  }

  /**
   * Estimate object size
   */
  private estimateObjectSize(fields: Map<string, RuntimeValue>): number {
    let size = 0;
    for (const [key, value] of fields) {
      size += key.length + this.estimateSize(value);
    }
    return size;
  }

  /**
   * Check and record breakpoint hits
   */
  private checkBreakpoints(snapshot: ExecutionSnapshot): void {
    if (!this.currentSession) return;

    for (const [, bp] of this.currentSession.breakpoints) {
      if (!bp.enabled) continue;

      if (bp.location && 
          bp.location.file === snapshot.location.file &&
          bp.location.line === snapshot.location.line) {
        bp.hitCount++;
        bp.hitTimestamps.push(snapshot.timestamp);
      }
    }
  }

  /**
   * Get current recording session
   */
  getCurrentSession(): ReplaySession | null {
    return this.currentSession;
  }

  /**
   * Check if currently recording
   */
  getIsRecording(): boolean {
    return this.isRecording;
  }
}

// ============================================================================
// TIME TRAVEL REPLAYER
// ============================================================================

export class TimeTravelReplayer {
  private session: ReplaySession | null = null;
  private currentIndex: number = 0;
  private playbackSpeed: number = 1;
  private isPlaying: boolean = false;

  /**
   * Load a recorded session for replay
   */
  loadSession(session: ReplaySession): void {
    this.session = session;
    this.currentIndex = 0;
    this.session.status = 'replaying';
    this.session.currentPosition = 0;
  }

  /**
   * Get current snapshot
   */
  getCurrentSnapshot(): ExecutionSnapshot | null {
    if (!this.session || this.session.snapshots.length === 0) return null;
    return this.session.snapshots[this.currentIndex];
  }

  /**
   * Go to specific snapshot by sequence number
   */
  goToSequence(sequenceNumber: number): ExecutionSnapshot | null {
    if (!this.session) return null;

    const index = this.session.snapshots.findIndex(s => s.sequenceNumber === sequenceNumber);
    if (index === -1) return null;

    this.currentIndex = index;
    this.session.currentPosition = index;
    return this.session.snapshots[index];
  }

  /**
   * Go to specific timestamp
   */
  goToTimestamp(timestamp: number): ExecutionSnapshot | null {
    if (!this.session) return null;

    let index = 0;
    for (let i = 0; i < this.session.snapshots.length; i++) {
      if (this.session.snapshots[i].timestamp <= timestamp) {
        index = i;
      }
    }

    this.currentIndex = index;
    this.session.currentPosition = index;
    return this.session.snapshots[index];
  }

  /**
   * Step forward one snapshot
   */
  stepForward(): ExecutionSnapshot | null {
    if (!this.session) return null;

    if (this.currentIndex < this.session.snapshots.length - 1) {
      this.currentIndex++;
      this.session.currentPosition = this.currentIndex;
      return this.session.snapshots[this.currentIndex];
    }

    return null;
  }

  /**
   * Step backward one snapshot
   */
  stepBackward(): ExecutionSnapshot | null {
    if (!this.session) return null;

    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.session.currentPosition = this.currentIndex;
      return this.session.snapshots[this.currentIndex];
    }

    return null;
  }

  /**
   * Continue forward until breakpoint or end
   */
  async continueForward(): Promise<ExecutionSnapshot | null> {
    if (!this.session) return null;

    this.isPlaying = true;

    while (this.currentIndex < this.session.snapshots.length - 1 && this.isPlaying) {
      const snapshot = this.stepForward();
      if (!snapshot) break;

      if (this.isBreakpointHit(snapshot)) {
        this.isPlaying = false;
        return snapshot;
      }

      await this.delay(100 / this.playbackSpeed);
    }

    this.isPlaying = false;
    return this.getCurrentSnapshot();
  }

  /**
   * Continue backward until breakpoint or beginning
   */
  async continueBackward(): Promise<ExecutionSnapshot | null> {
    if (!this.session) return null;

    this.isPlaying = true;

    while (this.currentIndex > 0 && this.isPlaying) {
      const snapshot = this.stepBackward();
      if (!snapshot) break;

      if (this.isBreakpointHit(snapshot)) {
        this.isPlaying = false;
        return snapshot;
      }

      await this.delay(100 / this.playbackSpeed);
    }

    this.isPlaying = false;
    return this.getCurrentSnapshot();
  }

  /**
   * Step over (forward)
   */
  stepOverForward(): ExecutionSnapshot | null {
    if (!this.session) return null;

    const currentSnapshot = this.getCurrentSnapshot();
    if (!currentSnapshot) return null;

    const currentStackDepth = currentSnapshot.callStack.length;
    let index = this.currentIndex + 1;

    while (index < this.session.snapshots.length) {
      const snapshot = this.session.snapshots[index];
      if (snapshot.callStack.length <= currentStackDepth) {
        this.currentIndex = index;
        this.session.currentPosition = index;
        return snapshot;
      }
      index++;
    }

    return null;
  }

  /**
   * Step over (backward)
   */
  stepOverBackward(): ExecutionSnapshot | null {
    if (!this.session) return null;

    const currentSnapshot = this.getCurrentSnapshot();
    if (!currentSnapshot) return null;

    const currentStackDepth = currentSnapshot.callStack.length;
    let index = this.currentIndex - 1;

    while (index >= 0) {
      const snapshot = this.session.snapshots[index];
      if (snapshot.callStack.length <= currentStackDepth) {
        this.currentIndex = index;
        this.session.currentPosition = index;
        return snapshot;
      }
      index--;
    }

    return null;
  }

  /**
   * Step into (forward)
   */
  stepIntoForward(): ExecutionSnapshot | null {
    return this.stepForward();
  }

  /**
   * Step into (backward)
   */
  stepIntoBackward(): ExecutionSnapshot | null {
    return this.stepBackward();
  }

  /**
   * Step out (forward) - run until function returns
   */
  stepOutForward(): ExecutionSnapshot | null {
    if (!this.session) return null;

    const currentSnapshot = this.getCurrentSnapshot();
    if (!currentSnapshot) return null;

    const currentStackDepth = currentSnapshot.callStack.length;
    let index = this.currentIndex + 1;

    while (index < this.session.snapshots.length) {
      const snapshot = this.session.snapshots[index];
      if (snapshot.callStack.length < currentStackDepth) {
        this.currentIndex = index;
        this.session.currentPosition = index;
        return snapshot;
      }
      index++;
    }

    return null;
  }

  /**
   * Step out (backward) - go to function entry
   */
  stepOutBackward(): ExecutionSnapshot | null {
    if (!this.session) return null;

    const currentSnapshot = this.getCurrentSnapshot();
    if (!currentSnapshot) return null;

    const currentStackDepth = currentSnapshot.callStack.length;
    let index = this.currentIndex - 1;

    while (index >= 0) {
      const snapshot = this.session.snapshots[index];
      if (snapshot.callStack.length < currentStackDepth && 
          snapshot.eventType === 'function_call') {
        this.currentIndex = index;
        this.session.currentPosition = index;
        return snapshot;
      }
      index--;
    }

    return null;
  }

  /**
   * Set time travel breakpoint
   */
  setBreakpoint(location: SourceLocation, condition?: string): TimeTravelBreakpoint {
    if (!this.session) {
      throw new Error('No session loaded');
    }

    const bp: TimeTravelBreakpoint = {
      id: `bp-${Date.now()}`,
      location,
      condition,
      hitCount: 0,
      enabled: true,
      hitTimestamps: [],
    };

    this.session.breakpoints.set(bp.id, bp);
    return bp;
  }

  /**
   * Remove breakpoint
   */
  removeBreakpoint(id: string): void {
    this.session?.breakpoints.delete(id);
  }

  /**
   * Toggle breakpoint
   */
  toggleBreakpoint(id: string): void {
    const bp = this.session?.breakpoints.get(id);
    if (bp) {
      bp.enabled = !bp.enabled;
    }
  }

  /**
   * Set playback speed (0.1 to 10)
   */
  setPlaybackSpeed(speed: number): void {
    this.playbackSpeed = Math.max(0.1, Math.min(10, speed));
  }

  /**
   * Stop playback
   */
  stop(): void {
    this.isPlaying = false;
  }

  /**
   * Pause playback
   */
  pause(): void {
    this.isPlaying = false;
    if (this.session) {
      this.session.status = 'paused';
    }
  }

  /**
   * Get timeline of events
   */
  getTimeline(): TimelineEvent[] {
    if (!this.session) return [];

    return this.session.snapshots.map((snapshot, index) => ({
      sequenceNumber: snapshot.sequenceNumber,
      timestamp: snapshot.timestamp,
      eventType: snapshot.eventType,
      location: snapshot.location,
      isBreakpoint: this.session!.breakpoints.size > 0 && this.isBreakpointHit(snapshot),
      index,
    }));
  }

  /**
   * Get memory state at current position
   */
  getMemoryState(): MemoryState | null {
    const snapshot = this.getCurrentSnapshot();
    return snapshot?.memory || null;
  }

  /**
   * Get call stack at current position
   */
  getCallStack(): CallFrame[] {
    const snapshot = this.getCurrentSnapshot();
    return snapshot?.callStack || [];
  }

  /**
   * Find when a variable was last modified
   */
  findVariableHistory(variableName: string): VariableChange[] {
    if (!this.session) return [];

    const changes: VariableChange[] = [];

    for (const snapshot of this.session.snapshots) {
      for (const frame of snapshot.callStack) {
        const local = frame.locals.get(variableName);
        if (local) {
          changes.push({
            sequenceNumber: snapshot.sequenceNumber,
            timestamp: snapshot.timestamp,
            value: local,
            location: snapshot.location,
            frameName: frame.name,
          });
        }
      }
    }

    return changes;
  }

  /**
   * Find when an object was modified
   */
  findObjectHistory(objectId: string): ObjectChange[] {
    if (!this.session) return [];

    const changes: ObjectChange[] = [];

    for (const snapshot of this.session.snapshots) {
      const obj = snapshot.memory.heap.get(objectId);
      if (obj) {
        changes.push({
          sequenceNumber: snapshot.sequenceNumber,
          timestamp: snapshot.timestamp,
          object: obj,
          eventType: snapshot.eventType,
        });
      }
    }

    return changes;
  }

  /**
   * Check if current position hits a breakpoint
   */
  private isBreakpointHit(snapshot: ExecutionSnapshot): boolean {
    if (!this.session) return false;

    for (const bp of this.session.breakpoints.values()) {
      if (!bp.enabled || !bp.location) continue;

      if (bp.location.file === snapshot.location.file &&
          bp.location.line === snapshot.location.line) {
        return true;
      }
    }

    return false;
  }

  /**
   * Async delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================================
// AUXILIARY TYPES
// ============================================================================

export interface TimelineEvent {
  sequenceNumber: number;
  timestamp: number;
  eventType: ExecutionEventType;
  location: SourceLocation;
  isBreakpoint: boolean;
  index: number;
}

export interface VariableChange {
  sequenceNumber: number;
  timestamp: number;
  value: RuntimeValue;
  location: SourceLocation;
  frameName: string;
}

export interface ObjectChange {
  sequenceNumber: number;
  timestamp: number;
  object: HeapObject;
  eventType: ExecutionEventType;
}

// ============================================================================
// SNAPSHOT DEBUGGING (Production Debugging)
// ============================================================================

export class SnapshotDebugger {
  private snapshots: Map<string, ProductionSnapshot> = new Map();

  /**
   * Capture a production snapshot
   */
  captureSnapshot(
    name: string,
    callStack: CallFrame[],
    memory: MemoryState,
    metadata?: Record<string, unknown>
  ): ProductionSnapshot {
    const snapshot: ProductionSnapshot = {
      id: `prod-snap-${Date.now()}`,
      name,
      capturedAt: new Date(),
      callStack: callStack.map(frame => ({
        ...frame,
        locals: new Map(frame.locals),
        arguments: new Map(frame.arguments),
      })),
      memory: {
        heap: new Map(memory.heap),
        globals: new Map(memory.globals),
        allocationCount: memory.allocationCount,
        deallocationCount: memory.deallocationCount,
      },
      metadata,
    };

    this.snapshots.set(snapshot.id, snapshot);
    return snapshot;
  }

  /**
   * Load a production snapshot for analysis
   */
  loadSnapshot(id: string): ProductionSnapshot | null {
    return this.snapshots.get(id) || null;
  }

  /**
   * Compare two snapshots
   */
  compareSnapshots(id1: string, id2: string): SnapshotDiff {
    const snap1 = this.snapshots.get(id1);
    const snap2 = this.snapshots.get(id2);

    if (!snap1 || !snap2) {
      throw new Error('One or both snapshots not found');
    }

    const addedObjects: string[] = [];
    const removedObjects: string[] = [];
    const modifiedObjects: string[] = [];

    for (const [id, obj] of snap2.memory.heap) {
      if (!snap1.memory.heap.has(id)) {
        addedObjects.push(id);
      } else {
        const oldObj = snap1.memory.heap.get(id)!;
        if (JSON.stringify(Array.from(obj.fields)) !== JSON.stringify(Array.from(oldObj.fields))) {
          modifiedObjects.push(id);
        }
      }
    }

    for (const [id] of snap1.memory.heap) {
      if (!snap2.memory.heap.has(id)) {
        removedObjects.push(id);
      }
    }

    return {
      snapshot1: snap1,
      snapshot2: snap2,
      addedObjects,
      removedObjects,
      modifiedObjects,
      callStackDiff: {
        addedFrames: snap2.callStack.length - snap1.callStack.length,
      },
    };
  }

  /**
   * List all snapshots
   */
  listSnapshots(): ProductionSnapshot[] {
    return Array.from(this.snapshots.values());
  }

  /**
   * Delete a snapshot
   */
  deleteSnapshot(id: string): boolean {
    return this.snapshots.delete(id);
  }

  /**
   * Export snapshot for transfer
   */
  exportSnapshot(id: string): string {
    const snapshot = this.snapshots.get(id);
    if (!snapshot) throw new Error('Snapshot not found');

    return JSON.stringify({
      ...snapshot,
      callStack: snapshot.callStack.map(f => ({
        ...f,
        locals: Array.from(f.locals),
        arguments: Array.from(f.arguments),
      })),
      memory: {
        ...snapshot.memory,
        heap: Array.from(snapshot.memory.heap.entries()).map(([k, v]) => [
          k,
          { ...v, fields: Array.from(v.fields) },
        ]),
        globals: Array.from(snapshot.memory.globals),
      },
    });
  }

  /**
   * Import a snapshot
   */
  importSnapshot(json: string): ProductionSnapshot {
    const data = JSON.parse(json);

    const snapshot: ProductionSnapshot = {
      ...data,
      capturedAt: new Date(data.capturedAt),
      callStack: data.callStack.map((f: CallFrame) => ({
        ...f,
        locals: new Map(f.locals),
        arguments: new Map(f.arguments),
      })),
      memory: {
        heap: new Map(data.memory.heap.map(([k, v]: [string, HeapObject]) => [
          k,
          { ...v, fields: new Map(v.fields) },
        ])),
        globals: new Map(data.memory.globals),
        allocationCount: data.memory.allocationCount,
        deallocationCount: data.memory.deallocationCount,
      },
    };

    this.snapshots.set(snapshot.id, snapshot);
    return snapshot;
  }
}

export interface ProductionSnapshot {
  id: string;
  name: string;
  capturedAt: Date;
  callStack: CallFrame[];
  memory: MemoryState;
  metadata?: Record<string, unknown>;
}

export interface SnapshotDiff {
  snapshot1: ProductionSnapshot;
  snapshot2: ProductionSnapshot;
  addedObjects: string[];
  removedObjects: string[];
  modifiedObjects: string[];
  callStackDiff: {
    addedFrames: number;
  };
}

// Export singletons
export const executionRecorder = new ExecutionRecorder();
export const timeTravelReplayer = new TimeTravelReplayer();
export const snapshotDebugger = new SnapshotDebugger();
