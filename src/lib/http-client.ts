import type { RequestConfig, RequestResponse, AuthConfig } from './types.js'

const DEFAULT_TIMEOUT = 30_000

/**
 * Aplica la configuración de auth a los headers del request.
 */
function applyAuth(
  headers: Record<string, string>,
  auth: AuthConfig,
): Record<string, string> {
  const result = { ...headers }

  switch (auth.type) {
    case 'bearer':
      if (auth.token) {
        result['Authorization'] = `Bearer ${auth.token}`
      }
      break

    case 'api-key':
      if (auth.key) {
        const headerName = auth.header ?? 'X-API-Key'
        result[headerName] = auth.key
      }
      break

    case 'basic':
      if (auth.username && auth.password) {
        const credentials = Buffer.from(`${auth.username}:${auth.password}`).toString('base64')
        result['Authorization'] = `Basic ${credentials}`
      }
      break
  }

  return result
}

/**
 * Construye la URL final con query parameters.
 */
function buildUrl(baseUrl: string, query?: Record<string, string>): string {
  const url = new URL(baseUrl)

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      url.searchParams.set(key, value)
    }
  }

  return url.toString()
}

/**
 * Ejecuta un HTTP request y retorna la respuesta con métricas de timing.
 */
export async function executeRequest(config: RequestConfig): Promise<RequestResponse> {
  const timeout = config.timeout ?? DEFAULT_TIMEOUT

  // Construir URL con query params
  const url = buildUrl(config.url, config.query)

  // Preparar headers — Accept: application/json por defecto
  let headers: Record<string, string> = {
    Accept: 'application/json',
    ...config.headers,
  }

  // Aplicar auth
  if (config.auth) {
    headers = applyAuth(headers, config.auth)
  }

  // Preparar body
  let body: string | undefined
  if (config.body !== undefined && config.body !== null) {
    if (typeof config.body === 'string') {
      body = config.body
    } else {
      body = JSON.stringify(config.body)
      // Solo añadir Content-Type si no está definido
      if (!headers['Content-Type'] && !headers['content-type']) {
        headers['Content-Type'] = 'application/json'
      }
    }
  }

  // AbortController para timeout
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  // Medir timing
  const startTime = performance.now()

  try {
    const response = await fetch(url, {
      method: config.method,
      headers,
      body,
      signal: controller.signal,
    })

    const endTime = performance.now()
    const totalMs = Math.round((endTime - startTime) * 100) / 100

    // Parsear response body
    const responseText = await response.text()
    let responseBody: unknown
    try {
      responseBody = JSON.parse(responseText)
    } catch {
      responseBody = responseText
    }

    // Convertir headers a Record
    const responseHeaders: Record<string, string> = {}
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value
    })

    // Calcular tamaño
    const sizeBytes =
      Number(response.headers.get('content-length')) ||
      Buffer.byteLength(responseText, 'utf-8')

    return {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      body: responseBody,
      timing: { total_ms: totalMs },
      size_bytes: sizeBytes,
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timeout: superado el límite de ${timeout}ms`)
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}
