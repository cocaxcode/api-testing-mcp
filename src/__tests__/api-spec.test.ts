import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createTestClient, type TestContext } from './helpers.js'
import { writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'

// Minimal OpenAPI 3.0 spec for testing
const SAMPLE_SPEC = {
  openapi: '3.0.0',
  info: { title: 'Test API', version: '1.0.0' },
  paths: {
    '/users': {
      get: {
        summary: 'Listar usuarios',
        tags: ['users'],
        parameters: [
          {
            name: 'page',
            in: 'query',
            required: false,
            description: 'Número de página',
            schema: { type: 'integer' },
          },
        ],
        responses: {
          '200': {
            description: 'Lista de usuarios',
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
        summary: 'Crear usuario',
        tags: ['users'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateUserDto' },
            },
          },
        },
        responses: {
          '201': { description: 'Usuario creado' },
        },
      },
    },
    '/users/{id}': {
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          description: 'ID del usuario',
          schema: { type: 'string' },
        },
      ],
      get: {
        summary: 'Obtener usuario por ID',
        tags: ['users'],
        responses: {
          '200': { description: 'Usuario encontrado' },
          '404': { description: 'No encontrado' },
        },
      },
    },
    '/auth/login': {
      post: {
        summary: 'Iniciar sesión',
        tags: ['auth'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Login exitoso' },
          '401': { description: 'Credenciales inválidas' },
        },
      },
    },
  },
  components: {
    schemas: {
      User: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          email: { type: 'string', format: 'email' },
          name: { type: 'string' },
          role: { type: 'string', enum: ['admin', 'user'] },
        },
        required: ['id', 'email', 'name'],
      },
      CreateUserDto: {
        type: 'object',
        properties: {
          email: { type: 'string', format: 'email', description: 'Email del usuario' },
          name: { type: 'string', description: 'Nombre completo' },
          password: { type: 'string', description: 'Contraseña (min 8 caracteres)' },
          role: { type: 'string', enum: ['admin', 'user'], description: 'Rol del usuario' },
        },
        required: ['email', 'name', 'password'],
      },
    },
  },
}

const XQUIK_SPEC = {
  openapi: '3.1.0',
  info: {
    title: 'Xquik API',
    version: '1.0',
    description:
      'Xquik is an independent third-party service. Not affiliated with X Corp. "Twitter" and "X" are trademarks of X Corp.',
  },
  servers: [{ url: 'https://xquik.com' }],
  paths: {
    '/api/v1/x/tweets/search': {
      get: {
        operationId: 'searchTweets',
        summary: 'Search tweets by query, Tweet ID, X status URL, or account date window',
        tags: ['Tweets'],
        security: [{ apiKey: [] }, { oauthBearer: [] }, {}],
        parameters: [
          {
            name: 'q',
            in: 'query',
            required: true,
            description: 'Search query',
            schema: { type: 'string' },
          },
          {
            name: 'limit',
            in: 'query',
            required: false,
            description: 'Maximum number of tweets to return',
            schema: { type: 'integer', default: 20, maximum: 200 },
          },
        ],
        responses: {
          '200': {
            description: 'Search results',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/PaginatedTweets' },
              },
            },
          },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      apiKey: {
        type: 'apiKey',
        in: 'header',
        name: 'x-api-key',
      },
      oauthBearer: {
        type: 'http',
        scheme: 'bearer',
      },
    },
    schemas: {
      SearchTweet: {
        type: 'object',
        required: [
          'id',
          'text',
          'retweetCount',
          'replyCount',
          'likeCount',
          'quoteCount',
          'viewCount',
          'bookmarkCount',
        ],
        properties: {
          id: { type: 'string' },
          text: { type: 'string' },
          createdAt: { type: 'string' },
          likeCount: { type: 'integer' },
          retweetCount: { type: 'integer' },
          replyCount: { type: 'integer' },
          quoteCount: { type: 'integer' },
          viewCount: { type: 'integer' },
          bookmarkCount: { type: 'integer' },
        },
      },
      PaginatedTweets: {
        type: 'object',
        required: ['tweets', 'has_next_page', 'next_cursor'],
        properties: {
          tweets: {
            type: 'array',
            items: { $ref: '#/components/schemas/SearchTweet' },
          },
          has_next_page: { type: 'boolean' },
          next_cursor: { type: 'string' },
        },
      },
    },
  },
}

describe('api spec tools', () => {
  let ctx: TestContext
  let specFilePath: string

  beforeAll(async () => {
    ctx = await createTestClient()
    // Write sample spec to temp file
    specFilePath = join(ctx.tempDir, 'test-api-spec.json')
    await mkdir(ctx.tempDir, { recursive: true })
    await writeFile(specFilePath, JSON.stringify(SAMPLE_SPEC), 'utf-8')
  })

  afterAll(async () => {
    await ctx.cleanup()
  })

  it('api_import importa spec desde archivo local', async () => {
    const result = await ctx.client.callTool({
      name: 'api_import',
      arguments: {
        name: 'test-api',
        source: specFilePath,
      },
    })

    expect(result.isError).toBeFalsy()
    const text = (result.content as Array<{ type: string; text: string }>)[0].text
    expect(text).toContain("API 'test-api' importada correctamente")
    expect(text).toContain('Endpoints: 4')
    expect(text).toContain('Schemas: 2')
    expect(text).toContain('users: 3 endpoints')
    expect(text).toContain('auth: 1 endpoints')
  })

  it('api_import soporta OpenAPI 3.1', async () => {
    const xquikSpecFile = join(ctx.tempDir, 'xquik-openapi-31.json')
    await writeFile(xquikSpecFile, JSON.stringify(XQUIK_SPEC), 'utf-8')

    const importResult = await ctx.client.callTool({
      name: 'api_import',
      arguments: {
        name: 'xquik',
        source: xquikSpecFile,
      },
    })

    expect(importResult.isError).toBeFalsy()
    const importText = (importResult.content as Array<{ type: string; text: string }>)[0].text
    expect(importText).toContain("API 'xquik' importada correctamente")
    expect(importText).toContain('Endpoints: 1')
    expect(importText).toContain('Schemas: 2')
    expect(importText).toContain('Tweets: 1 endpoints')

    const detailResult = await ctx.client.callTool({
      name: 'api_endpoint_detail',
      arguments: {
        name: 'xquik',
        method: 'GET',
        path: '/api/v1/x/tweets/search',
      },
    })

    expect(detailResult.isError).toBeFalsy()
    const detailText = (detailResult.content as Array<{ type: string; text: string }>)[0].text
    expect(detailText).toContain('GET /api/v1/x/tweets/search')
    expect(detailText).toContain(
      'Search tweets by query, Tweet ID, X status URL, or account date window',
    )
    expect(detailText).toContain('q')
    expect(detailText).toContain('limit')
    expect(detailText).toContain('next_cursor')
  })

  it('api_import rechaza documento que no es OpenAPI', async () => {
    const badFile = join(ctx.tempDir, 'bad-spec.json')
    await writeFile(badFile, JSON.stringify({ foo: 'bar' }), 'utf-8')

    const result = await ctx.client.callTool({
      name: 'api_import',
      arguments: {
        name: 'bad',
        source: badFile,
      },
    })

    expect(result.isError).toBe(true)
    const text = (result.content as Array<{ type: string; text: string }>)[0].text
    expect(text).toContain('no parece ser un spec OpenAPI')
  })

  it('api_endpoints lista todos los endpoints', async () => {
    const result = await ctx.client.callTool({
      name: 'api_endpoints',
      arguments: { name: 'test-api' },
    })

    expect(result.isError).toBeFalsy()
    const text = (result.content as Array<{ type: string; text: string }>)[0].text
    expect(text).toContain('4 endpoints')
    expect(text).toContain('GET')
    expect(text).toContain('POST')
    expect(text).toContain('/users')
    expect(text).toContain('/auth/login')
  })

  it('api_endpoints filtra por tag', async () => {
    const result = await ctx.client.callTool({
      name: 'api_endpoints',
      arguments: { name: 'test-api', tag: 'auth' },
    })

    const text = (result.content as Array<{ type: string; text: string }>)[0].text
    expect(text).toContain('1 endpoints')
    expect(text).toContain('/auth/login')
    expect(text).not.toContain('/users')
  })

  it('api_endpoints filtra por método', async () => {
    const result = await ctx.client.callTool({
      name: 'api_endpoints',
      arguments: { name: 'test-api', method: 'POST' },
    })

    const text = (result.content as Array<{ type: string; text: string }>)[0].text
    expect(text).toContain('2 endpoints')
    expect(text).toContain('/users')
    expect(text).toContain('/auth/login')
  })

  it('api_endpoints filtra por path parcial', async () => {
    const result = await ctx.client.callTool({
      name: 'api_endpoints',
      arguments: { name: 'test-api', path: '/auth' },
    })

    const text = (result.content as Array<{ type: string; text: string }>)[0].text
    expect(text).toContain('1 endpoints')
    expect(text).toContain('/auth/login')
  })

  it('api_endpoints retorna error si API no existe', async () => {
    const result = await ctx.client.callTool({
      name: 'api_endpoints',
      arguments: { name: 'no-existe' },
    })

    expect(result.isError).toBe(true)
    const text = (result.content as Array<{ type: string; text: string }>)[0].text
    expect(text).toContain('no encontrada')
  })

  it('api_endpoint_detail muestra detalle con body schema', async () => {
    const result = await ctx.client.callTool({
      name: 'api_endpoint_detail',
      arguments: {
        name: 'test-api',
        method: 'POST',
        path: '/users',
      },
    })

    expect(result.isError).toBeFalsy()
    const text = (result.content as Array<{ type: string; text: string }>)[0].text
    expect(text).toContain('POST /users')
    expect(text).toContain('Crear usuario')
    expect(text).toContain('Body')
    expect(text).toContain('"email"')
    expect(text).toContain('"name"')
    expect(text).toContain('"password"')
  })

  it('api_endpoint_detail muestra parámetros', async () => {
    const result = await ctx.client.callTool({
      name: 'api_endpoint_detail',
      arguments: {
        name: 'test-api',
        method: 'GET',
        path: '/users',
      },
    })

    expect(result.isError).toBeFalsy()
    const text = (result.content as Array<{ type: string; text: string }>)[0].text
    expect(text).toContain('Parámetros')
    expect(text).toContain('page')
    expect(text).toContain('query')
  })

  it('api_endpoint_detail hereda parámetros definidos en el path', async () => {
    const result = await ctx.client.callTool({
      name: 'api_endpoint_detail',
      arguments: {
        name: 'test-api',
        method: 'GET',
        path: '/users/{id}',
      },
    })

    expect(result.isError).toBeFalsy()
    const text = (result.content as Array<{ type: string; text: string }>)[0].text
    expect(text).toContain('Parámetros')
    expect(text).toContain('id')
    expect(text).toContain('path')
    expect(text).toContain('ID del usuario')
  })

  it('api_endpoint_detail sugiere endpoints similares si no existe', async () => {
    const result = await ctx.client.callTool({
      name: 'api_endpoint_detail',
      arguments: {
        name: 'test-api',
        method: 'DELETE',
        path: '/users',
      },
    })

    expect(result.isError).toBe(true)
    const text = (result.content as Array<{ type: string; text: string }>)[0].text
    expect(text).toContain('no encontrado')
    expect(text).toContain('similares')
  })
})
