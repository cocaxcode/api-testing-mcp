# Changelog

## 0.13.2

### Docs

- "Native vs MCP" section: added upfront TL;DR line (65-97% savings vs raw curl) and a new "Uses MCP?" column in the comparison table to make at a glance which rows are native and which go through the MCP.

## 0.13.1

### Docs

- Added **"Native vs MCP: real token cost"** section to the README with a concrete comparison table (curl, rtk curl, WebFetch vs the three verbosity modes and only_fields) based on a measured real-world call. Includes the honest notes about rtk curl incremental savings and the per-session MCP overhead.

## 0.13.0

### Added

- **Response compression for `request`**: three new optional parameters on the `request` tool to reduce context token consumption:
  - `verbosity: 'minimal' | 'normal' | 'full'` (default `'normal'`). Controls how much of the HTTP response is returned to the AI agent.
    - `minimal` — only `status`, `method`, `url`, `timing`, `size_bytes`, `body_preview` (200 chars). Ideal for health checks, polling, and fire-and-forget calls. Saves ~95% tokens.
    - `normal` (default) — filtered headers (omits Date, Server, CF-*, Set-Cookie, and other noise) + body truncated to `max_body_bytes`. Saves ~75% tokens.
    - `full` — complete response untouched. Same shape as before this release.
  - `only_fields: string[]` — return only specific body paths using dot-notation (`data.id`, `items[*].name`, `user.email`). Often saves >95% vs full when the agent knows what it needs.
  - `max_body_bytes: number` — max body size for `verbosity='normal'` (default 2048).
- **`inspect_last_response` tool** — recovers the full, unfiltered response of a previous `request` call via `call_id`. Every compressed response now includes a `call_id` field and a `hint` when truncated. Responses are kept in a 20-slot in-memory ring buffer and persisted to `.api-testing/last-responses/` with a 1h TTL.
- Exported `FILTERED_HEADERS` and `FILTERED_HEADER_PATTERNS` from `lib/compress.ts` for extensibility.

### Changed

- **Default `request` response shape** now includes `call_id` and may include `body_truncated` / `hint` when `verbosity='normal'` truncates a large body. `timing.total_ms`, `size_bytes`, `status`, `statusText`, `headers`, and `body` are preserved for backward compatibility. Pass `verbosity: 'full'` to restore the exact pre-0.13 response shape.

### Internal

- New modules: `lib/compress.ts`, `lib/response-cache.ts`, `tools/inspect.ts`.
- Shared schema shape `VerbosityShape` in `lib/schemas.ts` for future reuse.
- 30 new tests (171 total, all passing).
- No new runtime dependencies.
