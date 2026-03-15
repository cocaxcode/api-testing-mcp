import { vi } from 'vitest'

/**
 * Creates a mock fetch that simulates httpbin.org responses.
 * Deterministic, no network required.
 */
export function createMockFetch() {
  return vi.fn(async (url: string | URL, init?: RequestInit) => {
    const urlStr = url.toString()
    const method = init?.method ?? 'GET'
    const bodyStr = init?.body as string | undefined

    // Parse request headers
    const reqHeaders: Record<string, string> = {}
    if (init?.headers) {
      const entries = init.headers instanceof Headers
        ? Array.from(init.headers.entries())
        : Object.entries(init.headers as Record<string, string>)
      for (const [k, v] of entries) {
        reqHeaders[k] = v
      }
    }

    // Invalid URLs
    if (!urlStr.startsWith('http://') && !urlStr.startsWith('https://')) {
      throw new TypeError(`Invalid URL: ${urlStr}`)
    }

    // Simulate httpbin.org/get
    if (urlStr.includes('/get')) {
      const responseBody = {
        url: urlStr.split('?')[0],
        headers: {
          ...reqHeaders,
          ...(reqHeaders['Authorization'] ? { Authorization: reqHeaders['Authorization'] } : {}),
        },
        args: Object.fromEntries(new URL(urlStr).searchParams.entries()),
      }

      return new Response(JSON.stringify(responseBody), {
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json', 'content-length': '256' },
      })
    }

    // Simulate httpbin.org/post
    if (urlStr.includes('/post')) {
      let json = null
      try {
        json = bodyStr ? JSON.parse(bodyStr) : null
      } catch { /* not JSON */ }

      const responseBody = {
        url: urlStr.split('?')[0],
        headers: reqHeaders,
        json,
        data: bodyStr ?? '',
      }

      return new Response(JSON.stringify(responseBody), {
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json', 'content-length': '256' },
      })
    }

    // Simulate httpbin.org/headers
    if (urlStr.includes('/headers')) {
      const responseBody = {
        headers: reqHeaders,
      }

      return new Response(JSON.stringify(responseBody), {
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json', 'content-length': '128' },
      })
    }

    // Simulate httpbin.org/status/{code}
    const statusMatch = urlStr.match(/\/status\/(\d+)/)
    if (statusMatch) {
      const code = parseInt(statusMatch[1])
      return new Response('', {
        status: code,
        statusText: `Status ${code}`,
        headers: { 'content-length': '0' },
      })
    }

    // Default: 200 OK with echo
    return new Response(JSON.stringify({ method, url: urlStr }), {
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'application/json', 'content-length': '64' },
    })
  })
}

/**
 * Installs mock fetch globally. Call in beforeAll/beforeEach.
 * Returns the mock for assertions.
 */
export function installMockFetch() {
  const mockFetch = createMockFetch()
  vi.stubGlobal('fetch', mockFetch)
  return mockFetch
}

/**
 * Restores original fetch. Call in afterAll/afterEach.
 */
export function restoreFetch() {
  vi.unstubAllGlobals()
}
