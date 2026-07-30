import { CONTEXT_TOOL_DEFINITIONS } from './tool_definitions/context_tool_definitions.js';
import { GREY_BOX_TOOL_DEFINITIONS } from './tool_definitions/grey_box_tool_definitions.js';
import { SOLID_READ_TOOL_DEFINITIONS } from './tool_definitions/solid_read_tool_definitions.js';
import { SOLID_WRITE_TOOL_DEFINITIONS } from './tool_definitions/solid_write_tool_definitions.js';
import { SPATIAL_TOOL_DEFINITIONS } from './tool_definitions/spatial_tool_definitions.js';
import type { McpToolDefinition } from './tool_definitions/mcp_tool_builder.js';

export type { McpToolDefinition } from './tool_definitions/mcp_tool_builder.js';

/**
 * Full tool catalog, composed from one file per domain so no single file owns
 * the whole surface.
 */
export const MCP_TOOL_DEFINITIONS: McpToolDefinition[] = [
  ...CONTEXT_TOOL_DEFINITIONS,
  ...SOLID_READ_TOOL_DEFINITIONS,
  ...SPATIAL_TOOL_DEFINITIONS,
  ...SOLID_WRITE_TOOL_DEFINITIONS,
  ...GREY_BOX_TOOL_DEFINITIONS,
];

/**
 * Returns the MCP tools/list payload.
 *
 * @returns Tool list wrapper.
 */
export function listMcpTools(): { tools: McpToolDefinition[] } {
  return { tools: MCP_TOOL_DEFINITIONS };
}

/**
 * Finds a tool definition by name.
 *
 * @param name Tool name from a tools/call request.
 * @returns Matching definition, or undefined when unknown.
 */
export function findMcpTool(name: string): McpToolDefinition | undefined {
  return MCP_TOOL_DEFINITIONS.find((definition) => definition.name === name);
}
