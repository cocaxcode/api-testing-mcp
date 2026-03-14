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
})
