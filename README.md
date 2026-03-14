# @cocaxcode/api-testing-mcp

[![npm version](https://img.shields.io/npm/v/@cocaxcode/api-testing-mcp.svg)](https://www.npmjs.com/package/@cocaxcode/api-testing-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

MCP server for API testing. Lightweight, local, zero cloud dependencies.

Test your APIs directly from Claude Code, Claude Desktop, Cursor, or any MCP client — without leaving your workflow.

## Features

- **HTTP requests** — GET, POST, PUT, PATCH, DELETE with headers, body, query params
- **Authentication** — Bearer token, API Key, Basic Auth built-in
- **Collections** — Save, organize, and reuse requests locally
- **Environments** — Manage variables per environment (dev/staging/prod)
- **Variable interpolation** — Use `{{VARIABLE}}` in URLs, headers, and body
- **Response metrics** — Timing (ms) and response size for every request
- **Zero cloud dependencies** — Everything stored locally as JSON files

## Installation

### Claude Desktop

Add to your `claude_desktop_config.json`:

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

### Claude Code

```bash
claude mcp add api-testing -- npx -y @cocaxcode/api-testing-mcp
```

### Custom storage directory

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

## Tools

### `request`

Execute an HTTP request with optional authentication and variable interpolation.

Relative URLs (starting with `/`) automatically use `BASE_URL` from the active environment — no need to write `{{BASE_URL}}` every time.

```
// Relative URL — auto-prepends BASE_URL from active environment
request({ method: "GET", url: "/api/users" })

// Equivalent to:
request({ method: "GET", url: "{{BASE_URL}}/api/users" })

// Full example with all options
request({
  method: "GET",
  url: "/api/users",
  headers: { "Authorization": "Bearer {{TOKEN}}" },
  query: { "page": "1" },
  timeout: 5000
})
```

**Auth examples:**

```
// Bearer token
request({ method: "GET", url: "...", auth: { type: "bearer", token: "abc123" } })

// API Key
request({ method: "GET", url: "...", auth: { type: "api-key", key: "mykey", header: "X-API-Key" } })

// Basic Auth
request({ method: "GET", url: "...", auth: { type: "basic", username: "user", password: "pass" } })
```

**Response format:**

```json
{
  "status": 200,
  "statusText": "OK",
  "headers": { "content-type": "application/json" },
  "body": { "users": [] },
  "timing": { "total_ms": 142.35 },
  "size_bytes": 1024
}
```

### `collection_save`

Save a request to your local collection for reuse.

```
collection_save({
  name: "get-users",
  request: { method: "GET", url: "https://api.example.com/users" },
  tags: ["users", "read"]
})
```

### `collection_list`

List all saved requests. Optionally filter by tag.

```
collection_list({ tag: "users" })
```

### `collection_get`

Get the full details of a saved request.

```
collection_get({ name: "get-users" })
```

### `collection_delete`

Delete a saved request from the collection.

```
collection_delete({ name: "get-users" })
```

### `env_create`

Create a new environment with optional initial variables.

```
env_create({
  name: "dev",
  variables: { "BASE_URL": "http://localhost:3000", "TOKEN": "dev-token" }
})
```

### `env_list`

List all environments and which one is active.

### `env_set`

Set a variable in an environment (defaults to active environment).

```
env_set({ key: "TOKEN", value: "new-token-value" })
```

### `env_get`

Get a specific variable or all variables from an environment.

```
env_get({ key: "BASE_URL" })
env_get({})  // returns all variables
```

### `env_switch`

Switch the active environment. Active environment variables are used for `{{interpolation}}`.

```
env_switch({ name: "prod" })
```

## Storage

All data is stored locally as JSON files in `.api-testing/` (in your current working directory by default):

```
.api-testing/
├── active-env                    # Name of the active environment
├── collections/
│   ├── get-users.json
│   └── create-post.json
└── environments/
    ├── dev.json
    └── prod.json
```

You can version these files in git if you want to share collections and environments with your team.

## Development

```bash
git clone https://github.com/cocaxcode/api-testing-mcp.git
cd api-testing-mcp
npm install
npm test
npm run build
```

### Test with MCP Inspector

```bash
npx @modelcontextprotocol/inspector node dist/index.js
```

## License

MIT
