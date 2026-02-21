/**
 * Kyro REST Client - Request Builder
 * 
 * Provides fluent API for constructing HTTP requests with support for:
 * - URL with path parameters
 * - Query parameters
 * - Headers management
 * - Body types (JSON, form-data, x-www-form-urlencoded, raw, binary)
 * - Authentication (Bearer, Basic, API Key, OAuth2)
 */

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS' | 'CONNECT' | 'TRACE';

export type BodyType = 'none' | 'json' | 'form-data' | 'x-www-form-urlencoded' | 'raw' | 'binary';

export type AuthType = 'none' | 'bearer' | 'basic' | 'api-key' | 'oauth2' | 'digest' | 'hawk' | 'aws-signature';

export type RawContentType = 'text/plain' | 'text/html' | 'application/xml' | 'application/javascript' | 'application/graphql';

export interface KeyValue {
  key: string;
  value: string;
  description?: string;
  enabled: boolean;
}

export interface FormDataItem extends KeyValue {
  type: 'text' | 'file';
  fileName?: string;
  filePath?: string;
  contentType?: string;
}

export interface PathParameter {
  key: string;
  value: string;
  description?: string;
  enabled: boolean;
}

export interface QueryParameter extends KeyValue {
  /** Allow multiple values for same key */
  multiValue?: boolean;
}

export interface Header extends KeyValue {
  /** Whether this header is system-generated */
  system?: boolean;
}

export interface AuthConfig {
  type: AuthType;
  /** Bearer token config */
  bearer?: {
    token: string;
    prefix?: string;
  };
  /** Basic auth config */
  basic?: {
    username: string;
    password: string;
    showPassword?: boolean;
  };
  /** API Key config */
  apiKey?: {
    key: string;
    value: string;
    addTo: 'header' | 'query';
    headerName?: string;
  };
  /** OAuth2 config */
  oauth2?: {
    grantType: 'authorization_code' | 'client_credentials' | 'password' | 'implicit' | 'refresh_token';
    accessToken: string;
    refreshToken?: string;
    tokenUrl?: string;
    authorizationUrl?: string;
    callbackUrl?: string;
    clientId?: string;
    clientSecret?: string;
    scope?: string;
    state?: string;
    tokenType?: string;
    expiresIn?: number;
    expiresAt?: Date;
  };
  /** Digest auth config */
  digest?: {
    username: string;
    password: string;
    realm?: string;
    nonce?: string;
    algorithm?: 'MD5' | 'MD5-sess';
    qop?: 'auth' | 'auth-int';
  };
  /** AWS Signature config */
  awsSignature?: {
    accessKey: string;
    secretKey: string;
    region: string;
    service: string;
    sessionToken?: string;
  };
}

export interface RequestBody {
  type: BodyType;
  /** JSON body (stringified or object) */
  json?: string | object;
  /** Form data items */
  formData?: FormDataItem[];
  /** URL encoded items */
  urlEncoded?: KeyValue[];
  /** Raw body content */
  raw?: {
    content: string;
    contentType: RawContentType;
  };
  /** Binary body */
  binary?: {
    data: ArrayBuffer | Blob | File;
    fileName?: string;
    contentType?: string;
  };
  /** GraphQL body */
  graphql?: {
    query: string;
    variables?: Record<string, unknown>;
    operationName?: string;
  };
}

export interface HttpRequest {
  id: string;
  name: string;
  description?: string;
  method: HttpMethod;
  url: string;
  pathParams: PathParameter[];
  queryParams: QueryParameter[];
  headers: Header[];
  body: RequestBody;
  auth: AuthConfig;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Follow redirects */
  followRedirects?: boolean;
  /** Maximum redirects to follow */
  maxRedirects?: number;
  /** SSL verification */
  verifySSL?: boolean;
  /** Proxy configuration */
  proxy?: {
    host: string;
    port: number;
    username?: string;
    password?: string;
    protocol: 'http' | 'https' | 'socks4' | 'socks5';
  };
  /** Tags for categorization */
  tags?: string[];
  /** Creation timestamp */
  createdAt: Date;
  /** Last modified timestamp */
  updatedAt: Date;
  /** Folder/collection ID */
  folderId?: string;
}

// ============================================================================
// REQUEST BUILDER CLASS
// ============================================================================

export class RequestBuilder {
  private request: HttpRequest;

  constructor(name: string = 'Untitled Request') {
    this.request = {
      id: this.generateId(),
      name,
      method: 'GET',
      url: '',
      pathParams: [],
      queryParams: [],
      headers: [],
      body: { type: 'none' },
      auth: { type: 'none' },
      timeout: 30000,
      followRedirects: true,
      maxRedirects: 10,
      verifySSL: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  // =========================================================================
  // FLUENT API - BASIC PROPERTIES
  // =========================================================================

  /**
   * Set request name
   */
  setName(name: string): this {
    this.request.name = name;
    this.request.updatedAt = new Date();
    return this;
  }

  /**
   * Set request description
   */
  setDescription(description: string): this {
    this.request.description = description;
    this.request.updatedAt = new Date();
    return this;
  }

  /**
   * Set HTTP method
   */
  setMethod(method: HttpMethod): this {
    this.request.method = method;
    this.request.updatedAt = new Date();
    return this;
  }

  /**
   * Set request URL
   */
  setUrl(url: string): this {
    this.request.url = url;
    this.request.updatedAt = new Date();
    return this;
  }

  /**
   * Set request timeout
   */
  setTimeout(timeout: number): this {
    this.request.timeout = timeout;
    this.request.updatedAt = new Date();
    return this;
  }

  /**
   * Set follow redirects option
   */
  setFollowRedirects(follow: boolean, maxRedirects?: number): this {
    this.request.followRedirects = follow;
    if (maxRedirects !== undefined) {
      this.request.maxRedirects = maxRedirects;
    }
    this.request.updatedAt = new Date();
    return this;
  }

  /**
   * Set SSL verification option
   */
  setVerifySSL(verify: boolean): this {
    this.request.verifySSL = verify;
    this.request.updatedAt = new Date();
    return this;
  }

  /**
   * Set proxy configuration
   */
  setProxy(proxy: HttpRequest['proxy']): this {
    this.request.proxy = proxy;
    this.request.updatedAt = new Date();
    return this;
  }

  /**
   * Add tags
   */
  addTags(...tags: string[]): this {
    this.request.tags = [...(this.request.tags || []), ...tags];
    this.request.updatedAt = new Date();
    return this;
  }

  /**
   * Set folder ID
   */
  setFolderId(folderId: string): this {
    this.request.folderId = folderId;
    this.request.updatedAt = new Date();
    return this;
  }

  // =========================================================================
  // PATH PARAMETERS
  // =========================================================================

  /**
   * Add path parameter
   */
  addPathParam(key: string, value: string, options?: { description?: string; enabled?: boolean }): this {
    this.request.pathParams.push({
      key,
      value,
      description: options?.description,
      enabled: options?.enabled ?? true,
    });
    this.request.updatedAt = new Date();
    return this;
  }

  /**
   * Set all path parameters
   */
  setPathParams(params: PathParameter[]): this {
    this.request.pathParams = params;
    this.request.updatedAt = new Date();
    return this;
  }

  /**
   * Remove path parameter by key
   */
  removePathParam(key: string): this {
    this.request.pathParams = this.request.pathParams.filter(p => p.key !== key);
    this.request.updatedAt = new Date();
    return this;
  }

  /**
   * Replace path parameters in URL
   */
  resolveUrl(): string {
    let url = this.request.url;
    for (const param of this.request.pathParams) {
      if (param.enabled) {
        url = url.replace(`:${param.key}`, param.value);
        url = url.replace(`{{${param.key}}}`, param.value);
      }
    }
    return url;
  }

  // =========================================================================
  // QUERY PARAMETERS
  // =========================================================================

  /**
   * Add query parameter
   */
  addQueryParam(key: string, value: string, options?: { description?: string; enabled?: boolean }): this {
    this.request.queryParams.push({
      key,
      value,
      description: options?.description,
      enabled: options?.enabled ?? true,
    });
    this.request.updatedAt = new Date();
    return this;
  }

  /**
   * Set all query parameters
   */
  setQueryParams(params: QueryParameter[]): this {
    this.request.queryParams = params;
    this.request.updatedAt = new Date();
    return this;
  }

  /**
   * Remove query parameter by key
   */
  removeQueryParam(key: string): this {
    this.request.queryParams = this.request.queryParams.filter(p => p.key !== key);
    this.request.updatedAt = new Date();
    return this;
  }

  /**
   * Toggle query parameter
   */
  toggleQueryParam(key: string, enabled: boolean): this {
    const param = this.request.queryParams.find(p => p.key === key);
    if (param) {
      param.enabled = enabled;
      this.request.updatedAt = new Date();
    }
    return this;
  }

  /**
   * Build query string from parameters
   */
  buildQueryString(): string {
    const enabledParams = this.request.queryParams.filter(p => p.enabled && p.key);
    if (enabledParams.length === 0) return '';

    const searchParams = new URLSearchParams();
    for (const param of enabledParams) {
      searchParams.append(param.key, param.value);
    }

    return searchParams.toString();
  }

  /**
   * Get full URL with query parameters
   */
  getFullUrl(): string {
    let url = this.resolveUrl();
    const queryString = this.buildQueryString();
    if (queryString) {
      const separator = url.includes('?') ? '&' : '?';
      url = `${url}${separator}${queryString}`;
    }
    return url;
  }

  // =========================================================================
  // HEADERS
  // =========================================================================

  /**
   * Add header
   */
  addHeader(key: string, value: string, options?: { description?: string; enabled?: boolean; system?: boolean }): this {
    this.request.headers.push({
      key,
      value,
      description: options?.description,
      enabled: options?.enabled ?? true,
      system: options?.system,
    });
    this.request.updatedAt = new Date();
    return this;
  }

  /**
   * Set all headers
   */
  setHeaders(headers: Header[]): this {
    this.request.headers = headers;
    this.request.updatedAt = new Date();
    return this;
  }

  /**
   * Remove header by key
   */
  removeHeader(key: string): this {
    this.request.headers = this.request.headers.filter(h => h.key.toLowerCase() !== key.toLowerCase());
    this.request.updatedAt = new Date();
    return this;
  }

  /**
   * Toggle header
   */
  toggleHeader(key: string, enabled: boolean): this {
    const header = this.request.headers.find(
      h => h.key.toLowerCase() === key.toLowerCase()
    );
    if (header) {
      header.enabled = enabled;
      this.request.updatedAt = new Date();
    }
    return this;
  }

  /**
   * Set Content-Type header
   */
  setContentType(contentType: string): this {
    this.removeHeader('Content-Type');
    this.addHeader('Content-Type', contentType, { system: true });
    return this;
  }

  /**
   * Set Accept header
   */
  setAccept(contentType: string): this {
    this.removeHeader('Accept');
    this.addHeader('Accept', contentType, { system: true });
    return this;
  }

  /**
   * Get enabled headers as object
   */
  getHeadersObject(): Record<string, string> {
    const headers: Record<string, string> = {};
    for (const header of this.request.headers) {
      if (header.enabled && header.key) {
        headers[header.key] = header.value;
      }
    }
    return headers;
  }

  // =========================================================================
  // BODY
  // =========================================================================

  /**
   * Set body type to none
   */
  noBody(): this {
    this.request.body = { type: 'none' };
    this.request.updatedAt = new Date();
    return this;
  }

  /**
   * Set JSON body
   */
  jsonBody(data: object | string, prettify: boolean = false): this {
    const jsonStr = typeof data === 'string' ? data : JSON.stringify(data, null, prettify ? 2 : 0);
    this.request.body = {
      type: 'json',
      json: jsonStr,
    };
    this.setContentType('application/json');
    this.request.updatedAt = new Date();
    return this;
  }

  /**
   * Set form-data body
   */
  formDataBody(items: FormDataItem[]): this {
    this.request.body = {
      type: 'form-data',
      formData: items,
    };
    // Don't set Content-Type for multipart/form-data, let the browser set it with boundary
    this.removeHeader('Content-Type');
    this.request.updatedAt = new Date();
    return this;
  }

  /**
   * Add form-data item
   */
  addFormDataItem(item: FormDataItem): this {
    if (this.request.body.type !== 'form-data') {
      this.request.body = { type: 'form-data', formData: [] };
    }
    this.request.body.formData!.push(item);
    this.request.updatedAt = new Date();
    return this;
  }

  /**
   * Set URL-encoded body
   */
  urlEncodedBody(items: KeyValue[]): this {
    this.request.body = {
      type: 'x-www-form-urlencoded',
      urlEncoded: items,
    };
    this.setContentType('application/x-www-form-urlencoded');
    this.request.updatedAt = new Date();
    return this;
  }

  /**
   * Add URL-encoded item
   */
  addUrlEncodedItem(key: string, value: string, enabled: boolean = true): this {
    if (this.request.body.type !== 'x-www-form-urlencoded') {
      this.request.body = { type: 'x-www-form-urlencoded', urlEncoded: [] };
    }
    this.request.body.urlEncoded!.push({ key, value, enabled });
    this.request.updatedAt = new Date();
    return this;
  }

  /**
   * Set raw body
   */
  rawBody(content: string, contentType: RawContentType = 'text/plain'): this {
    this.request.body = {
      type: 'raw',
      raw: { content, contentType },
    };
    this.setContentType(contentType);
    this.request.updatedAt = new Date();
    return this;
  }

  /**
   * Set binary body
   */
  binaryBody(data: ArrayBuffer | Blob | File, fileName?: string, contentType?: string): this {
    this.request.body = {
      type: 'binary',
      binary: { data, fileName, contentType },
    };
    if (contentType) {
      this.setContentType(contentType);
    }
    this.request.updatedAt = new Date();
    return this;
  }

  /**
   * Set GraphQL body
   */
  graphqlBody(query: string, variables?: Record<string, unknown>, operationName?: string): this {
    this.request.body = {
      type: 'json',
      graphql: { query, variables, operationName },
      json: JSON.stringify({ query, variables, operationName }, null, 2),
    };
    this.setContentType('application/json');
    this.request.updatedAt = new Date();
    return this;
  }

  /**
   * Get body content for request
   */
  getBodyContent(): BodyInit | null {
    const body = this.request.body;

    switch (body.type) {
      case 'none':
        return null;

      case 'json': {
        const json = body.json;
        return typeof json === 'string' ? json : JSON.stringify(json);
      }

      case 'form-data': {
        const formData = new FormData();
        for (const item of body.formData || []) {
          if (item.enabled) {
            if (item.type === 'file' && item.filePath) {
              // In browser environment, File objects should be passed directly
              formData.append(item.key, new Blob(), item.fileName || 'file');
            } else {
              formData.append(item.key, item.value);
            }
          }
        }
        return formData;
      }

      case 'x-www-form-urlencoded': {
        const params = new URLSearchParams();
        for (const item of body.urlEncoded || []) {
          if (item.enabled) {
            params.append(item.key, item.value);
          }
        }
        return params.toString();
      }

      case 'raw':
        return body.raw?.content || '';

      case 'binary':
        return body.binary?.data || null;

      default:
        return null;
    }
  }

  // =========================================================================
  // AUTHENTICATION
  // =========================================================================

  /**
   * Set no authentication
   */
  noAuth(): this {
    this.request.auth = { type: 'none' };
    this.request.updatedAt = new Date();
    return this;
  }

  /**
   * Set Bearer token authentication
   */
  bearerAuth(token: string, prefix: string = 'Bearer'): this {
    this.request.auth = {
      type: 'bearer',
      bearer: { token, prefix },
    };
    this.request.updatedAt = new Date();
    return this;
  }

  /**
   * Set Basic authentication
   */
  basicAuth(username: string, password: string): this {
    this.request.auth = {
      type: 'basic',
      basic: { username, password },
    };
    this.request.updatedAt = new Date();
    return this;
  }

  /**
   * Set API Key authentication
   */
  apiKeyAuth(key: string, value: string, addTo: 'header' | 'query' = 'header', headerName?: string): this {
    this.request.auth = {
      type: 'api-key',
      apiKey: { key, value, addTo, headerName: headerName || key },
    };
    this.request.updatedAt = new Date();
    return this;
  }

  /**
   * Set OAuth2 authentication
   */
  oauth2Auth(config: AuthConfig['oauth2']): this {
    this.request.auth = {
      type: 'oauth2',
      oauth2: config,
    };
    this.request.updatedAt = new Date();
    return this;
  }

  /**
   * Set Digest authentication
   */
  digestAuth(username: string, password: string, options?: Partial<AuthConfig['digest']>): this {
    this.request.auth = {
      type: 'digest',
      digest: { username, password, ...options },
    };
    this.request.updatedAt = new Date();
    return this;
  }

  /**
   * Set AWS Signature authentication
   */
  awsSignatureAuth(accessKey: string, secretKey: string, region: string, service: string, sessionToken?: string): this {
    this.request.auth = {
      type: 'aws-signature',
      awsSignature: { accessKey, secretKey, region, service, sessionToken },
    };
    this.request.updatedAt = new Date();
    return this;
  }

  /**
   * Apply authentication to request
   */
  applyAuth(): this {
    const auth = this.request.auth;

    switch (auth.type) {
      case 'bearer': {
        if (auth.bearer) {
          const prefix = auth.bearer.prefix || 'Bearer';
          this.addHeader('Authorization', `${prefix} ${auth.bearer.token}`, { system: true });
        }
        break;
      }

      case 'basic': {
        if (auth.basic) {
          const credentials = btoa(`${auth.basic.username}:${auth.basic.password}`);
          this.addHeader('Authorization', `Basic ${credentials}`, { system: true });
        }
        break;
      }

      case 'api-key': {
        if (auth.apiKey) {
          if (auth.apiKey.addTo === 'header') {
            this.addHeader(auth.apiKey.headerName || auth.apiKey.key, auth.apiKey.value, { system: true });
          } else {
            this.addQueryParam(auth.apiKey.key, auth.apiKey.value);
          }
        }
        break;
      }

      case 'oauth2': {
        if (auth.oauth2?.accessToken) {
          const tokenType = auth.oauth2.tokenType || 'Bearer';
          this.addHeader('Authorization', `${tokenType} ${auth.oauth2.accessToken}`, { system: true });
        }
        break;
      }

      case 'none':
      default:
        // No authentication to apply
        break;
    }

    this.request.updatedAt = new Date();
    return this;
  }

  // =========================================================================
  // BUILD & CLONE
  // =========================================================================

  /**
   * Build the request object
   */
  build(): HttpRequest {
    return { ...this.request };
  }

  /**
   * Build and apply authentication
   */
  buildWithAuth(): HttpRequest {
    this.applyAuth();
    return this.build();
  }

  /**
   * Clone the builder
   */
  clone(): RequestBuilder {
    const cloned = new RequestBuilder(this.request.name);
    cloned.request = JSON.parse(JSON.stringify(this.request));
    cloned.request.id = this.generateId();
    cloned.request.createdAt = new Date();
    cloned.request.updatedAt = new Date();
    return cloned;
  }

  /**
   * Create builder from existing request
   */
  static fromRequest(request: HttpRequest): RequestBuilder {
    const builder = new RequestBuilder();
    builder.request = { ...request };
    return builder;
  }

  // =========================================================================
  // HELPER METHODS
  // =========================================================================

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `req-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Validate request
   */
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.request.url) {
      errors.push('URL is required');
    }

    try {
      new URL(this.getFullUrl());
    } catch {
      errors.push('Invalid URL format');
    }

    // Validate JSON body if applicable
    if (this.request.body.type === 'json' && typeof this.request.body.json === 'string') {
      try {
        JSON.parse(this.request.body.json);
      } catch {
        errors.push('Invalid JSON in request body');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Export to cURL command
   */
  toCurl(): string {
    const parts: string[] = [`curl -X ${this.request.method}`];

    // Add URL
    parts.push(`'${this.getFullUrl()}'`);

    // Add headers
    for (const header of this.request.headers) {
      if (header.enabled && header.key && !header.system) {
        parts.push(`-H '${header.key}: ${header.value}'`);
      }
    }

    // Add body
    const body = this.getBodyContent();
    if (body && typeof body === 'string') {
      parts.push(`-d '${body.replace(/'/g, "'\\''")}'`);
    }

    return parts.join(' \\\n  ');
  }

  /**
   * Export to fetch code
   */
  toFetch(): string {
    const options: Record<string, unknown> = {
      method: this.request.method,
      headers: this.getHeadersObject(),
    };

    const body = this.getBodyContent();
    if (body) {
      options.body = body;
    }

    return `fetch('${this.getFullUrl()}', ${JSON.stringify(options, null, 2)})`;
  }
}

// ============================================================================
// CONVENIENCE FACTORIES
// ============================================================================

/**
 * Create a GET request builder
 */
export function GET(url: string): RequestBuilder {
  return new RequestBuilder().setMethod('GET').setUrl(url);
}

/**
 * Create a POST request builder
 */
export function POST(url: string): RequestBuilder {
  return new RequestBuilder().setMethod('POST').setUrl(url);
}

/**
 * Create a PUT request builder
 */
export function PUT(url: string): RequestBuilder {
  return new RequestBuilder().setMethod('PUT').setUrl(url);
}

/**
 * Create a DELETE request builder
 */
export function DELETE(url: string): RequestBuilder {
  return new RequestBuilder().setMethod('DELETE').setUrl(url);
}

/**
 * Create a PATCH request builder
 */
export function PATCH(url: string): RequestBuilder {
  return new RequestBuilder().setMethod('PATCH').setUrl(url);
}

/**
 * Create a HEAD request builder
 */
export function HEAD(url: string): RequestBuilder {
  return new RequestBuilder().setMethod('HEAD').setUrl(url);
}

/**
 * Create an OPTIONS request builder
 */
export function OPTIONS(url: string): RequestBuilder {
  return new RequestBuilder().setMethod('OPTIONS').setUrl(url);
}
