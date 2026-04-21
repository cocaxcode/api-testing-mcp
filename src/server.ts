import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { Storage } from './lib/storage.js'
import { ResponseCache } from './lib/response-cache.js'
import { registerRequestTool } from './tools/request.js'
import { registerCollectionTools } from './tools/collection.js'
import { registerEnvironmentTools } from './tools/environment.js'
import { registerApiSpecTools } from './tools/api-spec.js'
import { registerAssertTool } from './tools/assert.js'
import { registerFlowTool } from './tools/flow.js'
import { registerUtilityTools } from './tools/utilities.js'
import { registerMockTool } from './tools/mock.js'
import { registerLoadTestTool } from './tools/load-test.js'
import { registerInspectTool } from './tools/inspect.js'

declare const __PKG_VERSION__: string
const VERSION = typeof __PKG_VERSION__ !== 'undefined' ? __PKG_VERSION__ : '0.0.0'

/**
 * Crea y configura el MCP server con todos los tools registrados.
 * Exportada como factory para testabilidad con InMemoryTransport.
 */
const INSTRUCTIONS = `api-testing-mcp permite probar APIs HTTP directamente desde tu asistente AI.

FLUJO TÍPICO:
1. Importa un spec OpenAPI con api_import, o haz requests directos con request.
2. Guarda requests frecuentes en la colección con collection_save.
3. Usa entornos (env_create/env_switch) para manejar variables como BASE_URL, tokens, etc.
4. Valida respuestas con assert (status, body, headers, timing).
5. Encadena requests con flow_run para flujos multi-paso (login → crear → verificar).

GRUPOS Y ENTORNOS:
- Los entornos pueden pertenecer a un GRUPO (ej: "cocaxcode", "optimizatusol").
- Un grupo tiene N scopes (directorios) que comparten sus entornos.
- env_list filtra automaticamente: si el CWD esta en un scope de un grupo, solo muestra entornos de ese grupo.
- Cada grupo tiene un entorno DEFAULT (persiste entre sesiones) y un ACTIVE (de sesion).
- Al crear un entorno: PREGUNTA al usuario nombre, grupo (o global) y variables.
- env_switch cambia el active de sesion (no persiste). env_set_default cambia el default (persiste).
- Entornos globales (sin grupo) solo se activan con env_switch explicito.

COMPORTAMIENTO:
- URLs que empiezan con / auto-prepend BASE_URL del entorno activo.
- {{variables}} se resuelven desde el entorno activo.
- collection_save sobreescribe si ya existe un request con el mismo nombre.
- load_test lanza requests concurrentes (max 100) y mide percentiles.
- mock genera datos fake basándose en el spec OpenAPI importado.`

export async function createServer(storageDir?: string): Promise<McpServer> {
  const server = new McpServer({
    name: 'api-testing-mcp',
    version: VERSION,
  }, {
    instructions: INSTRUCTIONS,
  })

  const storage = new Storage(storageDir)
  const responseCache = new ResponseCache(storage.baseDir)

  // Limpiar activos de sesión al arrancar — cada sesión empieza con los defaults
  await storage.clearSessionActives()

  // Registrar tools
  registerRequestTool(server, storage, responseCache)
  registerCollectionTools(server, storage)
  registerEnvironmentTools(server, storage)
  registerApiSpecTools(server, storage)
  registerAssertTool(server, storage)
  registerFlowTool(server, storage)
  registerUtilityTools(server, storage)
  registerMockTool(server, storage)
  registerLoadTestTool(server, storage)
  registerInspectTool(server, responseCache)

  return server
}
