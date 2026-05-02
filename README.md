<p align="center">
  <h1 align="center">@cocaxcode/api-testing-mcp</h1>
  <p align="center">
    <strong>The most complete MCP server for API testing. Period.</strong><br/>
    42 MCP tools &middot; Zero config &middot; Works in any MCP client
  </p>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@cocaxcode/api-testing-mcp"><img src="https://img.shields.io/npm/v/@cocaxcode/api-testing-mcp.svg?style=flat-square&color=cb3837" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/@cocaxcode/api-testing-mcp"><img src="https://img.shields.io/npm/dm/@cocaxcode/api-testing-mcp.svg?style=flat-square" alt="npm downloads" /></a>
  <img src="https://img.shields.io/badge/tools-42-blueviolet?style=flat-square" alt="42 tools" />
  <img src="https://img.shields.io/badge/tests-171-brightgreen?style=flat-square" alt="171 tests" />
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

The most complete [MCP server](https://modelcontextprotocol.io) for API testing — 42 tools, zero config, nothing else comes close. This is not just a request sender. It is a full testing workbench: HTTP requests with assertions, multi-step flows with variable extraction, OpenAPI import with schema-aware mock data, load testing with percentile metrics, response diffing across environments, bulk test runners, reusable collections, environment groups with directory scoping and persistent defaults, Postman import/export, and cURL export. All from natural conversation. No accounts, no cloud, no generated files. Everything runs inline and stores as plain JSON you own.

---

## Just Talk to It

You don't need to learn tool names or parameters. Describe what you want and the AI picks the right tool.

```
"Create a group called my-project and add this directory as scope"
"Set up a dev environment with BASE_URL http://localhost:3000"
"Switch to prod for this session"
"Set dev as the default environment"
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

### Compression modes (v0.13+)

AI agents pay for every byte that lands in their context window. By default, `request` now returns a compressed response that cuts 70-95% of those tokens without losing debugging value. Three optional parameters control it:

| Param | Values | What it does |
|---|---|---|
| `verbosity` | `'minimal'` / `'normal'` (default) / `'full'` | Controls detail level |
| `only_fields` | `['user.id', 'items[*].name']` | Returns only these body paths (dot-notation + wildcards) |
| `max_body_bytes` | number (default `2048`) | Body size cap for `'normal'` |

**Modes:**

- **`minimal`** — only `status`, `timing`, `size_bytes`, first 200 chars of body. Perfect for health checks, polling loops, or fire-and-forget calls. *Saves ~95% tokens.*
- **`normal`** *(default)* — filtered headers (drops `Date`, `Server`, `CF-*`, `Set-Cookie`, etc.) + body truncated to `max_body_bytes`. Covers ~80% of debugging use cases. *Saves ~75% tokens.*
- **`full`** — complete response untouched. Use when you explicitly need every header or the full body.

**Typical savings on a 5 KB JSON response** (≈1,500 tokens):

| Mode | Tokens consumed | Savings |
|---|---|---|
| `full` | ~1,500 | 0% (baseline) |
| `normal` | ~300-400 | ~75% |
| `minimal` | ~50-80 | ~95% |
| `only_fields: ['data.id']` | ~30 | ~98% |

> For a head-to-head comparison against `curl`, `WebFetch` and other native alternatives with measured numbers, see [Native alternatives](#native-alternatives-real-token-cost) below.

**Recovering full responses:** every compressed response includes a `call_id`. If you need the full body later, call `inspect_last_response({ call_id })` — no need to re-execute the request. This works for `request`, `assert`, and each step of `flow_run`. Responses are kept in a 20-slot ring buffer and persisted to `.api-testing/last-responses/` with a 1-hour TTL.

```json
// Example: normal (default) response
{
  "call_id": "k3m9a2xp",
  "status": 200,
  "statusText": "OK",
  "method": "GET",
  "url": "https://api.example.com/users/1",
  "timing": { "total_ms": 142 },
  "size_bytes": 5324,
  "headers": { "content-type": "application/json" },
  "body": { "id": 1, "email": "...", "...": "..." },
  "body_truncated": true,
  "hint": "Body truncated to 2048 bytes (full size: 5324B). Call inspect_last_response({ call_id: \"k3m9a2xp\" }) for the full body.",
  "tokens_saved_estimate": 820
}
```

### Native alternatives: real token cost

How this MCP compares against the native options Claude Code has when `api-testing` is not available (Bash + curl, WebFetch, etc.).

**TL;DR**: compared to raw `curl`, `request` saves between **65% and 97%** of context tokens depending on the mode, with no loss of debugging information. Measured on a real call to `GET /api/v1/blog` returning 8 posts (~8.7 KB of JSON, 19 response headers):

| How the agent calls it | Uses MCP? | Tokens consumed | Delta vs curl |
|---|:-:|---|---|
| `Bash` + `curl` (raw stdout) | ❌ native | ~2,170 | baseline |
| `WebFetch` (LLM summary) | ❌ native | ~400-800 | −65%, but no auth / no envs / no inspect |
| `request` verbosity=`full` | ✅ MCP | ~2,170 | 0% (same as curl, no compression) |
| **`request` verbosity=`normal`** *(default)* | ✅ MCP | **~750** | **−65%** |
| `request` verbosity=`minimal` | ✅ MCP | ~50 | **−97%** |
| `request` with `only_fields: ["data[*].id","data[*].title"]` | ✅ MCP | ~190 | **−91%** |

> Why this table's numbers differ slightly from the "Compression modes" section above: these come from a single real-world response, while the previous table shows typical savings on a synthetic 5 KB response. Trend and order of magnitude are the same.

Notes:

- The default mode (`normal`) already saves 65% without any configuration: it filters out noisy headers (Date, Server, CF-*, Set-Cookie…) and caps the body at 2048 bytes.
- `only_fields` accepts dot-paths with array index and wildcard support (`items[*].name`) — returns only the fields you ask for.
- The MCP also adds features that have no direct native equivalent: `{{variable}}` interpolation, stored environments, auth schemas, flows, Postman import/export, and `inspect_last_response` to recover the full body without re-hitting the server.
- Every registered MCP adds a fixed overhead of ~300-600 tokens per session (its instructions block + tool names). Typical break-even: 1-2 real calls per session.

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

Environments hold your variables — `BASE_URL`, tokens, API keys — and keep them separated by context. The system has three core concepts:

**Group.** A group organizes environments and binds them to directories. A group has N scopes (directories) that share its environments, and exactly one default environment. When you create an environment inside a group, it belongs to that group. When you `cd` into a directory that is a scope of a group, its environments become available automatically.

**Default.** The default environment activates automatically when you enter a scope of its group. It persists between sessions — restart your editor, reopen your terminal, and the default is still there. Set it once and forget about it.

**Active.** The active environment is what is being used right now for variable resolution. It starts as the default when you enter a scope, but you can switch it at any time. The active selection is session-only — it resets to the default on restart.

Global environments (not associated with any group) still exist. They require explicit activation with `env_switch` and do not persist between sessions.

**Practical example:**

```
"Create a group called my-api"
"Add this directory as scope to my-api"
"Create a dev environment with BASE_URL http://localhost:3000"   <- auto-joins group, auto-default
"Create a prod environment with BASE_URL https://api.example.com"
"List environments"                                              <- shows dev (active, default) and prod
"Switch to prod"                                                 <- session only
"Set prod as default"                                            <- persists
```

**Automatic interpolation.** Any `{{variable}}` in URLs, headers, query params, or request bodies is resolved against the active environment before the request fires. Set `BASE_URL` once and every relative path just works.

**Your credentials never leave your machine.** Environment files are plain JSON stored in `~/.api-testing/`. Nothing syncs to any cloud. Nothing gets embedded in exports. Nothing gets tracked by git. Your tokens and secrets stay exactly where they should: on your disk, under your control.

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

> **Note:** `.atm/` is automatically added to `.gitignore` on first export.

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

42 tools across 10 categories:

| Category | Tools | Count |
|----------|-------|:-----:|
| **Requests** | `request` | 1 |
| **Inspect** | `inspect_last_response` | 1 |
| **Testing** | `assert` | 1 |
| **Flows** | `flow_run` | 1 |
| **Collections** | `collection_save`, `collection_list`, `collection_get`, `collection_delete` | 4 |
| **Environments** | `env_create`, `env_list`, `env_set`, `env_get`, `env_switch`, `env_rename`, `env_delete`, `env_spec`, `env_project_clear`, `env_project_list` | 10 |
| **Groups** | `env_group_create`, `env_group_list`, `env_group_delete`, `env_group_add_scope`, `env_group_remove_scope`, `env_set_default`, `env_set_group` | 7 |
| **API Specs** | `api_import`, `api_spec_list`, `api_endpoints`, `api_endpoint_detail` | 4 |
| **Mock** | `mock` | 1 |
| **Utilities** | `load_test`, `export_curl`, `diff_responses`, `bulk_test`, `export_collection`, `import_collection`, `export_environment`, `import_environment`, `export_postman_collection`, `import_postman_collection`, `export_postman_environment`, `import_postman_environment` | 12 |

> **Tip:** You don't need to call tools directly. Describe what you want and the AI picks the right one.

---

## Storage

Everything is local. No database, no cloud sync, no telemetry. All data lives in `~/.api-testing/` as plain JSON files you can read, back up, or delete at any time.

```
~/.api-testing/
├── groups/               # Environment groups with scopes and defaults
├── environments/         # Environment variables — tokens, keys, passwords
├── collections/          # Saved requests (shareable, no secrets)
├── specs/                # Imported OpenAPI specs
└── project-envs.json     # Session-only active environments (cleared on restart)
```

**Global storage vs project exports.** The `~/.api-testing/` directory is your private, global store — this is where credentials live and they never leave. When you export a collection or environment, it goes to `.atm/` in your project root. That folder is auto-added to `.gitignore` on first export, but even if you choose to commit it, your credentials stay in `~/.api-testing/` and are never copied into `.atm/`. You can safely share `.atm/` exports with your team without leaking secrets.

Override the default storage path:

```json
{
  "env": { "API_TESTING_DIR": "/path/to/custom/.api-testing" }
}
```

> **Warning:** If you override `API_TESTING_DIR` to a path inside a git repository, add `.api-testing/` to your `.gitignore` to avoid pushing credentials.

---

## Architecture

```
src/
├── index.ts              # Entry point (shebang + StdioServerTransport)
├── server.ts             # createServer() factory
├── tools/                # 42 tool handlers (one file per category)
│   ├── request.ts        # HTTP request (1)
│   ├── inspect.ts        # inspect_last_response (1)
│   ├── assert.ts         # Assertions (1)
│   ├── flow.ts           # Request chaining (1)
│   ├── collection.ts     # Collection CRUD (4)
│   ├── environment.ts    # Environments + groups (17)
│   ├── api-spec.ts       # OpenAPI import/browse (4)
│   ├── mock.ts           # Mock data generation (1)
│   ├── load-test.ts      # Load testing (1)
│   └── utilities.ts      # curl, diff, bulk, import/export (11)
├── lib/                  # Business logic (no MCP dependency)
│   ├── http-client.ts    # fetch wrapper with timing
│   ├── storage.ts        # JSON file storage engine (atomic writes)
│   ├── compress.ts       # Response compression + verbosity modes
│   ├── response-cache.ts # Ring buffer + disk cache for inspect
│   ├── schemas.ts        # Shared Zod schemas (HttpMethodSchema, AuthSchema)
│   ├── url.ts            # BASE_URL resolution
│   ├── path.ts           # Dot-notation accessor (body.data.0.id)
│   ├── interpolation.ts  # {{variable}} resolver
│   └── openapi-parser.ts # $ref + allOf/oneOf/anyOf resolution
└── __tests__/            # 10+ test suites, 171 tests
```

**Stack:** TypeScript (strict) · MCP SDK · Zod · Vitest · tsup

---

[MIT](./LICENSE) · Built by [cocaxcode](https://github.com/cocaxcode)
