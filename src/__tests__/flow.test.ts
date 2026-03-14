import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createTestClient, type TestContext } from './helpers.js'

describe('flow_run tool', () => {
  let ctx: TestContext

  beforeAll(async () => {
    ctx = await createTestClient()
  })

  afterAll(async () => {
    await ctx.cleanup()
  })

  it('ejecuta múltiples pasos en secuencia', async () => {
    const result = await ctx.client.callTool({
      name: 'flow_run',
      arguments: {
        steps: [
          {
            name: 'paso-1-get',
            method: 'GET',
            url: 'https://httpbin.org/get',
          },
          {
            name: 'paso-2-post',
            method: 'POST',
            url: 'https://httpbin.org/post',
            body: { test: true },
          },
        ],
      },
    })

    expect(result.isError).toBeFalsy()
    const text = (result.content as Array<{ type: string; text: string }>)[0].text
    expect(text).toContain('FLOW COMPLETO')
    expect(text).toContain('paso-1-get')
    expect(text).toContain('paso-2-post')
    expect(text).toContain('2/2')
  })

  it('extrae variables de un paso y las usa en el siguiente', async () => {
    const result = await ctx.client.callTool({
      name: 'flow_run',
      arguments: {
        steps: [
          {
            name: 'get-url',
            method: 'GET',
            url: 'https://httpbin.org/get?token=abc123',
            extract: { EXTRACTED_URL: 'body.url' },
          },
          {
            name: 'verify-extract',
            method: 'POST',
            url: 'https://httpbin.org/post',
            body: { previous_url: '{{EXTRACTED_URL}}' },
          },
        ],
      },
    })

    expect(result.isError).toBeFalsy()
    const text = (result.content as Array<{ type: string; text: string }>)[0].text
    expect(text).toContain('FLOW COMPLETO')
    expect(text).toContain('Extraído')
    expect(text).toContain('EXTRACTED_URL')
  })

  it('detiene el flow al primer error con stop_on_error', async () => {
    const result = await ctx.client.callTool({
      name: 'flow_run',
      arguments: {
        steps: [
          {
            name: 'paso-ok',
            method: 'GET',
            url: 'https://httpbin.org/get',
          },
          {
            name: 'paso-falla',
            method: 'GET',
            url: 'not-a-valid-url',
          },
          {
            name: 'paso-nunca-ejecutado',
            method: 'GET',
            url: 'https://httpbin.org/get',
          },
        ],
        stop_on_error: true,
      },
    })

    expect(result.isError).toBe(true)
    const text = (result.content as Array<{ type: string; text: string }>)[0].text
    expect(text).toContain('2/3') // Solo se ejecutaron 2 de 3
    expect(text).not.toContain('paso-nunca-ejecutado')
  })
})
