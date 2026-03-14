import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { Storage } from '../lib/storage.js'
import { executeRequest } from '../lib/http-client.js'
import { interpolateRequest } from '../lib/interpolation.js'
import type { RequestConfig } from '../lib/types.js'

const AuthSchema = {
  type: z.enum(['bearer', 'api-key', 'basic']).describe('Tipo de autenticación'),
  token: z.string().optional().describe('Token para Bearer auth'),
  key: z.string().optional().describe('API key value'),
  header: z.string().optional().describe('Header name para API key (default: X-API-Key)'),
  username: z.string().optional().describe('Username para Basic auth'),
  password: z.string().optional().describe('Password para Basic auth'),
}

export function registerRequestTool(server: McpServer, storage: Storage): void {
  server.tool(
    'request',
    'Ejecuta un HTTP request. URLs relativas (/path) usan BASE_URL del entorno activo. Soporta {{variables}}.',
    {
      method: z
        .enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'])
        .describe('HTTP method'),
      url: z
        .string()
        .describe(
          'URL del endpoint. Si empieza con / se antepone BASE_URL del entorno activo. Soporta {{variables}}.',
        ),
      headers: z
        .record(z.string())
        .optional()
        .describe('Headers HTTP como key-value pairs'),
      body: z.any().optional().describe('Body del request (JSON). Soporta {{variables}}'),
      query: z
        .record(z.string())
        .optional()
        .describe('Query parameters como key-value pairs'),
      timeout: z.number().optional().describe('Timeout en milisegundos (default: 30000)'),
      auth: z
        .object(AuthSchema)
        .optional()
        .describe('Configuración de autenticación'),
    },
    async (params) => {
      try {
        // Cargar variables del entorno activo
        const variables = await storage.getActiveVariables()

        // Auto-prepend BASE_URL para URLs relativas (empiezan con /)
        let resolvedUrl = params.url
        if (resolvedUrl.startsWith('/') && variables.BASE_URL) {
          // Quitar trailing slash de BASE_URL para evitar doble slash
          const baseUrl = variables.BASE_URL.replace(/\/+$/, '')
          resolvedUrl = `${baseUrl}${resolvedUrl}`
        }

        // Construir RequestConfig
        const config: RequestConfig = {
          method: params.method,
          url: resolvedUrl,
          headers: params.headers,
          body: params.body,
          query: params.query,
          timeout: params.timeout,
          auth: params.auth,
        }

        // Interpolar variables
        const interpolated = interpolateRequest(config, variables)

        // Ejecutar request
        const response = await executeRequest(interpolated)

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(response, null, 2),
            },
          ],
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return {
          content: [{ type: 'text' as const, text: `Error: ${message}` }],
          isError: true,
        }
      }
    },
  )
}
