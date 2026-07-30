import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { buildGreyBoxSceneGraph } from '../../src/greybox/connectivity/grey_box_scene_graph.js';
import { createGreyBoxMesh } from '../../src/greybox/model/grey_box_factory.js';
import { getGreyBoxId, setGreyBoxDescription } from '../../src/greybox/model/grey_box_access.js';
import {
  addGreyBoxConnection,
  setDerivedConnectionSuppressed,
} from '../../src/greybox/model/grey_box_connection_access.js';
import { greyBoxPairKey } from '../../src/greybox/model/grey_box_pair_key.js';
import { GreyBoxRegistry } from '../../src/greybox/model/grey_box_registry.js';
import { createExplicitConnection } from '../../src/greybox/model/grey_box_connection.js';

describe('merged grey box graph', () => {
  let world: THREE.Group;
  let left: THREE.Mesh;
  let right: THREE.Mesh;
  let detached: THREE.Mesh;

  beforeEach(() => {
    world = new THREE.Group();
    left = createGreyBoxMesh('Left', 10, 10, 10);
    right = createGreyBoxMesh('Right', 10, 10, 10);
    right.position.set(10, 0, 0);
    detached = createGreyBoxMesh('Detached', 10, 10, 10);
    detached.position.set(0, 40, 0);
    world.add(left);
    world.add(right);
    world.add(detached);
  });

  it('lists every volume as a node with its description and size', () => {
    setGreyBoxDescription(left, 'entry hall');
    const graph = buildGreyBoxSceneGraph(world);
    expect(graph.nodes.length).toBe(3);
    const node = graph.nodes.find((candidate) => candidate.id === getGreyBoxId(left))!;
    expect(node.name).toBe('Left');
    expect(node.description).toBe('entry hall');
    expect(node.size.toArray()).toEqual([10, 10, 10]);
  });

  it('includes derived adjacency as a derived edge', () => {
    const graph = buildGreyBoxSceneGraph(world);
    expect(graph.edges.length).toBe(1);
    expect(graph.edges[0]!.source).toBe('derived');
    expect(graph.edges[0]!.relations).toContain('adjacent');
    expect(graph.edges[0]!.authoredLinks).toEqual([]);
  });

  it('drops a derived edge the user muted', () => {
    const pairKey = greyBoxPairKey(getGreyBoxId(left), getGreyBoxId(right));
    setDerivedConnectionSuppressed(left, pairKey, true);
    const graph = buildGreyBoxSceneGraph(world);
    expect(graph.edges).toEqual([]);
    expect(graph.suppressedPairKeys).toEqual([pairKey]);
  });

  it('honours a mute recorded on either endpoint', () => {
    const pairKey = greyBoxPairKey(getGreyBoxId(left), getGreyBoxId(right));
    setDerivedConnectionSuppressed(right, pairKey, true);
    expect(buildGreyBoxSceneGraph(world).edges).toEqual([]);
  });

  it('restores the derived edge when the mute is lifted', () => {
    const pairKey = greyBoxPairKey(getGreyBoxId(left), getGreyBoxId(right));
    setDerivedConnectionSuppressed(left, pairKey, true);
    setDerivedConnectionSuppressed(left, pairKey, false);
    expect(buildGreyBoxSceneGraph(world).edges.length).toBe(1);
  });

  it('adds an authored edge between volumes that do not touch', () => {
    addGreyBoxConnection(left, getGreyBoxId(detached), 'elevator', 'needs keycard', 'bidirectional');
    const graph = buildGreyBoxSceneGraph(world);
    const authored = graph.edges.find((edge) => edge.source === 'authored')!;
    expect(authored.pairKey).toBe(greyBoxPairKey(getGreyBoxId(left), getGreyBoxId(detached)));
    expect(authored.relations).toEqual([]);
    expect(authored.authoredLinks[0]!.kind).toBe('elevator');
    expect(authored.authoredLinks[0]!.note).toBe('needs keycard');
  });

  it('annotates a derived edge instead of duplicating it', () => {
    addGreyBoxConnection(left, getGreyBoxId(right), 'door', 'locked until the key', 'bidirectional');
    const graph = buildGreyBoxSceneGraph(world);
    expect(graph.edges.length).toBe(1);
    expect(graph.edges[0]!.source).toBe('derived');
    expect(graph.edges[0]!.authoredLinks.length).toBe(1);
    expect(graph.edges[0]!.authoredLinks[0]!.kind).toBe('door');
  });

  it('keeps an authored edge for a pair whose geometry was muted', () => {
    const pairKey = greyBoxPairKey(getGreyBoxId(left), getGreyBoxId(right));
    setDerivedConnectionSuppressed(left, pairKey, true);
    addGreyBoxConnection(left, getGreyBoxId(right), 'hidden passage', '', 'forward');
    const graph = buildGreyBoxSceneGraph(world);
    expect(graph.edges.length).toBe(1);
    expect(graph.edges[0]!.source).toBe('authored');
    expect(graph.edges[0]!.authoredLinks[0]!.direction).toBe('forward');
  });

  it('preserves one-way direction and owner on authored links', () => {
    addGreyBoxConnection(left, getGreyBoxId(detached), 'drop', '', 'forward');
    const authored = buildGreyBoxSceneGraph(world).edges.find((edge) => edge.source === 'authored')!;
    expect(authored.authoredLinks[0]!.direction).toBe('forward');
    expect(authored.authoredLinks[0]!.ownerId).toBe(getGreyBoxId(left));
    expect(authored.authoredLinks[0]!.targetId).toBe(getGreyBoxId(detached));
  });

  it('reports a dangling authored target as a problem instead of dropping it', () => {
    addGreyBoxConnection(left, 'greybox-missing', 'door', '', 'bidirectional');
    const graph = buildGreyBoxSceneGraph(world);
    expect(graph.problems.length).toBe(1);
    expect(graph.problems[0]!.targetId).toBe('greybox-missing');
    expect(graph.problems[0]!.ownerId).toBe(getGreyBoxId(left));
    expect(graph.problems[0]!.message).toContain('not in the scene');
    expect(graph.edges.every((edge) => edge.source === 'derived')).toBe(true);
  });

  it('reports a self-referencing link from a corrupted file as a problem', () => {
    GreyBoxRegistry.get(left).explicitConnections.push(
      createExplicitConnection('link-self', getGreyBoxId(left), 'door', '', 'bidirectional'),
    );
    const graph = buildGreyBoxSceneGraph(world);
    expect(graph.problems.length).toBe(1);
    expect(graph.problems[0]!.message).toContain('own volume');
  });

  it('rejects connecting a volume to itself at the accessor level', () => {
    expect(() => addGreyBoxConnection(left, getGreyBoxId(left), 'door', '', 'bidirectional')).toThrow(/itself/);
  });

  it('orders edges and muted keys stably across rebuilds', () => {
    addGreyBoxConnection(left, getGreyBoxId(detached), 'elevator', '', 'bidirectional');
    const first = buildGreyBoxSceneGraph(world);
    const second = buildGreyBoxSceneGraph(world);
    expect(second.edges.map((edge) => edge.pairKey)).toEqual(first.edges.map((edge) => edge.pairKey));
  });

  it('returns an empty graph for a scene with no volumes', () => {
    const graph = buildGreyBoxSceneGraph(new THREE.Group());
    expect(graph.nodes).toEqual([]);
    expect(graph.edges).toEqual([]);
    expect(graph.problems).toEqual([]);
  });
});
