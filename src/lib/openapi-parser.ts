import type {
  HttpMethod,
  ApiSpecEndpoint,
  ApiSpecSchema,
  ApiSpec,
} from './types.js'

const VALID_METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']

/**
 * Resuelve $ref references en un schema OpenAPI.
 * Soporta refs tipo "#/components/schemas/MyModel".
 */
function resolveRef(
  ref: string,
  root: Record<string, unknown>,
): ApiSpecSchema | undefined {
  const parts = ref.replace(/^#\//, '').split('/')
  let current: unknown = root

  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = (current as Record<string, unknown>)[part]
    } else {
      return undefined
    }
  }

  return current as ApiSpecSchema
}

/**
 * Resuelve recursivamente todos los $ref en un schema.
 */
function resolveSchema(
  schema: ApiSpecSchema | undefined,
  root: Record<string, unknown>,
  depth = 0,
): ApiSpecSchema | undefined {
  if (!schema || depth > 10) return schema

  if (schema.$ref) {
    const resolved = resolveRef(schema.$ref, root)
    if (resolved) {
      return resolveSchema(resolved, root, depth + 1)
    }
    return { type: 'object', description: `Unresolved: ${schema.$ref}` }
  }

  const result: ApiSpecSchema = { ...schema }

  // Resolve allOf — merge all schemas into one
  const rawAllOf = (schema as Record<string, unknown>).allOf as ApiSpecSchema[] | undefined
  if (rawAllOf && Array.isArray(rawAllOf)) {
    const merged: ApiSpecSchema = { type: 'object' }
    const mergedProps: Record<string, ApiSpecSchema> = {}
    const mergedRequired: string[] = []

    for (const sub of rawAllOf) {
      const resolved = resolveSchema(sub, root, depth + 1)
      if (resolved?.properties) {
        Object.assign(mergedProps, resolved.properties)
      }
      if (resolved?.required) {
        mergedRequired.push(...resolved.required)
      }
      if (resolved?.description && !merged.description) {
        merged.description = resolved.description
      }
    }

    merged.properties = { ...(result.properties ?? {}), ...mergedProps }
    if (mergedRequired.length > 0) {
      merged.required = [...new Set([...(result.required ?? []), ...mergedRequired])]
    }

    return merged
  }

  // Resolve oneOf/anyOf — pick the first schema as representative
  const rawOneOf = (schema as Record<string, unknown>).oneOf as ApiSpecSchema[] | undefined
  const rawAnyOf = (schema as Record<string, unknown>).anyOf as ApiSpecSchema[] | undefined
  const unionSchemas = rawOneOf ?? rawAnyOf
  if (unionSchemas && Array.isArray(unionSchemas) && unionSchemas.length > 0) {
    return resolveSchema(unionSchemas[0], root, depth + 1)
  }

  // Resolve properties recursively
  if (result.properties) {
    const resolvedProps: Record<string, ApiSpecSchema> = {}
    for (const [key, prop] of Object.entries(result.properties)) {
      resolvedProps[key] = resolveSchema(prop, root, depth + 1) ?? prop
    }
    result.properties = resolvedProps
  }

  // Resolve array items
  if (result.items) {
    result.items = resolveSchema(result.items, root, depth + 1) ?? result.items
  }

  return result
}

/**
 * Parsea un documento OpenAPI 3.x y extrae endpoints y schemas.
 */
export function parseOpenApiSpec(
  doc: Record<string, unknown>,
  name: string,
  source: string,
): ApiSpec {
  const info = doc.info as Record<string, unknown> | undefined
  const paths = doc.paths as Record<string, Record<string, unknown>> | undefined
  const components = doc.components as Record<string, unknown> | undefined
  const rawSchemas = (components?.schemas ?? {}) as Record<string, ApiSpecSchema>

  // Extraer basePath de servers[].url (ej: "https://api.example.com/api/v1" → "/api/v1")
  const servers = doc.servers as Array<Record<string, unknown>> | undefined
  let basePath = ''
  if (servers && servers.length > 0 && typeof servers[0].url === 'string') {
    try {
      const serverUrl = new URL(servers[0].url)
      basePath = serverUrl.pathname.replace(/\/+$/, '') // quitar trailing slashes
    } catch {
      // Si no es una URL absoluta, podria ser un path relativo como "/api/v1"
      const rawUrl = servers[0].url as string
      if (rawUrl.startsWith('/')) {
        basePath = rawUrl.replace(/\/+$/, '')
      }
    }
  }

  // Resolve all schemas
  const schemas: Record<string, ApiSpecSchema> = {}
  for (const [schemaName, schema] of Object.entries(rawSchemas)) {
    schemas[schemaName] = resolveSchema(schema, doc, 0) ?? schema
  }

  const endpoints: ApiSpecEndpoint[] = []

  if (paths) {
    for (const [path, pathItem] of Object.entries(paths)) {
      for (const [method, operation] of Object.entries(pathItem)) {
        const upperMethod = method.toUpperCase() as HttpMethod
        if (!VALID_METHODS.includes(upperMethod)) continue

        const op = operation as Record<string, unknown>

        // Parse parameters
        const rawParams = (op.parameters ?? []) as Array<Record<string, unknown>>
        const parameters = rawParams.map((p) => ({
          name: p.name as string,
          in: p.in as 'path' | 'query' | 'header' | 'cookie',
          required: p.required as boolean | undefined,
          description: p.description as string | undefined,
          schema: resolveSchema(p.schema as ApiSpecSchema | undefined, doc),
        }))

        // Parse request body
        const rawBody = op.requestBody as Record<string, unknown> | undefined
        let requestBody = undefined
        if (rawBody) {
          const bodyContent = rawBody.content as Record<string, Record<string, unknown>> | undefined
          const resolvedContent: Record<string, { schema?: ApiSpecSchema }> = {}

          if (bodyContent) {
            for (const [contentType, mediaType] of Object.entries(bodyContent)) {
              resolvedContent[contentType] = {
                schema: resolveSchema(mediaType.schema as ApiSpecSchema | undefined, doc),
              }
            }
          }

          requestBody = {
            required: rawBody.required as boolean | undefined,
            description: rawBody.description as string | undefined,
            content: resolvedContent,
          }
        }

        // Parse responses
        const rawResponses = (op.responses ?? {}) as Record<string, Record<string, unknown>>
        const responses: Record<string, { description?: string; content?: Record<string, { schema?: ApiSpecSchema }> }> = {}

        for (const [statusCode, resp] of Object.entries(rawResponses)) {
          const respContent = resp.content as Record<string, Record<string, unknown>> | undefined
          const resolvedRespContent: Record<string, { schema?: ApiSpecSchema }> = {}

          if (respContent) {
            for (const [contentType, mediaType] of Object.entries(respContent)) {
              resolvedRespContent[contentType] = {
                schema: resolveSchema(mediaType.schema as ApiSpecSchema | undefined, doc),
              }
            }
          }

          responses[statusCode] = {
            description: resp.description as string | undefined,
            content: respContent ? resolvedRespContent : undefined,
          }
        }

        endpoints.push({
          method: upperMethod,
          path: basePath ? `${basePath}${path}` : path,
          summary: op.summary as string | undefined,
          description: op.description as string | undefined,
          tags: op.tags as string[] | undefined,
          parameters,
          requestBody,
          responses,
        })
      }
    }
  }

  const now = new Date().toISOString()

  return {
    name,
    source,
    version: info?.version as string | undefined,
    basePath: basePath || undefined,
    endpoints,
    schemas,
    importedAt: now,
    updatedAt: now,
  }
}
