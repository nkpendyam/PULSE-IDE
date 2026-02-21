'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Play,
  Pause,
  StepInto,
  StepOver,
  StepOut,
  Square,
  Plus,
  Trash2,
  RefreshCw,
  ChevronRight,
  ChevronDown,
  Pencil,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Types
interface Variable {
  name: string;
  value: unknown;
  type: string;
  expandable: boolean;
  children?: Variable[];
}

interface StackFrame {
  id: string;
  name: string;
  file: string;
  line: number;
  column: number;
}

interface Breakpoint {
  id: string;
  file: string;
  line: number;
  condition?: string;
  enabled: boolean;
}

interface WatchExpression {
  id: string;
  expression: string;
  value: string;
  type: string;
}

// Mock data
const mockVariables: Variable[] = [
  {
    name: 'user',
    type: 'Object',
    value: '{ name: "John", age: 30 }',
    expandable: true,
    children: [
      { name: 'name', type: 'string', value: '"John"', expandable: false },
      { name: 'age', type: 'number', value: '30', expandable: false },
    ],
  },
  {
    name: 'items',
    type: 'Array',
    value: 'Array(3)',
    expandable: true,
    children: [
      { name: '0', type: 'string', value: '"apple"', expandable: false },
      { name: '1', type: 'string', value: '"banana"', expandable: false },
      { name: '2', type: 'string', value: '"orange"', expandable: false },
    ],
  },
  { name: 'count', type: 'number', value: '42', expandable: false },
  { name: 'isActive', type: 'boolean', value: 'true', expandable: false },
];

const mockCallStack: StackFrame[] = [
  { id: '1', name: 'processData', file: 'app.ts', line: 42, column: 5 },
  { id: '2', name: 'handleClick', file: 'components/Button.tsx', line: 15, column: 3 },
  { id: '3', name: 'onClick', file: 'components/Form.tsx', line: 28, column: 7 },
];

const mockBreakpoints: Breakpoint[] = [
  { id: '1', file: 'app.ts', line: 42, enabled: true },
  { id: '2', file: 'utils.ts', line: 15, condition: 'count > 10', enabled: true },
  { id: '3', file: 'api.ts', line: 88, enabled: false },
];

// Variable Tree Component
function VariableTree({ variable, depth = 0 }: { variable: Variable; depth?: number }) {
  const [expanded, setExpanded] = useState(depth < 1);

  return (
    <div className="font-mono text-sm">
      <div
        className={cn(
          'flex items-center gap-1 py-0.5 px-1 hover:bg-accent rounded cursor-pointer',
          depth > 0 && 'ml-4'
        )}
        onClick={() => variable.expandable && setExpanded(!expanded)}
      >
        {variable.expandable ? (
          expanded ? (
            <ChevronDown className="h-3 w-3 shrink-0" />
          ) : (
            <ChevronRight className="h-3 w-3 shrink-0" />
          )
        ) : (
          <span className="w-3" />
        )}
        <span className="text-blue-500 dark:text-blue-400">{variable.name}</span>
        <span className="text-muted-foreground">:</span>
        <span className="text-green-600 dark:text-green-400">{variable.type}</span>
        <span className="text-muted-foreground mx-1">=</span>
        <span className="text-orange-600 dark:text-orange-400 truncate">
          {String(variable.value)}
        </span>
      </div>
      {expanded && variable.children && (
        <div>
          {variable.children.map((child, i) => (
            <VariableTree key={i} variable={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

// Watch Expression Component
function WatchExpressions() {
  const [expressions, setExpressions] = useState<WatchExpression[]>([
    { id: '1', expression: 'user.name', value: '"John"', type: 'string' },
    { id: '2', expression: 'items.length', value: '3', type: 'number' },
  ]);
  const [newExpression, setNewExpression] = useState('');

  const addExpression = () => {
    if (newExpression.trim()) {
      setExpressions([
        ...expressions,
        { id: Date.now().toString(), expression: newExpression, value: 'undefined', type: 'undefined' },
      ]);
      setNewExpression('');
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          placeholder="Add watch expression..."
          value={newExpression}
          onChange={(e) => setNewExpression(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addExpression()}
          className="h-8 text-sm"
        />
        <Button size="sm" variant="outline" onClick={addExpression}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <div className="space-y-1">
        {expressions.map((exp) => (
          <div key={exp.id} className="flex items-center justify-between p-1 hover:bg-accent rounded font-mono text-sm">
            <div className="flex items-center gap-2">
              <span className="text-blue-500">{exp.expression}</span>
              <span className="text-muted-foreground">=</span>
              <span className="text-orange-600">{exp.value}</span>
              <Badge variant="outline" className="text-xs">{exp.type}</Badge>
            </div>
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setExpressions(expressions.filter((e) => e.id !== exp.id))}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

// Call Stack Component
function CallStackPanel() {
  return (
    <div className="space-y-1">
      {mockCallStack.map((frame, index) => (
        <div key={frame.id} className={cn('flex items-center gap-2 p-2 text-sm hover:bg-accent rounded cursor-pointer', index === 0 && 'bg-accent')}>
          <Badge variant={index === 0 ? 'default' : 'outline'} className="text-xs">{index + 1}</Badge>
          <span className="font-medium">{frame.name}</span>
          <span className="text-muted-foreground truncate">{frame.file}:{frame.line}</span>
        </div>
      ))}
    </div>
  );
}

// Breakpoints Panel
function BreakpointsPanel() {
  const [breakpoints, setBreakpoints] = useState(mockBreakpoints);

  return (
    <div className="space-y-2">
      {breakpoints.map((bp) => (
        <div key={bp.id} className={cn('flex items-center gap-2 p-2 text-sm hover:bg-accent rounded', !bp.enabled && 'opacity-50')}>
          <input
            type="checkbox"
            checked={bp.enabled}
            onChange={() => setBreakpoints(breakpoints.map((b) => (b.id === bp.id ? { ...b, enabled: !b.enabled } : b)))}
            className="h-4 w-4"
          />
          <div className="flex-1">
            <div className="font-mono">{bp.file}:{bp.line}</div>
            {bp.condition && <div className="text-xs text-muted-foreground">if: {bp.condition}</div>}
          </div>
          <Button size="icon" variant="ghost" className="h-6 w-6">
            <Pencil className="h-3 w-3" />
          </Button>
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setBreakpoints(breakpoints.filter((b) => b.id !== bp.id))}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      ))}
    </div>
  );
}

// Main Debugger Panel
export function DebuggerPanel() {
  const [isPaused, setIsPaused] = useState(true);
  const [activeTab, setActiveTab] = useState('variables');

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="py-3 px-4 border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">Visual Debugger</CardTitle>
          <div className="flex items-center gap-1">
            <Button size="sm" variant={isPaused ? 'default' : 'outline'} onClick={() => setIsPaused(!isPaused)}>
              {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            </Button>
            <Button size="sm" variant="outline" disabled={!isPaused}><StepOver className="h-4 w-4" /></Button>
            <Button size="sm" variant="outline" disabled={!isPaused}><StepInto className="h-4 w-4" /></Button>
            <Button size="sm" variant="outline" disabled={!isPaused}><StepOut className="h-4 w-4" /></Button>
            <Button size="sm" variant="outline"><Square className="h-4 w-4" /></Button>
            <Button size="sm" variant="outline"><RefreshCw className="h-4 w-4" /></Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 p-0 overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          <TabsList className="w-full justify-start rounded-none border-b px-2">
            <TabsTrigger value="variables" className="text-xs">Variables</TabsTrigger>
            <TabsTrigger value="watch" className="text-xs">Watch</TabsTrigger>
            <TabsTrigger value="callstack" className="text-xs">Call Stack</TabsTrigger>
            <TabsTrigger value="breakpoints" className="text-xs">Breakpoints</TabsTrigger>
          </TabsList>
          <ScrollArea className="flex-1">
            <TabsContent value="variables" className="p-2 m-0">
              <Accordion type="multiple" defaultValue={['local']}>
                <AccordionItem value="local">
                  <AccordionTrigger className="text-xs py-2">Local</AccordionTrigger>
                  <AccordionContent>{mockVariables.map((v, i) => <VariableTree key={i} variable={v} />)}</AccordionContent>
                </AccordionItem>
                <AccordionItem value="global">
                  <AccordionTrigger className="text-xs py-2">Global</AccordionTrigger>
                  <AccordionContent><div className="text-sm text-muted-foreground">No global variables</div></AccordionContent>
                </AccordionItem>
              </Accordion>
            </TabsContent>
            <TabsContent value="watch" className="p-2 m-0"><WatchExpressions /></TabsContent>
            <TabsContent value="callstack" className="p-2 m-0"><CallStackPanel /></TabsContent>
            <TabsContent value="breakpoints" className="p-2 m-0"><BreakpointsPanel /></TabsContent>
          </ScrollArea>
        </Tabs>
      </CardContent>
    </Card>
  );
}

export default DebuggerPanel;
