import * as THREE from 'three';
import { Theme } from '../../theme.js';
import { DECORATIVE_EDGE_USERDATA_KEY } from '../../utils/mesh_edge_sync.js';

/** Fill opacity of a grey box volume: present, but never hiding its contents. */
export const GREY_BOX_FILL_OPACITY = 0.16;

/** UserData key marking the outline child of a grey box volume. */
export const GREY_BOX_OUTLINE_USERDATA_KEY = 'isGreyBoxOutline';

/**
 * Render order pushing grey box fills after opaque content so brushes authored
 * inside a volume stay visible through it.
 */
export const GREY_BOX_RENDER_ORDER = 2;

/**
 * Builds the translucent fill material for a grey box volume. Depth writes are
 * off so geometry authored inside the volume reads through the fill.
 *
 * @returns Fill material for a planning volume.
 */
export function createGreyBoxMaterial(): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color: Theme.greyBoxColor,
    transparent: true,
    opacity: GREY_BOX_FILL_OPACITY,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

/**
 * Builds the outline material for a grey box volume. Depth testing is off so
 * the volume stays legible in 2D ortho views and behind other geometry.
 *
 * @returns Outline material for a planning volume.
 */
export function createGreyBoxOutlineMaterial(): THREE.LineBasicMaterial {
  return new THREE.LineBasicMaterial({
    color: Theme.greyBoxEdgeColor,
    depthTest: false,
    transparent: true,
    opacity: 0.9,
  });
}

/**
 * Applies the grey box look to a mesh: translucent fill plus a wireframe
 * outline. Used on creation and on scene load so a loaded volume never renders
 * as ordinary content geometry.
 *
 * @param mesh Grey box volume mesh.
 */
export function applyGreyBoxVisual(mesh: THREE.Mesh): void {
  disposeExistingMaterial(mesh);
  mesh.material = createGreyBoxMaterial();
  mesh.renderOrder = GREY_BOX_RENDER_ORDER;
  removeGreyBoxOutline(mesh);
  mesh.add(buildGreyBoxOutline(mesh.geometry));
}

/**
 * Returns whether an object is the outline child of a grey box volume.
 *
 * @param object Candidate object.
 * @returns True for grey box outlines.
 */
export function isGreyBoxOutline(object: THREE.Object3D): boolean {
  return object.userData[GREY_BOX_OUTLINE_USERDATA_KEY] === true;
}

/**
 * Builds the wireframe outline child for a grey box volume.
 *
 * @param geometry Volume geometry to outline.
 * @returns Outline line segments marked as a decorative helper.
 */
function buildGreyBoxOutline(geometry: THREE.BufferGeometry): THREE.LineSegments {
  const outline = new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 1), createGreyBoxOutlineMaterial());
  outline.userData[GREY_BOX_OUTLINE_USERDATA_KEY] = true;
  outline.userData[DECORATIVE_EDGE_USERDATA_KEY] = true;
  outline.renderOrder = GREY_BOX_RENDER_ORDER;
  return outline;
}

/**
 * Removes and disposes any existing grey box outline children.
 *
 * @param mesh Grey box volume mesh.
 */
function removeGreyBoxOutline(mesh: THREE.Mesh): void {
  const outlines = mesh.children.filter((child) => isGreyBoxOutline(child));
  outlines.forEach((outline) => {
    mesh.remove(outline);
    disposeOutline(outline);
  });
}

/**
 * Disposes the geometry and material of an outline object.
 *
 * @param outline Outline object being discarded.
 */
function disposeOutline(outline: THREE.Object3D): void {
  if (!(outline instanceof THREE.LineSegments)) return;
  outline.geometry.dispose();
  if (!Array.isArray(outline.material)) {
    outline.material.dispose();
  }
}

/**
 * Disposes the material a mesh currently owns before it is replaced.
 *
 * @param mesh Mesh whose material is being replaced.
 */
function disposeExistingMaterial(mesh: THREE.Mesh): void {
  if (!mesh.material) return;
  if (Array.isArray(mesh.material)) {
    mesh.material.forEach((material) => material.dispose());
    return;
  }
  mesh.material.dispose();
}
