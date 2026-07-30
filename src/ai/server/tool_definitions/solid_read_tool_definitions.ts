import { McpToolDefinition, boundsSchema, emptySchema, tool } from './mcp_tool_builder.js';

/** Solid model and brush inspection tools. */
export const SOLID_READ_TOOL_DEFINITIONS: McpToolDefinition[] = [
  tool('list_solid_models', 'List solid models with brush counts and world bounds.', emptySchema()),
  tool(
    'get_solid_model',
    'Full solid model: ordered CSG brush list (evaluation order) plus nested hierarchy tree (solid root → csg_group → brush). Brushes include parentGroupId when nested under a compound group.',
    {
      type: 'object',
      properties: { modelId: { type: 'string' } },
      required: ['modelId'],
    },
  ),
  tool('get_brush', 'One brush summary (includes parentGroupId), or full vertices/planes when detail=full.', {
    type: 'object',
    properties: {
      brushId: { type: 'string' },
      detail: { type: 'string', enum: ['summary', 'full'] },
    },
    required: ['brushId'],
  }),
  tool(
    'get_csg_group',
    'One solid CSG compound group: operation, parentGroupId, childBrushIds, childGroupIds. Groups nest; each group has its own CSG operation when combined into its parent.',
    {
      type: 'object',
      properties: { groupId: { type: 'string', description: 'Solid CSG group uuid from hierarchy.' } },
      required: ['groupId'],
    },
  ),
  tool(
    'find_brushes',
    'Filter brushes without dumping everything. Filters: nameContains, shape (thin|pole|tall|flat|panel|flag|long|box), minHeight/maxHeight, region bounds, limit. Returns shape tags + summary per hit.',
    {
      type: 'object',
      properties: {
        modelId: { type: 'string' },
        nameContains: { type: 'string', description: 'Case-insensitive name substring, e.g. "flag".' },
        shape: {
          type: 'string',
          description: 'thin|pole|tall|flat|panel|flag|long|box|any',
        },
        minHeight: { type: 'number' },
        maxHeight: { type: 'number' },
        region: boundsSchema,
        limit: { type: 'number' },
      },
    },
  ),
  tool(
    'describe_brush',
    'One-line human summary: kind (thin vertical pole, flat panel/flag), approx size and center. Faster than reading localBounds/scale.',
    {
      type: 'object',
      properties: { brushId: { type: 'string' } },
      required: ['brushId'],
    },
  ),
  tool('validate_brush', 'Validate convex brush topology for one brush.', {
    type: 'object',
    properties: { brushId: { type: 'string' } },
    required: ['brushId'],
  }),
  tool('validate_solid_model', 'Validate all brushes and report simple CSG warnings.', {
    type: 'object',
    properties: { modelId: { type: 'string' } },
    required: ['modelId'],
  }),
];
