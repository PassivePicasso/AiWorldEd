import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  GREY_BOX_FILL_OPACITY,
  applyGreyBoxVisual,
  createGreyBoxMaterial,
  isGreyBoxFillVisible,
  isGreyBoxOutline,
  setGreyBoxFillVisible,
} from '../../src/greybox/model/grey_box_visual.js';
import {
  GREY_BOX_DISTANCE_FADE_KEY,
  GREY_BOX_EDGE_FADE_FAR,
  GREY_BOX_EDGE_FADE_NEAR,
  GREY_BOX_EDGE_OPACITY,
  GREY_BOX_SHARED_MATERIAL_KEY,
  GreyBoxEdgeMaterials,
} from '../../src/greybox/model/grey_box_edge_materials.js';
import { createGreyBoxMesh } from '../../src/greybox/model/grey_box_factory.js';
import { createContentMaterial } from '../../src/materials/content_material_factory.js';
import { DECORATIVE_EDGE_USERDATA_KEY } from '../../src/utils/mesh_edge_sync.js';
import { Theme } from '../../src/theme.js';

describe('grey box fill', () => {
  it('starts outline-only so a blocked-out level is not stacked translucency', () => {
    const mesh = createGreyBoxMesh('Volume', 4, 3, 5);
    expect(isGreyBoxFillVisible(mesh)).toBe(false);
    expect((mesh.material as THREE.MeshBasicMaterial).opacity).toBe(0);
  });

  it('fills only while the volume is selected', () => {
    const mesh = createGreyBoxMesh('Volume', 4, 3, 5);
    setGreyBoxFillVisible(mesh, true);
    expect(isGreyBoxFillVisible(mesh)).toBe(true);
    expect((mesh.material as THREE.MeshBasicMaterial).opacity).toBeCloseTo(GREY_BOX_FILL_OPACITY);
    setGreyBoxFillVisible(mesh, false);
    expect((mesh.material as THREE.MeshBasicMaterial).opacity).toBe(0);
  });

  it('keeps the fill translucent and depth-write free so contents read through', () => {
    const material = createGreyBoxMaterial();
    expect(material.transparent).toBe(true);
    expect(material.depthWrite).toBe(false);
    expect(material.side).toBe(THREE.DoubleSide);
    expect(material.color.getHex()).toBe(Theme.greyBoxColor);
  });

  it('is visually distinct from the ordinary content material', () => {
    const greyBox = createGreyBoxMaterial();
    const content = createContentMaterial(Theme.boxColor);
    expect(greyBox.transparent).not.toBe(content.transparent);
    expect(greyBox.color.getHex()).not.toBe(content.color.getHex());
  });

  it('preserves fill state when the visual is reapplied on scene load', () => {
    const mesh = createGreyBoxMesh('Volume', 4, 3, 5);
    setGreyBoxFillVisible(mesh, true);
    applyGreyBoxVisual(mesh);
    expect((mesh.material as THREE.MeshBasicMaterial).opacity).toBeCloseTo(GREY_BOX_FILL_OPACITY);
  });
});

describe('grey box outline', () => {
  it('attaches exactly one outline child marked as a decorative helper', () => {
    const mesh = createGreyBoxMesh('Volume', 4, 3, 5);
    const outlines = mesh.children.filter((child) => isGreyBoxOutline(child));
    expect(outlines.length).toBe(1);
    expect(outlines[0]!.userData[DECORATIVE_EDGE_USERDATA_KEY]).toBe(true);
  });

  it('shares one material across every volume', () => {
    const first = createGreyBoxMesh('First', 4, 4, 4);
    const second = createGreyBoxMesh('Second', 8, 8, 8);
    expect(outlineMaterial(first)).toBe(outlineMaterial(second));
    expect(outlineMaterial(first)).toBe(GreyBoxEdgeMaterials.getOutlineMaterial());
  });

  it('marks the shared material so dispose paths skip it', () => {
    const material = GreyBoxEdgeMaterials.getOutlineMaterial();
    expect(material.userData[GREY_BOX_SHARED_MATERIAL_KEY]).toBe(true);
    expect(material.userData[GREY_BOX_DISTANCE_FADE_KEY]).toBe(true);
    expect(GreyBoxEdgeMaterials.isSharedMaterial(material)).toBe(true);
  });

  it('keeps the shared material alive when a volume rebuilds its outline', () => {
    const mesh = createGreyBoxMesh('Volume', 4, 4, 4);
    const shared = GreyBoxEdgeMaterials.getOutlineMaterial();
    applyGreyBoxVisual(mesh);
    expect(outlineMaterial(mesh)).toBe(shared);
    expect(shared.uniforms['opacity']!.value).toBeCloseTo(GREY_BOX_EDGE_OPACITY);
  });

  it('carries distance-fade uniforms tuned for layout range', () => {
    const material = GreyBoxEdgeMaterials.getOutlineMaterial();
    expect(material.uniforms['fadeNear']!.value).toBe(GREY_BOX_EDGE_FADE_NEAR);
    expect(material.uniforms['fadeFar']!.value).toBe(GREY_BOX_EDGE_FADE_FAR);
    expect(GREY_BOX_EDGE_FADE_FAR).toBeGreaterThan(GREY_BOX_EDGE_FADE_NEAR);
  });

  it('skips the fade for orthographic cameras inside the shader', () => {
    const material = GreyBoxEdgeMaterials.getOutlineMaterial();
    expect(material.vertexShader).toContain('projectionMatrix[2][3]');
    expect(material.vertexShader).toContain('isPerspective');
    expect(material.vertexShader).toContain('vFade = 1.0');
  });

  it('toggles depth testing between perspective and orthographic passes', () => {
    const material = GreyBoxEdgeMaterials.getOutlineMaterial();
    GreyBoxEdgeMaterials.setDepthOcclusionEnabled(true);
    expect(material.depthTest).toBe(true);
    expect(material.depthFunc).toBe(THREE.LessEqualDepth);
    GreyBoxEdgeMaterials.setDepthOcclusionEnabled(false);
    expect(material.depthTest).toBe(false);
    expect(material.depthFunc).toBe(THREE.AlwaysDepth);
    GreyBoxEdgeMaterials.setDepthOcclusionEnabled(true);
    expect(GreyBoxEdgeMaterials.isDepthOcclusionEnabled()).toBe(true);
  });

  it('never writes depth from the outline', () => {
    expect(GreyBoxEdgeMaterials.getOutlineMaterial().depthWrite).toBe(false);
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
    expect(mesh.material).toBeInstanceOf(THREE.MeshBasicMaterial);
    expect((mesh.material as THREE.Material).transparent).toBe(true);
    expect(mesh.children.some((child) => isGreyBoxOutline(child))).toBe(true);
  });
});

/**
 * Reads the outline material of a grey box volume.
 *
 * @param mesh Grey box volume mesh.
 * @returns Shared outline shader material.
 */
function outlineMaterial(mesh: THREE.Mesh): THREE.ShaderMaterial {
  const outline = mesh.children.find((child) => isGreyBoxOutline(child)) as THREE.LineSegments;
  return outline.material as THREE.ShaderMaterial;
}
