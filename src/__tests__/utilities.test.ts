import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createTestClient, type TestContext } from './helpers.js'
import { installMockFetch, restoreFetch } from './mock-fetch.js'

describe('utility tools', () => {
  let ctx: TestContext
  let postmanDir: string

  beforeAll(async () => {
    installMockFetch()
    ctx = await createTestClient()
    postmanDir = join(tmpdir(), `postman-test-${Date.now()}`)

    // Save a collection item for export_curl and bulk_test
    await ctx.client.callTool({
      name: 'collection_save',
      arguments: {
        name: 'test-get',
        request: { method: 'GET', url: 'https://httpbin.org/get' },
        tags: ['test'],
      },
    })

    await ctx.client.callTool({
      name: 'collection_save',
      arguments: {
        name: 'test-post',
        request: {
          method: 'POST',
          url: 'https://httpbin.org/post',
          body: { name: 'test' },
        },
        tags: ['test'],
      },
    })
  })

  afterAll(async () => {
    await ctx.cleanup()
    await rm(postmanDir, { recursive: true, force: true })
    restoreFetch()
  })

  // ── export_curl ──

  it('export_curl genera comando cURL válido para GET', async () => {
    const result = await ctx.client.callTool({
      name: 'export_curl',
      arguments: { name: 'test-get' },
    })

    expect(result.isError).toBeFalsy()
    const text = (result.content as Array<{ type: string; text: string }>)[0].text
    expect(text).toContain('curl')
    expect(text).toContain('httpbin.org/get')
  })

  it('export_curl genera cURL con body para POST', async () => {
    const result = await ctx.client.callTool({
      name: 'export_curl',
      arguments: { name: 'test-post' },
    })

    expect(result.isError).toBeFalsy()
    const text = (result.content as Array<{ type: string; text: string }>)[0].text
    expect(text).toContain('-X POST')
    expect(text).toContain('-d')
    expect(text).toContain('Content-Type: application/json')
  })

  it('export_curl retorna error si request no existe', async () => {
    const result = await ctx.client.callTool({
      name: 'export_curl',
      arguments: { name: 'no-existe' },
    })

    expect(result.isError).toBe(true)
  })

  // ── diff_responses ──

  it('diff_responses compara dos requests', async () => {
    const result = await ctx.client.callTool({
      name: 'diff_responses',
      arguments: {
        request_a: {
          label: 'endpoint-1',
          method: 'GET',
          url: 'https://httpbin.org/get',
        },
        request_b: {
          label: 'endpoint-2',
          method: 'GET',
          url: 'https://httpbin.org/get',
        },
      },
    })

    expect(result.isError).toBeFalsy()
    const text = (result.content as Array<{ type: string; text: string }>)[0].text
    expect(text).toContain('endpoint-1')
    expect(text).toContain('endpoint-2')
  })

  // ── bulk_test ──

  it('bulk_test ejecuta todos los requests de la colección', async () => {
    const result = await ctx.client.callTool({
      name: 'bulk_test',
      arguments: { tag: 'test' },
    })

    const text = (result.content as Array<{ type: string; text: string }>)[0].text
    expect(text).toContain('BULK TEST')
    expect(text).toContain('test-get')
    expect(text).toContain('test-post')
  })

  it('bulk_test reporta colección vacía', async () => {
    const result = await ctx.client.callTool({
      name: 'bulk_test',
      arguments: { tag: 'no-existe' },
    })

    expect(result.isError).toBeFalsy()
    const text = (result.content as Array<{ type: string; text: string }>)[0].text
    expect(text).toContain('No hay requests')
  })

  // ── export_postman_collection ──

  it('export_postman_collection genera archivo JSON válido', async () => {
    const result = await ctx.client.callTool({
      name: 'export_postman_collection',
      arguments: { name: 'Mi API Tests', output_dir: postmanDir },
    })

    expect(result.isError).toBeFalsy()
    const text = (result.content as Array<{ type: string; text: string }>)[0].text
    expect(text).toContain('2 requests')
    expect(text).toContain('Archivo:')

    // Verify file was written
    const filePath = join(postmanDir, 'mi-api-tests.postman_collection.json')
    const fileContent = await readFile(filePath, 'utf-8')
    const collection = JSON.parse(fileContent)

    expect(collection.info.name).toBe('Mi API Tests')
    expect(collection.info.schema).toContain('v2.1.0')
  })

  it('export_postman_collection filtra por tag', async () => {
    await ctx.client.callTool({
      name: 'collection_save',
      arguments: {
        name: 'no-tag-request',
        request: { method: 'GET', url: 'https://httpbin.org/status/200' },
        tags: ['other'],
      },
    })

    const result = await ctx.client.callTool({
      name: 'export_postman_collection',
      arguments: { tag: 'test', output_dir: postmanDir },
    })

    expect(result.isError).toBeFalsy()
    const text = (result.content as Array<{ type: string; text: string }>)[0].text
    expect(text).toContain('2 requests')
  })

  it('export_postman_collection incluye body y método en items', async () => {
    const result = await ctx.client.callTool({
      name: 'export_postman_collection',
      arguments: { tag: 'test', output_dir: postmanDir },
    })

    const text = (result.content as Array<{ type: string; text: string }>)[0].text
    // Read the file to verify contents
    const filePath = join(postmanDir, 'api-testing-collection.postman_collection.json')
    const fileContent = await readFile(filePath, 'utf-8')
    const collection = JSON.parse(fileContent)

    const folder = collection.item[0]
    expect(folder.name).toBe('test')
    expect(folder.item.length).toBe(2)

    const postItem = folder.item.find((i: { name: string }) => i.name === 'test-post')
    expect(postItem.request.method).toBe('POST')
    expect(postItem.request.body.mode).toBe('raw')
    expect(postItem.request.body.options.raw.language).toBe('json')
  })

  it('export_postman_collection incluye auth bearer', async () => {
    await ctx.client.callTool({
      name: 'collection_save',
      arguments: {
        name: 'auth-request',
        request: {
          method: 'GET',
          url: 'https://httpbin.org/get',
          auth: { type: 'bearer', token: 'my-token-123' },
        },
        tags: ['auth'],
      },
    })

    const result = await ctx.client.callTool({
      name: 'export_postman_collection',
      arguments: { tag: 'auth', output_dir: postmanDir },
    })

    const filePath = join(postmanDir, 'api-testing-collection.postman_collection.json')
    const fileContent = await readFile(filePath, 'utf-8')
    const collection = JSON.parse(fileContent)

    const folder = collection.item[0]
    const req = folder.item[0].request
    expect(req.auth.type).toBe('bearer')
    expect(req.auth.bearer[0].value).toBe('my-token-123')
  })

  it('export_postman_collection retorna mensaje si no hay requests', async () => {
    const result = await ctx.client.callTool({
      name: 'export_postman_collection',
      arguments: { tag: 'inexistente', output_dir: postmanDir },
    })

    expect(result.isError).toBeFalsy()
    const text = (result.content as Array<{ type: string; text: string }>)[0].text
    expect(text).toContain('No hay requests')
  })

  it('export_postman_collection incluye URL parseada correctamente', async () => {
    await ctx.client.callTool({
      name: 'export_postman_collection',
      arguments: { tag: 'test', name: 'URL Test', output_dir: postmanDir },
    })

    const filePath = join(postmanDir, 'url-test.postman_collection.json')
    const fileContent = await readFile(filePath, 'utf-8')
    const collection = JSON.parse(fileContent)

    const folder = collection.item[0]
    const getItem = folder.item.find((i: { name: string }) => i.name === 'test-get')
    expect(getItem.request.url.protocol).toBe('https')
    expect(getItem.request.url.host).toContain('httpbin')
    expect(getItem.request.url.path).toContain('get')
  })

  // ── export_postman_environment ──

  it('export_postman_environment exporta archivo por nombre', async () => {
    await ctx.client.callTool({
      name: 'env_create',
      arguments: {
        name: 'postman-test',
        variables: { BASE_URL: 'https://api.example.com', TOKEN: 'abc123' },
      },
    })

    const result = await ctx.client.callTool({
      name: 'export_postman_environment',
      arguments: { name: 'postman-test', output_dir: postmanDir },
    })

    expect(result.isError).toBeFalsy()
    const text = (result.content as Array<{ type: string; text: string }>)[0].text
    expect(text).toContain('Postman Environment')
    expect(text).toContain('2 variables')
    expect(text).toContain('Archivo:')

    // Verify file was written
    const filePath = join(postmanDir, 'postman-test.postman_environment.json')
    const fileContent = await readFile(filePath, 'utf-8')
    const env = JSON.parse(fileContent)

    expect(env.name).toBe('postman-test')
    expect(env._postman_variable_scope).toBe('environment')
    expect(env.values).toHaveLength(2)

    const baseUrl = env.values.find((v: { key: string }) => v.key === 'BASE_URL')
    expect(baseUrl.value).toBe('https://api.example.com')
    expect(baseUrl.enabled).toBe(true)
  })

  it('export_postman_environment retorna error si no hay entorno activo', async () => {
    const result = await ctx.client.callTool({
      name: 'export_postman_environment',
      arguments: { output_dir: postmanDir },
    })

    expect(result.isError).toBe(true)
    const text = (result.content as Array<{ type: string; text: string }>)[0].text
    expect(text).toContain('No hay entorno activo')
  })

  it('export_postman_environment retorna error si entorno no existe', async () => {
    const result = await ctx.client.callTool({
      name: 'export_postman_environment',
      arguments: { name: 'no-existe', output_dir: postmanDir },
    })

    expect(result.isError).toBe(true)
    const text = (result.content as Array<{ type: string; text: string }>)[0].text
    expect(text).toContain('no encontrado')
  })

  it('export_postman_environment usa entorno activo por defecto', async () => {
    await ctx.client.callTool({
      name: 'env_create',
      arguments: {
        name: 'active-env',
        variables: { API_KEY: 'secret' },
      },
    })
    await ctx.client.callTool({
      name: 'env_switch',
      arguments: { name: 'active-env' },
    })

    const result = await ctx.client.callTool({
      name: 'export_postman_environment',
      arguments: { output_dir: postmanDir },
    })

    expect(result.isError).toBeFalsy()
    const text = (result.content as Array<{ type: string; text: string }>)[0].text
    expect(text).toContain('active-env')
    expect(text).toContain('1 variables')

    // Verify file exists
    const filePath = join(postmanDir, 'active-env.postman_environment.json')
    const fileContent = await readFile(filePath, 'utf-8')
    const env = JSON.parse(fileContent)
    expect(env.name).toBe('active-env')
  })
})
