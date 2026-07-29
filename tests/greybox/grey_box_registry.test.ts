import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { GreyBoxRegistry } from '../../src/greybox/model/grey_box_registry.js';
import { isGreyBox } from '../../src/greybox/model/grey_box_keys.js';
import { getGreyBoxDescription, getGreyBoxId, setGreyBoxDescription } from '../../src/greybox/model/grey_box_access.js';
import { createGreyBoxFixture, createContentBox } from './grey_box_fixture.js';

describe('GreyBoxRegistry', () => {
  let world: THREE.Group;

  beforeEach(() => {
    world = new THREE.Group();
  });

  it('marks a registered mesh as a grey box', () => {
    const { mesh } = createGreyBoxFixture('HubRoom', boxSize(8, 4, 8), origin(), 'central atrium');
    expect(isGreyBox(mesh)).toBe(true);
    expect(GreyBoxRegistry.has(mesh)).toBe(true);
  });

  it('leaves ordinary content meshes unmarked', () => {
    const mesh = createContentBox('Crate', boxSize(1, 1, 1));
    expect(isGreyBox(mesh)).toBe(false);
    expect(GreyBoxRegistry.tryGet(mesh)).toBeUndefined();
  });

  it('gives every grey box a distinct id', () => {
    const first = createGreyBoxFixture('A', boxSize(2, 2, 2), origin(), '');
    const second = createGreyBoxFixture('B', boxSize(2, 2, 2), origin(), '');
    expect(getGreyBoxId(first.mesh)).not.toBe(getGreyBoxId(second.mesh));
  });

  it('reads back a written description', () => {
    const { mesh } = createGreyBoxFixture('Vault', boxSize(4, 3, 4), origin(), '');
    setGreyBoxDescription(mesh, 'locked treasure room reached by elevator');
    expect(getGreyBoxDescription(mesh)).toBe('locked treasure room reached by elevator');
  });

  it('treats an empty description as a legal stored value', () => {
    const { mesh } = createGreyBoxFixture('Blank', boxSize(2, 2, 2), origin(), '');
    expect(getGreyBoxDescription(mesh)).toBe('');
    expect(GreyBoxRegistry.has(mesh)).toBe(true);
  });

  it('fails loudly for a marked mesh with no registered payload', () => {
    const { mesh } = createGreyBoxFixture('Cloned', boxSize(2, 2, 2), origin(), 'source volume');
    const clone = mesh.clone();
    expect(isGreyBox(clone)).toBe(true);
    expect(GreyBoxRegistry.has(clone)).toBe(false);
    expect(() => GreyBoxRegistry.get(clone)).toThrow(/no registered grey box data/);
  });

  it('names the offending object in the failure message', () => {
    const { mesh } = createGreyBoxFixture('EastCorridor', boxSize(2, 2, 8), origin(), '');
    const clone = mesh.clone();
    expect(() => GreyBoxRegistry.get(clone)).toThrow(/EastCorridor/);
  });

  it('snapshots payloads so callers cannot mutate stored state', () => {
    const { mesh } = createGreyBoxFixture('Hub', boxSize(6, 4, 6), origin(), 'original');
    const snapshot = GreyBoxRegistry.snapshot(mesh);
    snapshot.description = 'mutated copy';
    snapshot.suppressedDerivedConnections.push('bogus|key');
    expect(getGreyBoxDescription(mesh)).toBe('original');
    expect(GreyBoxRegistry.get(mesh).suppressedDerivedConnections.length).toBe(0);
  });

  it('collects grey boxes under a root and ignores other content', () => {
    const first = createGreyBoxFixture('RoomA', boxSize(4, 3, 4), origin(), '');
    const second = createGreyBoxFixture('RoomB', boxSize(4, 3, 4), origin(), '');
    world.add(first.mesh);
    world.add(createContentBox('Prop', boxSize(1, 1, 1)));
    const nested = new THREE.Group();
    nested.add(second.mesh);
    world.add(nested);
    const collected = GreyBoxRegistry.collectUnder(world);
    expect(collected.length).toBe(2);
    expect(collected).toContain(first.mesh);
    expect(collected).toContain(second.mesh);
  });

  it('resolves a grey box by its stable id', () => {
    const { mesh } = createGreyBoxFixture('Target', boxSize(3, 3, 3), origin(), '');
    world.add(mesh);
    expect(GreyBoxRegistry.findById(world, getGreyBoxId(mesh))).toBe(mesh);
  });

  it('returns null when no grey box carries the requested id', () => {
    const { mesh } = createGreyBoxFixture('Target', boxSize(3, 3, 3), origin(), '');
    world.add(mesh);
    expect(GreyBoxRegistry.findById(world, 'greybox-does-not-exist')).toBeNull();
  });

  it('drops the payload on unregister', () => {
    const { mesh } = createGreyBoxFixture('Retired', boxSize(2, 2, 2), origin(), '');
    GreyBoxRegistry.unregister(mesh);
    expect(GreyBoxRegistry.has(mesh)).toBe(false);
    expect(() => GreyBoxRegistry.get(mesh)).toThrow(/no registered grey box data/);
  });
});

/**
 * Builds a box size vector.
 *
 * @param x Width.
 * @param y Height.
 * @param z Depth.
 * @returns Size vector.
 */
function boxSize(x: number, y: number, z: number): THREE.Vector3 {
  return new THREE.Vector3(x, y, z);
}

/**
 * Builds the world origin as a fresh vector.
 *
 * @returns Zero vector.
 */
function origin(): THREE.Vector3 {
  return new THREE.Vector3();
}
