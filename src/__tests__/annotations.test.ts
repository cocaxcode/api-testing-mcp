import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createTestClient, type TestContext } from './helpers.js'
import { TOOL_ANNOTATIONS } from '../lib/annotations.js'

describe('tool annotations', () => {
  let ctx: TestContext

  beforeAll(async () => {
    ctx = await createTestClient()
  })

  afterAll(async () => {
    await ctx.cleanup()
  })

  it('every registered tool exposes annotations matching TOOL_ANNOTATIONS', async () => {
    const { tools } = await ctx.client.listTools()
    const registered = tools.map((t) => t.name).sort()
    const annotated = Object.keys(TOOL_ANNOTATIONS).sort()

    expect(registered).toEqual(annotated)

    for (const tool of tools) {
      const expected = TOOL_ANNOTATIONS[tool.name as keyof typeof TOOL_ANNOTATIONS]
      expect(tool.annotations, tool.name).toMatchObject(expected)
      expect(typeof tool.annotations?.readOnlyHint, tool.name).toBe('boolean')
    }
  })

  it('marks delete tools as destructive and list tools as read-only', async () => {
    const { tools } = await ctx.client.listTools()
    const byName = new Map(tools.map((t) => [t.name, t]))

    expect(byName.get('env_delete')?.annotations?.destructiveHint).toBe(true)
    expect(byName.get('collection_delete')?.annotations?.destructiveHint).toBe(true)
    expect(byName.get('env_list')?.annotations?.readOnlyHint).toBe(true)
    expect(byName.get('request')?.annotations?.openWorldHint).toBe(true)
  })
})
