# Grey Boxes

A **Grey Box** is a named, described box volume that marks out _where a space goes
and what it is for_, without being geometry itself. You block out a level as a set
of grey boxes — and grey boxes go **inside other grey boxes**. A hall, and inside
it a ravine; across the ravine a bridge; a ledge at each end. Each volume is a
simple low-detail box, sometimes at an angle, that says what belongs there. An AI
agent connected over MCP reads that layout and builds the real level inside it.

Grey boxes are planning aids, not geometry:

- They never compile into a solid model's CSG result.
- They never appear in an FBX, OBJ, or GLB export.
- They do not block placement — an object created inside a grey box lands inside
  it rather than being pushed against its faces.

You can leave your grey boxes in the scene permanently. They are the level's
design intent, saved alongside it.

## Nesting is the normal case

Intersecting and nested volumes are how blockouts describe detail. A volume that
sits inside another is a **feature of that space**, not a separate room:

| Layout                     | What it means                          |
| -------------------------- | -------------------------------------- |
| A ravine inside a hall     | the hall has a ravine cut through it   |
| A bridge inside the ravine | the bridge spans that ravine           |
| A ledge inside the hall    | a ledge along one of the hall's walls  |
| A pillar inside the hall   | a pillar standing in the hall          |
| Two halls sharing a wall   | two spaces with a doorway between them |

The editor works this out for you. It reports three kinds of relation, and a pair
can hold more than one:

- **contains** — one volume sits inside another, measured as a ratio, so a bridge
  overhanging its ravine still counts as nested.
- **adjacent** — two volumes meet face to face. The shared rectangle is where a
  door or corridor mouth can go, and its size is reported so an opening can be
  sized against it.
- **overlaps** — two volumes intersect without one containing the other. Common
  for an angled bridge driving into a wall, and perfectly normal. The editor
  reports the intersecting box and **how much of each volume it consumes**, so a
  connection row reads `overlapping 5%` from one side and `overlapping 10%` from
  the other when the volumes differ in size.

The editor does not decide which intersections are mistakes. It reports what
intersects and by how much, and leaves the judgement to you or the agent reading
the layout: a couple of percent is usually deliberate contact, two spaces half
inside each other usually is not.

Volumes that meet only along an edge or at a corner are not related — neither is a
route a player can walk, nor a feature of the other space.

### Correcting the hierarchy

Containment is worked out from the volumes themselves, so blocking out fast just
works. When the geometry is ambiguous — a bridge that pokes well past the ravine
it belongs to — **parent one grey box under another in the Outliner** and that
statement wins. An authored parent also works where geometry implies nothing at
all, which is how you attach a volume to a space it does not physically sit
inside.

## Create a grey box

Choose **Add > Layout > Grey Box**. The volume appears in front of the camera,
snapped to the grid and selected.

Grey boxes are drawn the same way solid brush helpers are, for the same reason — a
blocked-out level has to stay readable:

- **Outline only, unless selected.** A volume shows its wireframe at all times;
  the translucent fill appears only while it is selected. Ten filled volumes would
  stack into mush, so only the one you are working on is filled.
- **Coloured by role**, so a bridge, a pit, and a room are told apart at a glance.
- **Outlines fade with distance in the 3D view** and stop drawing entirely far
  away, so a large layout does not bury the geometry inside it. A selected volume
  keeps its outline over a longer range.
- **In the top, front, and side views the wireframe is always complete**, drawn
  over everything, because that is where you read the layout.

Move, rotate, and resize a volume with the tools you use for any other object.
Rotation is fully supported and relations are computed from real orientation.

## Roles

Select a volume and set its **Role** in the
**Grey Box** section of the Properties panel. The role colours the volume and tells an agent what kind of space it is.
The editor understands these:

`room`, `corridor`, `bridge`, `ledge`, `platform`, `pit`, `ravine`, `cover`,
`hazard`, `landmark`, `objective`, `spawn`, `transition`

Any other word is accepted and draws in the neutral grey, so a missing category
never stops you working. New volumes start as `room`.

## Name it

Rename a grey box the same way you rename anything else: double-click its name in
the Outliner and type. Names are what an agent reads first, so name volumes for
what they are — `entry_hall`, `east_corridor`, `boss_arena`.

## Describe it

The **Description** field in the Grey Box section is the brief, and it is the most
important thing you author: it is what turns a box into an instruction. Editing
commits when you click away or press `Ctrl+Enter`; `Escape` reverts, and plain
`Enter` inserts a newline.

A weak description restates what the box already says:

> A big room.

A strong one states purpose, mood, and what the space has to do — and leans on the
role and surface fields instead of repeating them:

> First space the player sees, so it should read as safe and orienting: clear
> sightlines to both exits, and the walkway above should be visible but obviously
> out of reach until later.

## Intent: what is fixed, and how it should feel

The **Grey Box Intent** section carries two things an agent otherwise has to guess.

**Dimensions are exact** — tick this when the volume is measured and must be built
to its dimensions. Leave it clear and the shape is a suggestion an agent may
refine. New volumes start unticked, because a box you just dragged out is a gesture
until you say otherwise. Tick it for the doorway you measured; leave it for the
ravine you roughed in.

**Surface and mood** — `floor`, `wall`, `ceiling`, and `mood` are free-form hints
for how the space should feel: "wet stone, puddles", "brick, soot-stained", "timber
beams", "oppressive, low light". These are intent, not texture assignments; a grey
box never carries a real material.

## Connections

The **Grey Box Connections** section lists how the selected volume relates to its
neighbours: what the geometry implies, and what you have stated.

### Stated by you

Geometry cannot express every route. Select exactly two volumes and press
**Connect selected two** when the link is real but invisible:

- an elevator between two stacked volumes that do not touch
- a one-way drop from a ledge into the room below
- a locked door that exists but is not usable yet

Each link carries a free-form label, a note, and a direction. One-way links are
meaningful and reported as such.

### Muting a relation

Two volumes may touch for layout reasons without being connected in play — a
service shaft flush against a room wall, two areas separated by solid rock. Press
**Mute** on a derived row to drop that relation from the graph. Muted rows stay
visible and struck through so you can **Unmute** them.

Everything here is undoable and persists with the scene.

## The block-out-then-populate workflow

1. **Block out the outer spaces.** One volume per room, hall, or corridor. Place
   the ones that connect so they actually touch.
2. **Block out the features inside them.** Ravines, bridges, ledges, pillars,
   cover — as volumes inside the space they belong to. Angles are fine.
3. **Name, role, and describe.** Give every volume a purposeful name, the role
   that fits, and a description stating what it is for.
4. **Say what is measured.** Tick exact on the volumes whose dimensions matter.
5. **State the invisible routes** and mute the relations that are not routes.
6. **Hand it to an agent.** With MCP running, an agent calls `get_grey_box_graph`,
   reads the hierarchy and the build order, and works outside in: the shell first,
   then the features inside it.
7. **Iterate.** Grey boxes stay in the scene. Move one and the relations update;
   rewrite a description and the next build follows the new brief.

## A worked example

A hall with a ravine cut through it, a bridge across the ravine, and a ledge at the
far end. Four volumes, three of them nested inside the hall.

| Volume       | Role   | Exact | Description                                                                                     |
| ------------ | ------ | ----- | ----------------------------------------------------------------------------------------------- |
| `great_hall` | room   | yes   | Three-storey hall, the level's spine. Player enters at the west end and must reach the east.    |
| `chasm`      | ravine | no    | Splits the hall floor. Bottomless read, not a fall the player survives. Rough shape is fine.    |
| `span`       | bridge | yes   | The only way across. Narrow enough that two players cannot pass. Must line up with both ledges. |
| `east_ledge` | ledge  | yes   | Landing on the far side, flush with the bridge deck so the two share a face to walk across.     |

Surface intent on `great_hall`: floor "cracked flagstone", wall "soot-stained
brick", ceiling "timber beams, gaps letting light through", mood "cold, cavernous,
one shaft of light on the far door".

The brief an agent receives:

```
rootGreyBoxIds: [great_hall]
buildOrder:     great_hall, chasm, span, east_ledge

great_hall   role=room    exact        children=[chasm, span, east_ledge]
  chasm      role=ravine  approximate  contains ratio 1.00, depth 1
  span       role=bridge  exact        contains ratio 0.92, depth 1
  east_ledge role=ledge   exact        contains ratio 1.00, depth 1

span -- east_ledge   adjacent, shared face 2 x 0.5
```

An agent reading this builds the hall shell first, carves the chasm inside it, then
the bridge and the ledge — honouring the hall's, bridge's, and ledge's dimensions
exactly while treating the chasm's shape as a suggestion, and choosing materials
from the surface intent.

Note the `adjacent` relation between `span` and `east_ledge`: it exists because the
two are **flush**. Step the ledge up even slightly and they meet along an edge
instead, which is not a relation — if you want the layout to say "you can walk from
the bridge onto the ledge", keep the faces flush, or state it with an authored
connection.

## What grey boxes are not

- They are not brushes. They never enter the CSG evaluation order.
- They are not exported. If you need geometry in the export, build it with brushes
  inside the grey box.
- They are not required. You can build a level without them; they exist so a
  layout can be described once and built repeatedly.

## Related pages

- [Solid modeling and CSG](solid_modeling_and_csg.md) — building the geometry that
  fills a grey box.
- [Creating and transforming objects](creating_and_transforming.md) — the Add menu
  and transform tools.
- [Selecting and organizing objects](selecting_and_organizing.md) — the Outliner,
  parenting, and multi-selection.
