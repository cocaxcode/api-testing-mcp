import type { RequestConfig } from './types.js'

const VARIABLE_PATTERN = /\{\{(\w+)\}\}/g

/**
 * Resuelve todas las ocurrencias de {{variable}} en un string.
 * Las variables no encontradas se dejan intactas.
 */
export function interpolateString(
  template: string,
  variables: Record<string, string>,
): string {
  return template.replace(VARIABLE_PATTERN, (match, varName: string) => {
    return varName in variables ? variables[varName] : match
  })
}

/**
 * Interpola {{variables}} recursivamente en un valor.
 * - string → interpolateString
 * - object → interpola cada valor (recursivo)
 * - array → interpola cada elemento
 * - otros tipos → retorna sin cambios
 */
function interpolateValue(value: unknown, variables: Record<string, string>): unknown {
  if (typeof value === 'string') {
    return interpolateString(value, variables)
  }

  if (Array.isArray(value)) {
    return value.map((item) => interpolateValue(item, variables))
  }

  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(value)) {
      result[key] = interpolateValue(val, variables)
    }
    return result
  }

  return value
}

/**
 * Interpola un Record<string, string> (headers, query params).
 * Solo interpola los valores, no las keys.
 */
function interpolateRecord(
  record: Record<string, string> | undefined,
  variables: Record<string, string>,
): Record<string, string> | undefined {
  if (!record) return undefined

  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(record)) {
    result[key] = interpolateString(value, variables)
  }
  return result
}

/**
 * Resuelve {{variables}} en todos los campos de un RequestConfig:
 * url, headers (valores), body (recursivo), query params (valores).
 */
export function interpolateRequest(
  config: RequestConfig,
  variables: Record<string, string>,
): RequestConfig {
  return {
    ...config,
    url: interpolateString(config.url, variables),
    headers: interpolateRecord(config.headers, variables),
    query: interpolateRecord(config.query, variables),
    body: config.body !== undefined ? interpolateValue(config.body, variables) : undefined,
  }
}
