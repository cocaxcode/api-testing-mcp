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
      spec: z
        .string()
        .optional()
        .describe('Nombre del spec API asociado (ej: "cocaxcode-api")'),
    },
    async (params) => {
      try {
        const now = new Date().toISOString()
        const env: Environment = {
          name: params.name,
          variables: params.variables ?? {},
          spec: params.spec,
          createdAt: now,
          updatedAt: now,
        }

        await storage.createEnvironment(env)

        const varCount = Object.keys(env.variables).length
        const specMsg = params.spec ? ` — spec: '${params.spec}'` : ''
        return {
          content: [
            {
              type: 'text' as const,
              text: `Entorno '${params.name}' creado con ${varCount} variable(s)${specMsg}`,
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

  // ── env_spec ──
  server.tool(
    'env_spec',
    'Asocia o desasocia un spec API a un entorno. Si no se especifica entorno, usa el activo.',
    {
      spec: z
        .string()
        .optional()
        .describe('Nombre del spec a asociar. Si se omite, desasocia el spec actual'),
      environment: z
        .string()
        .optional()
        .describe('Entorno destino (default: entorno activo)'),
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

        await storage.setEnvironmentSpec(envName, params.spec ?? null)

        const message = params.spec
          ? `Spec '${params.spec}' asociado al entorno '${envName}'`
          : `Spec desasociado del entorno '${envName}'`

        return {
          content: [{ type: 'text' as const, text: message }],
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

  // ── env_rename ──
  server.tool(
    'env_rename',
    'Renombra un entorno existente. Si es el entorno activo, actualiza la referencia.',
    {
      name: z.string().describe('Nombre actual del entorno'),
      new_name: z.string().describe('Nuevo nombre para el entorno'),
    },
    async (params) => {
      try {
        await storage.renameEnvironment(params.name, params.new_name)

        return {
          content: [
            {
              type: 'text' as const,
              text: `Entorno '${params.name}' renombrado a '${params.new_name}'`,
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

  // ── env_delete ──
  server.tool(
    'env_delete',
    'Elimina un entorno y todas sus variables. Si es el entorno activo, lo desactiva.',
    {
      name: z.string().describe('Nombre del entorno a eliminar'),
    },
    async (params) => {
      try {
        await storage.deleteEnvironment(params.name)

        return {
          content: [
            {
              type: 'text' as const,
              text: `Entorno '${params.name}' eliminado`,
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
    'Cambia el entorno activo. Si se especifica project, solo aplica a ese directorio de proyecto.',
    {
      name: z.string().describe('Nombre del entorno a activar'),
      project: z
        .string()
        .optional()
        .describe('Ruta del proyecto (ej: C:/cocaxcode). Si se omite, cambia el entorno global'),
    },
    async (params) => {
      try {
        await storage.setActiveEnvironment(params.name, params.project)

        const scope = params.project
          ? ` para proyecto '${params.project}'`
          : ' (global)'
        return {
          content: [
            {
              type: 'text' as const,
              text: `Entorno activo cambiado a '${params.name}'${scope}`,
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

  // ── env_project_clear ──
  server.tool(
    'env_project_clear',
    'Elimina la asociación de entorno específico de un proyecto. El proyecto usará el entorno global.',
    {
      project: z
        .string()
        .describe('Ruta del proyecto del que eliminar la asociación'),
    },
    async (params) => {
      try {
        const removed = await storage.clearProjectEnvironment(params.project)

        if (!removed) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `No hay entorno específico para el proyecto '${params.project}'`,
              },
            ],
          }
        }

        return {
          content: [
            {
              type: 'text' as const,
              text: `Entorno específico eliminado para proyecto '${params.project}'. Usará el entorno global.`,
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

  // ── env_project_list ──
  server.tool(
    'env_project_list',
    'Lista todos los proyectos con entornos específicos asignados.',
    {},
    async () => {
      try {
        const projectEnvs = await storage.listProjectEnvironments()
        const entries = Object.entries(projectEnvs)

        if (entries.length === 0) {
          return {
            content: [
              {
                type: 'text' as const,
                text: 'No hay entornos específicos por proyecto. Todos usan el entorno global.',
              },
            ],
          }
        }

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                entries.map(([project, env]) => ({ project, environment: env })),
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
}
