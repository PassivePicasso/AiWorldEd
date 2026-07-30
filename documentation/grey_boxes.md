# Grey Boxes

A **Grey Box** is a named, described box volume that marks out _where a space
goes and what it is for_, without being geometry itself. You block out a level as
a handful of grey boxes, describe each one, and let their arrangement say how the
spaces connect. An AI agent connected over MCP then reads that layout and builds
the real level inside it with brushes.

Grey boxes are planning aids, not geometry:

- They never compile into a solid model's CSG result.
- They never appear in an FBX, OBJ, or GLB export.
- They do not block placement — an object created inside a grey box lands inside
  it rather than being pushed against its faces.

That means you can leave your grey boxes in the scene permanently. They are the
level's design intent, saved alongside it.

## Create a grey box

Choose **Add > Layout > Grey Box**. The volume appears in front of the camera,
snapped to the grid and selected.

Grey boxes are drawn the same way solid brush helpers are, for the same reason —
a blocked-out level has to stay readable:

- **Outline only, unless selected.** A volume shows its bright wireframe at all
  times; the translucent fill appears only while it is selected. Ten filled
  volumes would stack into mush, so only the one you are working on is filled.
- **Outlines fade with distance in the 3D view** and stop drawing entirely far
  away, so a large layout does not bury the geometry inside it. A selected volume
  keeps its outline over a longer range.
- **In the top, front, and side views the wireframe is always complete**, drawn
  over everything, because that is where you read the layout.

Move, rotate, and resize a grey box with the same transform tools you use for any
other object. Rotation is fully supported; connectivity is computed from the
volume's real orientation.

## Name it

Rename a grey box the same way you rename anything else: double-click its name in
the Outliner and type. Names are what an agent reads first, so name volumes
for what they are — `entry_hall`, `east_corridor`, `boss_arena` — rather than
leaving them as `GreyBox001`.

## Describe it

Select a grey box and use the **Grey Box** section of the Properties panel. The
name is shown for orientation, and below it is a multi-line **Description**
field.

The description is the brief. It is the single most important thing you author,
because it is what turns a box into an instruction. Editing commits when you
click away or press `Ctrl+Enter`; `Escape` reverts what you just typed, and plain
`Enter` inserts a newline so you can write more than one line.

A weak description restates the geometry:

> A big room.

A strong description states purpose, mood, and what the space has to do:

> Central atrium, three storeys tall with a glass roof. First space the player
> sees, so it should read as safe and orienting: clear sightlines to the two
> exits, a raised walkway on the second level the player cannot reach yet.

Both are the same box. Only the second one tells an agent what to build.

## Connections

Two panels' worth of information live in the **Grey Box Connections** section:
what the geometry implies, and what you have stated.

### Derived from geometry

Grey boxes that touch face-to-face are connected automatically. The editor
reports which face they share and how large the shared opening is, so a doorway
can be sized against it. Volumes that overlap in space are reported as
_overlapping_, which usually means you intended one merged space rather than two
rooms with a door between them.

Volumes that meet only along an edge or at a corner are **not** connected —
neither is a route a player can walk.

### Stated by you

Geometry cannot express every route. Use a connection when the link is real but
invisible:

- an elevator between two stacked volumes that do not touch
- a one-way drop from a ledge into the room below
- a locked door that exists but is not usable yet

Select exactly two grey boxes, then press **Connect selected two**. The link
carries a free-form label (door, corridor, stairs, elevator, vent — any word you
like), a note, and a direction. One-way links are meaningful and are reported as
such.

### Muting an adjacency

Sometimes two volumes touch for layout reasons and are not connected in play — a
service shaft flush against a room wall, two areas separated by solid rock. Press
**Mute** on a derived row to drop that edge from the graph. Muted rows stay
visible and struck through so you can restore them with **Unmute**.

Everything here is undoable, and it all persists with the scene.

## The block-out-then-populate workflow

1. **Block out.** Create a grey box per space. Size them to the real space you
   want, and place them so the ones that connect actually touch.
2. **Name and describe.** Give each volume a purposeful name and a description
   that states role, mood, and constraints.
3. **State the invisible routes.** Add explicit connections for elevators,
   drops, and locked doors. Mute adjacencies that are not routes.
4. **Hand it to an agent.** With MCP running, an agent calls
   `get_grey_box_graph`, reads the volumes and how they connect, and authors
   brushes inside each one.
5. **Iterate.** Grey boxes stay in the scene. Move one and the derived
   connections update; rewrite a description and the next build follows the new
   brief.

## A worked example

Four volumes, laid out so that the atrium touches the corridor and the corridor
touches the vault. The gallery sits directly above the atrium without touching
it, reached by a lift.

| Volume          | Description                                                                                    |
| --------------- | ---------------------------------------------------------------------------------------------- |
| `atrium`        | Central three-storey hall, glass roof, first space the player sees. Clear sightlines to exits. |
| `east_corridor` | Narrow service corridor, low ceiling, flickering light. Should feel tight after the atrium.    |
| `vault`         | Small strongroom at the corridor's end. One entrance, no windows. Holds the objective.         |
| `gallery`       | Balcony ring overlooking the atrium from above. Reached only by the lift.                      |

The resulting graph:

```
atrium  --- east_corridor      shared face 4 x 3 (derived)
east_corridor --- vault        shared face 2 x 3 (derived)
atrium  --> gallery            lift, one way up (authored)
```

An agent reading this knows to build a tall room with two openings, a tight
corridor between two of them, a sealed room at the end with a single doorway, and
a balcony with no floor-level connection to the atrium — because the only link
between them is the authored lift.

## What grey boxes are not

- They are not brushes. They never enter the CSG evaluation order, so making one
  subtractive is not a thing you can do.
- They are not exported. If you need geometry in the export, build it with
  brushes inside the grey box.
- They are not required. You can build a level without them; they exist so a
  layout can be described once and built repeatedly.

## Related pages

- [Solid modeling and CSG](solid_modeling_and_csg.md) — building the geometry
  that fills a grey box.
- [Creating and transforming objects](creating_and_transforming.md) — the Add
  menu and transform tools.
- [Selecting and organizing objects](selecting_and_organizing.md) — the Outliner
  and multi-selection.
