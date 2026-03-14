import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createTestClient, type TestContext } from './helpers.js'

describe('utility tools', () => {
  let ctx: TestContext

  beforeAll(async () => {
    ctx = await createTestClient()

    // Save a collection item for export_curl and bulk_test
    await ctx.client.callTool({
      name: 'collection_save',
      arguments: {
        name: 'test-get',
        request: { method: 'GET', url: 'https://httpbin.org/get' },
        tags: ['test'],
      },
    })

    await ctx.client.callTool({
      name: 'collection_save',
      arguments: {
        name: 'test-post',
        request: {
          method: 'POST',
          url: 'https://httpbin.org/post',
          body: { name: 'test' },
        },
        tags: ['test'],
      },
    })
  })

  afterAll(async () => {
    await ctx.cleanup()
  })

  // ── export_curl ──

  it('export_curl genera comando cURL válido para GET', async () => {
    const result = await ctx.client.callTool({
      name: 'export_curl',
      arguments: { name: 'test-get' },
    })

    expect(result.isError).toBeFalsy()
    const text = (result.content as Array<{ type: string; text: string }>)[0].text
    expect(text).toContain('curl')
    expect(text).toContain('httpbin.org/get')
  })

  it('export_curl genera cURL con body para POST', async () => {
    const result = await ctx.client.callTool({
      name: 'export_curl',
      arguments: { name: 'test-post' },
    })

    expect(result.isError).toBeFalsy()
    const text = (result.content as Array<{ type: string; text: string }>)[0].text
    expect(text).toContain('-X POST')
    expect(text).toContain('-d')
    expect(text).toContain('Content-Type: application/json')
  })

  it('export_curl retorna error si request no existe', async () => {
    const result = await ctx.client.callTool({
      name: 'export_curl',
      arguments: { name: 'no-existe' },
    })

    expect(result.isError).toBe(true)
  })

  // ── diff_responses ──

  it('diff_responses compara dos requests', async () => {
    const result = await ctx.client.callTool({
      name: 'diff_responses',
      arguments: {
        request_a: {
          label: 'endpoint-1',
          method: 'GET',
          url: 'https://httpbin.org/get',
        },
        request_b: {
          label: 'endpoint-2',
          method: 'GET',
          url: 'https://httpbin.org/get',
        },
      },
    })

    expect(result.isError).toBeFalsy()
    const text = (result.content as Array<{ type: string; text: string }>)[0].text
    expect(text).toContain('endpoint-1')
    expect(text).toContain('endpoint-2')
  })

  // ── bulk_test ──

  it('bulk_test ejecuta todos los requests de la colección', async () => {
    const result = await ctx.client.callTool({
      name: 'bulk_test',
      arguments: { tag: 'test' },
    })

    const text = (result.content as Array<{ type: string; text: string }>)[0].text
    expect(text).toContain('BULK TEST')
    expect(text).toContain('test-get')
    expect(text).toContain('test-post')
  })

  it('bulk_test reporta colección vacía', async () => {
    const result = await ctx.client.callTool({
      name: 'bulk_test',
      arguments: { tag: 'no-existe' },
    })

    expect(result.isError).toBeFalsy()
    const text = (result.content as Array<{ type: string; text: string }>)[0].text
    expect(text).toContain('No hay requests')
  })
})
