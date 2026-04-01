import { defineConfig } from 'tsup'

export default defineConfig([
  // Entry principal (CLI con shebang)
  {
    entry: ['src/index.ts'],
    format: ['esm'],
    dts: true,
    clean: true,
    sourcemap: true,
    target: 'node20',
    banner: {
      js: '#!/usr/bin/env node',
    },
    define: {
      __PKG_VERSION__: JSON.stringify(process.env.npm_package_version ?? '0.0.0'),
    },
  },
  // Entry de libreria (sin shebang, exporta createServer)
  {
    entry: ['src/server.ts'],
    format: ['esm'],
    dts: true,
    clean: false,
    sourcemap: true,
    target: 'node20',
    define: {
      __PKG_VERSION__: JSON.stringify(process.env.npm_package_version ?? '0.0.0'),
    },
  },
])
