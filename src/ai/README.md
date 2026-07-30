# AI World Editor — MCP (desktop)

The Electrobun desktop build can host a **local Model Context Protocol (MCP)** endpoint so external AI clients (Grok Build, Claude Desktop, Cursor, etc.) can inspect and edit **convex solid-model brushes** in the live map.

This is **not** available in the GitHub Pages / browser build.

## Start the server

1. Run the **desktop** app (`bun run desktop:dev` or a packaged Electrobun build).
2. Click the **MCP** icon on the **main toolbar** (rightmost control).
3. Click **Start server**.
4. Copy the **URL** (for example `http://127.0.0.1:18765/mcp`).

No token or password is required. The server only listens on this computer (`127.0.0.1`).

## Connect Grok Build

In `~/.grok/config.toml` (or via `grok mcp add`):

```toml
[mcp_servers.aiworlded]
url = "http://127.0.0.1:18765/mcp"
enabled = true
```

Use the exact URL from the dialog if the port is not `18765`.

CLI equivalent:

```bash
grok mcp add --transport http aiworlded http://127.0.0.1:18765/mcp
```

Keep the editor open with MCP started while Grok uses the tools.

## Coordinate system

- Three.js **right-handed**, **Y-up**
- Brush transforms are **model-local** unless a field is labeled world
- CSG operations: `additive` | `subtractive` | `intersecting`
- Brush **order** is evaluation order (first → last), depth-first over the hierarchy

## Solid hierarchy (outliner / CSG groups)

Solid models are trees, not flat brush lists:

```
solid_model
├── brush (additive | subtractive | intersecting)
├── csg_group (operation when the group combines into its parent)
│   ├── brush
│   └── csg_group
│       └── brush
└── brush
```

| Concept             | Details                                                                                                                                                                  |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Solid CSG group** | Outliner folder under a solid. Combines its children as one compound, then applies the **group operation** into the parent.                                              |
| **Nesting**         | Groups may contain brushes and other groups. `parentGroupId` on brushes / groups is `null` when parented under the solid root.                                           |
| **Operations**      | Brushes: `set_brush_operation`. Groups: `set_group_operation`. Additive groups look like normal yellow folders; subtractive/intersecting show red/blue badges in the UI. |
| **CSG order**       | Evaluation walks the scene depth-first. Sibling order under a parent matters (`reorder_brushes` / `reorder_brush_relative` / `insertBeforeId` on reparent).              |

### Hierarchy tools

| Tool                   | Purpose                                                                                                                                           |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `get_scene_hierarchy`  | Full outliner tree (`solid_model` → `csg_group` → `brush`) with operations                                                                        |
| `get_solid_model`      | Flat brush list (evaluation order) **plus** nested `hierarchy`                                                                                    |
| `get_csg_group`        | One group: children, `parentGroupId`, operation                                                                                                   |
| `create_csg_group`     | Group `brushIds` / `groupIds` into a new compound (`parentGroupId`, `operation`, `name`). `parentGroupId` must not be a member or under a member. |
| `set_group_operation`  | Branch op on groups                                                                                                                               |
| `ungroup_csg_groups`   | Dissolve groups; children rise to the former parent                                                                                               |
| `reparent_solid_nodes` | Move nodes under model root or another group (`parentId`, optional `insertBeforeId`)                                                              |
| `rename_group`         | Outliner display name (undoable)                                                                                                                  |
| `add_box_brush`        | Optional `parentGroupId` to spawn under a group                                                                                                   |
| `duplicate_brushes`    | `brushIds` and/or `groupIds` (group clone keeps nesting). `createdIds` = brush ids; group uuids in `data.groupIds`.                               |
| `reorder_brushes`      | `brushIds` and/or `groupIds` → first/last among siblings                                                                                          |

**Brush-only tools (no `groupIds`):** `delete_brushes`, `select`, `mirror_brushes`, `find_brushes`. Find groups via `get_scene_hierarchy` / `get_csg_group`.

**Workflow example:** build wall pieces → `create_csg_group` with those `brushIds` and `operation: "subtractive"` → nest a cutter under that group with `add_box_brush` + `parentGroupId` (or `reparent_solid_nodes`) → `duplicate_brushes` with `groupIds` to copy the whole compound.

Same-solid only: reparent/group never moves a brush out of its solid model root.

## CSG: solid vs brush AABB (critical)

| Tool                                                 | What it measures                                                        |
| ---------------------------------------------------- | ----------------------------------------------------------------------- |
| `query_point` / `query_overlaps` / `query_neighbors` | **Brush volume AABBs** — includes subtractive cutters as hits           |
| `explain_csg_at_point`                               | **Final solid or void** after ordered CSG (use this for doors/cavities) |
| `query_void_connectivity`                            | Approximate path between two voids (coarse grid; not navmesh)           |

**Default workflow (leave `invertedWorld` false):** space starts empty → additive brushes create solid → subtractive brushes carve holes **only where they overlap prior solid**. A floating subtractive that does not overlap an additive does nothing.

**Do not enable `set_inverted_world` for normal room shells / door cuts.** Inverted mode starts the universe solid so subtractives dig space (advanced).

**Doors:** use `add_opening` / `cut_opening` (subtractive boxes through walls), not `clip_brush`. Clip/split change **one brush’s topology** along a world plane (ramps, bevels, permanent cuts).

## Walls, rooms, openings (math)

| Piece            | Placement rule                                                                                                                                                                                                                                                                                                          |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `place_wall`     | Centerline `from`→`to` on XZ. Box size `{thickness, height, length}`. Yaw = `atan2(dx, dz)` so local **+Z** follows the segment. Bottom = `baseY` (default 0).                                                                                                                                                          |
| `add_room_shell` | Exterior AABB `size`; `position` is center (default floor on y=0). Front wall at **+Z**, back **−Z**, left **−X**, right **+X**. Side walls are shortened so corners do not double-stack.                                                                                                                               |
| `cut_opening`    | Subtractive box; **position is the hole center**, `size` is full extents. No auto wall align.                                                                                                                                                                                                                           |
| `add_opening`    | Prefer **`targetBrushId`** = wall brush. Snaps cut to wall **midplane**, uses wall thickness as depth (+ small overcut), reorders cut **after** that wall. `sillHeight` = bottom of hole → center Y = sill + height/2. Doors skip bottom frame strip. **Axis-aligned walls only** (not diagonal `place_wall` segments). |

**Door example:** build room → `find_brushes` nameContains `wall_front` → `add_opening` with `kind: "door"`, `targetBrushId`, `sillHeight` = floor top, `size: { width, height }`, `position` along the wall (x/z of doorway center; y ignored when sillHeight set), `snap: false`.

## Core tools

| Tool                                                               | Purpose                                                    |
| ------------------------------------------------------------------ | ---------------------------------------------------------- |
| `get_editor_context`                                               | Snap, history, selection, coords                           |
| `calculate`                                                        | Safe arithmetic (`20+(0.5*12)`), no eval                   |
| `list_solid_models` / `get_solid_model` / `get_brush`              | Inventory (+ hierarchy on model detail)                    |
| `get_scene_hierarchy` / `get_csg_group` / `get_selection`          | Tree, group detail, brush+group selection                  |
| `find_brushes` / `describe_brush` / `half_extents`                 | Filter; summaries; half-size + face centers                |
| `query_overlaps` / `query_point` / `query_neighbors` / `measure`   | Spatial planning                                           |
| `preview_transform` / `preview_new_box`                            | Dry-run existing or new box bounds                         |
| `explain_csg_at_point` / `query_void_connectivity`                 | CSG solid/void; approx cavity path                         |
| `validate_brush` / `validate_solid_model`                          | Topology checks                                            |
| `list_grey_boxes` / `get_grey_box` / `get_grey_box_graph`          | Read the grey box layout brief (hierarchy + relations)     |
| `create_grey_box` / `rename_grey_box` / `set_grey_box_description` | Author planning volumes                                    |
| `set_grey_box_role` / `set_grey_box_intent`                        | Classify a volume; record fixity and surface feel          |
| `set_grey_box_transform` / `delete_grey_boxes`                     | Move, resize, remove volumes                               |
| `connect_grey_boxes` / `disconnect_grey_boxes`                     | State or mute routes between volumes                       |
| `create_solid_model` / `add_box_brush` / `add_box_brushes`         | Create geometry (`parentGroupId` supported)                |
| `create_csg_group` / `set_group_operation` / `ungroup_csg_groups`  | Hierarchy compounds                                        |
| `reparent_solid_nodes` / `rename_group`                            | Nest / rename groups and brushes                           |
| `place_wall` / `add_room_shell` / `cut_opening` / `add_opening`    | Walls, rooms, door/window cuts                             |
| `set_brush_transform` / `batch_set_brush_transform`                | Pose edits (`snap:false` for exact)                        |
| `align_brush`                                                      | Stack on top / hang under / touch side                     |
| `rotate_brush`                                                     | Rotate in **degrees** (default Y/yaw)                      |
| `rename_brush`                                                     | Stable names (`start_a_flag`, …)                           |
| `clip_brush` / `split_brush`                                       | Plane cut / split into two                                 |
| `delete_brushes` / `duplicate_brushes` / `mirror_brushes`          | Delete/mirror: brushes only; duplicate supports `groupIds` |
| `reorder_brushes` / `reorder_brush_relative`                       | Sibling order (ends or before/after)                       |
| `set_inverted_world` / `select` / `undo` / `redo`                  | Session                                                    |

### AI level-building tips

- **Names (brushes):** pass `name` on `add_box_brush` / `add_box_brushes`, or `rename_brush`, then `find_brushes` with `nameContains`.
- **Names (groups):** `rename_group` / `create_csg_group` `name`; locate with `get_scene_hierarchy` (not `find_brushes`).
- **Shapes:** `find_brushes` shape filter accepts `thin`/`pole`, `flat`/`panel`/`flag`, `tall`, `long`, `box`.
- **Place on pole:** `align_brush` with `mode: "top"`, `gap: 0` (optional `center: true`).
- **Exact coords:** `set_brush_transform` / `add_box_brush` with `snap: false` or `exact: true` so `-17.125` is not rounded to `-17`.
- **Assemblies:** `duplicate_brushes` with many `brushIds`, or `groupIds` for whole compounds; use `data.groupIds` after group clone. `mirror_brushes` is brush ids only.
- **Groups:** prefer `create_csg_group` + `set_group_operation` over flattening; inspect with `get_scene_hierarchy` before reparenting.
- **Nest under group:** `add_box_brush` with `parentGroupId`, or `reparent_solid_nodes` after create.
- **Math:** `calculate` with expressions like `"20+(0.5*12)"` — only `+ - * / ( )` and decimals.
- **Half extents:** `half_extents` for face centers when aligning openings or stacking props.
- **Preview:** `preview_transform` / `preview_new_box` return predicted world bounds without mutating.
- **Rooms:** `add_room_shell` then `add_opening` with **`targetBrushId`** on a wall brush (not bare `cut_opening` unless you compute midplane yourself).
- **Doors:** set `sillHeight` to the floor top; omit bottom frame automatically; do not enable mullions.
- **CSG order:** `add_opening` + `targetBrushId` reorders the cut after the wall; otherwise use `reorder_brush_relative` / `insertAfterName`.
- **Mirror:** X-mirror flips yaw to −yaw; Z-mirror uses π − yaw.
- **Solid/void:** always `explain_csg_at_point` before trusting space is empty or solid; AABB queries list cutter volumes too.
- **Subtractives:** must overlap additive solid (and evaluate after it) or they are wasted; `validate_solid_model` warns when they do not.
- **Clip/split:** world plane on one brush for bevels/splits — not a substitute for doorway CSG.

**Clip plane tips:** prefer `axis` + `distance` (e.g. cut at `y=0` with `axis: "y", distance: 0`). `keepFront: true` (default) keeps the **+axis** side.

**Transform tips:** use **degrees** (`rotationDegrees`, `rotate_brush.degrees`), not radians. When snap is on, positions and angles snap to the editor grid / rotation step (default 15°) unless you pass `snap: false`.

Solid mutations (including hierarchy create/reparent/rename/ungroup) are **undoable** via `undo` / `redo` and the editor history.

## Grey boxes: read the layout, then populate it

A **grey box** is a named, described box volume the user places to mark out where a
space goes and what it is for. Grey boxes are **planning volumes, not geometry**:
they never compile into a solid result and never export.

They **nest**. A volume contained by another describes a feature _within_ that
space - a ravine in a hall, a bridge over the ravine, a ledge at its end - not a
separate room. Nesting and intersection are normal in a blockout, not mistakes to
report back.

The workflow this enables:

1. `get_grey_box_graph` - one call returns the whole brief. `rootGreyBoxIds` are
   the outermost spaces; each node carries `parentGreyBoxId`, `childGreyBoxIds`,
   and `depth`, so the layout reads as a hierarchy rather than a list. Edges carry
   every relation a pair holds: `contains` with a ratio, `adjacent` with the
   shared-face rect, `overlaps` with the intersecting region. Authored links add
   routes geometry cannot imply - an elevator, a one-way drop - with a label, note,
   and direction. Muted relations and unresolved links come back separately so
   nothing is silently dropped.
2. **Work outside in.** `buildOrder` lists a parent before anything nested inside
   it: build the shell, then carve and add the features. It is guidance, not a
   requirement.
3. **Honour the fixity contract.** `sizeIntent: "exact"` means the volume is
   measured and you must build to its dimensions. `"approximate"` means the shape
   is a suggestion you may refine. Getting this wrong in either direction is the
   most common way to disappoint the user.
4. **Read the role and the description.** `role` says what kind of space it is
   (room, corridor, bridge, ledge, platform, pit, ravine, cover, hazard, landmark,
   objective, spawn, transition, or a word the user chose). The description is the
   brief; the `surface` hints - floor, wall, ceiling, mood - say how it should
   feel, and are intent rather than texture ids.
5. **Check before building.** `get_grey_box` reports `ownBrushCount` for the volume
   itself and `subtreeBrushCount` including everything nested inside, so you can
   tell an untouched volume from one you already filled.
6. **Build with the ordinary solid tools** (`create_solid_model`,
   `add_room_shell`, `add_box_brush`, `cut_opening`, ...), placing brushes inside
   the volume's bounds and sizing openings against the reported shared-face rect.

Notes:

- Relations are computed from real volume orientation, so rotated and angled
  volumes work. Volumes meeting only at an edge or corner are not related.
- Every grey box write tool is undoable through `undo`.
- `get_editor_context` reports `greyBoxCount`, and `get_scene_hierarchy` returns
  grey box nodes nested the way the outliner shows them.
- Every node carries a `kind`. `volume` is a planning volume. `group` is a folder
  the user made to keep a large layout navigable: it holds volumes and other
  groups, carries no geometry, and takes its center and size from what it holds,
  so **never build to a group's dimensions**. Grouping is an organizing choice and
  says nothing about the layout — it is not a substitute for nesting a feature
  inside the volume that really contains it.
- `create_grey_box_group`, `reparent_grey_boxes`, and `ungroup_grey_box_groups`
  manage that structure, and `create_grey_box` takes a `parentGreyBoxId`. Reach for
  a group when a wing or a floor has grown too many volumes to scan, not before.
- Creating volumes yourself is legitimate when the user asks you to block out a
  layout. That direction has its own rules — see below.

### Authoring a layout yourself

When the user asks you to grey box something, you are producing the brief rather
than consuming one, and the failure mode is different: layouts come out as a flat
list of rooms with every feature described in prose instead of placed.

**Box out contents, not just rooms.** Whatever the scene is — an arena, an office,
a kitchen — the things inside a space get their own nested volumes: a bridge over a
ravine, a staircase, a kitchen island, a filing cabinet, a crate. The test is not
whether something counts as level geometry:

> If you are about to write a noun into a `description` and that noun has a
> location and a size, place it as a volume instead.

Solid masses count as much as open space; a column or a refrigerator marks where
matter _is_, not where anyone walks. `role` accepts any string, so nothing has to
be forced into a gameplay category to be blocked out.

**Check the shape of what you produced.** Call `get_grey_box_graph` on your own
output. If `rootGreyBoxIds` is nearly as long as the volume list, you have written
a list of rooms, not a blockout. Real layouts are a few roots with features nested
one and two levels deep.

**Name the enclosing area.** Parenting is derived from geometry, so the hierarchy
is always spatially true — a parent really does contain its children, which is what
lets it stand for an area something could be _inside of_. A volume that overhangs
its parent becomes a root, with no error.

Read that as a question about the layout rather than a snag. When a feature spans
two spaces — a bridge landing on both banks of a ravine — the usual answer is that
the enclosing area is missing: create the volume for the whole place and nest the
banks, the water, and the bridge inside it. That volume is a design statement, not
bookkeeping. It says _these parts are one space_, which is exactly what a flat list
of siblings fails to say.

**Do not tune the layout to silence the graph.** `problems: []` does not mean the
layout is good, and resizing volumes to remove an overlap usually destroys the
nesting that described a feature. Overlap reporting is informational.

**Model what this editor can build.** There is no moving-brush support, so lifts
and rising platforms cannot be built as such. Prefer stairs or ramps, or place the
platform statically in its raised position and record the intended mechanism in
the description.

**Write descriptions that survive without you.** The next agent will not have your
research, your reference images, or this conversation. State the walkable floor
height, the proportions, what to build, and — where you have a specific reason —
what _not_ to build.

## Not in this build

- **`capture_viewport` / `capture_section`** — need WebGL readback + image transport outside the AI folder.
- **Separate tag system** — use stable `name` strings instead of a second metadata channel.
- **Exact navmesh void paths** — connectivity uses a capped grid / line sample only.

## Architecture

- **Bun process** (`src/ai/server/`): hand-rolled Streamable HTTP + JSON-RPC
- **Webview** (`src/ai/client/`): `EditorApi` facade over existing solid commands
- Tool catalog lives in `src/ai/server/tool_definitions/`, one file per domain
- Bridge: Electrobun RPC (`startMcpServer` / `invokeEditorTool`)
- UI: main toolbar **MCP** button → simple dialog with Start / URL / Copy
