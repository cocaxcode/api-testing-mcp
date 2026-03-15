import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { Storage } from '../lib/storage.js'
import { executeRequest } from '../lib/http-client.js'
import { interpolateRequest } from '../lib/interpolation.js'
import { resolveUrl } from '../lib/url.js'
import { getByPath } from '../lib/path.js'
import { AuthSchema } from '../lib/schemas.js'
import type { RequestConfig, RequestResponse } from '../lib/types.js'

const AssertionSchema = z.object({
  path: z
    .string()
    .describe(
      'JSONPath al valor a validar: "status", "body.data.id", "headers.content-type", "timing.total_ms"',
    ),
  operator: z
    .enum(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'contains', 'not_contains', 'exists', 'type'])
    .describe(
      'Operador: eq (igual), neq (no igual), gt/gte/lt/lte (numéricos), contains/not_contains (strings/arrays), exists (campo existe), type (typeof)',
    ),
  expected: z.any().optional().describe('Valor esperado (no necesario para "exists")'),
})

/**
 * Evalúa una aserción contra una respuesta.
 */
function evaluateAssertion(
  response: RequestResponse,
  assertion: { path: string; operator: string; expected?: unknown },
): { pass: boolean; message: string } {
  const actual = getByPath(response, assertion.path)

  switch (assertion.operator) {
    case 'eq':
      return {
        pass: actual === assertion.expected,
        message: actual === assertion.expected
          ? `${assertion.path} === ${JSON.stringify(assertion.expected)}`
          : `${assertion.path}: esperado ${JSON.stringify(assertion.expected)}, recibido ${JSON.stringify(actual)}`,
      }

    case 'neq':
      return {
        pass: actual !== assertion.expected,
        message: actual !== assertion.expected
          ? `${assertion.path} !== ${JSON.stringify(assertion.expected)}`
          : `${assertion.path}: no debería ser ${JSON.stringify(assertion.expected)}`,
      }

    case 'gt':
      return {
        pass: typeof actual === 'number' && actual > (assertion.expected as number),
        message: `${assertion.path}: ${actual} > ${assertion.expected} → ${typeof actual === 'number' && actual > (assertion.expected as number)}`,
      }

    case 'gte':
      return {
        pass: typeof actual === 'number' && actual >= (assertion.expected as number),
        message: `${assertion.path}: ${actual} >= ${assertion.expected} → ${typeof actual === 'number' && actual >= (assertion.expected as number)}`,
      }

    case 'lt':
      return {
        pass: typeof actual === 'number' && actual < (assertion.expected as number),
        message: `${assertion.path}: ${actual} < ${assertion.expected} → ${typeof actual === 'number' && actual < (assertion.expected as number)}`,
      }

    case 'lte':
      return {
        pass: typeof actual === 'number' && actual <= (assertion.expected as number),
        message: `${assertion.path}: ${actual} <= ${assertion.expected} → ${typeof actual === 'number' && actual <= (assertion.expected as number)}`,
      }

    case 'contains': {
      let pass = false
      if (typeof actual === 'string') {
        pass = actual.includes(String(assertion.expected))
      } else if (Array.isArray(actual)) {
        pass = actual.includes(assertion.expected)
      }
      return {
        pass,
        message: pass
          ? `${assertion.path} contiene ${JSON.stringify(assertion.expected)}`
          : `${assertion.path}: no contiene ${JSON.stringify(assertion.expected)}`,
      }
    }

    case 'not_contains': {
      let pass = true
      if (typeof actual === 'string') {
        pass = !actual.includes(String(assertion.expected))
      } else if (Array.isArray(actual)) {
        pass = !actual.includes(assertion.expected)
      }
      return {
        pass,
        message: pass
          ? `${assertion.path} no contiene ${JSON.stringify(assertion.expected)}`
          : `${assertion.path}: contiene ${JSON.stringify(assertion.expected)} (no debería)`,
      }
    }

    case 'exists':
      return {
        pass: actual !== undefined && actual !== null,
        message: actual !== undefined && actual !== null
          ? `${assertion.path} existe`
          : `${assertion.path}: no existe`,
      }

    case 'type':
      return {
        pass: typeof actual === assertion.expected,
        message: typeof actual === assertion.expected
          ? `${assertion.path} es tipo ${assertion.expected}`
          : `${assertion.path}: esperado tipo ${assertion.expected}, recibido ${typeof actual}`,
      }

    default:
      return { pass: false, message: `Operador desconocido: ${assertion.operator}` }
  }
}

export function registerAssertTool(server: McpServer, storage: Storage): void {
  server.tool(
    'assert',
    'Ejecuta un request y valida la respuesta con assertions. Retorna resultado pass/fail por cada assertion.',
    {
      method: z
        .enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'])
        .describe('HTTP method'),
      url: z.string().describe('URL del endpoint (soporta /relativa y {{variables}})'),
      headers: z.record(z.string()).optional().describe('Headers HTTP'),
      body: z.any().optional().describe('Body del request (JSON)'),
      query: z.record(z.string()).optional().describe('Query parameters'),
      auth: AuthSchema.optional().describe('Autenticación'),
      assertions: z
        .array(AssertionSchema)
        .describe('Lista de assertions a validar contra la respuesta'),
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
          auth: params.auth,
        }

        const interpolated = interpolateRequest(config, variables)
        const response = await executeRequest(interpolated)

        // Evaluate assertions
        const results = params.assertions.map((assertion) => {
          const result = evaluateAssertion(response, assertion)
          return { ...result, assertion }
        })

        const passed = results.filter((r) => r.pass).length
        const failed = results.filter((r) => !r.pass).length
        const allPassed = failed === 0

        const lines: string[] = [
          `${allPassed ? '✅ PASS' : '❌ FAIL'} — ${passed}/${results.length} assertions passed`,
          `${params.method} ${params.url} → ${response.status} ${response.statusText} (${response.timing.total_ms}ms)`,
          '',
        ]

        for (const r of results) {
          const icon = r.pass ? '✅' : '❌'
          lines.push(`${icon} ${r.message}`)
        }

        return {
          content: [{ type: 'text' as const, text: lines.join('\n') }],
          isError: !allPassed,
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
