import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createTestClient, type TestContext } from './helpers.js'

describe('assert tool', () => {
  let ctx: TestContext

  beforeAll(async () => {
    ctx = await createTestClient()
  })

  afterAll(async () => {
    await ctx.cleanup()
  })

  it('valida assertions que pasan correctamente', async () => {
    const result = await ctx.client.callTool({
      name: 'assert',
      arguments: {
        method: 'GET',
        url: 'https://httpbin.org/get',
        assertions: [
          { path: 'status', operator: 'eq', expected: 200 },
          { path: 'status', operator: 'gte', expected: 200 },
          { path: 'status', operator: 'lt', expected: 500 },
          { path: 'headers', operator: 'exists' },
          { path: 'timing.total_ms', operator: 'gt', expected: 0 },
          { path: 'status', operator: 'type', expected: 'number' },
        ],
      },
    })

    expect(result.isError).toBeFalsy()
    const text = (result.content as Array<{ type: string; text: string }>)[0].text
    expect(text).toContain('PASS')
    expect(text).toContain('6/6')
  })

  it('detecta assertion que falla', async () => {
    const result = await ctx.client.callTool({
      name: 'assert',
      arguments: {
        method: 'GET',
        url: 'https://httpbin.org/get',
        assertions: [
          { path: 'status', operator: 'eq', expected: 200 },
          { path: 'status', operator: 'eq', expected: 404 }, // This should fail
        ],
      },
    })

    expect(result.isError).toBe(true)
    const text = (result.content as Array<{ type: string; text: string }>)[0].text
    expect(text).toContain('FAIL')
    expect(text).toContain('1/2')
  })

  it('soporta operador contains en strings', async () => {
    const result = await ctx.client.callTool({
      name: 'assert',
      arguments: {
        method: 'GET',
        url: 'https://httpbin.org/get',
        assertions: [
          { path: 'body.url', operator: 'contains', expected: 'httpbin.org' },
        ],
      },
    })

    expect(result.isError).toBeFalsy()
    const text = (result.content as Array<{ type: string; text: string }>)[0].text
    expect(text).toContain('PASS')
  })

  it('soporta operador neq', async () => {
    const result = await ctx.client.callTool({
      name: 'assert',
      arguments: {
        method: 'GET',
        url: 'https://httpbin.org/get',
        assertions: [
          { path: 'status', operator: 'neq', expected: 500 },
        ],
      },
    })

    expect(result.isError).toBeFalsy()
  })
})
