import { mkdir, readFile, writeFile, readdir, unlink } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type {
  SavedRequest,
  CollectionListItem,
  Environment,
  EnvironmentListItem,
  EnvironmentGroup,
  ApiSpec,
  ApiSpecListItem,
} from './types.js'

/** Limpia los activos de sesión al arrancar el server */
export async function clearSessionActives(): Promise<void> {
  const baseDir = process.env.API_TESTING_DIR ?? join(homedir(), '.api-testing')
  const projectEnvsFile = join(baseDir, 'project-envs.json')
  try {
    await unlink(projectEnvsFile)
  } catch {
    // No existe, ok
  }
}

export class Storage {
  private readonly baseDir: string
  private readonly collectionsDir: string
  private readonly environmentsDir: string
  private readonly specsDir: string
  private readonly activeEnvFile: string
  private readonly projectEnvsFile: string
  private readonly groupsDir: string

  constructor(baseDir?: string) {
    this.baseDir = baseDir ?? process.env.API_TESTING_DIR ?? join(homedir(), '.api-testing')
    this.collectionsDir = join(this.baseDir, 'collections')
    this.environmentsDir = join(this.baseDir, 'environments')
    this.specsDir = join(this.baseDir, 'specs')
    this.groupsDir = join(this.baseDir, 'groups')
    this.activeEnvFile = join(this.baseDir, 'active-env')
    this.projectEnvsFile = join(this.baseDir, 'project-envs.json')
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

    const allSaved = await Promise.all(
      files.map((file) => this.readJson<SavedRequest>(join(this.collectionsDir, file))),
    )

    return allSaved
      .filter((saved): saved is SavedRequest => {
        if (!saved) return false
        if (tag && !(saved.tags ?? []).includes(tag)) return false
        return true
      })
      .map((saved) => ({
        name: saved.name,
        method: saved.request.method,
        url: saved.request.url,
        tags: saved.tags ?? [],
      }))
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

    // Detectar grupo del CWD para filtrar
    const cwdGroup = await this.getGroupForPath(process.cwd())

    const allEnvs = await Promise.all(
      files.map((file) => this.readJson<Environment>(join(this.environmentsDir, file))),
    )

    // Filtrar: si hay grupo para el CWD, mostrar entornos de ese grupo + globales
    // Si no hay grupo, mostrar todos
    const filtered = allEnvs
      .filter((env): env is Environment => env !== null)
      .filter((env) => cwdGroup ? (env.group === cwdGroup.name || !env.group) : true)

    return filtered.map((env) => ({
      name: env.name,
      active: env.name === activeEnv,
      default: cwdGroup ? cwdGroup.default === env.name : false,
      group: env.group,
      variableCount: Object.keys(env.variables).length,
      spec: env.spec,
    }))
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

  async getActiveEnvironment(project?: string): Promise<string | null> {
    const projectPath = project ?? process.cwd()
    const group = await this.getGroupForPath(projectPath)

    // 1. Activo de sesión (project-envs.json) — solo si pertenece al grupo del CWD
    const projectEnvs = await this.getProjectEnvs()
    const sessionEnv = projectEnvs[projectPath]
    if (sessionEnv) {
      const env = await this.getEnvironment(sessionEnv)
      if (env) {
        // Si el CWD está en un grupo, solo aceptar el activo si es del mismo grupo
        if (group && env.group !== group.name) {
          // El activo guardado es de otro grupo o global — ignorar
        } else {
          return sessionEnv
        }
      }
    }

    // 2. Default del grupo
    if (group?.default) {
      const env = await this.getEnvironment(group.default)
      if (env) return group.default
    }

    // 3. Sin grupo y sin sesión → ninguno activo
    return null
  }

  async setActiveEnvironment(name: string, project?: string): Promise<void> {
    const env = await this.getEnvironment(name)
    if (!env) {
      throw new Error(`Entorno '${name}' no encontrado`)
    }

    // Siempre guardar como activo de sesión (project-envs.json)
    const projectPath = project ?? process.cwd()
    const projectEnvs = await this.getProjectEnvs()
    projectEnvs[projectPath] = name
    await this.ensureDir('')
    await this.writeJson(this.projectEnvsFile, projectEnvs)
  }

  async clearProjectEnvironment(project: string): Promise<boolean> {
    const projectEnvs = await this.getProjectEnvs()
    if (!(project in projectEnvs)) return false
    delete projectEnvs[project]
    await this.writeJson(this.projectEnvsFile, projectEnvs)
    return true
  }

  async listProjectEnvironments(): Promise<Record<string, string>> {
    return this.getProjectEnvs()
  }

  private async getProjectEnvs(): Promise<Record<string, string>> {
    return (await this.readJson<Record<string, string>>(this.projectEnvsFile)) ?? {}
  }

  async setEnvironmentSpec(envName: string, specName: string | null): Promise<void> {
    const env = await this.getEnvironment(envName)
    if (!env) {
      throw new Error(`Entorno '${envName}' no encontrado`)
    }

    env.spec = specName ?? undefined
    env.updatedAt = new Date().toISOString()

    const filePath = join(this.environmentsDir, `${this.sanitizeName(envName)}.json`)
    await this.writeJson(filePath, env)
  }

  async setEnvironmentGroup(envName: string, groupName: string | null): Promise<void> {
    const env = await this.getEnvironment(envName)
    if (!env) {
      throw new Error(`Entorno '${envName}' no encontrado`)
    }

    // Si tenia grupo y era el default, limpiar
    if (env.group) {
      const oldGroup = await this.getGroup(env.group)
      if (oldGroup?.default === envName) {
        oldGroup.default = undefined
        oldGroup.updatedAt = new Date().toISOString()
        await this.saveGroup(oldGroup)
      }
    }

    env.group = groupName ?? undefined
    env.updatedAt = new Date().toISOString()
    const filePath = join(this.environmentsDir, `${this.sanitizeName(envName)}.json`)
    await this.writeJson(filePath, env)
  }

  async getActiveSpec(): Promise<string | null> {
    const activeName = await this.getActiveEnvironment()
    if (!activeName) return null

    const env = await this.getEnvironment(activeName)
    return env?.spec ?? null
  }

  async renameEnvironment(oldName: string, newName: string): Promise<void> {
    const env = await this.getEnvironment(oldName)
    if (!env) {
      throw new Error(`Entorno '${oldName}' no encontrado`)
    }

    const existing = await this.getEnvironment(newName)
    if (existing) {
      throw new Error(`Ya existe un entorno con el nombre '${newName}'`)
    }

    env.name = newName
    env.updatedAt = new Date().toISOString()
    await this.createEnvironment(env)
    await unlink(join(this.environmentsDir, `${this.sanitizeName(oldName)}.json`))

    // Actualizar active-env global
    try {
      const globalActive = await readFile(this.activeEnvFile, 'utf-8')
      if (globalActive.trim() === oldName) {
        await writeFile(this.activeEnvFile, newName, 'utf-8')
      }
    } catch {
      // No hay active-env global
    }

    // Actualizar project-envs
    const projectEnvs = await this.getProjectEnvs()
    let changed = false
    for (const [project, envName] of Object.entries(projectEnvs)) {
      if (envName === oldName) {
        projectEnvs[project] = newName
        changed = true
      }
    }
    if (changed) {
      await this.writeJson(this.projectEnvsFile, projectEnvs)
    }

    // Actualizar default del grupo si era el default
    if (env.group) {
      const group = await this.getGroup(env.group)
      if (group?.default === oldName) {
        group.default = newName
        group.updatedAt = new Date().toISOString()
        await this.saveGroup(group)
      }
    }
  }

  async deleteEnvironment(name: string): Promise<void> {
    const env = await this.getEnvironment(name)
    if (!env) {
      throw new Error(`Entorno '${name}' no encontrado`)
    }

    await unlink(join(this.environmentsDir, `${this.sanitizeName(name)}.json`))

    // Limpiar active-env global
    try {
      const globalActive = await readFile(this.activeEnvFile, 'utf-8')
      if (globalActive.trim() === name) {
        await unlink(this.activeEnvFile)
      }
    } catch {
      // No hay active-env global
    }

    // Limpiar project-envs
    const projectEnvs = await this.getProjectEnvs()
    let changed = false
    for (const [project, envName] of Object.entries(projectEnvs)) {
      if (envName === name) {
        delete projectEnvs[project]
        changed = true
      }
    }
    if (changed) {
      await this.writeJson(this.projectEnvsFile, projectEnvs)
    }

    // Limpiar default del grupo
    if (env.group) {
      const group = await this.getGroup(env.group)
      if (group?.default === name) {
        group.default = undefined
        group.updatedAt = new Date().toISOString()
        await this.saveGroup(group)
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

  // ── Environment Groups ──

  async createGroup(name: string): Promise<EnvironmentGroup> {
    await this.ensureDir('groups')
    const existing = await this.getGroup(name)
    if (existing) {
      throw new Error(`El grupo '${name}' ya existe`)
    }
    const now = new Date().toISOString()
    const group: EnvironmentGroup = { name, scopes: [], createdAt: now, updatedAt: now }
    await this.saveGroup(group)
    return group
  }

  async getGroup(name: string): Promise<EnvironmentGroup | null> {
    const filePath = join(this.groupsDir, `${this.sanitizeName(name)}.json`)
    return this.readJson<EnvironmentGroup>(filePath)
  }

  async listGroups(): Promise<EnvironmentGroup[]> {
    await this.ensureDir('groups')
    const files = await this.listJsonFiles(this.groupsDir)
    const groups = await Promise.all(
      files.map((file) => this.readJson<EnvironmentGroup>(join(this.groupsDir, file))),
    )
    return groups.filter((g): g is EnvironmentGroup => g !== null)
  }

  async deleteGroup(name: string): Promise<void> {
    const group = await this.getGroup(name)
    if (!group) {
      throw new Error(`Grupo '${name}' no encontrado`)
    }
    // Los entornos del grupo quedan como globales (sin grupo)
    await this.ensureDir('environments')
    const files = await this.listJsonFiles(this.environmentsDir)
    for (const file of files) {
      const env = await this.readJson<Environment>(join(this.environmentsDir, file))
      if (env?.group === name) {
        env.group = undefined
        env.updatedAt = new Date().toISOString()
        await this.writeJson(join(this.environmentsDir, `${this.sanitizeName(env.name)}.json`), env)
      }
    }
    await unlink(join(this.groupsDir, `${this.sanitizeName(name)}.json`))
  }

  async addScopeToGroup(groupName: string, scope: string): Promise<void> {
    const group = await this.getGroup(groupName)
    if (!group) {
      throw new Error(`Grupo '${groupName}' no encontrado`)
    }
    const normalized = scope.replace(/\\/g, '/')
    if (!group.scopes.includes(normalized)) {
      group.scopes.push(normalized)
      group.updatedAt = new Date().toISOString()
      await this.saveGroup(group)
    }
  }

  async removeScopeFromGroup(groupName: string, scope: string): Promise<void> {
    const group = await this.getGroup(groupName)
    if (!group) {
      throw new Error(`Grupo '${groupName}' no encontrado`)
    }
    const normalized = scope.replace(/\\/g, '/')
    group.scopes = group.scopes.filter((s) => s !== normalized)
    group.updatedAt = new Date().toISOString()
    await this.saveGroup(group)
  }

  async getGroupForPath(path: string): Promise<EnvironmentGroup | null> {
    const normalized = path.replace(/\\/g, '/')
    const groups = await this.listGroups()
    for (const group of groups) {
      for (const scope of group.scopes) {
        if (normalized === scope || normalized.startsWith(scope + '/')) {
          return group
        }
      }
    }
    return null
  }

  async setGroupDefault(groupName: string, envName: string): Promise<void> {
    const group = await this.getGroup(groupName)
    if (!group) {
      throw new Error(`Grupo '${groupName}' no encontrado`)
    }
    const env = await this.getEnvironment(envName)
    if (!env) {
      throw new Error(`Entorno '${envName}' no encontrado`)
    }
    if (env.group !== groupName) {
      throw new Error(`El entorno '${envName}' no pertenece al grupo '${groupName}'`)
    }
    group.default = envName
    group.updatedAt = new Date().toISOString()
    await this.saveGroup(group)
  }

  private async saveGroup(group: EnvironmentGroup): Promise<void> {
    await this.ensureDir('groups')
    const filePath = join(this.groupsDir, `${this.sanitizeName(group.name)}.json`)
    await this.writeJson(filePath, group)
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

    const allSpecs = await Promise.all(
      files.map((file) => this.readJson<ApiSpec>(join(this.specsDir, file))),
    )

    return allSpecs
      .filter((spec): spec is ApiSpec => spec !== null)
      .map((spec) => ({
        name: spec.name,
        source: spec.source,
        endpointCount: spec.endpoints.length,
        version: spec.version,
      }))
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
    const sanitized = name
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')

    if (!sanitized) {
      throw new Error(`Nombre inválido: '${name}'`)
    }

    return sanitized
  }
}
