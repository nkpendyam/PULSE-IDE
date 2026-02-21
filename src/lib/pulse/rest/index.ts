/**
 * Kyro REST Client Module
 * 
 * A comprehensive HTTP client for Kyro IDE with features:
 * - All HTTP methods (GET, POST, PUT, DELETE, PATCH, etc.)
 * - Request builder with fluent API
 * - Response parsing and formatting
 * - Request/response history
 * - Collections and folders for organizing requests
 * - Environment variables support
 * - Code generation (cURL, fetch, Axios, Python)
 * 
 * @example
 * ```typescript
 * import { RestClient, RequestBuilder, GET, POST } from '@/lib/pulse/rest';
 * 
 * // Quick requests
 * const { response } = await GET('https://api.example.com/users');
 * console.log(response.getBodyAsJson());
 * 
 * // Using request builder
 * const request = new RequestBuilder()
 *   .setMethod('POST')
 *   .setUrl('https://api.example.com/users')
 *   .jsonBody({ name: 'John', email: 'john@example.com' })
 *   .bearerAuth('your-token')
 *   .build();
 * 
 * // Using REST client
 * const client = RestClient.getInstance();
 * const { response, timing } = await client.execute(new RequestBuilder()
 *   .setUrl('https://api.example.com/data')
 *   .setMethod('GET')
 *   .addHeader('X-API-Key', 'your-key')
 * );
 * 
 * // Create collections
 * const collection = client.createCollection('My API');
 * client.addRequestToCollection(collection.id, request);
 * 
 * // Environment variables
 * const env = client.createEnvironment('Production', [
 *   { key: 'BASE_URL', value: 'https://api.example.com', enabled: true }
 * ]);
 * client.setActiveEnvironment(env.id);
 * ```
 */

// ============================================================================
// CORE CLASSES
// ============================================================================

export { RestClient, RequestBuilder, ResponseViewer, getRestClient, http } from './rest-client';

// ============================================================================
// REQUEST BUILDER
// ============================================================================

export {
  // Factory functions for HTTP methods
  GET,
  POST,
  PUT,
  DELETE,
  PATCH,
  HEAD,
  OPTIONS,
} from './request-builder';

// ============================================================================
// RESPONSE UTILITIES
// ============================================================================

export {
  buildHttpResponse,
  buildErrorResponse,
} from './response-viewer';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

// Request types
export type {
  HttpMethod,
  BodyType,
  AuthType,
  RawContentType,
  KeyValue,
  FormDataItem,
  PathParameter,
  QueryParameter,
  Header,
  AuthConfig,
  RequestBody,
  HttpRequest,
} from './request-builder';

// Response types
export type {
  ResponseBodyType,
  ResponseHeader,
  Cookie,
  TimingInfo,
  HttpResponse,
  RedirectInfo,
  PrettifyOptions,
  SaveResponseOptions,
} from './response-viewer';

// Client types
export type {
  Environment,
  EnvironmentVariable,
  RequestFolder,
  RequestCollection,
  HistoryEntry,
  RestClientConfig,
  RequestOptions,
  ProgressInfo,
  RestClientEvent,
} from './rest-client';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Common HTTP status codes
 */
export const HTTP_STATUS = {
  // Informational
  CONTINUE: 100,
  SWITCHING_PROTOCOLS: 101,
  PROCESSING: 102,

  // Success
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NON_AUTHORITATIVE_INFORMATION: 203,
  NO_CONTENT: 204,
  RESET_CONTENT: 205,
  PARTIAL_CONTENT: 206,

  // Redirection
  MULTIPLE_CHOICES: 300,
  MOVED_PERMANENTLY: 301,
  FOUND: 302,
  SEE_OTHER: 303,
  NOT_MODIFIED: 304,
  USE_PROXY: 305,
  TEMPORARY_REDIRECT: 307,
  PERMANENT_REDIRECT: 308,

  // Client errors
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  PAYMENT_REQUIRED: 402,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  NOT_ACCEPTABLE: 406,
  PROXY_AUTHENTICATION_REQUIRED: 407,
  REQUEST_TIMEOUT: 408,
  CONFLICT: 409,
  GONE: 410,
  LENGTH_REQUIRED: 411,
  PRECONDITION_FAILED: 412,
  PAYLOAD_TOO_LARGE: 413,
  URI_TOO_LONG: 414,
  UNSUPPORTED_MEDIA_TYPE: 415,
  RANGE_NOT_SATISFIABLE: 416,
  EXPECTATION_FAILED: 417,
  IM_A_TEAPOT: 418,
  MISDIRECTED_REQUEST: 421,
  UNPROCESSABLE_ENTITY: 422,
  LOCKED: 423,
  FAILED_DEPENDENCY: 424,
  TOO_EARLY: 425,
  UPGRADE_REQUIRED: 426,
  PRECONDITION_REQUIRED: 428,
  TOO_MANY_REQUESTS: 429,
  REQUEST_HEADER_FIELDS_TOO_LARGE: 431,
  UNAVAILABLE_FOR_LEGAL_REASONS: 451,

  // Server errors
  INTERNAL_SERVER_ERROR: 500,
  NOT_IMPLEMENTED: 501,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
  HTTP_VERSION_NOT_SUPPORTED: 505,
  VARIANT_ALSO_NEGOTIATES: 506,
  INSUFFICIENT_STORAGE: 507,
  LOOP_DETECTED: 508,
  NOT_EXTENDED: 510,
  NETWORK_AUTHENTICATION_REQUIRED: 511,
} as const;

/**
 * Common content types
 */
export const CONTENT_TYPES = {
  JSON: 'application/json',
  XML: 'application/xml',
  HTML: 'text/html',
  TEXT: 'text/plain',
  FORM_DATA: 'multipart/form-data',
  FORM_URLENCODED: 'application/x-www-form-urlencoded',
  OCTET_STREAM: 'application/octet-stream',
  PDF: 'application/pdf',
  ZIP: 'application/zip',
  PNG: 'image/png',
  JPEG: 'image/jpeg',
  GIF: 'image/gif',
  SVG: 'image/svg+xml',
} as const;

/**
 * Common HTTP headers
 */
export const HEADERS = {
  CONTENT_TYPE: 'Content-Type',
  CONTENT_LENGTH: 'Content-Length',
  CONTENT_ENCODING: 'Content-Encoding',
  CONTENT_DISPOSITION: 'Content-Disposition',
  ACCEPT: 'Accept',
  ACCEPT_ENCODING: 'Accept-Encoding',
  ACCEPT_LANGUAGE: 'Accept-Language',
  AUTHORIZATION: 'Authorization',
  CACHE_CONTROL: 'Cache-Control',
  COOKIE: 'Cookie',
  SET_COOKIE: 'Set-Cookie',
  HOST: 'Host',
  ORIGIN: 'Origin',
  REFERER: 'Referer',
  USER_AGENT: 'User-Agent',
  X_REQUESTED_WITH: 'X-Requested-With',
  X_CSRF_TOKEN: 'X-CSRF-Token',
  X_API_KEY: 'X-API-Key',
} as const;

/**
 * HTTP methods as array (useful for iteration)
 */
export const HTTP_METHODS = [
  'GET',
  'POST',
  'PUT',
  'DELETE',
  'PATCH',
  'HEAD',
  'OPTIONS',
  'CONNECT',
  'TRACE',
] as const;

/**
 * Auth types as array
 */
export const AUTH_TYPES = [
  'none',
  'bearer',
  'basic',
  'api-key',
  'oauth2',
  'digest',
  'hawk',
  'aws-signature',
] as const;

/**
 * Body types as array
 */
export const BODY_TYPES = [
  'none',
  'json',
  'form-data',
  'x-www-form-urlencoded',
  'raw',
  'binary',
] as const;
