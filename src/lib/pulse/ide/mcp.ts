// Kyro IDE - MCP (Model Context Protocol) Support
// Connect to external tools, APIs, and data sources

import { EventEmitter } from 'events';

// ============================================================================
// MCP TYPES
// ============================================================================

export interface MCPServer {
  id: string;
  name: string;
  transport: 'stdio' | 'http' | 'websocket';
  command?: string;
  args?: string[];
  url?: string;
  headers?: Record<string, string>;
  env?: Record<string, string>;
  disabled?: boolean;
  autoApprove?: string[];
  capabilities?: MCPCapabilities;
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  tools: MCPTool[];
  resources: MCPResource[];
  prompts: MCPPrompt[];
}

export interface MCPCapabilities {
  tools?: boolean;
  resources?: boolean;
  prompts?: boolean;
  logging?: boolean;
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description?: string;
      enum?: string[];
    }>;
    required?: string[];
  };
  serverId: string;
  approved: boolean;
}

export interface MCPResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
  serverId: string;
}

export interface MCPPrompt {
  name: string;
  description?: string;
  arguments?: Array<{
    name: string;
    description?: string;
    required?: boolean;
  }>;
  serverId: string;
}

export interface MCPToolCall {
  id: string;
  toolName: string;
  serverId: string;
  arguments: Record<string, unknown>;
  result?: unknown;
  error?: string;
  timestamp: Date;
  approved: boolean;
}

export interface MCPServerConfig {
  mcpServers: Record<string, {
    command?: string;
    args?: string[];
    url?: string;
    transport?: 'stdio' | 'http' | 'websocket';
    env?: Record<string, string>;
    disabled?: boolean;
    autoApprove?: string[];
  }>;
}

// ============================================================================
// MCP MANAGER
// ============================================================================

export class MCPManager extends EventEmitter {
  private servers: Map<string, MCPServer> = new Map();
  private toolCalls: MCPToolCall[] = [];
  private pendingApprovals: Map<string, (approved: boolean) => void> = new Map();
  private configPath: string = '';

  constructor() {
    super();
  }

  // Load MCP configuration from file
  async loadConfig(configPath: string): Promise<void> {
    this.configPath = configPath;
    // Would load from file in real implementation
  }

  // Save MCP configuration
  async saveConfig(): Promise<void> {
    // Would save to file in real implementation
  }

  // Register a new MCP server
  async registerServer(config: Omit<MCPServer, 'status' | 'tools' | 'resources' | 'prompts'>): Promise<MCPServer> {
    const server: MCPServer = {
      ...config,
      status: 'disconnected',
      tools: [],
      resources: [],
      prompts: []
    };

    this.servers.set(server.id, server);
    this.emit('server:registered', server);

    // Auto-connect
    await this.connectServer(server.id);

    return server;
  }

  // Connect to an MCP server
  async connectServer(serverId: string): Promise<void> {
    const server = this.servers.get(serverId);
    if (!server) throw new Error(`Server ${serverId} not found`);

    server.status = 'connecting';
    this.emit('server:connecting', serverId);

    try {
      // In real implementation, would start the process or connect to URL
      // and perform MCP handshake

      // Simulate connection and capability discovery
      await new Promise(resolve => setTimeout(resolve, 100));

      server.status = 'connected';
      server.capabilities = {
        tools: true,
        resources: true,
        prompts: true,
        logging: true
      };

      // Would discover tools from server
      this.emit('server:connected', server);
    } catch (error) {
      server.status = 'error';
      this.emit('server:error', { serverId, error });
      throw error;
    }
  }

  // Disconnect from an MCP server
  async disconnectServer(serverId: string): Promise<void> {
    const server = this.servers.get(serverId);
    if (!server) return;

    server.status = 'disconnected';
    this.emit('server:disconnected', serverId);
  }

  // Remove an MCP server
  async removeServer(serverId: string): Promise<void> {
    await this.disconnectServer(serverId);
    this.servers.delete(serverId);
    this.emit('server:removed', serverId);
  }

  // Get all registered servers
  getServers(): MCPServer[] {
    return Array.from(this.servers.values());
  }

  // Get connected servers
  getConnectedServers(): MCPServer[] {
    return this.getServers().filter(s => s.status === 'connected');
  }

  // Get all available tools
  getAllTools(): MCPTool[] {
    const tools: MCPTool[] = [];
    this.servers.forEach(server => {
      tools.push(...server.tools);
    });
    return tools;
  }

  // Get tools by server
  getServerTools(serverId: string): MCPTool[] {
    return this.servers.get(serverId)?.tools || [];
  }

  // Call a tool
  async callTool(
    serverId: string,
    toolName: string,
    args: Record<string, unknown>,
    requireApproval: boolean = true
  ): Promise<unknown> {
    const server = this.servers.get(serverId);
    if (!server || server.status !== 'connected') {
      throw new Error(`Server ${serverId} not connected`);
    }

    const tool = server.tools.find(t => t.name === toolName);
    if (!tool) {
      throw new Error(`Tool ${toolName} not found on server ${serverId}`);
    }

    // Check if tool needs approval
    const isAutoApproved = server.autoApprove?.includes(toolName) || tool.approved;

    if (requireApproval && !isAutoApproved) {
      const approved = await this.requestApproval(serverId, toolName, args);
      if (!approved) {
        throw new Error('Tool call rejected by user');
      }
    }

    const callId = `call-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const toolCall: MCPToolCall = {
      id: callId,
      toolName,
      serverId,
      arguments: args,
      timestamp: new Date(),
      approved: true
    };

    this.toolCalls.push(toolCall);
    this.emit('tool:calling', toolCall);

    try {
      // In real implementation, would send JSON-RPC to server
      // Simulate tool execution
      const result = await this.executeToolCall(server, tool, args);
      toolCall.result = result;
      this.emit('tool:complete', toolCall);
      return result;
    } catch (error) {
      toolCall.error = error instanceof Error ? error.message : 'Unknown error';
      this.emit('tool:error', toolCall);
      throw error;
    }
  }

  // Request user approval for tool call
  private async requestApproval(
    serverId: string,
    toolName: string,
    args: Record<string, unknown>
  ): Promise<boolean> {
    return new Promise((resolve) => {
      const approvalId = `${serverId}:${toolName}:${Date.now()}`;
      this.pendingApprovals.set(approvalId, resolve);
      this.emit('approval:requested', { approvalId, serverId, toolName, args });
    });
  }

  // Approve a pending tool call
  approveToolCall(approvalId: string): void {
    const resolver = this.pendingApprovals.get(approvalId);
    if (resolver) {
      resolver(true);
      this.pendingApprovals.delete(approvalId);
      this.emit('approval:granted', approvalId);
    }
  }

  // Deny a pending tool call
  denyToolCall(approvalId: string): void {
    const resolver = this.pendingApprovals.get(approvalId);
    if (resolver) {
      resolver(false);
      this.pendingApprovals.delete(approvalId);
      this.emit('approval:denied', approvalId);
    }
  }

  // Execute tool call (would be IPC in real implementation)
  private async executeToolCall(
    server: MCPServer,
    tool: MCPTool,
    args: Record<string, unknown>
  ): Promise<unknown> {
    // Placeholder - would send actual JSON-RPC request
    return { success: true, args, tool: tool.name };
  }

  // Get all resources
  getAllResources(): MCPResource[] {
    const resources: MCPResource[] = [];
    this.servers.forEach(server => {
      resources.push(...server.resources);
    });
    return resources;
  }

  // Read a resource
  async readResource(serverId: string, uri: string): Promise<unknown> {
    const server = this.servers.get(serverId);
    if (!server || server.status !== 'connected') {
      throw new Error(`Server ${serverId} not connected`);
    }

    this.emit('resource:reading', { serverId, uri });
    
    // Would send actual request
    return { contents: [] };
  }

  // Get all prompts
  getAllPrompts(): MCPPrompt[] {
    const prompts: MCPPrompt[] = [];
    this.servers.forEach(server => {
      prompts.push(...server.prompts);
    });
    return prompts;
  }

  // Get a prompt template
  async getPrompt(serverId: string, name: string, args?: Record<string, string>): Promise<string> {
    const server = this.servers.get(serverId);
    if (!server || server.status !== 'connected') {
      throw new Error(`Server ${serverId} not connected`);
    }

    this.emit('prompt:getting', { serverId, name, args });
    
    // Would send actual request
    return '';
  }

  // Get tool call history
  getToolCallHistory(): MCPToolCall[] {
    return [...this.toolCalls];
  }

  // Clear tool call history
  clearToolCallHistory(): void {
    this.toolCalls = [];
    this.emit('history:cleared');
  }

  // Approve all tools from a server
  approveAllTools(serverId: string): void {
    const server = this.servers.get(serverId);
    if (server) {
      server.tools.forEach(tool => {
        tool.approved = true;
      });
      this.emit('tools:approved', serverId);
    }
  }

  // Toggle tool approval
  toggleToolApproval(serverId: string, toolName: string): void {
    const server = this.servers.get(serverId);
    if (server) {
      const tool = server.tools.find(t => t.name === toolName);
      if (tool) {
        tool.approved = !tool.approved;
        this.emit('tool:approval-changed', { serverId, toolName, approved: tool.approved });
      }
    }
  }
}

// ============================================================================
// BUILT-IN MCP SERVERS
// ============================================================================

export const BUILTIN_MCP_SERVERS: MCPServerConfig = {
  mcpServers: {
    'filesystem': {
      command: 'mcp-server-filesystem',
      args: ['--root', '.'],
      transport: 'stdio',
      autoApprove: ['read_file', 'list_directory']
    },
    'github': {
      command: 'mcp-server-github',
      transport: 'stdio',
      autoApprove: ['search_repositories', 'get_repository']
    },
    'git': {
      command: 'mcp-server-git',
      transport: 'stdio',
      autoApprove: ['status', 'log', 'diff']
    },
    'postgres': {
      command: 'mcp-server-postgres',
      transport: 'stdio'
    },
    'brave-search': {
      command: 'mcp-server-brave-search',
      transport: 'stdio',
      env: {
        BRAVE_API_KEY: '${BRAVE_API_KEY}'
      }
    },
    'memory': {
      command: 'mcp-server-memory',
      transport: 'stdio',
      autoApprove: ['read_graph', 'add_observations']
    },
    'slack': {
      command: 'mcp-server-slack',
      transport: 'stdio',
      env: {
        SLACK_BOT_TOKEN: '${SLACK_BOT_TOKEN}'
      }
    },
    'linear': {
      command: 'mcp-server-linear',
      transport: 'stdio',
      env: {
        LINEAR_API_KEY: '${LINEAR_API_KEY}'
      }
    }
  }
};

// Singleton
let mcpManagerInstance: MCPManager | null = null;

export function getMCPManager(): MCPManager {
  if (!mcpManagerInstance) {
    mcpManagerInstance = new MCPManager();
  }
  return mcpManagerInstance;
}
