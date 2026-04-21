import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ResponseCache } from '../lib/response-cache.js'

export function registerInspectTool(server: McpServer, cache: ResponseCache): void {
  server.tool(
    'inspect_last_response',
    'Recupera la respuesta HTTP completa de una llamada previa de `request` cuando la versión comprimida no basta. Usa el call_id que aparece en el campo call_id de la respuesta comprimida. Sin call_id devuelve la más reciente.',
    {
      call_id: z
        .string()
        .optional()
        .describe(
          "ID devuelto en el campo 'call_id' de una response comprimida. Si se omite, devuelve la última response guardada (warning si hay varias en los últimos 5s).",
        ),
    },
    async (params) => {
      try {
        const entry = await cache.get(params.call_id)
        if (!entry) {
          return {
            content: [
              {
                type: 'text' as const,
                text: params.call_id
                  ? `No se encontró response con call_id="${params.call_id}". Puede haber expirado (TTL 1h) o no existir.`
                  : 'No hay responses guardadas aún. Ejecuta un `request` primero.',
              },
            ],
            isError: true,
          }
        }

        const warnings: string[] = []
        if (!params.call_id) {
          const recent = cache.recentCount(5000)
          if (recent > 1) {
            warnings.push(
              `⚠️ ${recent} responses en los últimos 5s — ambigüedad posible. Pasa call_id explícito si no es la que esperas.`,
            )
          }
        }

        const payload = {
          call_id: entry.call_id,
          saved_at: new Date(entry.saved_at).toISOString(),
          method: entry.method,
          url: entry.url,
          response: entry.response,
        }

        const text =
          (warnings.length > 0 ? warnings.join('\n') + '\n\n' : '') +
          JSON.stringify(payload, null, 2)

        return { content: [{ type: 'text' as const, text }] }
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
