'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import {
  Play,
  Square,
  Download,
  Upload,
  Flame,
  Clock,
  Zap,
  AlertTriangle,
  TrendingUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Types
interface ProfileData {
  name: string;
  selfTime: number;
  totalTime: number;
  calls: number;
  percentage: number;
  children?: ProfileData[];
}

interface FlameGraphNode {
  name: string;
  value: number;
  percentage: number;
  children: FlameGraphNode[];
  color: string;
}

interface MemoryPoint {
  timestamp: number;
  used: number;
  total: number;
}

// Mock data
const mockProfileData: ProfileData[] = [
  { name: 'main', selfTime: 5, totalTime: 150, calls: 1, percentage: 100, children: [
    { name: 'processData', selfTime: 20, totalTime: 80, calls: 100, percentage: 53 },
    { name: 'renderUI', selfTime: 30, totalTime: 50, calls: 50, percentage: 33 },
    { name: 'fetchAPI', selfTime: 15, totalTime: 40, calls: 10, percentage: 27 },
  ]},
];

const mockFlameGraph: FlameGraphNode = {
  name: 'root',
  value: 150,
  percentage: 100,
  color: '#3b82f6',
  children: [
    {
      name: 'processData',
      value: 80,
      percentage: 53,
      color: '#ef4444',
      children: [
        { name: 'parseJSON', value: 30, percentage: 20, color: '#f97316', children: [] },
        { name: 'validate', value: 25, percentage: 17, color: '#eab308', children: [] },
      ],
    },
    {
      name: 'renderUI',
      value: 50,
      percentage: 33,
      color: '#22c55e',
      children: [
        { name: 'createElement', value: 20, percentage: 13, color: '#14b8a6', children: [] },
        { name: 'diff', value: 15, percentage: 10, color: '#06b6d4', children: [] },
      ],
    },
    {
      name: 'fetchAPI',
      value: 40,
      percentage: 27,
      color: '#8b5cf6',
      children: [],
    },
  ],
};

// Flame Graph Visualization
function FlameGraphView({ node, depth = 0 }: { node: FlameGraphNode; depth?: number }) {
  const [hovered, setHovered] = useState(false);
  const hasChildren = node.children && node.children.length > 0;
  const width = node.percentage;

  return (
    <div className="w-full">
      <div
        className="h-6 rounded cursor-pointer transition-all relative flex items-center px-2 text-xs text-white font-medium overflow-hidden"
        style={{ backgroundColor: node.color, width: `${width}%`, marginLeft: depth > 0 ? '0' : '0' }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <span className="truncate">{node.name}</span>
        <span className="ml-auto opacity-75">{node.value}ms</span>
        {hovered && (
          <div className="absolute top-full left-0 mt-1 p-2 bg-popover border rounded shadow-lg z-50 text-foreground">
            <div className="font-medium">{node.name}</div>
            <div className="text-xs text-muted-foreground">Self time: {node.value}ms ({node.percentage.toFixed(1)}%)</div>
          </div>
        )}
      </div>
      {hasChildren && (
        <div className="flex mt-0.5 gap-0.5">
          {node.children.map((child, i) => (
            <FlameGraphView key={i} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

// Memory Timeline
function MemoryTimeline() {
  const [memoryData, setMemoryData] = useState<MemoryPoint[]>([]);
  const [isTracking, setIsTracking] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (isTracking) {
      const interval = setInterval(() => {
        // Simulate memory tracking
        const used = 50 + Math.random() * 30;
        const total = 100;
        setMemoryData((prev) => [...prev.slice(-50), { timestamp: Date.now(), used, total }]);
      }, 500);
      return () => clearInterval(interval);
    }
  }, [isTracking]);

  useEffect(() => {
    if (canvasRef.current && memoryData.length > 1) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        const width = canvasRef.current.width;
        const height = canvasRef.current.height;
        ctx.clearRect(0, 0, width, height);

        // Draw memory line
        ctx.beginPath();
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2;
        memoryData.forEach((point, i) => {
          const x = (i / (memoryData.length - 1)) * width;
          const y = height - (point.used / 100) * height;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();

        // Fill area
        ctx.lineTo(width, height);
        ctx.lineTo(0, height);
        ctx.fillStyle = 'rgba(59, 130, 246, 0.1)';
        ctx.fill();
      }
    }
  }, [memoryData]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button size="sm" variant={isTracking ? 'destructive' : 'default'} onClick={() => setIsTracking(!isTracking)}>
            {isTracking ? <Square className="h-4 w-4 mr-1" /> : <Play className="h-4 w-4 mr-1" />}
            {isTracking ? 'Stop' : 'Start'} Tracking
          </Button>
          <Badge variant="outline">{memoryData.length} samples</Badge>
        </div>
        <div className="text-sm">
          Current: <span className="font-mono text-blue-500">{memoryData[memoryData.length - 1]?.used.toFixed(1) || 0} MB</span>
        </div>
      </div>
      <canvas ref={canvasRef} width={400} height={100} className="w-full h-24 border rounded" />
    </div>
  );
}

// Call Tree View
function CallTreeView({ data, depth = 0 }: { data: ProfileData; depth?: number }) {
  const [expanded, setExpanded] = useState(depth < 2);

  return (
    <div className="font-mono text-sm">
      <div
        className={cn('flex items-center gap-2 py-1 px-2 hover:bg-accent rounded cursor-pointer', depth > 0 && 'ml-4')}
        onClick={() => data.children && setExpanded(!expanded)}
      >
        <span className="w-4">{data.children && (expanded ? '▼' : '▶')}</span>
        <span className="flex-1 truncate">{data.name}</span>
        <span className="text-blue-500">{data.totalTime}ms</span>
        <span className="text-green-600">{data.selfTime}ms</span>
        <Badge variant="outline" className="text-xs">{data.calls}x</Badge>
        <span className="text-orange-500 w-12 text-right">{data.percentage.toFixed(1)}%</span>
      </div>
      {expanded && data.children && (
        <div>
          {data.children.map((child, i) => (
            <CallTreeView key={i} data={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

// Hot Spots Panel
function HotSpotsPanel() {
  const hotSpots = [
    { name: 'processData', selfTime: 80, percentage: 53, severity: 'critical' },
    { name: 'renderUI', selfTime: 50, percentage: 33, severity: 'high' },
    { name: 'parseJSON', selfTime: 30, percentage: 20, severity: 'medium' },
    { name: 'fetchAPI', selfTime: 15, percentage: 10, severity: 'low' },
  ];

  return (
    <div className="space-y-2">
      {hotSpots.map((spot, i) => (
        <div key={i} className="flex items-center gap-3 p-2 border rounded">
          <AlertTriangle className={cn(
            'h-4 w-4',
            spot.severity === 'critical' && 'text-red-500',
            spot.severity === 'high' && 'text-orange-500',
            spot.severity === 'medium' && 'text-yellow-500',
            spot.severity === 'low' && 'text-green-500'
          )} />
          <span className="flex-1 font-mono text-sm truncate">{spot.name}</span>
          <span className="text-blue-500">{spot.selfTime}ms</span>
          <Progress value={spot.percentage} className="w-20 h-2" />
          <span className="text-muted-foreground w-12 text-right">{spot.percentage}%</span>
        </div>
      ))}
    </div>
  );
}

// Main Profiler Panel
export function ProfilerPanel() {
  const [isProfiling, setIsProfiling] = useState(false);
  const [activeTab, setActiveTab] = useState('flame');

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="py-3 px-4 border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Flame className="h-4 w-4 text-orange-500" />
            Performance Profiler
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button size="sm" variant={isProfiling ? 'destructive' : 'default'} onClick={() => setIsProfiling(!isProfiling)}>
              {isProfiling ? <Square className="h-4 w-4 mr-1" /> : <Play className="h-4 w-4 mr-1" />}
              {isProfiling ? 'Stop' : 'Start'}
            </Button>
            <Button size="sm" variant="outline"><Upload className="h-4 w-4" /></Button>
            <Button size="sm" variant="outline"><Download className="h-4 w-4" /></Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 p-0 overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          <TabsList className="w-full justify-start rounded-none border-b px-2">
            <TabsTrigger value="flame" className="text-xs flex items-center gap-1"><Flame className="h-3 w-3" /> Flame Graph</TabsTrigger>
            <TabsTrigger value="calltree" className="text-xs flex items-center gap-1"><TrendingUp className="h-3 w-3" /> Call Tree</TabsTrigger>
            <TabsTrigger value="hotspots" className="text-xs flex items-center gap-1"><Zap className="h-3 w-3" /> Hot Spots</TabsTrigger>
            <TabsTrigger value="memory" className="text-xs flex items-center gap-1"><Clock className="h-3 w-3" /> Memory</TabsTrigger>
          </TabsList>
          <ScrollArea className="flex-1">
            <TabsContent value="flame" className="p-4 m-0">
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground mb-4">Click on frames to explore. Width represents time spent.</div>
                <FlameGraphView node={mockFlameGraph} />
              </div>
            </TabsContent>
            <TabsContent value="calltree" className="p-2 m-0">
              <div className="flex items-center gap-4 text-xs text-muted-foreground px-2 mb-2">
                <span className="flex-1">Function</span>
                <span className="text-blue-500">Total</span>
                <span className="text-green-600">Self</span>
                <span>Calls</span>
                <span className="text-orange-500 w-12 text-right">%</span>
              </div>
              {mockProfileData.map((d, i) => <CallTreeView key={i} data={d} />)}
            </TabsContent>
            <TabsContent value="hotspots" className="p-2 m-0"><HotSpotsPanel /></TabsContent>
            <TabsContent value="memory" className="p-4 m-0"><MemoryTimeline /></TabsContent>
          </ScrollArea>
        </Tabs>
      </CardContent>
    </Card>
  );
}

export default ProfilerPanel;
