'use client';

import React, { useState, useCallback, useMemo } from 'react';
import {
  Bot,
  Brain,
  Zap,
  Users,
  Settings,
  Plus,
  Trash2,
  RefreshCw,
  Check,
  AlertCircle,
  Play,
  Pause,
  ExternalLink,
  Search,
  Filter,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Cpu,
  Database,
  Globe
} from 'lucide-react';

// Types
export interface AgentFramework {
  id: string;
  name: string;
  description: string;
  type: 'local' | 'cloud' | 'hybrid';
  status: 'installed' | 'available' | 'updating' | 'error';
  version?: string;
  icon: string;
  capabilities: string[];
  memoryType: 'none' | 'session' | 'persistent' | 'archival';
  url?: string;
  config?: Record<string, unknown>;
}

export interface AgentInstance {
  id: string;
  frameworkId: string;
  name: string;
  status: 'idle' | 'running' | 'thinking' | 'error';
  task?: string;
  progress?: number;
  created: Date;
  lastActivity: Date;
}

export interface AgentHubProps {
  frameworks?: AgentFramework[];
  instances?: AgentInstance[];
  onInstall?: (frameworkId: string) => Promise<void>;
  onUninstall?: (frameworkId: string) => void;
  onCreateInstance?: (frameworkId: string, name: string) => void;
  onDeleteInstance?: (instanceId: string) => void;
  onRunInstance?: (instanceId: string, task: string) => void;
  onStopInstance?: (instanceId: string) => void;
  className?: string;
}

// Available frameworks
const AVAILABLE_FRAMEWORKS: AgentFramework[] = [
  {
    id: 'pico',
    name: 'PicoClaw',
    description: 'Ultra-lightweight AI assistant (<10MB RAM). Perfect for embedded systems and quick tasks.',
    type: 'local',
    status: 'installed',
    version: '1.0.0',
    icon: '🦐',
    capabilities: ['Chat', 'Code Generation', 'Multi-platform Messaging'],
    memoryType: 'session',
    url: 'https://github.com/sipeed/picoclaw',
  },
  {
    id: 'letta',
    name: 'Letta (MemGPT)',
    description: 'Stateful AI agents with persistent memory. Self-editing memory architecture.',
    type: 'hybrid',
    status: 'available',
    icon: '🧠',
    capabilities: ['Persistent Memory', 'Self-Improvement', 'Archival Memory', 'Multi-Agent'],
    memoryType: 'archival',
    url: 'https://github.com/letta-ai/letta',
  },
  {
    id: 'langchain',
    name: 'LangChain',
    description: 'Framework for building LLM applications with chains, agents, and tools.',
    type: 'hybrid',
    status: 'available',
    icon: '⛓️',
    capabilities: ['Chains', 'Tools', 'Memory', 'Agents', 'RAG'],
    memoryType: 'persistent',
    url: 'https://github.com/langchain-ai/langchain',
  },
  {
    id: 'autogpt',
    name: 'AutoGPT',
    description: 'Autonomous AI agent for task automation. Self-planning and execution.',
    type: 'hybrid',
    status: 'available',
    icon: '🤖',
    capabilities: ['Autonomous Tasks', 'Planning', 'Web Browsing', 'File Operations'],
    memoryType: 'persistent',
    url: 'https://github.com/Significant-Gravitas/AutoGPT',
  },
  {
    id: 'babyagi',
    name: 'BabyAGI',
    description: 'Lightweight autonomous agent with task management and execution.',
    type: 'hybrid',
    status: 'available',
    icon: '👶',
    capabilities: ['Task Management', 'Execution', 'Memory', 'Planning'],
    memoryType: 'persistent',
    url: 'https://github.com/yoheinakajima/babyagi',
  },
  {
    id: 'crewai',
    name: 'CrewAI',
    description: 'Multi-agent framework for collaborative AI teams. Role-based agents.',
    type: 'hybrid',
    status: 'available',
    icon: '👥',
    capabilities: ['Multi-Agent', 'Role-Based', 'Collaboration', 'Task Delegation'],
    memoryType: 'session',
    url: 'https://github.com/joaomdmoura/crewAI',
  },
  {
    id: 'metagpt',
    name: 'MetaGPT',
    description: 'Multi-agent framework for software development. Simulates a software company.',
    type: 'hybrid',
    status: 'available',
    icon: '🏢',
    capabilities: ['Software Development', 'Multi-Agent', 'Documentation', 'Code Review'],
    memoryType: 'persistent',
    url: 'https://github.com/geekan/MetaGPT',
  },
  {
    id: 'camel',
    name: 'CAMEL',
    description: 'Communicative Agents for Mind Exploration. Role-playing multi-agent.',
    type: 'hybrid',
    status: 'available',
    icon: '🐪',
    capabilities: ['Role-Playing', 'Multi-Agent', 'Task Solving', 'Cooperative'],
    memoryType: 'session',
    url: 'https://github.com/camel-ai/camel',
  },
  {
    id: 'agentgpt',
    name: 'AgentGPT',
    description: 'Web-based autonomous AI agent platform. Deploy and manage agents.',
    type: 'cloud',
    status: 'available',
    icon: '🌐',
    capabilities: ['Web Interface', 'Autonomous', 'Deployment', 'Monitoring'],
    memoryType: 'persistent',
    url: 'https://github.com/reworkd/AgentGPT',
  },
  {
    id: 'openinterpreter',
    name: 'Open Interpreter',
    description: 'Natural language interface for computers. Execute code locally.',
    type: 'local',
    status: 'available',
    icon: '💻',
    capabilities: ['Code Execution', 'Natural Language', 'Local Runtime', 'Multi-Language'],
    memoryType: 'session',
    url: 'https://github.com/OpenInterpreter/open-interpreter',
  },
];

// Status colors
const STATUS_COLORS = {
  installed: 'text-green-400 bg-green-400/10',
  available: 'text-blue-400 bg-blue-400/10',
  updating: 'text-yellow-400 bg-yellow-400/10',
  error: 'text-red-400 bg-red-400/10',
};

const MEMORY_ICONS = {
  none: '❌',
  session: '⚡',
  persistent: '💾',
  archival: '🗄️',
};

// Framework Card Component
const FrameworkCard: React.FC<{
  framework: AgentFramework;
  onInstall?: () => void;
  onUninstall?: () => void;
  isExpanded: boolean;
  onToggle: () => void;
}> = ({ framework, onInstall, onUninstall, isExpanded, onToggle }) => {
  const [isInstalling, setIsInstalling] = useState(false);

  const handleInstall = async () => {
    setIsInstalling(true);
    try {
      await onInstall?.();
    } finally {
      setIsInstalling(false);
    }
  };

  return (
    <div className="border border-[#3c3c3c] rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-3 hover:bg-[#2a2d2e] text-left"
      >
        <span className="text-2xl">{framework.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-200">{framework.name}</span>
            <span className={`px-1.5 py-0.5 text-xs rounded ${STATUS_COLORS[framework.status]}`}>
              {framework.status}
            </span>
            {framework.version && (
              <span className="text-xs text-gray-500">v{framework.version}</span>
            )}
          </div>
          <p className="text-xs text-gray-500 truncate">{framework.description}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">{framework.type}</span>
          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-3 pb-3 space-y-3 border-t border-[#3c3c3c]">
          {/* Capabilities */}
          <div className="mt-2">
            <span className="text-xs text-gray-400">Capabilities:</span>
            <div className="flex flex-wrap gap-1 mt-1">
              {framework.capabilities.map((cap) => (
                <span
                  key={cap}
                  className="px-2 py-0.5 text-xs bg-[#2d2d2d] text-gray-300 rounded"
                >
                  {cap}
                </span>
              ))}
            </div>
          </div>

          {/* Memory Type */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-gray-400">Memory:</span>
            <span className="flex items-center gap-1">
              {MEMORY_ICONS[framework.memoryType]}
              {framework.memoryType}
            </span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2">
            {framework.status === 'installed' ? (
              <>
                <button
                  onClick={onUninstall}
                  className="flex items-center gap-1 px-3 py-1 text-sm bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded"
                >
                  <Trash2 size={14} />
                  Uninstall
                </button>
                <a
                  href={framework.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 px-3 py-1 text-sm bg-[#2d2d2d] text-gray-300 hover:bg-[#3c3c3c] rounded"
                >
                  <ExternalLink size={14} />
                  Docs
                </a>
              </>
            ) : (
              <>
                <button
                  onClick={handleInstall}
                  disabled={isInstalling}
                  className="flex items-center gap-1 px-3 py-1 text-sm bg-[#007acc] hover:bg-[#1a8cdb] text-white rounded disabled:opacity-50"
                >
                  {isInstalling ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      Installing...
                    </>
                  ) : (
                    <>
                      <Plus size={14} />
                      Install
                    </>
                  )}
                </button>
                <a
                  href={framework.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 px-3 py-1 text-sm bg-[#2d2d2d] text-gray-300 hover:bg-[#3c3c3c] rounded"
                >
                  <ExternalLink size={14} />
                  Learn More
                </a>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Instance Card Component
const InstanceCard: React.FC<{
  instance: AgentInstance;
  framework: AgentFramework;
  onDelete?: () => void;
  onRun?: (task: string) => void;
  onStop?: () => void;
}> = ({ instance, framework, onDelete, onRun, onStop }) => {
  const [task, setTask] = useState('');
  const [showTaskInput, setShowTaskInput] = useState(false);

  const statusColors = {
    idle: 'text-gray-400',
    running: 'text-green-400',
    thinking: 'text-yellow-400',
    error: 'text-red-400',
  };

  return (
    <div className="border border-[#3c3c3c] rounded-lg p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">{framework.icon}</span>
          <div>
            <span className="font-medium text-gray-200">{instance.name}</span>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span className={statusColors[instance.status]}>
                {instance.status === 'thinking' && <RefreshCw size={10} className="animate-spin inline mr-1" />}
                {instance.status}
              </span>
              {instance.task && (
                <span className="truncate max-w-[150px]">{instance.task}</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {instance.status === 'idle' ? (
            <button
              onClick={() => setShowTaskInput(!showTaskInput)}
              className="p-1.5 text-green-400 hover:bg-green-400/10 rounded"
            >
              <Play size={14} />
            </button>
          ) : (
            <button
              onClick={onStop}
              className="p-1.5 text-yellow-400 hover:bg-yellow-400/10 rounded"
            >
              <Pause size={14} />
            </button>
          )}
          <button
            onClick={onDelete}
            className="p-1.5 text-red-400 hover:bg-red-400/10 rounded"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {instance.progress !== undefined && (
        <div className="mt-2">
          <div className="h-1 bg-[#2d2d2d] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#007acc] transition-all duration-300"
              style={{ width: `${instance.progress}%` }}
            />
          </div>
          <span className="text-xs text-gray-500">{instance.progress}% complete</span>
        </div>
      )}

      {showTaskInput && (
        <div className="mt-2 flex gap-2">
          <input
            type="text"
            value={task}
            onChange={(e) => setTask(e.target.value)}
            placeholder="Enter task..."
            className="flex-1 px-2 py-1 text-sm bg-[#2d2d2d] border border-[#3c3c3c] rounded text-white"
          />
          <button
            onClick={() => {
              onRun?.(task);
              setShowTaskInput(false);
              setTask('');
            }}
            disabled={!task.trim()}
            className="px-3 py-1 text-sm bg-[#007acc] hover:bg-[#1a8cdb] text-white rounded disabled:opacity-50"
          >
            Run
          </button>
        </div>
      )}
    </div>
  );
};

// Main Agent Hub Component
export const AgentHub: React.FC<AgentHubProps> = ({
  frameworks: controlledFrameworks,
  instances: controlledInstances,
  onInstall,
  onUninstall,
  onCreateInstance,
  onDeleteInstance,
  onRunInstance,
  onStopInstance,
  className = '',
}) => {
  const [internalFrameworks, setInternalFrameworks] = useState<AgentFramework[]>(
    controlledFrameworks || AVAILABLE_FRAMEWORKS
  );
  const [internalInstances, setInternalInstances] = useState<AgentInstance[]>(
    controlledInstances || []
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'local' | 'cloud' | 'hybrid'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'installed' | 'available'>('all');
  const [expandedFrameworks, setExpandedFrameworks] = useState<Set<string>>(new Set());
  const [showNewInstance, setShowNewInstance] = useState(false);
  const [newInstanceName, setNewInstanceName] = useState('');
  const [newInstanceFramework, setNewInstanceFramework] = useState('');

  const frameworks = controlledFrameworks || internalFrameworks;
  const instances = controlledInstances || internalInstances;

  // Filter frameworks
  const filteredFrameworks = useMemo(() => {
    return frameworks.filter((f) => {
      if (filterType !== 'all' && f.type !== filterType) return false;
      if (filterStatus !== 'all' && f.status !== filterStatus) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          f.name.toLowerCase().includes(query) ||
          f.description.toLowerCase().includes(query) ||
          f.capabilities.some((c) => c.toLowerCase().includes(query))
        );
      }
      return true;
    });
  }, [frameworks, searchQuery, filterType, filterStatus]);

  // Toggle framework expansion
  const toggleFramework = useCallback((id: string) => {
    setExpandedFrameworks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Handle install
  const handleInstall = useCallback(async (frameworkId: string) => {
    await onInstall?.(frameworkId);
    setInternalFrameworks((prev) =>
      prev.map((f) =>
        f.id === frameworkId ? { ...f, status: 'installed' as const, version: '1.0.0' } : f
      )
    );
  }, [onInstall]);

  // Handle uninstall
  const handleUninstall = useCallback((frameworkId: string) => {
    onUninstall?.(frameworkId);
    setInternalFrameworks((prev) =>
      prev.map((f) =>
        f.id === frameworkId ? { ...f, status: 'available' as const, version: undefined } : f
      )
    );
  }, [onUninstall]);

  // Handle create instance
  const handleCreateInstance = useCallback(() => {
    if (!newInstanceName.trim() || !newInstanceFramework) return;
    onCreateInstance?.(newInstanceFramework, newInstanceName);
    setInternalInstances((prev) => [
      ...prev,
      {
        id: `instance-${Date.now()}`,
        frameworkId: newInstanceFramework,
        name: newInstanceName,
        status: 'idle',
        created: new Date(),
        lastActivity: new Date(),
      },
    ]);
    setShowNewInstance(false);
    setNewInstanceName('');
    setNewInstanceFramework('');
  }, [newInstanceName, newInstanceFramework, onCreateInstance]);

  // Get framework by ID
  const getFramework = (id: string) => frameworks.find((f) => f.id === id);

  return (
    <div className={`flex flex-col h-full bg-[#1e1e1e] ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#3c3c3c]">
        <div className="flex items-center gap-2">
          <Bot size={18} className="text-purple-400" />
          <span className="font-semibold text-gray-200">Agent Hub</span>
        </div>
        <button
          onClick={() => setShowNewInstance(true)}
          className="flex items-center gap-1 px-3 py-1 text-sm bg-[#007acc] hover:bg-[#1a8cdb] text-white rounded"
        >
          <Plus size={14} />
          New Agent
        </button>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 px-4 py-2 border-b border-[#3c3c3c] text-xs text-gray-400">
        <span className="flex items-center gap-1">
          <Cpu size={12} />
          {instances.filter((i) => i.status === 'running').length} running
        </span>
        <span className="flex items-center gap-1">
          <Database size={12} />
          {frameworks.filter((f) => f.status === 'installed').length} installed
        </span>
        <span className="flex items-center gap-1">
          <Globe size={12} />
          {frameworks.filter((f) => f.type === 'cloud').length} cloud
        </span>
      </div>

      {/* Search and Filters */}
      <div className="px-4 py-2 border-b border-[#3c3c3c] space-y-2">
        <div className="flex items-center bg-[#2d2d2d] rounded px-2 py-1">
          <Search size={14} className="text-gray-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search frameworks..."
            className="flex-1 bg-transparent border-none outline-none text-sm text-white px-2"
          />
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as typeof filterType)}
            className="px-2 py-1 text-xs bg-[#2d2d2d] border border-[#3c3c3c] rounded text-gray-300"
          >
            <option value="all">All Types</option>
            <option value="local">Local</option>
            <option value="cloud">Cloud</option>
            <option value="hybrid">Hybrid</option>
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
            className="px-2 py-1 text-xs bg-[#2d2d2d] border border-[#3c3c3c] rounded text-gray-300"
          >
            <option value="all">All Status</option>
            <option value="installed">Installed</option>
            <option value="available">Available</option>
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#3c3c3c]">
        <button className="flex-1 px-4 py-2 text-sm font-medium text-white border-b-2 border-[#007acc]">
          Frameworks
        </button>
        <button className="flex-1 px-4 py-2 text-sm text-gray-400 hover:text-white">
          My Agents ({instances.length})
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {filteredFrameworks.map((framework) => (
          <FrameworkCard
            key={framework.id}
            framework={framework}
            onInstall={() => handleInstall(framework.id)}
            onUninstall={() => handleUninstall(framework.id)}
            isExpanded={expandedFrameworks.has(framework.id)}
            onToggle={() => toggleFramework(framework.id)}
          />
        ))}

        {instances.length > 0 && (
          <div className="mt-4 pt-4 border-t border-[#3c3c3c]">
            <h3 className="text-sm font-medium text-gray-400 mb-2">Running Instances</h3>
            <div className="space-y-2">
              {instances.map((instance) => {
                const framework = getFramework(instance.frameworkId);
                if (!framework) return null;
                return (
                  <InstanceCard
                    key={instance.id}
                    instance={instance}
                    framework={framework}
                    onDelete={() => onDeleteInstance?.(instance.id)}
                    onRun={(task) => onRunInstance?.(instance.id, task)}
                    onStop={() => onStopInstance?.(instance.id)}
                  />
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* New Instance Modal */}
      {showNewInstance && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#1e1e1e] rounded-lg shadow-xl w-full max-w-md border border-[#3c3c3c]">
            <div className="flex items-center gap-3 p-4 border-b border-[#3c3c3c]">
              <Sparkles size={20} className="text-purple-400" />
              <span className="text-lg font-semibold text-white">Create New Agent</span>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Agent Name</label>
                <input
                  type="text"
                  value={newInstanceName}
                  onChange={(e) => setNewInstanceName(e.target.value)}
                  placeholder="My Agent"
                  className="w-full px-3 py-2 bg-[#2d2d2d] border border-[#3c3c3c] rounded text-white"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Framework</label>
                <select
                  value={newInstanceFramework}
                  onChange={(e) => setNewInstanceFramework(e.target.value)}
                  className="w-full px-3 py-2 bg-[#2d2d2d] border border-[#3c3c3c] rounded text-white"
                >
                  <option value="">Select framework...</option>
                  {frameworks
                    .filter((f) => f.status === 'installed')
                    .map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.icon} {f.name}
                      </option>
                    ))}
                </select>
              </div>
            </div>
            <div className="flex gap-2 p-4 border-t border-[#3c3c3c]">
              <button
                onClick={() => setShowNewInstance(false)}
                className="flex-1 px-4 py-2 bg-[#3c3c3c] hover:bg-[#4c4c4c] rounded text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateInstance}
                disabled={!newInstanceName.trim() || !newInstanceFramework}
                className="flex-1 px-4 py-2 bg-[#007acc] hover:bg-[#1a8cdb] rounded text-white disabled:opacity-50"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgentHub;
