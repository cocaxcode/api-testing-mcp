import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { maskVariables, type Storage } from '../lib/storage.js'
import type { Environment } from '../lib/types.js'

export function registerEnvironmentTools(server: McpServer, storage: Storage): void {
  // ── env_create ──
  server.tool(
    'env_create',
    'Crea un nuevo entorno. PREGUNTA al usuario: nombre, grupo (o global) y variables. Si el grupo no existe, se crea automaticamente.',
    {
      name: z.string().describe('Nombre del entorno (ej: dev, staging, prod)'),
      group: z
        .string()
        .optional()
        .describe('Nombre del grupo (ej: "cocaxcode"). Si se omite, auto-detecta por CWD. Para global: pasar cadena vacía ""'),
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
        // Resolver grupo: explícito > auto-detectar por CWD > global
        let groupName: string | undefined
        if (params.group === '') {
          // Explícitamente global
          groupName = undefined
        } else if (params.group) {
          // Grupo explícito — crearlo si no existe
          groupName = params.group
          const existing = await storage.getGroup(groupName)
          if (!existing) {
            await storage.createGroup(groupName)
          }
        } else {
          // Auto-detectar por CWD
          const cwdGroup = await storage.getGroupForPath(process.cwd())
          groupName = cwdGroup?.name
        }

        const now = new Date().toISOString()
        const env: Environment = {
          name: params.name,
          variables: params.variables ?? {},
          spec: params.spec,
          group: groupName,
          createdAt: now,
          updatedAt: now,
        }

        await storage.createEnvironment(env)

        // Si es el primer entorno del grupo y no hay default, marcarlo
        if (groupName) {
          const group = await storage.getGroup(groupName)
          if (group && !group.default) {
            await storage.setGroupDefault(groupName, params.name)
          }
        }

        const varCount = Object.keys(env.variables).length
        const specMsg = params.spec ? ` — spec: '${params.spec}'` : ''
        const groupMsg = groupName ? ` — grupo: '${groupName}'` : ' — global'
        return {
          content: [
            {
              type: 'text' as const,
              text: `Entorno '${params.name}' creado con ${varCount} variable(s)${specMsg}${groupMsg}`,
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
    'Obtiene una variable específica o todas las variables de un entorno. Los valores sensibles (token, password, secret, api_key...) se enmascaran por defecto. Pide una variable por nombre para ver su valor completo.',
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

        // Variable específica: mostrar valor completo (sin enmascarar)
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

        // Todas las variables: enmascarar sensibles
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                { environment: envName, variables: maskVariables(env.variables) },
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
    'Cambia el entorno activo. Sin project cambia el global. Con project, solo aplica a ese directorio.',
    {
      name: z.string().describe('Nombre del entorno a activar'),
      project: z
        .string()
        .optional()
        .describe('Ruta del proyecto (ej: C:/cocaxcode). Si se omite, cambia el entorno global'),
    },
    async (params) => {
      try {
        const env = await storage.getEnvironment(params.name)
        if (!env) {
          return {
            content: [{ type: 'text' as const, text: `Error: Entorno '${params.name}' no encontrado` }],
            isError: true,
          }
        }

        // Validar que no sea de otro grupo (distinto al del CWD)
        const projectPath = params.project ?? process.cwd()
        const cwdGroup = await storage.getGroupForPath(projectPath)
        if (cwdGroup && env.group && env.group !== cwdGroup.name) {
          return {
            content: [{ type: 'text' as const, text: `Error: El entorno '${params.name}' pertenece al grupo '${env.group}', pero el directorio actual pertenece al grupo '${cwdGroup.name}'. Usa un entorno del mismo grupo o uno global.` }],
            isError: true,
          }
        }

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
    'Elimina la asociación de entorno específico de un proyecto. El proyecto no tendrá entorno activo hasta que se asigne uno.',
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
                text: 'No hay entornos específicos por proyecto.',
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

  // ── env_group_create ──
  server.tool(
    'env_group_create',
    'Crea un nuevo grupo de entornos. Luego añade scopes (directorios) con env_group_add_scope.',
    {
      name: z.string().describe('Nombre del grupo (ej: cocaxcode, optimizatusol)'),
    },
    async (params) => {
      try {
        await storage.createGroup(params.name)
        return {
          content: [{ type: 'text' as const, text: `Grupo '${params.name}' creado. Usa env_group_add_scope para añadir directorios.` }],
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return { content: [{ type: 'text' as const, text: `Error: ${message}` }], isError: true }
      }
    },
  )

  // ── env_group_list ──
  server.tool(
    'env_group_list',
    'Lista todos los grupos con sus scopes, default y entornos.',
    {},
    async () => {
      try {
        const groups = await storage.listGroups()
        if (groups.length === 0) {
          return {
            content: [{ type: 'text' as const, text: 'No hay grupos configurados. Usa env_group_create para crear uno.' }],
          }
        }
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(groups, null, 2) }],
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return { content: [{ type: 'text' as const, text: `Error: ${message}` }], isError: true }
      }
    },
  )

  // ── env_group_delete ──
  server.tool(
    'env_group_delete',
    'Elimina un grupo. Los entornos del grupo quedan como globales.',
    {
      name: z.string().describe('Nombre del grupo a eliminar'),
    },
    async (params) => {
      try {
        await storage.deleteGroup(params.name)
        return {
          content: [{ type: 'text' as const, text: `Grupo '${params.name}' eliminado. Sus entornos ahora son globales.` }],
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return { content: [{ type: 'text' as const, text: `Error: ${message}` }], isError: true }
      }
    },
  )

  // ── env_group_add_scope ──
  server.tool(
    'env_group_add_scope',
    'Añade un directorio (scope) a un grupo. Los entornos del grupo seran accesibles desde ese directorio.',
    {
      group: z.string().describe('Nombre del grupo'),
      scope: z.string().optional().describe('Ruta del directorio. Si se omite, usa el directorio actual'),
    },
    async (params) => {
      try {
        const scope = params.scope ?? process.cwd()
        await storage.addScopeToGroup(params.group, scope)
        return {
          content: [{ type: 'text' as const, text: `Scope '${scope}' añadido al grupo '${params.group}'` }],
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return { content: [{ type: 'text' as const, text: `Error: ${message}` }], isError: true }
      }
    },
  )

  // ── env_group_remove_scope ──
  server.tool(
    'env_group_remove_scope',
    'Quita un directorio (scope) de un grupo.',
    {
      group: z.string().describe('Nombre del grupo'),
      scope: z.string().optional().describe('Ruta del directorio a quitar. Si se omite, usa el directorio actual'),
    },
    async (params) => {
      try {
        const scope = params.scope ?? process.cwd()
        await storage.removeScopeFromGroup(params.group, scope)
        return {
          content: [{ type: 'text' as const, text: `Scope '${scope}' eliminado del grupo '${params.group}'` }],
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return { content: [{ type: 'text' as const, text: `Error: ${message}` }], isError: true }
      }
    },
  )

  // ── env_set_default ──
  server.tool(
    'env_set_default',
    'Marca un entorno como el default de su grupo. El default se activa automaticamente al entrar al proyecto.',
    {
      name: z.string().describe('Nombre del entorno a marcar como default'),
    },
    async (params) => {
      try {
        const env = await storage.getEnvironment(params.name)
        if (!env) {
          return { content: [{ type: 'text' as const, text: `Error: Entorno '${params.name}' no encontrado` }], isError: true }
        }
        if (!env.group) {
          return { content: [{ type: 'text' as const, text: `Error: El entorno '${params.name}' es global y no pertenece a ningun grupo. Solo los entornos de un grupo pueden ser default.` }], isError: true }
        }
        await storage.setGroupDefault(env.group, params.name)
        // Limpiar todas las sesiones activas del grupo para que el nuevo default tome efecto inmediato
        await storage.clearGroupSessionActives(env.group)
        return {
          content: [{ type: 'text' as const, text: `Entorno '${params.name}' marcado como default del grupo '${env.group}'` }],
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return { content: [{ type: 'text' as const, text: `Error: ${message}` }], isError: true }
      }
    },
  )

  // ── env_set_group ──
  server.tool(
    'env_set_group',
    'Asigna o cambia el grupo de un entorno existente. Para sacarlo a global, pasar group vacío "".',
    {
      environment: z.string().describe('Nombre del entorno'),
      group: z.string().describe('Nombre del grupo. Cadena vacía "" para hacerlo global'),
    },
    async (params) => {
      try {
        const groupName = params.group || null

        // Si el grupo no existe, crearlo
        if (groupName) {
          const existing = await storage.getGroup(groupName)
          if (!existing) {
            await storage.createGroup(groupName)
          }
        }

        await storage.setEnvironmentGroup(params.environment, groupName)

        const msg = groupName
          ? `Entorno '${params.environment}' asignado al grupo '${groupName}'`
          : `Entorno '${params.environment}' ahora es global (sin grupo)`
        return { content: [{ type: 'text' as const, text: msg }] }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return { content: [{ type: 'text' as const, text: `Error: ${message}` }], isError: true }
      }
    },
  )
}
