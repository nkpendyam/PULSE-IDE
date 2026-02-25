/**
 * Test Setup File
 * 
 * Configures the testing environment for KRO IDE frontend tests
 */

import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock Tauri APIs
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
  emit: vi.fn(),
}));

vi.mock('@tauri-apps/api/window', () => ({
  appWindow: {
    minimize: vi.fn(),
    toggleMaximize: vi.fn(),
    close: vi.fn(),
  },
}));

vi.mock('@tauri-apps/api/dialog', () => ({
  open: vi.fn(),
  save: vi.fn(),
  message: vi.fn(),
  ask: vi.fn(),
  confirm: vi.fn(),
}));

vi.mock('@tauri-apps/api/fs', () => ({
  readTextFile: vi.fn(),
  writeTextFile: vi.fn(),
  readDir: vi.fn(),
  createDir: vi.fn(),
  removeDir: vi.fn(),
  removeFile: vi.fn(),
  exists: vi.fn(),
}));

vi.mock('@tauri-apps/api/shell', () => ({
  Command: vi.fn().mockImplementation(() => ({
    execute: vi.fn(),
    spawn: vi.fn(),
  })),
}));

// Clean up after each test
afterEach(() => {
  vi.clearAllMocks();
});
