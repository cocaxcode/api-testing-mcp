import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createTestClient, type TestContext } from './helpers.js'

describe('load_test tool', () => {
  let ctx: TestContext

  beforeAll(async () => {
    ctx = await createTestClient()
  })

  afterAll(async () => {
    await ctx.cleanup()
  })

  it('ejecuta N requests concurrentes y reporta estadísticas', async () => {
    const result = await ctx.client.callTool({
      name: 'load_test',
      arguments: {
        method: 'GET',
        url: 'https://httpbin.org/get',
        concurrent: 5,
      },
    })

    const text = (result.content as Array<{ type: string; text: string }>)[0].text
    expect(text).toContain('LOAD TEST')
    expect(text).toContain('5 concurrentes')
    expect(text).toContain('Min:')
    expect(text).toContain('Avg:')
    expect(text).toContain('p50:')
    expect(text).toContain('p95:')
    expect(text).toContain('Max:')
    expect(text).toContain('Requests/segundo')
  })

  it('reporta errores en URLs inválidas', async () => {
    const result = await ctx.client.callTool({
      name: 'load_test',
      arguments: {
        method: 'GET',
        url: 'not-valid-url',
        concurrent: 3,
      },
    })

    const text = (result.content as Array<{ type: string; text: string }>)[0].text
    expect(text).toContain('Fallidos: 3')
    expect(text).toContain('Errores')
  })
})
