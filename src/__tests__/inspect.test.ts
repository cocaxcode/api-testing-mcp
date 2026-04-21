import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createTestClient, type TestContext } from './helpers.js'
import { installMockFetch, restoreFetch } from './mock-fetch.js'

describe('inspect_last_response', () => {
  let ctx: TestContext

  beforeAll(async () => {
    installMockFetch()
    ctx = await createTestClient()
  })

  afterAll(async () => {
    await ctx.cleanup()
    restoreFetch()
  })

  it('devuelve error si no hay responses guardadas todavía', async () => {
    // Creamos un contexto fresco — el ctx global puede tener calls previas de otros tests
    const fresh = await createTestClient()
    try {
      const result = await fresh.client.callTool({
        name: 'inspect_last_response',
        arguments: {},
      })
      expect(result.isError).toBe(true)
    } finally {
      await fresh.cleanup()
    }
  })

  it('recupera la última response sin call_id', async () => {
    const reqResult = await ctx.client.callTool({
      name: 'request',
      arguments: {
        method: 'GET',
        url: 'https://httpbin.org/get',
        verbosity: 'minimal',
      },
    })
    const compressed = JSON.parse(
      (reqResult.content as Array<{ text: string }>)[0].text,
    )
    expect(compressed.call_id).toBeTruthy()

    const result = await ctx.client.callTool({
      name: 'inspect_last_response',
      arguments: {},
    })
    expect(result.isError).toBeFalsy()
    const text = (result.content as Array<{ text: string }>)[0].text
    // Puede llevar un warning al principio, extraemos el JSON
    const jsonStart = text.indexOf('{')
    const payload = JSON.parse(text.slice(jsonStart))
    expect(payload.call_id).toBe(compressed.call_id)
    expect(payload.response.status).toBeTypeOf('number')
    expect(payload.response.headers).toBeDefined()
    expect(payload.response.body).toBeDefined()
  })

  it('recupera por call_id explícito', async () => {
    const req1 = await ctx.client.callTool({
      name: 'request',
      arguments: { method: 'GET', url: 'https://httpbin.org/get', verbosity: 'minimal' },
    })
    const id1 = JSON.parse((req1.content as Array<{ text: string }>)[0].text).call_id

    await ctx.client.callTool({
      name: 'request',
      arguments: { method: 'GET', url: 'https://httpbin.org/get', verbosity: 'minimal' },
    })

    const result = await ctx.client.callTool({
      name: 'inspect_last_response',
      arguments: { call_id: id1 },
    })
    expect(result.isError).toBeFalsy()
    const text = (result.content as Array<{ text: string }>)[0].text
    const payload = JSON.parse(text.slice(text.indexOf('{')))
    expect(payload.call_id).toBe(id1)
  })

  it('devuelve error si call_id no existe', async () => {
    const result = await ctx.client.callTool({
      name: 'inspect_last_response',
      arguments: { call_id: 'nonexist' },
    })
    expect(result.isError).toBe(true)
  })
})
