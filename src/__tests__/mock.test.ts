import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createTestClient, type TestContext } from './helpers.js'
import { writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'

const SAMPLE_SPEC = {
  openapi: '3.0.0',
  info: { title: 'Mock Test API', version: '1.0.0' },
  paths: {
    '/users': {
      get: {
        summary: 'List users',
        responses: {
          '200': {
            description: 'Users list',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/User' },
                },
              },
            },
          },
        },
      },
      post: {
        summary: 'Create user',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateUserDto' },
            },
          },
        },
        responses: {
          '201': {
            description: 'Created',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/User' },
              },
            },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      User: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          email: { type: 'string', format: 'email' },
          name: { type: 'string', description: 'Nombre del usuario' },
          role: { type: 'string', enum: ['admin', 'user'] },
          active: { type: 'boolean' },
        },
        required: ['id', 'email', 'name'],
      },
      CreateUserDto: {
        type: 'object',
        properties: {
          email: { type: 'string', format: 'email' },
          name: { type: 'string', description: 'Nombre completo' },
          password: { type: 'string', description: 'Contraseña del usuario' },
        },
        required: ['email', 'name', 'password'],
      },
    },
  },
}

describe('mock tool', () => {
  let ctx: TestContext

  beforeAll(async () => {
    ctx = await createTestClient()

    // Import spec from file
    const specFile = join(ctx.tempDir, 'mock-spec.json')
    await mkdir(ctx.tempDir, { recursive: true })
    await writeFile(specFile, JSON.stringify(SAMPLE_SPEC), 'utf-8')

    await ctx.client.callTool({
      name: 'api_import',
      arguments: { name: 'mock-api', source: specFile },
    })
  })

  afterAll(async () => {
    await ctx.cleanup()
  })

  it('genera mock de response con datos válidos', async () => {
    const result = await ctx.client.callTool({
      name: 'mock',
      arguments: {
        name: 'mock-api',
        method: 'POST',
        path: '/users',
        target: 'response',
      },
    })

    expect(result.isError).toBeFalsy()
    const text = (result.content as Array<{ type: string; text: string }>)[0].text
    expect(text).toContain('RESPONSE')
    expect(text).toContain('"email"')
    expect(text).toContain('"name"')
    expect(text).toContain('"id"')
  })

  it('genera mock de request body', async () => {
    const result = await ctx.client.callTool({
      name: 'mock',
      arguments: {
        name: 'mock-api',
        method: 'POST',
        path: '/users',
        target: 'request',
      },
    })

    expect(result.isError).toBeFalsy()
    const text = (result.content as Array<{ type: string; text: string }>)[0].text
    expect(text).toContain('REQUEST BODY')
    expect(text).toContain('"email"')
    expect(text).toContain('"password"')
  })

  it('genera array mock con count específico', async () => {
    const result = await ctx.client.callTool({
      name: 'mock',
      arguments: {
        name: 'mock-api',
        method: 'GET',
        path: '/users',
        target: 'response',
        count: 5,
      },
    })

    expect(result.isError).toBeFalsy()
    const text = (result.content as Array<{ type: string; text: string }>)[0].text
    // Should contain array with 5 items
    const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/)
    expect(jsonMatch).toBeTruthy()
    const parsed = JSON.parse(jsonMatch![1])
    expect(Array.isArray(parsed)).toBe(true)
    expect(parsed.length).toBe(5)
  })

  it('retorna error si API no importada', async () => {
    const result = await ctx.client.callTool({
      name: 'mock',
      arguments: {
        name: 'no-existe',
        method: 'GET',
        path: '/users',
      },
    })

    expect(result.isError).toBe(true)
  })
})
