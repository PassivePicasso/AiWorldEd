import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { SceneSerializer, SCENE_SCHEMA_VERSION } from '../../src/io/scene_serializer.js';
import { SceneDeserializer } from '../../src/io/scene_deserializer.js';
import { SceneJSON } from '../../src/io/io_types.js';
import { GreyBoxRegistry } from '../../src/greybox/model/grey_box_registry.js';
import { isGreyBox } from '../../src/greybox/model/grey_box_keys.js';
import { isGreyBoxOutline } from '../../src/greybox/model/grey_box_visual.js';
import { createExplicitConnection } from '../../src/greybox/model/grey_box_connection.js';
import { greyBoxPairKey } from '../../src/greybox/model/grey_box_pair_key.js';
import { allocateGreyBoxId } from '../../src/greybox/model/grey_box_id.js';
import { createGreyBoxFixture, createContentBox } from './grey_box_fixture.js';

describe('grey box scene persistence', () => {
  let serializer: SceneSerializer;
  let deserializer: SceneDeserializer;
  let world: THREE.Group;

  beforeEach(() => {
    serializer = new SceneSerializer();
    deserializer = new SceneDeserializer();
    world = new THREE.Group();
  });

  it('stamps the schema version that introduced grey boxes', () => {
    expect(serializer.serialize(world).version).toBe(SCENE_SCHEMA_VERSION);
    expect(SCENE_SCHEMA_VERSION).toBeGreaterThanOrEqual(4);
  });

  it('writes a grey box payload for marked meshes only', () => {
    const { mesh } = createGreyBoxFixture('HubRoom', size(8, 4, 8), at(0, 2, 0), 'central atrium');
    world.add(mesh);
    world.add(createContentBox('Prop', size(1, 1, 1)));
    const entries = serializer.serialize(world).objects;
    const greyBoxEntries = entries.filter((entry) => entry.greyBox !== undefined);
    expect(entries.length).toBe(2);
    expect(greyBoxEntries.length).toBe(1);
    expect(greyBoxEntries[0]!.name).toBe('HubRoom');
  });

  it('restores id, name, description, and transform through a round trip', () => {
    const position = at(12, 3, -6);
    const boxSize = size(10, 5, 7);
    const { mesh, data } = createGreyBoxFixture('EastWing', boxSize, position, 'long gallery, statues along the walls');
    mesh.rotation.set(0, Math.PI / 4, 0);
    world.add(mesh);

    const loaded = roundTrip(serializer, deserializer, world);
    const restored = onlyGreyBox(loaded);
    const restoredData = GreyBoxRegistry.get(restored);

    expect(restored.name).toBe('EastWing');
    expect(restoredData.id).toBe(data.id);
    expect(restoredData.description).toBe('long gallery, statues along the walls');
    expect(restored.position.toArray()).toEqual(position.toArray());
    expect(restored.rotation.y).toBeCloseTo(Math.PI / 4);
    expect(volumeOf(restored)).toEqual(boxSize.toArray());
  });

  it('restores explicit connections exactly', () => {
    const { mesh, data } = createGreyBoxFixture('Landing', size(4, 3, 4), at(0, 8, 0), 'upper landing');
    const elevatorTarget = allocateGreyBoxId();
    const dropTarget = allocateGreyBoxId();
    data.explicitConnections.push(
      createExplicitConnection('link-elevator', elevatorTarget, 'elevator', 'needs keycard', 'bidirectional'),
    );
    data.explicitConnections.push(createExplicitConnection('link-drop', dropTarget, 'drop', '', 'forward'));
    world.add(mesh);

    const restored = GreyBoxRegistry.get(onlyGreyBox(roundTrip(serializer, deserializer, world)));
    expect(restored.explicitConnections.length).toBe(2);
    expect(restored.explicitConnections[0]!.id).toBe('link-elevator');
    expect(restored.explicitConnections[0]!.targetGreyBoxId).toBe(elevatorTarget);
    expect(restored.explicitConnections[0]!.kind).toBe('elevator');
    expect(restored.explicitConnections[0]!.note).toBe('needs keycard');
    expect(restored.explicitConnections[0]!.direction).toBe('bidirectional');
    expect(restored.explicitConnections[1]!.targetGreyBoxId).toBe(dropTarget);
    expect(restored.explicitConnections[1]!.direction).toBe('forward');
  });

  it('restores suppressed derived adjacencies', () => {
    const { mesh, data } = createGreyBoxFixture('Storage', size(4, 3, 4), at(20, 0, 0), '');
    const suppressed = greyBoxPairKey(data.id, allocateGreyBoxId());
    data.suppressedDerivedConnections.push(suppressed);
    world.add(mesh);

    const restored = GreyBoxRegistry.get(onlyGreyBox(roundTrip(serializer, deserializer, world)));
    expect(restored.suppressedDerivedConnections).toEqual([suppressed]);
  });

  it('keeps several grey boxes distinct across a round trip', () => {
    const first = createGreyBoxFixture('RoomA', size(6, 4, 6), at(0, 0, 0), 'entry');
    const second = createGreyBoxFixture('RoomB', size(4, 4, 10), at(20, 0, 0), 'corridor');
    world.add(first.mesh);
    world.add(second.mesh);

    const loaded = roundTrip(serializer, deserializer, world);
    const restoredIds = GreyBoxRegistry.collectUnder(loaded).map((object) => GreyBoxRegistry.get(object).id);
    expect(restoredIds.length).toBe(2);
    expect(restoredIds).toContain(first.data.id);
    expect(restoredIds).toContain(second.data.id);
  });

  it('survives a second round trip unchanged', () => {
    const { mesh, data } = createGreyBoxFixture('Atrium', size(9, 6, 9), at(4, 0, 4), 'tall central space');
    data.explicitConnections.push(createExplicitConnection('link-1', allocateGreyBoxId(), 'door', 'locked', 'forward'));
    world.add(mesh);

    const once = roundTrip(serializer, deserializer, world);
    const twice = roundTrip(serializer, new SceneDeserializer(), once);
    const restored = GreyBoxRegistry.get(onlyGreyBox(twice));
    expect(restored.id).toBe(data.id);
    expect(restored.description).toBe('tall central space');
    expect(restored.explicitConnections.length).toBe(1);
    expect(restored.explicitConnections[0]!.kind).toBe('door');
  });

  it('restores the grey box look rather than ordinary content material', () => {
    const { mesh } = createGreyBoxFixture('Atrium', size(8, 5, 8), at(0, 0, 0), 'tall space');
    world.add(mesh);
    const restored = onlyGreyBox(roundTrip(serializer, deserializer, world)) as THREE.Mesh;
    const material = restored.material as THREE.Material;
    expect(material.transparent).toBe(true);
    expect(material.depthWrite).toBe(false);
    expect(restored.children.some((child) => isGreyBoxOutline(child))).toBe(true);
  });

  it('refuses to save a marked mesh whose payload was never registered', () => {
    const { mesh } = createGreyBoxFixture('Original', size(3, 3, 3), at(0, 0, 0), 'source');
    const orphan = mesh.clone();
    orphan.name = 'OrphanClone';
    world.add(orphan);
    expect(isGreyBox(orphan)).toBe(true);
    expect(() => serializer.serialize(world)).toThrow(/OrphanClone/);
  });

  it('refuses to load a grey box with a malformed payload', () => {
    const { mesh } = createGreyBoxFixture('Broken', size(3, 3, 3), at(0, 0, 0), 'to be corrupted');
    world.add(mesh);
    const sceneData = serializer.serialize(world);
    const entry = sceneData.objects.find((candidate) => candidate.greyBox !== undefined)!;
    delete (entry.greyBox as unknown as Record<string, unknown>)['description'];
    expect(() => deserializer.deserialize(sceneData, new THREE.Group())).toThrow(/missing a string description/);
  });

  it('names the offending object when a payload fails to load', () => {
    const { mesh } = createGreyBoxFixture('NorthVault', size(3, 3, 3), at(0, 0, 0), '');
    world.add(mesh);
    const sceneData = serializer.serialize(world);
    const entry = sceneData.objects.find((candidate) => candidate.greyBox !== undefined)!;
    (entry.greyBox as unknown as Record<string, unknown>)['id'] = '';
    expect(() => deserializer.deserialize(sceneData, new THREE.Group())).toThrow(/NorthVault/);
  });

  it('loads a pre-grey-box scene as a scene with no grey boxes', () => {
    world.add(createContentBox('LegacyCube', size(2, 2, 2)));
    const legacyScene: SceneJSON = serializer.serialize(world);
    legacyScene.version = 3;
    const target = new THREE.Group();
    deserializer.deserialize(legacyScene, target);
    expect(GreyBoxRegistry.collectUnder(target).length).toBe(0);
    expect(target.children.length).toBe(1);
  });
});

/**
 * Serializes a world and loads it into a fresh group.
 *
 * @param serializer Serializer under test.
 * @param deserializer Deserializer under test.
 * @param source World to round-trip.
 * @returns Freshly loaded world group.
 */
function roundTrip(serializer: SceneSerializer, deserializer: SceneDeserializer, source: THREE.Group): THREE.Group {
  const target = new THREE.Group();
  deserializer.deserialize(serializer.serialize(source), target);
  return target;
}

/**
 * Returns the single grey box under a world, failing the test when the count is
 * not exactly one.
 *
 * @param world World to inspect.
 * @returns The one grey box object.
 */
function onlyGreyBox(world: THREE.Group): THREE.Object3D {
  const found = GreyBoxRegistry.collectUnder(world);
  expect(found.length).toBe(1);
  return found[0]!;
}

/**
 * Reads the restored box dimensions from a grey box mesh.
 *
 * @param object Grey box object.
 * @returns Width, height, and depth of its geometry bounds.
 */
function volumeOf(object: THREE.Object3D): number[] {
  const mesh = object as THREE.Mesh;
  mesh.geometry.computeBoundingBox();
  const bounds = mesh.geometry.boundingBox!;
  return [bounds.max.x - bounds.min.x, bounds.max.y - bounds.min.y, bounds.max.z - bounds.min.z];
}

/**
 * Builds a size vector.
 *
 * @param x Width.
 * @param y Height.
 * @param z Depth.
 * @returns Size vector.
 */
function size(x: number, y: number, z: number): THREE.Vector3 {
  return new THREE.Vector3(x, y, z);
}

/**
 * Builds a position vector.
 *
 * @param x World x.
 * @param y World y.
 * @param z World z.
 * @returns Position vector.
 */
function at(x: number, y: number, z: number): THREE.Vector3 {
  return new THREE.Vector3(x, y, z);
}
