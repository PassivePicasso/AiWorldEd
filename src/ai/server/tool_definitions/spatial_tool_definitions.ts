import { McpToolDefinition, boundsSchema, snapProps, tool, vec3Schema } from './mcp_tool_builder.js';

/** Spatial query, measurement, and preview tools. */
export const SPATIAL_TOOL_DEFINITIONS: McpToolDefinition[] = [
  tool(
    'half_extents',
    'Half-size (halfExtents), full size, center, bounds, and six face centers (plusX/minusX/plusY/minusY/plusZ/minusZ) for alignment math without hand-halving AABBs.',
    {
      type: 'object',
      properties: { brushId: { type: 'string' } },
      required: ['brushId'],
    },
  ),
  tool('query_brush_bounds', 'World AABB for one brush or all brushes (optional model filter).', {
    type: 'object',
    properties: {
      modelId: { type: 'string' },
      brushId: { type: 'string' },
    },
  }),
  tool(
    'query_overlaps',
    'AABB overlap of brush volumes (NOT final CSG solid). Returns brushIds + brushes[{brushId,name,operation}]. Subtractive hits mean cutter volumes overlap — not solid rock. For solid|void use explain_csg_at_point.',
    {
      type: 'object',
      properties: {
        modelId: { type: 'string' },
        brushId: { type: 'string' },
        bounds: boundsSchema,
      },
    },
  ),
  tool(
    'query_point',
    'Brush volumes whose world AABB contains a point (NOT final CSG). Returns operation per hit. A subtractive hit does not mean the point is solid — call explain_csg_at_point for true solid|void.',
    {
      type: 'object',
      properties: {
        modelId: { type: 'string' },
        point: vec3Schema,
      },
      required: ['point'],
    },
  ),
  tool(
    'query_neighbors',
    'Nearest brush centers within radius. Returns rank, distance, name, operation, shape/kind. AABB/center based — not CSG solid. Optional limit for top N.',
    {
      type: 'object',
      properties: {
        modelId: { type: 'string' },
        brushId: { type: 'string' },
        point: vec3Schema,
        radius: { type: 'number' },
        limit: { type: 'number', description: 'Return only the nearest N neighbors.' },
      },
      required: ['radius'],
    },
  ),
  tool('measure', 'Distance between brushes/points, or size of one brush.', {
    type: 'object',
    properties: {
      fromBrushId: { type: 'string' },
      toBrushId: { type: 'string' },
      fromPoint: vec3Schema,
      toPoint: vec3Schema,
      brushId: { type: 'string' },
    },
  }),
  tool(
    'preview_transform',
    'Dry-run: predicted world bounds/size/center for a proposed position/rotationDegrees/scale without applying. Check "touches pole?" before commit. Supports snap:false.',
    {
      type: 'object',
      properties: {
        brushId: { type: 'string' },
        position: vec3Schema,
        rotationDegrees: vec3Schema,
        scale: vec3Schema,
        ...snapProps,
      },
      required: ['brushId'],
    },
  ),
  tool(
    'preview_new_box',
    'Dry-run create: same TRS fields as add_box_brush but does not create. Returns predicted worldBounds, center, worldSize. Use before committing geometry.',
    {
      type: 'object',
      properties: {
        modelId: { type: 'string' },
        size: { oneOf: [{ type: 'number' }, vec3Schema] },
        position: vec3Schema,
        rotationDegrees: vec3Schema,
        scale: vec3Schema,
        ...snapProps,
      },
      required: ['modelId'],
    },
  ),
  tool(
    'explain_csg_at_point',
    'TRUE solid|void at a world point via ordered CSG (respects additive/subtractive/intersecting and invertedWorld). Prefer this over query_point/query_overlaps when placing doors or checking cavities.',
    {
      type: 'object',
      properties: {
        point: vec3Schema,
        modelId: { type: 'string' },
      },
      required: ['point'],
    },
  ),
  tool(
    'query_void_connectivity',
    'APPROXIMATE only: do two void points connect? Line sample then coarse grid BFS. Can miss thin gaps or report false negatives. Not a navmesh. Prefer explain_csg_at_point for single-point solid|void.',
    {
      type: 'object',
      properties: {
        fromPoint: vec3Schema,
        toPoint: vec3Schema,
        modelId: { type: 'string' },
      },
      required: ['fromPoint', 'toPoint'],
    },
  ),
];
