import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  GREY_BOX_FILL_OPACITY,
  applyGreyBoxVisual,
  createGreyBoxMaterial,
  isGreyBoxOutline,
} from '../../src/greybox/model/grey_box_visual.js';
import { createGreyBoxMesh } from '../../src/greybox/model/grey_box_factory.js';
import { createContentMaterial } from '../../src/materials/content_material_factory.js';
import { DECORATIVE_EDGE_USERDATA_KEY } from '../../src/utils/mesh_edge_sync.js';
import { Theme } from '../../src/theme.js';

describe('grey box visual', () => {
  it('renders translucently so contents stay visible', () => {
    const material = createGreyBoxMaterial();
    expect(material.transparent).toBe(true);
    expect(material.opacity).toBe(GREY_BOX_FILL_OPACITY);
    expect(material.opacity).toBeLessThan(1);
  });

  it('does not write depth, so brushes inside read through the fill', () => {
    expect(createGreyBoxMaterial().depthWrite).toBe(false);
  });

  it('renders both faces so the volume reads from inside as well as outside', () => {
    expect(createGreyBoxMaterial().side).toBe(THREE.DoubleSide);
  });

  it('uses the theme grey box fill color', () => {
    expect(createGreyBoxMaterial().color.getHex()).toBe(Theme.greyBoxColor);
  });

  it('is visually distinct from the ordinary content material', () => {
    const greyBox = createGreyBoxMaterial();
    const content = createContentMaterial(Theme.boxColor);
    expect(greyBox.transparent).not.toBe(content.transparent);
    expect(greyBox.color.getHex()).not.toBe(content.color.getHex());
  });

  it('attaches exactly one outline child marked as a decorative helper', () => {
    const mesh = createGreyBoxMesh('Volume', 4, 3, 5);
    const outlines = mesh.children.filter((child) => isGreyBoxOutline(child));
    expect(outlines.length).toBe(1);
    expect(outlines[0]!.userData[DECORATIVE_EDGE_USERDATA_KEY]).toBe(true);
  });

  it('draws the outline without depth testing so 2D views stay readable', () => {
    const mesh = createGreyBoxMesh('Volume', 4, 3, 5);
    const outline = mesh.children.find((child) => isGreyBoxOutline(child)) as THREE.LineSegments;
    const material = outline.material as THREE.LineBasicMaterial;
    expect(material.depthTest).toBe(false);
    expect(material.color.getHex()).toBe(Theme.greyBoxEdgeColor);
  });

  it('never stacks duplicate outlines when reapplied', () => {
    const mesh = createGreyBoxMesh('Volume', 4, 3, 5);
    applyGreyBoxVisual(mesh);
    applyGreyBoxVisual(mesh);
    expect(mesh.children.filter((child) => isGreyBoxOutline(child)).length).toBe(1);
  });

  it('rebuilds the outline to match resized geometry', () => {
    const mesh = createGreyBoxMesh('Volume', 2, 2, 2);
    mesh.geometry.dispose();
    mesh.geometry = new THREE.BoxGeometry(10, 2, 2);
    applyGreyBoxVisual(mesh);
    const outline = mesh.children.find((child) => isGreyBoxOutline(child)) as THREE.LineSegments;
    outline.geometry.computeBoundingBox();
    const bounds = outline.geometry.boundingBox!;
    expect(bounds.max.x - bounds.min.x).toBeCloseTo(10);
  });

  it('converts an ordinary mesh into the grey box look', () => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), createContentMaterial(Theme.boxColor));
    applyGreyBoxVisual(mesh);
    const material = mesh.material as THREE.Material;
    expect(material).toBeInstanceOf(THREE.MeshBasicMaterial);
    expect(material.transparent).toBe(true);
    expect(mesh.children.some((child) => isGreyBoxOutline(child))).toBe(true);
  });
});
