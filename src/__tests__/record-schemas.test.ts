import { createServer } from 'node:http'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestClient, type TestContext } from './helpers.js'

describe('nested record schemas', () => {
  let ctx: TestContext
  beforeAll(async () => { ctx = await createTestClient() })
  afterAll(async () => { await ctx.cleanup() })

  it('advertises string-valued nested records in listTools', async () => {
    const { tools } = await ctx.client.listTools()
    const collection = tools.find((tool) => tool.name === 'collection_save')!.inputSchema as any
    for (const key of ['headers', 'query']) {
      expect(collection.properties.request.properties[key].additionalProperties.type).toBe('string')
    }
    const flow = tools.find((tool) => tool.name === 'flow_run')!.inputSchema as any
    for (const key of ['headers', 'query', 'extract']) {
      expect(flow.properties.steps.items.properties[key].additionalProperties.type).toBe('string')
    }
  })

  it('accepts nested string maps in a saved request', async () => {
    const result = await ctx.client.callTool({ name: 'collection_save', arguments: {
      name: 'nested-record-test', request: { method: 'GET', url: 'https://example.com', headers: { a: 'ok' }, query: { b: 'ok' } },
    } })
    expect(result.isError).toBeFalsy()
  })

  it.each(['headers', 'query'])('rejects non-string collection request %s values', async (key) => {
    const result = await ctx.client.callTool({ name: 'collection_save', arguments: {
      name: 'invalid', request: { method: 'GET', url: 'https://example.com', [key]: { bad: 42 } },
    } })
    expect(result.isError).toBe(true)
  })

  it('accepts nested string maps in a flow step', async () => {
    const server = createServer((_req, res) => { res.setHeader('content-type', 'application/json'); res.end('{"value":"ok"}') })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    try {
      const address = server.address()
      if (!address || typeof address === 'string') throw new Error('No TCP address')
      const result = await ctx.client.callTool({ name: 'flow_run', arguments: {
        steps: [{ name: 'valid', method: 'GET', url: `http://127.0.0.1:${address.port}`, headers: { a: 'ok' }, query: { b: 'ok' }, extract: { value: 'body.value' } }],
      } })
      expect(result.isError).toBeFalsy()
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
    }
  })

  it.each(['headers', 'query', 'extract'])('rejects non-string flow step %s values', async (key) => {
    const result = await ctx.client.callTool({ name: 'flow_run', arguments: {
      steps: [{ name: 'invalid', method: 'GET', url: 'https://example.com', [key]: { bad: 42 } }],
    } })
    expect(result.isError).toBe(true)
  })
})
