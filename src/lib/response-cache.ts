import { mkdir, readFile, writeFile, readdir, unlink, stat } from 'node:fs/promises'
import { join } from 'node:path'
import type { RequestResponse } from './types.js'

const MAX_IN_MEMORY = 20
const DEFAULT_TTL_MS = 60 * 60 * 1000 // 1h

export interface CachedEntry {
  call_id: string
  saved_at: number
  method: string
  url: string
  response: RequestResponse
}

/**
 * Ring buffer en memoria + persistencia ligera en disco.
 * Permite recuperar la response completa tras una compresión mediante call_id.
 */
export class ResponseCache {
  private buffer: CachedEntry[] = []
  private dir: string
  private ttlMs: number

  constructor(baseDir: string, ttlMs: number = DEFAULT_TTL_MS) {
    this.dir = join(baseDir, 'last-responses')
    this.ttlMs = ttlMs
  }

  async save(
    callId: string,
    method: string,
    url: string,
    response: RequestResponse,
  ): Promise<void> {
    const entry: CachedEntry = {
      call_id: callId,
      saved_at: Date.now(),
      method,
      url,
      response,
    }

    this.buffer.push(entry)
    if (this.buffer.length > MAX_IN_MEMORY) {
      this.buffer.shift()
    }

    // Persistencia a disco (best-effort, no bloquea)
    try {
      await mkdir(this.dir, { recursive: true })
      const file = join(this.dir, `${callId}.json`)
      await writeFile(file, JSON.stringify(entry), 'utf-8')
      void this.cleanupExpired() // fire-and-forget
    } catch {
      // Silenciar errores de disco — memory-first
    }
  }

  async get(callId?: string): Promise<CachedEntry | null> {
    // Sin call_id → último en memoria
    if (!callId) {
      if (this.buffer.length === 0) {
        return this.getLatestFromDisk()
      }
      return this.buffer[this.buffer.length - 1]
    }

    // Buscar en memoria primero
    const fromMem = this.buffer.find((e) => e.call_id === callId)
    if (fromMem) return fromMem

    // Fallback a disco
    try {
      const file = join(this.dir, `${callId}.json`)
      const raw = await readFile(file, 'utf-8')
      return JSON.parse(raw) as CachedEntry
    } catch {
      return null
    }
  }

  /**
   * Número de responses guardadas en los últimos `windowMs`.
   * Usado para avisar si hay ambigüedad al pedir "la última".
   */
  recentCount(windowMs: number = 5000): number {
    const now = Date.now()
    return this.buffer.filter((e) => now - e.saved_at <= windowMs).length
  }

  private async getLatestFromDisk(): Promise<CachedEntry | null> {
    try {
      const files = await readdir(this.dir)
      let latest: CachedEntry | null = null
      for (const f of files) {
        if (!f.endsWith('.json')) continue
        try {
          const raw = await readFile(join(this.dir, f), 'utf-8')
          const entry = JSON.parse(raw) as CachedEntry
          if (!latest || entry.saved_at > latest.saved_at) latest = entry
        } catch {
          // ignore corrupt file
        }
      }
      return latest
    } catch {
      return null
    }
  }

  private async cleanupExpired(): Promise<void> {
    try {
      const files = await readdir(this.dir)
      const now = Date.now()
      for (const f of files) {
        if (!f.endsWith('.json')) continue
        try {
          const s = await stat(join(this.dir, f))
          if (now - s.mtimeMs > this.ttlMs) {
            await unlink(join(this.dir, f))
          }
        } catch {
          // ignore
        }
      }
    } catch {
      // directorio no existe aún
    }
  }
}
