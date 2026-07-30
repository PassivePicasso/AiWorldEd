import { McpToolDefinition, emptySchema, tool, vec3Schema } from './mcp_tool_builder.js';

/**
 * What a grey box is, repeated into the tool descriptions so an agent reading
 * only the catalog understands the workflow.
 */
const GREY_BOX_PURPOSE =
  'Grey boxes are planning volumes, not geometry: they never compile into solid output and never export. ' +
  'They NEST: a volume contained by another describes a feature within that space - a ravine in a hall, a bridge ' +
  'over the ravine - not a separate room. Read them as the brief, then author real CSG brushes inside them.';

/** The fixity contract, repeated wherever an agent might act on dimensions. */
const GREY_BOX_FIXITY =
  'sizeIntent "exact" means the volume is measured and you must build to its dimensions; "approximate" means the ' +
  'shape is a suggestion you may refine.';

/** Grey box layout reading and authoring tools. */
export const GREY_BOX_TOOL_DEFINITIONS: McpToolDefinition[] = [
  tool(
    'list_grey_boxes',
    `Every grey box with id, name, description, role, size intent, surface hints, parent, children, depth, and ` +
      `what has already been built inside it. Call first when building to a layout. ${GREY_BOX_PURPOSE} ` +
      `${GREY_BOX_FIXITY}`,
    emptySchema(),
  ),
  tool(
    'get_grey_box',
    `One grey box in full: name, description, role, size intent, surface hints, its children, its relations, and ` +
      `what already occupies it. ownBrushCount is what was built in this volume itself; subtreeBrushCount includes ` +
      `everything nested inside, so you can tell an untouched volume from one you have already filled. ` +
      `${GREY_BOX_PURPOSE} ${GREY_BOX_FIXITY}`,
    {
      type: 'object',
      properties: { greyBoxId: { type: 'string' } },
      required: ['greyBoxId'],
    },
  ),
  tool(
    'get_grey_box_graph',
    'The whole layout brief in one call. rootGreyBoxIds are the outermost spaces; each node carries its parent, ' +
      'children, and depth, so the layout reads as a hierarchy. buildOrder suggests working outside in - a shell ' +
      'before the features cut into it - and is guidance, not a requirement. Edges carry every relation a pair holds: ' +
      '"contains" with a containment ratio, "adjacent" with the shared-face rect you size a doorway against, and ' +
      '"overlaps" with the intersecting box plus how much of each volume it consumes. Authored links add routes ' +
      'geometry cannot imply, such as an elevator or a one-way drop. Muted relations and unresolved links are ' +
      'reported separately. Nesting and intersection are normal in a blockout, not mistakes to fix - the editor ' +
      'reports what intersects and by how much, and leaves the judgement to you: a couple of percent is usually ' +
      'deliberate contact, two spaces half inside each other usually is not. Use the roles and descriptions to ' +
      'decide, and say so rather than silently building around it.',
    emptySchema(),
  ),
  tool(
    'create_grey_box',
    `Create a grey box planning volume (undoable). Place it inside an existing volume to describe a feature of ` +
      `that space. ${GREY_BOX_PURPOSE}`,
    {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Display name; auto-named when omitted.' },
        description: { type: 'string', description: 'Purpose of the volume, read back by layout tools.' },
        role: { type: 'string', description: 'Gameplay role; see set_grey_box_role for the known set.' },
        center: vec3Schema,
        size: vec3Schema,
      },
    },
  ),
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
  tool(
    'set_grey_box_intent',
    'Record authoring intent on a grey box (undoable). sizeIntent "exact" means the volume is measured and you must ' +
      'build to its dimensions; "approximate" means the shape is a suggestion you may refine. The surface fields are ' +
      'hints for how the space should feel — "wet stone, puddles" — not texture assignments.',
    {
      type: 'object',
      properties: {
        greyBoxId: { type: 'string' },
        sizeIntent: { type: 'string', enum: ['exact', 'approximate'] },
        surface: {
          type: 'object',
          properties: {
            floor: { type: 'string' },
            wall: { type: 'string' },
            ceiling: { type: 'string' },
            mood: { type: 'string' },
          },
        },
      },
      required: ['greyBoxId'],
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
