# CLAUDE.md — @cocaxcode/api-testing-mcp

## Project Overview

MCP server for API testing. Zero cloud dependencies, local JSON storage. 27 tools, 83 tests.

## Stack

- TypeScript 5.x (strict mode, ESM)
- @modelcontextprotocol/sdk 1.27.x (unified package)
- Zod 3.25+ for schema validation
- Vitest for testing (InMemoryTransport for integration tests)
- tsup for building (ESM output with shebang)

## Architecture

```
src/
├── index.ts          # Entry point (shebang + StdioServerTransport)
├── server.ts         # createServer() factory
├── tools/            # MCP tool registration (one file per group)
│   ├── request.ts    # HTTP request tool (1)
│   ├── collection.ts # Collection CRUD tools (4)
│   ├── environment.ts # Environment tools (10)
│   ├── api-spec.ts   # OpenAPI import/browse tools (4)
│   ├── assert.ts     # Assertion testing tool (1)
│   ├── flow.ts       # Request chaining tool (1)
│   ├── mock.ts       # Mock data generation tool (1)
│   ├── load-test.ts  # Load testing tool (1)
│   └── utilities.ts  # export_curl, diff_responses, bulk_test (3)
├── lib/              # Business logic (no MCP dependency)
│   ├── types.ts      # Shared TypeScript interfaces
│   ├── schemas.ts    # Shared Zod schemas (AuthSchema, HttpMethodSchema)
│   ├── url.ts        # resolveUrl() — BASE_URL auto-prepend
│   ├── path.ts       # getByPath() — dot notation accessor
│   ├── http-client.ts # fetch wrapper with timing
│   ├── storage.ts    # JSON file storage in .api-testing/
│   ├── interpolation.ts # {{variable}} resolver
│   └── openapi-parser.ts # OpenAPI spec parser with $ref + allOf/oneOf/anyOf
└── __tests__/
    ├── helpers.ts    # createTestClient() with InMemoryTransport
    └── *.test.ts     # 10 test files, 83 tests
```

## Key Patterns

- **Factory function**: `createServer(storageDir?)` for testability
- **SDK imports**: Deep paths — `@modelcontextprotocol/sdk/server/mcp.js`
- **Tool API**: `.tool(name, description, schema, handler)` with raw Zod shapes (NOT z.object)
- **Error handling**: Return `{ isError: true }`, never throw from tool handlers
- **Logging**: ONLY `console.error()` — stdout is reserved for JSON-RPC
- **Storage**: JSON files in `.api-testing/`, configurable via `API_TESTING_DIR` env var
- **Relative URLs**: URLs starting with `/` auto-prepend BASE_URL from active env

## Commands

```bash
npm test          # Run all tests (83)
npm run build     # Build with tsup
npm run typecheck # TypeScript check
npm run lint      # ESLint
npm run inspector # Test with MCP Inspector
```

## Conventions

- Spanish for user-facing strings (tool descriptions, error messages)
- English for code (variable names, comments)
- No semi, single quotes, trailing commas (Prettier)
- All tool handlers follow try/catch → isError pattern
