import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as THREE from 'three';
import { GreyBoxEdgeFader } from '../../src/greybox/model/grey_box_edge_fader.js';
import { GREY_BOX_EDGE_FADE_FAR, GreyBoxEdgeMaterials } from '../../src/greybox/model/grey_box_edge_materials.js';
import { isGreyBoxOutline, setGreyBoxFillVisible } from '../../src/greybox/model/grey_box_visual.js';
import { createGreyBoxMesh } from '../../src/greybox/model/grey_box_factory.js';
import { createContentBox } from './grey_box_fixture.js';

/** Extra distance past the cull range used to place a far volume. */
const BEYOND_FADE_FAR = GREY_BOX_EDGE_FADE_FAR * 3;

describe('GreyBoxEdgeFader', () => {
  let world: THREE.Group;
  let camera: THREE.PerspectiveCamera;

  beforeEach(() => {
    world = new THREE.Group();
    camera = new THREE.PerspectiveCamera();
    camera.position.set(0, 0, 0);
    camera.updateMatrixWorld(true);
    GreyBoxEdgeFader.invalidateCameraCache();
  });

  afterEach(() => {
    GreyBoxEdgeMaterials.setDepthOcclusionEnabled(true);
  });

  it('keeps a nearby volume outline drawing', () => {
    const mesh = addVolume(world, 0);
    GreyBoxEdgeFader.updateForCamera(world, camera);
    expect(outlineVisible(mesh)).toBe(true);
  });

  it('culls the outline of a volume beyond the fade range', () => {
    const mesh = addVolume(world, BEYOND_FADE_FAR);
    GreyBoxEdgeFader.updateForCamera(world, camera);
    expect(outlineVisible(mesh)).toBe(false);
  });

  it('keeps a selected volume outline over a longer range', () => {
    const mesh = addVolume(world, GREY_BOX_EDGE_FADE_FAR * 1.3);
    GreyBoxEdgeFader.updateForCamera(world, camera);
    expect(outlineVisible(mesh)).toBe(false);
    setGreyBoxFillVisible(mesh, true);
    GreyBoxEdgeFader.updateForCamera(world, camera);
    expect(outlineVisible(mesh)).toBe(true);
  });

  it('measures distance to the nearest point, not the center', () => {
    const near = createGreyBoxMesh('Huge', 400, 400, 400);
    near.position.set(GREY_BOX_EDGE_FADE_FAR + 100, 0, 0);
    world.add(near);
    GreyBoxEdgeFader.updateForCamera(world, camera);
    expect(outlineVisible(near)).toBe(true);
  });

  it('restores every outline for an orthographic pass', () => {
    const far = addVolume(world, BEYOND_FADE_FAR);
    GreyBoxEdgeFader.updateForCamera(world, camera);
    expect(outlineVisible(far)).toBe(false);
    GreyBoxEdgeFader.prepareForOrthographicPass(world);
    expect(outlineVisible(far)).toBe(true);
  });

  it('disables depth testing for the orthographic pass so the layout stays readable', () => {
    GreyBoxEdgeFader.prepareForOrthographicPass(world);
    expect(GreyBoxEdgeMaterials.isDepthOcclusionEnabled()).toBe(false);
  });

  it('re-enables depth testing for the perspective pass', () => {
    GreyBoxEdgeFader.prepareForOrthographicPass(world);
    GreyBoxEdgeFader.prepareForPerspectivePass(world);
    expect(GreyBoxEdgeMaterials.isDepthOcclusionEnabled()).toBe(true);
  });

  it('skips the tree walk for a second orthographic pane in the same frame', () => {
    const mesh = addVolume(world, 0);
    GreyBoxEdgeFader.prepareForOrthographicPass(world);
    const outline = mesh.children.find((child) => isGreyBoxOutline(child))!;
    outline.visible = false;
    GreyBoxEdgeFader.prepareForOrthographicPass(world);
    expect(outline.visible).toBe(false);
  });

  it('walks again after the cache is invalidated', () => {
    const mesh = addVolume(world, 0);
    GreyBoxEdgeFader.prepareForOrthographicPass(world);
    const outline = mesh.children.find((child) => isGreyBoxOutline(child))!;
    outline.visible = false;
    GreyBoxEdgeFader.invalidateCameraCache();
    GreyBoxEdgeFader.prepareForOrthographicPass(world);
    expect(outline.visible).toBe(true);
  });

  it('ignores content meshes that are not grey boxes', () => {
    const content = createContentBox('Prop', new THREE.Vector3(1, 1, 1));
    content.position.set(BEYOND_FADE_FAR, 0, 0);
    world.add(content);
    GreyBoxEdgeFader.updateForCamera(world, camera);
    expect(content.visible).toBe(true);
  });

  it('handles volumes nested under groups', () => {
    const group = new THREE.Group();
    group.position.set(BEYOND_FADE_FAR, 0, 0);
    const mesh = createGreyBoxMesh('Nested', 8, 8, 8);
    group.add(mesh);
    world.add(group);
    GreyBoxEdgeFader.updateForCamera(world, camera);
    expect(outlineVisible(mesh)).toBe(false);
  });
});

/**
 * Adds a default-sized volume at a distance along X.
 *
 * @param world World group receiving the volume.
 * @param distance Distance from the origin along X.
 * @returns The added volume.
 */
function addVolume(world: THREE.Group, distance: number): THREE.Mesh {
  const mesh = createGreyBoxMesh(`Volume${distance}`, 8, 8, 8);
  mesh.position.set(distance, 0, 0);
  world.add(mesh);
  return mesh;
}

/**
 * Reads whether a volume's outline is currently drawing.
 *
 * @param mesh Grey box volume mesh.
 * @returns True when the outline child is visible.
 */
function outlineVisible(mesh: THREE.Mesh): boolean {
  const outline = mesh.children.find((child) => isGreyBoxOutline(child));
  expect(outline).toBeDefined();
  return outline!.visible;
}
