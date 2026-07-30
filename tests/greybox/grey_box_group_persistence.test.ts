import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { SceneSerializer } from '../../src/io/scene_serializer.js';
import { SceneDeserializer } from '../../src/io/scene_deserializer.js';
import { GreyBoxRegistry } from '../../src/greybox/model/grey_box_registry.js';
import { isGreyBoxGroup } from '../../src/greybox/model/grey_box_group.js';
import { createGreyBoxGroup, createGreyBoxMesh } from '../../src/greybox/model/grey_box_factory.js';
import { getGreyBoxId } from '../../src/greybox/model/grey_box_access.js';

describe('grey box group persistence', () => {
  let serializer: SceneSerializer;
  let deserializer: SceneDeserializer;
  let world: THREE.Group;

  beforeEach(() => {
    serializer = new SceneSerializer();
    deserializer = new SceneDeserializer();
    world = new THREE.Group();
  });

  it('writes a group payload distinct from a volume payload', () => {
    const group = createGreyBoxGroup('Ground Floor', 'everything at street level');
    group.add(createGreyBoxMesh('Hall', 8, 4, 8));
    world.add(group);
    const entries = serializer.serialize(world).objects;
    expect(entries.filter((entry) => entry.greyBoxGroup !== undefined).length).toBe(1);
    expect(entries.filter((entry) => entry.greyBox !== undefined).length).toBe(1);
  });

  it('restores a group with its id, name, and description', () => {
    const group = createGreyBoxGroup('Ground Floor', 'everything at street level');
    world.add(group);
    const restored = roundTrip(serializer, deserializer, world).children[0]!;
    expect(isGreyBoxGroup(restored)).toBe(true);
    expect(restored.name).toBe('Ground Floor');
    expect(GreyBoxRegistry.get(restored).id).toBe(getGreyBoxId(group));
    expect(GreyBoxRegistry.get(restored).description).toBe('everything at street level');
  });

  it('restores the volumes a group holds, still nested under it', () => {
    const group = createGreyBoxGroup('East Wing');
    const hall = createGreyBoxMesh('Hall', 8, 4, 8);
    group.add(hall);
    world.add(group);

    const restoredGroup = roundTrip(serializer, deserializer, world).children[0]!;
    const restoredHall = restoredGroup.children.find((child) => child.name === 'Hall');
    expect(restoredHall).toBeDefined();
    expect(GreyBoxRegistry.get(restoredHall!).id).toBe(getGreyBoxId(hall));
  });

  it('keeps a volume nested inside another volume, which used to be dropped', () => {
    const ravine = createGreyBoxMesh('Ravine', 20, 10, 10);
    const bridge = createGreyBoxMesh('Bridge', 4, 1, 12);
    ravine.add(bridge);
    world.add(ravine);

    const restored = roundTrip(serializer, deserializer, world);
    const restoredRavine = restored.children[0]!;
    expect(restoredRavine.name).toBe('Ravine');
    expect(restoredRavine.children.some((child) => child.name === 'Bridge')).toBe(true);
    expect(GreyBoxRegistry.collectUnder(restored).length).toBe(2);
  });

  it('survives a second round trip with the hierarchy intact', () => {
    const group = createGreyBoxGroup('Whole Site');
    const wing = createGreyBoxGroup('East Wing');
    wing.add(createGreyBoxMesh('Hall', 6, 6, 6));
    group.add(wing);
    world.add(group);

    const twice = roundTrip(serializer, new SceneDeserializer(), roundTrip(serializer, deserializer, world));
    const outer = twice.children[0]!;
    expect(outer.name).toBe('Whole Site');
    expect(outer.children[0]!.name).toBe('East Wing');
    expect(outer.children[0]!.children[0]!.name).toBe('Hall');
  });

  it('refuses to load a group with a malformed payload, naming it', () => {
    const group = createGreyBoxGroup('BrokenWing');
    world.add(group);
    const sceneData = serializer.serialize(world);
    const entry = sceneData.objects.find((candidate) => candidate.greyBoxGroup !== undefined)!;
    (entry.greyBoxGroup as unknown as Record<string, unknown>)['id'] = '';
    expect(() => deserializer.deserialize(sceneData, new THREE.Group())).toThrow(/BrokenWing/);
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
