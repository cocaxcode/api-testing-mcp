import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { createServer } from './server.js'

async function main() {
  // Limpiar activos de sesión al arrancar — cada sesión empieza con los defaults
  const { clearSessionActives } = await import('./lib/storage.js')
  await clearSessionActives()

  const server = createServer()
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('api-testing-mcp server running on stdio')

  const shutdown = async () => {
    console.error('api-testing-mcp: shutting down...')
    try {
      await server.close()
    } catch {
      // Ignorar errores de cierre
    }
    process.exit(0)
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

main().catch((error) => {
  console.error('Fatal:', error)
  process.exit(1)
})
