import { z } from 'zod'

export const HttpMethodSchema = z.enum([
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'HEAD',
  'OPTIONS',
])

export const AuthSchema = z.object({
  type: z.enum(['bearer', 'api-key', 'basic']).describe('Tipo de autenticación'),
  token: z.string().optional().describe('Token para Bearer auth'),
  key: z.string().optional().describe('API key value'),
  header: z.string().optional().describe('Header name para API key (default: X-API-Key)'),
  username: z.string().optional().describe('Username para Basic auth'),
  password: z.string().optional().describe('Password para Basic auth'),
})

/**
 * Shape (raw properties) del AuthSchema para usar con server.tool()
 * que espera raw Zod shapes, no z.object().
 */
export const AuthSchemaShape = AuthSchema.shape

/**
 * Shape compartido de parámetros de compresión de respuesta. Aplicable a
 * cualquier tool que devuelva una response HTTP. Reduce tokens de contexto.
 */
export const VerbosityShape = {
  verbosity: z
    .enum(['minimal', 'normal', 'full'])
    .optional()
    .describe(
      `Controls response detail to save context tokens. Default: 'normal'.

- 'minimal': Only status, method, url, elapsed_ms, and first 200 chars of body.
  USE FOR: health checks (/health, /ping), status polling loops, fire-and-forget POST/DELETE,
  waiting for a job to complete, or when you only care whether the call succeeded.
  SAVES: ~95% tokens vs full.

- 'normal' (DEFAULT): Filtered headers (omits Date, Server, CF-*, Set-Cookie, etc.) +
  body truncated to max_body_bytes with 'body_truncated' flag.
  USE FOR: most debugging — CRUDs, checking error messages, API contract exploration.
  SAVES: ~75% tokens vs full.

- 'full': Complete response untouched.
  USE FOR: debugging CORS/cache/auth headers, large bodies you must inspect completely,
  or when the user asks to see everything. NO SAVINGS.

If a response is truncated and you need more, prefer inspect_last_response({call_id})
over re-running with 'full'.`,
    ),
  only_fields: z
    .array(z.string())
    .optional()
    .describe(
      `Cheap alternative to 'full' when you know exactly what you need from the body.
Returns only these dot-paths. Supports array index and wildcard.
Examples: ["data.id"], ["user.email", "user.role"], ["items[*].id", "meta.total"].
Often saves >95% vs full while keeping the fields you care about.`,
    ),
  max_body_bytes: z
    .number()
    .int()
    .positive()
    .optional()
    .describe(
      "Max body size in bytes for verbosity='normal' (default: 2048). Ignored for minimal/full.",
    ),
}
