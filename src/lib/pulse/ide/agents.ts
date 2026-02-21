// Kyro IDE - Multi-Agent Orchestration System
// Coordinates specialized AI agents working together

import { Agent, AgentRole, AgentMessage, AgentSession, AgentAction, ConversationContext } from '@/types/ide';
import { EventEmitter } from 'events';

// ============================================================================
// AGENT DEFINITIONS
// ============================================================================

export const AGENT_DEFINITIONS: Omit<Agent, 'id' | 'status' | 'currentTask' | 'lastActivity' | 'metrics'>[] = [
  {
    name: 'Architect',
    role: 'architect',
    description: 'System design and architecture decisions. Analyzes codebase structure and proposes improvements.',
    icon: '🏗️',
    capabilities: [
      'Analyze codebase architecture',
      'Design system components',
      'Propose refactoring strategies',
      'Review architectural patterns',
      'Generate technical documentation'
    ],
    modelPreference: 'claude-3-opus',
    isActive: true
  },
  {
    name: 'Coder',
    role: 'coder',
    description: 'Primary code generation agent. Writes, modifies, and refactors code across multiple files.',
    icon: '💻',
    capabilities: [
      'Generate code from specifications',
      'Implement features',
      'Fix bugs',
      'Refactor code',
      'Write unit tests'
    ],
    modelPreference: 'claude-3-sonnet',
    isActive: true
  },
  {
    name: 'Reviewer',
    role: 'reviewer',
    description: 'Code review and quality assurance. Identifies issues and suggests improvements.',
    icon: '🔍',
    capabilities: [
      'Review code for bugs',
      'Check code style compliance',
      'Identify security vulnerabilities',
      'Suggest performance improvements',
      'Validate best practices'
    ],
    modelPreference: 'claude-3-sonnet',
    isActive: true
  },
  {
    name: 'Debugger',
    role: 'debugger',
    description: 'Bug detection and fixing. Analyzes errors and provides targeted fixes.',
    icon: '🐛',
    capabilities: [
      'Analyze error messages',
      'Trace stack traces',
      'Identify root causes',
      'Propose fixes',
      'Test fix effectiveness'
    ],
    modelPreference: 'claude-3-sonnet',
    isActive: true
  },
  {
    name: 'Optimizer',
    role: 'optimizer',
    description: 'Performance optimization. Identifies bottlenecks and optimizes code.',
    icon: '⚡',
    capabilities: [
      'Profile code performance',
      'Identify bottlenecks',
      'Optimize algorithms',
      'Reduce memory usage',
      'Improve startup time'
    ],
    modelPreference: 'claude-3-sonnet',
    isActive: true
  },
  {
    name: 'Documenter',
    role: 'documenter',
    description: 'Documentation generation. Creates and maintains code documentation.',
    icon: '📝',
    capabilities: [
      'Generate API documentation',
      'Write README files',
      'Create inline comments',
      'Generate type definitions',
      'Write tutorials'
    ],
    modelPreference: 'claude-3-haiku',
    isActive: true
  },
  {
    name: 'Tester',
    role: 'tester',
    description: 'Test generation and execution. Creates comprehensive test suites.',
    icon: '🧪',
    capabilities: [
      'Generate unit tests',
      'Create integration tests',
      'Generate E2E tests',
      'Analyze coverage',
      'Identify edge cases'
    ],
    modelPreference: 'claude-3-sonnet',
    isActive: true
  },
  {
    name: 'Refactorer',
    role: 'refactorer',
    description: 'Code refactoring specialist. Improves code structure while preserving behavior.',
    icon: '🔧',
    capabilities: [
      'Extract methods',
      'Rename symbols',
      'Move code between files',
      'Apply design patterns',
      'Simplify complex code'
    ],
    modelPreference: 'claude-3-sonnet',
    isActive: true
  },
  {
    name: 'Security',
    role: 'security',
    description: 'Security analysis. Identifies vulnerabilities and suggests fixes.',
    icon: '🔒',
    capabilities: [
      'Scan for vulnerabilities',
      'Check dependency security',
      'Analyze authentication flows',
      'Review encryption usage',
      'Suggest security improvements'
    ],
    modelPreference: 'claude-3-opus',
    isActive: true
  },
  {
    name: 'Researcher',
    role: 'researcher',
    description: 'Research and information gathering. Finds relevant information and best practices.',
    icon: '🔬',
    capabilities: [
      'Search documentation',
      'Find code examples',
      'Research best practices',
      'Compare implementations',
      'Summarize findings'
    ],
    modelPreference: 'claude-3-sonnet',
    isActive: true
  }
];

// ============================================================================
// AGENT MANAGER
// ============================================================================

export class AgentManager extends EventEmitter {
  private agents: Map<string, Agent> = new Map();
  private sessions: Map<string, AgentSession> = new Map();
  private activeSessions: Map<string, AgentSession> = new Map();

  constructor() {
    super();
    this.initializeAgents();
  }

  private initializeAgents(): void {
    AGENT_DEFINITIONS.forEach((def, index) => {
      const agent: Agent = {
        ...def,
        id: `agent-${def.role}-${index}`,
        status: 'idle',
        metrics: {
          tasksCompleted: 0,
          successRate: 1.0,
          avgResponseTime: 0,
          tokensUsed: 0
        }
      };
      this.agents.set(agent.id, agent);
    });
  }

  getAgents(): Agent[] {
    return Array.from(this.agents.values());
  }

  getAgentsByRole(role: AgentRole): Agent[] {
    return this.getAgents().filter(a => a.role === role);
  }

  getAgent(id: string): Agent | undefined {
    return this.agents.get(id);
  }

  updateAgentStatus(id: string, status: Agent['status'], task?: string): void {
    const agent = this.agents.get(id);
    if (agent) {
      agent.status = status;
      agent.currentTask = task;
      agent.lastActivity = new Date();
      this.emit('agent:status', { agentId: id, status, task });
    }
  }

  async startSession(agentId: string, context: ConversationContext): Promise<AgentSession> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    const session: AgentSession = {
      id: `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      agentId,
      messages: [],
      context,
      startTime: new Date(),
      status: 'active'
    };

    this.sessions.set(session.id, session);
    this.activeSessions.set(agentId, session);
    this.updateAgentStatus(agentId, 'thinking', 'Starting session');

    this.emit('session:started', { sessionId: session.id, agentId });
    return session;
  }

  async sendMessage(
    sessionId: string,
    content: string,
    onStream?: (chunk: string) => void
  ): Promise<AgentMessage> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const agent = this.agents.get(session.agentId);
    if (!agent) {
      throw new Error(`Agent ${session.agentId} not found`);
    }

    const userMessage: AgentMessage = {
      id: `msg-${Date.now()}`,
      agentId: session.agentId,
      role: 'user',
      content,
      timestamp: new Date()
    };
    session.messages.push(userMessage);

    this.updateAgentStatus(session.agentId, 'thinking', content.slice(0, 100));

    const systemPrompt = this.buildSystemPrompt(agent, session.context);
    const conversationHistory = this.buildConversationHistory(session.messages);

    const startTime = Date.now();
    
    const response = await this.callModel(
      agent.modelPreference || 'default',
      systemPrompt,
      conversationHistory,
      onStream
    );

    const latency = Date.now() - startTime;

    const assistantMessage: AgentMessage = {
      id: `msg-${Date.now()}`,
      agentId: session.agentId,
      role: 'assistant',
      content: response.content,
      timestamp: new Date(),
      metadata: {
        model: agent.modelPreference,
        tokens: response.tokens,
        latency
      },
      codeBlocks: this.extractCodeBlocks(response.content),
      actions: response.actions
    };
    session.messages.push(assistantMessage);

    agent.metrics.tasksCompleted++;
    agent.metrics.avgResponseTime = 
      (agent.metrics.avgResponseTime * (agent.metrics.tasksCompleted - 1) + latency) / 
      agent.metrics.tasksCompleted;
    if (response.tokens) {
      agent.metrics.tokensUsed += response.tokens;
    }

    this.updateAgentStatus(session.agentId, 'idle');
    this.emit('message:received', { sessionId, message: assistantMessage });

    return assistantMessage;
  }

  async orchestrate(
    task: string,
    context: ConversationContext,
    roles: AgentRole[] = ['coder']
  ): Promise<Map<AgentRole, AgentMessage>> {
    const results = new Map<AgentRole, AgentMessage>();
    const sessions: AgentSession[] = [];

    for (const role of roles) {
      const agents = this.getAgentsByRole(role);
      if (agents.length > 0) {
        const session = await this.startSession(agents[0].id, context);
        sessions.push(session);
      }
    }

    for (const session of sessions) {
      const agent = this.agents.get(session.agentId);
      if (agent) {
        const roleSpecificPrompt = this.getRoleSpecificPrompt(agent.role, task);
        const message = await this.sendMessage(session.id, roleSpecificPrompt);
        results.set(agent.role, message);
      }
    }

    return results;
  }

  private buildSystemPrompt(agent: Agent, context: ConversationContext): string {
    const roleDescriptions: Record<AgentRole, string> = {
      architect: 'You are an expert software architect. Analyze code structure and propose improvements.',
      coder: 'You are an expert programmer. Write clean, efficient, and well-documented code.',
      reviewer: 'You are a meticulous code reviewer. Identify issues and suggest improvements.',
      debugger: 'You are a debugging expert. Analyze errors and provide targeted fixes.',
      optimizer: 'You are a performance optimization specialist. Identify and fix bottlenecks.',
      documenter: 'You are a technical writer. Create clear and comprehensive documentation.',
      tester: 'You are a QA engineer. Write comprehensive tests and identify edge cases.',
      refactorer: 'You are a refactoring specialist. Improve code structure while preserving behavior.',
      security: 'You are a security expert. Identify vulnerabilities and suggest fixes.',
      researcher: 'You are a research assistant. Find relevant information and best practices.'
    };

    let prompt = `${roleDescriptions[agent.role]}

## Your Capabilities
${agent.capabilities.map(c => `- ${c}`).join('\n')}

## Context
`;

    if (context.projectInfo) {
      prompt += `\n### Project: ${context.projectInfo.name}
- Language: ${context.projectInfo.language}
${context.projectInfo.framework ? `- Framework: ${context.projectInfo.framework}` : ''}
`;
    }

    if (context.files.length > 0) {
      prompt += `\n### Referenced Files
${context.files.map(f => `- ${f}`).join('\n')}
`;
    }

    if (context.codeSnippets.length > 0) {
      prompt += `\n### Relevant Code
${context.codeSnippets.slice(0, 3).map(s => `\`\`\`${s.language}
// ${s.path}:${s.lineStart}-${s.lineEnd}
${s.code}
\`\`\``).join('\n')}
`;
    }

    prompt += `
## Instructions
1. Provide clear, actionable responses
2. Include code examples when relevant
3. Explain your reasoning
4. Consider edge cases and potential issues
5. Follow the project's coding conventions
`;

    return prompt;
  }

  private buildConversationHistory(messages: AgentMessage[]): { role: string; content: string }[] {
    return messages.map(m => ({
      role: m.role,
      content: m.content
    }));
  }

  private extractCodeBlocks(content: string): AgentMessage['codeBlocks'] {
    const blocks: AgentMessage['codeBlocks'] = [];
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    let match;
    
    while ((match = codeBlockRegex.exec(content)) !== null) {
      blocks.push({
        id: `block-${blocks.length}`,
        language: match[1] || 'plaintext',
        code: match[2],
        action: 'reference'
      });
    }
    
    return blocks;
  }

  private getRoleSpecificPrompt(role: AgentRole, task: string): string {
    const prompts: Record<AgentRole, (t: string) => string> = {
      architect: (t) => `Analyze the architecture for: ${t}\n\nConsider:\n- Component structure\n- Data flow\n- Scalability\n- Maintainability`,
      coder: (t) => `Implement the following: ${t}\n\nRequirements:\n- Write clean, readable code\n- Follow best practices\n- Include error handling`,
      reviewer: (t) => `Review the following code/task: ${t}\n\nCheck for:\n- Bugs and issues\n- Code style\n- Performance\n- Security`,
      debugger: (t) => `Debug the following issue: ${t}\n\nProvide:\n- Root cause analysis\n- Step-by-step fix\n- Prevention recommendations`,
      optimizer: (t) => `Optimize the following: ${t}\n\nFocus on:\n- Performance bottlenecks\n- Memory usage\n- Algorithm efficiency`,
      documenter: (t) => `Document the following: ${t}\n\nInclude:\n- Clear descriptions\n- Usage examples\n- API documentation`,
      tester: (t) => `Create tests for: ${t}\n\nCover:\n- Unit tests\n- Edge cases\n- Integration scenarios`,
      refactorer: (t) => `Refactor the following: ${t}\n\nGoals:\n- Improve readability\n- Reduce complexity\n- Maintain functionality`,
      security: (t) => `Analyze security for: ${t}\n\nCheck:\n- Vulnerabilities\n- Authentication\n- Data protection`,
      researcher: (t) => `Research the following: ${t}\n\nProvide:\n- Best practices\n- Examples\n- Recommendations`
    };

    return prompts[role](task);
  }

  private async callModel(
    model: string,
    systemPrompt: string,
    history: { role: string; content: string }[],
    onStream?: (chunk: string) => void
  ): Promise<{ content: string; tokens?: number; actions?: AgentAction[] }> {
    try {
      // Import client-side AI service dynamically
      const { aiClient } = await import('../../ai-client');
      
      // Build messages with system prompt
      const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
        { role: 'system', content: systemPrompt },
        ...history.map(h => ({
          role: h.role as 'user' | 'assistant',
          content: h.content
        }))
      ];

      // Determine the best model to use
      const modelId = model.includes('opus') ? 'claude-3-opus' :
                      model.includes('haiku') ? 'claude-3-haiku' :
                      'claude-3-sonnet';

      const response = await aiClient.chat(messages, modelId, {
        maxTokens: 4096,
        temperature: 0.7
      });

      // Extract actions from response (code blocks with specific markers)
      const actions: AgentAction[] = [];
      const actionRegex = /<!-- ACTION: (\w+) -->([\s\S]*?)<!-- END_ACTION -->/g;
      let match;
      while ((match = actionRegex.exec(response.content)) !== null) {
        actions.push({
          type: match[1] as AgentAction['type'],
          payload: match[2].trim()
        });
      }

      return {
        content: response.content,
        tokens: response.tokens?.total,
        actions
      };
    } catch (error) {
      console.error('Agent model call failed:', error);
      return {
        content: `I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`,
        tokens: 0,
        actions: []
      };
    }
  }

  endSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = 'completed';
      session.endTime = new Date();
      this.activeSessions.delete(session.agentId);
      this.updateAgentStatus(session.agentId, 'idle');
      this.emit('session:ended', { sessionId });
    }
  }

  getSession(sessionId: string): AgentSession | undefined {
    return this.sessions.get(sessionId);
  }

  getAllSessions(): AgentSession[] {
    return Array.from(this.sessions.values());
  }
}

let agentManagerInstance: AgentManager | null = null;

export function getAgentManager(): AgentManager {
  if (!agentManagerInstance) {
    agentManagerInstance = new AgentManager();
  }
  return agentManagerInstance;
}
