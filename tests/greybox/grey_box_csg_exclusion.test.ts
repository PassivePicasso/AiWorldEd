import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { SolidModel } from '../../src/solid/model/solid_model.js';
import { SolidOperation } from '../../src/solid/types/solid_operation.js';
import { createGreyBoxFixture } from './grey_box_fixture.js';

describe('grey box CSG exclusion', () => {
  let model: SolidModel;

  beforeEach(() => {
    model = new SolidModel('GreyBoxHost');
    model.addBoxBrush(4, SolidOperation.Additive);
    model.rebuild(true);
  });

  it('leaves the compiled result untouched when a grey box overlaps the solid', () => {
    const baseline = resultTriangleCount(model);
    const { mesh } = createGreyBoxFixture('OverlappingVolume', size(8, 8, 8), new THREE.Vector3(), 'covers the solid');
    model.root.parent?.add(mesh);
    model.rebuild(true);
    expect(resultTriangleCount(model)).toBe(baseline);
  });

  it('leaves the compiled result untouched when a grey box is parented under the solid root', () => {
    const baseline = resultTriangleCount(model);
    const { mesh } = createGreyBoxFixture('NestedVolume', size(6, 6, 6), new THREE.Vector3(), '');
    model.root.add(mesh);
    model.rebuild(true);
    expect(resultTriangleCount(model)).toBe(baseline);
  });

  it('never registers a grey box as a solid brush', () => {
    const brushCountBefore = model.getBrushCount();
    const { mesh } = createGreyBoxFixture('NotABrush', size(2, 2, 2), new THREE.Vector3(), '');
    model.root.add(mesh);
    model.rebuild(true);
    expect(model.getBrushCount()).toBe(brushCountBefore);
    expect(model.findBrushByMesh(mesh)).toBeUndefined();
  });

  it('keeps the grey box out of the compiled result mesh identity', () => {
    const { mesh } = createGreyBoxFixture('StillNotGeometry', size(5, 5, 5), new THREE.Vector3(), '');
    model.root.add(mesh);
    model.rebuild(true);
    expect(model.getResultMesh()).not.toBe(mesh);
    expect(SolidModel.isResultMesh(mesh)).toBe(false);
  });
});

/**
 * Counts triangles in a solid model's compiled result mesh.
 *
 * @param model Solid model to inspect.
 * @returns Triangle count of the compiled geometry.
 */
function resultTriangleCount(model: SolidModel): number {
  const geometry = model.getResultMesh().geometry;
  const index = geometry.getIndex();
  if (index) return index.count / 3;
  const position = geometry.getAttribute('position');
  if (!position) return 0;
  return position.count / 3;
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
