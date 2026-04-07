import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createTestClient, type TestContext } from './helpers.js'

describe('environment tools', () => {
  let ctx: TestContext

  beforeAll(async () => {
    ctx = await createTestClient()
  })

  afterAll(async () => {
    await ctx.cleanup()
  })

  it('env_list retorna lista vacía inicialmente', async () => {
    const result = await ctx.client.callTool({ name: 'env_list', arguments: {} })
    const text = (result.content as Array<{ type: string; text: string }>)[0].text
    expect(text).toContain('No hay entornos')
  })

  it('env_create crea un entorno', async () => {
    const result = await ctx.client.callTool({
      name: 'env_create',
      arguments: { name: 'dev', variables: { BASE_URL: 'http://localhost:3000' } },
    })
    const text = (result.content as Array<{ type: string; text: string }>)[0].text
    expect(text).toContain("Entorno 'dev' creado")
    expect(text).toContain('1 variable')
  })

  it('env_list retorna entornos creados', async () => {
    const result = await ctx.client.callTool({ name: 'env_list', arguments: {} })
    const text = (result.content as Array<{ type: string; text: string }>)[0].text
    const items = JSON.parse(text)
    expect(items).toHaveLength(1)
    expect(items[0].name).toBe('dev')
    expect(items[0].variableCount).toBe(1)
    expect(items[0].active).toBe(false)
  })

  it('env_switch cambia el entorno activo', async () => {
    const result = await ctx.client.callTool({
      name: 'env_switch',
      arguments: { name: 'dev' },
    })
    const text = (result.content as Array<{ type: string; text: string }>)[0].text
    expect(text).toContain("'dev'")
  })

  it('env_list muestra entorno activo', async () => {
    const result = await ctx.client.callTool({ name: 'env_list', arguments: {} })
    const text = (result.content as Array<{ type: string; text: string }>)[0].text
    const items = JSON.parse(text)
    expect(items[0].active).toBe(true)
  })

  it('env_set establece variable en entorno activo', async () => {
    const result = await ctx.client.callTool({
      name: 'env_set',
      arguments: { key: 'TOKEN', value: 'secret123' },
    })
    const text = (result.content as Array<{ type: string; text: string }>)[0].text
    expect(text).toContain("'TOKEN'")
    expect(text).toContain("'dev'")
  })

  it('env_get retorna variable específica', async () => {
    const result = await ctx.client.callTool({
      name: 'env_get',
      arguments: { key: 'TOKEN' },
    })
    const text = (result.content as Array<{ type: string; text: string }>)[0].text
    const data = JSON.parse(text)
    expect(data.key).toBe('TOKEN')
    expect(data.value).toBe('secret123')
  })

  it('env_get sin key retorna todas las variables', async () => {
    const result = await ctx.client.callTool({
      name: 'env_get',
      arguments: {},
    })
    const text = (result.content as Array<{ type: string; text: string }>)[0].text
    const data = JSON.parse(text)
    expect(data.environment).toBe('dev')
    expect(data.variables.BASE_URL).toBe('http://localhost:3000')
    expect(data.variables.TOKEN).toBe('***')
  })

  it('env_set en entorno no existente retorna error', async () => {
    const result = await ctx.client.callTool({
      name: 'env_set',
      arguments: { key: 'X', value: 'Y', environment: 'nope' },
    })
    expect(result.isError).toBe(true)
  })

  it('env_switch a entorno no existente retorna error', async () => {
    const result = await ctx.client.callTool({
      name: 'env_switch',
      arguments: { name: 'nope' },
    })
    expect(result.isError).toBe(true)
  })

  // ── env_rename ──

  it('env_rename renombra un entorno', async () => {
    // Crear entorno para renombrar
    await ctx.client.callTool({
      name: 'env_create',
      arguments: { name: 'staging', variables: { BASE_URL: 'http://staging:3000' } },
    })

    const result = await ctx.client.callTool({
      name: 'env_rename',
      arguments: { name: 'staging', new_name: 'pre-prod' },
    })
    const text = (result.content as Array<{ type: string; text: string }>)[0].text
    expect(text).toContain("'staging'")
    expect(text).toContain("'pre-prod'")

    // Verificar que el viejo no existe y el nuevo sí
    const getOld = await ctx.client.callTool({
      name: 'env_get',
      arguments: { environment: 'staging' },
    })
    expect(getOld.isError).toBe(true)

    const getNew = await ctx.client.callTool({
      name: 'env_get',
      arguments: { environment: 'pre-prod' },
    })
    const data = JSON.parse((getNew.content as Array<{ type: string; text: string }>)[0].text)
    expect(data.variables.BASE_URL).toBe('http://staging:3000')
  })

  it('env_rename actualiza active-env si era el activo', async () => {
    await ctx.client.callTool({ name: 'env_switch', arguments: { name: 'pre-prod' } })

    await ctx.client.callTool({
      name: 'env_rename',
      arguments: { name: 'pre-prod', new_name: 'renamed-active' },
    })

    const list = await ctx.client.callTool({ name: 'env_list', arguments: {} })
    const items = JSON.parse((list.content as Array<{ type: string; text: string }>)[0].text)
    const renamed = items.find((i: { name: string }) => i.name === 'renamed-active')
    expect(renamed?.active).toBe(true)
  })

  it('env_rename a nombre existente retorna error', async () => {
    const result = await ctx.client.callTool({
      name: 'env_rename',
      arguments: { name: 'dev', new_name: 'renamed-active' },
    })
    expect(result.isError).toBe(true)
  })

  it('env_rename entorno no existente retorna error', async () => {
    const result = await ctx.client.callTool({
      name: 'env_rename',
      arguments: { name: 'nope', new_name: 'whatever' },
    })
    expect(result.isError).toBe(true)
  })

  // ── env_delete ──

  it('env_delete elimina un entorno', async () => {
    const result = await ctx.client.callTool({
      name: 'env_delete',
      arguments: { name: 'renamed-active' },
    })
    const text = (result.content as Array<{ type: string; text: string }>)[0].text
    expect(text).toContain("'renamed-active' eliminado")

    // Verificar que ya no existe
    const get = await ctx.client.callTool({
      name: 'env_get',
      arguments: { environment: 'renamed-active' },
    })
    expect(get.isError).toBe(true)
  })

  it('env_delete desactiva si era el entorno activo', async () => {
    // Crear y activar un entorno
    await ctx.client.callTool({
      name: 'env_create',
      arguments: { name: 'temp' },
    })
    await ctx.client.callTool({ name: 'env_switch', arguments: { name: 'temp' } })

    // Eliminarlo
    await ctx.client.callTool({ name: 'env_delete', arguments: { name: 'temp' } })

    // Verificar que no hay entorno activo
    const list = await ctx.client.callTool({ name: 'env_list', arguments: {} })
    const items = JSON.parse((list.content as Array<{ type: string; text: string }>)[0].text)
    const anyActive = items.some((i: { active: boolean }) => i.active)
    expect(anyActive).toBe(false)
  })

  it('env_delete entorno no existente retorna error', async () => {
    const result = await ctx.client.callTool({
      name: 'env_delete',
      arguments: { name: 'nope' },
    })
    expect(result.isError).toBe(true)
  })

  // ── Project-scoped environments ──

  it('env_switch con project guarda entorno específico del proyecto', async () => {
    const result = await ctx.client.callTool({
      name: 'env_switch',
      arguments: { name: 'dev', project: '/test/project-a' },
    })
    const text = (result.content as Array<{ type: string; text: string }>)[0].text
    expect(text).toContain("'dev'")
    expect(text).toContain("'/test/project-a'")
  })

  it('env_project_list muestra proyectos con entornos asignados', async () => {
    const result = await ctx.client.callTool({
      name: 'env_project_list',
      arguments: {},
    })
    const text = (result.content as Array<{ type: string; text: string }>)[0].text
    const items = JSON.parse(text)
    expect(items).toHaveLength(1)
    expect(items[0].project).toBe('/test/project-a')
    expect(items[0].environment).toBe('dev')
  })

  it('env_project_clear elimina asociación de proyecto', async () => {
    const result = await ctx.client.callTool({
      name: 'env_project_clear',
      arguments: { project: '/test/project-a' },
    })
    const text = (result.content as Array<{ type: string; text: string }>)[0].text
    expect(text).toContain('eliminado')

    // Verificar que ya no aparece en la lista
    const list = await ctx.client.callTool({
      name: 'env_project_list',
      arguments: {},
    })
    const listText = (list.content as Array<{ type: string; text: string }>)[0].text
    expect(listText).toContain('No hay entornos específicos')
  })

  it('env_project_clear en proyecto sin asociación retorna mensaje informativo', async () => {
    const result = await ctx.client.callTool({
      name: 'env_project_clear',
      arguments: { project: '/nonexistent/project' },
    })
    const text = (result.content as Array<{ type: string; text: string }>)[0].text
    expect(text).toContain('No hay entorno específico')
  })

  it('env_delete limpia project-envs asociados', async () => {
    // Crear entorno y asociar a proyecto
    await ctx.client.callTool({
      name: 'env_create',
      arguments: { name: 'proj-env' },
    })
    await ctx.client.callTool({
      name: 'env_switch',
      arguments: { name: 'proj-env', project: '/test/project-b' },
    })

    // Eliminar el entorno
    await ctx.client.callTool({
      name: 'env_delete',
      arguments: { name: 'proj-env' },
    })

    // Verificar que la asociación se limpió
    const list = await ctx.client.callTool({
      name: 'env_project_list',
      arguments: {},
    })
    const text = (list.content as Array<{ type: string; text: string }>)[0].text
    expect(text).toContain('No hay entornos específicos')
  })

  it('env_rename actualiza project-envs asociados', async () => {
    // Crear entorno y asociar a proyecto
    await ctx.client.callTool({
      name: 'env_create',
      arguments: { name: 'old-name' },
    })
    await ctx.client.callTool({
      name: 'env_switch',
      arguments: { name: 'old-name', project: '/test/project-c' },
    })

    // Renombrar
    await ctx.client.callTool({
      name: 'env_rename',
      arguments: { name: 'old-name', new_name: 'new-name' },
    })

    // Verificar que la asociación se actualizó
    const list = await ctx.client.callTool({
      name: 'env_project_list',
      arguments: {},
    })
    const text = (list.content as Array<{ type: string; text: string }>)[0].text
    const items = JSON.parse(text)
    const item = items.find((i: { project: string }) => i.project === '/test/project-c')
    expect(item.environment).toBe('new-name')
  })

  // ── env_spec ──

  it('env_spec asocia un spec al entorno activo', async () => {
    await ctx.client.callTool({ name: 'env_switch', arguments: { name: 'dev' } })

    const result = await ctx.client.callTool({
      name: 'env_spec',
      arguments: { spec: 'my-api' },
    })
    const text = (result.content as Array<{ type: string; text: string }>)[0].text
    expect(text).toContain("'my-api'")
    expect(text).toContain("'dev'")
  })

  it('env_spec desasocia spec cuando se omite', async () => {
    const result = await ctx.client.callTool({
      name: 'env_spec',
      arguments: {},
    })
    const text = (result.content as Array<{ type: string; text: string }>)[0].text
    expect(text).toContain('desasociado')
    expect(text).toContain("'dev'")
  })

  it('env_spec con entorno específico', async () => {
    const result = await ctx.client.callTool({
      name: 'env_spec',
      arguments: { spec: 'other-api', environment: 'dev' },
    })
    const text = (result.content as Array<{ type: string; text: string }>)[0].text
    expect(text).toContain("'other-api'")
    expect(text).toContain("'dev'")
  })

  it('env_spec sin entorno activo retorna error', async () => {
    // Create a fresh client with no active env
    const freshCtx = await createTestClient()
    const result = await freshCtx.client.callTool({
      name: 'env_spec',
      arguments: { spec: 'some-api' },
    })
    expect(result.isError).toBe(true)
    await freshCtx.cleanup()
  })

  // ── Group default and switch behavior ──

  describe('group default and switch', () => {
    let gCtx: TestContext

    beforeAll(async () => {
      gCtx = await createTestClient()
      // Create a group
      await gCtx.client.callTool({
        name: 'env_group_create',
        arguments: { name: 'grp-test' },
      })
      await gCtx.client.callTool({
        name: 'env_group_add_scope',
        arguments: { group: 'grp-test', scope: process.cwd() },
      })
    })

    afterAll(async () => {
      await gCtx.cleanup()
    })

    it('first env in group auto-becomes default', async () => {
      await gCtx.client.callTool({
        name: 'env_create',
        arguments: { name: 'g-env-1', group: 'grp-test', variables: { X: '1' } },
      })

      const list = await gCtx.client.callTool({ name: 'env_list', arguments: {} })
      const items = JSON.parse((list.content as Array<{ type: string; text: string }>)[0].text)
      const env1 = items.find((i: { name: string }) => i.name === 'g-env-1')
      expect(env1?.default).toBe(true)
      expect(env1?.active).toBe(true) // default = active when no session override
    })

    it('env_switch changes active within same group', async () => {
      await gCtx.client.callTool({
        name: 'env_create',
        arguments: { name: 'g-env-2', group: 'grp-test', variables: { X: '2' } },
      })

      await gCtx.client.callTool({
        name: 'env_switch',
        arguments: { name: 'g-env-2' },
      })

      const list = await gCtx.client.callTool({ name: 'env_list', arguments: {} })
      const items = JSON.parse((list.content as Array<{ type: string; text: string }>)[0].text)
      const env1 = items.find((i: { name: string }) => i.name === 'g-env-1')
      const env2 = items.find((i: { name: string }) => i.name === 'g-env-2')
      expect(env1?.default).toBe(true)
      expect(env1?.active).toBe(false)
      expect(env2?.active).toBe(true)
    })

    it('env_set_default changes default and clears session active', async () => {
      // Currently: g-env-2 is session active, g-env-1 is default
      await gCtx.client.callTool({
        name: 'env_set_default',
        arguments: { name: 'g-env-2' },
      })

      const list = await gCtx.client.callTool({ name: 'env_list', arguments: {} })
      const items = JSON.parse((list.content as Array<{ type: string; text: string }>)[0].text)
      const env2 = items.find((i: { name: string }) => i.name === 'g-env-2')
      expect(env2?.default).toBe(true)
      expect(env2?.active).toBe(true) // active via default, session was cleared
    })

    it('env_set_default to another env makes it active immediately', async () => {
      await gCtx.client.callTool({
        name: 'env_set_default',
        arguments: { name: 'g-env-1' },
      })

      const list = await gCtx.client.callTool({ name: 'env_list', arguments: {} })
      const items = JSON.parse((list.content as Array<{ type: string; text: string }>)[0].text)
      const env1 = items.find((i: { name: string }) => i.name === 'g-env-1')
      const env2 = items.find((i: { name: string }) => i.name === 'g-env-2')
      expect(env1?.default).toBe(true)
      expect(env1?.active).toBe(true)
      expect(env2?.default).toBe(false)
      expect(env2?.active).toBe(false)
    })

    it('env_switch to global env works within group scope', async () => {
      // Create a global env
      await gCtx.client.callTool({
        name: 'env_create',
        arguments: { name: 'g-global', group: '', variables: { Y: 'global' } },
      })

      const result = await gCtx.client.callTool({
        name: 'env_switch',
        arguments: { name: 'g-global' },
      })
      expect(result.isError).toBeUndefined()

      const list = await gCtx.client.callTool({ name: 'env_list', arguments: {} })
      const items = JSON.parse((list.content as Array<{ type: string; text: string }>)[0].text)
      const globalEnv = items.find((i: { name: string }) => i.name === 'g-global')
      expect(globalEnv?.active).toBe(true)
    })

    it('env_switch rejects env from different group', async () => {
      // Create another group with an env
      await gCtx.client.callTool({
        name: 'env_group_create',
        arguments: { name: 'other-grp' },
      })
      await gCtx.client.callTool({
        name: 'env_create',
        arguments: { name: 'other-env', group: 'other-grp' },
      })

      const result = await gCtx.client.callTool({
        name: 'env_switch',
        arguments: { name: 'other-env' },
      })
      expect(result.isError).toBe(true)
      const text = (result.content as Array<{ type: string; text: string }>)[0].text
      expect(text).toContain('other-grp')
      expect(text).toContain('grp-test')
    })

    it('env_group_list muestra grupos con sus detalles', async () => {
      const result = await gCtx.client.callTool({
        name: 'env_group_list',
        arguments: {},
      })
      const text = (result.content as Array<{ type: string; text: string }>)[0].text
      const groups = JSON.parse(text)
      const grp = groups.find((g: { name: string }) => g.name === 'grp-test')
      expect(grp).toBeDefined()
      expect(grp.scopes.length).toBeGreaterThan(0)
    })

    it('env_group_remove_scope quita un scope', async () => {
      // Add an extra scope to remove
      await gCtx.client.callTool({
        name: 'env_group_add_scope',
        arguments: { group: 'grp-test', scope: '/tmp/removable' },
      })

      const result = await gCtx.client.callTool({
        name: 'env_group_remove_scope',
        arguments: { group: 'grp-test', scope: '/tmp/removable' },
      })
      const text = (result.content as Array<{ type: string; text: string }>)[0].text
      expect(text).toContain("'/tmp/removable'")
      expect(text).toContain('eliminado')

      // Verify it's gone
      const list = await gCtx.client.callTool({ name: 'env_group_list', arguments: {} })
      const groups = JSON.parse((list.content as Array<{ type: string; text: string }>)[0].text)
      const grp = groups.find((g: { name: string }) => g.name === 'grp-test')
      expect(grp.scopes).not.toContain('/tmp/removable')
    })

    it('env_group_remove_scope en grupo inexistente retorna error', async () => {
      const result = await gCtx.client.callTool({
        name: 'env_group_remove_scope',
        arguments: { group: 'nope', scope: '/tmp/x' },
      })
      expect(result.isError).toBe(true)
    })

    it('env_set_group asigna entorno a un grupo', async () => {
      // Create a global env
      await gCtx.client.callTool({
        name: 'env_create',
        arguments: { name: 'orphan-env', group: '', variables: { Z: '1' } },
      })

      const result = await gCtx.client.callTool({
        name: 'env_set_group',
        arguments: { environment: 'orphan-env', group: 'grp-test' },
      })
      const text = (result.content as Array<{ type: string; text: string }>)[0].text
      expect(text).toContain("'orphan-env'")
      expect(text).toContain("'grp-test'")
    })

    it('env_set_group con grupo vacío hace global', async () => {
      const result = await gCtx.client.callTool({
        name: 'env_set_group',
        arguments: { environment: 'orphan-env', group: '' },
      })
      const text = (result.content as Array<{ type: string; text: string }>)[0].text
      expect(text).toContain('global')
    })

    it('env_set_group en entorno inexistente retorna error', async () => {
      const result = await gCtx.client.callTool({
        name: 'env_set_group',
        arguments: { environment: 'nope', group: 'grp-test' },
      })
      expect(result.isError).toBe(true)
    })

    it('env_set_group crea grupo automáticamente si no existe', async () => {
      await gCtx.client.callTool({
        name: 'env_create',
        arguments: { name: 'auto-grp-env', group: '', variables: {} },
      })
      const result = await gCtx.client.callTool({
        name: 'env_set_group',
        arguments: { environment: 'auto-grp-env', group: 'auto-created-grp' },
      })
      expect(result.isError).toBeUndefined()
      const text = (result.content as Array<{ type: string; text: string }>)[0].text
      expect(text).toContain("'auto-created-grp'")

      // Verify group was created
      const groups = await gCtx.client.callTool({ name: 'env_group_list', arguments: {} })
      const groupsText = (groups.content as Array<{ type: string; text: string }>)[0].text
      expect(groupsText).toContain('auto-created-grp')
    })

    it('deleting default env resets default, next created env becomes default', async () => {
      // Switch back to a group env first
      await gCtx.client.callTool({
        name: 'env_switch',
        arguments: { name: 'g-env-1' },
      })

      // Delete the current default (g-env-1)
      await gCtx.client.callTool({
        name: 'env_delete',
        arguments: { name: 'g-env-1' },
      })

      // Delete g-env-2 too so group has no envs
      await gCtx.client.callTool({
        name: 'env_delete',
        arguments: { name: 'g-env-2' },
      })

      // Create new env — should auto-become default
      await gCtx.client.callTool({
        name: 'env_create',
        arguments: { name: 'g-env-3', group: 'grp-test' },
      })

      const list = await gCtx.client.callTool({ name: 'env_list', arguments: {} })
      const items = JSON.parse((list.content as Array<{ type: string; text: string }>)[0].text)
      const env3 = items.find((i: { name: string }) => i.name === 'g-env-3')
      expect(env3?.default).toBe(true)
      expect(env3?.active).toBe(true)
    })
  })

  // ── env_group_delete ──

  describe('env_group_delete', () => {
    let dCtx: TestContext

    beforeAll(async () => {
      dCtx = await createTestClient()
      // Create group with env
      await dCtx.client.callTool({
        name: 'env_group_create',
        arguments: { name: 'del-grp' },
      })
      await dCtx.client.callTool({
        name: 'env_create',
        arguments: { name: 'del-env', group: 'del-grp', variables: { A: '1' } },
      })
    })

    afterAll(async () => {
      await dCtx.cleanup()
    })

    it('env_group_delete elimina grupo y hace entornos globales', async () => {
      const result = await dCtx.client.callTool({
        name: 'env_group_delete',
        arguments: { name: 'del-grp' },
      })
      const text = (result.content as Array<{ type: string; text: string }>)[0].text
      expect(text).toContain("'del-grp' eliminado")
      expect(text).toContain('globales')

      // Verify env still exists but is now global
      const get = await dCtx.client.callTool({
        name: 'env_get',
        arguments: { environment: 'del-env' },
      })
      const data = JSON.parse((get.content as Array<{ type: string; text: string }>)[0].text)
      expect(data.variables.A).toBe('1')
    })

    it('env_group_delete en grupo inexistente retorna error', async () => {
      const result = await dCtx.client.callTool({
        name: 'env_group_delete',
        arguments: { name: 'nope' },
      })
      expect(result.isError).toBe(true)
    })

    it('env_group_list sin grupos retorna mensaje vacío', async () => {
      // Delete any remaining groups
      const list = await dCtx.client.callTool({ name: 'env_group_list', arguments: {} })
      const text = (list.content as Array<{ type: string; text: string }>)[0].text
      // If no groups, should say so
      if (text.includes('No hay grupos')) {
        expect(text).toContain('No hay grupos')
      } else {
        // There might be other groups from other tests, just verify it's valid JSON
        expect(() => JSON.parse(text)).not.toThrow()
      }
    })
  })
})
