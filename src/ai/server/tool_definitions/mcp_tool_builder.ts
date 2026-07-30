import type { McpToolName } from '../../shared/mcp_protocol_types.js';

/** JSON Schema-ish tool definition returned by tools/list. */
export interface McpToolDefinition {
  name: McpToolName;
  description: string;
  inputSchema: Record<string, unknown>;
}

/** Vector argument shape shared by many tool schemas. */
export const vec3Schema = {
  type: 'object',
  properties: {
    x: { type: 'number' },
    y: { type: 'number' },
    z: { type: 'number' },
  },
  required: ['x', 'y', 'z'],
};

/** Axis-aligned bounds argument shape shared by several tool schemas. */
export const boundsSchema = {
  type: 'object',
  properties: {
    min: vec3Schema,
    max: vec3Schema,
  },
  required: ['min', 'max'],
};

/** Snap opt-out properties shared by placement and transform tools. */
export const snapProps = {
  snap: {
    type: 'boolean',
    description: 'When false, skip grid/rotation snap. Default true when editor snap is on.',
  },
  exact: {
    type: 'boolean',
    description: 'When true, skip snap (same as snap:false). Use for precise placement like -17.125.',
  },
};

/**
 * Builds one tool definition.
 *
 * @param name Tool name.
 * @param description Human and model facing description.
 * @param inputSchema JSON schema for the tool arguments.
 * @returns Tool definition entry.
 */
export function tool(name: McpToolName, description: string, inputSchema: Record<string, unknown>): McpToolDefinition {
  return { name, description, inputSchema };
}

/**
 * Builds the schema for a tool that takes no arguments.
 *
 * @returns Empty object schema.
 */
export function emptySchema(): Record<string, unknown> {
  return { type: 'object', properties: {} };
}
