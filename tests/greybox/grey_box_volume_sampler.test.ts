import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import {
  sampleGreyBoxVolume,
  sampleGreyBoxVolumesUnder,
} from '../../src/greybox/connectivity/grey_box_volume_sampler.js';
import { deriveGreyBoxRelations } from '../../src/greybox/connectivity/grey_box_derived_graph.js';
import { greyBoxVolumeWorldBounds } from '../../src/greybox/connectivity/grey_box_oriented_volume.js';
import { getGreyBoxId } from '../../src/greybox/model/grey_box_access.js';
import { createGreyBoxMesh } from '../../src/greybox/model/grey_box_factory.js';
import { greyBoxPairKey } from '../../src/greybox/model/grey_box_pair_key.js';
import { createContentBox } from './grey_box_fixture.js';

describe('sampleGreyBoxVolume', () => {
  let world: THREE.Group;

  beforeEach(() => {
    world = new THREE.Group();
  });

  it('samples id, name, center, and half extents', () => {
    const mesh = createGreyBoxMesh('HubRoom', 8, 4, 6);
    mesh.position.set(10, 2, -4);
    world.add(mesh);
    const volume = sampleGreyBoxVolume(mesh);
    expect(volume.id).toBe(getGreyBoxId(mesh));
    expect(volume.name).toBe('HubRoom');
    expect(volume.center.toArray()).toEqual([10, 2, -4]);
    expect(volume.halfExtents.toArray()).toEqual([4, 2, 3]);
  });

  it('folds transform scale into the half extents', () => {
    const mesh = createGreyBoxMesh('Wide', 4, 4, 4);
    mesh.scale.set(3, 1, 1);
    const volume = sampleGreyBoxVolume(mesh);
    expect(volume.halfExtents.x).toBeCloseTo(6);
    expect(volume.halfExtents.y).toBeCloseTo(2);
  });

  it('accounts for a parent transform', () => {
    const parent = new THREE.Group();
    parent.position.set(100, 0, 0);
    const mesh = createGreyBoxMesh('Nested', 4, 4, 4);
    parent.add(mesh);
    world.add(parent);
    expect(sampleGreyBoxVolume(mesh).center.x).toBeCloseTo(100);
  });

  it('samples rotation so world bounds grow with yaw', () => {
    const mesh = createGreyBoxMesh('Rotated', 10, 2, 2);
    mesh.rotation.y = Math.PI / 4;
    const bounds = greyBoxVolumeWorldBounds(sampleGreyBoxVolume(mesh));
    expect(bounds.max.x - bounds.min.x).toBeCloseTo(bounds.max.z - bounds.min.z);
    expect(bounds.max.x - bounds.min.x).toBeGreaterThan(2);
  });

  it('collects every grey box under a root and skips other content', () => {
    world.add(createGreyBoxMesh('RoomA', 4, 4, 4));
    world.add(createContentBox('Prop', new THREE.Vector3(1, 1, 1)));
    const nested = new THREE.Group();
    nested.add(createGreyBoxMesh('RoomB', 4, 4, 4));
    world.add(nested);
    expect(sampleGreyBoxVolumesUnder(world).length).toBe(2);
  });

  it('derives connectivity end to end from a scene', () => {
    const left = createGreyBoxMesh('Left', 10, 10, 10);
    left.position.set(0, 0, 0);
    const right = createGreyBoxMesh('Right', 10, 10, 10);
    right.position.set(10, 0, 0);
    world.add(left);
    world.add(right);
    const connections = deriveGreyBoxRelations(sampleGreyBoxVolumesUnder(world));
    expect(connections.length).toBe(1);
    expect(connections[0]!.pairKey).toBe(greyBoxPairKey(getGreyBoxId(left), getGreyBoxId(right)));
    expect(connections[0]!.contacts[0]!.area).toBeCloseTo(100);
  });

  it('follows a volume moved after the previous sample', () => {
    const first = createGreyBoxMesh('First', 10, 10, 10);
    const second = createGreyBoxMesh('Second', 10, 10, 10);
    second.position.set(30, 0, 0);
    world.add(first);
    world.add(second);
    expect(deriveGreyBoxRelations(sampleGreyBoxVolumesUnder(world))).toEqual([]);
    second.position.set(10, 0, 0);
    expect(deriveGreyBoxRelations(sampleGreyBoxVolumesUnder(world)).length).toBe(1);
  });

  it('returns an empty list for a scene with no grey boxes', () => {
    world.add(createContentBox('Prop', new THREE.Vector3(1, 1, 1)));
    expect(sampleGreyBoxVolumesUnder(world)).toEqual([]);
  });
});
