import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/__tests__/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/lib/**', 'src/tools/**', 'src/server.ts'],
      exclude: ['src/__tests__/**', 'src/index.ts'],
    },
    testTimeout: 15000,
  },
})
