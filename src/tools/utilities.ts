import { z } from 'zod'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { Storage } from '../lib/storage.js'
import { executeRequest } from '../lib/http-client.js'
import { interpolateRequest } from '../lib/interpolation.js'
import { resolveUrl } from '../lib/url.js'
import { AuthSchema } from '../lib/schemas.js'
import type { RequestConfig, AuthConfig, SavedRequest, HttpMethod } from '../lib/types.js'

export function registerUtilityTools(server: McpServer, storage: Storage): void {
  // ── export_curl ──

  server.tool(
    'export_curl',
    'Genera un comando cURL a partir de un request guardado en la colección. Listo para copiar y pegar.',
    {
      name: z.string().describe('Nombre del request guardado en la colección'),
      resolve_variables: z
        .boolean()
        .optional()
        .describe('Resolver {{variables}} del entorno activo (default: true)'),
    },
    async (params) => {
      try {
        const saved = await storage.getCollection(params.name)
        if (!saved) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `Error: Request '${params.name}' no encontrado en la colección.`,
              },
            ],
            isError: true,
          }
        }

        let config = saved.request
        const resolveVars = params.resolve_variables ?? true

        if (resolveVars) {
          const variables = await storage.getActiveVariables()
          const resolvedUrl = resolveUrl(config.url, variables)
          config = { ...config, url: resolvedUrl }
          config = interpolateRequest(config, variables)
        }

        // Build cURL command
        const parts: string[] = ['curl']

        if (config.method !== 'GET') {
          parts.push(`-X ${config.method}`)
        }

        let url = config.url
        if (config.query && Object.keys(config.query).length > 0) {
          const queryStr = Object.entries(config.query)
            .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
            .join('&')
          url += (url.includes('?') ? '&' : '?') + queryStr
        }
        parts.push(`'${url}'`)

        if (config.headers) {
          for (const [key, value] of Object.entries(config.headers)) {
            parts.push(`-H '${key}: ${value}'`)
          }
        }

        if (config.auth) {
          switch (config.auth.type) {
            case 'bearer':
              if (config.auth.token) {
                parts.push(`-H 'Authorization: Bearer ${config.auth.token}'`)
              }
              break
            case 'api-key':
              if (config.auth.key) {
                const header = config.auth.header ?? 'X-API-Key'
                parts.push(`-H '${header}: ${config.auth.key}'`)
              }
              break
            case 'basic':
              if (config.auth.username && config.auth.password) {
                parts.push(`-u '${config.auth.username}:${config.auth.password}'`)
              }
              break
          }
        }

        if (config.body !== undefined && config.body !== null) {
          const bodyStr =
            typeof config.body === 'string' ? config.body : JSON.stringify(config.body)
          parts.push(`-H 'Content-Type: application/json'`)
          parts.push(`-d '${bodyStr}'`)
        }

        const curlCommand = parts.join(' \\\n  ')

        return {
          content: [
            {
              type: 'text' as const,
              text: `cURL para '${params.name}':\n\n${curlCommand}`,
            },
          ],
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return {
          content: [{ type: 'text' as const, text: `Error: ${message}` }],
          isError: true,
        }
      }
    },
  )

  // ── diff_responses ──

  const DiffRequestSchema = z.object({
    label: z.string().optional().describe('Etiqueta (ej: "antes", "dev", "v1")'),
    method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']),
    url: z.string(),
    headers: z.record(z.string()).optional(),
    body: z.any().optional(),
    query: z.record(z.string()).optional(),
    auth: AuthSchema.optional(),
  })

  server.tool(
    'diff_responses',
    'Ejecuta dos requests y compara sus respuestas. Útil para detectar regresiones o comparar entornos.',
    {
      request_a: DiffRequestSchema.describe('Primer request'),
      request_b: DiffRequestSchema.describe('Segundo request'),
    },
    async (params) => {
      try {
        const variables = await storage.getActiveVariables()

        const executeOne = async (req: z.infer<typeof DiffRequestSchema>) => {
          const resolvedUrl = resolveUrl(req.url, variables)

          const config: RequestConfig = {
            method: req.method,
            url: resolvedUrl,
            headers: req.headers,
            body: req.body,
            query: req.query,
            auth: req.auth,
          }

          return executeRequest(interpolateRequest(config, variables))
        }

        const [responseA, responseB] = await Promise.all([
          executeOne(params.request_a),
          executeOne(params.request_b),
        ])

        const labelA = params.request_a.label ?? 'A'
        const labelB = params.request_b.label ?? 'B'

        const diffs: string[] = []

        if (responseA.status !== responseB.status) {
          diffs.push(
            `Status: ${labelA}=${responseA.status} vs ${labelB}=${responseB.status}`,
          )
        }

        const timingDiff = Math.abs(responseA.timing.total_ms - responseB.timing.total_ms)
        if (timingDiff > 100) {
          diffs.push(
            `Timing: ${labelA}=${responseA.timing.total_ms}ms vs ${labelB}=${responseB.timing.total_ms}ms (Δ${Math.round(timingDiff)}ms)`,
          )
        }

        const bodyA = JSON.stringify(responseA.body, null, 2)
        const bodyB = JSON.stringify(responseB.body, null, 2)

        if (bodyA !== bodyB) {
          diffs.push('Body: diferente')

          if (
            typeof responseA.body === 'object' &&
            typeof responseB.body === 'object' &&
            responseA.body &&
            responseB.body
          ) {
            const keysA = new Set(Object.keys(responseA.body as Record<string, unknown>))
            const keysB = new Set(Object.keys(responseB.body as Record<string, unknown>))

            const onlyInA = [...keysA].filter((k) => !keysB.has(k))
            const onlyInB = [...keysB].filter((k) => !keysA.has(k))
            const common = [...keysA].filter((k) => keysB.has(k))

            if (onlyInA.length > 0) diffs.push(`  Solo en ${labelA}: ${onlyInA.join(', ')}`)
            if (onlyInB.length > 0) diffs.push(`  Solo en ${labelB}: ${onlyInB.join(', ')}`)

            for (const key of common) {
              const valA = JSON.stringify(
                (responseA.body as Record<string, unknown>)[key],
              )
              const valB = JSON.stringify(
                (responseB.body as Record<string, unknown>)[key],
              )
              if (valA !== valB) {
                const shortA = valA.length > 50 ? valA.substring(0, 50) + '...' : valA
                const shortB = valB.length > 50 ? valB.substring(0, 50) + '...' : valB
                diffs.push(`  ${key}: ${labelA}=${shortA} vs ${labelB}=${shortB}`)
              }
            }
          }
        }

        const sizeDiff = Math.abs(responseA.size_bytes - responseB.size_bytes)
        if (sizeDiff > 0) {
          diffs.push(
            `Size: ${labelA}=${responseA.size_bytes}B vs ${labelB}=${responseB.size_bytes}B`,
          )
        }

        const identical = diffs.length === 0

        const lines: string[] = [
          identical ? '✅ IDÉNTICAS' : `⚠️ ${diffs.length} DIFERENCIAS ENCONTRADAS`,
          '',
          `${labelA}: ${params.request_a.method} ${params.request_a.url} → ${responseA.status} (${responseA.timing.total_ms}ms)`,
          `${labelB}: ${params.request_b.method} ${params.request_b.url} → ${responseB.status} (${responseB.timing.total_ms}ms)`,
        ]

        if (!identical) {
          lines.push('')
          lines.push('Diferencias:')
          for (const diff of diffs) {
            lines.push(`  ${diff}`)
          }
        }

        return {
          content: [{ type: 'text' as const, text: lines.join('\n') }],
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return {
          content: [{ type: 'text' as const, text: `Error: ${message}` }],
          isError: true,
        }
      }
    },
  )

  // ── bulk_test ──

  server.tool(
    'bulk_test',
    'Ejecuta todos los requests guardados en la colección y reporta resultados. Filtrable por tag.',
    {
      tag: z.string().optional().describe('Filtrar por tag'),
      expected_status: z
        .number()
        .optional()
        .describe('Status HTTP esperado para todos (default: cualquier 2xx)'),
    },
    async (params) => {
      try {
        const collections = await storage.listCollections(params.tag)
        if (collections.length === 0) {
          return {
            content: [
              {
                type: 'text' as const,
                text: params.tag
                  ? `No hay requests guardados con tag '${params.tag}'.`
                  : 'No hay requests guardados en la colección.',
              },
            ],
          }
        }

        const variables = await storage.getActiveVariables()
        const results: Array<{
          name: string
          method: string
          url: string
          status: number
          timing: number
          pass: boolean
          error?: string
        }> = []

        for (const item of collections) {
          const saved = await storage.getCollection(item.name)
          if (!saved) continue

          try {
            let config = saved.request
            const resolvedUrl = resolveUrl(config.url, variables)
            config = { ...config, url: resolvedUrl }
            const interpolated = interpolateRequest(config, variables)
            const response = await executeRequest(interpolated)

            const pass = params.expected_status
              ? response.status === params.expected_status
              : response.status >= 200 && response.status < 300

            results.push({
              name: item.name,
              method: config.method,
              url: item.url,
              status: response.status,
              timing: response.timing.total_ms,
              pass,
            })
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            results.push({
              name: item.name,
              method: item.method,
              url: item.url,
              status: 0,
              timing: 0,
              pass: false,
              error: message,
            })
          }
        }

        const passed = results.filter((r) => r.pass).length
        const failed = results.filter((r) => !r.pass).length
        const totalTime = Math.round(results.reduce((sum, r) => sum + r.timing, 0) * 100) / 100

        const lines: string[] = [
          `${failed === 0 ? '✅' : '❌'} BULK TEST — ${passed}/${results.length} passed | ${totalTime}ms total`,
          '',
        ]

        for (const r of results) {
          const icon = r.pass ? '✅' : '❌'
          if (r.error) {
            lines.push(`${icon} ${r.name} — ERROR: ${r.error}`)
          } else {
            lines.push(`${icon} ${r.name} — ${r.method} ${r.url} → ${r.status} (${r.timing}ms)`)
          }
        }

        return {
          content: [{ type: 'text' as const, text: lines.join('\n') }],
          isError: failed > 0,
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return {
          content: [{ type: 'text' as const, text: `Error: ${message}` }],
          isError: true,
        }
      }
    },
  )

  // ── export_postman_collection ──

  server.tool(
    'export_postman_collection',
    'Exporta los requests guardados como una Postman Collection v2.1 (JSON). Escribe el archivo en disco, importable directamente en Postman.',
    {
      name: z
        .string()
        .optional()
        .describe('Nombre de la colección (default: "API Testing Collection")'),
      tag: z.string().optional().describe('Filtrar requests por tag'),
      output_dir: z
        .string()
        .optional()
        .describe('Directorio donde guardar el archivo (default: ./postman/)'),
      resolve_variables: z
        .boolean()
        .optional()
        .describe('Resolver {{variables}} del entorno activo (default: false)'),
    },
    async (params) => {
      try {
        const collections = await storage.listCollections(params.tag)
        if (collections.length === 0) {
          return {
            content: [
              {
                type: 'text' as const,
                text: params.tag
                  ? `No hay requests guardados con tag '${params.tag}'.`
                  : 'No hay requests guardados en la colección.',
              },
            ],
          }
        }

        const resolveVars = params.resolve_variables ?? false
        const variables = resolveVars ? await storage.getActiveVariables() : {}

        // Load full requests
        const savedRequests: SavedRequest[] = []
        for (const item of collections) {
          const saved = await storage.getCollection(item.name)
          if (saved) savedRequests.push(saved)
        }

        // Group by tags for folder structure
        const tagged = new Map<string, SavedRequest[]>()
        const untagged: SavedRequest[] = []

        for (const saved of savedRequests) {
          if (saved.tags && saved.tags.length > 0) {
            const tag = saved.tags[0]
            if (!tagged.has(tag)) tagged.set(tag, [])
            tagged.get(tag)!.push(saved)
          } else {
            untagged.push(saved)
          }
        }

        // Build Postman items
        const items: unknown[] = []

        for (const [tag, requests] of tagged) {
          items.push({
            name: tag,
            item: requests.map((r) => buildPostmanItem(r, variables, resolveVars)),
          })
        }

        for (const saved of untagged) {
          items.push(buildPostmanItem(saved, variables, resolveVars))
        }

        // Include environment variables as collection variables
        const activeVars = await storage.getActiveVariables()
        const collectionVars = Object.entries(activeVars).map(([key, value]) => ({
          key,
          value,
          type: 'string',
        }))

        const collectionName = params.name ?? 'API Testing Collection'

        const postmanCollection = {
          info: {
            name: collectionName,
            schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
          },
          item: items,
          variable: collectionVars,
        }

        const json = JSON.stringify(postmanCollection, null, 2)

        // Write to file
        const outputDir = params.output_dir ?? join(process.cwd(), 'postman')
        await mkdir(outputDir, { recursive: true })
        const fileName = collectionName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '.postman_collection.json'
        const filePath = join(outputDir, fileName)
        await writeFile(filePath, json, 'utf-8')

        return {
          content: [
            {
              type: 'text' as const,
              text: `Postman Collection v2.1 exportada (${savedRequests.length} requests).\n\nArchivo: ${filePath}\n\nImporta este archivo en Postman: File → Import → selecciona el archivo.`,
            },
          ],
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return {
          content: [{ type: 'text' as const, text: `Error: ${message}` }],
          isError: true,
        }
      }
    },
  )

  // ── import_postman_collection ──

  server.tool(
    'import_postman_collection',
    'Importa una Postman Collection v2.1 (JSON) como requests guardados en la colección. Soporta folders, auth, headers, body y query params.',
    {
      file: z.string().describe('Ruta al archivo .postman_collection.json exportado de Postman'),
      tag: z
        .string()
        .optional()
        .describe('Tag adicional para aplicar a todos los requests importados'),
      overwrite: z
        .boolean()
        .optional()
        .describe('Sobreescribir requests existentes con el mismo nombre (default: false)'),
    },
    async (params) => {
      try {
        const raw = await readFile(params.file, 'utf-8')
        const collection = JSON.parse(raw)

        if (!collection.item || !Array.isArray(collection.item)) {
          return {
            content: [
              {
                type: 'text' as const,
                text: 'Error: El archivo no parece ser una Postman Collection válida. Falta la propiedad "item".',
              },
            ],
            isError: true,
          }
        }

        const overwrite = params.overwrite ?? false
        const extraTag = params.tag

        // Flatten items recursively (folders → items)
        const flatItems = flattenPostmanItems(collection.item, collection.auth)
        let imported = 0
        let skipped = 0
        const errors: string[] = []

        for (const item of flatItems) {
          try {
            const saved = parsePostmanItem(item, extraTag)
            if (!saved) continue

            if (!overwrite) {
              const existing = await storage.getCollection(saved.name)
              if (existing) {
                skipped++
                continue
              }
            }

            await storage.saveCollection(saved)
            imported++
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            errors.push(`${item.name ?? 'unknown'}: ${msg}`)
          }
        }

        const lines: string[] = [
          `Postman Collection importada: ${imported} requests guardados.`,
        ]
        if (skipped > 0) lines.push(`${skipped} requests omitidos (ya existían, usa overwrite: true para sobreescribir).`)
        if (errors.length > 0) {
          lines.push(`${errors.length} errores:`)
          for (const e of errors) lines.push(`  - ${e}`)
        }
        if (collection.info?.name) lines.push(`\nColección: ${collection.info.name}`)

        return {
          content: [{ type: 'text' as const, text: lines.join('\n') }],
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return {
          content: [{ type: 'text' as const, text: `Error: ${message}` }],
          isError: true,
        }
      }
    },
  )

  // ── import_postman_environment ──

  server.tool(
    'import_postman_environment',
    'Importa un Postman Environment (JSON) como entorno local. Soporta variables con valores initial/current.',
    {
      file: z.string().describe('Ruta al archivo .postman_environment.json exportado de Postman'),
      name: z
        .string()
        .optional()
        .describe('Nombre para el entorno (default: usa el nombre del archivo Postman)'),
      overwrite: z
        .boolean()
        .optional()
        .describe('Sobreescribir si ya existe un entorno con el mismo nombre (default: false)'),
      activate: z
        .boolean()
        .optional()
        .describe('Activar el entorno importado como entorno activo (default: false)'),
    },
    async (params) => {
      try {
        const raw = await readFile(params.file, 'utf-8')
        const postmanEnv = JSON.parse(raw)

        if (!postmanEnv.values || !Array.isArray(postmanEnv.values)) {
          return {
            content: [
              {
                type: 'text' as const,
                text: 'Error: El archivo no parece ser un Postman Environment válido. Falta la propiedad "values".',
              },
            ],
            isError: true,
          }
        }

        const envName = params.name ?? postmanEnv.name ?? 'postman-import'
        const overwrite = params.overwrite ?? false

        const existing = await storage.getEnvironment(envName)
        if (existing && !overwrite) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `Error: Ya existe un entorno '${envName}'. Usa overwrite: true para sobreescribir.`,
              },
            ],
            isError: true,
          }
        }

        // Parse variables — prefer currentValue over value (Postman v2.1 uses both)
        const variables: Record<string, string> = {}
        for (const v of postmanEnv.values) {
          if (!v.key) continue
          if (v.enabled === false) continue
          variables[v.key] = String(v.currentValue ?? v.value ?? '')
        }

        const now = new Date().toISOString()
        await storage.createEnvironment({
          name: envName,
          variables,
          createdAt: now,
          updatedAt: now,
        })

        if (params.activate) {
          await storage.setActiveEnvironment(envName)
        }

        const lines: string[] = [
          `Postman Environment "${envName}" importado (${Object.keys(variables).length} variables).`,
        ]
        if (params.activate) lines.push('Entorno activado como activo.')

        return {
          content: [{ type: 'text' as const, text: lines.join('\n') }],
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return {
          content: [{ type: 'text' as const, text: `Error: ${message}` }],
          isError: true,
        }
      }
    },
  )

  // ── export_postman_environment ──

  server.tool(
    'export_postman_environment',
    'Exporta un entorno como Postman Environment (JSON). Escribe el archivo en disco, importable directamente en Postman.',
    {
      name: z
        .string()
        .optional()
        .describe('Nombre del entorno a exportar (default: entorno activo)'),
      output_dir: z
        .string()
        .optional()
        .describe('Directorio donde guardar el archivo (default: ./postman/)'),
    },
    async (params) => {
      try {
        let envName = params.name
        if (!envName) {
          envName = (await storage.getActiveEnvironment()) ?? undefined
          if (!envName) {
            return {
              content: [
                {
                  type: 'text' as const,
                  text: 'No hay entorno activo. Especifica un nombre con el parámetro "name".',
                },
              ],
              isError: true,
            }
          }
        }

        const env = await storage.getEnvironment(envName)
        if (!env) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `Entorno '${envName}' no encontrado.`,
              },
            ],
            isError: true,
          }
        }

        const postmanEnv = {
          name: env.name,
          values: Object.entries(env.variables).map(([key, value]) => ({
            key,
            value,
            type: 'default',
            enabled: true,
          })),
          _postman_variable_scope: 'environment',
        }

        const json = JSON.stringify(postmanEnv, null, 2)

        // Write to file
        const outputDir = params.output_dir ?? join(process.cwd(), 'postman')
        await mkdir(outputDir, { recursive: true })
        const fileName = env.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '.postman_environment.json'
        const filePath = join(outputDir, fileName)
        await writeFile(filePath, json, 'utf-8')

        return {
          content: [
            {
              type: 'text' as const,
              text: `Postman Environment "${env.name}" exportado (${Object.keys(env.variables).length} variables).\n\nArchivo: ${filePath}\n\nImporta este archivo en Postman: File → Import → selecciona el archivo.`,
            },
          ],
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return {
          content: [{ type: 'text' as const, text: `Error: ${message}` }],
          isError: true,
        }
      }
    },
  )
}

// ── Postman helpers ──

function buildPostmanItem(
  saved: SavedRequest,
  variables: Record<string, string>,
  resolveVars: boolean,
): unknown {
  let config = saved.request
  if (resolveVars) {
    const resolvedUrl = resolveUrl(config.url, variables)
    config = { ...config, url: resolvedUrl }
    config = interpolateRequest(config, variables)
  }

  const item: Record<string, unknown> = {
    name: saved.name,
    request: buildPostmanRequest(config),
  }

  return item
}

function buildPostmanRequest(config: RequestConfig): unknown {
  const request: Record<string, unknown> = {
    method: config.method,
    header: buildPostmanHeaders(config.headers),
    url: buildPostmanUrl(config.url, config.query),
  }

  if (config.body !== undefined && config.body !== null) {
    request.body = {
      mode: 'raw',
      raw: typeof config.body === 'string' ? config.body : JSON.stringify(config.body, null, 2),
      options: { raw: { language: 'json' } },
    }
    // Add Content-Type header if not already present
    const headers = request.header as Array<{ key: string; value: string }>
    if (!headers.some((h) => h.key.toLowerCase() === 'content-type')) {
      headers.push({ key: 'Content-Type', value: 'application/json' })
    }
  }

  if (config.auth) {
    request.auth = buildPostmanAuth(config.auth)
  }

  return request
}

function buildPostmanHeaders(
  headers?: Record<string, string>,
): Array<{ key: string; value: string }> {
  if (!headers) return []
  return Object.entries(headers).map(([key, value]) => ({ key, value }))
}

function buildPostmanUrl(
  rawUrl: string,
  query?: Record<string, string>,
): Record<string, unknown> {
  const url: Record<string, unknown> = { raw: rawUrl }

  // Parse protocol, host, path
  const match = rawUrl.match(/^(https?):\/\/([^/]+)(\/.*)?$/)
  if (match) {
    url.protocol = match[1]
    url.host = match[2].split('.')
    url.path = match[3] ? match[3].slice(1).split('/') : []
  }

  if (query && Object.keys(query).length > 0) {
    url.query = Object.entries(query).map(([key, value]) => ({ key, value }))
    // Append query to raw URL
    const queryStr = Object.entries(query)
      .map(([k, v]) => `${k}=${v}`)
      .join('&')
    url.raw = rawUrl + (rawUrl.includes('?') ? '&' : '?') + queryStr
  }

  return url
}

function buildPostmanAuth(auth: AuthConfig): Record<string, unknown> {
  switch (auth.type) {
    case 'bearer':
      return {
        type: 'bearer',
        bearer: [{ key: 'token', value: auth.token ?? '', type: 'string' }],
      }
    case 'api-key':
      return {
        type: 'apikey',
        apikey: [
          { key: 'key', value: auth.key ?? '', type: 'string' },
          { key: 'value', value: auth.header ?? 'X-API-Key', type: 'string' },
          { key: 'in', value: 'header', type: 'string' },
        ],
      }
    case 'basic':
      return {
        type: 'basic',
        basic: [
          { key: 'username', value: auth.username ?? '', type: 'string' },
          { key: 'password', value: auth.password ?? '', type: 'string' },
        ],
      }
  }
}

// ── Postman import helpers ──

interface PostmanItem {
  name?: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  request?: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  item?: any[]
  _folderTags?: string[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _inheritedAuth?: any
}

/**
 * Flatten Postman collection items recursively.
 * Folders become tags; auth is inherited from parent.
 */
function flattenPostmanItems(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  items: any[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parentAuth?: any,
  parentTags: string[] = [],
): PostmanItem[] {
  const result: PostmanItem[] = []

  for (const item of items) {
    if (item.item && Array.isArray(item.item)) {
      // It's a folder — recurse
      const folderTags = item.name ? [...parentTags, item.name] : parentTags
      const folderAuth = item.auth ?? parentAuth
      result.push(...flattenPostmanItems(item.item, folderAuth, folderTags))
    } else if (item.request) {
      result.push({
        ...item,
        _folderTags: parentTags,
        _inheritedAuth: item.request?.auth ? undefined : parentAuth,
      })
    }
  }

  return result
}

const VALID_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'])

/**
 * Convert a Postman item to a SavedRequest.
 */
function parsePostmanItem(item: PostmanItem, extraTag?: string): SavedRequest | null {
  const req = item.request
  if (!req) return null

  // Method
  const method = (typeof req.method === 'string' ? req.method.toUpperCase() : 'GET') as HttpMethod
  if (!VALID_METHODS.has(method)) return null

  // URL
  const url = parsePostmanUrl(req.url)
  if (!url) return null

  // Headers
  const headers: Record<string, string> = {}
  if (Array.isArray(req.header)) {
    for (const h of req.header) {
      if (h.disabled) continue
      if (h.key && h.value !== undefined) {
        headers[h.key] = String(h.value)
      }
    }
  }

  // Query params
  const query: Record<string, string> = {}
  if (req.url && typeof req.url === 'object' && Array.isArray(req.url.query)) {
    for (const q of req.url.query) {
      if (q.disabled) continue
      if (q.key) {
        query[q.key] = String(q.value ?? '')
      }
    }
  }

  // Body
  let body: unknown = undefined
  if (req.body) {
    if (req.body.mode === 'raw' && typeof req.body.raw === 'string') {
      try {
        body = JSON.parse(req.body.raw)
      } catch {
        body = req.body.raw
      }
    } else if (req.body.mode === 'urlencoded' && Array.isArray(req.body.urlencoded)) {
      const formData: Record<string, string> = {}
      for (const p of req.body.urlencoded) {
        if (p.key) formData[p.key] = String(p.value ?? '')
      }
      body = formData
    } else if (req.body.mode === 'formdata' && Array.isArray(req.body.formdata)) {
      const formData: Record<string, string> = {}
      for (const p of req.body.formdata) {
        if (p.key && p.type !== 'file') formData[p.key] = String(p.value ?? '')
      }
      body = formData
    }
  }

  // Auth (from request or inherited from folder/collection)
  const authSource = req.auth ?? item._inheritedAuth
  const auth = parsePostmanAuth(authSource)

  // Tags from folder hierarchy + extra tag
  const tags: string[] = [...(item._folderTags ?? [])]
  if (extraTag && !tags.includes(extraTag)) tags.push(extraTag)

  // Build request name
  const name = item.name || `${method} ${url}`

  const now = new Date().toISOString()

  const config: RequestConfig = { method, url }
  if (Object.keys(headers).length > 0) config.headers = headers
  if (Object.keys(query).length > 0) config.query = query
  if (body !== undefined) config.body = body
  if (auth) config.auth = auth

  return {
    name,
    request: config,
    tags: tags.length > 0 ? tags : undefined,
    createdAt: now,
    updatedAt: now,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parsePostmanUrl(url: any): string | null {
  if (typeof url === 'string') return url || null
  if (url && typeof url === 'object') {
    if (typeof url.raw === 'string') return url.raw || null
    // Build from parts
    const protocol = url.protocol ?? 'https'
    const host = Array.isArray(url.host) ? url.host.join('.') : url.host
    const path = Array.isArray(url.path) ? url.path.join('/') : url.path ?? ''
    if (host) return `${protocol}://${host}${path ? '/' + path : ''}`
  }
  return null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parsePostmanAuth(auth: any): AuthConfig | undefined {
  if (!auth || !auth.type) return undefined

  // Helper to get value from Postman auth key-value arrays
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getVal = (arr: any[] | undefined, key: string): string | undefined => {
    if (!Array.isArray(arr)) return undefined
    const item = arr.find((a) => a.key === key)
    return item?.value ? String(item.value) : undefined
  }

  switch (auth.type) {
    case 'bearer': {
      const token = getVal(auth.bearer, 'token')
      return token ? { type: 'bearer', token } : undefined
    }
    case 'apikey': {
      const key = getVal(auth.apikey, 'key')
      const headerName = getVal(auth.apikey, 'value')
      return key ? { type: 'api-key', key, header: headerName } : undefined
    }
    case 'basic': {
      const username = getVal(auth.basic, 'username')
      const password = getVal(auth.basic, 'password')
      return username ? { type: 'basic', username, password } : undefined
    }
    default:
      return undefined
  }
}
