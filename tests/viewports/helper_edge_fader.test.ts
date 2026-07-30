import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { HelperEdgeFader } from '../../src/viewports/edge_fade/helper_edge_fader.js';
import type { HelperEdgeFadeProfile } from '../../src/viewports/edge_fade/helper_edge_fade_profile.js';

/** UserData key marking test helper meshes. */
const HELPER_KEY = 'isTestHelper';

/** UserData key marking test helper edge children. */
const EDGE_KEY = 'isTestHelperEdge';

/** UserData key marking a selected test helper. */
const SELECTED_KEY = 'isTestHelperSelected';

/** Cull distance used by the test profile. */
const FADE_FAR = 100;

/** Selected range multiplier used by the test profile. */
const SELECTED_SCALE = 2;

describe('HelperEdgeFader', () => {
  let world: THREE.Group;
  let camera: THREE.PerspectiveCamera;
  let depthCalls: boolean[];
  let fader: HelperEdgeFader;

  beforeEach(() => {
    world = new THREE.Group();
    camera = new THREE.PerspectiveCamera();
    camera.updateMatrixWorld(true);
    depthCalls = [];
    fader = new HelperEdgeFader(createTestProfile(depthCalls));
  });

  it('keeps edges of nearby helpers drawing', () => {
    const helper = addHelper(world, 0);
    fader.updateForCamera(world, camera);
    expect(edgeVisible(helper)).toBe(true);
  });

  it('culls edges beyond the profile fade range', () => {
    const helper = addHelper(world, FADE_FAR * 3);
    fader.updateForCamera(world, camera);
    expect(edgeVisible(helper)).toBe(false);
  });

  it('extends the range for a selected helper by the profile scale', () => {
    const helper = addHelper(world, FADE_FAR * 1.5);
    fader.updateForCamera(world, camera);
    expect(edgeVisible(helper)).toBe(false);
    helper.userData[SELECTED_KEY] = true;
    fader.updateForCamera(world, camera);
    expect(edgeVisible(helper)).toBe(true);
  });

  it('measures to the nearest point on large helpers', () => {
    const helper = new THREE.Mesh(new THREE.BoxGeometry(400, 400, 400));
    helper.userData[HELPER_KEY] = true;
    helper.add(createEdge());
    helper.position.set(FADE_FAR + 50, 0, 0);
    world.add(helper);
    fader.updateForCamera(world, camera);
    expect(edgeVisible(helper)).toBe(true);
  });

  it('accounts for ancestor transforms', () => {
    const group = new THREE.Group();
    group.position.set(FADE_FAR * 3, 0, 0);
    const helper = addHelper(group, 0);
    world.add(group);
    fader.updateForCamera(world, camera);
    expect(edgeVisible(helper)).toBe(false);
  });

  it('restores every edge for an orthographic pass', () => {
    const helper = addHelper(world, FADE_FAR * 3);
    fader.updateForCamera(world, camera);
    expect(edgeVisible(helper)).toBe(false);
    fader.prepareForOrthographicPass(world);
    expect(edgeVisible(helper)).toBe(true);
  });

  it('asks the profile to drop depth testing for orthographic panes', () => {
    fader.prepareForOrthographicPass(world);
    expect(depthCalls.at(-1)).toBe(false);
  });

  it('asks the profile to restore depth testing for the perspective pass', () => {
    fader.prepareForPerspectivePass(world);
    expect(depthCalls.at(-1)).toBe(true);
  });

  it('skips a redundant walk for a second orthographic pane in one frame', () => {
    const helper = addHelper(world, 0);
    fader.prepareForOrthographicPass(world);
    edgeOf(helper).visible = false;
    fader.prepareForOrthographicPass(world);
    expect(edgeVisible(helper)).toBe(false);
  });

  it('walks again after the pass cache is invalidated', () => {
    const helper = addHelper(world, 0);
    fader.prepareForOrthographicPass(world);
    edgeOf(helper).visible = false;
    fader.invalidateCameraCache();
    fader.prepareForOrthographicPass(world);
    expect(edgeVisible(helper)).toBe(true);
  });

  it('walks again for an orthographic pane after a perspective pass', () => {
    const helper = addHelper(world, FADE_FAR * 3);
    fader.prepareForOrthographicPass(world);
    fader.updateForCamera(world, camera);
    expect(edgeVisible(helper)).toBe(false);
    fader.prepareForOrthographicPass(world);
    expect(edgeVisible(helper)).toBe(true);
  });

  it('ignores meshes the profile does not match', () => {
    const other = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    const edge = createEdge();
    other.add(edge);
    other.position.set(FADE_FAR * 3, 0, 0);
    world.add(other);
    fader.updateForCamera(world, camera);
    expect(edge.visible).toBe(true);
  });

  it('ignores children the profile does not treat as edges', () => {
    const helper = addHelper(world, FADE_FAR * 3);
    const decoration = new THREE.LineSegments(new THREE.BufferGeometry());
    helper.add(decoration);
    fader.updateForCamera(world, camera);
    expect(decoration.visible).toBe(true);
    expect(edgeVisible(helper)).toBe(false);
  });

  it('keeps independent pass state per fader instance', () => {
    const other = new HelperEdgeFader(createTestProfile([]));
    const helper = addHelper(world, 0);
    fader.prepareForOrthographicPass(world);
    edgeOf(helper).visible = false;
    other.prepareForOrthographicPass(world);
    expect(edgeVisible(helper)).toBe(true);
  });
});

/**
 * Builds a profile over the test userData keys.
 *
 * @param depthCalls Records each depth-occlusion request.
 * @returns Profile for the fader under test.
 */
function createTestProfile(depthCalls: boolean[]): HelperEdgeFadeProfile {
  return {
    matchesMesh: (mesh) => mesh.userData[HELPER_KEY] === true,
    matchesEdge: (child) => child.userData[EDGE_KEY] === true,
    isSelected: (mesh) => mesh.userData[SELECTED_KEY] === true,
    fadeFar: FADE_FAR,
    selectedFadeRangeScale: SELECTED_SCALE,
    refreshAncestorMatrices: true,
    setDepthOcclusionEnabled: (_root, enabled) => depthCalls.push(enabled),
  };
}

/**
 * Adds a small helper mesh with one edge child at a distance along X.
 *
 * @param parent Parent to attach the helper to.
 * @param distance Distance from the parent origin along X.
 * @returns The added helper mesh.
 */
function addHelper(parent: THREE.Object3D, distance: number): THREE.Mesh {
  const helper = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2));
  helper.userData[HELPER_KEY] = true;
  helper.add(createEdge());
  helper.position.set(distance, 0, 0);
  parent.add(helper);
  return helper;
}

/**
 * Builds an edge child the test profile recognizes.
 *
 * @returns Marked line segments.
 */
function createEdge(): THREE.LineSegments {
  const edge = new THREE.LineSegments(new THREE.BufferGeometry());
  edge.userData[EDGE_KEY] = true;
  return edge;
}

/**
 * Returns the edge child of a helper mesh.
 *
 * @param helper Helper mesh.
 * @returns Marked edge child.
 */
function edgeOf(helper: THREE.Mesh): THREE.Object3D {
  const edge = helper.children.find((child) => child.userData[EDGE_KEY] === true);
  expect(edge).toBeDefined();
  return edge!;
}

/**
 * Returns whether a helper's edge child is drawing.
 *
 * @param helper Helper mesh.
 * @returns True when the edge is visible.
 */
function edgeVisible(helper: THREE.Mesh): boolean {
  return edgeOf(helper).visible;
}
