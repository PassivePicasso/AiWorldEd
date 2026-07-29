import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { allocateGreyBoxName, formatGreyBoxName } from '../../src/greybox/model/grey_box_naming.js';
import { createDefaultGreyBoxMesh } from '../../src/greybox/model/grey_box_factory.js';
import { createContentBox } from './grey_box_fixture.js';

describe('allocateGreyBoxName', () => {
  let world: THREE.Group;

  beforeEach(() => {
    world = new THREE.Group();
  });

  it('starts at the first name in an empty scene', () => {
    expect(allocateGreyBoxName(world)).toBe(formatGreyBoxName(1));
  });

  it('allocates sequential names as volumes are added', () => {
    const first = allocateGreyBoxName(world);
    world.add(createDefaultGreyBoxMesh(first));
    const second = allocateGreyBoxName(world);
    world.add(createDefaultGreyBoxMesh(second));
    expect(second).toBe(formatGreyBoxName(2));
    expect(allocateGreyBoxName(world)).toBe(formatGreyBoxName(3));
  });

  it('resumes after the highest existing number rather than the count', () => {
    world.add(createDefaultGreyBoxMesh(formatGreyBoxName(7)));
    world.add(createDefaultGreyBoxMesh(formatGreyBoxName(3)));
    expect(allocateGreyBoxName(world)).toBe(formatGreyBoxName(8));
  });

  it('ignores user-renamed volumes when allocating', () => {
    world.add(createDefaultGreyBoxMesh('HubRoom'));
    expect(allocateGreyBoxName(world)).toBe(formatGreyBoxName(1));
  });

  it('ignores content meshes that happen to share the name stem', () => {
    world.add(createContentBox(formatGreyBoxName(9), new THREE.Vector3(1, 1, 1)));
    expect(allocateGreyBoxName(world)).toBe(formatGreyBoxName(1));
  });

  it('finds volumes nested inside groups', () => {
    const group = new THREE.Group();
    group.add(createDefaultGreyBoxMesh(formatGreyBoxName(4)));
    world.add(group);
    expect(allocateGreyBoxName(world)).toBe(formatGreyBoxName(5));
  });

  it('zero-pads names to a stable width', () => {
    expect(formatGreyBoxName(1)).toBe('GreyBox001');
    expect(formatGreyBoxName(42)).toBe('GreyBox042');
  });
});
