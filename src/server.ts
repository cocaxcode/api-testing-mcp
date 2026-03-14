import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { Storage } from './lib/storage.js'
import { registerRequestTool } from './tools/request.js'
import { registerCollectionTools } from './tools/collection.js'
import { registerEnvironmentTools } from './tools/environment.js'

// Leer version del package.json en build time no es posible con ESM fácilmente,
// así que la definimos como constante sincronizada manualmente.
const VERSION = '0.1.0'

/**
 * Crea y configura el MCP server con todos los tools registrados.
 * Exportada como factory para testabilidad con InMemoryTransport.
 */
export function createServer(storageDir?: string): McpServer {
  const server = new McpServer({
    name: 'api-testing-mcp',
    version: VERSION,
  })

  const storage = new Storage(storageDir)

  // Registrar tools
  registerRequestTool(server, storage)
  registerCollectionTools(server, storage)
  registerEnvironmentTools(server, storage)

  return server
}
