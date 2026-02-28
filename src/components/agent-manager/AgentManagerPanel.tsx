'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Bot, 
  Rocket, 
  FileCode, 
  Brain, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  Play,
  Pause,
  RotateCcw,
  Zap,
  Target,
  TrendingUp,
  Activity,
  Sparkles,
  ChevronRight,
  Terminal,
  Code2,
  Database,
  GitBranch,
  Layers,
  Cpu,
  MemoryStick
} from 'lucide-react';

// Mock data types
interface Agent {
  id: string;
  name: string;
  type: 'coder' | 'analyst' | 'tester' | 'reviewer';
  status: 'idle' | 'working' | 'completed' | 'error';
  currentTask?: string;
  progress?: number;
  completedTasks: number;
  successRate: number;
}

interface Mission {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  priority: 'low' | 'medium' | 'high' | 'critical';
  assignedAgents: string[];
  progress: number;
  createdAt: Date;
  artifacts: string[];
}

interface Artifact {
  id: string;
  name: string;
  type: 'code' | 'test' | 'documentation' | 'config';
  path: string;
  createdAt: Date;
  verified: boolean;
  size: string;
}

interface KnowledgeEntry {
  id: string;
  title: string;
  category: 'pattern' | 'solution' | 'error' | 'optimization';
  relevance: number;
  lastUsed: Date;
  usageCount: number;
}

// Mock data
const mockAgents: Agent[] = [
  { id: '1', name: 'Code Architect', type: 'coder', status: 'working', currentTask: 'Implementing authentication module', progress: 67, completedTasks: 24, successRate: 0.94 },
  { id: '2', name: 'Test Engineer', type: 'tester', status: 'idle', completedTasks: 18, successRate: 0.89 },
  { id: '3', name: 'Code Reviewer', type: 'reviewer', status: 'working', currentTask: 'Reviewing PR #127', progress: 45, completedTasks: 156, successRate: 0.97 },
  { id: '4', name: 'Data Analyst', type: 'analyst', status: 'completed', completedTasks: 12, successRate: 0.91 },
];

const mockMissions: Mission[] = [
  { id: '1', title: 'Implement User Authentication', description: 'Build secure login system with OAuth2 support', status: 'in_progress', priority: 'high', assignedAgents: ['1', '2'], progress: 67, createdAt: new Date(Date.now() - 86400000), artifacts: ['auth.ts', 'oauth.ts'] },
  { id: '2', title: 'Performance Optimization', description: 'Optimize database queries and caching', status: 'pending', priority: 'medium', assignedAgents: ['4'], progress: 0, createdAt: new Date(Date.now() - 43200000), artifacts: [] },
  { id: '3', title: 'API Documentation', description: 'Generate comprehensive API docs', status: 'completed', priority: 'low', assignedAgents: ['1', '3'], progress: 100, createdAt: new Date(Date.now() - 172800000), artifacts: ['api-docs.md'] },
];

const mockArtifacts: Artifact[] = [
  { id: '1', name: 'auth.ts', type: 'code', path: '/src/auth/auth.ts', createdAt: new Date(Date.now() - 3600000), verified: true, size: '4.2 KB' },
  { id: '2', name: 'oauth.ts', type: 'code', path: '/src/auth/oauth.ts', createdAt: new Date(Date.now() - 7200000), verified: true, size: '2.8 KB' },
  { id: '3', name: 'auth.test.ts', type: 'test', path: '/tests/auth.test.ts', createdAt: new Date(Date.now() - 1800000), verified: false, size: '1.5 KB' },
  { id: '4', name: 'api-docs.md', type: 'documentation', path: '/docs/api.md', createdAt: new Date(Date.now() - 86400000), verified: true, size: '12.3 KB' },
];

const mockKnowledgeBase: KnowledgeEntry[] = [
  { id: '1', title: 'React Hook Patterns', category: 'pattern', relevance: 0.95, lastUsed: new Date(Date.now() - 3600000), usageCount: 47 },
  { id: '2', title: 'Authentication Best Practices', category: 'solution', relevance: 0.89, lastUsed: new Date(Date.now() - 7200000), usageCount: 23 },
  { id: '3', title: 'Memory Leak Detection', category: 'error', relevance: 0.76, lastUsed: new Date(Date.now() - 86400000), usageCount: 8 },
  { id: '4', title: 'Query Optimization', category: 'optimization', relevance: 0.92, lastUsed: new Date(Date.now() - 1800000), usageCount: 31 },
];

const agentTypeIcons = {
  coder: Code2,
  analyst: Activity,
  tester: Terminal,
  reviewer: CheckCircle2,
};

const agentTypeColors = {
  coder: 'text-blue-400',
  analyst: 'text-purple-400',
  tester: 'text-green-400',
  reviewer: 'text-orange-400',
};

const statusColors = {
  idle: 'bg-gray-500',
  working: 'bg-blue-500 animate-pulse',
  completed: 'bg-green-500',
  error: 'bg-red-500',
};

const priorityColors = {
  low: 'bg-gray-500/20 text-gray-400',
  medium: 'bg-yellow-500/20 text-yellow-400',
  high: 'bg-orange-500/20 text-orange-400',
  critical: 'bg-red-500/20 text-red-400',
};

const artifactTypeIcons = {
  code: FileCode,
  test: Terminal,
  documentation: Database,
  config: Layers,
};

const categoryColors = {
  pattern: 'bg-blue-500/20 text-blue-400',
  solution: 'bg-green-500/20 text-green-400',
  error: 'bg-red-500/20 text-red-400',
  optimization: 'bg-purple-500/20 text-purple-400',
};

export function AgentManagerPanel() {
  const [activeTab, setActiveTab] = useState('agents');

  return (
    <div className="h-full flex flex-col bg-[#0d1117] text-[#c9d1d9]">
      {/* Header */}
      <div className="p-4 border-b border-[#30363d] bg-gradient-to-r from-[#161b22] to-[#0d1117]">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500/20 to-blue-500/20">
            <Rocket className="w-6 h-6 text-purple-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
              Mission Control
            </h1>
            <p className="text-xs text-[#8b949e]">Agent-powered development orchestration</p>
          </div>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-4 gap-3 p-4 border-b border-[#30363d]">
        <Card className="bg-[#161b22] border-[#30363d]">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4 text-blue-400" />
              <span className="text-xs text-[#8b949e]">Active Agents</span>
            </div>
            <div className="text-2xl font-bold mt-1">{mockAgents.filter(a => a.status === 'working').length}</div>
          </CardContent>
        </Card>
        <Card className="bg-[#161b22] border-[#30363d]">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-green-400" />
              <span className="text-xs text-[#8b949e]">Missions</span>
            </div>
            <div className="text-2xl font-bold mt-1">{mockMissions.length}</div>
          </CardContent>
        </Card>
        <Card className="bg-[#161b22] border-[#30363d]">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <FileCode className="w-4 h-4 text-orange-400" />
              <span className="text-xs text-[#8b949e]">Artifacts</span>
            </div>
            <div className="text-2xl font-bold mt-1">{mockArtifacts.length}</div>
          </CardContent>
        </Card>
        <Card className="bg-[#161b22] border-[#30363d]">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <Brain className="w-4 h-4 text-purple-400" />
              <span className="text-xs text-[#8b949e]">Knowledge</span>
            </div>
            <div className="text-2xl font-bold mt-1">{mockKnowledgeBase.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <div className="px-4 pt-2 border-b border-[#30363d]">
          <TabsList className="bg-[#161b22] border-[#30363d]">
            <TabsTrigger value="agents" className="data-[state=active]:bg-[#21262d]">
              <Bot className="w-4 h-4 mr-2" /> Agents
            </TabsTrigger>
            <TabsTrigger value="missions" className="data-[state=active]:bg-[#21262d]">
              <Rocket className="w-4 h-4 mr-2" /> Missions
            </TabsTrigger>
            <TabsTrigger value="artifacts" className="data-[state=active]:bg-[#21262d]">
              <FileCode className="w-4 h-4 mr-2" /> Artifacts
            </TabsTrigger>
            <TabsTrigger value="knowledge" className="data-[state=active]:bg-[#21262d]">
              <Brain className="w-4 h-4 mr-2" /> Knowledge
            </TabsTrigger>
          </TabsList>
        </div>

        <ScrollArea className="flex-1">
          {/* Agents Tab */}
          <TabsContent value="agents" className="p-4 m-0">
            <div className="space-y-3">
              {mockAgents.map((agent) => {
                const Icon = agentTypeIcons[agent.type];
                return (
                  <Card key={agent.id} className="bg-[#161b22] border-[#30363d] hover:border-[#58a6ff]/50 transition-colors">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg bg-[#21262d] ${agentTypeColors[agent.type]}`}>
                            <Icon className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-medium">{agent.name}</h3>
                              <div className={`w-2 h-2 rounded-full ${statusColors[agent.status]}`} />
                            </div>
                            <p className="text-xs text-[#8b949e] mt-0.5">
                              {agent.status === 'working' ? agent.currentTask : agent.status}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {agent.status === 'working' ? (
                            <Button size="sm" variant="outline" className="h-7 text-xs border-[#30363d] hover:bg-[#21262d]">
                              <Pause className="w-3 h-3 mr-1" /> Pause
                            </Button>
                          ) : (
                            <Button size="sm" variant="outline" className="h-7 text-xs border-[#30363d] hover:bg-[#21262d]">
                              <Play className="w-3 h-3 mr-1" /> Start
                            </Button>
                          )}
                        </div>
                      </div>
                      {agent.status === 'working' && agent.progress !== undefined && (
                        <div className="mt-3">
                          <div className="flex justify-between text-xs text-[#8b949e] mb-1">
                            <span>Progress</span>
                            <span>{agent.progress}%</span>
                          </div>
                          <Progress value={agent.progress} className="h-1.5 bg-[#21262d]" />
                        </div>
                      )}
                      <div className="flex items-center gap-4 mt-3 text-xs text-[#8b949e]">
                        <span className="flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> {agent.completedTasks} completed
                        </span>
                        <span className="flex items-center gap-1">
                          <TrendingUp className="w-3 h-3" /> {(agent.successRate * 100).toFixed(0)}% success
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* Missions Tab */}
          <TabsContent value="missions" className="p-4 m-0">
            <div className="space-y-3">
              {mockMissions.map((mission) => (
                <Card key={mission.id} className="bg-[#161b22] border-[#30363d] hover:border-[#58a6ff]/50 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge className={priorityColors[mission.priority]}>{mission.priority}</Badge>
                        <h3 className="font-medium">{mission.title}</h3>
                      </div>
                      <Badge variant="outline" className="border-[#30363d]">
                        {mission.status.replace('_', ' ')}
                      </Badge>
                    </div>
                    <p className="text-xs text-[#8b949e] mb-3">{mission.description}</p>
                    <div className="flex items-center gap-4 mb-3">
                      <div className="flex items-center gap-1 text-xs text-[#8b949e]">
                        <Bot className="w-3 h-3" /> {mission.assignedAgents.length} agents
                      </div>
                      <div className="flex items-center gap-1 text-xs text-[#8b949e]">
                        <FileCode className="w-3 h-3" /> {mission.artifacts.length} artifacts
                      </div>
                      <div className="flex items-center gap-1 text-xs text-[#8b949e]">
                        <Clock className="w-3 h-3" /> {new Date(mission.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    {mission.status === 'in_progress' && (
                      <div>
                        <div className="flex justify-between text-xs text-[#8b949e] mb-1">
                          <span>Progress</span>
                          <span>{mission.progress}%</span>
                        </div>
                        <Progress value={mission.progress} className="h-1.5 bg-[#21262d]" />
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Artifacts Tab */}
          <TabsContent value="artifacts" className="p-4 m-0">
            <div className="space-y-2">
              {mockArtifacts.map((artifact) => {
                const Icon = artifactTypeIcons[artifact.type];
                return (
                  <Card key={artifact.id} className="bg-[#161b22] border-[#30363d] hover:border-[#58a6ff]/50 transition-colors cursor-pointer">
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded bg-[#21262d]">
                            <Icon className="w-4 h-4 text-[#8b949e]" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-medium">{artifact.name}</h4>
                              {artifact.verified && (
                                <CheckCircle2 className="w-3 h-3 text-green-400" />
                              )}
                            </div>
                            <p className="text-xs text-[#8b949e]">{artifact.path}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-[#8b949e]">
                          <span>{artifact.size}</span>
                          <ChevronRight className="w-4 h-4" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* Knowledge Tab */}
          <TabsContent value="knowledge" className="p-4 m-0">
            <div className="space-y-2">
              {mockKnowledgeBase.map((entry) => (
                <Card key={entry.id} className="bg-[#161b22] border-[#30363d] hover:border-[#58a6ff]/50 transition-colors cursor-pointer">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Badge className={categoryColors[entry.category]}>{entry.category}</Badge>
                        <div>
                          <h4 className="text-sm font-medium">{entry.title}</h4>
                          <p className="text-xs text-[#8b949e]">
                            Used {entry.usageCount} times | {(entry.relevance * 100).toFixed(0)}% relevant
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-3 h-3 text-yellow-400" />
                        <ChevronRight className="w-4 h-4 text-[#8b949e]" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </ScrollArea>
      </Tabs>

      {/* Footer Stats */}
      <div className="p-3 border-t border-[#30363d] bg-[#161b22]">
        <div className="flex items-center justify-between text-xs text-[#8b949e]">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <Cpu className="w-3 h-3" /> CPU: 23%
            </span>
            <span className="flex items-center gap-1">
              <MemoryStick className="w-3 h-3" /> Memory: 4.2 GB
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <Zap className="w-3 h-3 text-yellow-400" /> AI Active
            </span>
            <span className="flex items-center gap-1">
              <GitBranch className="w-3 h-3" /> main
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
