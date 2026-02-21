# Kyro IDE API Documentation

This document provides comprehensive API documentation for Kyro IDE.

## Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [Endpoints](#endpoints)
  - [IDE API](#ide-api)
  - [Git API](#git-api)
  - [Debug API](#debug-api)
- [WebSocket Events](#websocket-events)
- [Error Handling](#error-handling)
- [Rate Limits](#rate-limits)

---

## Overview

Kyro IDE exposes RESTful API endpoints for all IDE operations. The API is designed to be used both internally by the IDE components and externally for integrations.

**Base URL:** `/api`

**Content Type:** `application/json`

---

## Authentication

Most endpoints are available without authentication. For cloud AI models, the API uses the configured API keys (set via environment variables).

### Environment Variables

```bash
# AI Provider Keys (optional for local models)
ANTHROPIC_API_KEY=your_key
OPENAI_API_KEY=your_key

# Ollama Configuration
OLLAMA_HOST=http://localhost:11434
```

---

## Endpoints

### IDE API

#### GET /api/ide

Get available models and IDE status.

**Response:**
```json
{
  "models": [
    {
      "id": "claude-3-sonnet",
      "name": "Claude 3.5 Sonnet",
      "provider": "anthropic",
      "isLocal": false,
      "contextLength": 200000
    }
  ],
  "agents": [
    {
      "id": "agent-coder-1",
      "name": "Coder",
      "role": "coder",
      "status": "idle"
    }
  ],
  "status": {
    "ollama": {
      "running": true,
      "models": ["llama3.2", "codellama"]
    }
  }
}
```

#### POST /api/ide

Execute AI operations.

**Request Body:**
```json
{
  "action": "chat" | "complete" | "search",
  "model": "claude-3-sonnet",
  "messages": [
    { "role": "user", "content": "Explain this code" }
  ],
  "options": {
    "temperature": 0.7,
    "maxTokens": 4096,
    "systemPrompt": "You are a helpful coding assistant."
  }
}
```

**Response:**
```json
{
  "id": "chat-123",
  "content": "This code implements...",
  "model": "claude-3-sonnet",
  "usage": {
    "promptTokens": 150,
    "completionTokens": 300,
    "totalTokens": 450
  }
}
```

### Chat Action

```typescript
// POST /api/ide
const response = await fetch('/api/ide', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'chat',
    model: 'claude-3-sonnet',
    messages: [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'Hello!' }
    ]
  })
});
```

### Complete Action (Code Completion)

```typescript
// POST /api/ide
const response = await fetch('/api/ide', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'complete',
    language: 'typescript',
    code: 'function greet(name: string) {',
    cursorPosition: 32,
    context: '// File: utils.ts\n...'
  })
});
```

**Response:**
```json
{
  "completion": "  return `Hello, ${name}!`;\n}",
  "model": "claude-3-sonnet"
}
```

### Search Action (Semantic Code Search)

```typescript
// POST /api/ide
const response = await fetch('/api/ide', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'search',
    query: 'authentication logic',
    limit: 10
  })
});
```

**Response:**
```json
{
  "results": [
    {
      "id": "doc-1",
      "content": "export async function authenticate(token: string) {...}",
      "path": "/src/auth.ts",
      "lineStart": 15,
      "lineEnd": 45,
      "score": 0.92
    }
  ]
}
```

---

### Git API

#### POST /api/git

Execute Git operations.

**Request Body:**
```json
{
  "action": "status" | "commit" | "push" | "pull" | "branch" | "diff" | "log",
  "path": "/path/to/repo",
  "options": {
    "message": "feat: Add new feature",
    "branch": "feature/new-feature"
  }
}
```

### Status Action

```typescript
const response = await fetch('/api/git', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'status',
    path: '/home/user/project'
  })
});
```

**Response:**
```json
{
  "branch": "main",
  "ahead": 2,
  "behind": 0,
  "staged": ["src/file1.ts"],
  "modified": ["src/file2.ts"],
  "untracked": ["src/new.ts"],
  "conflicted": []
}
```

### Commit Action

```typescript
const response = await fetch('/api/git', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'commit',
    path: '/home/user/project',
    options: {
      message: 'feat: Add authentication',
      files: ['src/auth.ts', 'src/middleware.ts']
    }
  })
});
```

**Response:**
```json
{
  "success": true,
  "commit": {
    "hash": "abc123def456",
    "message": "feat: Add authentication",
    "author": "Developer <dev@example.com>",
    "date": "2025-02-21T12:00:00Z"
  }
}
```

### Diff Action

```typescript
const response = await fetch('/api/git', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'diff',
    path: '/home/user/project',
    options: {
      file: 'src/auth.ts',
      staged: true
    }
  })
});
```

**Response:**
```json
{
  "diff": "@@ -1,5 +1,10 @@\n import { verify } from './jwt';\n+\n+export async function authenticate(token: string) {\n+  return verify(token);\n+}",
  "stats": {
    "additions": 5,
    "deletions": 0,
    "files": 1
  }
}
```

---

### Debug API

#### POST /api/debug

Execute debugging operations.

**Request Body:**
```json
{
  "action": "start" | "stop" | "step" | "continue" | "pause" | "evaluate",
  "sessionId": "debug-session-123",
  "config": {
    "type": "node" | "python" | "go",
    "program": "/path/to/program",
    "args": ["--port", "3000"],
    "env": { "NODE_ENV": "development" }
  }
}
```

### Start Debug Session

```typescript
const response = await fetch('/api/debug', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'start',
    config: {
      type: 'node',
      program: '/home/user/project/src/index.ts',
      args: [],
      breakpoints: [
        { path: '/home/user/project/src/index.ts', line: 15 }
      ]
    }
  })
});
```

**Response:**
```json
{
  "sessionId": "debug-session-123",
  "status": "running",
  "threads": [
    { "id": 1, "name": "main", "state": "running" }
  ]
}
```

### Step Actions

```typescript
// Step over
await fetch('/api/debug', {
  method: 'POST',
  body: JSON.stringify({
    action: 'step',
    sessionId: 'debug-session-123',
    stepType: 'over' // 'into' | 'out' | 'over'
  })
});

// Continue
await fetch('/api/debug', {
  method: 'POST',
  body: JSON.stringify({
    action: 'continue',
    sessionId: 'debug-session-123'
  })
});
```

### Evaluate Expression

```typescript
const response = await fetch('/api/debug', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'evaluate',
    sessionId: 'debug-session-123',
    expression: 'user.name',
    frameId: 1
  })
});
```

**Response:**
```json
{
  "result": "\"John Doe\"",
  "type": "string",
  "variablesReference": 0
}
```

---

## WebSocket Events

Connect to `/api/collab` for real-time collaboration events.

### Connection

```typescript
const ws = new WebSocket('/api/collab?room=my-project');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Event:', data.type, data.payload);
};
```

### Event Types

| Event | Description | Payload |
|-------|-------------|---------|
| `cursor:move` | User moved cursor | `{ userId, path, line, column }` |
| `cursor:selection` | User made selection | `{ userId, path, range }` |
| `file:change` | File content changed | `{ path, delta }` |
| `file:open` | User opened file | `{ userId, path }` |
| `file:close` | User closed file | `{ userId, path }` |
| `user:join` | User joined room | `{ userId, name }` |
| `user:leave` | User left room | `{ userId }` |
| `presence:update` | User presence update | `{ userId, status }` |

### Example Events

```json
// Cursor movement
{
  "type": "cursor:move",
  "payload": {
    "userId": "user-123",
    "path": "/src/index.ts",
    "line": 42,
    "column": 15
  }
}

// File change (CRDT delta)
{
  "type": "file:change",
  "payload": {
    "path": "/src/index.ts",
    "delta": {
      "pos": 150,
      "insert": "console.log('hello');",
      "delete": 0
    }
  }
}

// User presence
{
  "type": "presence:update",
  "payload": {
    "userId": "user-123",
    "name": "Developer",
    "color": "#FF5733",
    "status": "coding",
    "currentFile": "/src/index.ts"
  }
}
```

---

## Error Handling

All errors follow a consistent format:

```json
{
  "error": {
    "code": "MODEL_NOT_FOUND",
    "message": "Model 'unknown-model' not found",
    "details": {
      "availableModels": ["claude-3-sonnet", "claude-3-haiku"]
    }
  }
}
```

### Error Codes

| Code | Description |
|------|-------------|
| `MODEL_NOT_FOUND` | Requested model doesn't exist |
| `MODEL_UNAVAILABLE` | Model exists but is not available (e.g., Ollama offline) |
| `INVALID_REQUEST` | Request body validation failed |
| `RATE_LIMITED` | Too many requests |
| `AUTHENTICATION_REQUIRED` | API key required for this operation |
| `INTERNAL_ERROR` | Server-side error |

---

## Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/api/ide` (chat) | 100 requests | 1 minute |
| `/api/ide` (complete) | 500 requests | 1 minute |
| `/api/git` | 200 requests | 1 minute |
| `/api/debug` | 100 requests | 1 minute |

Rate limit headers are included in responses:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1708521600
```

---

## TypeScript Types

```typescript
// Install types
// npm install @kyro-ide/types

import type {
  AIModel,
  AIResponse,
  ChatMessage,
  GitStatus,
  DebugSession,
  SearchResult
} from '@kyro-ide/types';
```

---

## SDK Usage

```typescript
import { KyroClient } from '@kyro-ide/sdk';

const client = new KyroClient();

// Chat
const response = await client.chat({
  messages: [{ role: 'user', content: 'Hello!' }],
  model: 'claude-3-sonnet'
});

// Code completion
const completion = await client.complete({
  code: 'function add(a, b) {',
  language: 'typescript'
});

// Semantic search
const results = await client.search({
  query: 'authentication logic',
  limit: 10
});
```

---

## Support

- **GitHub Issues:** https://github.com/nkpendyam/Kyro_IDE/issues
- **Discussions:** https://github.com/nkpendyam/Kyro_IDE/discussions
- **Discord:** Coming soon

---

*Last updated: February 2025*
