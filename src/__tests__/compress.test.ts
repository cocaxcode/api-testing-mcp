import { describe, it, expect } from 'vitest'
import {
  compressResponse,
  filterHeaders,
  getByDotPath,
  pickByDotPaths,
  makeCallId,
  FILTERED_HEADERS,
  FILTERED_HEADER_PATTERNS,
} from '../lib/compress.js'
import type { RequestResponse } from '../lib/types.js'

function buildResponse(overrides: Partial<RequestResponse> = {}): RequestResponse {
  return {
    status: 200,
    statusText: 'OK',
    headers: {
      'content-type': 'application/json',
      date: 'Wed, 01 Jan 2026 00:00:00 GMT',
      server: 'nginx',
      'cf-ray': 'abc123',
      'x-amz-request-id': 'r1',
      'x-custom': 'keep-me',
      'set-cookie': 'sid=xyz',
    },
    body: { user: { id: 1, email: 'a@b.com' }, items: [{ id: 10 }, { id: 20 }] },
    timing: { total_ms: 42 },
    size_bytes: 256,
    ...overrides,
  }
}

describe('filterHeaders', () => {
  it('quita headers de lista exacta', () => {
    const filtered = filterHeaders({
      'content-type': 'application/json',
      date: 'now',
      server: 'x',
      'set-cookie': 'a=b',
    })
    expect(filtered).toEqual({ 'content-type': 'application/json' })
  })

  it('quita headers por patrón regex (CF-*, X-Amz-*)', () => {
    const filtered = filterHeaders({
      'cf-ray': '1',
      'x-amz-request-id': '2',
      'x-goog-id': '3',
      'x-custom': 'keep',
    })
    expect(filtered).toEqual({ 'x-custom': 'keep' })
  })

  it('es case-insensitive en la lista exacta', () => {
    const filtered = filterHeaders({ Date: 'x', SERVER: 'y', 'X-Custom': 'z' })
    expect(filtered).toEqual({ 'X-Custom': 'z' })
  })

  it('FILTERED_HEADERS y FILTERED_HEADER_PATTERNS están exportados', () => {
    expect(FILTERED_HEADERS.size).toBeGreaterThan(0)
    expect(FILTERED_HEADER_PATTERNS.length).toBeGreaterThan(0)
  })
})

describe('getByDotPath', () => {
  const obj = {
    user: { id: 1, email: 'a@b.com' },
    items: [{ id: 10 }, { id: 20 }, { id: 30 }],
  }

  it('acceso a objeto anidado', () => {
    expect(getByDotPath(obj, 'user.id')).toBe(1)
    expect(getByDotPath(obj, 'user.email')).toBe('a@b.com')
  })

  it('acceso por índice numérico', () => {
    expect(getByDotPath(obj, 'items.0.id')).toBe(10)
    expect(getByDotPath(obj, 'items[1].id')).toBe(20)
  })

  it('wildcard en array', () => {
    expect(getByDotPath(obj, 'items[*].id')).toEqual([10, 20, 30])
    expect(getByDotPath(obj, 'items.*.id')).toEqual([10, 20, 30])
  })

  it('path inexistente devuelve undefined', () => {
    expect(getByDotPath(obj, 'user.foo.bar')).toBeUndefined()
    expect(getByDotPath(obj, 'nope')).toBeUndefined()
  })
})

describe('pickByDotPaths', () => {
  it('recoge múltiples paths en un objeto', () => {
    const body = { a: 1, b: { c: 2 }, d: [{ e: 3 }] }
    const out = pickByDotPaths(body, ['a', 'b.c', 'd[0].e'])
    expect(out).toEqual({ a: 1, 'b.c': 2, 'd[0].e': 3 })
  })

  it('omite paths que devuelven undefined', () => {
    const out = pickByDotPaths({ a: 1 }, ['a', 'b'])
    expect(out).toEqual({ a: 1 })
  })
})

describe('makeCallId', () => {
  it('genera IDs únicos de longitud fija', () => {
    const id1 = makeCallId()
    const id2 = makeCallId()
    expect(id1).toHaveLength(8)
    expect(id2).toHaveLength(8)
    expect(id1).not.toBe(id2)
  })
})

describe('compressResponse', () => {
  describe("verbosity='full'", () => {
    it('devuelve response intacta + call_id', () => {
      const resp = buildResponse()
      const out = compressResponse(resp, { verbosity: 'full', call_id: 'abc12345' })
      expect(out.call_id).toBe('abc12345')
      expect(out.status).toBe(200)
      expect(out.headers).toEqual(resp.headers) // no filtra
      expect(out.body).toEqual(resp.body)
      expect(out.tokens_saved_estimate).toBe(0)
    })
  })

  describe("verbosity='minimal'", () => {
    it('solo devuelve lo mínimo + body_preview', () => {
      const resp = buildResponse()
      const out = compressResponse(resp, { verbosity: 'minimal' })
      expect(out.status).toBe(200)
      expect(out.body_preview).toBeDefined()
      expect(out.body_preview!.length).toBeLessThanOrEqual(200)
      expect(out.headers).toBeUndefined()
      expect(out.body).toBeUndefined()
      expect(out.statusText).toBeUndefined()
    })

    it('marca body_truncated con hint si size > preview', () => {
      const resp = buildResponse({ size_bytes: 5000 })
      const out = compressResponse(resp, { verbosity: 'minimal' })
      expect(out.body_truncated).toBe(true)
      expect(out.hint).toContain('inspect_last_response')
      expect(out.hint).toContain(out.call_id)
    })
  })

  describe("verbosity='normal' (default)", () => {
    it('filtra headers ruidosos', () => {
      const resp = buildResponse()
      const out = compressResponse(resp)
      expect(out.headers).toBeDefined()
      expect(out.headers!['content-type']).toBe('application/json')
      expect(out.headers!.date).toBeUndefined()
      expect(out.headers!.server).toBeUndefined()
      expect(out.headers!['cf-ray']).toBeUndefined()
      expect(out.headers!['x-amz-request-id']).toBeUndefined()
      expect(out.headers!['set-cookie']).toBeUndefined()
      expect(out.headers!['x-custom']).toBe('keep-me')
    })

    it('devuelve body si cabe en max_body_bytes', () => {
      const resp = buildResponse()
      const out = compressResponse(resp, { max_body_bytes: 4096 })
      expect(out.body_truncated).toBeFalsy()
      expect(out.body).toEqual(resp.body)
    })

    it('trunca body y añade hint si excede max_body_bytes', () => {
      const big = 'x'.repeat(5000)
      const resp = buildResponse({ body: big })
      const out = compressResponse(resp, { max_body_bytes: 100 })
      expect(out.body_truncated).toBe(true)
      expect(typeof out.body).toBe('string')
      expect((out.body as string).length).toBeLessThanOrEqual(100)
      expect(out.hint).toContain('inspect_last_response')
    })
  })

  describe('only_fields', () => {
    it('extrae solo los paths pedidos (ignora max_body_bytes para body)', () => {
      const resp = buildResponse()
      const out = compressResponse(resp, {
        only_fields: ['user.id', 'items[*].id'],
      })
      expect(out.body).toEqual({ 'user.id': 1, 'items[*].id': [10, 20] })
    })

    it('combinado con verbosity=full mantiene todos los headers', () => {
      const resp = buildResponse()
      const out = compressResponse(resp, {
        only_fields: ['user.id'],
        verbosity: 'full',
      })
      expect(out.headers).toEqual(resp.headers)
    })
  })

  it('incluye method y url si se pasan en opciones', () => {
    const resp = buildResponse()
    const out = compressResponse(resp, {
      request_method: 'POST',
      request_url: 'https://api.example.com/users',
    })
    expect(out.method).toBe('POST')
    expect(out.url).toBe('https://api.example.com/users')
  })

  it('tokens_saved_estimate > 0 cuando hay compresión real', () => {
    const big = JSON.stringify({ data: 'x'.repeat(10000) })
    const resp = buildResponse({ body: big, size_bytes: big.length })
    const out = compressResponse(resp, { max_body_bytes: 100 })
    expect(out.tokens_saved_estimate).toBeGreaterThan(0)
  })
})
