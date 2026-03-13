import { describe, expect, it } from 'vitest';
import { buildMentionContext, parseMentions } from '../../../src/components/chat/mentionContext';

describe('mentionContext', () => {
  it('parses mentions with colon and paren formats', () => {
    const result = parseMentions('Review @file:src/app/page.tsx and @folder(src/components) with @git');

    expect(result.mentions).toEqual([
      { type: 'file', value: 'src/app/page.tsx', raw: '@file:src/app/page.tsx' },
      { type: 'folder', value: 'src/components', raw: '@folder(src/components)' },
      { type: 'git', value: '', raw: '@git' },
    ]);
    expect(result.cleanText).toContain('[file: src/app/page.tsx]');
    expect(result.cleanText).toContain('[folder: src/components]');
    expect(result.cleanText).toContain('[git]');
  });

  it('builds file and terminal mention context', () => {
    const context = buildMentionContext({
      mentions: [
        { type: 'file', value: 'src/main.ts', raw: '@file:src/main.ts' },
        { type: 'terminal', value: '', raw: '@terminal' },
      ],
      openFiles: [
        { path: 'src/main.ts', content: 'console.log("hi")', language: 'typescript', isDirty: false },
      ],
      currentFile: null,
      fileTree: null,
      terminalOutput: 'build succeeded',
      gitStatus: null,
      chatMessages: [],
      projectPath: 'C:/repo',
    });

    expect(context).toHaveLength(2);
    expect(context[0]).toContain('[FILE: src/main.ts]');
    expect(context[0]).toContain('console.log("hi")');
    expect(context[1]).toContain('[TERMINAL]');
    expect(context[1]).toContain('build succeeded');
  });

  it('builds previous conversation context', () => {
    const context = buildMentionContext({
      mentions: [{ type: 'previous', value: '', raw: '@previous' }],
      openFiles: [],
      currentFile: null,
      fileTree: null,
      terminalOutput: '',
      gitStatus: null,
      chatMessages: [
        { id: '1', role: 'user', content: 'hello', timestamp: new Date() },
        { id: '2', role: 'assistant', content: 'world', timestamp: new Date() },
      ],
      projectPath: null,
    });

    expect(context[0]).toContain('[PREVIOUS]');
    expect(context[0]).toContain('USER: hello');
    expect(context[0]).toContain('ASSISTANT: world');
  });
});