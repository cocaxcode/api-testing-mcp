import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { Storage } from '../lib/storage.js'
import { executeRequest } from '../lib/http-client.js'
import { interpolateRequest } from '../lib/interpolation.js'
import { resolveUrl } from '../lib/url.js'
import { AuthSchema } from '../lib/schemas.js'
import type { RequestConfig } from '../lib/types.js'

export function registerUtilityTools(server: McpServer, storage: Storage): void {
  // ── export_curl ──

  server.tool(
    'export_curl',
    'Genera un comando cURL a partir de un request guardado en la colección. Listo para copiar y pegar.',
    {
      name: z.string().describe('Nombre del request guardado en la colección'),
      resolve_variables: z
        .boolean()
        .optional()
        .describe('Resolver {{variables}} del entorno activo (default: true)'),
    },
    async (params) => {
      try {
        const saved = await storage.getCollection(params.name)
        if (!saved) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `Error: Request '${params.name}' no encontrado en la colección.`,
              },
            ],
            isError: true,
          }
        }

        let config = saved.request
        const resolveVars = params.resolve_variables ?? true

        if (resolveVars) {
          const variables = await storage.getActiveVariables()
          const resolvedUrl = resolveUrl(config.url, variables)
          config = { ...config, url: resolvedUrl }
          config = interpolateRequest(config, variables)
        }

        // Build cURL command
        const parts: string[] = ['curl']

        if (config.method !== 'GET') {
          parts.push(`-X ${config.method}`)
        }

        let url = config.url
        if (config.query && Object.keys(config.query).length > 0) {
          const queryStr = Object.entries(config.query)
            .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
            .join('&')
          url += (url.includes('?') ? '&' : '?') + queryStr
        }
        parts.push(`'${url}'`)

        if (config.headers) {
          for (const [key, value] of Object.entries(config.headers)) {
            parts.push(`-H '${key}: ${value}'`)
          }
        }

        if (config.auth) {
          switch (config.auth.type) {
            case 'bearer':
              if (config.auth.token) {
                parts.push(`-H 'Authorization: Bearer ${config.auth.token}'`)
              }
              break
            case 'api-key':
              if (config.auth.key) {
                const header = config.auth.header ?? 'X-API-Key'
                parts.push(`-H '${header}: ${config.auth.key}'`)
              }
              break
            case 'basic':
              if (config.auth.username && config.auth.password) {
                parts.push(`-u '${config.auth.username}:${config.auth.password}'`)
              }
              break
          }
        }

        if (config.body !== undefined && config.body !== null) {
          const bodyStr =
            typeof config.body === 'string' ? config.body : JSON.stringify(config.body)
          parts.push(`-H 'Content-Type: application/json'`)
          parts.push(`-d '${bodyStr}'`)
        }

        const curlCommand = parts.join(' \\\n  ')

        return {
          content: [
            {
              type: 'text' as const,
              text: `cURL para '${params.name}':\n\n${curlCommand}`,
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

  // ── diff_responses ──

  const DiffRequestSchema = z.object({
    label: z.string().optional().describe('Etiqueta (ej: "antes", "dev", "v1")'),
    method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']),
    url: z.string(),
    headers: z.record(z.string()).optional(),
    body: z.any().optional(),
    query: z.record(z.string()).optional(),
    auth: AuthSchema.optional(),
  })

  server.tool(
    'diff_responses',
    'Ejecuta dos requests y compara sus respuestas. Útil para detectar regresiones o comparar entornos.',
    {
      request_a: DiffRequestSchema.describe('Primer request'),
      request_b: DiffRequestSchema.describe('Segundo request'),
    },
    async (params) => {
      try {
        const variables = await storage.getActiveVariables()

        const executeOne = async (req: z.infer<typeof DiffRequestSchema>) => {
          const resolvedUrl = resolveUrl(req.url, variables)

          const config: RequestConfig = {
            method: req.method,
            url: resolvedUrl,
            headers: req.headers,
            body: req.body,
            query: req.query,
            auth: req.auth,
          }

          return executeRequest(interpolateRequest(config, variables))
        }

        const [responseA, responseB] = await Promise.all([
          executeOne(params.request_a),
          executeOne(params.request_b),
        ])

        const labelA = params.request_a.label ?? 'A'
        const labelB = params.request_b.label ?? 'B'

        const diffs: string[] = []

        if (responseA.status !== responseB.status) {
          diffs.push(
            `Status: ${labelA}=${responseA.status} vs ${labelB}=${responseB.status}`,
          )
        }

        const timingDiff = Math.abs(responseA.timing.total_ms - responseB.timing.total_ms)
        if (timingDiff > 100) {
          diffs.push(
            `Timing: ${labelA}=${responseA.timing.total_ms}ms vs ${labelB}=${responseB.timing.total_ms}ms (Δ${Math.round(timingDiff)}ms)`,
          )
        }

        const bodyA = JSON.stringify(responseA.body, null, 2)
        const bodyB = JSON.stringify(responseB.body, null, 2)

        if (bodyA !== bodyB) {
          diffs.push('Body: diferente')

          if (
            typeof responseA.body === 'object' &&
            typeof responseB.body === 'object' &&
            responseA.body &&
            responseB.body
          ) {
            const keysA = new Set(Object.keys(responseA.body as Record<string, unknown>))
            const keysB = new Set(Object.keys(responseB.body as Record<string, unknown>))

            const onlyInA = [...keysA].filter((k) => !keysB.has(k))
            const onlyInB = [...keysB].filter((k) => !keysA.has(k))
            const common = [...keysA].filter((k) => keysB.has(k))

            if (onlyInA.length > 0) diffs.push(`  Solo en ${labelA}: ${onlyInA.join(', ')}`)
            if (onlyInB.length > 0) diffs.push(`  Solo en ${labelB}: ${onlyInB.join(', ')}`)

            for (const key of common) {
              const valA = JSON.stringify(
                (responseA.body as Record<string, unknown>)[key],
              )
              const valB = JSON.stringify(
                (responseB.body as Record<string, unknown>)[key],
              )
              if (valA !== valB) {
                const shortA = valA.length > 50 ? valA.substring(0, 50) + '...' : valA
                const shortB = valB.length > 50 ? valB.substring(0, 50) + '...' : valB
                diffs.push(`  ${key}: ${labelA}=${shortA} vs ${labelB}=${shortB}`)
              }
            }
          }
        }

        const sizeDiff = Math.abs(responseA.size_bytes - responseB.size_bytes)
        if (sizeDiff > 0) {
          diffs.push(
            `Size: ${labelA}=${responseA.size_bytes}B vs ${labelB}=${responseB.size_bytes}B`,
          )
        }

        const identical = diffs.length === 0

        const lines: string[] = [
          identical ? '✅ IDÉNTICAS' : `⚠️ ${diffs.length} DIFERENCIAS ENCONTRADAS`,
          '',
          `${labelA}: ${params.request_a.method} ${params.request_a.url} → ${responseA.status} (${responseA.timing.total_ms}ms)`,
          `${labelB}: ${params.request_b.method} ${params.request_b.url} → ${responseB.status} (${responseB.timing.total_ms}ms)`,
        ]

        if (!identical) {
          lines.push('')
          lines.push('Diferencias:')
          for (const diff of diffs) {
            lines.push(`  ${diff}`)
          }
        }

        return {
          content: [{ type: 'text' as const, text: lines.join('\n') }],
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

  // ── bulk_test ──

  server.tool(
    'bulk_test',
    'Ejecuta todos los requests guardados en la colección y reporta resultados. Filtrable por tag.',
    {
      tag: z.string().optional().describe('Filtrar por tag'),
      expected_status: z
        .number()
        .optional()
        .describe('Status HTTP esperado para todos (default: cualquier 2xx)'),
    },
    async (params) => {
      try {
        const collections = await storage.listCollections(params.tag)
        if (collections.length === 0) {
          return {
            content: [
              {
                type: 'text' as const,
                text: params.tag
                  ? `No hay requests guardados con tag '${params.tag}'.`
                  : 'No hay requests guardados en la colección.',
              },
            ],
          }
        }

        const variables = await storage.getActiveVariables()
        const results: Array<{
          name: string
          method: string
          url: string
          status: number
          timing: number
          pass: boolean
          error?: string
        }> = []

        for (const item of collections) {
          const saved = await storage.getCollection(item.name)
          if (!saved) continue

          try {
            let config = saved.request
            const resolvedUrl = resolveUrl(config.url, variables)
            config = { ...config, url: resolvedUrl }
            const interpolated = interpolateRequest(config, variables)
            const response = await executeRequest(interpolated)

            const pass = params.expected_status
              ? response.status === params.expected_status
              : response.status >= 200 && response.status < 300

            results.push({
              name: item.name,
              method: config.method,
              url: item.url,
              status: response.status,
              timing: response.timing.total_ms,
              pass,
            })
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            results.push({
              name: item.name,
              method: item.method,
              url: item.url,
              status: 0,
              timing: 0,
              pass: false,
              error: message,
            })
          }
        }

        const passed = results.filter((r) => r.pass).length
        const failed = results.filter((r) => !r.pass).length
        const totalTime = Math.round(results.reduce((sum, r) => sum + r.timing, 0) * 100) / 100

        const lines: string[] = [
          `${failed === 0 ? '✅' : '❌'} BULK TEST — ${passed}/${results.length} passed | ${totalTime}ms total`,
          '',
        ]

        for (const r of results) {
          const icon = r.pass ? '✅' : '❌'
          if (r.error) {
            lines.push(`${icon} ${r.name} — ERROR: ${r.error}`)
          } else {
            lines.push(`${icon} ${r.name} — ${r.method} ${r.url} → ${r.status} (${r.timing}ms)`)
          }
        }

        return {
          content: [{ type: 'text' as const, text: lines.join('\n') }],
          isError: failed > 0,
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
