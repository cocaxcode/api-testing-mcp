# @cocaxcode/api-testing-mcp

[![npm version](https://img.shields.io/npm/v/@cocaxcode/api-testing-mcp.svg)](https://www.npmjs.com/package/@cocaxcode/api-testing-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Tests](https://img.shields.io/badge/tests-70%20passing-brightgreen)]()
[![Node](https://img.shields.io/badge/node-%3E%3D20-blue)]()

**The API testing toolkit for AI coding agents.** Test APIs directly from Claude Code, Claude Desktop, Cursor, or any MCP client — using natural language.

> "Test my login endpoint with invalid credentials"
> "Import the API spec and show me all blog endpoints"
> "Run a load test with 50 concurrent requests to /health"
> "Generate mock data for the create user endpoint"

Zero cloud dependencies. Everything stored locally as JSON.

---

## Why?

| Problem | Solution |
|---------|----------|
| Switching between Postman and your IDE | Test APIs without leaving your editor |
| Remembering endpoint URLs and body schemas | Import your OpenAPI spec — the AI knows your API |
| Writing `{{BASE_URL}}/api/users` every time | Just write `/api/users` — BASE_URL is auto-resolved |
| Manual regression testing | `bulk_test` runs your entire collection in seconds |
| No idea what data to send | `mock` generates fake data from your API spec |
| Testing auth flows manually | `flow_run` chains requests — login → extract token → use it |

---

## Quick Start

### Install in Claude Code

```bash
claude mcp add api-testing -- npx -y @cocaxcode/api-testing-mcp
```

### Install in Claude Desktop / Cursor

Add to your MCP config:

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

### Setup your environment

```
"Create an environment called dev with BASE_URL http://localhost:3000 and TOKEN my-dev-token"
```

That's it. Now just talk:

```
"GET /api/health"
"Create a blog post with random data"
"Show me all users sorted by creation date"
```

---

## Features & Examples

### 🌐 HTTP Requests — `request`

Execute any HTTP request with full control. Relative URLs (`/path`) auto-resolve using `BASE_URL` from the active environment.

```
"GET /api/users"
"POST /api/blog with title 'Hello World' and content 'My first post'"
"DELETE /api/users/123 with Bearer token abc123"
```

**Supports:** GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS | Headers | Query params | JSON body | Auth (Bearer, API Key, Basic) | Timeout | Variable interpolation `{{VAR}}`

---

### ✅ Assertions — `assert`

Execute a request AND validate the response in one step. Get structured pass/fail results.

```
"Assert that GET /api/health returns status 200 and body.status equals 'ok'"
"Verify POST /api/login with wrong password returns 401"
"Check that GET /api/users responds in less than 500ms"
```

**Available operators:** `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `contains`, `not_contains`, `exists`, `type`

**Output:**
```
✅ PASS — 3/3 assertions passed
GET /api/health → 200 OK (42ms)

✅ status === 200
✅ body.status === "ok"
✅ timing.total_ms < 500
```

---

### 🔗 Flow — `flow_run`

Chain multiple requests in sequence. Extract data from one response and use it in the next step with `{{variables}}`.

```
"Run a flow: first login with email admin@test.com and password 123456,
 extract the token from body.token,
 then use that token to GET /api/users"
```

**Output:**
```
✅ FLOW COMPLETO — 2/2 pasos ejecutados

✅ Paso 1: login
   Status: 200 | Tiempo: 145ms
   Extraído: TOKEN=eyJhbGciOiJIUzI1NiIs...

✅ Paso 2: get-users
   Status: 200 | Tiempo: 89ms
```

---

### 📋 OpenAPI Import — `api_import`, `api_endpoints`, `api_endpoint_detail`

Import your Swagger/OpenAPI spec so the AI knows your entire API — endpoints, schemas, required fields, everything.

```
"Import my API from http://localhost:3000/api-docs-json"
"What endpoints does the blog module have?"
"Show me the details of POST /api/users — what fields does it need?"
```

**Output:**
```
API 'my-backend' imported — 24 endpoints, 15 schemas

Endpoints by tag:
  auth: 3 endpoints
  users: 5 endpoints
  blog: 6 endpoints
  projects: 4 endpoints
```

---

### 🎭 Mock Data — `mock`

Generate realistic fake data from your OpenAPI spec. Perfect for frontend development without a running backend.

```
"Generate mock data for creating a user"
"Give me 10 fake blog posts based on the API spec"
"What would the response of GET /api/projects look like?"
```

**Output:**
```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "email": "user42@example.com",
  "name": "Test User 73",
  "role": "admin",
  "active": true
}
```

---

### 📊 Load Test — `load_test`

Launch N concurrent requests and get performance stats: avg, min, max, percentiles, requests/second.

```
"Run a load test with 50 concurrent requests to GET /api/health"
"Load test POST /api/search with 20 concurrent requests"
```

**Output:**
```
📊 LOAD TEST — GET /api/health

Requests: 50 concurrentes
Exitosos: 50 | Fallidos: 0
Tiempo total: 2145ms
Requests/segundo: 23.31

⏱️ Tiempos de respuesta:
  Min:  45ms
  Avg:  187ms
  p50:  156ms
  p95:  412ms
  p99:  523ms
  Max:  567ms

📋 Status codes:
  200: 50 (100%)
```

---

### 🔄 Diff Responses — `diff_responses`

Compare two requests side by side. Useful for regression testing or comparing environments (dev vs prod).

```
"Compare GET /api/users on dev vs prod"
"Diff the response of v1/users vs v2/users"
```

---

### 🚀 Bulk Test — `bulk_test`

Run all saved requests in your collection and get a summary report. Filter by tag.

```
"Run all saved requests tagged 'smoke'"
"Bulk test my entire collection"
```

**Output:**
```
✅ BULK TEST — 8/8 passed | 1234ms total

✅ health-check — GET /api/health → 200 (45ms)
✅ list-users — GET /api/users → 200 (123ms)
✅ create-post — POST /api/blog → 201 (89ms)
✅ get-post — GET /api/blog/test-post → 200 (67ms)
...
```

---

### 📤 Export cURL — `export_curl`

Convert any saved request to a cURL command. Ready to copy-paste and share.

```
"Export the create-user request as cURL"
```

**Output:**
```bash
curl \
  -X POST \
  'https://api.example.com/users' \
  -H 'Authorization: Bearer abc123' \
  -H 'Content-Type: application/json' \
  -d '{"name":"John","email":"john@example.com"}'
```

---

### 💾 Collections — `collection_save`, `collection_list`, `collection_get`, `collection_delete`

Save, organize, and reuse requests locally. Tag them for easy filtering.

```
"Save this request as 'create-user' with tags 'users' and 'write'"
"Show me all saved requests tagged 'auth'"
"Delete the old-endpoint request"
```

---

### 🌍 Environments — `env_create`, `env_list`, `env_set`, `env_get`, `env_switch`

Manage variables per environment. Switch between dev/staging/prod seamlessly.

```
"Create a prod environment with BASE_URL https://api.example.com"
"Switch to dev environment"
"Set TOKEN to my-new-token in the current environment"
```

---

## All 20 Tools

| Category | Tool | Description |
|----------|------|-------------|
| **Request** | `request` | Execute HTTP requests |
| **Assert** | `assert` | Request + validate with assertions |
| **Flow** | `flow_run` | Chain requests, extract variables |
| **Collections** | `collection_save` | Save a request |
| | `collection_list` | List saved requests |
| | `collection_get` | Get request details |
| | `collection_delete` | Delete a request |
| **Environments** | `env_create` | Create environment |
| | `env_list` | List environments |
| | `env_set` | Set a variable |
| | `env_get` | Get variable(s) |
| | `env_switch` | Switch active env |
| **API Spec** | `api_import` | Import OpenAPI spec |
| | `api_endpoints` | List endpoints |
| | `api_endpoint_detail` | Endpoint details |
| **Mock** | `mock` | Generate fake data |
| **Load Test** | `load_test` | Concurrent performance test |
| **Utilities** | `export_curl` | Export as cURL |
| | `diff_responses` | Compare responses |
| | `bulk_test` | Run entire collection |

---

## Storage

All data is stored locally as JSON files in `.api-testing/`:

```
.api-testing/
├── active-env
├── collections/
│   ├── health-check.json
│   └── create-user.json
├── environments/
│   ├── dev.json
│   └── prod.json
└── specs/
    └── my-backend.json
```

Configure the storage directory:

```json
{
  "mcpServers": {
    "api-testing": {
      "command": "npx",
      "args": ["-y", "@cocaxcode/api-testing-mcp"],
      "env": {
        "API_TESTING_DIR": "/path/to/your/.api-testing"
      }
    }
  }
}
```

You can version these files in git to share with your team.

---

## Development

```bash
git clone https://github.com/cocaxcode/api-testing-mcp.git
cd api-testing-mcp
npm install
npm test          # 70 tests
npm run build
npm run typecheck
```

### Test with MCP Inspector

```bash
npx @modelcontextprotocol/inspector node dist/index.js
```

---

## License

MIT — [cocaxcode](https://github.com/cocaxcode)
