import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { Storage } from '../lib/storage.js'
import { executeRequest } from '../lib/http-client.js'
import { interpolateRequest } from '../lib/interpolation.js'
import type { RequestConfig, RequestResponse } from '../lib/types.js'

const FlowStepSchema = z.object({
  name: z.string().describe('Nombre del paso (ej: "login", "crear-post")'),
  method: z
    .enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'])
    .describe('HTTP method'),
  url: z.string().describe('URL del endpoint'),
  headers: z.record(z.string()).optional().describe('Headers HTTP'),
  body: z.any().optional().describe('Body del request'),
  query: z.record(z.string()).optional().describe('Query parameters'),
  auth: z
    .object({
      type: z.enum(['bearer', 'api-key', 'basic']),
      token: z.string().optional(),
      key: z.string().optional(),
      header: z.string().optional(),
      username: z.string().optional(),
      password: z.string().optional(),
    })
    .optional()
    .describe('Autenticación'),
  extract: z
    .record(z.string())
    .optional()
    .describe(
      'Variables a extraer de la respuesta para pasos siguientes. Key = nombre variable, value = path (ej: { "TOKEN": "body.token", "USER_ID": "body.data.id" })',
    ),
})

/**
 * Accede a un valor en un objeto usando dot notation.
 */
function getByPath(obj: unknown, path: string): unknown {
  const parts = path.split('.')
  let current: unknown = obj

  for (const part of parts) {
    if (current === null || current === undefined) return undefined
    if (typeof current === 'object') {
      // Handle array index access like "data.0.id"
      if (Array.isArray(current) && /^\d+$/.test(part)) {
        current = current[parseInt(part)]
      } else {
        current = (current as Record<string, unknown>)[part]
      }
    } else {
      return undefined
    }
  }

  return current
}

export function registerFlowTool(server: McpServer, storage: Storage): void {
  server.tool(
    'flow_run',
    'Ejecuta una secuencia de requests en orden. Extrae variables de cada respuesta para usar en pasos siguientes con {{variable}}.',
    {
      steps: z.array(FlowStepSchema).describe('Pasos a ejecutar en orden'),
      stop_on_error: z
        .boolean()
        .optional()
        .describe('Detener al primer error (default: true)'),
    },
    async (params) => {
      try {
        const stopOnError = params.stop_on_error ?? true
        const envVariables = await storage.getActiveVariables()
        const flowVariables: Record<string, string> = { ...envVariables }
        const results: Array<{
          name: string
          status: number
          timing: number
          extracted: Record<string, string>
          error?: string
        }> = []

        for (const step of params.steps) {
          try {
            // Auto-prepend BASE_URL for relative URLs
            let resolvedUrl = step.url
            if (resolvedUrl.startsWith('/') && flowVariables.BASE_URL) {
              const baseUrl = flowVariables.BASE_URL.replace(/\/+$/, '')
              resolvedUrl = `${baseUrl}${resolvedUrl}`
            }

            const config: RequestConfig = {
              method: step.method,
              url: resolvedUrl,
              headers: step.headers,
              body: step.body,
              query: step.query,
              auth: step.auth,
            }

            // Interpolate with accumulated flow variables
            const interpolated = interpolateRequest(config, flowVariables)
            const response: RequestResponse = await executeRequest(interpolated)

            // Extract variables from response
            const extracted: Record<string, string> = {}
            if (step.extract) {
              for (const [varName, path] of Object.entries(step.extract)) {
                const value = getByPath(response, path)
                if (value !== undefined && value !== null) {
                  extracted[varName] = String(value)
                  flowVariables[varName] = String(value)
                }
              }
            }

            results.push({
              name: step.name,
              status: response.status,
              timing: response.timing.total_ms,
              extracted,
            })
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            results.push({
              name: step.name,
              status: 0,
              timing: 0,
              extracted: {},
              error: message,
            })

            if (stopOnError) break
          }
        }

        // Build output
        const allOk = results.every((r) => !r.error && r.status >= 200 && r.status < 400)
        const lines: string[] = [
          `${allOk ? '✅ FLOW COMPLETO' : '❌ FLOW CON ERRORES'} — ${results.length}/${params.steps.length} pasos ejecutados`,
          '',
        ]

        for (let i = 0; i < results.length; i++) {
          const r = results[i]
          const icon = r.error ? '❌' : r.status >= 200 && r.status < 400 ? '✅' : '⚠️'
          lines.push(`${icon} Paso ${i + 1}: ${r.name}`)

          if (r.error) {
            lines.push(`   Error: ${r.error}`)
          } else {
            lines.push(`   Status: ${r.status} | Tiempo: ${r.timing}ms`)
          }

          if (Object.keys(r.extracted).length > 0) {
            const vars = Object.entries(r.extracted)
              .map(([k, v]) => `${k}=${v.length > 50 ? v.substring(0, 50) + '...' : v}`)
              .join(', ')
            lines.push(`   Extraído: ${vars}`)
          }

          lines.push('')
        }

        return {
          content: [{ type: 'text' as const, text: lines.join('\n') }],
          isError: !allOk,
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
