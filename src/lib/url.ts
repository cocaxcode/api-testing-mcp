/**
 * Busca la variable BASE_URL sin distinguir mayúsculas (BASE_URL, base_url, Base_Url...).
 * Si existe la clave exacta BASE_URL, tiene prioridad.
 */
function findBaseUrl(variables: Record<string, string>): string | undefined {
  if (variables.BASE_URL) return variables.BASE_URL
  const key = Object.keys(variables).find((k) => k.toUpperCase() === 'BASE_URL')
  return key ? variables[key] : undefined
}

/**
 * Auto-prepend BASE_URL para URLs relativas (que empiezan con /).
 * Quita trailing slash de BASE_URL para evitar doble slash.
 */
export function resolveUrl(url: string, variables: Record<string, string>): string {
  const base = url.startsWith('/') ? findBaseUrl(variables) : undefined
  if (base) {
    return `${base.replace(/\/+$/, '')}${url}`
  }
  return url
}
