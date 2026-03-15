import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { Storage } from '../lib/storage.js'
import { executeRequest } from '../lib/http-client.js'
import { interpolateRequest } from '../lib/interpolation.js'
import { resolveUrl } from '../lib/url.js'
import { AuthSchema } from '../lib/schemas.js'
import type { RequestConfig } from '../lib/types.js'

export function registerLoadTestTool(server: McpServer, storage: Storage): void {
  server.tool(
    'load_test',
    'Lanza N requests concurrentes al mismo endpoint y mide tiempos promedio, percentiles y tasa de errores.',
    {
      method: z
        .enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'])
        .describe('HTTP method'),
      url: z.string().describe('URL del endpoint'),
      headers: z.record(z.string()).optional().describe('Headers HTTP'),
      body: z.any().optional().describe('Body del request'),
      query: z.record(z.string()).optional().describe('Query parameters'),
      auth: AuthSchema.optional().describe('Autenticación'),
      concurrent: z
        .number()
        .describe('Número de requests concurrentes a lanzar (max: 100)'),
      timeout: z
        .number()
        .optional()
        .describe('Timeout por request en ms (default: 30000)'),
    },
    async (params) => {
      try {
        const concurrentCount = Math.min(Math.max(params.concurrent, 1), 100)
        const variables = await storage.getActiveVariables()
        const resolvedUrl = resolveUrl(params.url, variables)

        const baseConfig: RequestConfig = {
          method: params.method,
          url: resolvedUrl,
          headers: params.headers,
          body: params.body,
          query: params.query,
          auth: params.auth,
          timeout: params.timeout,
        }

        const interpolated = interpolateRequest(baseConfig, variables)

        const startTotal = performance.now()

        const promises = Array.from({ length: concurrentCount }, () =>
          executeRequest(interpolated)
            .then((response) => ({
              status: response.status,
              timing: response.timing.total_ms,
              error: undefined as string | undefined,
            }))
            .catch((error) => ({
              status: 0,
              timing: 0,
              error: error instanceof Error ? error.message : String(error),
            })),
        )

        const results = await Promise.all(promises)
        const endTotal = performance.now()
        const wallTime = Math.round((endTotal - startTotal) * 100) / 100

        const successful = results.filter((r) => !r.error)
        const failed = results.filter((r) => r.error)
        const timings = successful.map((r) => r.timing).sort((a, b) => a - b)

        const statusCounts: Record<number, number> = {}
        for (const r of successful) {
          statusCounts[r.status] = (statusCounts[r.status] ?? 0) + 1
        }

        const avg = timings.length > 0
          ? Math.round((timings.reduce((s, t) => s + t, 0) / timings.length) * 100) / 100
          : 0
        const min = timings.length > 0 ? timings[0] : 0
        const max = timings.length > 0 ? timings[timings.length - 1] : 0
        const p50 = timings.length > 0 ? timings[Math.floor(timings.length * 0.5)] : 0
        const p95 = timings.length > 0 ? timings[Math.floor(timings.length * 0.95)] : 0
        const p99 = timings.length > 0 ? timings[Math.floor(timings.length * 0.99)] : 0

        const rps = wallTime > 0
          ? Math.round((successful.length / (wallTime / 1000)) * 100) / 100
          : 0

        const lines: string[] = [
          `📊 LOAD TEST — ${params.method} ${params.url}`,
          '',
          `Requests: ${concurrentCount} concurrentes`,
          `Exitosos: ${successful.length} | Fallidos: ${failed.length}`,
          `Tiempo total: ${wallTime}ms`,
          `Requests/segundo: ${rps}`,
          '',
          '⏱️ Tiempos de respuesta:',
          `  Min:  ${min}ms`,
          `  Avg:  ${avg}ms`,
          `  p50:  ${p50}ms`,
          `  p95:  ${p95}ms`,
          `  p99:  ${p99}ms`,
          `  Max:  ${max}ms`,
        ]

        if (Object.keys(statusCounts).length > 0) {
          lines.push('')
          lines.push('📋 Status codes:')
          for (const [status, count] of Object.entries(statusCounts)) {
            const pct = Math.round((count / concurrentCount) * 100)
            lines.push(`  ${status}: ${count} (${pct}%)`)
          }
        }

        if (failed.length > 0) {
          lines.push('')
          lines.push('❌ Errores:')
          const errorCounts: Record<string, number> = {}
          for (const r of failed) {
            const errMsg = r.error ?? 'Unknown'
            errorCounts[errMsg] = (errorCounts[errMsg] ?? 0) + 1
          }
          for (const [err, count] of Object.entries(errorCounts)) {
            lines.push(`  ${err}: ${count}x`)
          }
        }

        return {
          content: [{ type: 'text' as const, text: lines.join('\n') }],
          isError: failed.length > successful.length,
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
