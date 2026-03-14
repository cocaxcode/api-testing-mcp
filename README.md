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
  <a href="#just-talk-to-it">Just Talk to It</a> •
  <a href="#features">Features</a> •
  <a href="#tool-reference">Tool Reference</a> •
  <a href="#storage">Storage</a> •
  <a href="#contributing">Contributing</a>
</p>

---

## What is this?

An [MCP server](https://modelcontextprotocol.io) that gives your AI assistant the ability to interact with any API. It works with Claude Code, Claude Desktop, Cursor, and any MCP-compatible client.

You describe what you need. The AI figures out the rest.

No cloud accounts. No subscriptions. Everything runs locally and stores data as plain JSON files you can commit to git.

---

## Just Talk to It

This tool is designed to be used through natural language. You don't need to memorize tool names, parameters, or JSON structures — just tell the AI what you want, and it translates your intent into the right API calls.

**Here's what a real conversation looks like:**

| You say | What happens behind the scenes |
|---------|-------------------------------|
| *"Set up an environment for my local API on port 3000"* | Creates environment with `BASE_URL=http://localhost:3000` |
| *"Import my API spec from /api-docs-json"* | Downloads the OpenAPI spec, stores all endpoints and schemas |
| *"Show me all user endpoints"* | Filters and lists endpoints tagged `users` |
| *"Get all users"* | `GET /api/users` → shows the response |
| *"Create a user with random data"* | Reads the spec, generates valid mock data, sends `POST /api/users` |
| *"Verify that deleting user 5 returns 204"* | Runs the request + assertion in one step |
| *"Login as admin and then fetch the dashboard stats"* | Chains 2 requests: login → extract token → use token for next call |
| *"How fast is the health endpoint under load?"* | Fires 50 concurrent requests, reports p50/p95/p99 latencies |
| *"Run all my saved smoke tests"* | Executes every request tagged `smoke`, reports pass/fail |
| *"Export the create-user request as curl"* | Builds a ready-to-paste cURL command with resolved variables |
| *"Compare the users endpoint between dev and prod"* | Hits both URLs, diffs status codes, body, and timing |
| *"Switch to the production environment"* | Changes active env — all subsequent requests use prod URLs and tokens |

**The AI already knows your API** if you've imported the spec. It knows which fields are required, what types they expect, valid enum values, and what the response looks like. When you say *"create a blog post"*, it doesn't guess — it reads the schema and builds the request correctly.

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

Set up an environment so the tool knows where your API lives:

```
"Create an environment called dev with BASE_URL http://localhost:3000"
```

From here, relative paths work automatically. `/api/users` becomes `http://localhost:3000/api/users`.

If your API has Swagger/OpenAPI, import the spec:

```
"Import my API spec from http://localhost:3000/api-docs-json"
```

Now the AI knows every endpoint, parameter, and schema in your API. You're ready to go.

---

## Features

### HTTP Requests

Execute any HTTP method with headers, body, query params, and built-in auth. Relative URLs resolve from the active environment. Variables like `{{TOKEN}}` are replaced from environment values.

```
request({
  method: "POST",
  url: "/api/users",
  body: { name: "Jane", email: "jane@company.com" },
  auth: { type: "bearer", token: "{{TOKEN}}" }
})
```

**Supports:** GET · POST · PUT · PATCH · DELETE · HEAD · OPTIONS — Headers · Query params · JSON body · Bearer / API Key / Basic auth · Timeout · `{{variable}}` interpolation

### Assertions

Run a request and validate the response against a set of rules in one step. Get structured pass/fail results.

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

**Operators:** `eq` · `neq` · `gt` · `gte` · `lt` · `lte` · `contains` · `not_contains` · `exists` · `type`

### Request Flows

Chain multiple requests together. Extract values from one response and inject them into the next step using `{{variables}}`. Perfect for auth flows, CRUD sequences, and multi-step testing.

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

Import your Swagger/OpenAPI spec from a URL or local file. Once imported, the AI understands every endpoint, parameter, and schema — no guessing, no memorizing.

```
api_import({ name: "my-backend", source: "http://localhost:3000/api-docs-json" })
api_endpoints({ name: "my-backend", tag: "users" })
api_endpoint_detail({ name: "my-backend", method: "POST", path: "/users" })
```

### Mock Data Generation

Generate realistic fake data from your OpenAPI spec. Respects types, formats (`email`, `uuid`, `date-time`), enums, and required fields. Use `count` for arrays.

```
mock({ name: "my-backend", method: "POST", path: "/users", target: "request" })
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

Fire N concurrent requests and get performance metrics: min, avg, percentiles (p50/p95/p99), max, and requests per second.

```
load_test({ method: "GET", url: "/api/health", concurrent: 50 })
```

```
📊 LOAD TEST — GET /api/health

Requests:        50 concurrent
Successful:      50 | Failed: 0
Requests/sec:    23.31

⏱️  Response times:
  Min:   45ms  |  Avg:  187ms
  p50:  156ms  |  p95:  412ms
  p99:  523ms  |  Max:  567ms
```

### Response Diffing

Execute two requests and compare their responses field by field. Detect regressions or compare environments (dev vs prod).

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
✅ BULK TEST — 8/8 passed | 1.2s total

✅ health       — GET  /health      → 200 (45ms)
✅ list-users   — GET  /users       → 200 (123ms)
✅ create-post  — POST /blog        → 201 (89ms)
✅ login        — POST /auth/login  → 200 (156ms)
```

### cURL Export

Convert any saved request into a cURL command with resolved variables.

```bash
curl -X POST \
  'https://api.example.com/users' \
  -H 'Authorization: Bearer eyJhbGci...' \
  -H 'Content-Type: application/json' \
  -d '{"name":"Jane","email":"jane@company.com"}'
```

### Collections & Environments

Save requests for reuse (with tags), manage variables across environments (dev/staging/prod), and switch contexts instantly.

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

All data lives in `.api-testing/` as plain JSON — no database, no cloud sync:

```
.api-testing/
├── active-env                     # Active environment name
├── collections/                   # Saved requests
├── environments/                  # Environment variables (dev, prod, ...)
└── specs/                         # Imported OpenAPI specs
```

Override the default directory:

```json
{
  "env": { "API_TESTING_DIR": "/path/to/shared/.api-testing" }
}
```

Commit these files to git to share across your team.

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
