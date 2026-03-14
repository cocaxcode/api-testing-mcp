import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { createServer } from '../server.js'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export interface TestContext {
  client: Client
  tempDir: string
  cleanup: () => Promise<void>
}

/**
 * Crea un cliente MCP conectado al server via InMemoryTransport.
 * Usa un directorio temporal para storage.
 */
export async function createTestClient(): Promise<TestContext> {
  const tempDir = await mkdtemp(join(tmpdir(), 'api-testing-'))
  const server = createServer(tempDir)

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()

  await server.connect(serverTransport)

  const client = new Client({ name: 'test-client', version: '1.0.0' })
  await client.connect(clientTransport)

  return {
    client,
    tempDir,
    cleanup: async () => {
      await client.close()
      await server.close()
      await rm(tempDir, { recursive: true, force: true })
    },
  }
}
