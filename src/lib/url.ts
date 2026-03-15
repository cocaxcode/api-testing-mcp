/**
 * Auto-prepend BASE_URL para URLs relativas (que empiezan con /).
 * Quita trailing slash de BASE_URL para evitar doble slash.
 */
export function resolveUrl(url: string, variables: Record<string, string>): string {
  if (url.startsWith('/') && variables.BASE_URL) {
    const baseUrl = variables.BASE_URL.replace(/\/+$/, '')
    return `${baseUrl}${url}`
  }
  return url
}
