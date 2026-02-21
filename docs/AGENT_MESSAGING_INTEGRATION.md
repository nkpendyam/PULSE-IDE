# Kyro IDE - Agent & Messaging Integration Guide

## Overview

Kyro IDE now integrates with multiple AI agent frameworks and messaging platforms, enabling:

1. **Embedded PicoClaw** - Ultra-lightweight AI core (<10MB RAM)
2. **Multi-Platform Messaging** - Telegram, WhatsApp, Discord, Slack
3. **Agent Framework Hub** - Install and manage multiple AI agent frameworks

---

## 1. Embedded PicoClaw

### What is PicoClaw?

PicoClaw is an ultra-lightweight AI assistant that runs on just 10MB of RAM. It's now embedded into Kyro IDE as the `PicoCore` module.

### Features

- **Ultra-lightweight**: <10MB memory usage
- **Fast startup**: <1 second initialization
- **Streaming responses**: Real-time AI responses
- **Context management**: Session-based conversation memory
- **Multi-platform**: Ready for Telegram, Discord, WhatsApp

### API Usage

```typescript
// Initialize PicoCore
import { createPicoCore } from '@/lib/pulse/pico';

const pico = createPicoCore({
  model: 'llama3.2',
  maxTokens: 2048,
  temperature: 0.7,
  baseUrl: 'http://localhost:11434',
});

// Stream responses
for await (const chunk of pico.streamResponse('Hello!', 'conv-123')) {
  console.log(chunk);
}

// Get memory stats
const stats = pico.getMemoryStats();
console.log(`Memory: ${stats.used / 1024 / 1024}MB`);
```

---

## 2. Messaging Platform Integration

### Telegram Integration

1. **Create a Bot**
   - Open Telegram and search for `@BotFather`
   - Send `/newbot` and follow the instructions
   - Copy the bot token

2. **Get Chat ID**
   - Start a chat with your bot
   - Visit: `https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates`
   - Find your `chat.id` in the response

3. **Configure in Kyro IDE**
   - Open Messaging Panel
   - Click Settings on Telegram
   - Enter bot token and chat ID
   - Click Connect

### WhatsApp Integration

1. **Create WhatsApp Business Account**
   - Go to [Meta for Developers](https://developers.facebook.com/)
   - Create a new app
   - Add WhatsApp product
   - Get your Phone Number ID and Access Token

2. **Configure in Kyro IDE**
   - Open Messaging Panel
   - Click Settings on WhatsApp
   - Enter phone number and API key
   - Click Connect

### Discord Integration

1. **Create a Webhook**
   - Open your Discord server
   - Go to channel settings → Integrations → Webhooks
   - Create a new webhook
   - Copy the webhook URL

2. **Configure in Kyro IDE**
   - Open Messaging Panel
   - Click Settings on Discord
   - Enter webhook URL
   - Click Connect

### Slack Integration

1. **Create an Incoming Webhook**
   - Go to [Slack Apps](https://api.slack.com/apps)
   - Create a new app
   - Enable Incoming Webhooks
   - Add a new webhook to workspace
   - Copy the webhook URL

2. **Configure in Kyro IDE**
   - Open Messaging Panel
   - Click Settings on Slack
   - Enter webhook URL
   - Click Connect

---

## 3. Agent Framework Hub

### Available Frameworks

| Framework | Type | Memory | Description |
|-----------|------|--------|-------------|
| **PicoClaw** | Local | Session | Ultra-lightweight (<10MB) |
| **Letta (MemGPT)** | Hybrid | Archival | Stateful agents with persistent memory |
| **LangChain** | Hybrid | Persistent | Chain-based LLM applications |
| **AutoGPT** | Hybrid | Persistent | Autonomous task automation |
| **BabyAGI** | Hybrid | Persistent | Lightweight autonomous agent |
| **CrewAI** | Hybrid | Session | Multi-agent collaboration |
| **MetaGPT** | Hybrid | Persistent | Software development agents |
| **CAMEL** | Hybrid | Session | Role-playing multi-agent |
| **AgentGPT** | Cloud | Persistent | Web-based agent platform |
| **Open Interpreter** | Local | Session | Natural language code execution |

### Installing Frameworks

1. Open **Agent Hub** from the sidebar
2. Browse available frameworks
3. Click **Install** on desired framework
4. Configure framework settings
5. Create agent instances

### Creating Agent Instances

1. Click **New Agent** button
2. Enter agent name
3. Select installed framework
4. Click **Create**
5. Run tasks with your agent

---

## 4. Letta/MemGPT Integration

### What is Letta?

Letta (formerly MemGPT) provides stateful AI agents with persistent memory. Agents can remember and learn over time.

### Key Features

- **Core Memory**: Always-visible context
- **Archival Memory**: Long-term storage
- **Self-Editing Memory**: Agent updates its own memory
- **Multi-Agent**: Multiple specialized agents

### Integration

```typescript
// Coming soon: Letta API integration
import { LettaClient } from '@/lib/pulse/letta';

const letta = new LettaClient({
  apiKey: process.env.LETTA_API_KEY,
});

// Create agent with memory
const agent = await letta.createAgent({
  name: 'Code Assistant',
  memory: {
    core: 'I am a coding assistant...',
    archival: [],
  },
});

// Chat with memory
const response = await agent.chat('Remember I prefer TypeScript');
```

---

## 5. LangChain Integration

### What is LangChain?

LangChain is a framework for building LLM applications with chains, agents, and tools.

### Key Features

- **Chains**: Sequence of LLM calls
- **Agents**: Autonomous decision-making
- **Tools**: External integrations
- **Memory**: Context persistence
- **RAG**: Retrieval Augmented Generation

### Integration

```typescript
// Coming soon: LangChain integration
import { LangChainClient } from '@/lib/pulse/langchain';

const chain = new LangChainClient({
  model: 'llama3.2',
  memory: true,
});

// Execute chain
const result = await chain.run('Explain this code');
```

---

## 6. Multi-Agent Collaboration (CrewAI)

### What is CrewAI?

CrewAI enables multiple AI agents to work together as a team, each with specific roles.

### Key Features

- **Role-Based Agents**: Define agent roles
- **Task Delegation**: Agents assign tasks to each other
- **Collaboration**: Agents work together
- **Tools**: Shared tool access

### Example Team

```yaml
crew:
  - role: Architect
    goal: Design system architecture
    tools: [code_analysis, documentation]
  
  - role: Developer
    goal: Implement features
    tools: [code_editor, terminal, git]
  
  - role: Reviewer
    goal: Ensure code quality
    tools: [linter, test_runner]
```

---

## 7. API Reference

### Pico API (`/api/pico`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/pico` | GET | Health check & memory stats |
| `/api/pico` | POST | Chat, agent execution, context management |

**Actions:**
- `chat` - Streaming chat response
- `agent` - Execute agent task
- `context` - Get conversation context
- `memory` - Get memory statistics
- `clear` - Clear all contexts

### Messaging API (`/api/messaging`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/messaging` | GET | Get connection status |
| `/api/messaging` | POST | Send messages, connect platforms |

**Actions:**
- `send` - Send message to platform
- `connect` - Connect and verify credentials
- `disconnect` - Disconnect platform
- `webhook` - Handle incoming webhooks

---

## 8. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Kyro IDE                               │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ Agent Hub   │  │ Messaging   │  │ PicoCore Engine     │  │
│  │             │  │ Panel       │  │                     │  │
│  │ - PicoClaw  │  │             │  │ ┌─────────────────┐ │  │
│  │ - Letta     │  │ - Telegram  │  │ │ Agent Runtime   │ │  │
│  │ - LangChain │  │ - WhatsApp  │  │ │ Context Manager │ │  │
│  │ - AutoGPT   │  │ - Discord   │  │ │ Memory Monitor  │ │  │
│  │ - CrewAI    │  │ - Slack     │  │ └─────────────────┘ │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
│                    │              │            │             │
│                    ▼              ▼            ▼             │
│              ┌─────────────────────────────────────────┐    │
│              │          Backend API Layer              │    │
│              │  /api/pico  │  /api/messaging           │    │
│              └─────────────────────────────────────────┘    │
│                              │                               │
│                              ▼                               │
│              ┌─────────────────────────────────────────┐    │
│              │           Ollama (Local LLM)            │    │
│              │  llama3.2 │ codellama │ mistral        │    │
│              └─────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

---

## 9. Future Roadmap

### Phase 1 (Current)
- ✅ PicoCore embedded
- ✅ Messaging panel UI
- ✅ Agent hub UI
- ✅ API endpoints

### Phase 2 (Next)
- [ ] Letta/MemGPT full integration
- [ ] LangChain chains in IDE
- [ ] AutoGPT task automation
- [ ] CrewAI team orchestration

### Phase 3 (Future)
- [ ] Voice messaging support
- [ ] Mobile app integration
- [ ] Cloud sync for agents
- [ ] Marketplace for agent templates

---

## 10. Contributing

To add new agent frameworks or messaging platforms:

1. Create a new module in `src/lib/pulse/<framework>/`
2. Implement the `AgentFramework` interface
3. Add to `AVAILABLE_FRAMEWORKS` in AgentHub
4. Create API routes in `src/app/api/<framework>/`
5. Update documentation

---

## Resources

- [PicoClaw GitHub](https://github.com/sipeed/picoclaw)
- [Letta Documentation](https://docs.letta.com)
- [LangChain Docs](https://python.langchain.com/docs/)
- [CrewAI GitHub](https://github.com/joaomdmoura/crewAI)
- [AutoGPT GitHub](https://github.com/Significant-Gravitas/AutoGPT)
- [Telegram Bot API](https://core.telegram.org/bots/api)
- [WhatsApp Business API](https://developers.facebook.com/docs/whatsapp)
- [Discord Webhooks](https://discord.com/developers/docs/resources/webhook)
- [Slack Webhooks](https://api.slack.com/messaging/webhooks)
