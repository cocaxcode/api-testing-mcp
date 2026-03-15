import { mkdir, readFile, writeFile, readdir, unlink } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type {
  SavedRequest,
  CollectionListItem,
  Environment,
  EnvironmentListItem,
  ApiSpec,
  ApiSpecListItem,
} from './types.js'

export class Storage {
  private readonly baseDir: string
  private readonly collectionsDir: string
  private readonly environmentsDir: string
  private readonly specsDir: string
  private readonly activeEnvFile: string

  constructor(baseDir?: string) {
    this.baseDir = baseDir ?? process.env.API_TESTING_DIR ?? join(homedir(), '.api-testing')
    this.collectionsDir = join(this.baseDir, 'collections')
    this.environmentsDir = join(this.baseDir, 'environments')
    this.specsDir = join(this.baseDir, 'specs')
    this.activeEnvFile = join(this.baseDir, 'active-env')
  }

  // ── Collections ──

  async saveCollection(saved: SavedRequest): Promise<void> {
    await this.ensureDir('collections')
    const filePath = join(this.collectionsDir, `${this.sanitizeName(saved.name)}.json`)
    await this.writeJson(filePath, saved)
  }

  async getCollection(name: string): Promise<SavedRequest | null> {
    const filePath = join(this.collectionsDir, `${this.sanitizeName(name)}.json`)
    return this.readJson<SavedRequest>(filePath)
  }

  async listCollections(tag?: string): Promise<CollectionListItem[]> {
    await this.ensureDir('collections')
    const files = await this.listJsonFiles(this.collectionsDir)
    const items: CollectionListItem[] = []

    for (const file of files) {
      const saved = await this.readJson<SavedRequest>(join(this.collectionsDir, file))
      if (!saved) continue

      if (tag && !(saved.tags ?? []).includes(tag)) continue

      items.push({
        name: saved.name,
        method: saved.request.method,
        url: saved.request.url,
        tags: saved.tags ?? [],
      })
    }

    return items
  }

  async deleteCollection(name: string): Promise<boolean> {
    const filePath = join(this.collectionsDir, `${this.sanitizeName(name)}.json`)
    try {
      await unlink(filePath)
      return true
    } catch {
      return false
    }
  }

  // ── Environments ──

  async createEnvironment(env: Environment): Promise<void> {
    await this.ensureDir('environments')
    const filePath = join(this.environmentsDir, `${this.sanitizeName(env.name)}.json`)
    await this.writeJson(filePath, env)
  }

  async getEnvironment(name: string): Promise<Environment | null> {
    const filePath = join(this.environmentsDir, `${this.sanitizeName(name)}.json`)
    return this.readJson<Environment>(filePath)
  }

  async listEnvironments(): Promise<EnvironmentListItem[]> {
    await this.ensureDir('environments')
    const files = await this.listJsonFiles(this.environmentsDir)
    const activeEnv = await this.getActiveEnvironment()
    const items: EnvironmentListItem[] = []

    for (const file of files) {
      const env = await this.readJson<Environment>(join(this.environmentsDir, file))
      if (!env) continue

      items.push({
        name: env.name,
        active: env.name === activeEnv,
        variableCount: Object.keys(env.variables).length,
      })
    }

    return items
  }

  async updateEnvironment(name: string, variables: Record<string, string>): Promise<void> {
    const env = await this.getEnvironment(name)
    if (!env) {
      throw new Error(`Entorno '${name}' no encontrado`)
    }

    env.variables = { ...env.variables, ...variables }
    env.updatedAt = new Date().toISOString()

    const filePath = join(this.environmentsDir, `${this.sanitizeName(name)}.json`)
    await this.writeJson(filePath, env)
  }

  async getActiveEnvironment(): Promise<string | null> {
    try {
      const content = await readFile(this.activeEnvFile, 'utf-8')
      return content.trim() || null
    } catch {
      return null
    }
  }

  async setActiveEnvironment(name: string): Promise<void> {
    // Verificar que el entorno existe
    const env = await this.getEnvironment(name)
    if (!env) {
      throw new Error(`Entorno '${name}' no encontrado`)
    }

    await this.ensureDir('')
    await writeFile(this.activeEnvFile, name, 'utf-8')
  }

  async renameEnvironment(oldName: string, newName: string): Promise<void> {
    const env = await this.getEnvironment(oldName)
    if (!env) {
      throw new Error(`Entorno '${oldName}' no encontrado`)
    }

    // Verificar que el nuevo nombre no exista
    const existing = await this.getEnvironment(newName)
    if (existing) {
      throw new Error(`Ya existe un entorno con el nombre '${newName}'`)
    }

    // Crear con nuevo nombre y eliminar el anterior
    env.name = newName
    env.updatedAt = new Date().toISOString()
    await this.createEnvironment(env)
    await unlink(join(this.environmentsDir, `${this.sanitizeName(oldName)}.json`))

    // Actualizar active-env si era el activo
    const activeEnv = await this.getActiveEnvironment()
    if (activeEnv === oldName) {
      await writeFile(this.activeEnvFile, newName, 'utf-8')
    }
  }

  async deleteEnvironment(name: string): Promise<void> {
    const env = await this.getEnvironment(name)
    if (!env) {
      throw new Error(`Entorno '${name}' no encontrado`)
    }

    await unlink(join(this.environmentsDir, `${this.sanitizeName(name)}.json`))

    // Limpiar active-env si era el activo
    const activeEnv = await this.getActiveEnvironment()
    if (activeEnv === name) {
      try {
        await unlink(this.activeEnvFile)
      } catch {
        // Ignorar si no existe
      }
    }
  }

  /**
   * Carga las variables del entorno activo.
   * Retorna objeto vacío si no hay entorno activo.
   */
  async getActiveVariables(): Promise<Record<string, string>> {
    const activeName = await this.getActiveEnvironment()
    if (!activeName) return {}

    const env = await this.getEnvironment(activeName)
    return env?.variables ?? {}
  }

  // ── API Specs ──

  async saveSpec(spec: ApiSpec): Promise<void> {
    await this.ensureDir('specs')
    const filePath = join(this.specsDir, `${this.sanitizeName(spec.name)}.json`)
    await this.writeJson(filePath, spec)
  }

  async getSpec(name: string): Promise<ApiSpec | null> {
    const filePath = join(this.specsDir, `${this.sanitizeName(name)}.json`)
    return this.readJson<ApiSpec>(filePath)
  }

  async listSpecs(): Promise<ApiSpecListItem[]> {
    await this.ensureDir('specs')
    const files = await this.listJsonFiles(this.specsDir)
    const items: ApiSpecListItem[] = []

    for (const file of files) {
      const spec = await this.readJson<ApiSpec>(join(this.specsDir, file))
      if (!spec) continue

      items.push({
        name: spec.name,
        source: spec.source,
        endpointCount: spec.endpoints.length,
        version: spec.version,
      })
    }

    return items
  }

  async deleteSpec(name: string): Promise<boolean> {
    const filePath = join(this.specsDir, `${this.sanitizeName(name)}.json`)
    try {
      await unlink(filePath)
      return true
    } catch {
      return false
    }
  }

  // ── Internal ──

  private async ensureDir(subdir: string): Promise<void> {
    const dir = subdir ? join(this.baseDir, subdir) : this.baseDir
    await mkdir(dir, { recursive: true })
  }

  private async readJson<T>(filePath: string): Promise<T | null> {
    try {
      const content = await readFile(filePath, 'utf-8')
      return JSON.parse(content) as T
    } catch {
      return null
    }
  }

  private async writeJson(filePath: string, data: unknown): Promise<void> {
    await writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8')
  }

  private async listJsonFiles(dir: string): Promise<string[]> {
    try {
      const entries = await readdir(dir)
      return entries.filter((f) => f.endsWith('.json')).sort()
    } catch {
      return []
    }
  }

  /**
   * Sanitiza un nombre para usarlo como nombre de archivo.
   * Reemplaza caracteres no alfanuméricos por guiones.
   */
  private sanitizeName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
  }
}
