import { describe, it, expect } from 'vitest'
import { interpolateString, interpolateRequest } from '../lib/interpolation.js'
import type { RequestConfig } from '../lib/types.js'

describe('interpolateString', () => {
  it('resuelve una variable simple', () => {
    expect(interpolateString('Hola {{NAME}}', { NAME: 'mundo' })).toBe('Hola mundo')
  })

  it('resuelve múltiples variables', () => {
    const result = interpolateString('{{PROTO}}://{{HOST}}:{{PORT}}', {
      PROTO: 'https',
      HOST: 'api.cocaxcode.dev',
      PORT: '443',
    })
    expect(result).toBe('https://api.cocaxcode.dev:443')
  })

  it('deja intacta una variable no encontrada', () => {
    expect(interpolateString('{{MISSING}}/path', { OTHER: 'val' })).toBe('{{MISSING}}/path')
  })

  it('retorna string sin cambios si no tiene variables', () => {
    expect(interpolateString('sin variables', { FOO: 'bar' })).toBe('sin variables')
  })

  it('retorna string original con mapa de variables vacío', () => {
    expect(interpolateString('{{VAR}}', {})).toBe('{{VAR}}')
  })
})

describe('interpolateRequest', () => {
  const baseConfig: RequestConfig = {
    method: 'GET',
    url: '{{BASE_URL}}/api/users',
    headers: { Authorization: 'Bearer {{TOKEN}}' },
    query: { search: '{{SEARCH_TERM}}' },
    body: undefined,
  }

  const variables = {
    BASE_URL: 'https://api.example.com',
    TOKEN: 'abc123',
    SEARCH_TERM: 'test',
  }

  it('interpola la URL', () => {
    const result = interpolateRequest(baseConfig, variables)
    expect(result.url).toBe('https://api.example.com/api/users')
  })

  it('interpola headers', () => {
    const result = interpolateRequest(baseConfig, variables)
    expect(result.headers?.Authorization).toBe('Bearer abc123')
  })

  it('interpola query params', () => {
    const result = interpolateRequest(baseConfig, variables)
    expect(result.query?.search).toBe('test')
  })

  it('interpola body string', () => {
    const config: RequestConfig = {
      ...baseConfig,
      body: '{"token": "{{TOKEN}}"}',
    }
    const result = interpolateRequest(config, variables)
    expect(result.body).toBe('{"token": "abc123"}')
  })

  it('interpola body objeto recursivamente', () => {
    const config: RequestConfig = {
      ...baseConfig,
      body: { auth: { token: '{{TOKEN}}' }, url: '{{BASE_URL}}' },
    }
    const result = interpolateRequest(config, variables)
    const body = result.body as Record<string, unknown>
    expect((body.auth as Record<string, string>).token).toBe('abc123')
    expect(body.url).toBe('https://api.example.com')
  })

  it('no modifica el config original (inmutabilidad)', () => {
    const original = { ...baseConfig }
    interpolateRequest(baseConfig, variables)
    expect(baseConfig.url).toBe(original.url)
  })

  it('mantiene body undefined si no se define', () => {
    const result = interpolateRequest(baseConfig, variables)
    expect(result.body).toBeUndefined()
  })
})
