// Kyro Kernel State Machine
// Manages the runtime lifecycle states and transitions

import type { KernelState, KernelTransition, SystemState } from '@/types/pulse';

export interface StateTransitionResult {
  success: boolean;
  previousState: KernelState;
  newState: KernelState;
  timestamp: Date;
  error?: string;
}

// Valid state transitions
const VALID_TRANSITIONS: Record<KernelState, KernelState[]> = {
  init: ['active', 'shutdown'],
  active: ['paused', 'shutdown'],
  paused: ['active', 'shutdown'],
  shutdown: ['init'], // Allow restart from shutdown
};

export class StateMachine {
  private currentState: KernelState = 'init';
  private stateHistory: Array<{ state: KernelState; timestamp: Date; reason?: string }> = [];
  private listeners: Array<(state: KernelState, previous: KernelState) => void> = [];

  constructor(initialState: KernelState = 'init') {
    this.currentState = initialState;
    this.recordState(initialState);
  }

  getState(): KernelState {
    return this.currentState;
  }

  canTransitionTo(targetState: KernelState): boolean {
    const allowedTransitions = VALID_TRANSITIONS[this.currentState];
    return allowedTransitions.includes(targetState);
  }

  transition(targetState: KernelState, reason?: string): StateTransitionResult {
    const previousState = this.currentState;

    if (!this.canTransitionTo(targetState)) {
      return {
        success: false,
        previousState,
        newState: previousState,
        timestamp: new Date(),
        error: `Invalid transition from ${previousState} to ${targetState}`,
      };
    }

    this.currentState = targetState;
    this.recordState(targetState, reason);
    this.notifyListeners(targetState, previousState);

    return {
      success: true,
      previousState,
      newState: targetState,
      timestamp: new Date(),
    };
  }

  private recordState(state: KernelState, reason?: string): void {
    this.stateHistory.push({
      state,
      timestamp: new Date(),
      reason,
    });

    // Keep only last 100 state changes
    if (this.stateHistory.length > 100) {
      this.stateHistory = this.stateHistory.slice(-100);
    }
  }

  private notifyListeners(newState: KernelState, previousState: KernelState): void {
    for (const listener of this.listeners) {
      try {
        listener(newState, previousState);
      } catch (error) {
        console.error('State machine listener error:', error);
      }
    }
  }

  subscribe(listener: (state: KernelState, previous: KernelState) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  getHistory(): Array<{ state: KernelState; timestamp: Date; reason?: string }> {
    return [...this.stateHistory];
  }

  toSystemState(base: Partial<SystemState>): SystemState {
    return {
      ...base,
      kernelState: this.currentState,
    } as SystemState;
  }
}

// Singleton instance
let stateMachineInstance: StateMachine | null = null;

export function getStateMachine(): StateMachine {
  if (!stateMachineInstance) {
    stateMachineInstance = new StateMachine();
  }
  return stateMachineInstance;
}

export function resetStateMachine(): void {
  stateMachineInstance = null;
}
