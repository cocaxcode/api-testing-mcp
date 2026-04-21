import type { RequestResponse } from './types.js'

export type Verbosity = 'minimal' | 'normal' | 'full'

export const DEFAULT_MAX_BODY_BYTES = 2048

/**
 * Headers que se omiten en verbosity='normal'. Mayúsculas/minúsculas no importan.
 * Exportado para que los usuarios puedan inspeccionar o extender.
 */
export const FILTERED_HEADERS: ReadonlySet<string> = new Set(
  [
    'date',
    'server',
    'connection',
    'keep-alive',
    'transfer-encoding',
    'vary',
    'age',
    'set-cookie',
    'expires',
    'last-modified',
    'etag',
    'accept-ranges',
    'strict-transport-security',
    'alt-svc',
    'report-to',
    'nel',
    'x-powered-by',
    'x-content-type-options',
    'x-frame-options',
    'x-xss-protection',
    'referrer-policy',
    'content-security-policy',
    'permissions-policy',
  ].map((h) => h.toLowerCase()),
)

/**
 * Patrones regex aplicados a nombres de header en verbosity='normal'.
 * Cubre familias enteras sin listar cada variante.
 */
export const FILTERED_HEADER_PATTERNS: ReadonlyArray<RegExp> = [
  /^cf-/i, // Cloudflare (cf-ray, cf-cache-status, ...)
  /^x-amz-/i, // AWS
  /^x-azure-/i, // Azure
  /^x-goog-/i, // Google Cloud
  /^x-.*-cache/i, // X-Fly-Cache-Status, X-Varnish-Cache, ...
  /^x-request-id$/i,
  /^x-correlation-id$/i,
  /^x-trace-id$/i,
]

function isFilteredHeader(name: string): boolean {
  const lower = name.toLowerCase()
  if (FILTERED_HEADERS.has(lower)) return true
  return FILTERED_HEADER_PATTERNS.some((re) => re.test(name))
}

export function filterHeaders(
  headers: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(headers)) {
    if (!isFilteredHeader(k)) out[k] = v
  }
  return out
}

/**
 * Genera un call_id corto (8 chars) usando timestamp + random en base36.
 * No necesita ser criptográficamente único — evita colisiones en ring buffer.
 */
export function makeCallId(): string {
  const ts = Date.now().toString(36)
  const rnd = Math.random().toString(36).slice(2, 6)
  return (ts + rnd).slice(-8)
}

/**
 * Accede a un valor usando dot-notation extendida.
 * Soporta: "a.b", "a.0.b", "a[0].b", "items[*].id" (wildcard en array).
 */
export function getByDotPath(obj: unknown, path: string): unknown {
  // Normaliza: items[0].id → items.0.id, items[*].id → items.*.id
  const normalized = path.replace(/\[(\d+|\*)\]/g, '.$1')
  const parts = normalized.split('.').filter((p) => p.length > 0)

  let current: unknown[] = [obj]
  for (const part of parts) {
    const next: unknown[] = []
    for (const cur of current) {
      if (cur === null || cur === undefined) continue
      if (part === '*') {
        if (Array.isArray(cur)) {
          for (const item of cur) next.push(item)
        }
        continue
      }
      if (Array.isArray(cur) && /^\d+$/.test(part)) {
        next.push(cur[parseInt(part, 10)])
        continue
      }
      if (typeof cur === 'object') {
        next.push((cur as Record<string, unknown>)[part])
      }
    }
    current = next
    if (current.length === 0) return undefined
  }

  if (current.length === 0) return undefined
  if (current.length === 1) return current[0]
  return current
}

/**
 * Construye un objeto con solo los paths solicitados.
 * Si un path es único devuelve el valor directo; si es wildcard devuelve array.
 */
export function pickByDotPaths(
  body: unknown,
  paths: string[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const path of paths) {
    const value = getByDotPath(body, path)
    if (value !== undefined) out[path] = value
  }
  return out
}

export interface CompressOptions {
  verbosity?: Verbosity
  only_fields?: string[]
  max_body_bytes?: number
  request_method?: string
  request_url?: string
  call_id?: string
}

export interface CompressedResponse {
  call_id: string
  status: number
  statusText?: string
  method?: string
  url?: string
  timing: { total_ms: number }
  headers?: Record<string, string>
  body?: unknown
  body_preview?: string
  body_truncated?: boolean
  size_bytes: number
  tokens_saved_estimate?: number
  hint?: string
}

function truncateBody(
  body: unknown,
  maxBytes: number,
): { body: unknown; truncated: boolean; serialized: string } {
  if (body === undefined || body === null) {
    return { body, truncated: false, serialized: '' }
  }
  const serialized =
    typeof body === 'string' ? body : JSON.stringify(body, null, 2)
  const byteLen = Buffer.byteLength(serialized, 'utf-8')
  if (byteLen <= maxBytes) {
    return { body, truncated: false, serialized }
  }
  // Truncamos sobre el string serializado (no intentamos preservar estructura JSON)
  const slice = Buffer.from(serialized, 'utf-8').subarray(0, maxBytes).toString('utf-8')
  return { body: slice, truncated: true, serialized }
}

/**
 * Aplica compresión a una RequestResponse según verbosity y opciones.
 * No muta la response original — devuelve un nuevo objeto plano listo para serializar.
 */
export function compressResponse(
  response: RequestResponse,
  opts: CompressOptions = {},
): CompressedResponse {
  const verbosity: Verbosity = opts.verbosity ?? 'normal'
  const maxBody = opts.max_body_bytes ?? DEFAULT_MAX_BODY_BYTES
  const callId = opts.call_id ?? makeCallId()
  const originalBytes = response.size_bytes

  const base: CompressedResponse = {
    call_id: callId,
    status: response.status,
    timing: { total_ms: response.timing.total_ms },
    size_bytes: originalBytes,
  }
  if (opts.request_method) base.method = opts.request_method
  if (opts.request_url) base.url = opts.request_url

  // only_fields tiene precedencia sobre verbosity para el body
  if (opts.only_fields && opts.only_fields.length > 0) {
    base.body = pickByDotPaths(response.body, opts.only_fields)
    // Aun así respetamos verbosity para headers
    if (verbosity === 'full') {
      base.headers = response.headers
      base.statusText = response.statusText
    } else if (verbosity === 'normal') {
      base.headers = filterHeaders(response.headers)
      base.statusText = response.statusText
    }
    const compressedSize = Buffer.byteLength(JSON.stringify(base.body), 'utf-8')
    base.tokens_saved_estimate = Math.max(
      0,
      Math.floor((originalBytes - compressedSize) / 4),
    )
    return base
  }

  if (verbosity === 'full') {
    base.statusText = response.statusText
    base.headers = response.headers
    base.body = response.body
    base.tokens_saved_estimate = 0
    return base
  }

  if (verbosity === 'minimal') {
    const preview =
      typeof response.body === 'string'
        ? response.body.slice(0, 200)
        : JSON.stringify(response.body ?? null).slice(0, 200)
    base.body_preview = preview
    if (originalBytes > preview.length) {
      base.body_truncated = true
      base.hint = `Call inspect_last_response({ call_id: "${callId}" }) for the full response.`
    }
    base.tokens_saved_estimate = Math.max(0, Math.floor((originalBytes - 200) / 4))
    return base
  }

  // normal
  base.statusText = response.statusText
  base.headers = filterHeaders(response.headers)
  const { body, truncated, serialized } = truncateBody(response.body, maxBody)
  base.body = body
  if (truncated) {
    base.body_truncated = true
    base.hint = `Body truncated to ${maxBody} bytes (full size: ${Buffer.byteLength(
      serialized,
      'utf-8',
    )}B). Call inspect_last_response({ call_id: "${callId}" }) for the full body.`
  }
  const compressedSize = Buffer.byteLength(JSON.stringify(base), 'utf-8')
  base.tokens_saved_estimate = Math.max(
    0,
    Math.floor((originalBytes - compressedSize) / 4),
  )
  return base
}
