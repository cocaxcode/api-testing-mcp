<p align="center">
  <h1 align="center">@cocaxcode/api-testing-mcp</h1>
  <p align="center">
    A complete API testing toolkit built for AI coding agents.<br/>
    Test, validate, mock, and load-test your APIs — all from natural language.
  </p>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@cocaxcode/api-testing-mcp"><img src="https://img.shields.io/npm/v/@cocaxcode/api-testing-mcp.svg?style=flat-square&color=cb3837" alt="npm version" /></a>
  <a href="https://github.com/cocaxcode/api-testing-mcp/actions"><img src="https://img.shields.io/github/actions/workflow/status/cocaxcode/api-testing-mcp/ci.yml?style=flat-square&label=CI" alt="CI" /></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square" alt="License" /></a>
  <img src="https://img.shields.io/badge/tests-70%20passing-brightgreen?style=flat-square" alt="Tests" />
  <img src="https://img.shields.io/badge/tools-20-blueviolet?style=flat-square" alt="Tools" />
  <img src="https://img.shields.io/badge/node-%3E%3D20-339933?style=flat-square&logo=node.js&logoColor=white" alt="Node" />
</p>

<p align="center">
  <a href="#installation">Installation</a> •
  <a href="#features">Features</a> •
  <a href="#tool-reference">Tool Reference</a> •
  <a href="#storage">Storage</a> •
  <a href="#contributing">Contributing</a>
</p>

---

## What is this?

An [MCP server](https://modelcontextprotocol.io) that gives your AI assistant (Claude, Cursor, or any MCP-compatible client) the ability to interact with APIs. Instead of switching to Postman or writing curl commands, you just describe what you want in plain language:

```
You:  "Hit the login endpoint with test@example.com and password123,
       then use the token to fetch all users"

AI:   → Calls flow_run with 2 steps
      → Extracts token from login response
      → Passes it to GET /users via Authorization header
      → Shows you the results
```

No cloud. No accounts. Everything runs locally and stores data as plain JSON files you can version with git.

---

## Installation

### Claude Code

```bash
claude mcp add api-testing -- npx -y @cocaxcode/api-testing-mcp
```

### Claude Desktop / Cursor / Any MCP Client

Add to your MCP configuration file:

```json
{
  "mcpServers": {
    "api-testing": {
      "command": "npx",
      "args": ["-y", "@cocaxcode/api-testing-mcp"]
    }
  }
}
```

### First steps

Once installed, set up an environment so the tool knows where your API lives:

```
"Create an environment called dev with BASE_URL http://localhost:3000"
```

From here, you can use relative paths. `/api/users` automatically becomes `http://localhost:3000/api/users`.

---

## Features

### HTTP Requests

Execute any HTTP method with headers, body, query params, and built-in auth support (Bearer, API Key, Basic). Relative URLs are resolved automatically from the active environment.

```
request({
  method: "POST",
  url: "/api/users",
  body: { name: "Jane", email: "jane@company.com" },
  auth: { type: "bearer", token: "{{TOKEN}}" }
})
```

### Assertions

Run a request and validate the response against a set of rules. Supports 10 operators: `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `contains`, `not_contains`, `exists`, `type`.

```
assert({
  method: "GET",
  url: "/api/health",
  assertions: [
    { path: "status", operator: "eq", expected: 200 },
    { path: "body.status", operator: "eq", expected: "ok" },
    { path: "timing.total_ms", operator: "lt", expected: 500 }
  ]
})
```

```
✅ PASS — 3/3 assertions passed
GET /api/health → 200 OK (42ms)

✅ status === 200
✅ body.status === "ok"
✅ timing.total_ms < 500
```

### Request Flows

Chain multiple requests together. Extract values from one response and inject them into the next step using `{{variables}}`.

```
flow_run({
  steps: [
    {
      name: "login",
      method: "POST",
      url: "/auth/login",
      body: { email: "admin@test.com", password: "123456" },
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

### OpenAPI Import

Import your Swagger/OpenAPI spec so the AI understands your entire API surface — every endpoint, every parameter, every schema. Works from URL or local file.

```
api_import({ name: "my-backend", source: "http://localhost:3000/api-docs-json" })
api_endpoints({ name: "my-backend", tag: "users" })
api_endpoint_detail({ name: "my-backend", method: "POST", path: "/users" })
```

Once imported, the AI knows exactly what fields are required, what types they expect, and what responses to anticipate — no guessing.

### Mock Data Generation

Generate realistic fake data from your OpenAPI spec. Useful for frontend development when the backend isn't ready, or for populating test scenarios.

```
mock({
  name: "my-backend",
  method: "POST",
  path: "/users",
  target: "request"
})
```

```json
{
  "email": "user42@example.com",
  "name": "Test User 73",
  "password": "TestPass123!",
  "role": "admin"
}
```

Respects schema types, formats (`email`, `uuid`, `date-time`), enums, and required fields. Use `count` to generate arrays of N items.

### Load Testing

Launch concurrent requests against an endpoint and get performance metrics: min, avg, p50, p95, p99, max, and requests per second.

```
load_test({
  method: "GET",
  url: "/api/health",
  concurrent: 50
})
```

```
📊 LOAD TEST — GET /api/health

Requests:        50 concurrent
Successful:      50 | Failed: 0
Wall time:       2145ms
Requests/sec:    23.31

⏱️  Response times:
  Min:   45ms
  Avg:   187ms
  p50:   156ms
  p95:   412ms
  p99:   523ms
  Max:   567ms
```

### Response Diffing

Execute two requests and compare their responses field by field. Ideal for regression testing or comparing environments.

```
diff_responses({
  request_a: { label: "dev",  method: "GET", url: "http://dev.api.com/users" },
  request_b: { label: "prod", method: "GET", url: "http://prod.api.com/users" }
})
```

### Bulk Testing

Run every saved request in your collection (or filter by tag) and get a pass/fail summary.

```
bulk_test({ tag: "smoke" })
```

```
✅ BULK TEST — 8/8 passed | 1234ms total

✅ health-check — GET /health → 200 (45ms)
✅ list-users — GET /users → 200 (123ms)
✅ create-post — POST /blog → 201 (89ms)
✅ login — POST /auth/login → 200 (156ms)
```

### cURL Export

Convert any saved request into a ready-to-use cURL command. Variables from the active environment are resolved automatically.

```
export_curl({ name: "create-user" })
```

```bash
curl -X POST \
  'https://api.example.com/users' \
  -H 'Authorization: Bearer eyJhbGci...' \
  -H 'Content-Type: application/json' \
  -d '{"name":"Jane","email":"jane@company.com"}'
```

### Collections & Environments

Save requests for reuse, organize them with tags, and manage variables across environments.

```
collection_save({ name: "create-user", request: {...}, tags: ["users", "write"] })
env_create({ name: "prod", variables: { BASE_URL: "https://api.example.com" } })
env_switch({ name: "prod" })
```

---

## Tool Reference

20 tools organized in 8 categories:

| Category | Tools | Count |
|----------|-------|-------|
| **Requests** | `request` | 1 |
| **Testing** | `assert` | 1 |
| **Flows** | `flow_run` | 1 |
| **Collections** | `collection_save` · `collection_list` · `collection_get` · `collection_delete` | 4 |
| **Environments** | `env_create` · `env_list` · `env_set` · `env_get` · `env_switch` | 5 |
| **API Specs** | `api_import` · `api_endpoints` · `api_endpoint_detail` | 3 |
| **Mock** | `mock` | 1 |
| **Utilities** | `load_test` · `export_curl` · `diff_responses` · `bulk_test` | 4 |

---

## Storage

All data lives in `.api-testing/` as plain JSON files — no database, no cloud sync:

```
.api-testing/
├── active-env                     # Currently active environment name
├── collections/
│   └── create-user.json           # Saved requests
├── environments/
│   ├── dev.json                   # { name, variables, timestamps }
│   └── prod.json
└── specs/
    └── my-backend.json            # Imported OpenAPI specs
```

**Custom directory:**

```json
{
  "env": {
    "API_TESTING_DIR": "/path/to/shared/.api-testing"
  }
}
```

These files are plain JSON — commit them to git to share collections, environments, and API specs across your team.

---

## Contributing

```bash
git clone https://github.com/cocaxcode/api-testing-mcp.git
cd api-testing-mcp
npm install
npm test            # 70 tests across 10 suites
npm run build       # ESM bundle via tsup
npm run typecheck   # Strict TypeScript
```

**Test with MCP Inspector:**

```bash
npx @modelcontextprotocol/inspector node dist/index.js
```

**Stack:** TypeScript · MCP SDK 1.27 · Zod · Vitest · tsup

---

## License

[MIT](./LICENSE) — built by [cocaxcode](https://github.com/cocaxcode)
