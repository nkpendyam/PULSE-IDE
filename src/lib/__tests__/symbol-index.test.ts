/**
 * Tests for Symbol Index
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SymbolIndex } from '../indexing/symbol-index';

describe('SymbolIndex', () => {
  let symbolIndex: SymbolIndex;

  beforeEach(() => {
    symbolIndex = new SymbolIndex();
  });

  it('should add symbols correctly', () => {
    const symbol = {
      id: 'test-func-1',
      name: 'testFunction',
      kind: 'function' as const,
      path: '/test/file.ts',
      line: 10,
      endLine: 20,
      language: 'typescript'
    };

    symbolIndex.addSymbol(symbol);
    const results = symbolIndex.searchByName('testFunction');

    expect(results.length).toBe(1);
    expect(results[0].name).toBe('testFunction');
  });

  it('should search symbols by query', () => {
    symbolIndex.addSymbol({
      id: 'func-1',
      name: 'getUserData',
      kind: 'function',
      path: '/api/user.ts',
      line: 5,
      endLine: 15,
      language: 'typescript'
    });

    symbolIndex.addSymbol({
      id: 'func-2',
      name: 'getUserProfile',
      kind: 'function',
      path: '/api/profile.ts',
      line: 3,
      endLine: 12,
      language: 'typescript'
    });

    const results = symbolIndex.search({ query: 'getUser', limit: 10 });

    expect(results.length).toBe(2);
  });

  it('should get symbols by path', () => {
    symbolIndex.addSymbol({
      id: 's1',
      name: 'funcA',
      kind: 'function',
      path: '/src/utils.ts',
      line: 1,
      endLine: 5,
      language: 'typescript'
    });

    symbolIndex.addSymbol({
      id: 's2',
      name: 'funcB',
      kind: 'function',
      path: '/src/other.ts',
      line: 1,
      endLine: 5,
      language: 'typescript'
    });

    const symbols = symbolIndex.getSymbolsByPath('/src/utils.ts');

    expect(symbols.length).toBe(1);
    expect(symbols[0].name).toBe('funcA');
  });

  it('should clear all symbols', () => {
    symbolIndex.addSymbol({
      id: 's1',
      name: 'test',
      kind: 'function',
      path: '/test.ts',
      line: 1,
      endLine: 5,
      language: 'typescript'
    });

    symbolIndex.clear();
    const stats = symbolIndex.getStats();

    expect(stats.totalSymbols).toBe(0);
  });
});
