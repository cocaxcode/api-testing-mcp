// ── HTTP Request/Response ──

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS'

export interface AuthConfig {
  type: 'bearer' | 'api-key' | 'basic'
  /** Token para Bearer auth */
  token?: string
  /** API key value */
  key?: string
  /** Header name para API key (default: X-API-Key) */
  header?: string
  /** Username para Basic auth */
  username?: string
  /** Password para Basic auth */
  password?: string
}

export interface RequestConfig {
  method: HttpMethod
  url: string
  headers?: Record<string, string>
  body?: unknown
  query?: Record<string, string>
  /** Timeout en milisegundos (default: 30000) */
  timeout?: number
  auth?: AuthConfig
}

export interface RequestResponse {
  status: number
  statusText: string
  headers: Record<string, string>
  body: unknown
  timing: {
    total_ms: number
  }
  size_bytes: number
}

// ── Collection ──

export interface SavedRequest {
  name: string
  request: RequestConfig
  tags?: string[]
  createdAt: string // ISO 8601
  updatedAt: string
}

export interface CollectionListItem {
  name: string
  method: HttpMethod
  url: string
  tags: string[]
}

// ── Environment ──

export interface Environment {
  name: string
  variables: Record<string, string>
  createdAt: string
  updatedAt: string
}

export interface EnvironmentListItem {
  name: string
  active: boolean
  variableCount: number
}
