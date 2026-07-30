import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { buildGreyBoxSceneGraph } from '../../src/greybox/connectivity/grey_box_scene_graph.js';
import { computeGreyBoxGroupBounds } from '../../src/greybox/connectivity/grey_box_group_volume.js';
import { createGreyBoxGroup, createGreyBoxMesh } from '../../src/greybox/model/grey_box_factory.js';
import { getGreyBoxId } from '../../src/greybox/model/grey_box_access.js';
import { isGreyBox } from '../../src/greybox/model/grey_box_keys.js';
import {
  collectGreyBoxGroupsUnder,
  findGreyBoxRoot,
  isGreyBoxGroup,
  isUnderGreyBoxGroup,
} from '../../src/greybox/model/grey_box_group.js';
import { GreyBoxRegistry } from '../../src/greybox/model/grey_box_registry.js';

describe('grey box group identity', () => {
  it('is a registered grey box of its own', () => {
    const group = createGreyBoxGroup('Ground Floor');
    expect(isGreyBoxGroup(group)).toBe(true);
    expect(isGreyBox(group)).toBe(true);
    expect(GreyBoxRegistry.get(group).id).toMatch(/^greybox-/);
  });

  it('does not mistake a volume for a group', () => {
    expect(isGreyBoxGroup(createGreyBoxMesh('Hall', 4, 4, 4))).toBe(false);
  });

  it('does not mistake a plain group for a grey box group', () => {
    expect(isGreyBoxGroup(new THREE.Group())).toBe(false);
  });

  it('carries a description written at creation', () => {
    const group = createGreyBoxGroup('East Wing', 'everything east of the atrium');
    expect(GreyBoxRegistry.get(group).description).toBe('everything east of the atrium');
  });
});

describe('grey box group hierarchy', () => {
  let world: THREE.Group;
  let root: THREE.Group;
  let inner: THREE.Group;
  let hall: THREE.Mesh;

  beforeEach(() => {
    world = new THREE.Group();
    root = createGreyBoxGroup('Ground Floor');
    inner = createGreyBoxGroup('East Wing');
    hall = createGreyBoxMesh('Hall', 10, 10, 10);
    inner.add(hall);
    root.add(inner);
    world.add(root);
  });

  it('reports the outermost group as the grey box root', () => {
    expect(findGreyBoxRoot(hall)).toBe(root);
    expect(findGreyBoxRoot(inner)).toBe(root);
    expect(findGreyBoxRoot(root)).toBe(root);
  });

  it('reports no root for a volume parented straight to the world', () => {
    const loose = createGreyBoxMesh('Loose', 2, 2, 2);
    world.add(loose);
    expect(findGreyBoxRoot(loose)).toBeNull();
    expect(isUnderGreyBoxGroup(loose)).toBe(false);
  });

  it('collects only the groups under a root', () => {
    expect(collectGreyBoxGroupsUnder(world)).toEqual([root, inner]);
  });
});

describe('grey box groups in the layout graph', () => {
  let world: THREE.Group;
  let group: THREE.Group;
  let hall: THREE.Mesh;
  let store: THREE.Mesh;

  beforeEach(() => {
    world = new THREE.Group();
    group = createGreyBoxGroup('Ground Floor');
    hall = createGreyBoxMesh('Hall', 10, 10, 10);
    hall.position.set(-10, 0, 0);
    store = createGreyBoxMesh('Store', 10, 10, 10);
    store.position.set(10, 0, 0);
    group.add(hall);
    group.add(store);
    world.add(group);
    world.updateMatrixWorld(true);
  });

  it('appears as a container node distinct from its volumes', () => {
    const node = nodeFor(world, getGreyBoxId(group));
    expect(node.kind).toBe('group');
    expect(nodeFor(world, getGreyBoxId(hall)).kind).toBe('volume');
  });

  it('takes its extent from what it holds', () => {
    const node = nodeFor(world, getGreyBoxId(group));
    expect(node.size.toArray()).toEqual([30, 10, 10]);
    expect(node.center.toArray()).toEqual([0, 0, 0]);
  });

  it('is the only root, with its volumes as children', () => {
    const graph = buildGreyBoxSceneGraph(world);
    expect(graph.tree.rootIds).toEqual([getGreyBoxId(group)]);
    expect(graph.tree.nodes.get(getGreyBoxId(group))!.childIds).toEqual([getGreyBoxId(hall), getGreyBoxId(store)]);
  });

  it('claims its volumes as an authored parent rather than a derived one', () => {
    const child = nodeFor(world, getGreyBoxId(hall));
    expect(child.parentId).toBe(getGreyBoxId(group));
    expect(child.authoredParent).toBe(true);
    expect(child.depth).toBe(1);
  });

  it('contributes no geometric relations of its own', () => {
    const graph = buildGreyBoxSceneGraph(world);
    for (const edge of graph.edges) {
      expect([edge.firstId, edge.secondId]).not.toContain(getGreyBoxId(group));
    }
  });

  it('never takes one of its own volumes as a parent', () => {
    const solo = createGreyBoxGroup('Solo');
    const only = createGreyBoxMesh('Only', 4, 4, 4);
    solo.add(only);
    world.add(solo);
    world.updateMatrixWorld(true);
    const graph = buildGreyBoxSceneGraph(world);
    expect(graph.tree.nodes.get(getGreyBoxId(solo))!.parentId).toBeNull();
    expect(graph.problems).toEqual([]);
  });

  it('leaves the volumes it holds relating to each other as before', () => {
    store.scale.setScalar(0.4);
    store.position.copy(hall.position);
    world.updateMatrixWorld(true);
    const graph = buildGreyBoxSceneGraph(world);
    const pair = graph.edges.find((edge) => edge.relations.includes('contains'));
    expect(pair).toBeDefined();
    expect(pair!.containment!.parentId).toBe(getGreyBoxId(hall));
  });

  it('measures an empty group as nothing rather than failing', () => {
    const empty = createGreyBoxGroup('Empty');
    world.add(empty);
    world.updateMatrixWorld(true);
    expect(computeGreyBoxGroupBounds(empty)).toBeNull();
    expect(nodeFor(world, getGreyBoxId(empty)).size.toArray()).toEqual([0, 0, 0]);
  });

  it('groups nested groups without double-counting their volumes', () => {
    const outer = createGreyBoxGroup('Whole Site');
    world.add(outer);
    outer.add(group);
    world.updateMatrixWorld(true);
    const graph = buildGreyBoxSceneGraph(world);
    expect(graph.tree.rootIds).toEqual([getGreyBoxId(outer)]);
    expect(nodeFor(world, getGreyBoxId(outer)).size.toArray()).toEqual([30, 10, 10]);
    expect(graph.tree.nodes.get(getGreyBoxId(hall))!.depth).toBe(2);
  });
});

/**
 * Reads one node out of a freshly built scene graph.
 *
 * @param world World to read.
 * @param greyBoxId Node to find.
 * @returns The matching graph node.
 */
function nodeFor(world: THREE.Object3D, greyBoxId: string) {
  const node = buildGreyBoxSceneGraph(world).nodes.find((candidate) => candidate.id === greyBoxId);
  expect(node, greyBoxId).toBeDefined();
  return node!;
}
