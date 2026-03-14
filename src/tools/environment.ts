import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { Storage } from '../lib/storage.js'
import type { Environment } from '../lib/types.js'

export function registerEnvironmentTools(server: McpServer, storage: Storage): void {
  // ── env_create ──
  server.tool(
    'env_create',
    'Crea un nuevo entorno (ej: dev, staging, prod) con variables opcionales.',
    {
      name: z.string().describe('Nombre del entorno (ej: dev, staging, prod)'),
      variables: z
        .record(z.string())
        .optional()
        .describe('Variables iniciales como key-value'),
    },
    async (params) => {
      try {
        const now = new Date().toISOString()
        const env: Environment = {
          name: params.name,
          variables: params.variables ?? {},
          createdAt: now,
          updatedAt: now,
        }

        await storage.createEnvironment(env)

        const varCount = Object.keys(env.variables).length
        return {
          content: [
            {
              type: 'text' as const,
              text: `Entorno '${params.name}' creado con ${varCount} variable(s)`,
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

  // ── env_list ──
  server.tool(
    'env_list',
    'Lista todos los entornos disponibles e indica cuál está activo.',
    {},
    async () => {
      try {
        const items = await storage.listEnvironments()

        if (items.length === 0) {
          return {
            content: [{ type: 'text' as const, text: 'No hay entornos configurados' }],
          }
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

  // ── env_set ──
  server.tool(
    'env_set',
    'Establece una variable en un entorno. Si no se especifica entorno, usa el activo.',
    {
      key: z.string().describe('Nombre de la variable'),
      value: z.string().describe('Valor de la variable'),
      environment: z
        .string()
        .optional()
        .describe('Entorno destino (default: entorno activo)'),
    },
    async (params) => {
      try {
        // Determinar entorno destino
        const envName = params.environment ?? (await storage.getActiveEnvironment())

        if (!envName) {
          return {
            content: [
              {
                type: 'text' as const,
                text: 'No hay entorno activo. Usa env_create para crear uno y env_switch para activarlo.',
              },
            ],
            isError: true,
          }
        }

        await storage.updateEnvironment(envName, { [params.key]: params.value })

        return {
          content: [
            {
              type: 'text' as const,
              text: `Variable '${params.key}' establecida en entorno '${envName}'`,
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

  // ── env_get ──
  server.tool(
    'env_get',
    'Obtiene una variable específica o todas las variables de un entorno.',
    {
      key: z
        .string()
        .optional()
        .describe('Variable específica. Si se omite, retorna todas'),
      environment: z
        .string()
        .optional()
        .describe('Entorno a consultar (default: entorno activo)'),
    },
    async (params) => {
      try {
        const envName = params.environment ?? (await storage.getActiveEnvironment())

        if (!envName) {
          return {
            content: [
              {
                type: 'text' as const,
                text: 'No hay entorno activo. Usa env_switch para activar uno.',
              },
            ],
            isError: true,
          }
        }

        const env = await storage.getEnvironment(envName)
        if (!env) {
          return {
            content: [
              { type: 'text' as const, text: `Entorno '${envName}' no encontrado` },
            ],
            isError: true,
          }
        }

        if (params.key) {
          const value = env.variables[params.key]
          if (value === undefined) {
            return {
              content: [
                {
                  type: 'text' as const,
                  text: `Variable '${params.key}' no encontrada en entorno '${envName}'`,
                },
              ],
              isError: true,
            }
          }
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify({ key: params.key, value, environment: envName }, null, 2),
              },
            ],
          }
        }

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                { environment: envName, variables: env.variables },
                null,
                2,
              ),
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

  // ── env_switch ──
  server.tool(
    'env_switch',
    'Cambia el entorno activo. Las variables del entorno activo se usan en {{interpolación}}.',
    {
      name: z.string().describe('Nombre del entorno a activar'),
    },
    async (params) => {
      try {
        await storage.setActiveEnvironment(params.name)

        return {
          content: [
            {
              type: 'text' as const,
              text: `Entorno activo cambiado a '${params.name}'`,
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
