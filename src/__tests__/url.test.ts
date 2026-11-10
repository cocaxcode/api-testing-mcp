import { describe, it, expect } from 'vitest'
import { resolveUrl } from '../lib/url.js'

describe('resolveUrl', () => {
  it('antepone BASE_URL a URLs relativas', () => {
    expect(resolveUrl('/health', { BASE_URL: 'https://api.test' })).toBe('https://api.test/health')
  })

  it('acepta base_url en minúsculas', () => {
    expect(resolveUrl('/health', { base_url: 'https://api.test' })).toBe('https://api.test/health')
  })

  it('acepta variantes mixtas como Base_Url', () => {
    expect(resolveUrl('/health', { Base_Url: 'https://api.test' })).toBe('https://api.test/health')
  })

  it('prefiere BASE_URL exacto si hay varias variantes', () => {
    expect(
      resolveUrl('/x', { base_url: 'https://lower.test', BASE_URL: 'https://upper.test' }),
    ).toBe('https://upper.test/x')
  })

  it('quita la barra final de la base', () => {
    expect(resolveUrl('/x', { base_url: 'https://api.test///' })).toBe('https://api.test/x')
  })

  it('no toca URLs absolutas', () => {
    expect(resolveUrl('https://other.test/x', { base_url: 'https://api.test' })).toBe(
      'https://other.test/x',
    )
  })

  it('devuelve la URL relativa si no hay base', () => {
    expect(resolveUrl('/x', {})).toBe('/x')
  })
})
