import { McpToolDefinition, snapProps, tool, vec3Schema } from './mcp_tool_builder.js';

/** Solid model authoring tools: create, edit, order, and delete. */
export const SOLID_WRITE_TOOL_DEFINITIONS: McpToolDefinition[] = [
  tool('create_solid_model', 'Create a solid model with one additive unit box brush.', {
    type: 'object',
    properties: { name: { type: 'string' } },
  }),
  tool(
    'add_box_brush',
    'Add a convex box brush. Model-local, right-handed Y-up. Use rotationDegrees (not radians). Optional name. Optional parentGroupId to nest under a solid CSG group. Snaps unless snap:false or exact:true. operation: additive|subtractive|intersecting.',
    {
      type: 'object',
      properties: {
        modelId: { type: 'string' },
        size: {
          oneOf: [{ type: 'number' }, vec3Schema],
        },
        position: vec3Schema,
        rotationDegrees: vec3Schema,
        scale: vec3Schema,
        operation: { type: 'string', enum: ['additive', 'subtractive', 'intersecting'] },
        name: { type: 'string', description: 'Stable display name, e.g. path_north or def_pad_nw.' },
        parentGroupId: {
          type: 'string',
          description: 'Solid CSG group uuid; omit to parent under the solid model root.',
        },
        ...snapProps,
      },
      required: ['modelId'],
    },
  ),
  tool(
    'add_box_brushes',
    'Batch create many box brushes. Per entry: size/position/rotationDegrees/scale/operation/name/parentGroupId plus optional insertAfterName|insertBeforeName|insertAfterBrushId|insertBeforeBrushId for CSG order.',
    {
      type: 'object',
      properties: {
        modelId: { type: 'string' },
        brushes: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              size: { oneOf: [{ type: 'number' }, vec3Schema] },
              position: vec3Schema,
              rotationDegrees: vec3Schema,
              scale: vec3Schema,
              operation: { type: 'string', enum: ['additive', 'subtractive', 'intersecting'] },
              name: { type: 'string' },
              parentGroupId: { type: 'string' },
              insertAfterName: { type: 'string' },
              insertBeforeName: { type: 'string' },
              insertAfterBrushId: { type: 'string' },
              insertBeforeBrushId: { type: 'string' },
            },
          },
        },
        ...snapProps,
      },
      required: ['modelId', 'brushes'],
    },
  ),
  tool(
    'create_csg_group',
    'Group solid brushes and/or nested CSG groups into a new solid CSG compound (same as outliner Group). Members stay under the solid model. operation is the branch op when the group combines into its parent (default additive). Optional parentGroupId nests the new group under another group (must not be a member or under a member).',
    {
      type: 'object',
      properties: {
        modelId: { type: 'string' },
        brushIds: { type: 'array', items: { type: 'string' } },
        groupIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Existing solid CSG group uuids to nest under the new group.',
        },
        parentGroupId: {
          type: 'string',
          description: 'Parent solid CSG group uuid; omit for solid model root.',
        },
        name: { type: 'string' },
        operation: { type: 'string', enum: ['additive', 'subtractive', 'intersecting'] },
      },
      required: ['modelId'],
    },
  ),
  tool(
    'set_group_operation',
    'Set CSG operation on solid CSG groups (branch ops). Additive keeps yellow folder in outliner; subtractive/intersecting show red/blue badges. Rebuilds solid CSG.',
    {
      type: 'object',
      properties: {
        groupIds: { type: 'array', items: { type: 'string' } },
        operation: { type: 'string', enum: ['additive', 'subtractive', 'intersecting'] },
      },
      required: ['groupIds', 'operation'],
    },
  ),
  tool(
    'ungroup_csg_groups',
    'Dissolve solid CSG groups; children reparent to the former group parent (solid root or outer group). Undoable. Rebuilds CSG.',
    {
      type: 'object',
      properties: { groupIds: { type: 'array', items: { type: 'string' } } },
      required: ['groupIds'],
    },
  ),
  tool(
    'reparent_solid_nodes',
    'Move solid brushes and/or CSG groups under a solid model root or another CSG group in the same solid (outliner drag). parentId = modelId or groupId. Optional insertBeforeId (brush or group) for sibling order. Same solid only; no cycles.',
    {
      type: 'object',
      properties: {
        nodeIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Brush ids and/or solid CSG group uuids.',
        },
        parentId: {
          type: 'string',
          description: 'Destination solid model uuid (root) or solid CSG group uuid.',
        },
        insertBeforeId: {
          type: 'string',
          description: 'Optional sibling brush id or group uuid to insert before.',
        },
      },
      required: ['nodeIds', 'parentId'],
    },
  ),
  tool('rename_group', 'Rename a solid CSG group (outliner display name).', {
    type: 'object',
    properties: {
      groupId: { type: 'string' },
      name: { type: 'string' },
    },
    required: ['groupId', 'name'],
  }),
  tool(
    'place_wall',
    'Vertical wall from {x,z}→{x,z}. size={thickness,height,length}; yaw aligns local +Z with the segment (atan2(dx,dz)). baseY is bottom (default 0); center Y = baseY+height/2. Axis-aligned openings need add_opening with targetBrushId.',
    {
      type: 'object',
      properties: {
        modelId: { type: 'string' },
        from: { type: 'object', properties: { x: { type: 'number' }, z: { type: 'number' } }, required: ['x', 'z'] },
        to: { type: 'object', properties: { x: { type: 'number' }, z: { type: 'number' } }, required: ['x', 'z'] },
        height: { type: 'number' },
        thickness: { type: 'number' },
        baseY: { type: 'number', description: 'Bottom of wall (default 0).' },
        operation: { type: 'string', enum: ['additive', 'subtractive', 'intersecting'] },
        name: { type: 'string' },
        ...snapProps,
      },
      required: ['modelId', 'from', 'to', 'height', 'thickness'],
    },
  ),
  tool(
    'add_room_shell',
    'Hollow room shell: floor + four wall panels + optional ceiling. size is exterior AABB; position is center (default y=size.y/2 so floor sits on 0). Walls already leave interior empty. carveInterior (default true) adds a slight interior nibble cut. Names: {prefix}_wall_front (+Z), _back (-Z), _left (-X), _right (+X). Then use add_opening with targetBrushId on a wall.',
    {
      type: 'object',
      properties: {
        modelId: { type: 'string' },
        size: { ...vec3Schema, description: 'Exterior width (x), full height (y), depth (z).' },
        position: { ...vec3Schema, description: 'Room center. Default {0, size.y/2, 0}.' },
        wallThickness: { type: 'number' },
        floorThickness: { type: 'number' },
        ceilingThickness: { type: 'number', description: '0 = no ceiling. Default = floor/wall thickness.' },
        carveInterior: { type: 'boolean', description: 'Optional interior subtract (default true).' },
        name: { type: 'string', description: 'Name prefix for pieces (default "room").' },
        ...snapProps,
      },
      required: ['modelId', 'size', 'wallThickness'],
    },
  ),
  tool(
    'cut_opening',
    'Minimal subtractive hole. position = hole center; size = full {x,y,z} extents. Always subtractive. Does not snap to a wall — prefer add_opening with targetBrushId for doors/windows.',
    {
      type: 'object',
      properties: {
        modelId: { type: 'string' },
        position: { ...vec3Schema, description: 'Center of the subtractive box.' },
        size: { ...vec3Schema, description: 'Full extents through the wall on the thin axis.' },
        name: { type: 'string' },
        ...snapProps,
      },
      required: ['modelId', 'position', 'size'],
    },
  ),
  tool(
    'add_opening',
    'Door/window through an axis-aligned wall. STRONGLY prefer targetBrushId (wall brush): snaps cut to wall midplane, uses wall thickness as depth, reorders cut after that wall. position = opening center on the wall face (along-wall XZ + vertical); sillHeight = bottom Y of hole (overrides position.y). size {width,height,depth?}. wall front|back|left|right only sets thickness axis. Doors omit bottom frame strip. Frames default on; mullions default off.',
    {
      type: 'object',
      properties: {
        modelId: { type: 'string' },
        kind: { type: 'string', enum: ['window', 'door'] },
        targetBrushId: {
          type: 'string',
          description: 'Wall brush to cut. Snaps midplane, depth, and CSG order after wall.',
        },
        wall: {
          type: 'string',
          enum: ['front', 'back', 'left', 'right'],
          description: 'Named side for thickness axis only (front=+Z). Prefer targetBrushId.',
        },
        axis: { type: 'string', enum: ['x', 'z'], description: 'Through-wall axis when wall omitted.' },
        direction: { type: 'number', description: 'Legacy unused field.' },
        position: {
          ...vec3Schema,
          description: 'Opening center. With targetBrushId, through-wall coord is replaced by wall midplane.',
        },
        size: {
          type: 'object',
          properties: {
            width: { type: 'number', description: 'Along-wall width.' },
            height: { type: 'number', description: 'Vertical height.' },
            depth: { type: 'number', description: 'Through-wall depth; default wall thickness.' },
          },
          required: ['width', 'height'],
        },
        wallThickness: { type: 'number', description: 'Depth fallback when size.depth and targetBrushId omit it.' },
        sillHeight: {
          type: 'number',
          description: 'Bottom Y of opening (door floor top or window sill). Sets center Y = sill + height/2.',
        },
        addFrame: { type: 'boolean', description: 'Frame strips (default true). Doors skip bottom strip.' },
        addMullions: { type: 'boolean', description: 'Center mullion (default false). Avoid for doors.' },
        name: { type: 'string' },
        ...snapProps,
      },
      required: ['modelId', 'kind', 'position', 'size'],
    },
  ),
  tool('set_brush_operation', 'Set CSG operation on brushes.', {
    type: 'object',
    properties: {
      brushIds: { type: 'array', items: { type: 'string' } },
      operation: { type: 'string', enum: ['additive', 'subtractive', 'intersecting'] },
    },
    required: ['brushIds', 'operation'],
  }),
  tool(
    'set_brush_transform',
    'Set brush local position / rotationDegrees / scale (any subset). Snaps when snap is on. Pass snap:false or exact:true to bypass snap (e.g. keep -17.125). Returns applied transform with rotationDegrees.',
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
    'batch_set_brush_transform',
    'Move/rotate/scale several brushes in one call. transforms[] entries match set_brush_transform fields. Optional top-level snap/exact default for all entries.',
    {
      type: 'object',
      properties: {
        transforms: {
          type: 'array',
          items: {
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
        },
        ...snapProps,
      },
      required: ['transforms'],
    },
  ),
  tool(
    'align_brush',
    'Attach brushId to targetBrushId without hand-computing half-widths. mode "top" = stack on target top; "bottom" = hang under; "side" = touch on axis x|z (direction 1|-1). gap between faces (default 0). center free axes (default true). Supports snap:false.',
    {
      type: 'object',
      properties: {
        brushId: { type: 'string', description: 'Brush to move.' },
        targetBrushId: { type: 'string', description: 'Anchor brush.' },
        mode: { type: 'string', enum: ['top', 'bottom', 'side'] },
        axis: { type: 'string', enum: ['x', 'z'], description: 'For mode side.' },
        direction: { type: 'number', description: 'For mode side: 1 = +axis face, -1 = -axis face.' },
        gap: { type: 'number' },
        center: { type: 'boolean' },
        ...snapProps,
      },
      required: ['brushId', 'targetBrushId', 'mode'],
    },
  ),
  tool(
    'rotate_brush',
    'Simple brush rotate in degrees. Default axis y (yaw). Relative unless absolute=true. Uses rotation snap when snap is on unless snap:false. Prefer this over raw Euler for turns.',
    {
      type: 'object',
      properties: {
        brushId: { type: 'string' },
        degrees: { type: 'number' },
        axis: { type: 'string', enum: ['x', 'y', 'z'] },
        absolute: { type: 'boolean' },
        ...snapProps,
      },
      required: ['brushId', 'degrees'],
    },
  ),
  tool(
    'rename_brush',
    'Set a stable display name (e.g. start_a_flag, path_north, def_pad_nw) so find_brushes can locate pieces without hunting UUIDs. Undoable.',
    {
      type: 'object',
      properties: {
        brushId: { type: 'string' },
        name: { type: 'string' },
      },
      required: ['brushId', 'name'],
    },
  ),
  tool(
    'clip_brush',
    'Plane-clip ONE brush topology (not CSG subtract). Plane is WORLD-space: axis+distance (e.g. cut at world x=distance), or point+normal, or three points. keepFront (default true) keeps +axis/normal side. Use for bevels/ramps on a single brush; prefer add_opening/cut_opening for doors in walls. Undoable.',
    {
      type: 'object',
      properties: {
        brushId: { type: 'string' },
        axis: { type: 'string', enum: ['x', 'y', 'z'] },
        distance: { type: 'number', description: 'World coordinate of axis-aligned plane.' },
        point: vec3Schema,
        normal: vec3Schema,
        pointA: vec3Schema,
        pointB: vec3Schema,
        pointC: vec3Schema,
        keepFront: { type: 'boolean' },
      },
      required: ['brushId'],
    },
  ),
  tool(
    'split_brush',
    'Split ONE brush into two along a WORLD plane (same plane args as clip_brush). Replaces source with two pieces. Prefer for permanent geometry splits, not door holes (use add_opening). Undoable.',
    {
      type: 'object',
      properties: {
        brushId: { type: 'string' },
        axis: { type: 'string', enum: ['x', 'y', 'z'] },
        distance: { type: 'number', description: 'World coordinate of axis-aligned plane.' },
        point: vec3Schema,
        normal: vec3Schema,
        pointA: vec3Schema,
        pointB: vec3Schema,
        pointC: vec3Schema,
      },
      required: ['brushId'],
    },
  ),
  tool('delete_brushes', 'Delete brushes by id (undoable).', {
    type: 'object',
    properties: { brushIds: { type: 'array', items: { type: 'string' } } },
    required: ['brushIds'],
  }),
  tool(
    'duplicate_brushes',
    'Duplicate brushes and/or solid CSG groups (groupIds clones the whole nested compound). createdIds are brush ids only; data.groupIds has new group uuids. Optional local offset (default +1 on X). Optional mirrorAxis x|z + mirrorPlane after copy.',
    {
      type: 'object',
      properties: {
        brushIds: { type: 'array', items: { type: 'string' } },
        groupIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Solid CSG group uuids to clone with nested children.',
        },
        offset: vec3Schema,
        mirrorAxis: { type: 'string', enum: ['x', 'z'] },
        mirrorPlane: { type: 'number' },
        ...snapProps,
      },
    },
  ),
  tool(
    'mirror_brushes',
    'Mirror across X or Z. Position reflects through plane; yaw becomes -yaw (X) or π-yaw (Z). copy:true (default) duplicates then mirrors; copy:false moves in place. plane is the axis coordinate (default 0).',
    {
      type: 'object',
      properties: {
        brushIds: { type: 'array', items: { type: 'string' } },
        axis: { type: 'string', enum: ['x', 'z'] },
        plane: { type: 'number', description: 'Plane coordinate on the chosen axis (default 0).' },
        copy: { type: 'boolean' },
        ...snapProps,
      },
      required: ['brushIds', 'axis'],
    },
  ),
  tool(
    'reorder_brushes',
    'Move brushes and/or solid CSG groups to first or last among siblings under their own parent (outliner To First/Last). Nested groups reorder inside their parent only.',
    {
      type: 'object',
      properties: {
        brushIds: { type: 'array', items: { type: 'string' } },
        groupIds: { type: 'array', items: { type: 'string' } },
        end: { type: 'string', enum: ['first', 'last'] },
      },
      required: ['end'],
    },
  ),
  tool(
    'reorder_brush_relative',
    'Move one brush before or after another (by relativeToBrushId or relativeToName). placement: before|after. Undoable. Prefer over first/last when inserting a cut after a wall.',
    {
      type: 'object',
      properties: {
        brushId: { type: 'string' },
        relativeToBrushId: { type: 'string' },
        relativeToName: { type: 'string' },
        placement: { type: 'string', enum: ['before', 'after'] },
      },
      required: ['brushId', 'placement'],
    },
  ),
  tool(
    'set_inverted_world',
    'ADVANCED. Default false: space starts void; additive brushes create solid; subtractive brushes carve holes from prior solid. inverted=true: space starts solid and subtractives dig voids (Source-style). Leave false for normal box maps and room shells. Do NOT enable just to cut doors.',
    {
      type: 'object',
      properties: {
        modelId: { type: 'string' },
        inverted: { type: 'boolean' },
      },
      required: ['modelId', 'inverted'],
    },
  ),
  tool('select', 'Select brushes by id in the editor UI.', {
    type: 'object',
    properties: { brushIds: { type: 'array', items: { type: 'string' } } },
    required: ['brushIds'],
  }),
];
