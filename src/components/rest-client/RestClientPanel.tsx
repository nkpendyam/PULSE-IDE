'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Send,
  Save,
  Copy,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Plus,
  Folder,
  File,
  ChevronRight,
  ChevronDown,
  Trash2,
  Download,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Types
interface HttpRequest {
  id: string;
  name: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';
  url: string;
  headers: Record<string, string>;
  body?: string;
  auth?: AuthConfig;
}

interface HttpResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  time: number;
  size: number;
}

interface AuthConfig {
  type: 'bearer' | 'basic' | 'api-key' | 'none';
  token?: string;
  username?: string;
  password?: string;
  key?: string;
  value?: string;
}

interface RequestCollection {
  id: string;
  name: string;
  requests: HttpRequest[];
}

// Mock data
const mockCollections: RequestCollection[] = [
  {
    id: '1',
    name: 'User API',
    requests: [
      { id: '1', name: 'Get Users', method: 'GET', url: 'https://api.example.com/users', headers: {} },
      { id: '2', name: 'Create User', method: 'POST', url: 'https://api.example.com/users', headers: { 'Content-Type': 'application/json' }, body: '{"name": "John"}' },
    ],
  },
  {
    id: '2',
    name: 'Auth API',
    requests: [
      { id: '3', name: 'Login', method: 'POST', url: 'https://api.example.com/auth/login', headers: {}, body: '{"email": "user@example.com", "password": "secret"}' },
    ],
  },
];

const mockResponse: HttpResponse = {
  status: 200,
  statusText: 'OK',
  headers: {
    'content-type': 'application/json',
    'x-request-id': 'abc-123',
    'date': new Date().toISOString(),
  },
  body: JSON.stringify({
    users: [
      { id: 1, name: 'John Doe', email: 'john@example.com' },
      { id: 2, name: 'Jane Smith', email: 'jane@example.com' },
    ],
    total: 2,
    page: 1,
  }, null, 2),
  time: 234,
  size: 256,
};

// Method color mapping
const methodColors: Record<string, string> = {
  GET: 'text-green-500',
  POST: 'text-blue-500',
  PUT: 'text-orange-500',
  PATCH: 'text-yellow-500',
  DELETE: 'text-red-500',
  HEAD: 'text-purple-500',
  OPTIONS: 'text-gray-500',
};

// Status code color mapping
const getStatusColor = (status: number) => {
  if (status >= 200 && status < 300) return 'text-green-500';
  if (status >= 300 && status < 400) return 'text-yellow-500';
  if (status >= 400 && status < 500) return 'text-orange-500';
  return 'text-red-500';
};

// Collections Sidebar
function CollectionsSidebar() {
  const [collections, setCollections] = useState(mockCollections);
  const [expandedCollection, setExpandedCollection] = useState<string | null>('1');
  const [selectedRequest, setSelectedRequest] = useState<string>('1');

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground">Collections</span>
        <Button size="sm" variant="ghost" className="h-6 w-6 p-0"><Plus className="h-4 w-4" /></Button>
      </div>
      {collections.map((collection) => (
        <div key={collection.id}>
          <div
            className="flex items-center gap-2 p-1 hover:bg-accent rounded cursor-pointer"
            onClick={() => setExpandedCollection(expandedCollection === collection.id ? null : collection.id)}
          >
            {expandedCollection === collection.id ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            <Folder className="h-4 w-4 text-yellow-500" />
            <span className="text-sm">{collection.name}</span>
          </div>
          {expandedCollection === collection.id && (
            <div className="ml-4 space-y-0.5">
              {collection.requests.map((req) => (
                <div
                  key={req.id}
                  className={cn('flex items-center gap-2 p-1 hover:bg-accent rounded cursor-pointer', selectedRequest === req.id && 'bg-accent')}
                  onClick={() => setSelectedRequest(req.id)}
                >
                  <File className="h-3 w-3" />
                  <span className={cn('text-xs font-mono', methodColors[req.method])}>{req.method}</span>
                  <span className="text-sm truncate">{req.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// Request Builder
function RequestBuilder() {
  const [method, setMethod] = useState<'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'>('GET');
  const [url, setUrl] = useState('https://api.example.com/users');
  const [headers, setHeaders] = useState<{ key: string; value: string }[]>([
    { key: 'Content-Type', value: 'application/json' },
    { key: 'Authorization', value: 'Bearer token123' },
  ]);
  const [body, setBody] = useState('{\n  "name": "John Doe",\n  "email": "john@example.com"\n}');
  const [response, setResponse] = useState<HttpResponse | null>(mockResponse);
  const [activeTab, setActiveTab] = useState('params');

  const sendRequest = () => {
    // Simulate sending request
    setResponse(mockResponse);
  };

  return (
    <div className="flex flex-col h-full">
      {/* URL Bar */}
      <div className="p-2 border-b flex gap-2">
        <Select value={method} onValueChange={(v) => setMethod(v as typeof method)}>
          <SelectTrigger className="w-24 h-8">
            <span className={cn('font-mono', methodColors[method])}>{method}</span>
          </SelectTrigger>
          <SelectContent>
            {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => (
              <SelectItem key={m} value={m}><span className={cn('font-mono', methodColors[m])}>{m}</span></SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Enter request URL..."
          className="flex-1 h-8 font-mono text-sm"
        />
        <Button size="sm" onClick={sendRequest}><Send className="h-4 w-4 mr-1" /> Send</Button>
        <Button size="sm" variant="outline"><Save className="h-4 w-4" /></Button>
      </div>

      {/* Request Tabs */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <TabsList className="w-full justify-start rounded-none border-b px-2 h-8">
            <TabsTrigger value="params" className="text-xs">Params</TabsTrigger>
            <TabsTrigger value="headers" className="text-xs">Headers</TabsTrigger>
            <TabsTrigger value="body" className="text-xs">Body</TabsTrigger>
            <TabsTrigger value="auth" className="text-xs">Auth</TabsTrigger>
          </TabsList>
          <ScrollArea className="flex-1">
            <TabsContent value="params" className="p-2 m-0">
              <div className="text-sm text-muted-foreground">Query parameters will appear here</div>
            </TabsContent>
            <TabsContent value="headers" className="p-2 m-0 space-y-1">
              {headers.map((h, i) => (
                <div key={i} className="flex gap-2">
                  <Input value={h.key} onChange={(e) => setHeaders(headers.map((hh, ii) => ii === i ? { ...hh, key: e.target.value } : hh))} className="h-7 text-sm font-mono" placeholder="Header name" />
                  <Input value={h.value} onChange={(e) => setHeaders(headers.map((hh, ii) => ii === i ? { ...hh, value: e.target.value } : hh))} className="h-7 text-sm font-mono flex-1" placeholder="Header value" />
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setHeaders(headers.filter((_, ii) => ii !== i))}><Trash2 className="h-3 w-3" /></Button>
                </div>
              ))}
              <Button size="sm" variant="outline" className="w-full" onClick={() => setHeaders([...headers, { key: '', value: '' }])}><Plus className="h-4 w-4 mr-1" /> Add Header</Button>
            </TabsContent>
            <TabsContent value="body" className="p-2 m-0">
              <Textarea value={body} onChange={(e) => setBody(e.target.value)} className="font-mono text-sm min-h-[200px]" placeholder="Request body..." />
            </TabsContent>
            <TabsContent value="auth" className="p-2 m-0">
              <Select defaultValue="bearer">
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Auth</SelectItem>
                  <SelectItem value="bearer">Bearer Token</SelectItem>
                  <SelectItem value="basic">Basic Auth</SelectItem>
                  <SelectItem value="api-key">API Key</SelectItem>
                </SelectContent>
              </Select>
              <Input placeholder="Token" className="h-8 mt-2" />
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </div>

      {/* Response */}
      {response && (
        <div className="border-t flex-1 flex flex-col">
          <div className="p-2 border-b flex items-center gap-4">
            <div className={cn('flex items-center gap-1', getStatusColor(response.status))}>
              {response.status < 300 ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
              <span className="font-mono font-medium">{response.status}</span>
              <span className="text-muted-foreground">{response.statusText}</span>
            </div>
            <div className="flex items-center gap-1 text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>{response.time}ms</span>
            </div>
            <div className="text-muted-foreground">{response.size} B</div>
            <div className="ml-auto flex gap-1">
              <Button size="sm" variant="ghost"><Copy className="h-4 w-4" /></Button>
              <Button size="sm" variant="ghost"><Download className="h-4 w-4" /></Button>
            </div>
          </div>
          <ScrollArea className="flex-1">
            <pre className="p-2 text-xs font-mono whitespace-pre-wrap">{response.body}</pre>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}

// Main REST Client Panel
export function RestClientPanel() {
  const [activeTab, setActiveTab] = useState('request');

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="py-3 px-4 border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Send className="h-4 w-4 text-blue-500" />
            REST Client
          </CardTitle>
          <Badge variant="outline" className="text-xs">API Testing</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex-1 p-0 overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          <TabsList className="w-full justify-start rounded-none border-b px-2">
            <TabsTrigger value="request" className="text-xs">Request</TabsTrigger>
            <TabsTrigger value="collections" className="text-xs">Collections</TabsTrigger>
            <TabsTrigger value="history" className="text-xs">History</TabsTrigger>
            <TabsTrigger value="environments" className="text-xs">Environments</TabsTrigger>
          </TabsList>
          <div className="flex-1 overflow-hidden">
            <TabsContent value="request" className="h-full m-0"><RequestBuilder /></TabsContent>
            <TabsContent value="collections" className="h-full m-0 p-2"><CollectionsSidebar /></TabsContent>
            <TabsContent value="history" className="h-full m-0 p-2">
              <div className="space-y-1">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-2 p-2 hover:bg-accent rounded cursor-pointer">
                    <span className={cn('text-xs font-mono', methodColors.GET)}>GET</span>
                    <span className="text-sm truncate flex-1">https://api.example.com/users</span>
                    <span className="text-xs text-muted-foreground">2m ago</span>
                  </div>
                ))}
              </div>
            </TabsContent>
            <TabsContent value="environments" className="h-full m-0 p-2">
              <div className="space-y-2">
                <div className="flex items-center justify-between p-2 border rounded">
                  <div className="font-medium">Production</div>
                  <Badge variant="default">Active</Badge>
                </div>
                <div className="flex items-center justify-between p-2 border rounded">
                  <div className="font-medium">Development</div>
                  <Badge variant="outline">Local</Badge>
                </div>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </CardContent>
    </Card>
  );
}

export default RestClientPanel;
