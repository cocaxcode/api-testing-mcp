<p align="center">
  <h1 align="center">@cocaxcode/api-testing-mcp</h1>
  <p align="center">
    <strong>The most complete API testing MCP server available.</strong><br/>
    29 tools &middot; Zero config &middot; Zero dependencies &middot; Everything runs inside your AI conversation.
  </p>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@cocaxcode/api-testing-mcp"><img src="https://img.shields.io/npm/v/@cocaxcode/api-testing-mcp.svg?style=flat-square&color=cb3837" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/@cocaxcode/api-testing-mcp"><img src="https://img.shields.io/npm/dm/@cocaxcode/api-testing-mcp.svg?style=flat-square" alt="npm downloads" /></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square" alt="License" /></a>
  <img src="https://img.shields.io/badge/node-%3E%3D20-339933?style=flat-square&logo=node.js&logoColor=white" alt="Node" />
  <img src="https://img.shields.io/badge/tools-29-blueviolet?style=flat-square" alt="29 tools" />
  <img src="https://img.shields.io/badge/tests-96-brightgreen?style=flat-square" alt="96 tests" />
</p>

<p align="center">
  <a href="#why-this-one">Why This One</a> &middot;
  <a href="#installation">Installation</a> &middot;
  <a href="#just-talk-to-it">Just Talk to It</a> &middot;
  <a href="#features">Features</a> &middot;
  <a href="#tool-reference">Tool Reference</a> &middot;
  <a href="#storage">Storage</a> &middot;
  <a href="#contributing">Contributing</a>
</p>

---

## What is this?

An [MCP server](https://modelcontextprotocol.io) that gives your AI assistant the ability to **test, validate, mock, chain, diff, load-test, export to Postman, and manage** any API — all from natural language.

You describe what you need. The AI figures out the rest.

No cloud accounts. No subscriptions. No external frameworks. Everything runs locally and stores data as plain JSON files you can commit to git.

Works with **Claude Code**, **Claude Desktop**, **Cursor**, **Windsurf**, **Codex CLI**, **Gemini CLI**, and any MCP-compatible client.

---

## Why This One?

There are other API testing MCP servers out there. Here's why this one is different:

### vs. other MCP API tools

| Capability | @cocaxcode/api-testing-mcp | Others |
|---|:---:|:---:|
| HTTP requests with auth | 29 tools | 1-11 tools |
| Assertions (eq, neq, gt, lt, contains, exists, type...) | 10 operators | Status code only or none |
| Request flows with variable extraction | `flow_run` with `extract` | Not available |
| Collections with tags and CRUD | Full CRUD + tag filtering | Import from Postman or none |
| Environments with variable interpolation | CRUD + project-scoped | Manual `set_env_vars` or none |
| OpenAPI import with `$ref`, `allOf`, `oneOf`, `anyOf` | ~95% real-world coverage | Basic or none |
| Mock data generation from schemas | Types, formats, enums | Not available |
| Load testing with percentiles | p50/p95/p99 + req/s | Basic or none |
| Response diffing | Field-by-field comparison | Not available |
| Bulk testing by tag | Collection-wide pass/fail | Not available |
| **Postman export (collection + environment)** | **Files ready to import** | **Not available** |
| cURL export | With resolved variables | Not available |
| Project-scoped environments | Per-directory context | Not available |
| External dependencies | **Zero** — just Node.js | Playwright, Jest, pytest... |
| Configuration needed | **Zero** — `npx` and go | Scaffolding + framework setup |

### The key difference

Most API testing MCPs either (a) generate test code for external frameworks (Playwright, Jest, pytest) that you then run separately, or (b) wrap a single `fetch` call with no state management.

**This tool executes everything inline.** The AI is the test runner. No generated files, no framework installs, no context switching. You say *"verify that POST /users returns 201"* and you get the result in the same conversation.

---

## Installation

### Claude Code

```bash
claude mcp add api-testing -- npx -y @cocaxcode/api-testing-mcp@latest
```

### Claude Desktop

Add to your config file:

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

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

Add to `.cursor/mcp.json` (or `.windsurf/mcp.json`) in your project root:

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

### Codex CLI (OpenAI)

```bash
codex mcp add api-testing -- npx -y @cocaxcode/api-testing-mcp@latest
```

Or add manually to `~/.codex/config.toml`:

```toml
[mcp_servers.api-testing]
command = "npx"
args = ["-y", "@cocaxcode/api-testing-mcp@latest"]
```

### Gemini CLI (Google)

Add to `~/.gemini/settings.json`:

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

### Quick start

Once installed, set up an environment so the tool knows where your API lives:

```
"Create an environment called dev with BASE_URL http://localhost:3000"
```

From here, relative paths work automatically. `/api/users` becomes `http://localhost:3000/api/users`.

If your API has Swagger/OpenAPI, import the spec:

```
"Import my API spec from http://localhost:3000/api-docs-json"
```

Now the AI knows every endpoint, parameter, and schema in your API. You're ready to go.

To verify the installation is working, try: *"List my environments"* — it should show the one you just created.

Available on [npm](https://www.npmjs.com/package/@cocaxcode/api-testing-mcp).

---

## Just Talk to It

You don't need to memorize tool names, parameters, or JSON structures — just tell the AI what you want.

**Here's what a real conversation looks like:**

| You say | What happens |
|---------|-------------|
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
| *"Export my collection to Postman"* | Writes a `.postman_collection.json` file ready to import |
| *"Export the dev environment for Postman"* | Writes a `.postman_environment.json` file ready to import |
| *"Compare the users endpoint between dev and prod"* | Hits both URLs, diffs status codes, body, and timing |
| *"Switch to the production environment"* | Changes active env — all subsequent requests use prod URLs and tokens |

**The AI already knows your API** if you've imported the spec. It knows which fields are required, what types they expect, valid enum values, and what the response looks like. When you say *"create a blog post"*, it doesn't guess — it reads the schema and builds the request correctly.

---

## Works with Any API

This isn't limited to your own backend. You can test **any API** — public, third-party, or internal — and manage them all simultaneously through environments.

### Managing multiple APIs

Set up one environment per API and switch between them instantly:

```
"Create an environment called github with BASE_URL https://api.github.com"
"Create an environment called cloudflare with BASE_URL https://api.cloudflare.com/client/v4"
"Create an environment called dokploy with BASE_URL https://my-server:3000/api"
"Create an environment called my-backend with BASE_URL http://localhost:3000"
```

Add authentication variables to each one:

```
"Set GITHUB_TOKEN in the github environment"
"Set API_KEY in cloudflare"
"Set TOKEN in dokploy"
```

Then just switch context and start working:

```
"Switch to github"
"Get my repos"                              → GET /user/repos with Bearer token

"Switch to cloudflare"
"List all DNS zones"                        → GET /zones with API key auth

"Switch to dokploy"
"Show me all running projects"              → GET /project with token

"Switch to my-backend"
"Create a user with random data"            → POST /users with mock body from spec
```

### Real-world example: testing a third-party API

```
You: "Set up Cloudflare with my API key"
You: "List my DNS zones"
You: "Show me all DNS records for cocaxcode.dev"
You: "Verify that the A record for api.cocaxcode.dev exists"
You: "How fast is the zones endpoint under load?"
You: "Save this request as cf-list-zones with tag cloudflare"
```

Every request, collection, and spec is isolated per environment. Your Cloudflare tests don't mix with your local backend tests.

---

## Features

### HTTP Requests

Send any request by describing what you need. The AI resolves relative URLs, injects environment variables, and handles authentication automatically.

```
"POST to /api/users with name Jane and email jane@company.com using my bearer token"
```

<details>
<summary>What the tool executes</summary>

```
request({
  method: "POST",
  url: "/api/users",
  body: { name: "Jane", email: "jane@company.com" },
  auth: { type: "bearer", token: "{{TOKEN}}" }
})
```
</details>

**Supports:** GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS — Headers, query params, JSON body, Bearer / API Key / Basic auth, timeout, `{{variable}}` interpolation.

### Assertions

Validate API responses against a set of rules in one step. Get structured pass/fail results.

```
"Verify that GET /api/health returns 200, body.status is ok, and responds in under 500ms"
```

```
PASS — 3/3 assertions passed
GET /api/health → 200 OK (42ms)

  status === 200
  body.status === "ok"
  timing.total_ms < 500
```

**10 operators:** `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `contains`, `not_contains`, `exists`, `type`

### Request Flows

Chain multiple requests together. Extract values from one response and inject them into the next step. Perfect for auth flows, CRUD sequences, and multi-step testing.

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

**Features:** Variable extraction with dot-notation (`body.data.0.id`), `stop_on_error` flag, `{{variable}}` interpolation between steps.

### OpenAPI Import

Import your Swagger/OpenAPI spec from a URL or local file. Once imported, the AI understands every endpoint, parameter, and schema — no guessing, no memorizing.

```
"Import my API spec from http://localhost:3000/api-docs-json"
"Show me all user endpoints"
"What parameters does POST /users expect?"
```

**Supports:** OpenAPI 3.x with full `$ref` resolution, `allOf` (schema merging), `oneOf`/`anyOf` (union types) — covers ~95% of real-world API specs. OpenAPI 2.0 (Swagger) partially supported.

### Mock Data Generation

Generate realistic fake data from your OpenAPI spec. Respects types, formats (`email`, `uuid`, `date-time`), enums, and required fields.

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

Fire N concurrent requests and get performance metrics: min, avg, percentiles (p50/p95/p99), max, and requests per second.

```
"How fast is the health endpoint with 50 concurrent requests?"
```

```
LOAD TEST — GET /api/health

Requests:        50 concurrent
Successful:      50 | Failed: 0
Requests/sec:    23.31

Response times:
  Min:   45ms  |  Avg:  187ms
  p50:  156ms  |  p95:  412ms
  p99:  523ms  |  Max:  567ms
```

### Response Diffing

Execute two requests and compare their responses field by field. Detect regressions, compare environments, or validate API versioning.

```
"Compare the users endpoint between dev and prod"
```

### Bulk Testing

Run every saved request in your collection (or filter by tag) and get a pass/fail summary.

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

### Postman Export

Export your saved requests and environments as Postman-compatible JSON files. The files are written to a `postman/` folder in your project, ready to import in Postman.

```
"Export my collection to Postman"
"Export only the smoke tests to Postman"
"Export the dev environment for Postman"
```

**What you get:**

```
your-project/
└── postman/
    ├── my-api.postman_collection.json       ← Import in Postman: File → Import
    └── dev.postman_environment.json          ← Import in Postman: File → Import
```

**Collection features:**
- Requests grouped in **folders by tag** (smoke, auth, users, etc.)
- Auth (Bearer, API Key, Basic) mapped to Postman's native auth format
- `{{variables}}` preserved as-is (Postman uses the same syntax)
- Headers, query params, and JSON body included
- Collection variables from your active environment

**Environment features:**
- All variables exported with `enabled: true`
- Postman-compatible format (`_postman_variable_scope: "environment"`)
- Works with any environment (active or by name)

<details>
<summary>Example: exporting with a specific tag</summary>

```
You: "Export my smoke tests to Postman as 'Smoke Tests'"
```

This creates `postman/smoke-tests.postman_collection.json` with only the requests tagged `smoke`, grouped in folders.

You can also specify a custom output directory:

```
You: "Export my collection to Postman in the exports folder"
```

</details>

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

### Collections

Save requests for reuse with tags. Filter, list, and manage your request library. Perfect for building regression suites.

```
"Save this request as create-user with tags auth, smoke"
"List all requests tagged smoke"
"Delete the old health-check request"
```

### Environments

Manage variables across environments (dev/staging/prod) and switch contexts instantly. Supports `{{variable}}` interpolation in URLs, headers, and body.

### Project-Scoped Environments

Different projects can have different active environments. When you switch to an environment for a specific project, it only affects that project — other projects keep their own active environment.

```
"Switch to dev for this project"          → dev is active only in the current project
"Switch to prod globally"                 → prod is the default for projects without a specific assignment
"Show me which projects have environments" → lists all project-environment assignments
"Clear the project environment"           → falls back to the global active environment
```

Resolution order: project-specific environment → global active environment.

---

## Tool Reference

29 tools organized in 8 categories:

| Category | Tools | Count |
|----------|-------|-------|
| **Requests** | `request` | 1 |
| **Testing** | `assert` | 1 |
| **Flows** | `flow_run` | 1 |
| **Collections** | `collection_save` `collection_list` `collection_get` `collection_delete` | 4 |
| **Environments** | `env_create` `env_list` `env_set` `env_get` `env_switch` `env_rename` `env_delete` `env_spec` `env_project_clear` `env_project_list` | 10 |
| **API Specs** | `api_import` `api_spec_list` `api_endpoints` `api_endpoint_detail` | 4 |
| **Mock** | `mock` | 1 |
| **Utilities** | `load_test` `export_curl` `diff_responses` `bulk_test` `export_postman_collection` `export_postman_environment` | 6 |

You don't need to call these tools directly. Just describe what you want and the AI picks the right one.

---

## Storage

All data lives in `~/.api-testing/` (user home directory) as plain JSON — no database, no cloud sync. This keeps credentials out of your project repos by default.

```
~/.api-testing/
├── active-env                     # Global active environment name
├── project-envs.json              # Per-project active environments
├── collections/                   # Saved requests
├── environments/                  # Environment variables (dev, prod, ...)
└── specs/                         # Imported OpenAPI specs
```

Override the default directory in your MCP config:

```json
{
  "env": { "API_TESTING_DIR": "/path/to/custom/.api-testing" }
}
```

> **Warning:** If you override `API_TESTING_DIR` to a path inside a git repository, add `.api-testing/` to your `.gitignore` to avoid accidentally pushing credentials (API keys, tokens, passwords) to your remote.

---

## Architecture

Built for reliability and testability:

- **Zero runtime dependencies** — only `@modelcontextprotocol/sdk` and `zod`
- **96 integration tests** with mocked fetch (no network calls in CI)
- **Factory pattern** — `createServer(storageDir?)` for isolated test instances
- **Strict TypeScript** — zero `any`, full type coverage
- **< 95KB** bundled output via tsup

```
src/
├── tools/           # 29 MCP tool handlers (one file per category)
├── lib/             # Business logic (no MCP dependency)
│   ├── http-client  # fetch wrapper with timing
│   ├── storage      # JSON file storage engine
│   ├── schemas      # Shared Zod schemas (DRY across all tools)
│   ├── url          # BASE_URL resolution
│   ├── path         # Dot-notation accessor (body.data.0.id)
│   ├── interpolation # {{variable}} resolver
│   └── openapi-parser # $ref + allOf/oneOf/anyOf resolution
└── __tests__/       # 10 test suites, 96 tests
```

---

## Limitations

- **Auth**: Supports Bearer token, API Key, and Basic auth. OAuth 2.0 flows (authorization code, PKCE) are not supported — use a pre-obtained token instead.
- **Protocols**: HTTP/HTTPS only. No WebSocket, gRPC, or GraphQL-specific support (though GraphQL over HTTP works fine).
- **Load testing**: Recommended maximum of 100 concurrent requests. This is a testing tool, not a benchmarking framework.
- **Specs**: OpenAPI 3.x with full support for `$ref`, `allOf`, `oneOf`, and `anyOf` — covers ~95% of real-world API specs. OpenAPI 2.0 (Swagger) is partially supported. AsyncAPI is not supported.
- **Storage**: Local JSON files only. No built-in cloud sync or team collaboration server.

---

## Contributing

```bash
git clone https://github.com/cocaxcode/api-testing-mcp.git
cd api-testing-mcp
npm install
npm test            # 96 tests across 10 suites
npm run build       # ESM bundle via tsup
npm run typecheck   # Strict TypeScript
```

**Test with MCP Inspector:**

```bash
npx @modelcontextprotocol/inspector node dist/index.js
```

**Stack:** TypeScript &middot; MCP SDK 1.27 &middot; Zod &middot; Vitest &middot; tsup

### How to contribute

- **Bug reports**: [Open an issue](https://github.com/cocaxcode/api-testing-mcp/issues) with steps to reproduce, expected vs actual behavior, and your Node.js version.
- **Feature requests**: Open an issue describing the use case. Include examples of how you'd use it in natural language.
- **Pull requests**: Fork, create a branch, make your changes, ensure `npm test` and `npm run typecheck` pass, then open a PR.

---

## License

[MIT](./LICENSE) — built by [cocaxcode](https://github.com/cocaxcode)
