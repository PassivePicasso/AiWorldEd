import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { buildGreyBoxSceneGraph } from '../../src/greybox/connectivity/grey_box_scene_graph.js';
import { computeGreyBoxOccupancy, readGreyBoxOccupancy } from '../../src/ai/client/grey_box_occupancy.js';
import { createGreyBoxMesh } from '../../src/greybox/model/grey_box_factory.js';
import { getGreyBoxId } from '../../src/greybox/model/grey_box_access.js';
import { SolidModel } from '../../src/solid/model/solid_model.js';
import { SolidOperation } from '../../src/solid/types/solid_operation.js';

describe('nested grey boxes in a scene', () => {
  let world: THREE.Group;
  let hall: THREE.Mesh;
  let mezzanine: THREE.Mesh;

  beforeEach(() => {
    world = new THREE.Group();
    hall = createGreyBoxMesh('Hall', 40, 20, 40);
    mezzanine = createGreyBoxMesh('Mezzanine', 16, 6, 16);
    mezzanine.position.set(8, 5, 8);
    world.add(hall);
    world.add(mezzanine);
  });

  it('builds a hierarchy from overlapping volumes', () => {
    const graph = buildGreyBoxSceneGraph(world);
    expect(graph.tree.rootIds).toEqual([getGreyBoxId(hall)]);
    expect(graph.tree.nodes.get(getGreyBoxId(mezzanine))!.parentId).toBe(getGreyBoxId(hall));
  });

  it('reports parent and depth on every node', () => {
    const graph = buildGreyBoxSceneGraph(world);
    const child = graph.nodes.find((node) => node.id === getGreyBoxId(mezzanine))!;
    expect(child.parentId).toBe(getGreyBoxId(hall));
    expect(child.depth).toBe(1);
    expect(child.authoredParent).toBe(false);
  });

  it('honours Outliner parenting over the geometric guess', () => {
    const ravine = createGreyBoxMesh('Ravine', 10, 8, 10);
    ravine.position.set(200, 0, 0);
    const bridge = createGreyBoxMesh('Bridge', 4, 1, 4);
    bridge.position.set(0, 0, 0);
    ravine.add(bridge);
    world.add(ravine);
    const graph = buildGreyBoxSceneGraph(world);
    const node = graph.tree.nodes.get(getGreyBoxId(bridge))!;
    expect(node.parentId).toBe(getGreyBoxId(ravine));
    expect(node.authoredParent).toBe(true);
  });

  it('lets Outliner parenting override a different derived parent', () => {
    const ravine = createGreyBoxMesh('Ravine', 6, 6, 6);
    ravine.position.set(8, 5, 8);
    world.add(ravine);
    const drop = createGreyBoxMesh('Drop', 2, 2, 2);
    drop.position.set(0, 0, 0);
    hall.add(drop);
    const graph = buildGreyBoxSceneGraph(world);
    expect(graph.tree.nodes.get(getGreyBoxId(drop))!.parentId).toBe(getGreyBoxId(hall));
    expect(graph.tree.nodes.get(getGreyBoxId(drop))!.authoredParent).toBe(true);
  });

  it('reports nesting as an edge relation rather than an anomaly', () => {
    const edge = buildGreyBoxSceneGraph(world).edges[0]!;
    expect(edge.relations).toContain('contains');
    expect(edge.containment!.parentId).toBe(getGreyBoxId(hall));
  });

  it('keeps a flat layout free of containment', () => {
    mezzanine.position.set(100, 0, 0);
    const graph = buildGreyBoxSceneGraph(world);
    expect(graph.tree.rootIds.length).toBe(2);
    expect(graph.edges).toEqual([]);
  });
});

describe('grey box occupancy under nesting', () => {
  let world: THREE.Group;
  let hall: THREE.Mesh;
  let mezzanine: THREE.Mesh;

  beforeEach(() => {
    world = new THREE.Group();
    hall = createGreyBoxMesh('Hall', 40, 20, 40);
    mezzanine = createGreyBoxMesh('Mezzanine', 10, 6, 10);
    mezzanine.position.set(0, 0, 0);
    world.add(hall);
    world.add(mezzanine);
  });

  it('reports every volume empty before anything is built', () => {
    const occupancy = computeGreyBoxOccupancy(world, buildGreyBoxSceneGraph(world));
    expect(readGreyBoxOccupancy(occupancy, getGreyBoxId(hall)).empty).toBe(true);
    expect(readGreyBoxOccupancy(occupancy, getGreyBoxId(mezzanine)).empty).toBe(true);
  });

  it('attributes a brush to the innermost volume that holds it', () => {
    addBrushAt(world, new THREE.Vector3(0, 0, 0));
    const occupancy = computeGreyBoxOccupancy(world, buildGreyBoxSceneGraph(world));
    expect(readGreyBoxOccupancy(occupancy, getGreyBoxId(mezzanine)).ownBrushCount).toBe(1);
    expect(readGreyBoxOccupancy(occupancy, getGreyBoxId(hall)).ownBrushCount).toBe(0);
  });

  it('counts a nested brush in the parent subtree', () => {
    addBrushAt(world, new THREE.Vector3(0, 0, 0));
    const occupancy = computeGreyBoxOccupancy(world, buildGreyBoxSceneGraph(world));
    expect(readGreyBoxOccupancy(occupancy, getGreyBoxId(hall)).subtreeBrushCount).toBe(1);
    expect(readGreyBoxOccupancy(occupancy, getGreyBoxId(hall)).empty).toBe(false);
  });

  it('attributes a brush outside the child to the parent itself', () => {
    addBrushAt(world, new THREE.Vector3(15, 0, 15));
    const occupancy = computeGreyBoxOccupancy(world, buildGreyBoxSceneGraph(world));
    expect(readGreyBoxOccupancy(occupancy, getGreyBoxId(hall)).ownBrushCount).toBe(1);
    expect(readGreyBoxOccupancy(occupancy, getGreyBoxId(mezzanine)).ownBrushCount).toBe(0);
  });

  it('ignores brushes outside every volume', () => {
    addBrushAt(world, new THREE.Vector3(500, 0, 0));
    const occupancy = computeGreyBoxOccupancy(world, buildGreyBoxSceneGraph(world));
    expect(readGreyBoxOccupancy(occupancy, getGreyBoxId(hall)).subtreeBrushCount).toBe(0);
  });

  it('records which solid model built inside a volume', () => {
    const model = addBrushAt(world, new THREE.Vector3(0, 0, 0));
    const occupancy = computeGreyBoxOccupancy(world, buildGreyBoxSceneGraph(world));
    expect(readGreyBoxOccupancy(occupancy, getGreyBoxId(mezzanine)).solidModelIds).toEqual([model.root.uuid]);
  });

  it('defaults to empty for a volume with no entry', () => {
    const occupancy = computeGreyBoxOccupancy(world, buildGreyBoxSceneGraph(world));
    expect(readGreyBoxOccupancy(occupancy, 'greybox-missing').empty).toBe(true);
  });
});

/**
 * Adds a solid model with one brush at a world position.
 *
 * @param world World group receiving the model.
 * @param position Where the brush should sit.
 * @returns The created solid model.
 */
function addBrushAt(world: THREE.Group, position: THREE.Vector3): SolidModel {
  const model = new SolidModel('Built');
  model.addBoxBrush(2, SolidOperation.Additive);
  model.root.position.copy(position);
  world.add(model.root);
  model.root.updateMatrixWorld(true);
  return model;
}
