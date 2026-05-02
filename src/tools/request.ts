import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { Storage } from '../lib/storage.js'
import { executeRequest } from '../lib/http-client.js'
import { interpolateRequest } from '../lib/interpolation.js'
import { resolveUrl } from '../lib/url.js'
import { AuthSchemaShape, VerbosityShape, HttpMethodSchema } from '../lib/schemas.js'
import { compressResponse, makeCallId } from '../lib/compress.js'
import type { ResponseCache } from '../lib/response-cache.js'
import type { RequestConfig } from '../lib/types.js'

export function registerRequestTool(
  server: McpServer,
  storage: Storage,
  cache: ResponseCache,
): void {
  server.tool(
    'request',
    'Ejecuta un HTTP request. URLs relativas (/path) usan BASE_URL del entorno activo. Soporta {{variables}}. La respuesta se comprime por defecto (verbosity=normal) para ahorrar tokens; usa verbosity=full o inspect_last_response si necesitas la respuesta completa.',
    {
      method: HttpMethodSchema.describe('HTTP method'),
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
        .object(AuthSchemaShape)
        .optional()
        .describe('Configuración de autenticación'),
      ...VerbosityShape,
    },
    async (params) => {
      try {
        const variables = await storage.getActiveVariables()
        const resolvedUrl = resolveUrl(params.url, variables)

        const config: RequestConfig = {
          method: params.method,
          url: resolvedUrl,
          headers: params.headers,
          body: params.body,
          query: params.query,
          timeout: params.timeout,
          auth: params.auth,
        }

        const interpolated = interpolateRequest(config, variables)
        const response = await executeRequest(interpolated)

        const callId = makeCallId()
        // Guarda la response full para poder recuperarla con inspect_last_response
        await cache.save(callId, interpolated.method, interpolated.url, response)

        const compressed = compressResponse(response, {
          verbosity: params.verbosity,
          only_fields: params.only_fields,
          max_body_bytes: params.max_body_bytes,
          request_method: interpolated.method,
          request_url: interpolated.url,
          call_id: callId,
        })

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(compressed, null, 2),
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
