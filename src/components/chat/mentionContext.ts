import type { ChatMessage, FileNode, GitStatus, OpenFile } from '@/store/kyroStore';

export type MentionType = 'file' | 'folder' | 'codebase' | 'terminal' | 'web' | 'git' | 'previous';

export interface ParsedMention {
  type: MentionType;
  value: string;
  raw: string;
}

export function parseMentions(text: string): { cleanText: string; mentions: ParsedMention[] } {
  const mentionRegex = /(^|\s)@(file|folder|codebase|terminal|web|git|previous)(?::([^\s]+)|\(([^)]+)\))?/g;
  const mentions: ParsedMention[] = [];

  const cleanText = text.replace(mentionRegex, (full, prefix, type, colonValue, parenValue) => {
    const value = (colonValue || parenValue || '').trim();
    const normalizedType = type as MentionType;
    const raw = full.trimStart();
    mentions.push({ type: normalizedType, value, raw });

    const rendered = value ? `[${normalizedType}: ${value}]` : `[${normalizedType}]`;
    return `${prefix}${rendered}`;
  });

  return { cleanText, mentions };
}

export function buildMentionContext(params: {
  mentions: ParsedMention[];
  openFiles: OpenFile[];
  currentFile: OpenFile | null;
  fileTree: FileNode | null;
  terminalOutput: string;
  gitStatus: GitStatus | null;
  chatMessages: ChatMessage[];
  projectPath: string | null;
}): string[] {
  const {
    mentions,
    openFiles,
    currentFile,
    fileTree,
    terminalOutput,
    gitStatus,
    chatMessages,
    projectPath,
  } = params;

  const contexts: string[] = [];
  const unique = new Set<string>();

  for (const mention of mentions) {
    const key = `${mention.type}:${mention.value}`;
    if (unique.has(key)) {
      continue;
    }
    unique.add(key);

    if (mention.type === 'file') {
      contexts.push(buildFileContext(mention.value, openFiles, currentFile));
      continue;
    }

    if (mention.type === 'folder') {
      contexts.push(buildFolderContext(mention.value, fileTree));
      continue;
    }

    if (mention.type === 'codebase') {
      contexts.push(buildCodebaseContext(projectPath, openFiles, fileTree));
      continue;
    }

    if (mention.type === 'terminal') {
      contexts.push(buildTerminalContext(terminalOutput));
      continue;
    }

    if (mention.type === 'git') {
      contexts.push(buildGitContext(gitStatus));
      continue;
    }

    if (mention.type === 'previous') {
      contexts.push(buildPreviousContext(chatMessages));
      continue;
    }

    if (mention.type === 'web') {
      contexts.push('[WEB]\nWeb context is not available in local RAG mode.');
    }
  }

  return contexts;
}

function buildFileContext(value: string, openFiles: OpenFile[], currentFile: OpenFile | null): string {
  const requestedPath = value.trim();
  if (!requestedPath) {
    if (!currentFile) {
      return '[FILE]\nNo active file is available.';
    }

    return [
      `[FILE: ${currentFile.path}]`,
      currentFile.content,
    ].join('\n');
  }

  const matchedOpenFile = openFiles.find((file) => file.path === requestedPath);
  if (!matchedOpenFile) {
    return `[FILE: ${requestedPath}]\nFile is not currently open, so file content could not be attached.`;
  }

  return [
    `[FILE: ${matchedOpenFile.path}]`,
    matchedOpenFile.content,
  ].join('\n');
}

function buildFolderContext(value: string, fileTree: FileNode | null): string {
  const folderPath = value.trim();
  if (!fileTree) {
    return '[FOLDER]\nFile tree is unavailable.';
  }

  if (!folderPath) {
    const rootChildren = fileTree.children?.slice(0, 20).map((child) => child.path) ?? [];
    return `[FOLDER: root]\n${rootChildren.join('\n') || 'No entries available.'}`;
  }

  const entries = collectPathsByPrefix(fileTree, folderPath).slice(0, 40);
  if (entries.length === 0) {
    return `[FOLDER: ${folderPath}]\nNo matching files or directories found.`;
  }

  return `[FOLDER: ${folderPath}]\n${entries.join('\n')}`;
}

function collectPathsByPrefix(node: FileNode, prefix: string): string[] {
  const results: string[] = [];
  const stack: FileNode[] = [node];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }

    if (current.path === prefix || current.path.startsWith(`${prefix}/`) || current.path.startsWith(`${prefix}\\`)) {
      results.push(current.path);
    }

    if (current.children) {
      for (const child of current.children) {
        stack.push(child);
      }
    }
  }

  return results.sort();
}

function buildCodebaseContext(projectPath: string | null, openFiles: OpenFile[], fileTree: FileNode | null): string {
  const totalNodes = fileTree ? countNodes(fileTree) : 0;
  const openPaths = openFiles.slice(0, 15).map((file) => file.path);

  return [
    '[CODEBASE]',
    `Project path: ${projectPath || 'Unknown'}`,
    `Open files: ${openFiles.length}`,
    `Indexed files/directories: ${totalNodes}`,
    openPaths.length > 0 ? `Open file list:\n${openPaths.join('\n')}` : 'Open file list: none',
  ].join('\n');
}

function countNodes(node: FileNode): number {
  let total = 1;
  if (node.children) {
    for (const child of node.children) {
      total += countNodes(child);
    }
  }
  return total;
}

function buildTerminalContext(terminalOutput: string): string {
  if (!terminalOutput.trim()) {
    return '[TERMINAL]\nTerminal output is empty.';
  }

  const trimmed = terminalOutput.length > 3000
    ? terminalOutput.slice(terminalOutput.length - 3000)
    : terminalOutput;

  return `[TERMINAL]\n${trimmed}`;
}

function buildGitContext(gitStatus: GitStatus | null): string {
  if (!gitStatus) {
    return '[GIT]\nGit status is unavailable.';
  }

  const staged = gitStatus.staged.map((entry) => `${entry.status} ${entry.path}`);
  const unstaged = gitStatus.unstaged.map((entry) => `${entry.status} ${entry.path}`);
  const untracked = gitStatus.untracked.map((entry) => `?? ${entry}`);

  return [
    `[GIT: ${gitStatus.branch}]`,
    `Ahead: ${gitStatus.ahead}, Behind: ${gitStatus.behind}`,
    staged.length > 0 ? `Staged:\n${staged.slice(0, 20).join('\n')}` : 'Staged: none',
    unstaged.length > 0 ? `Unstaged:\n${unstaged.slice(0, 20).join('\n')}` : 'Unstaged: none',
    untracked.length > 0 ? `Untracked:\n${untracked.slice(0, 20).join('\n')}` : 'Untracked: none',
  ].join('\n');
}

function buildPreviousContext(chatMessages: ChatMessage[]): string {
  const previous = chatMessages
    .slice(-6)
    .map((message) => `${message.role.toUpperCase()}: ${truncateLine(message.content, 300)}`);

  if (previous.length === 0) {
    return '[PREVIOUS]\nNo previous messages available.';
  }

  return `[PREVIOUS]\n${previous.join('\n')}`;
}

function truncateLine(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength)}...`;
}