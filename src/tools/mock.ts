import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { Storage } from '../lib/storage.js'
import type { ApiSpecSchema } from '../lib/types.js'

/**
 * Genera datos fake basándose en un schema OpenAPI.
 */
function generateMockData(schema: ApiSpecSchema, depth = 0): unknown {
  if (depth > 8) return null

  // If example exists, use it
  if (schema.example !== undefined) return schema.example

  // If enum, pick first value
  if (schema.enum && schema.enum.length > 0) {
    return schema.enum[Math.floor(Math.random() * schema.enum.length)]
  }

  switch (schema.type) {
    case 'object': {
      if (!schema.properties) return {}
      const obj: Record<string, unknown> = {}
      for (const [key, propSchema] of Object.entries(schema.properties)) {
        obj[key] = generateMockData(propSchema, depth + 1)
      }
      return obj
    }

    case 'array': {
      if (!schema.items) return []
      const count = Math.floor(Math.random() * 3) + 1 // 1-3 items
      return Array.from({ length: count }, () =>
        generateMockData(schema.items!, depth + 1),
      )
    }

    case 'string': {
      switch (schema.format) {
        case 'date-time':
          return new Date().toISOString()
        case 'date':
          return new Date().toISOString().split('T')[0]
        case 'email':
          return `user${Math.floor(Math.random() * 1000)}@example.com`
        case 'uri':
        case 'url':
          return 'https://example.com/resource'
        case 'uuid':
          return crypto.randomUUID()
        case 'ipv4':
          return `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`
        default: {
          // Use description or key name for smarter generation
          const desc = (schema.description ?? '').toLowerCase()
          if (desc.includes('name') || desc.includes('nombre'))
            return `Test User ${Math.floor(Math.random() * 100)}`
          if (desc.includes('title') || desc.includes('título'))
            return `Test Title ${Math.floor(Math.random() * 100)}`
          if (desc.includes('description') || desc.includes('descripción'))
            return 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.'
          if (desc.includes('password') || desc.includes('contraseña'))
            return 'TestPass123!'
          if (desc.includes('slug'))
            return `test-slug-${Math.floor(Math.random() * 1000)}`
          if (desc.includes('phone') || desc.includes('teléfono'))
            return '+34612345678'
          return `mock-string-${Math.floor(Math.random() * 10000)}`
        }
      }
    }

    case 'number':
    case 'integer':
      return Math.floor(Math.random() * 1000)

    case 'boolean':
      return Math.random() > 0.5

    default:
      return null
  }
}

export function registerMockTool(server: McpServer, storage: Storage): void {
  server.tool(
    'mock',
    'Genera datos mock/fake para un endpoint basándose en su spec OpenAPI importada. Útil para frontend sin backend.',
    {
      name: z.string().describe('Nombre del API importada'),
      method: z
        .enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'])
        .describe('Método HTTP del endpoint'),
      path: z.string().describe('Path del endpoint (ej: "/users", "/blog")'),
      target: z
        .enum(['request', 'response'])
        .optional()
        .describe('Generar mock del body de request o de la response (default: response)'),
      status: z
        .string()
        .optional()
        .describe('Status code de la respuesta a mockear (default: "200" o "201")'),
      count: z
        .number()
        .optional()
        .describe('Número de items mock a generar si el schema es un array (default: 3)'),
    },
    async (params) => {
      try {
        const spec = await storage.getSpec(params.name)
        if (!spec) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `Error: API '${params.name}' no encontrada. Usa api_import para importarla primero.`,
              },
            ],
            isError: true,
          }
        }

        const endpoint = spec.endpoints.find(
          (ep) => ep.method === params.method && ep.path === params.path,
        )

        if (!endpoint) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `Error: Endpoint ${params.method} ${params.path} no encontrado en '${params.name}'.`,
              },
            ],
            isError: true,
          }
        }

        const target = params.target ?? 'response'
        let schema: ApiSpecSchema | undefined

        if (target === 'request') {
          // Get request body schema
          const content = endpoint.requestBody?.content
          if (content) {
            const jsonContent = content['application/json']
            schema = jsonContent?.schema
          }

          if (!schema) {
            return {
              content: [
                {
                  type: 'text' as const,
                  text: `Error: El endpoint ${params.method} ${params.path} no tiene un body schema definido.`,
                },
              ],
              isError: true,
            }
          }
        } else {
          // Get response body schema
          const statusCode = params.status ?? (params.method === 'POST' ? '201' : '200')
          const response = endpoint.responses?.[statusCode]

          if (!response) {
            // Try to find any 2xx response
            const twoXX = Object.keys(endpoint.responses ?? {}).find((s) => s.startsWith('2'))
            if (twoXX && endpoint.responses) {
              const fallbackResp = endpoint.responses[twoXX]
              const content = fallbackResp?.content
              if (content) {
                const jsonContent = content['application/json']
                schema = jsonContent?.schema
              }
            }
          } else {
            const content = response.content
            if (content) {
              const jsonContent = content['application/json']
              schema = jsonContent?.schema
            }
          }

          if (!schema) {
            return {
              content: [
                {
                  type: 'text' as const,
                  text: `Error: No se encontró un schema de respuesta para ${params.method} ${params.path}.`,
                },
              ],
              isError: true,
            }
          }
        }

        // Generate mock data
        let mockData: unknown

        if (schema.type === 'array' && params.count) {
          // Generate specific number of items
          mockData = Array.from({ length: params.count }, () =>
            generateMockData(schema!.items ?? { type: 'object' }),
          )
        } else {
          mockData = generateMockData(schema)
        }

        const label = target === 'request' ? 'REQUEST BODY' : 'RESPONSE'

        return {
          content: [
            {
              type: 'text' as const,
              text: [
                `Mock ${label} para ${params.method} ${params.path}:`,
                '',
                '```json',
                JSON.stringify(mockData, null, 2),
                '```',
                '',
                'Datos generados automáticamente desde el spec OpenAPI.',
                target === 'request'
                  ? 'Puedes usar estos datos directamente en un request.'
                  : 'Estos son datos de ejemplo que devolvería el endpoint.',
              ].join('\n'),
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
