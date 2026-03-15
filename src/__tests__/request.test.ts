import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createTestClient, type TestContext } from './helpers.js'
import { installMockFetch, restoreFetch } from './mock-fetch.js'

describe('request tool', () => {
  let ctx: TestContext

  beforeAll(async () => {
    installMockFetch()
    ctx = await createTestClient()
  })

  afterAll(async () => {
    await ctx.cleanup()
    restoreFetch()
  })

  it('ejecuta GET a un endpoint público y retorna respuesta válida', async () => {
    const result = await ctx.client.callTool({
      name: 'request',
      arguments: {
        method: 'GET',
        url: 'https://httpbin.org/get',
      },
    })

    expect(result.isError).toBeFalsy()
    const text = (result.content as Array<{ type: string; text: string }>)[0].text
    const response = JSON.parse(text)
    expect(response.status).toBeTypeOf('number')
    expect(response.statusText).toBeTypeOf('string')
    expect(response.timing.total_ms).toBeGreaterThan(0)
    expect(response.size_bytes).toBeGreaterThan(0)
  })

  it('retorna timing.total_ms > 0', async () => {
    const result = await ctx.client.callTool({
      name: 'request',
      arguments: {
        method: 'GET',
        url: 'https://httpbin.org/get',
      },
    })

    const text = (result.content as Array<{ type: string; text: string }>)[0].text
    const response = JSON.parse(text)
    expect(response.timing.total_ms).toBeGreaterThan(0)
  })

  it('retorna headers como Record', async () => {
    const result = await ctx.client.callTool({
      name: 'request',
      arguments: {
        method: 'GET',
        url: 'https://httpbin.org/get',
      },
    })

    const text = (result.content as Array<{ type: string; text: string }>)[0].text
    const response = JSON.parse(text)
    expect(response.headers).toBeDefined()
    expect(typeof response.headers).toBe('object')
    expect(response.headers['content-type']).toBeDefined()
  })

  it('ejecuta POST con body JSON', async () => {
    const result = await ctx.client.callTool({
      name: 'request',
      arguments: {
        method: 'POST',
        url: 'https://httpbin.org/post',
        body: { name: 'test', value: 42 },
      },
    })

    expect(result.isError).toBeFalsy()
    const text = (result.content as Array<{ type: string; text: string }>)[0].text
    const response = JSON.parse(text)
    expect(response.status).toBe(200)
    expect(response.body.json.name).toBe('test')
  })

  it('URL inválida retorna isError', async () => {
    const result = await ctx.client.callTool({
      name: 'request',
      arguments: {
        method: 'GET',
        url: 'not-a-valid-url',
      },
    })

    expect(result.isError).toBe(true)
  })

  it('request con auth Bearer añade header Authorization', async () => {
    const result = await ctx.client.callTool({
      name: 'request',
      arguments: {
        method: 'GET',
        url: 'https://httpbin.org/headers',
        auth: { type: 'bearer', token: 'mytoken123' },
      },
    })

    const text = (result.content as Array<{ type: string; text: string }>)[0].text
    const response = JSON.parse(text)
    expect(response.body.headers.Authorization).toBe('Bearer mytoken123')
  })

  it('pipeline completo: env_create → env_set → request con {{variable}}', async () => {
    await ctx.client.callTool({
      name: 'env_create',
      arguments: {
        name: 'test-env',
        variables: { BASE_URL: 'https://httpbin.org' },
      },
    })

    await ctx.client.callTool({
      name: 'env_switch',
      arguments: { name: 'test-env' },
    })

    const result = await ctx.client.callTool({
      name: 'request',
      arguments: {
        method: 'GET',
        url: '{{BASE_URL}}/get',
      },
    })

    expect(result.isError).toBeFalsy()
    const text = (result.content as Array<{ type: string; text: string }>)[0].text
    const response = JSON.parse(text)
    expect(response.status).toBe(200)
    expect(response.body.url).toBe('https://httpbin.org/get')
  })

  it('URL relativa con / usa BASE_URL del entorno activo automáticamente', async () => {
    await ctx.client.callTool({
      name: 'env_create',
      arguments: {
        name: 'relative-url-env',
        variables: { BASE_URL: 'https://httpbin.org' },
      },
    })
    await ctx.client.callTool({
      name: 'env_switch',
      arguments: { name: 'relative-url-env' },
    })

    const result = await ctx.client.callTool({
      name: 'request',
      arguments: {
        method: 'GET',
        url: '/get',
      },
    })

    expect(result.isError).toBeFalsy()
    const text = (result.content as Array<{ type: string; text: string }>)[0].text
    const response = JSON.parse(text)
    expect(response.status).toBe(200)
    expect(response.body.url).toBe('https://httpbin.org/get')
  })

  it('URL relativa sin BASE_URL configurada retorna error', async () => {
    await ctx.client.callTool({
      name: 'env_create',
      arguments: {
        name: 'no-base-env',
        variables: { TOKEN: 'abc' },
      },
    })
    await ctx.client.callTool({
      name: 'env_switch',
      arguments: { name: 'no-base-env' },
    })

    const result = await ctx.client.callTool({
      name: 'request',
      arguments: {
        method: 'GET',
        url: '/api/health',
      },
    })

    expect(result.isError).toBe(true)
  })
})
