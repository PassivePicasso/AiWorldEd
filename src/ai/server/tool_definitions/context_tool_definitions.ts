import { McpToolDefinition, emptySchema, tool } from './mcp_tool_builder.js';

/** Editor context, snap, history, selection, and scene hierarchy tools. */
export const CONTEXT_TOOL_DEFINITIONS: McpToolDefinition[] = [
  tool(
    'get_editor_context',
    'Editor version, right-handed Y-up coordinates, snap settings, history counts, and selection summary. Call first when starting.',
    emptySchema(),
  ),
  tool(
    'get_snap_settings',
    'Snap enabled flag, translation interval, rotation snap degrees, and scale snap step.',
    emptySchema(),
  ),
  tool('undo', 'Undo the last editor command.', emptySchema()),
  tool('redo', 'Redo the last undone editor command.', emptySchema()),
  tool(
    'calculate',
    'Safe arithmetic helper (no eval). Supports + - * / parentheses and decimals. Example: expression "20+(0.5*12)" → 26. Use for half-widths, centers, gaps.',
    {
      type: 'object',
      properties: {
        expression: {
          type: 'string',
          description: 'Arithmetic expression, e.g. "20+(0.5*12)" or "(4+2)/2".',
        },
      },
      required: ['expression'],
    },
  ),
  tool(
    'get_scene_hierarchy',
    'Solid outliner tree: solid_model → csg_group (with operation) → brush (with operation). Groups may nest. Use this to understand nesting before reparent/group ops.',
    emptySchema(),
  ),
  tool('get_selection', 'Currently selected brushIds, groupIds (solid CSG groups), and solidModelIds.', emptySchema()),
];
