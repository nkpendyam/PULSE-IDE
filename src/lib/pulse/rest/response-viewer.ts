/**
 * Kyro REST Client - Response Viewer
 * 
 * Provides utilities for handling and displaying HTTP responses:
 * - Status code and time display
 * - Response headers viewer
 * - Body formatter/prettifier
 * - Cookie extraction
 * - Response size calculation
 * - Save response to file
 */

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export type ResponseBodyType = 'json' | 'xml' | 'html' | 'text' | 'binary' | 'unknown';

export interface ResponseHeader {
  name: string;
  value: string;
  /** Original case-preserved name */
  originalName?: string;
}

export interface Cookie {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  expires?: Date;
  maxAge?: number;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: 'strict' | 'lax' | 'none';
}

export interface TimingInfo {
  /** DNS lookup time in ms */
  dns?: number;
  /** TCP connection time in ms */
  connect?: number;
  /** TLS handshake time in ms */
  tls?: number;
  /** Time to first byte in ms */
  ttfb?: number;
  /** Content download time in ms */
  download?: number;
  /** Total time in ms */
  total: number;
  /** Request preparation time in ms */
  preparation?: number;
  /** Request waiting time in ms */
  waiting?: number;
}

export interface HttpResponse {
  /** Request ID this response belongs to */
  requestId: string;
  /** HTTP status code */
  statusCode: number;
  /** HTTP status text */
  statusText: string;
  /** Response headers */
  headers: ResponseHeader[];
  /** Raw response body */
  body: ArrayBuffer;
  /** Response body as text (lazy loaded) */
  bodyText?: string;
  /** Parsed response body */
  bodyParsed?: unknown;
  /** Detected body type */
  bodyType: ResponseBodyType;
  /** Response cookies */
  cookies: Cookie[];
  /** Timing information */
  timing: TimingInfo;
  /** Response size in bytes */
  size: number;
  /** Content type from headers */
  contentType?: string;
  /** Character encoding */
  encoding?: string;
  /** Final URL after redirects */
  finalUrl?: string;
  /** Redirect history */
  redirects: RedirectInfo[];
  /** Timestamp when response was received */
  timestamp: Date;
  /** Error if request failed */
  error?: {
    type: 'network' | 'timeout' | 'abort' | 'parse' | 'ssl' | 'unknown';
    message: string;
    details?: string;
  };
}

export interface RedirectInfo {
  url: string;
  statusCode: number;
  headers: ResponseHeader[];
}

export interface PrettifyOptions {
  /** Indentation for JSON/XML */
  indent?: number;
  /** Max line length */
  maxLineLength?: number;
  /** Sort object keys */
  sortKeys?: boolean;
  /** Truncate long strings */
  truncateStrings?: number;
}

export interface SaveResponseOptions {
  /** File name (without extension) */
  fileName?: string;
  /** Directory to save to */
  directory?: string;
  /** Include headers in file */
  includeHeaders?: boolean;
  /** Include timing info */
  includeTiming?: boolean;
}

// ============================================================================
// RESPONSE VIEWER CLASS
// ============================================================================

export class ResponseViewer {
  private response: HttpResponse;

  constructor(response: HttpResponse) {
    this.response = response;
  }

  // =========================================================================
  // STATUS CODE
  // =========================================================================

  /**
   * Get status code
   */
  getStatusCode(): number {
    return this.response.statusCode;
  }

  /**
   * Get status text
   */
  getStatusText(): string {
    return this.response.statusText;
  }

  /**
   * Get status category
   */
  getStatusCategory(): 'informational' | 'success' | 'redirect' | 'client-error' | 'server-error' | 'unknown' {
    const code = this.response.statusCode;
    if (code >= 100 && code < 200) return 'informational';
    if (code >= 200 && code < 300) return 'success';
    if (code >= 300 && code < 400) return 'redirect';
    if (code >= 400 && code < 500) return 'client-error';
    if (code >= 500 && code < 600) return 'server-error';
    return 'unknown';
  }

  /**
   * Check if response is successful (2xx)
   */
  isSuccess(): boolean {
    return this.getStatusCategory() === 'success';
  }

  /**
   * Check if response is a redirect (3xx)
   */
  isRedirect(): boolean {
    return this.getStatusCategory() === 'redirect';
  }

  /**
   * Check if response is a client error (4xx)
   */
  isClientError(): boolean {
    return this.getStatusCategory() === 'client-error';
  }

  /**
   * Check if response is a server error (5xx)
   */
  isServerError(): boolean {
    return this.getStatusCategory() === 'server-error';
  }

  /**
   * Check if response has an error
   */
  hasError(): boolean {
    return this.response.error !== undefined || this.isClientError() || this.isServerError();
  }

  /**
   * Get status color for UI
   */
  getStatusColor(): string {
    const category = this.getStatusCategory();
    switch (category) {
      case 'informational':
        return 'blue';
      case 'success':
        return 'green';
      case 'redirect':
        return 'yellow';
      case 'client-error':
        return 'orange';
      case 'server-error':
        return 'red';
      default:
        return 'gray';
    }
  }

  /**
   * Get status badge text
   */
  getStatusBadge(): string {
    return `${this.response.statusCode} ${this.response.statusText}`;
  }

  // =========================================================================
  // TIMING
  // =========================================================================

  /**
   * Get total response time
   */
  getTotalTime(): number {
    return this.response.timing.total;
  }

  /**
   * Get formatted timing string
   */
  getFormattedTime(): string {
    const ms = this.response.timing.total;
    if (ms < 1000) {
      return `${Math.round(ms)}ms`;
    } else if (ms < 60000) {
      return `${(ms / 1000).toFixed(2)}s`;
    } else {
      return `${(ms / 60000).toFixed(2)}m`;
    }
  }

  /**
   * Get timing breakdown for waterfall view
   */
  getTimingBreakdown(): Array<{ phase: string; duration: number; color: string }> {
    const timing = this.response.timing;
    const breakdown: Array<{ phase: string; duration: number; color: string }> = [];

    if (timing.dns) {
      breakdown.push({ phase: 'DNS', duration: timing.dns, color: '#22c55e' });
    }
    if (timing.connect) {
      breakdown.push({ phase: 'Connect', duration: timing.connect, color: '#3b82f6' });
    }
    if (timing.tls) {
      breakdown.push({ phase: 'TLS', duration: timing.tls, color: '#8b5cf6' });
    }
    if (timing.ttfb) {
      breakdown.push({ phase: 'Waiting (TTFB)', duration: timing.ttfb, color: '#f59e0b' });
    }
    if (timing.download) {
      breakdown.push({ phase: 'Download', duration: timing.download, color: '#ef4444' });
    }

    return breakdown;
  }

  // =========================================================================
  // HEADERS
  // =========================================================================

  /**
   * Get all headers
   */
  getHeaders(): ResponseHeader[] {
    return this.response.headers;
  }

  /**
   * Get header by name (case-insensitive)
   */
  getHeader(name: string): string | undefined {
    const header = this.response.headers.find(
      h => h.name.toLowerCase() === name.toLowerCase()
    );
    return header?.value;
  }

  /**
   * Check if header exists
   */
  hasHeader(name: string): boolean {
    return this.response.headers.some(
      h => h.name.toLowerCase() === name.toLowerCase()
    );
  }

  /**
   * Get headers as object
   */
  getHeadersObject(): Record<string, string> {
    const headers: Record<string, string> = {};
    for (const header of this.response.headers) {
      headers[header.name] = header.value;
    }
    return headers;
  }

  /**
   * Get headers formatted for display
   */
  getFormattedHeaders(): string {
    return this.response.headers
      .map(h => `${h.name}: ${h.value}`)
      .join('\n');
  }

  /**
   * Get content type header
   */
  getContentType(): string | undefined {
    return this.getHeader('content-type');
  }

  /**
   * Parse content type
   */
  parseContentType(): { type: string; charset?: string; boundary?: string } {
    const contentType = this.getContentType() || '';
    const parts = contentType.split(';').map(p => p.trim());
    const type = parts[0] || 'unknown';

    let charset: string | undefined;
    let boundary: string | undefined;

    for (const part of parts.slice(1)) {
      if (part.startsWith('charset=')) {
        charset = part.substring(8).replace(/"/g, '');
      }
      if (part.startsWith('boundary=')) {
        boundary = part.substring(9).replace(/"/g, '');
      }
    }

    return { type, charset, boundary };
  }

  // =========================================================================
  // BODY
  // =========================================================================

  /**
   * Get raw body as ArrayBuffer
   */
  getRawBody(): ArrayBuffer {
    return this.response.body;
  }

  /**
   * Get body as text
   */
  getBodyAsText(): string {
    if (this.response.bodyText) {
      return this.response.bodyText;
    }

    const decoder = new TextDecoder(this.response.encoding || 'utf-8');
    this.response.bodyText = decoder.decode(this.response.body);
    return this.response.bodyText;
  }

  /**
   * Get body as JSON
   */
  getBodyAsJson<T = unknown>(): T | null {
    try {
      if (this.response.bodyParsed) {
        return this.response.bodyParsed as T;
      }
      const text = this.getBodyAsText();
      const parsed = JSON.parse(text);
      this.response.bodyParsed = parsed;
      return parsed as T;
    } catch {
      return null;
    }
  }

  /**
   * Detect body type from content and headers
   */
  detectBodyType(): ResponseBodyType {
    if (this.response.bodyType !== 'unknown') {
      return this.response.bodyType;
    }

    const contentType = this.getContentType()?.toLowerCase() || '';

    if (contentType.includes('application/json') || contentType.includes('+json')) {
      return 'json';
    }
    if (contentType.includes('application/xml') || contentType.includes('+xml') || contentType.includes('text/xml')) {
      return 'xml';
    }
    if (contentType.includes('text/html')) {
      return 'html';
    }
    if (contentType.includes('text/')) {
      return 'text';
    }
    if (contentType.includes('application/octet-stream') || 
        contentType.includes('image/') || 
        contentType.includes('video/') || 
        contentType.includes('audio/')) {
      return 'binary';
    }

    // Try to detect from content
    const text = this.getBodyAsText().trim();
    if (text.startsWith('{') || text.startsWith('[')) {
      try {
        JSON.parse(text);
        return 'json';
      } catch {
        // Not valid JSON
      }
    }
    if (text.startsWith('<') && text.includes('>')) {
      if (text.includes('<!DOCTYPE html') || text.includes('<html')) {
        return 'html';
      }
      return 'xml';
    }

    return 'text';
  }

  /**
   * Get prettified body
   */
  getPrettifiedBody(options: PrettifyOptions = {}): string {
    const { indent = 2, truncateStrings } = options;
    const bodyType = this.detectBodyType();
    const text = this.getBodyAsText();

    switch (bodyType) {
      case 'json': {
        try {
          let parsed = JSON.parse(text);
          if (options.sortKeys) {
            parsed = this.sortObjectKeys(parsed);
          }
          let pretty = JSON.stringify(parsed, null, indent);
          if (truncateStrings) {
            pretty = this.truncateStringsInJson(pretty, truncateStrings);
          }
          return pretty;
        } catch {
          return text;
        }
      }

      case 'xml': {
        return this.prettifyXml(text, indent);
      }

      case 'html': {
        return this.prettifyHtml(text, indent);
      }

      default:
        return text;
    }
  }

  /**
   * Sort object keys recursively
   */
  private sortObjectKeys(obj: unknown): unknown {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.sortObjectKeys(item));
    }

    const sorted: Record<string, unknown> = {};
    const keys = Object.keys(obj).sort();
    for (const key of keys) {
      sorted[key] = this.sortObjectKeys((obj as Record<string, unknown>)[key]);
    }
    return sorted;
  }

  /**
   * Truncate long strings in JSON
   */
  private truncateStringsInJson(json: string, maxLength: number): string {
    return json.replace(/"([^"\\]|\\.)*":\s*"([^"\\]|\\.)*"/g, (match) => {
      const colonIndex = match.indexOf(':');
      const key = match.substring(0, colonIndex + 1);
      let value = match.substring(colonIndex + 1).trim();

      if (value.length > maxLength + 2) {
        const truncated = value.substring(0, maxLength + 1) + '..."';
        return `${key} ${truncated}`;
      }
      return match;
    });
  }

  /**
   * Prettify XML
   */
  private prettifyXml(xml: string, indent: number = 2): string {
    let formatted = '';
    let pad = 0;
    const indentStr = ' '.repeat(indent);

    // Split into tokens
    xml = xml.replace(/(>)(<)(\/*)/g, '$1\n$2$3');
    const tokens = xml.split('\n');

    for (const token of tokens) {
      let indentChange = 0;

      // Closing tag
      if (token.match(/<\/\w/)) {
        if (pad > 0) pad--;
      }
      // Self-closing tag
      else if (token.match(/\/>/)) {
        indentChange = 0;
      }
      // Opening tag (not self-closing)
      else if (token.match(/<\w[^>]*[^\/]>/) && !token.match(/<\w[^>]*\/>/)) {
        indentChange = 1;
      }

      formatted += indentStr.repeat(pad) + token.trim() + '\n';

      if (indentChange > 0) {
        pad += indentChange;
      }
      // Opening tag - increase after
      else if (token.match(/<\w[^>]*[^\/]>/) && !token.match(/<\/\w/) && !token.match(/\/>/)) {
        pad++;
      }
    }

    return formatted.trim();
  }

  /**
   * Prettify HTML
   */
  private prettifyHtml(html: string, indent: number = 2): string {
    // Similar to XML prettification
    return this.prettifyXml(html, indent);
  }

  /**
   * Get body preview (truncated)
   */
  getBodyPreview(maxLength: number = 500): string {
    const text = this.getBodyAsText();
    if (text.length <= maxLength) {
      return text;
    }
    return text.substring(0, maxLength) + '...';
  }

  /**
   * Search in body
   */
  searchInBody(query: string, options: { caseSensitive?: boolean; regex?: boolean } = {}): Array<{ line: number; column: number; match: string }> {
    const text = this.getBodyAsText();
    const results: Array<{ line: number; column: number; match: string }> = [];

    if (options.regex) {
      try {
        const regex = new RegExp(query, options.caseSensitive ? 'g' : 'gi');
        let match;
        while ((match = regex.exec(text)) !== null) {
          const position = this.getLineColumn(text, match.index);
          results.push({
            line: position.line,
            column: position.column,
            match: match[0],
          });
        }
      } catch {
        return results;
      }
    } else {
      const searchText = options.caseSensitive ? query : query.toLowerCase();
      const searchIn = options.caseSensitive ? text : text.toLowerCase();
      let index = 0;

      while ((index = searchIn.indexOf(searchText, index)) !== -1) {
        const position = this.getLineColumn(text, index);
        results.push({
          line: position.line,
          column: position.column,
          match: text.substring(index, index + query.length),
        });
        index += query.length;
      }
    }

    return results;
  }

  /**
   * Get line and column from index
   */
  private getLineColumn(text: string, index: number): { line: number; column: number } {
    const before = text.substring(0, index);
    const lines = before.split('\n');
    return {
      line: lines.length,
      column: lines[lines.length - 1].length + 1,
    };
  }

  // =========================================================================
  // SIZE
  // =========================================================================

  /**
   * Get response size in bytes
   */
  getSize(): number {
    return this.response.size;
  }

  /**
   * Get formatted size string
   */
  getFormattedSize(): string {
    const bytes = this.response.size;
    if (bytes < 1024) {
      return `${bytes} B`;
    } else if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(2)} KB`;
    } else if (bytes < 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    } else {
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    }
  }

  /**
   * Get size breakdown
   */
  getSizeBreakdown(): { headers: number; body: number; total: number } {
    const headersSize = new Blob([this.getFormattedHeaders()]).size;
    const bodySize = this.response.size;
    return {
      headers: headersSize,
      body: bodySize,
      total: headersSize + bodySize,
    };
  }

  // =========================================================================
  // COOKIES
  // =========================================================================

  /**
   * Get all cookies
   */
  getCookies(): Cookie[] {
    return this.response.cookies;
  }

  /**
   * Get cookie by name
   */
  getCookie(name: string): Cookie | undefined {
    return this.response.cookies.find(c => c.name === name);
  }

  /**
   * Parse cookies from Set-Cookie headers
   */
  static parseCookies(headers: ResponseHeader[]): Cookie[] {
    const cookies: Cookie[] = [];

    for (const header of headers) {
      if (header.name.toLowerCase() === 'set-cookie') {
        const cookie = ResponseViewer.parseSetCookie(header.value);
        if (cookie) {
          cookies.push(cookie);
        }
      }
    }

    return cookies;
  }

  /**
   * Parse a single Set-Cookie header value
   */
  private static parseSetCookie(setCookie: string): Cookie | null {
    const parts = setCookie.split(';').map(p => p.trim());
    const [nameValue, ...attributes] = parts;

    const equalsIndex = nameValue.indexOf('=');
    if (equalsIndex === -1) return null;

    const cookie: Cookie = {
      name: nameValue.substring(0, equalsIndex),
      value: nameValue.substring(equalsIndex + 1),
    };

    for (const attr of attributes) {
      const lowerAttr = attr.toLowerCase();
      const colonIndex = attr.indexOf('=');

      if (colonIndex !== -1) {
        const key = lowerAttr.substring(0, colonIndex);
        const value = attr.substring(colonIndex + 1);

        switch (key) {
          case 'domain':
            cookie.domain = value;
            break;
          case 'path':
            cookie.path = value;
            break;
          case 'expires':
            cookie.expires = new Date(value);
            break;
          case 'max-age':
            cookie.maxAge = parseInt(value, 10);
            break;
          case 'samesite':
            cookie.sameSite = value.toLowerCase() as Cookie['sameSite'];
            break;
        }
      } else {
        switch (lowerAttr) {
          case 'secure':
            cookie.secure = true;
            break;
          case 'httponly':
            cookie.httpOnly = true;
            break;
        }
      }
    }

    return cookie;
  }

  // =========================================================================
  // REDIRECTS
  // =========================================================================

  /**
   * Get redirect history
   */
  getRedirects(): RedirectInfo[] {
    return this.response.redirects;
  }

  /**
   * Check if response was redirected
   */
  wasRedirected(): boolean {
    return this.response.redirects.length > 0;
  }

  /**
   * Get final URL
   */
  getFinalUrl(): string {
    return this.response.finalUrl || this.response.requestId;
  }

  // =========================================================================
  // EXPORT & SAVE
  // =========================================================================

  /**
   * Export response as JSON
   */
  toJson(): string {
    return JSON.stringify({
      statusCode: this.response.statusCode,
      statusText: this.response.statusText,
      headers: this.response.headers,
      body: this.getBodyAsText(),
      cookies: this.response.cookies,
      timing: this.response.timing,
      size: this.response.size,
      finalUrl: this.response.finalUrl,
      timestamp: this.response.timestamp.toISOString(),
    }, null, 2);
  }

  /**
   * Generate download data
   */
  toDownloadData(): { data: Blob; fileName: string; mimeType: string } {
    const bodyType = this.detectBodyType();
    const contentType = this.getContentType() || 'application/octet-stream';
    
    // Try to get filename from Content-Disposition header
    const disposition = this.getHeader('content-disposition');
    let fileName = 'response';
    
    if (disposition) {
      const match = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
      if (match) {
        fileName = match[1].replace(/['"]/g, '');
      }
    } else {
      // Generate filename based on body type
      const extensions: Record<ResponseBodyType, string> = {
        json: 'json',
        xml: 'xml',
        html: 'html',
        text: 'txt',
        binary: 'bin',
        unknown: 'txt',
      };
      fileName = `response.${extensions[bodyType]}`;
    }

    return {
      data: new Blob([this.response.body], { type: contentType }),
      fileName,
      mimeType: contentType,
    };
  }

  /**
   * Save response to file (browser)
   */
  async saveToFile(options: SaveResponseOptions = {}): Promise<void> {
    const { data, fileName, mimeType } = this.toDownloadData();
    const finalFileName = options.fileName ? `${options.fileName}.${fileName.split('.').pop()}` : fileName;

    // Create blob with optional additional content
    let blob = data;
    if (options.includeHeaders || options.includeTiming) {
      let content = '';

      if (options.includeTiming) {
        content += `// Response Time: ${this.getFormattedTime()}\n`;
        content += `// Status: ${this.getStatusBadge()}\n`;
        content += `// Size: ${this.getFormattedSize()}\n\n`;
      }

      if (options.includeHeaders) {
        content += `// Headers:\n`;
        for (const header of this.response.headers) {
          content += `// ${header.name}: ${header.value}\n`;
        }
        content += '\n';
      }

      content += this.getBodyAsText();
      blob = new Blob([content], { type: 'text/plain' });
    }

    // Create download link
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = finalFileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Copy response to clipboard
   */
  async copyToClipboard(format: 'raw' | 'prettified' | 'json' = 'prettified'): Promise<void> {
    let content: string;

    switch (format) {
      case 'raw':
        content = this.getBodyAsText();
        break;
      case 'json':
        content = this.toJson();
        break;
      case 'prettified':
      default:
        content = this.getPrettifiedBody();
        break;
    }

    await navigator.clipboard.writeText(content);
  }

  // =========================================================================
  // ERROR HANDLING
  // =========================================================================

  /**
   * Get error details
   */
  getError(): HttpResponse['error'] | undefined {
    return this.response.error;
  }

  /**
   * Get user-friendly error message
   */
  getErrorMessage(): string {
    const error = this.response.error;
    if (!error) return '';

    switch (error.type) {
      case 'network':
        return `Network error: ${error.message}. Please check your connection.`;
      case 'timeout':
        return `Request timed out: ${error.message}`;
      case 'abort':
        return `Request was aborted: ${error.message}`;
      case 'parse':
        return `Failed to parse response: ${error.message}`;
      case 'ssl':
        return `SSL certificate error: ${error.message}`;
      default:
        return error.message;
    }
  }

  /**
   * Check if response is an error
   */
  isErrorResponse(): boolean {
    return this.response.error !== undefined;
  }
}

// ============================================================================
// RESPONSE BUILDER
// ============================================================================

/**
 * Build an HttpResponse from a fetch Response
 */
export async function buildHttpResponse(
  requestId: string,
  response: Response,
  timing: TimingInfo,
  redirects: RedirectInfo[] = []
): Promise<HttpResponse> {
  const headers: ResponseHeader[] = [];
  response.headers.forEach((value, name) => {
    headers.push({ name: name.toLowerCase(), value, originalName: name });
  });

  const body = await response.arrayBuffer();
  const cookies = ResponseViewer.parseCookies(headers);

  const contentType = response.headers.get('content-type') || undefined;
  const encoding = contentType?.match(/charset=([^;]+)/)?.[1];

  return {
    requestId,
    statusCode: response.status,
    statusText: response.statusText,
    headers,
    body,
    bodyType: 'unknown',
    cookies,
    timing,
    size: body.byteLength,
    contentType,
    encoding,
    finalUrl: response.url,
    redirects,
    timestamp: new Date(),
  };
}

/**
 * Build an error HttpResponse
 */
export function buildErrorResponse(
  requestId: string,
  error: Error,
  startTime: number
): HttpResponse {
  const errorType: HttpResponse['error']['type'] = 
    error.name === 'AbortError' ? 'abort' :
    error.message.includes('timeout') ? 'timeout' :
    error.message.includes('SSL') || error.message.includes('certificate') ? 'ssl' :
    error.message.includes('network') || error.message.includes('fetch') ? 'network' : 'unknown';

  return {
    requestId,
    statusCode: 0,
    statusText: 'Error',
    headers: [],
    body: new ArrayBuffer(0),
    bodyType: 'unknown',
    cookies: [],
    timing: { total: Date.now() - startTime },
    size: 0,
    redirects: [],
    timestamp: new Date(),
    error: {
      type: errorType,
      message: error.message,
      details: error.stack,
    },
  };
}
