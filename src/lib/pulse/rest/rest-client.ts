/**
 * Kyro REST Client - HTTP Client Engine
 * 
 * A comprehensive HTTP client with features:
 * - All HTTP methods (GET, POST, PUT, DELETE, PATCH, etc.)
 * - Request builder with headers, body, auth
 * - Response parsing (JSON, XML, text, binary)
 * - Request/response history
 * - Collections/folders for organizing requests
 * - Environment variables support
 */

import { EventEmitter } from 'events';
import {
  RequestBuilder,
  type HttpRequest,
  type HttpMethod,
  type KeyValue,
  type FormDataItem,
  type AuthConfig,
} from './request-builder';
import {
  ResponseViewer,
  buildHttpResponse,
  buildErrorResponse,
  type HttpResponse,
  type TimingInfo,
  type RedirectInfo,
} from './response-viewer';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface Environment {
  id: string;
  name: string;
  description?: string;
  variables: EnvironmentVariable[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface EnvironmentVariable extends KeyValue {
  /** Variable is secret (masked in UI) */
  secret?: boolean;
}

export interface RequestFolder {
  id: string;
  name: string;
  description?: string;
  parentId?: string;
  /** Folder color for UI */
  color?: string;
  /** Folder icon */
  icon?: string;
  /** Sort order */
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface RequestCollection {
  id: string;
  name: string;
  description?: string;
  /** Collection version */
  version?: string;
  /** Base URL for all requests in collection */
  baseUrl?: string;
  /** Folders in this collection */
  folders: RequestFolder[];
  /** Requests in this collection */
  requests: HttpRequest[];
  /** Environment variables for this collection */
  environments: Environment[];
  /** Active environment ID */
  activeEnvironmentId?: string;
  /** Collection-level auth */
  auth?: AuthConfig;
  /** Collection variables */
  variables: KeyValue[];
  /** Creation timestamp */
  createdAt: Date;
  /** Last modified timestamp */
  updatedAt: Date;
}

export interface HistoryEntry {
  id: string;
  request: HttpRequest;
  response: HttpResponse;
  timestamp: Date;
  /** Collection ID if request was from a collection */
  collectionId?: string;
}

export interface RestClientConfig {
  /** Maximum history entries to keep */
  maxHistorySize?: number;
  /** Default timeout in milliseconds */
  defaultTimeout?: number;
  /** Enable request/response logging */
  enableLogging?: boolean;
  /** Base URL for all requests */
  baseUrl?: string;
}

export interface RequestOptions {
  /** Override timeout */
  timeout?: number;
  /** Override follow redirects */
  followRedirects?: boolean;
  /** Abort signal for cancellation */
  signal?: AbortSignal;
  /** Callback for upload progress */
  onUploadProgress?: (progress: ProgressInfo) => void;
  /** Callback for download progress */
  onDownloadProgress?: (progress: ProgressInfo) => void;
}

export interface ProgressInfo {
  loaded: number;
  total: number;
  percentage: number;
}

export type RestClientEvent = 
  | 'request:start'
  | 'request:progress'
  | 'request:complete'
  | 'request:error'
  | 'history:updated'
  | 'collection:updated'
  | 'environment:updated';

// ============================================================================
// REST CLIENT CLASS
// ============================================================================

export class RestClient extends EventEmitter {
  private static instance: RestClient | null = null;
  
  private config: Required<RestClientConfig>;
  private history: HistoryEntry[] = [];
  private collections: Map<string, RequestCollection> = new Map();
  private environments: Map<string, Environment> = new Map();
  private activeEnvironment: Environment | null = null;
  private abortControllers: Map<string, AbortController> = new Map();

  private constructor(config: RestClientConfig = {}) {
    super();
    this.config = {
      maxHistorySize: config.maxHistorySize ?? 100,
      defaultTimeout: config.defaultTimeout ?? 30000,
      enableLogging: config.enableLogging ?? true,
      baseUrl: config.baseUrl ?? '',
    };
  }

  /**
   * Get singleton instance
   */
  static getInstance(config?: RestClientConfig): RestClient {
    if (!RestClient.instance) {
      RestClient.instance = new RestClient(config);
    }
    return RestClient.instance;
  }

  // =========================================================================
  // HTTP METHODS
  // =========================================================================

  /**
   * Perform GET request
   */
  async get(url: string, options?: RequestOptions): Promise<{ response: ResponseViewer; timing: TimingInfo }> {
    const builder = new RequestBuilder().setMethod('GET').setUrl(url);
    return this.execute(builder, options);
  }

  /**
   * Perform POST request
   */
  async post(url: string, body?: unknown, options?: RequestOptions): Promise<{ response: ResponseViewer; timing: TimingInfo }> {
    const builder = new RequestBuilder().setMethod('POST').setUrl(url);
    if (body) {
      if (typeof body === 'object') {
        builder.jsonBody(body);
      } else {
        builder.rawBody(String(body));
      }
    }
    return this.execute(builder, options);
  }

  /**
   * Perform PUT request
   */
  async put(url: string, body?: unknown, options?: RequestOptions): Promise<{ response: ResponseViewer; timing: TimingInfo }> {
    const builder = new RequestBuilder().setMethod('PUT').setUrl(url);
    if (body) {
      builder.jsonBody(body as object);
    }
    return this.execute(builder, options);
  }

  /**
   * Perform PATCH request
   */
  async patch(url: string, body?: unknown, options?: RequestOptions): Promise<{ response: ResponseViewer; timing: TimingInfo }> {
    const builder = new RequestBuilder().setMethod('PATCH').setUrl(url);
    if (body) {
      builder.jsonBody(body as object);
    }
    return this.execute(builder, options);
  }

  /**
   * Perform DELETE request
   */
  async delete(url: string, options?: RequestOptions): Promise<{ response: ResponseViewer; timing: TimingInfo }> {
    const builder = new RequestBuilder().setMethod('DELETE').setUrl(url);
    return this.execute(builder, options);
  }

  /**
   * Perform HEAD request
   */
  async head(url: string, options?: RequestOptions): Promise<{ response: ResponseViewer; timing: TimingInfo }> {
    const builder = new RequestBuilder().setMethod('HEAD').setUrl(url);
    return this.execute(builder, options);
  }

  /**
   * Perform OPTIONS request
   */
  async options(url: string, options?: RequestOptions): Promise<{ response: ResponseViewer; timing: TimingInfo }> {
    const builder = new RequestBuilder().setMethod('OPTIONS').setUrl(url);
    return this.execute(builder, options);
  }

  /**
   * Execute a request builder
   */
  async execute(
    builder: RequestBuilder,
    options: RequestOptions = {}
  ): Promise<{ response: ResponseViewer; timing: TimingInfo }> {
    // Apply environment variables
    this.applyEnvironmentVariables(builder);

    // Build request with auth
    const request = builder.buildWithAuth();
    const requestId = request.id;

    // Create abort controller
    const abortController = new AbortController();
    this.abortControllers.set(requestId, abortController);

    // Combine signals
    if (options.signal) {
      options.signal.addEventListener('abort', () => abortController.abort());
    }

    const startTime = performance.now();
    const timings: Partial<TimingInfo> = {};

    this.emit('request:start', { request, timestamp: new Date() });

    try {
      // Prepare fetch options
      const fetchOptions: RequestInit = {
        method: request.method,
        headers: this.buildFetchHeaders(request.headers),
        signal: abortController.signal,
        redirect: request.followRedirects ? 'follow' : 'manual',
      };

      // Add body for methods that support it
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
        const body = builder.getBodyContent();
        if (body) {
          fetchOptions.body = body;
        }
      }

      // Build full URL
      let fullUrl = builder.getFullUrl();
      if (this.config.baseUrl && !fullUrl.startsWith('http')) {
        fullUrl = `${this.config.baseUrl}${fullUrl.startsWith('/') ? '' : '/'}${fullUrl}`;
      }

      // Execute request
      timings.preparation = performance.now() - startTime;
      const fetchStart = performance.now();

      const response = await fetch(fullUrl, fetchOptions);

      timings.waiting = performance.now() - fetchStart;
      const downloadStart = performance.now();

      // Handle redirects
      const redirects = this.extractRedirects(response);

      // Build response
      const timing: TimingInfo = {
        ...timings,
        total: performance.now() - startTime,
      };

      const httpResponse = await buildHttpResponse(requestId, response, timing, redirects);

      timings.download = performance.now() - downloadStart;
      timing.total = performance.now() - startTime;

      // Add to history
      const historyEntry: HistoryEntry = {
        id: `hist-${Date.now()}`,
        request,
        response: httpResponse,
        timestamp: new Date(),
      };
      this.addToHistory(historyEntry);

      const viewer = new ResponseViewer(httpResponse);
      this.emit('request:complete', { request, response: httpResponse, timing });

      return { response: viewer, timing };
    } catch (error) {
      const timing: TimingInfo = {
        ...timings,
        total: performance.now() - startTime,
      };

      const httpResponse = buildErrorResponse(requestId, error as Error, startTime);
      const viewer = new ResponseViewer(httpResponse);

      this.emit('request:error', { request, error, timing });

      return { response: viewer, timing };
    } finally {
      this.abortControllers.delete(requestId);
    }
  }

  /**
   * Execute request from stored request object
   */
  async executeRequest(request: HttpRequest, options?: RequestOptions): Promise<{ response: ResponseViewer; timing: TimingInfo }> {
    const builder = RequestBuilder.fromRequest(request);
    return this.execute(builder, options);
  }

  /**
   * Cancel an ongoing request
   */
  cancelRequest(requestId: string): boolean {
    const controller = this.abortControllers.get(requestId);
    if (controller) {
      controller.abort();
      this.abortControllers.delete(requestId);
      return true;
    }
    return false;
  }

  /**
   * Cancel all ongoing requests
   */
  cancelAllRequests(): void {
    const controllers = Array.from(this.abortControllers.values());
    for (const controller of controllers) {
      controller.abort();
    }
    this.abortControllers.clear();
  }

  // =========================================================================
  // COLLECTIONS MANAGEMENT
  // =========================================================================

  /**
   * Create a new collection
   */
  createCollection(name: string, description?: string): RequestCollection {
    const collection: RequestCollection = {
      id: `col-${Date.now()}`,
      name,
      description,
      folders: [],
      requests: [],
      environments: [],
      variables: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.collections.set(collection.id, collection);
    this.emit('collection:updated', { collection, action: 'create' });
    return collection;
  }

  /**
   * Get collection by ID
   */
  getCollection(id: string): RequestCollection | undefined {
    return this.collections.get(id);
  }

  /**
   * Get all collections
   */
  getCollections(): RequestCollection[] {
    return Array.from(this.collections.values());
  }

  /**
   * Update collection
   */
  updateCollection(id: string, updates: Partial<RequestCollection>): RequestCollection | undefined {
    const collection = this.collections.get(id);
    if (!collection) return undefined;

    Object.assign(collection, updates, { updatedAt: new Date() });
    this.emit('collection:updated', { collection, action: 'update' });
    return collection;
  }

  /**
   * Delete collection
   */
  deleteCollection(id: string): boolean {
    const deleted = this.collections.delete(id);
    if (deleted) {
      this.emit('collection:updated', { collectionId: id, action: 'delete' });
    }
    return deleted;
  }

  /**
   * Add request to collection
   */
  addRequestToCollection(collectionId: string, request: HttpRequest): boolean {
    const collection = this.collections.get(collectionId);
    if (!collection) return false;

    request.folderId = collectionId;
    collection.requests.push(request);
    collection.updatedAt = new Date();
    this.emit('collection:updated', { collection, action: 'update' });
    return true;
  }

  /**
   * Remove request from collection
   */
  removeRequestFromCollection(collectionId: string, requestId: string): boolean {
    const collection = this.collections.get(collectionId);
    if (!collection) return false;

    const index = collection.requests.findIndex(r => r.id === requestId);
    if (index !== -1) {
      collection.requests.splice(index, 1);
      collection.updatedAt = new Date();
      this.emit('collection:updated', { collection, action: 'update' });
      return true;
    }
    return false;
  }

  /**
   * Create folder in collection
   */
  createFolder(collectionId: string, name: string, parentId?: string): RequestFolder | undefined {
    const collection = this.collections.get(collectionId);
    if (!collection) return undefined;

    const folder: RequestFolder = {
      id: `folder-${Date.now()}`,
      name,
      parentId,
      order: collection.folders.length,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    collection.folders.push(folder);
    collection.updatedAt = new Date();
    this.emit('collection:updated', { collection, action: 'update' });
    return folder;
  }

  /**
   * Get folders in collection
   */
  getFolders(collectionId: string): RequestFolder[] {
    const collection = this.collections.get(collectionId);
    if (!collection) return [];

    return collection.folders.sort((a, b) => a.order - b.order);
  }

  /**
   * Get requests in folder
   */
  getRequestsInFolder(collectionId: string, folderId?: string): HttpRequest[] {
    const collection = this.collections.get(collectionId);
    if (!collection) return [];

    return collection.requests.filter(r => r.folderId === folderId);
  }

  // =========================================================================
  // ENVIRONMENT VARIABLES
  // =========================================================================

  /**
   * Create environment
   */
  createEnvironment(name: string, variables: EnvironmentVariable[] = []): Environment {
    const environment: Environment = {
      id: `env-${Date.now()}`,
      name,
      variables,
      isActive: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.environments.set(environment.id, environment);
    this.emit('environment:updated', { environment, action: 'create' });
    return environment;
  }

  /**
   * Get environment by ID
   */
  getEnvironment(id: string): Environment | undefined {
    return this.environments.get(id);
  }

  /**
   * Get all environments
   */
  getEnvironments(): Environment[] {
    return Array.from(this.environments.values());
  }

  /**
   * Set active environment
   */
  setActiveEnvironment(id: string | null): void {
    // Deactivate current
    if (this.activeEnvironment) {
      this.activeEnvironment.isActive = false;
    }

    if (id) {
      const environment = this.environments.get(id);
      if (environment) {
        environment.isActive = true;
        this.activeEnvironment = environment;
      }
    } else {
      this.activeEnvironment = null;
    }

    this.emit('environment:updated', { activeEnvironmentId: id, action: 'activate' });
  }

  /**
   * Get active environment
   */
  getActiveEnvironment(): Environment | null {
    return this.activeEnvironment;
  }

  /**
   * Update environment
   */
  updateEnvironment(id: string, updates: Partial<Environment>): Environment | undefined {
    const environment = this.environments.get(id);
    if (!environment) return undefined;

    Object.assign(environment, updates, { updatedAt: new Date() });
    this.emit('environment:updated', { environment, action: 'update' });
    return environment;
  }

  /**
   * Delete environment
   */
  deleteEnvironment(id: string): boolean {
    const deleted = this.environments.delete(id);
    if (deleted) {
      if (this.activeEnvironment?.id === id) {
        this.activeEnvironment = null;
      }
      this.emit('environment:updated', { environmentId: id, action: 'delete' });
    }
    return deleted;
  }

  /**
   * Add variable to environment
   */
  addEnvironmentVariable(envId: string, key: string, value: string, secret: boolean = false): boolean {
    const environment = this.environments.get(envId);
    if (!environment) return false;

    environment.variables.push({ key, value, secret, enabled: true });
    environment.updatedAt = new Date();
    this.emit('environment:updated', { environment, action: 'update' });
    return true;
  }

  /**
   * Apply environment variables to request builder
   */
  private applyEnvironmentVariables(builder: RequestBuilder): void {
    if (!this.activeEnvironment) return;

    const replaceVariables = (text: string): string => {
      let result = text;
      for (const variable of this.activeEnvironment!.variables) {
        if (variable.enabled) {
          const regex = new RegExp(`\\{\\{${variable.key}\\}\\}`, 'g');
          result = result.replace(regex, variable.value);
        }
      }
      return result;
    };

    // Replace in URL
    const request = builder.build();
    builder.setUrl(replaceVariables(request.url));

    // Replace in headers
    for (const header of request.headers) {
      builder.removeHeader(header.key);
      builder.addHeader(
        replaceVariables(header.key),
        replaceVariables(header.value),
        { enabled: header.enabled, description: header.description }
      );
    }

    // Replace in body if JSON
    if (request.body.type === 'json' && typeof request.body.json === 'string') {
      builder.jsonBody(replaceVariables(request.body.json));
    }
  }

  // =========================================================================
  // HISTORY MANAGEMENT
  // =========================================================================

  /**
   * Get request history
   */
  getHistory(limit?: number): HistoryEntry[] {
    const entries = [...this.history].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return limit ? entries.slice(0, limit) : entries;
  }

  /**
   * Get history entry by ID
   */
  getHistoryEntry(id: string): HistoryEntry | undefined {
    return this.history.find(h => h.id === id);
  }

  /**
   * Clear history
   */
  clearHistory(): void {
    this.history = [];
    this.emit('history:updated', { action: 'clear' });
  }

  /**
   * Remove history entry
   */
  removeHistoryEntry(id: string): boolean {
    const index = this.history.findIndex(h => h.id === id);
    if (index !== -1) {
      this.history.splice(index, 1);
      this.emit('history:updated', { action: 'remove', id });
      return true;
    }
    return false;
  }

  /**
   * Add entry to history
   */
  private addToHistory(entry: HistoryEntry): void {
    this.history.unshift(entry);

    // Trim to max size
    if (this.history.length > this.config.maxHistorySize) {
      this.history = this.history.slice(0, this.config.maxHistorySize);
    }

    this.emit('history:updated', { action: 'add', entry });
  }

  // =========================================================================
  // IMPORT/EXPORT
  // =========================================================================

  /**
   * Export collection to JSON
   */
  exportCollection(id: string): string | undefined {
    const collection = this.collections.get(id);
    if (!collection) return undefined;

    return JSON.stringify(collection, null, 2);
  }

  /**
   * Import collection from JSON
   */
  importCollection(json: string): RequestCollection | undefined {
    try {
      const collection = JSON.parse(json) as RequestCollection;
      collection.id = `col-${Date.now()}`;
      collection.createdAt = new Date();
      collection.updatedAt = new Date();
      
      // Regenerate IDs for requests and folders
      const idMap = new Map<string, string>();
      
      for (const folder of collection.folders) {
        const oldId = folder.id;
        folder.id = `folder-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        idMap.set(oldId, folder.id);
      }

      for (const request of collection.requests) {
        request.id = `req-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        if (request.folderId && idMap.has(request.folderId)) {
          request.folderId = idMap.get(request.folderId);
        }
      }

      this.collections.set(collection.id, collection);
      this.emit('collection:updated', { collection, action: 'import' });
      return collection;
    } catch {
      return undefined;
    }
  }

  /**
   * Export history to JSON
   */
  exportHistory(): string {
    return JSON.stringify(this.history, null, 2);
  }

  /**
   * Import history from JSON
   */
  importHistory(json: string, merge: boolean = true): number {
    try {
      const entries = JSON.parse(json) as HistoryEntry[];
      
      if (merge) {
        this.history.push(...entries);
      } else {
        this.history = entries;
      }

      // Sort by timestamp
      this.history.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      // Trim to max size
      if (this.history.length > this.config.maxHistorySize) {
        this.history = this.history.slice(0, this.config.maxHistorySize);
      }

      this.emit('history:updated', { action: 'import' });
      return entries.length;
    } catch {
      return 0;
    }
  }

  // =========================================================================
  // HELPER METHODS
  // =========================================================================

  /**
   * Build fetch headers from header array
   */
  private buildFetchHeaders(headers: HttpRequest['headers']): HeadersInit {
    const fetchHeaders: HeadersInit = {};
    for (const header of headers) {
      if (header.enabled && header.key) {
        fetchHeaders[header.key] = header.value;
      }
    }
    return fetchHeaders;
  }

  /**
   * Extract redirect information from response
   */
  private extractRedirects(response: Response): RedirectInfo[] {
    // In browser, redirect information is limited
    // This would need to be enhanced with custom redirect handling
    const redirects: RedirectInfo[] = [];
    
    if (response.redirected && response.url) {
      redirects.push({
        url: response.url,
        statusCode: response.status,
        headers: [],
      });
    }

    return redirects;
  }

  /**
   * Generate cURL command for request
   */
  generateCurl(request: HttpRequest): string {
    const builder = RequestBuilder.fromRequest(request);
    return builder.toCurl();
  }

  /**
   * Generate fetch code for request
   */
  generateFetch(request: HttpRequest): string {
    const builder = RequestBuilder.fromRequest(request);
    return builder.toFetch();
  }

  /**
   * Generate code in various languages
   */
  generateCode(request: HttpRequest, language: 'curl' | 'fetch' | 'axios' | 'http' | 'python'): string {
    switch (language) {
      case 'curl':
        return this.generateCurl(request);
      case 'fetch':
        return this.generateFetch(request);
      case 'axios':
        return this.generateAxios(request);
      case 'http':
        return this.generateHttp(request);
      case 'python':
        return this.generatePython(request);
      default:
        return this.generateCurl(request);
    }
  }

  /**
   * Generate Axios code
   */
  private generateAxios(request: HttpRequest): string {
    const builder = RequestBuilder.fromRequest(request);
    const url = builder.getFullUrl();
    const headers = builder.getHeadersObject();
    const body = builder.getBodyContent();

    let code = `import axios from 'axios';\n\n`;
    code += `axios({\n`;
    code += `  method: '${request.method.toLowerCase()}',\n`;
    code += `  url: '${url}',\n`;
    
    if (Object.keys(headers).length > 0) {
      code += `  headers: ${JSON.stringify(headers, null, 4)},\n`;
    }
    
    if (body && typeof body === 'string') {
      code += `  data: ${JSON.stringify(body)},\n`;
    }
    
    code += `})\n`;
    code += `.then(response => {\n`;
    code += `  console.log(response.data);\n`;
    code += `})\n`;
    code += `.catch(error => {\n`;
    code += `  console.error(error);\n`;
    code += `});`;

    return code;
  }

  /**
   * Generate HTTP (Node.js) code
   */
  private generateHttp(request: HttpRequest): string {
    const builder = RequestBuilder.fromRequest(request);
    const url = new URL(builder.getFullUrl());
    const headers = builder.getHeadersObject();

    let code = `const http = require('http');\n\n`;
    code += `const options = {\n`;
    code += `  hostname: '${url.hostname}',\n`;
    code += `  port: ${url.port || 443},\n`;
    code += `  path: '${url.pathname}${url.search}',\n`;
    code += `  method: '${request.method}',\n`;
    code += `  headers: ${JSON.stringify(headers, null, 4)}\n`;
    code += `};\n\n`;
    code += `const req = http.request(options, res => {\n`;
    code += `  let data = '';\n`;
    code += `  res.on('data', chunk => { data += chunk; });\n`;
    code += `  res.on('end', () => { console.log(data); });\n`;
    code += `});\n\n`;
    code += `req.on('error', error => { console.error(error); });\n`;
    code += `req.end();`;

    return code;
  }

  /**
   * Generate Python requests code
   */
  private generatePython(request: HttpRequest): string {
    const builder = RequestBuilder.fromRequest(request);
    const url = builder.getFullUrl();
    const headers = builder.getHeadersObject();
    const body = builder.getBodyContent();

    let code = `import requests\n\n`;
    code += `url = '${url}'\n`;
    
    if (Object.keys(headers).length > 0) {
      code += `headers = ${JSON.stringify(headers, null, 4)}\n`;
    }
    
    code += `\nresponse = requests.${request.method.toLowerCase()}(url`;
    
    if (Object.keys(headers).length > 0) {
      code += `, headers=headers`;
    }
    
    if (body && typeof body === 'string') {
      code += `, json=${JSON.stringify(JSON.parse(body))}`;
    }
    
    code += `)\n\n`;
    code += `print(response.status_code)\n`;
    code += `print(response.json())`;

    return code;
  }
}

// ============================================================================
// CONVENIENCE EXPORTS
// ============================================================================

/**
 * Get REST client instance
 */
export const getRestClient = (): RestClient => RestClient.getInstance();

/**
 * Quick request methods
 */
export const http = {
  get: (url: string, options?: RequestOptions) => getRestClient().get(url, options),
  post: (url: string, body?: unknown, options?: RequestOptions) => getRestClient().post(url, body, options),
  put: (url: string, body?: unknown, options?: RequestOptions) => getRestClient().put(url, body, options),
  patch: (url: string, body?: unknown, options?: RequestOptions) => getRestClient().patch(url, body, options),
  delete: (url: string, options?: RequestOptions) => getRestClient().delete(url, options),
  head: (url: string, options?: RequestOptions) => getRestClient().head(url, options),
  options: (url: string, options?: RequestOptions) => getRestClient().options(url, options),
};

// Re-export types and builders
export { RequestBuilder, ResponseViewer };
export type { 
  HttpRequest,
  HttpMethod,
  KeyValue,
  FormDataItem,
  AuthConfig,
  HttpResponse,
  TimingInfo,
  RedirectInfo,
};
