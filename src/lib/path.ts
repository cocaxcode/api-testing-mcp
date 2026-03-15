/**
 * Accede a un valor en un objeto usando dot notation.
 * Soporta acceso a arrays por índice numérico (ej: "data.0.id").
 *
 * Ej: getByPath({ body: { data: [{ id: 1 }] } }, "body.data.0.id") → 1
 */
export function getByPath(obj: unknown, path: string): unknown {
  const parts = path.split('.')
  let current: unknown = obj

  for (const part of parts) {
    if (current === null || current === undefined) return undefined
    if (typeof current === 'object') {
      if (Array.isArray(current) && /^\d+$/.test(part)) {
        current = current[parseInt(part)]
      } else {
        current = (current as Record<string, unknown>)[part]
      }
    } else {
      return undefined
    }
  }

  return current
}
