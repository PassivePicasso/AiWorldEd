import { McpToolDefinition, emptySchema, tool, vec3Schema } from './mcp_tool_builder.js';

/**
 * What a grey box is, repeated into the tool descriptions so an agent reading
 * only the catalog understands the workflow.
 */
const GREY_BOX_PURPOSE =
  'Grey boxes are planning volumes, not geometry: they never compile into solid output and never export. ' +
  'Read them as the brief for what to build, then author real CSG brushes inside them.';

/** Grey box layout reading and authoring tools. */
export const GREY_BOX_TOOL_DEFINITIONS: McpToolDefinition[] = [
  tool(
    'list_grey_boxes',
    `Every grey box with id, name, description, world bounds, and size. Call first when building to a layout. ${GREY_BOX_PURPOSE}`,
    emptySchema(),
  ),
  tool(
    'get_grey_box',
    `One grey box in full: name, description, bounds, its merged connections, and what already occupies it ` +
      `(solid models and brush counts inside its volume) so you can tell an empty volume from a populated one. ${GREY_BOX_PURPOSE}`,
    {
      type: 'object',
      properties: { greyBoxId: { type: 'string' } },
      required: ['greyBoxId'],
    },
  ),
  tool(
    'get_grey_box_graph',
    'The whole layout graph in one call: nodes with name and description, edges with kind, direction, shared-face ' +
      'rect and area, and whether each edge is derived from geometry or authored by the user. Muted adjacencies and ' +
      'unresolved authored links are reported separately. Use this to plan a level that follows the blocked-out layout.',
    emptySchema(),
  ),
  tool('create_grey_box', `Create a grey box planning volume (undoable). ${GREY_BOX_PURPOSE}`, {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Display name; auto-named when omitted.' },
      description: { type: 'string', description: 'Purpose of the volume, read back by layout tools.' },
      role: { type: 'string', description: 'Gameplay role; see set_grey_box_role for the known set.' },
      center: vec3Schema,
      size: vec3Schema,
    },
  }),
  tool('rename_grey_box', 'Rename a grey box (undoable).', {
    type: 'object',
    properties: {
      greyBoxId: { type: 'string' },
      name: { type: 'string' },
    },
    required: ['greyBoxId', 'name'],
  }),
  tool('set_grey_box_description', 'Replace a grey box description (undoable). Empty string clears it.', {
    type: 'object',
    properties: {
      greyBoxId: { type: 'string' },
      description: { type: 'string' },
    },
    required: ['greyBoxId', 'description'],
  }),
  tool(
    'set_grey_box_role',
    'Set a grey box gameplay role (undoable). Known roles: room, corridor, bridge, ledge, platform, pit, ravine, ' +
      'cover, hazard, landmark, objective, spawn, transition. Any other string is accepted. The role colours the ' +
      'volume in the editor and tells you what the space is for.',
    {
      type: 'object',
      properties: {
        greyBoxId: { type: 'string' },
        role: { type: 'string' },
      },
      required: ['greyBoxId', 'role'],
    },
  ),
  tool('set_grey_box_transform', 'Move and resize a grey box volume (undoable).', {
    type: 'object',
    properties: {
      greyBoxId: { type: 'string' },
      center: vec3Schema,
      size: vec3Schema,
    },
    required: ['greyBoxId'],
  }),
  tool('delete_grey_boxes', 'Delete grey boxes by id (undoable). Authored links pointing at them are pruned too.', {
    type: 'object',
    properties: {
      greyBoxIds: { type: 'array', items: { type: 'string' } },
    },
    required: ['greyBoxIds'],
  }),
  tool(
    'connect_grey_boxes',
    'State a route between two grey boxes that geometry does not imply — an elevator, a one-way drop, a locked ' +
      'door (undoable). Volumes that already share a face are connected implicitly; use this to annotate that ' +
      'contact or to link volumes that do not touch.',
    {
      type: 'object',
      properties: {
        greyBoxId: { type: 'string', description: 'Volume that owns the link.' },
        targetGreyBoxId: { type: 'string' },
        kind: { type: 'string', description: 'Free-form route label such as door, corridor, stairs, elevator.' },
        note: { type: 'string' },
        direction: { type: 'string', enum: ['bidirectional', 'forward'] },
      },
      required: ['greyBoxId', 'targetGreyBoxId'],
    },
  ),
  tool(
    'disconnect_grey_boxes',
    'Remove an authored link by connection id, or mute a geometry-derived adjacency between two volumes (undoable).',
    {
      type: 'object',
      properties: {
        greyBoxId: { type: 'string', description: 'Volume that owns the link or records the mute.' },
        connectionId: { type: 'string', description: 'Authored link to remove.' },
        targetGreyBoxId: { type: 'string', description: 'With no connectionId, mutes the derived adjacency instead.' },
      },
      required: ['greyBoxId'],
    },
  ),
];
