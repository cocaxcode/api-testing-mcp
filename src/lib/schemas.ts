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
