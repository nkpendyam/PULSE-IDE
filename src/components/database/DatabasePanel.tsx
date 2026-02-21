'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Database,
  Plus,
  Play,
  Save,
  Trash2,
  RefreshCw,
  Download,
  Table,
  ChevronRight,
  ChevronDown,
  Key,
  Link2,
  Server,
  X,
  Check,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Types
interface Connection {
  id: string;
  name: string;
  type: 'postgres' | 'mysql' | 'sqlite' | 'mongodb';
  host?: string;
  port?: number;
  database: string;
  status: 'connected' | 'disconnected' | 'error';
}

interface TableSchema {
  name: string;
  type: 'table' | 'view' | 'procedure';
  rowCount?: number;
  columns: ColumnInfo[];
}

interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  primaryKey: boolean;
  foreignKey?: string;
}

interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  executionTime: number;
}

// Mock data
const mockConnections: Connection[] = [
  { id: '1', name: 'Production DB', type: 'postgres', host: 'db.example.com', port: 5432, database: 'production', status: 'connected' },
  { id: '2', name: 'Local SQLite', type: 'sqlite', database: '/data/local.db', status: 'connected' },
];

const mockTables: TableSchema[] = [
  { name: 'users', type: 'table', rowCount: 15420, columns: [
    { name: 'id', type: 'INTEGER', nullable: false, primaryKey: true },
    { name: 'email', type: 'VARCHAR(255)', nullable: false, primaryKey: false },
    { name: 'name', type: 'VARCHAR(100)', nullable: true, primaryKey: false },
    { name: 'created_at', type: 'TIMESTAMP', nullable: false, primaryKey: false },
  ]},
  { name: 'posts', type: 'table', rowCount: 45678, columns: [
    { name: 'id', type: 'INTEGER', nullable: false, primaryKey: true },
    { name: 'user_id', type: 'INTEGER', nullable: false, primaryKey: false, foreignKey: 'users.id' },
    { name: 'title', type: 'VARCHAR(200)', nullable: false, primaryKey: false },
    { name: 'content', type: 'TEXT', nullable: true, primaryKey: false },
  ]},
  { name: 'comments', type: 'table', rowCount: 128903, columns: [] },
  { name: 'user_stats', type: 'view', columns: [] },
];

const mockQueryResult: QueryResult = {
  columns: ['id', 'email', 'name', 'created_at'],
  rows: [
    { id: 1, email: 'john@example.com', name: 'John Doe', created_at: '2024-01-15 10:30:00' },
    { id: 2, email: 'jane@example.com', name: 'Jane Smith', created_at: '2024-01-16 14:22:00' },
    { id: 3, email: 'bob@example.com', name: 'Bob Wilson', created_at: '2024-01-17 09:15:00' },
  ],
  rowCount: 3,
  executionTime: 45,
};

// Connection Panel
function ConnectionPanel() {
  const [connections, setConnections] = useState(mockConnections);
  const [showNewConnection, setShowNewConnection] = useState(false);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground">Connections</span>
        <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setShowNewConnection(!showNewConnection)}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      {showNewConnection && (
        <div className="p-2 border rounded space-y-2 mb-2">
          <Input placeholder="Connection name" className="h-8 text-sm" />
          <Select defaultValue="postgres">
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="postgres">PostgreSQL</SelectItem>
              <SelectItem value="mysql">MySQL</SelectItem>
              <SelectItem value="sqlite">SQLite</SelectItem>
              <SelectItem value="mongodb">MongoDB</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            <Button size="sm" className="flex-1"><Check className="h-4 w-4 mr-1" /> Connect</Button>
            <Button size="sm" variant="outline" onClick={() => setShowNewConnection(false)}><X className="h-4 w-4" /></Button>
          </div>
        </div>
      )}
      {connections.map((conn) => (
        <div key={conn.id} className="flex items-center gap-2 p-2 hover:bg-accent rounded cursor-pointer">
          <Server className={cn('h-4 w-4', conn.status === 'connected' ? 'text-green-500' : 'text-red-500')} />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{conn.name}</div>
            <div className="text-xs text-muted-foreground truncate">{conn.database}</div>
          </div>
          <Badge variant="outline" className="text-xs">{conn.type}</Badge>
        </div>
      ))}
    </div>
  );
}

// Schema Browser
function SchemaBrowser() {
  const [expandedTable, setExpandedTable] = useState<string | null>('users');

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground">Schema</span>
        <Button size="sm" variant="ghost" className="h-6 w-6 p-0"><RefreshCw className="h-3 w-3" /></Button>
      </div>
      {mockTables.map((table) => (
        <div key={table.name}>
          <div
            className="flex items-center gap-2 p-1 hover:bg-accent rounded cursor-pointer"
            onClick={() => setExpandedTable(expandedTable === table.name ? null : table.name)}
          >
            {expandedTable === table.name ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            <Table className="h-4 w-4 text-blue-500" />
            <span className="text-sm">{table.name}</span>
            {table.rowCount && <Badge variant="outline" className="text-xs ml-auto">{table.rowCount.toLocaleString()}</Badge>}
          </div>
          {expandedTable === table.name && table.columns.length > 0 && (
            <div className="ml-6 mt-1 space-y-0.5">
              {table.columns.map((col) => (
                <div key={col.name} className="flex items-center gap-2 text-xs p-1 hover:bg-accent rounded">
                  {col.primaryKey ? <Key className="h-3 w-3 text-yellow-500" /> : col.foreignKey ? <Link2 className="h-3 w-3 text-purple-500" /> : <span className="w-3" />}
                  <span className="text-blue-500">{col.name}</span>
                  <span className="text-muted-foreground">{col.type}</span>
                  {col.nullable && <Badge variant="outline" className="text-[10px]">NULL</Badge>}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// Query Editor
function QueryEditor() {
  const [query, setQuery] = useState('SELECT * FROM users LIMIT 10;');
  const [result, setResult] = useState<QueryResult | null>(mockQueryResult);
  const [history, setHistory] = useState<string[]>([
    'SELECT * FROM users WHERE id = 1;',
    'SELECT COUNT(*) FROM posts;',
    'UPDATE users SET name = \'John\' WHERE id = 1;',
  ]);

  const runQuery = () => {
    // Simulate query execution
    setResult(mockQueryResult);
    setHistory([query, ...history.slice(0, 9)]);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-2 border-b space-y-2">
        <Textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Enter SQL query..."
          className="font-mono text-sm min-h-[80px]"
        />
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={runQuery}><Play className="h-4 w-4 mr-1" /> Run</Button>
          <Button size="sm" variant="outline"><Save className="h-4 w-4 mr-1" /> Save</Button>
          <Button size="sm" variant="outline"><Download className="h-4 w-4 mr-1" /> Export</Button>
          <Badge variant="outline" className="ml-auto"><Clock className="h-3 w-3 mr-1" /> {result?.executionTime}ms</Badge>
        </div>
      </div>
      {result && (
        <ScrollArea className="flex-1">
          <div className="p-2">
            <div className="text-xs text-muted-foreground mb-2">{result.rowCount} rows</div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  {result.columns.map((col) => (
                    <th key={col} className="text-left p-2 font-medium bg-muted">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row, i) => (
                  <tr key={i} className="border-b hover:bg-accent">
                    {result.columns.map((col) => (
                      <td key={col} className="p-2 font-mono text-xs">{String(row[col])}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ScrollArea>
      )}
    </div>
  );
}

// Main Database Panel
export function DatabasePanel() {
  const [activeTab, setActiveTab] = useState('query');

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="py-3 px-4 border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Database className="h-4 w-4 text-blue-500" />
            Database Explorer
          </CardTitle>
          <Badge variant="default" className="text-xs">Connected</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex-1 p-0 overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          <TabsList className="w-full justify-start rounded-none border-b px-2">
            <TabsTrigger value="query" className="text-xs">Query</TabsTrigger>
            <TabsTrigger value="schema" className="text-xs">Schema</TabsTrigger>
            <TabsTrigger value="connections" className="text-xs">Connections</TabsTrigger>
            <TabsTrigger value="history" className="text-xs">History</TabsTrigger>
          </TabsList>
          <div className="flex-1 overflow-hidden">
            <TabsContent value="query" className="h-full m-0"><QueryEditor /></TabsContent>
            <TabsContent value="schema" className="h-full m-0 p-2"><SchemaBrowser /></TabsContent>
            <TabsContent value="connections" className="h-full m-0 p-2"><ConnectionPanel /></TabsContent>
            <TabsContent value="history" className="h-full m-0 p-2">
              <div className="space-y-1">
                {['SELECT * FROM users;', 'SELECT COUNT(*) FROM posts;', 'UPDATE users SET name = \'John\';'].map((q, i) => (
                  <div key={i} className="p-2 hover:bg-accent rounded cursor-pointer font-mono text-sm truncate">{q}</div>
                ))}
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </CardContent>
    </Card>
  );
}

export default DatabasePanel;
