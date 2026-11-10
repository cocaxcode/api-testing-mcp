import type { ToolAnnotations } from '@modelcontextprotocol/sdk/types.js'

/**
 * MCP tool annotations (hints for clients, not security guarantees).
 *
 * - readOnlyHint: does not modify local storage nor call external APIs with side effects
 * - destructiveHint: may delete or overwrite data (only meaningful when readOnlyHint=false)
 * - idempotentHint: repeating the call with the same args has no additional effect
 * - openWorldHint: talks to external systems (HTTP requests, remote spec URLs)
 */

// Reads local storage only
const READ_LOCAL: ToolAnnotations = {
  readOnlyHint: true,
  openWorldHint: false,
}

// Writes local storage without deleting anything
const WRITE_LOCAL: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
}

// Deletes or overwrites local data
const DELETE_LOCAL: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: true,
  openWorldHint: false,
}

// Writes an export file to disk (may overwrite an existing file)
const WRITE_FILE: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: true,
  openWorldHint: false,
}

// Sends arbitrary HTTP requests (any method, so it may have side effects remotely)
const HTTP_CALL: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: true,
}

export const TOOL_ANNOTATIONS = {
  // request / testing
  request: { title: 'HTTP request', ...HTTP_CALL },
  assert: { title: 'Assert HTTP response', ...HTTP_CALL },
  flow_run: { title: 'Run request flow', ...HTTP_CALL },
  bulk_test: { title: 'Bulk test collection', ...HTTP_CALL },
  load_test: { title: 'Load test endpoint', ...HTTP_CALL },
  inspect_last_response: { title: 'Inspect cached response', ...READ_LOCAL },
  diff_responses: { title: 'Diff two responses', ...HTTP_CALL },
  export_curl: { title: 'Export as cURL', ...READ_LOCAL },
  mock: { title: 'Generate mock data', ...READ_LOCAL },

  // OpenAPI specs
  api_import: {
    title: 'Import OpenAPI spec',
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  },
  api_spec_list: { title: 'List imported specs', ...READ_LOCAL },
  api_endpoints: { title: 'List spec endpoints', ...READ_LOCAL },
  api_endpoint_detail: { title: 'Endpoint detail', ...READ_LOCAL },

  // collections
  collection_save: { title: 'Save request to collection', ...WRITE_LOCAL },
  collection_list: { title: 'List collection', ...READ_LOCAL },
  collection_get: { title: 'Get saved request', ...READ_LOCAL },
  collection_delete: { title: 'Delete saved request', ...DELETE_LOCAL },

  // environments
  env_create: { title: 'Create environment', ...WRITE_LOCAL },
  env_list: { title: 'List environments', ...READ_LOCAL },
  env_set: { title: 'Set environment variable', ...WRITE_LOCAL },
  env_get: { title: 'Get environment', ...READ_LOCAL },
  env_spec: { title: 'Link spec to environment', ...WRITE_LOCAL },
  env_rename: { title: 'Rename environment', ...WRITE_LOCAL },
  env_delete: { title: 'Delete environment', ...DELETE_LOCAL },
  env_switch: { title: 'Switch active environment', ...WRITE_LOCAL },
  env_project_clear: { title: 'Clear project environment', ...DELETE_LOCAL },
  env_project_list: { title: 'List project environments', ...READ_LOCAL },
  env_group_create: { title: 'Create environment group', ...WRITE_LOCAL },
  env_group_list: { title: 'List environment groups', ...READ_LOCAL },
  env_group_delete: { title: 'Delete environment group', ...DELETE_LOCAL },
  env_group_add_scope: { title: 'Add scope to group', ...WRITE_LOCAL },
  env_group_remove_scope: { title: 'Remove scope from group', ...DELETE_LOCAL },
  env_set_default: { title: 'Set default environment', ...WRITE_LOCAL },
  env_set_group: { title: 'Assign environment to group', ...WRITE_LOCAL },

  // export / import
  export_collection: { title: 'Export collection', ...WRITE_FILE },
  import_collection: { title: 'Import collection', ...DELETE_LOCAL },
  export_environment: { title: 'Export environment', ...WRITE_FILE },
  import_environment: { title: 'Import environment', ...DELETE_LOCAL },
  export_postman_collection: { title: 'Export Postman collection', ...WRITE_FILE },
  import_postman_collection: { title: 'Import Postman collection', ...DELETE_LOCAL },
  export_postman_environment: { title: 'Export Postman environment', ...WRITE_FILE },
  import_postman_environment: { title: 'Import Postman environment', ...DELETE_LOCAL },
} satisfies Record<string, ToolAnnotations>
