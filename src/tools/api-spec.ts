import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { Storage } from '../lib/storage.js'
import { parseOpenApiSpec } from '../lib/openapi-parser.js'
import { readFile } from 'node:fs/promises'

export function registerApiSpecTools(server: McpServer, storage: Storage): void {
  // ── api_import ──

  server.tool(
    'api_import',
    'Importa un spec OpenAPI/Swagger desde una URL o archivo local. Guarda los endpoints y schemas para consulta.',
    {
      name: z
        .string()
        .describe('Nombre para identificar este API (ej: "mi-backend", "cocaxcode-api")'),
      source: z
        .string()
        .describe(
          'URL del spec OpenAPI JSON (ej: http://localhost:3001/api-docs-json) o ruta a archivo local',
        ),
    },
    async (params) => {
      try {
        let rawDoc: Record<string, unknown>

        if (params.source.startsWith('http://') || params.source.startsWith('https://')) {
          // Fetch from URL
          const controller = new AbortController()
          const timeout = setTimeout(() => controller.abort(), 30000)

          try {
            const response = await fetch(params.source, { signal: controller.signal })
            if (!response.ok) {
              return {
                content: [
                  {
                    type: 'text' as const,
                    text: `Error: No se pudo descargar el spec. Status: ${response.status} ${response.statusText}`,
                  },
                ],
                isError: true,
              }
            }
            rawDoc = (await response.json()) as Record<string, unknown>
          } finally {
            clearTimeout(timeout)
          }
        } else {
          // Read from local file
          try {
            const content = await readFile(params.source, 'utf-8')
            rawDoc = JSON.parse(content) as Record<string, unknown>
          } catch {
            return {
              content: [
                {
                  type: 'text' as const,
                  text: `Error: No se pudo leer el archivo '${params.source}'. Verifica que existe y es JSON válido.`,
                },
              ],
              isError: true,
            }
          }
        }

        // Validate it looks like OpenAPI
        if (!rawDoc.openapi && !rawDoc.swagger) {
          return {
            content: [
              {
                type: 'text' as const,
                text: 'Error: El documento no parece ser un spec OpenAPI/Swagger válido. Falta la propiedad "openapi" o "swagger".',
              },
            ],
            isError: true,
          }
        }

        // Parse and save
        const spec = parseOpenApiSpec(rawDoc, params.name, params.source)
        await storage.saveSpec(spec)

        // Build summary
        const tagCounts: Record<string, number> = {}
        for (const ep of spec.endpoints) {
          for (const tag of ep.tags ?? ['sin-tag']) {
            tagCounts[tag] = (tagCounts[tag] ?? 0) + 1
          }
        }

        const tagSummary = Object.entries(tagCounts)
          .map(([tag, count]) => `  - ${tag}: ${count} endpoints`)
          .join('\n')

        const schemaCount = Object.keys(spec.schemas).length

        return {
          content: [
            {
              type: 'text' as const,
              text: [
                `API '${params.name}' importada correctamente.`,
                '',
                `Versión: ${spec.version ?? 'no especificada'}`,
                `Endpoints: ${spec.endpoints.length}`,
                `Schemas: ${schemaCount}`,
                '',
                'Endpoints por tag:',
                tagSummary,
                '',
                'Usa api_endpoints para ver los endpoints disponibles.',
                'Usa api_endpoint_detail para ver el detalle de un endpoint específico.',
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

  // ── api_endpoints ──

  server.tool(
    'api_endpoints',
    'Lista los endpoints de un API importada. Filtra por tag, método o path.',
    {
      name: z
        .string()
        .describe('Nombre del API importada'),
      tag: z
        .string()
        .optional()
        .describe('Filtrar por tag (ej: "blog", "auth", "users")'),
      method: z
        .enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'])
        .optional()
        .describe('Filtrar por método HTTP'),
      path: z
        .string()
        .optional()
        .describe('Filtrar por path (búsqueda parcial, ej: "/blog" muestra todos los que contienen /blog)'),
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

        let endpoints = spec.endpoints

        // Apply filters
        if (params.tag) {
          endpoints = endpoints.filter((ep) =>
            (ep.tags ?? []).some((t) => t.toLowerCase() === params.tag!.toLowerCase()),
          )
        }
        if (params.method) {
          endpoints = endpoints.filter((ep) => ep.method === params.method)
        }
        if (params.path) {
          const search = params.path.toLowerCase()
          endpoints = endpoints.filter((ep) => ep.path.toLowerCase().includes(search))
        }

        if (endpoints.length === 0) {
          return {
            content: [
              {
                type: 'text' as const,
                text: 'No se encontraron endpoints con los filtros aplicados.',
              },
            ],
          }
        }

        // Format output
        const lines = endpoints.map((ep) => {
          const tags = ep.tags?.length ? ` [${ep.tags.join(', ')}]` : ''
          const summary = ep.summary ? ` — ${ep.summary}` : ''
          return `${ep.method.padEnd(7)} ${ep.path}${summary}${tags}`
        })

        return {
          content: [
            {
              type: 'text' as const,
              text: [
                `API: ${spec.name} (${endpoints.length} endpoints)`,
                '',
                ...lines,
                '',
                'Usa api_endpoint_detail para ver parámetros, body y respuestas de un endpoint.',
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

  // ── api_endpoint_detail ──

  server.tool(
    'api_endpoint_detail',
    'Muestra el detalle completo de un endpoint: parámetros, body schema, y respuestas. Útil para saber qué datos enviar.',
    {
      name: z
        .string()
        .describe('Nombre del API importada'),
      method: z
        .enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'])
        .describe('Método HTTP del endpoint'),
      path: z
        .string()
        .describe('Path exacto del endpoint (ej: "/blog", "/auth/login")'),
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
          // Try partial match
          const similar = spec.endpoints.filter((ep) =>
            ep.path.includes(params.path) || params.path.includes(ep.path),
          )

          const suggestion = similar.length > 0
            ? `\n\nEndpoints similares:\n${similar.map((ep) => `  ${ep.method} ${ep.path}`).join('\n')}`
            : ''

          return {
            content: [
              {
                type: 'text' as const,
                text: `Error: Endpoint ${params.method} ${params.path} no encontrado.${suggestion}`,
              },
            ],
            isError: true,
          }
        }

        // Build detailed output
        const sections: string[] = []

        // Header
        sections.push(`## ${endpoint.method} ${endpoint.path}`)
        if (endpoint.summary) sections.push(`**${endpoint.summary}**`)
        if (endpoint.description) sections.push(endpoint.description)
        if (endpoint.tags?.length) sections.push(`Tags: ${endpoint.tags.join(', ')}`)

        // Parameters
        if (endpoint.parameters?.length) {
          sections.push('')
          sections.push('### Parámetros')
          for (const param of endpoint.parameters) {
            const required = param.required ? ' (requerido)' : ' (opcional)'
            const type = param.schema?.type ?? 'string'
            const desc = param.description ? ` — ${param.description}` : ''
            sections.push(`- **${param.name}** [${param.in}] ${type}${required}${desc}`)
          }
        }

        // Request body
        if (endpoint.requestBody) {
          sections.push('')
          sections.push('### Body')
          const required = endpoint.requestBody.required ? ' (requerido)' : ' (opcional)'
          sections.push(`Body${required}`)

          if (endpoint.requestBody.content) {
            for (const [contentType, media] of Object.entries(endpoint.requestBody.content)) {
              sections.push(`\nContent-Type: ${contentType}`)
              if (media.schema) {
                sections.push('```json')
                sections.push(formatSchema(media.schema))
                sections.push('```')
              }
            }
          }
        }

        // Responses
        if (endpoint.responses) {
          sections.push('')
          sections.push('### Respuestas')
          for (const [status, resp] of Object.entries(endpoint.responses)) {
            const desc = resp.description ? ` — ${resp.description}` : ''
            sections.push(`\n**${status}**${desc}`)

            if (resp.content) {
              for (const [, media] of Object.entries(resp.content)) {
                if (media.schema) {
                  sections.push('```json')
                  sections.push(formatSchema(media.schema))
                  sections.push('```')
                }
              }
            }
          }
        }

        return {
          content: [
            {
              type: 'text' as const,
              text: sections.join('\n'),
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

/**
 * Formatea un schema como ejemplo JSON legible.
 * Genera un ejemplo basado en los tipos y propiedades del schema.
 */
function formatSchema(schema: { type?: string; properties?: Record<string, unknown>; items?: unknown; required?: string[]; enum?: unknown[]; example?: unknown; format?: string; description?: string }, depth = 0): string {
  if (depth > 5) return '"..."'

  const indent = '  '.repeat(depth)
  const innerIndent = '  '.repeat(depth + 1)

  if (schema.example !== undefined) {
    return JSON.stringify(schema.example, null, 2)
      .split('\n')
      .map((line, i) => (i === 0 ? line : indent + line))
      .join('\n')
  }

  if (schema.enum) {
    return JSON.stringify(schema.enum[0])
  }

  if (schema.type === 'object' && schema.properties) {
    const props = Object.entries(schema.properties as Record<string, Record<string, unknown>>)
    if (props.length === 0) return '{}'

    const requiredFields = new Set(schema.required ?? [])
    const lines: string[] = ['{']

    for (const [key, prop] of props) {
      const isRequired = requiredFields.has(key)
      const comment = []
      if (prop.description) comment.push(prop.description as string)
      if (!isRequired) comment.push('opcional')
      const commentStr = comment.length > 0 ? ` // ${comment.join(' — ')}` : ''

      const value = formatSchema(prop as typeof schema, depth + 1)
      lines.push(`${innerIndent}"${key}": ${value},${commentStr}`)
    }

    lines.push(`${indent}}`)
    return lines.join('\n')
  }

  if (schema.type === 'array' && schema.items) {
    const itemValue = formatSchema(schema.items as typeof schema, depth + 1)
    return `[${itemValue}]`
  }

  // Primitive types
  switch (schema.type) {
    case 'string':
      if (schema.format === 'date-time') return '"2024-01-01T00:00:00Z"'
      if (schema.format === 'email') return '"user@example.com"'
      if (schema.format === 'uri' || schema.format === 'url') return '"https://example.com"'
      return '"string"'
    case 'number':
    case 'integer':
      return '0'
    case 'boolean':
      return 'true'
    default:
      return 'null'
  }
}
