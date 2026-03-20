<p align="center">
  <h1 align="center">@cocaxcode/api-testing-mcp</h1>
  <p align="center">
    <strong>Your AI already knows how to test APIs. Give it the tools.</strong><br/>
    35 MCP tools &middot; Zero config &middot; Works in any MCP client
  </p>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@cocaxcode/api-testing-mcp"><img src="https://img.shields.io/npm/v/@cocaxcode/api-testing-mcp.svg?style=flat-square&color=cb3837" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/@cocaxcode/api-testing-mcp"><img src="https://img.shields.io/npm/dm/@cocaxcode/api-testing-mcp.svg?style=flat-square" alt="npm downloads" /></a>
  <img src="https://img.shields.io/badge/tools-35-blueviolet?style=flat-square" alt="35 tools" />
  <img src="https://img.shields.io/badge/tests-110+-brightgreen?style=flat-square" alt="110+ tests" />
  <img src="https://img.shields.io/badge/node-%3E%3D20-339933?style=flat-square&logo=node.js&logoColor=white" alt="Node" />
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square" alt="License" /></a>
</p>

<p align="center">
  <a href="#quick-overview">Overview</a> &middot;
  <a href="#just-talk-to-it">Just Talk to It</a> &middot;
  <a href="#installation">Installation</a> &middot;
  <a href="#features">Features</a> &middot;
  <a href="#tool-reference">Tool Reference</a> &middot;
  <a href="#storage">Storage</a> &middot;
  <a href="#architecture">Architecture</a>
</p>

---

## Quick Overview

An [MCP server](https://modelcontextprotocol.io) that turns your AI assistant into a full API testing workbench. Send requests, write assertions, chain flows, import OpenAPI specs, generate mock data, load test, diff responses, manage collections and environments — all from natural conversation. No accounts, no frameworks, no generated files. Everything executes inline and stores as plain JSON you can commit to git.

---

## Just Talk to It

You don't need to learn tool names or parameters. Describe what you want and the AI picks the right tool.

```
"Set up an environment called dev with BASE_URL http://localhost:3000"
"Import my API spec from /api-docs-json"
"Show me all user endpoints"
"GET /users"
"Create a user with random data"
"Verify that DELETE /users/5 returns 204"
"Login as admin, extract the token, then fetch dashboard stats"
"How fast is /health with 50 concurrent requests?"
"Run all my saved smoke tests"
"Compare the users endpoint between dev and prod"
"Export the create-user request as curl"
"Export my collection to Postman"
```

If you've imported an OpenAPI spec, the AI already knows every endpoint, every required field, every valid enum value. When you say "create a blog post", it reads the schema and builds the request correctly — no guessing.

---

## Installation

### Claude Code

```bash
claude mcp add --scope user api-testing -- npx -y @cocaxcode/api-testing-mcp@latest
```

### Claude Desktop

Add to your config file (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS, `%APPDATA%\Claude\claude_desktop_config.json` on Windows):

```json
{
  "mcpServers": {
    "api-testing": {
      "command": "npx",
      "args": ["-y", "@cocaxcode/api-testing-mcp@latest"]
    }
  }
}
```

### Cursor / Windsurf

Add to `.cursor/mcp.json` or `.windsurf/mcp.json` in your project root:

```json
{
  "mcpServers": {
    "api-testing": {
      "command": "npx",
      "args": ["-y", "@cocaxcode/api-testing-mcp@latest"]
    }
  }
}
```

<details>
<summary>VS Code / Codex CLI / Gemini CLI</summary>

**VS Code** — add to `.vscode/mcp.json`:

```json
{
  "servers": {
    "api-testing": {
      "command": "npx",
      "args": ["-y", "@cocaxcode/api-testing-mcp@latest"]
    }
  }
}
```

**Codex CLI (OpenAI)**:

```bash
codex mcp add api-testing -- npx -y @cocaxcode/api-testing-mcp@latest
```

Or add to `~/.codex/config.toml`:

```toml
[mcp_servers.api-testing]
command = "npx"
args = ["-y", "@cocaxcode/api-testing-mcp@latest"]
```

**Gemini CLI** — add to `~/.gemini/settings.json`:

```json
{
  "mcpServers": {
    "api-testing": {
      "command": "npx",
      "args": ["-y", "@cocaxcode/api-testing-mcp@latest"]
    }
  }
}
```

</details>

### Quick Start

Once installed, set up an environment so relative paths resolve automatically:

```
"Create an environment called dev with BASE_URL http://localhost:3000"
```

If your API has a Swagger/OpenAPI spec, import it:

```
"Import my API spec from http://localhost:3000/api-docs-json"
```

Verify with: *"List my environments"* — you should see the one you just created.

---

## Features

### HTTP Requests

Send any HTTP method with headers, query params, JSON body, auth, and `{{variable}}` interpolation. Relative URLs auto-resolve against `BASE_URL`.

```
"POST to /api/users with name Jane and email jane@company.com using my bearer token"
```

Supports: GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS — Bearer / API Key / Basic auth — custom timeouts.

### Assertions

Validate responses with structured pass/fail results:

```
"Verify that GET /api/health returns 200, body.status is ok, and responds in under 500ms"
```

```
PASS — 3/3 assertions passed
  status === 200
  body.status === "ok"
  timing.total_ms < 500
```

10 operators: `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `contains`, `not_contains`, `exists`, `type`

### Request Flows

Chain requests with variable extraction between steps. Perfect for auth flows and CRUD sequences.

```
"Login as admin@test.com, extract the access token, then use it to fetch all users"
```

<details>
<summary>What the tool executes</summary>

```
flow_run({
  steps: [
    {
      name: "login",
      method: "POST",
      url: "/auth/login",
      body: { email: "admin@test.com", password: "SecurePass#99" },
      extract: { "TOKEN": "body.access_token" }
    },
    {
      name: "get-users",
      method: "GET",
      url: "/api/users",
      headers: { "Authorization": "Bearer {{TOKEN}}" }
    }
  ]
})
```

</details>

### OpenAPI Import

Import specs from a URL or local file (JSON and YAML). Once imported, the AI knows every endpoint, parameter, and schema.

```
"Import my API spec from http://localhost:3000/api-docs-json"
"Import the spec from ./openapi.yaml"
"What parameters does POST /users expect?"
```

Supports OpenAPI 3.x with full `$ref` resolution, `allOf`, `oneOf`, `anyOf`. OpenAPI 2.0 partially supported.

### Mock Data Generation

Generate realistic fake data from your OpenAPI schemas. Respects types, formats (`email`, `uuid`, `date-time`), enums, and required fields.

```
"Generate mock data for creating a user"
```

```json
{
  "email": "user42@example.com",
  "name": "Test User 73",
  "password": "TestPass123!",
  "role": "admin"
}
```

### Load Testing

Fire N concurrent requests and get performance metrics:

```
"How fast is the health endpoint with 50 concurrent requests?"
```

```
LOAD TEST — GET /api/health
Requests:    50 concurrent
Successful:  50 | Failed: 0
Req/sec:     23.31

  Min: 45ms | Avg: 187ms
  p50: 156ms | p95: 412ms | p99: 523ms
  Max: 567ms
```

### Response Diffing

Execute two requests and compare their responses field by field. Detect regressions or compare environments.

```
"Compare the users endpoint between dev and prod"
```

### Bulk Testing

Run every saved request in a collection (or filter by tag) and get a summary:

```
"Run all my saved smoke tests"
```

```
BULK TEST — 8/8 passed | 1.2s total
  health       — GET  /health      → 200 (45ms)
  list-users   — GET  /users       → 200 (123ms)
  create-post  — POST /blog        → 201 (89ms)
  login        — POST /auth/login  → 200 (156ms)
```

### Collections

Save requests for reuse with tags. Build regression suites.

```
"Save this request as create-user with tags auth, smoke"
"List all requests tagged smoke"
```

### Environments

Manage variables across dev/staging/prod and switch instantly. Project-scoped environments let different projects use different active environments simultaneously.

```
"Create an environment called github with BASE_URL https://api.github.com"
"Set GITHUB_TOKEN in the github environment"
"Switch to github"
"Get my repos"
```

Resolution order: project-specific environment > global active environment.

### Postman Import & Export

Bidirectional Postman support. Migrate seamlessly between Postman and your AI workflow.

```
"Import my Postman collection from ./exported.postman_collection.json"
"Export my collection to Postman"
"Export the dev environment for Postman"
```

<details>
<summary>Import details</summary>

**Collection:** Postman v2.1 format. Folders become tags. Auth inherited from folders/collection level. Supports raw JSON, x-www-form-urlencoded, form-data bodies.

**Environment:** Prefers `currentValue` over `value`. Skips disabled variables. Optional `activate` flag.

</details>

<details>
<summary>Export details</summary>

**Collection:** Requests grouped in folders by tag. Auth mapped to Postman's native format. `{{variables}}` preserved as-is.

**Environment:** All variables exported as `enabled: true` in Postman-compatible format.

</details>

### Native Export & Import

Export collections and environments to a portable `.atm/` folder. Share with your team or copy between projects.

```
"Export my collection and dev environment"
```

```
your-project/
└── .atm/
    ├── collection.json
    └── dev.env.json
```

> [!NOTE]
> `.atm/` is automatically added to `.gitignore` on first export.

### cURL Export

Convert any saved request into a ready-to-paste cURL command with resolved variables.

```
"Export the create-user request as curl"
```

```bash
curl -X POST \
  'https://api.example.com/users' \
  -H 'Authorization: Bearer eyJhbGci...' \
  -H 'Content-Type: application/json' \
  -d '{"name":"Jane","email":"jane@company.com"}'
```

---

## Tool Reference

35 tools across 8 categories:

| Category | Tools | Count |
|----------|-------|:-----:|
| **Requests** | `request` | 1 |
| **Testing** | `assert` | 1 |
| **Flows** | `flow_run` | 1 |
| **Collections** | `collection_save`, `collection_list`, `collection_get`, `collection_delete` | 4 |
| **Environments** | `env_create`, `env_list`, `env_set`, `env_get`, `env_switch`, `env_rename`, `env_delete`, `env_spec`, `env_project_clear`, `env_project_list` | 10 |
| **API Specs** | `api_import`, `api_spec_list`, `api_endpoints`, `api_endpoint_detail` | 4 |
| **Mock** | `mock` | 1 |
| **Utilities** | `load_test`, `export_curl`, `diff_responses`, `bulk_test`, `export_collection`, `import_collection`, `export_environment`, `import_environment`, `export_postman_collection`, `import_postman_collection`, `export_postman_environment`, `import_postman_environment` | 12 |

> [!TIP]
> You don't need to call tools directly. Describe what you want and the AI picks the right one.

---

## Storage

All data lives in `~/.api-testing/` as plain JSON files — no database, no cloud sync.

```
~/.api-testing/
├── active-env                # Global active environment name
├── project-envs.json         # Per-project active environments
├── collections/              # Saved requests
├── environments/             # Environment variables (dev, prod, ...)
└── specs/                    # Imported OpenAPI specs
```

Exports go to `.atm/` in your project root (portable, auto-gitignored).

Override the default storage path:

```json
{
  "env": { "API_TESTING_DIR": "/path/to/custom/.api-testing" }
}
```

> [!WARNING]
> If you override `API_TESTING_DIR` to a path inside a git repository, add `.api-testing/` to your `.gitignore` to avoid pushing credentials.

---

## Architecture

```
src/
├── index.ts              # Entry point (shebang + StdioServerTransport)
├── server.ts             # createServer() factory
├── tools/                # 35 tool handlers (one file per category)
│   ├── request.ts        # HTTP requests (1)
│   ├── assert.ts         # Assertions (1)
│   ├── flow.ts           # Request chaining (1)
│   ├── collection.ts     # Collection CRUD (4)
│   ├── environment.ts    # Environment management (10)
│   ├── api-spec.ts       # OpenAPI import/browse (4)
│   ├── mock.ts           # Mock data generation (1)
│   ├── load-test.ts      # Load testing (1)
│   └── utilities.ts      # curl, diff, bulk, import/export (12)
├── lib/                  # Business logic (no MCP dependency)
│   ├── http-client.ts    # fetch wrapper with timing
│   ├── storage.ts        # JSON file storage engine
│   ├── schemas.ts        # Shared Zod schemas
│   ├── url.ts            # BASE_URL resolution
│   ├── path.ts           # Dot-notation accessor (body.data.0.id)
│   ├── interpolation.ts  # {{variable}} resolver
│   └── openapi-parser.ts # $ref + allOf/oneOf/anyOf resolution
└── __tests__/            # 10 test suites, 110+ tests
```

**Stack:** TypeScript (strict) · MCP SDK · Zod · Vitest · tsup

---

[MIT](./LICENSE) · Built by [cocaxcode](https://github.com/cocaxcode)
