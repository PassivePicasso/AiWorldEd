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

/**
 * Granularity guidance for authoring a layout rather than reading one. Agents
 * asked to block out a scene stop at room-sized volumes and write the contents
 * into descriptions instead of placing them.
 */
const GREY_BOX_AUTHORING =
  'AUTHORING GRANULARITY: do not stop at room-sized volumes. Whatever the scene is, the things inside a space get ' +
  'their own nested volumes - a bridge over a ravine, a staircase, a kitchen island, a filing cabinet, a crate. ' +
  'The test is not whether something counts as level geometry: if you are about to write a noun into a ' +
  'description and that noun has a location and a size, place it as a volume instead. Solid masses count as much ' +
  'as open space - a column or a refrigerator marks where matter IS, not where anyone walks. role accepts any ' +
  'string, so nothing has to be forced into a gameplay category to be blocked out. A layout in which every volume ' +
  'is a root with no children is almost always under-boxed.';

/**
 * What a group is, so an agent does not read one as a space to build in. Groups
 * organize; volumes describe.
 */
const GREY_BOX_GROUPS =
  'A grey box group is a folder, not a space: kind "group" in the layout reads. It holds volumes and other groups ' +
  'so a large blockout stays navigable, carries no geometry of its own, and takes its center and size from what ' +
  "it holds - never build to a group's dimensions. Grouping is an organizing choice and says nothing about the " +
  'layout, so reach for it when a wing or a floor has grown too many volumes to scan, not as a substitute for ' +
  'nesting a feature inside the volume that really contains it.';

/** Containment-derived nesting keeps the hierarchy spatially true. */
const GREY_BOX_CONTAINMENT =
  'Parenting is derived from geometry, so the hierarchy is always spatially true: a volume nests under another ' +
  'only when it really sits inside it, which is what lets a parent stand for an area you could ask a question ' +
  'about. A feature that overhangs its parent becomes a root instead of a child, with no error - read a volume ' +
  'you meant to nest coming back at depth 0 as a question about the layout rather than a snag. When a feature ' +
  'spans two spaces, such as a bridge landing on both banks of a ravine, the usual answer is that the enclosing ' +
  'area is missing: create the volume for the whole place and nest the banks, the water, and the bridge inside ' +
  'it. Naming that area is a design statement, not bookkeeping - it says these parts are one space.';

/** Grey box layout reading and authoring tools. */
export const GREY_BOX_TOOL_DEFINITIONS: McpToolDefinition[] = [
  tool(
    'list_grey_boxes',
    `Every grey box with id, kind, name, description, role, size intent, surface hints, parent, children, depth, ` +
      `and what has already been built inside it. Call first when building to a layout. ${GREY_BOX_PURPOSE} ` +
      `${GREY_BOX_FIXITY} ${GREY_BOX_GROUPS}`,
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
      'decide, and say so rather than silently building around it. This report is informational, not a lint: ' +
      'an empty problems array does not mean the layout is good, and resizing volumes purely to remove an ' +
      'overlap usually destroys the nesting that describes a feature. When reading your own authored layout, ' +
      'check the shape of the hierarchy too - if rootGreyBoxIds is nearly as long as the volume list, the ' +
      'layout is a flat list of rooms and the features inside them have not been boxed out yet.',
    emptySchema(),
  ),
  tool(
    'create_grey_box',
    `Create a grey box planning volume (undoable). Place it inside an existing volume to describe a feature of ` +
      `that space. ${GREY_BOX_PURPOSE} ${GREY_BOX_AUTHORING} ${GREY_BOX_CONTAINMENT}`,
    {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Display name; auto-named when omitted.' },
        description: { type: 'string', description: 'Purpose of the volume, read back by layout tools.' },
        role: { type: 'string', description: 'Gameplay role; see set_grey_box_role for the known set.' },
        center: vec3Schema,
        size: vec3Schema,
        parentGreyBoxId: {
          type: 'string',
          description: 'Group or volume to create this one under. Omit for the scene root. center stays world-space.',
        },
      },
    },
  ),
  tool(
    'create_grey_box_group',
    `Create a grey box group and optionally move volumes into it, as one undo step (undoable). ${GREY_BOX_GROUPS}`,
    {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Display name; auto-named when omitted.' },
        description: { type: 'string', description: 'What this group collects.' },
        parentGreyBoxId: { type: 'string', description: 'Group to nest this one under. Omit for the scene root.' },
        greyBoxIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Grey boxes moved into the new group.',
        },
      },
    },
  ),
  tool(
    'reparent_grey_boxes',
    `Move grey boxes and groups under a different parent (undoable). Moving a volume into another volume states ` +
      `containment the geometry does not imply, and that stated parent wins over the geometric guess. ` +
      `${GREY_BOX_GROUPS}`,
    {
      type: 'object',
      properties: {
        greyBoxIds: { type: 'array', items: { type: 'string' } },
        parentGreyBoxId: { type: 'string', description: 'Destination. Omit to move them back out to the scene root.' },
      },
      required: ['greyBoxIds'],
    },
  ),
  tool(
    'ungroup_grey_box_groups',
    'Dissolve grey box groups, leaving their contents where the group was (undoable). The volumes are untouched.',
    {
      type: 'object',
      properties: {
        greyBoxIds: { type: 'array', items: { type: 'string' } },
      },
      required: ['greyBoxIds'],
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
  tool('set_grey_box_transform', `Move and resize a grey box volume (undoable). ${GREY_BOX_CONTAINMENT}`, {
    type: 'object',
    properties: {
      greyBoxId: { type: 'string' },
      center: vec3Schema,
      size: vec3Schema,
    },
    required: ['greyBoxId'],
  }),
  tool(
    'delete_grey_boxes',
    'Delete grey boxes by id (undoable). Authored links pointing at them are pruned too. Deleting a group takes ' +
      'everything inside it - call ungroup_grey_box_groups first to keep the contents.',
    {
      type: 'object',
      properties: {
        greyBoxIds: { type: 'array', items: { type: 'string' } },
      },
      required: ['greyBoxIds'],
    },
  ),
  tool(
    'connect_grey_boxes',
    'State a route between two grey boxes that geometry does not imply — an elevator, a one-way drop, a locked ' +
      'door (undoable). Volumes that already share a face are connected implicitly; use this to annotate that ' +
      'contact or to link volumes that do not touch. Not a substitute for geometry: anything the player ' +
      'physically walks on is a volume, not a link. A bridge, catwalk, stair, or ramp should be created with ' +
      'create_grey_box and nested in the space it crosses; reserve authored links for routes with no walkable ' +
      'volume of their own. Note the editor has no moving-brush support, so a lift cannot be built - prefer ' +
      'stairs or a ramp, or model the platform statically in its raised position and say so in the note.',
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
