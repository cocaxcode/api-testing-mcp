import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createTestClient, type TestContext } from './helpers.js'

describe('collection tools', () => {
  let ctx: TestContext

  beforeAll(async () => {
    ctx = await createTestClient()
  })

  afterAll(async () => {
    await ctx.cleanup()
  })

  it('collection_list retorna lista vacía inicialmente', async () => {
    const result = await ctx.client.callTool({ name: 'collection_list', arguments: {} })
    const text = (result.content as Array<{ type: string; text: string }>)[0].text
    expect(text).toContain('vacía')
  })

  it('collection_save guarda un request', async () => {
    const result = await ctx.client.callTool({
      name: 'collection_save',
      arguments: {
        name: 'get-users',
        request: { method: 'GET', url: 'https://api.example.com/users' },
        tags: ['users', 'read'],
      },
    })
    const text = (result.content as Array<{ type: string; text: string }>)[0].text
    expect(text).toContain("'get-users'")
    expect(text).toContain('guardado')
  })

  it('collection_list retorna requests guardados', async () => {
    const result = await ctx.client.callTool({ name: 'collection_list', arguments: {} })
    const text = (result.content as Array<{ type: string; text: string }>)[0].text
    const items = JSON.parse(text)
    expect(items).toHaveLength(1)
    expect(items[0].name).toBe('get-users')
    expect(items[0].method).toBe('GET')
  })

  it('collection_save con segundo request', async () => {
    await ctx.client.callTool({
      name: 'collection_save',
      arguments: {
        name: 'create-post',
        request: {
          method: 'POST',
          url: 'https://api.example.com/posts',
          body: { title: 'Test' },
        },
        tags: ['posts', 'write'],
      },
    })

    const result = await ctx.client.callTool({ name: 'collection_list', arguments: {} })
    const text = (result.content as Array<{ type: string; text: string }>)[0].text
    const items = JSON.parse(text)
    expect(items).toHaveLength(2)
  })

  it('collection_list filtra por tag', async () => {
    const result = await ctx.client.callTool({
      name: 'collection_list',
      arguments: { tag: 'users' },
    })
    const text = (result.content as Array<{ type: string; text: string }>)[0].text
    const items = JSON.parse(text)
    expect(items).toHaveLength(1)
    expect(items[0].name).toBe('get-users')
  })

  it('collection_get retorna request completo', async () => {
    const result = await ctx.client.callTool({
      name: 'collection_get',
      arguments: { name: 'get-users' },
    })
    const text = (result.content as Array<{ type: string; text: string }>)[0].text
    const saved = JSON.parse(text)
    expect(saved.name).toBe('get-users')
    expect(saved.request.method).toBe('GET')
    expect(saved.request.url).toBe('https://api.example.com/users')
    expect(saved.tags).toContain('users')
    expect(saved.createdAt).toBeDefined()
  })

  it('collection_get de request no existente retorna error', async () => {
    const result = await ctx.client.callTool({
      name: 'collection_get',
      arguments: { name: 'nope' },
    })
    expect(result.isError).toBe(true)
  })

  it('collection_save sobreescribe con mismo nombre (upsert)', async () => {
    await ctx.client.callTool({
      name: 'collection_save',
      arguments: {
        name: 'get-users',
        request: { method: 'GET', url: 'https://api.v2.example.com/users' },
      },
    })

    const result = await ctx.client.callTool({
      name: 'collection_get',
      arguments: { name: 'get-users' },
    })
    const text = (result.content as Array<{ type: string; text: string }>)[0].text
    const saved = JSON.parse(text)
    expect(saved.request.url).toBe('https://api.v2.example.com/users')
    // Mantiene createdAt original
    expect(saved.createdAt).toBeDefined()
  })

  it('collection_delete elimina request', async () => {
    const result = await ctx.client.callTool({
      name: 'collection_delete',
      arguments: { name: 'create-post' },
    })
    const text = (result.content as Array<{ type: string; text: string }>)[0].text
    expect(text).toContain("'create-post'")
    expect(text).toContain('eliminado')

    // Verificar que ya no existe
    const list = await ctx.client.callTool({ name: 'collection_list', arguments: {} })
    const listText = (list.content as Array<{ type: string; text: string }>)[0].text
    const items = JSON.parse(listText)
    expect(items).toHaveLength(1)
  })

  it('collection_delete de request no existente retorna error', async () => {
    const result = await ctx.client.callTool({
      name: 'collection_delete',
      arguments: { name: 'nope' },
    })
    expect(result.isError).toBe(true)
  })
})
