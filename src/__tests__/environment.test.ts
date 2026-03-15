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
    expect(data.variables.TOKEN).toBe('secret123')
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
})
