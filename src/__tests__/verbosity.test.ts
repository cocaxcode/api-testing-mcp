import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createTestClient, type TestContext } from './helpers.js'
import { installMockFetch, restoreFetch } from './mock-fetch.js'

describe('request tool — verbosity + only_fields', () => {
  let ctx: TestContext

  beforeAll(async () => {
    installMockFetch()
    ctx = await createTestClient()
  })

  afterAll(async () => {
    await ctx.cleanup()
    restoreFetch()
  })

  it("verbosity='minimal' devuelve solo campos esenciales", async () => {
    const result = await ctx.client.callTool({
      name: 'request',
      arguments: {
        method: 'GET',
        url: 'https://httpbin.org/get',
        verbosity: 'minimal',
      },
    })
    const resp = JSON.parse((result.content as Array<{ text: string }>)[0].text)
    expect(resp.status).toBe(200)
    expect(resp.body_preview).toBeDefined()
    expect(resp.headers).toBeUndefined()
    expect(resp.body).toBeUndefined()
    expect(resp.call_id).toBeTruthy()
  })

  it("verbosity='full' devuelve headers y body sin filtrar", async () => {
    const result = await ctx.client.callTool({
      name: 'request',
      arguments: {
        method: 'GET',
        url: 'https://httpbin.org/get',
        verbosity: 'full',
      },
    })
    const resp = JSON.parse((result.content as Array<{ text: string }>)[0].text)
    expect(resp.headers).toBeDefined()
    expect(resp.body).toBeDefined()
    expect(resp.tokens_saved_estimate).toBe(0)
  })

  it('only_fields extrae solo los paths pedidos', async () => {
    const result = await ctx.client.callTool({
      name: 'request',
      arguments: {
        method: 'POST',
        url: 'https://httpbin.org/post',
        body: { name: 'test', value: 42 },
        only_fields: ['json.name', 'json.value'],
      },
    })
    const resp = JSON.parse((result.content as Array<{ text: string }>)[0].text)
    expect(resp.body).toEqual({ 'json.name': 'test', 'json.value': 42 })
  })

  it("default es 'normal' — preserva timing.total_ms y size_bytes para compatibilidad", async () => {
    const result = await ctx.client.callTool({
      name: 'request',
      arguments: { method: 'GET', url: 'https://httpbin.org/get' },
    })
    const resp = JSON.parse((result.content as Array<{ text: string }>)[0].text)
    expect(resp.timing.total_ms).toBeGreaterThan(0)
    expect(resp.size_bytes).toBeGreaterThan(0)
    expect(resp.call_id).toBeTruthy()
  })

  it('call_id de request se puede usar con inspect_last_response', async () => {
    const req = await ctx.client.callTool({
      name: 'request',
      arguments: {
        method: 'GET',
        url: 'https://httpbin.org/get',
        verbosity: 'minimal',
      },
    })
    const compressed = JSON.parse((req.content as Array<{ text: string }>)[0].text)

    const insp = await ctx.client.callTool({
      name: 'inspect_last_response',
      arguments: { call_id: compressed.call_id },
    })
    const text = (insp.content as Array<{ text: string }>)[0].text
    const payload = JSON.parse(text.slice(text.indexOf('{')))
    expect(payload.call_id).toBe(compressed.call_id)
    expect(payload.response.body).toBeDefined()
  })
})
