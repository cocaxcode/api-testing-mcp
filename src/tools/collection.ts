import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { Storage } from '../lib/storage.js'
import { AuthSchemaShape } from '../lib/schemas.js'
import type { SavedRequest } from '../lib/types.js'

export function registerCollectionTools(server: McpServer, storage: Storage): void {
  // ── collection_save ──
  server.tool(
    'collection_save',
    'Guarda un request en la colección local. Si ya existe un request con el mismo nombre, lo sobreescribe.',
    {
      name: z.string().describe('Nombre único del request guardado'),
      request: z
        .object({
          method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']),
          url: z.string(),
          headers: z.record(z.string()).optional(),
          body: z.any().optional(),
          query: z.record(z.string()).optional(),
          auth: z.object(AuthSchemaShape).optional(),
        })
        .describe('Configuración del request a guardar'),
      tags: z
        .array(z.string())
        .optional()
        .describe('Tags para organizar (ej: ["auth", "users"])'),
    },
    async (params) => {
      try {
        const now = new Date().toISOString()
        const existing = await storage.getCollection(params.name)

        const saved: SavedRequest = {
          name: params.name,
          request: params.request,
          tags: params.tags,
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
        }

        await storage.saveCollection(saved)

        return {
          content: [
            {
              type: 'text' as const,
              text: `Request '${params.name}' guardado (${params.request.method} ${params.request.url})`,
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

  // ── collection_list ──
  server.tool(
    'collection_list',
    'Lista todos los requests guardados en la colección. Opcionalmente filtra por tag.',
    {
      tag: z.string().optional().describe('Filtrar por tag'),
    },
    async (params) => {
      try {
        const items = await storage.listCollections(params.tag)

        if (items.length === 0) {
          const msg = params.tag
            ? `No hay requests con tag '${params.tag}'`
            : 'La colección está vacía'
          return { content: [{ type: 'text' as const, text: msg }] }
        }

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(items, null, 2),
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

  // ── collection_get ──
  server.tool(
    'collection_get',
    'Obtiene los detalles completos de un request guardado por su nombre.',
    {
      name: z.string().describe('Nombre del request guardado'),
    },
    async (params) => {
      try {
        const saved = await storage.getCollection(params.name)

        if (!saved) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `Request '${params.name}' no encontrado`,
              },
            ],
            isError: true,
          }
        }

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(saved, null, 2),
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

  // ── collection_delete ──
  server.tool(
    'collection_delete',
    'Elimina un request guardado de la colección.',
    {
      name: z.string().describe('Nombre del request a eliminar'),
    },
    async (params) => {
      try {
        const deleted = await storage.deleteCollection(params.name)

        if (!deleted) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `Request '${params.name}' no encontrado`,
              },
            ],
            isError: true,
          }
        }

        return {
          content: [
            {
              type: 'text' as const,
              text: `Request '${params.name}' eliminado`,
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
