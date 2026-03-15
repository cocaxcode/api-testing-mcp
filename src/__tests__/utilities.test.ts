import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { readFile, rm, mkdir, writeFile } from 'node:fs/promises'
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

  // ── export_collection (native) ──

  it('export_collection exporta requests en formato nativo', async () => {
    const result = await ctx.client.callTool({
      name: 'export_collection',
      arguments: { output_dir: postmanDir },
    })
    const text = (result.content as Array<{ text: string }>)[0].text
    expect(text).toContain('Colección exportada: 2 requests')

    const filePath = join(postmanDir, 'collection.json')
    const raw = await readFile(filePath, 'utf-8')
    const bundle = JSON.parse(raw)
    expect(bundle._format).toBe('api-testing-mcp')
    expect(bundle.requests).toHaveLength(2)
    expect(bundle.requests[0].name).toBeDefined()
    expect(bundle.requests[0].request).toBeDefined()
  })

  it('export_collection filtra por tag', async () => {
    // Save one with different tag
    await ctx.client.callTool({
      name: 'collection_save',
      arguments: {
        name: 'other-request',
        request: { method: 'GET', url: 'https://httpbin.org/get' },
        tags: ['other'],
      },
    })

    const exportDir = join(postmanDir, 'filtered')
    const result = await ctx.client.callTool({
      name: 'export_collection',
      arguments: { output_dir: exportDir, tag: 'test' },
    })
    const text = (result.content as Array<{ text: string }>)[0].text
    expect(text).toContain('2 requests')

    const filePath = join(exportDir, 'collection.json')
    const raw = await readFile(filePath, 'utf-8')
    const bundle = JSON.parse(raw)
    expect(bundle.requests).toHaveLength(2)
  })

  // ── import_collection (native) ──

  it('import_collection importa requests desde formato nativo', async () => {
    // Create a native export file
    const bundle = {
      _format: 'api-testing-mcp',
      exportedAt: new Date().toISOString(),
      count: 1,
      requests: [
        {
          name: 'imported-native',
          request: { method: 'GET', url: 'https://example.com/api' },
          tags: ['imported'],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    }
    const importFile = join(postmanDir, 'to-import.json')
    await mkdir(postmanDir, { recursive: true })
    await writeFile(importFile, JSON.stringify(bundle), 'utf-8')

    const result = await ctx.client.callTool({
      name: 'import_collection',
      arguments: { file: importFile },
    })
    const text = (result.content as Array<{ text: string }>)[0].text
    expect(text).toContain('1 requests guardados')

    // Verify it was saved
    const get = await ctx.client.callTool({
      name: 'collection_get',
      arguments: { name: 'imported-native' },
    })
    const getText = (get.content as Array<{ text: string }>)[0].text
    expect(getText).toContain('imported-native')
  })

  it('import_collection rechaza formato inválido', async () => {
    const badFile = join(postmanDir, 'bad.json')
    await writeFile(badFile, JSON.stringify({ foo: 'bar' }), 'utf-8')

    const result = await ctx.client.callTool({
      name: 'import_collection',
      arguments: { file: badFile },
    })
    expect(result.isError).toBe(true)
    const text = (result.content as Array<{ text: string }>)[0].text
    expect(text).toContain('no es un export nativo válido')
  })

  it('import_collection no sobreescribe sin overwrite', async () => {
    const bundle = {
      _format: 'api-testing-mcp',
      exportedAt: new Date().toISOString(),
      count: 1,
      requests: [
        {
          name: 'test-get',
          request: { method: 'PUT', url: 'https://example.com/replaced' },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    }
    const importFile = join(postmanDir, 'no-overwrite.json')
    await writeFile(importFile, JSON.stringify(bundle), 'utf-8')

    const result = await ctx.client.callTool({
      name: 'import_collection',
      arguments: { file: importFile },
    })
    const text = (result.content as Array<{ text: string }>)[0].text
    expect(text).toContain('1 requests omitidos')
  })

  // ── export_environment (native) ──

  it('export_environment exporta entorno en formato nativo', async () => {
    // Create an environment
    await ctx.client.callTool({
      name: 'env_create',
      arguments: { name: 'native-env', variables: { BASE_URL: 'http://localhost:3000', API_KEY: 'secret' } },
    })

    const result = await ctx.client.callTool({
      name: 'export_environment',
      arguments: { name: 'native-env', output_dir: postmanDir },
    })
    const text = (result.content as Array<{ text: string }>)[0].text
    expect(text).toContain('native-env')
    expect(text).toContain('2 variables')

    const filePath = join(postmanDir, 'native-env.env.json')
    const raw = await readFile(filePath, 'utf-8')
    const bundle = JSON.parse(raw)
    expect(bundle._format).toBe('api-testing-mcp')
    expect(bundle.environment.name).toBe('native-env')
    expect(bundle.environment.variables.BASE_URL).toBe('http://localhost:3000')
  })

  it('export_environment falla sin entorno activo ni nombre', async () => {
    // Use a fresh client with no active env
    const freshCtx = await createTestClient()
    const result = await freshCtx.client.callTool({
      name: 'export_environment',
      arguments: {},
    })
    expect(result.isError).toBe(true)
    const text = (result.content as Array<{ text: string }>)[0].text
    expect(text).toContain('No hay entorno activo')
    await freshCtx.cleanup()
  })

  // ── import_environment (native) ──

  it('import_environment importa entorno desde formato nativo', async () => {
    const bundle = {
      _format: 'api-testing-mcp',
      exportedAt: new Date().toISOString(),
      environment: {
        name: 'from-native',
        variables: { HOST: 'prod.example.com', TOKEN: 'abc123' },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    }
    const importFile = join(postmanDir, 'env-import.json')
    await writeFile(importFile, JSON.stringify(bundle), 'utf-8')

    const result = await ctx.client.callTool({
      name: 'import_environment',
      arguments: { file: importFile, activate: true },
    })
    const text = (result.content as Array<{ text: string }>)[0].text
    expect(text).toContain('from-native')
    expect(text).toContain('2 variables')
    expect(text).toContain('activado')
  })

  it('import_environment rechaza formato inválido', async () => {
    const badFile = join(postmanDir, 'bad-env.json')
    await writeFile(badFile, JSON.stringify({ values: [] }), 'utf-8')

    const result = await ctx.client.callTool({
      name: 'import_environment',
      arguments: { file: badFile },
    })
    expect(result.isError).toBe(true)
    const text = (result.content as Array<{ text: string }>)[0].text
    expect(text).toContain('formato no válido')
  })

  it('import_environment no sobreescribe sin overwrite', async () => {
    const bundle = {
      _format: 'api-testing-mcp',
      exportedAt: new Date().toISOString(),
      environment: {
        name: 'native-env',
        variables: { REPLACED: 'true' },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    }
    const importFile = join(postmanDir, 'no-overwrite-env.json')
    await writeFile(importFile, JSON.stringify(bundle), 'utf-8')

    const result = await ctx.client.callTool({
      name: 'import_environment',
      arguments: { file: importFile },
    })
    expect(result.isError).toBe(true)
    const text = (result.content as Array<{ text: string }>)[0].text
    expect(text).toContain('ya existe')
  })

  // ── export_postman_collection ──

  it('export_postman_collection genera archivo JSON válido', async () => {
    const result = await ctx.client.callTool({
      name: 'export_postman_collection',
      arguments: { name: 'Mi API Tests', output_dir: postmanDir },
    })

    expect(result.isError).toBeFalsy()
    const text = (result.content as Array<{ type: string; text: string }>)[0].text
    expect(text).toContain('requests)')
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
    const freshCtx = await createTestClient()
    const result = await freshCtx.client.callTool({
      name: 'export_postman_environment',
      arguments: { output_dir: postmanDir },
    })

    expect(result.isError).toBe(true)
    const text = (result.content as Array<{ type: string; text: string }>)[0].text
    expect(text).toContain('No hay entorno activo')
    await freshCtx.cleanup()
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

  // ── import_postman_collection ──

  it('import_postman_collection importa requests con folders como tags', async () => {
    const collection = {
      info: { name: 'My API', schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json' },
      item: [
        {
          name: 'Users',
          item: [
            {
              name: 'Get Users',
              request: {
                method: 'GET',
                url: { raw: 'https://api.example.com/users', protocol: 'https', host: ['api', 'example', 'com'], path: ['users'] },
                header: [{ key: 'Accept', value: 'application/json' }],
              },
            },
            {
              name: 'Create User',
              request: {
                method: 'POST',
                url: 'https://api.example.com/users',
                header: [{ key: 'Content-Type', value: 'application/json' }],
                body: { mode: 'raw', raw: '{"name":"John","email":"john@example.com"}' },
              },
            },
          ],
        },
        {
          name: 'Health Check',
          request: {
            method: 'GET',
            url: 'https://api.example.com/health',
          },
        },
      ],
    }

    const filePath = join(postmanDir, 'import-test.json')
    await mkdir(postmanDir, { recursive: true })
    await writeFile(filePath, JSON.stringify(collection), 'utf-8')

    const result = await ctx.client.callTool({
      name: 'import_postman_collection',
      arguments: { file: filePath },
    })

    expect(result.isError).toBeFalsy()
    const text = (result.content as Array<{ type: string; text: string }>)[0].text
    expect(text).toContain('3 requests guardados')
    expect(text).toContain('My API')

    // Verify imported requests exist
    const getUsers = await ctx.client.callTool({
      name: 'collection_get',
      arguments: { name: 'Get Users' },
    })
    expect(getUsers.isError).toBeFalsy()
    const getUsersText = (getUsers.content as Array<{ type: string; text: string }>)[0].text
    expect(getUsersText).toContain('GET')
    expect(getUsersText).toContain('api.example.com/users')
    expect(getUsersText).toContain('Users')
  })

  it('import_postman_collection importa auth bearer', async () => {
    const collection = {
      info: { name: 'Auth API' },
      item: [
        {
          name: 'Secured Endpoint',
          request: {
            method: 'GET',
            url: 'https://api.example.com/secure',
            auth: {
              type: 'bearer',
              bearer: [{ key: 'token', value: 'my-secret-token', type: 'string' }],
            },
          },
        },
      ],
    }

    const filePath = join(postmanDir, 'import-auth.json')
    await writeFile(filePath, JSON.stringify(collection), 'utf-8')

    const result = await ctx.client.callTool({
      name: 'import_postman_collection',
      arguments: { file: filePath },
    })

    expect(result.isError).toBeFalsy()

    const secured = await ctx.client.callTool({
      name: 'collection_get',
      arguments: { name: 'Secured Endpoint' },
    })
    const text = (secured.content as Array<{ type: string; text: string }>)[0].text
    expect(text).toContain('bearer')
    expect(text).toContain('my-secret-token')
  })

  it('import_postman_collection aplica extra tag', async () => {
    const collection = {
      info: { name: 'Tagged' },
      item: [
        {
          name: 'Tagged Request',
          request: { method: 'GET', url: 'https://api.example.com/tagged' },
        },
      ],
    }

    const filePath = join(postmanDir, 'import-tagged.json')
    await writeFile(filePath, JSON.stringify(collection), 'utf-8')

    const result = await ctx.client.callTool({
      name: 'import_postman_collection',
      arguments: { file: filePath, tag: 'imported' },
    })

    expect(result.isError).toBeFalsy()

    const tagged = await ctx.client.callTool({
      name: 'collection_get',
      arguments: { name: 'Tagged Request' },
    })
    const text = (tagged.content as Array<{ type: string; text: string }>)[0].text
    expect(text).toContain('imported')
  })

  it('import_postman_collection no sobreescribe por defecto', async () => {
    // Save a request first
    await ctx.client.callTool({
      name: 'collection_save',
      arguments: {
        name: 'Existing Request',
        request: { method: 'GET', url: 'https://original.com' },
      },
    })

    const collection = {
      info: { name: 'Overwrite Test' },
      item: [
        {
          name: 'Existing Request',
          request: { method: 'POST', url: 'https://new.com' },
        },
      ],
    }

    const filePath = join(postmanDir, 'import-overwrite.json')
    await writeFile(filePath, JSON.stringify(collection), 'utf-8')

    const result = await ctx.client.callTool({
      name: 'import_postman_collection',
      arguments: { file: filePath },
    })

    expect(result.isError).toBeFalsy()
    const text = (result.content as Array<{ type: string; text: string }>)[0].text
    expect(text).toContain('0 requests guardados')
    expect(text).toContain('1 requests omitidos')
  })

  it('import_postman_collection con overwrite sobreescribe', async () => {
    const collection = {
      info: { name: 'Overwrite' },
      item: [
        {
          name: 'Existing Request',
          request: { method: 'PUT', url: 'https://overwritten.com' },
        },
      ],
    }

    const filePath = join(postmanDir, 'import-overwrite2.json')
    await writeFile(filePath, JSON.stringify(collection), 'utf-8')

    const result = await ctx.client.callTool({
      name: 'import_postman_collection',
      arguments: { file: filePath, overwrite: true },
    })

    expect(result.isError).toBeFalsy()
    const text = (result.content as Array<{ type: string; text: string }>)[0].text
    expect(text).toContain('1 requests guardados')

    const req = await ctx.client.callTool({
      name: 'collection_get',
      arguments: { name: 'Existing Request' },
    })
    const reqText = (req.content as Array<{ type: string; text: string }>)[0].text
    expect(reqText).toContain('PUT')
    expect(reqText).toContain('overwritten.com')
  })

  it('import_postman_collection rechaza archivo sin items', async () => {
    const filePath = join(postmanDir, 'import-invalid.json')
    await writeFile(filePath, JSON.stringify({ info: { name: 'Bad' } }), 'utf-8')

    const result = await ctx.client.callTool({
      name: 'import_postman_collection',
      arguments: { file: filePath },
    })

    expect(result.isError).toBe(true)
    const text = (result.content as Array<{ type: string; text: string }>)[0].text
    expect(text).toContain('no parece ser una Postman Collection')
  })

  it('import_postman_collection importa query params', async () => {
    const collection = {
      info: { name: 'Query' },
      item: [
        {
          name: 'With Query',
          request: {
            method: 'GET',
            url: {
              raw: 'https://api.example.com/search?q=test&limit=10',
              protocol: 'https',
              host: ['api', 'example', 'com'],
              path: ['search'],
              query: [
                { key: 'q', value: 'test' },
                { key: 'limit', value: '10' },
              ],
            },
          },
        },
      ],
    }

    const filePath = join(postmanDir, 'import-query.json')
    await writeFile(filePath, JSON.stringify(collection), 'utf-8')

    const result = await ctx.client.callTool({
      name: 'import_postman_collection',
      arguments: { file: filePath },
    })

    expect(result.isError).toBeFalsy()

    const req = await ctx.client.callTool({
      name: 'collection_get',
      arguments: { name: 'With Query' },
    })
    const text = (req.content as Array<{ type: string; text: string }>)[0].text
    expect(text).toContain('q')
    expect(text).toContain('test')
  })

  // ── import_postman_environment ──

  it('import_postman_environment importa variables correctamente', async () => {
    const postmanEnv = {
      name: 'Production',
      values: [
        { key: 'BASE_URL', value: 'https://api.prod.com', enabled: true },
        { key: 'TOKEN', value: 'prod-token-123', enabled: true },
        { key: 'DISABLED', value: 'skip-me', enabled: false },
      ],
      _postman_variable_scope: 'environment',
    }

    const filePath = join(postmanDir, 'import-env.json')
    await mkdir(postmanDir, { recursive: true })
    await writeFile(filePath, JSON.stringify(postmanEnv), 'utf-8')

    const result = await ctx.client.callTool({
      name: 'import_postman_environment',
      arguments: { file: filePath },
    })

    expect(result.isError).toBeFalsy()
    const text = (result.content as Array<{ type: string; text: string }>)[0].text
    expect(text).toContain('Production')
    expect(text).toContain('2 variables')

    // Verify environment was created
    const envResult = await ctx.client.callTool({
      name: 'env_get',
      arguments: { environment: 'Production' },
    })
    const envText = (envResult.content as Array<{ type: string; text: string }>)[0].text
    expect(envText).toContain('BASE_URL')
    expect(envText).toContain('api.prod.com')
    expect(envText).not.toContain('DISABLED')
  })

  it('import_postman_environment usa nombre personalizado', async () => {
    const postmanEnv = {
      name: 'Original Name',
      values: [{ key: 'FOO', value: 'bar', enabled: true }],
    }

    const filePath = join(postmanDir, 'import-env-rename.json')
    await writeFile(filePath, JSON.stringify(postmanEnv), 'utf-8')

    const result = await ctx.client.callTool({
      name: 'import_postman_environment',
      arguments: { file: filePath, name: 'custom-name' },
    })

    expect(result.isError).toBeFalsy()
    const text = (result.content as Array<{ type: string; text: string }>)[0].text
    expect(text).toContain('custom-name')
  })

  it('import_postman_environment rechaza si ya existe sin overwrite', async () => {
    await ctx.client.callTool({
      name: 'env_create',
      arguments: { name: 'existing-env', variables: { X: '1' } },
    })

    const postmanEnv = {
      name: 'existing-env',
      values: [{ key: 'Y', value: '2', enabled: true }],
    }

    const filePath = join(postmanDir, 'import-env-exists.json')
    await writeFile(filePath, JSON.stringify(postmanEnv), 'utf-8')

    const result = await ctx.client.callTool({
      name: 'import_postman_environment',
      arguments: { file: filePath },
    })

    expect(result.isError).toBe(true)
    const text = (result.content as Array<{ type: string; text: string }>)[0].text
    expect(text).toContain('Ya existe')
  })

  it('import_postman_environment con overwrite sobreescribe', async () => {
    const postmanEnv = {
      name: 'existing-env',
      values: [{ key: 'NEW_VAR', value: 'new', enabled: true }],
    }

    const filePath = join(postmanDir, 'import-env-overwrite.json')
    await writeFile(filePath, JSON.stringify(postmanEnv), 'utf-8')

    const result = await ctx.client.callTool({
      name: 'import_postman_environment',
      arguments: { file: filePath, overwrite: true },
    })

    expect(result.isError).toBeFalsy()
    const text = (result.content as Array<{ type: string; text: string }>)[0].text
    expect(text).toContain('1 variables')
  })

  it('import_postman_environment activa el entorno si se pide', async () => {
    const postmanEnv = {
      name: 'auto-active',
      values: [{ key: 'KEY', value: 'val', enabled: true }],
    }

    const filePath = join(postmanDir, 'import-env-activate.json')
    await writeFile(filePath, JSON.stringify(postmanEnv), 'utf-8')

    const result = await ctx.client.callTool({
      name: 'import_postman_environment',
      arguments: { file: filePath, activate: true },
    })

    expect(result.isError).toBeFalsy()
    const text = (result.content as Array<{ type: string; text: string }>)[0].text
    expect(text).toContain('Entorno activado')
  })

  it('import_postman_environment rechaza archivo sin values', async () => {
    const filePath = join(postmanDir, 'import-env-invalid.json')
    await writeFile(filePath, JSON.stringify({ name: 'Bad' }), 'utf-8')

    const result = await ctx.client.callTool({
      name: 'import_postman_environment',
      arguments: { file: filePath },
    })

    expect(result.isError).toBe(true)
    const text = (result.content as Array<{ type: string; text: string }>)[0].text
    expect(text).toContain('no parece ser un Postman Environment')
  })

  it('import_postman_environment prefiere currentValue sobre value', async () => {
    const postmanEnv = {
      name: 'current-val-test',
      values: [
        { key: 'API_KEY', value: 'initial', currentValue: 'current-secret', enabled: true },
      ],
    }

    const filePath = join(postmanDir, 'import-env-current.json')
    await writeFile(filePath, JSON.stringify(postmanEnv), 'utf-8')

    const result = await ctx.client.callTool({
      name: 'import_postman_environment',
      arguments: { file: filePath },
    })

    expect(result.isError).toBeFalsy()

    const envResult = await ctx.client.callTool({
      name: 'env_get',
      arguments: { environment: 'current-val-test' },
    })
    const text = (envResult.content as Array<{ type: string; text: string }>)[0].text
    expect(text).toContain('current-secret')
    expect(text).not.toContain('initial')
  })
})
