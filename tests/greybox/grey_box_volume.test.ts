import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  computeGreyBoxLocalSize,
  computeGreyBoxWorldBounds,
  computeGreyBoxWorldCenter,
  computeGreyBoxWorldSize,
} from '../../src/greybox/model/grey_box_volume.js';
import { createGreyBoxMesh } from '../../src/greybox/model/grey_box_factory.js';

describe('grey box volume measurement', () => {
  it('reads local size from geometry, ignoring transform', () => {
    const mesh = createGreyBoxMesh('Volume', 6, 4, 10);
    mesh.scale.set(3, 3, 3);
    const localSize = computeGreyBoxLocalSize(mesh);
    expect(localSize.x).toBeCloseTo(6);
    expect(localSize.y).toBeCloseTo(4);
    expect(localSize.z).toBeCloseTo(10);
  });

  it('reports world size that follows a scale resize', () => {
    const mesh = createGreyBoxMesh('Volume', 4, 4, 4);
    expect(computeGreyBoxWorldSize(mesh).x).toBeCloseTo(4);
    mesh.scale.set(2, 1, 1);
    expect(computeGreyBoxWorldSize(mesh).x).toBeCloseTo(8);
    expect(computeGreyBoxWorldSize(mesh).y).toBeCloseTo(4);
  });

  it('reports world size that follows a geometry resize', () => {
    const mesh = createGreyBoxMesh('Volume', 4, 4, 4);
    mesh.geometry.dispose();
    mesh.geometry = new THREE.BoxGeometry(12, 4, 4);
    expect(computeGreyBoxWorldSize(mesh).x).toBeCloseTo(12);
  });

  it('reports world bounds that follow a move', () => {
    const mesh = createGreyBoxMesh('Volume', 2, 2, 2);
    mesh.position.set(10, 5, -3);
    const bounds = computeGreyBoxWorldBounds(mesh);
    expect(bounds.min.x).toBeCloseTo(9);
    expect(bounds.max.x).toBeCloseTo(11);
    expect(computeGreyBoxWorldCenter(mesh).toArray()).toEqual([10, 5, -3]);
  });

  it('accounts for a parent transform', () => {
    const parent = new THREE.Group();
    parent.position.set(100, 0, 0);
    const mesh = createGreyBoxMesh('Volume', 2, 2, 2);
    parent.add(mesh);
    expect(computeGreyBoxWorldCenter(mesh).x).toBeCloseTo(100);
  });

  it('grows the world bounds of a rotated volume', () => {
    const mesh = createGreyBoxMesh('Volume', 10, 2, 2);
    const alignedWidth = computeGreyBoxWorldSize(mesh).x;
    mesh.rotation.y = Math.PI / 4;
    const rotatedSize = computeGreyBoxWorldSize(mesh);
    expect(rotatedSize.x).toBeLessThan(alignedWidth);
    expect(rotatedSize.z).toBeGreaterThan(2);
  });

  it('returns independent bounds objects per call', () => {
    const mesh = createGreyBoxMesh('Volume', 2, 2, 2);
    const first = computeGreyBoxWorldBounds(mesh);
    mesh.position.set(50, 0, 0);
    const second = computeGreyBoxWorldBounds(mesh);
    expect(first.max.x).toBeCloseTo(1);
    expect(second.max.x).toBeCloseTo(51);
  });
});
