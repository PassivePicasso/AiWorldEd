import * as THREE from 'three';
import { Theme } from '../../theme.js';
import { DECORATIVE_EDGE_USERDATA_KEY } from '../../utils/mesh_edge_sync.js';
import { GreyBoxEdgeMaterials } from './grey_box_edge_materials.js';

/**
 * Fill opacity of a selected volume. Unselected volumes are outline-only, the
 * same clarity trade the solid brush helpers make: with a fill on every volume,
 * a blocked-out level turns into overlapping translucent mush.
 */
export const GREY_BOX_FILL_OPACITY = 0.16;

/** UserData key marking the outline child of a grey box volume. */
export const GREY_BOX_OUTLINE_USERDATA_KEY = 'isGreyBoxOutline';

/** UserData key recording whether a volume currently shows its fill. */
export const GREY_BOX_FILL_USERDATA_KEY = 'greyBoxFillVisible';

/**
 * Render order pushing grey box fills after opaque content so brushes authored
 * inside a volume stay visible through it.
 */
export const GREY_BOX_RENDER_ORDER = 2;

/**
 * Builds the fill material for a grey box volume. Depth writes are off so
 * geometry authored inside reads through the fill.
 *
 * @returns Fill material, starting outline-only (fully transparent).
 */
export function createGreyBoxMaterial(): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color: Theme.greyBoxColor,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

/**
 * Applies the grey box look to a mesh: a shared distance-faded outline plus a
 * fill that only appears while the volume is selected. Used on creation and on
 * scene load so a loaded volume never renders as ordinary content geometry.
 *
 * @param mesh Grey box volume mesh.
 */
export function applyGreyBoxVisual(mesh: THREE.Mesh): void {
  disposeReplaceableMaterial(mesh);
  mesh.material = createGreyBoxMaterial();
  mesh.renderOrder = GREY_BOX_RENDER_ORDER;
  removeGreyBoxOutline(mesh);
  mesh.add(buildGreyBoxOutline(mesh.geometry));
  setGreyBoxFillVisible(mesh, isGreyBoxFillVisible(mesh));
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
 * Shows or hides the translucent fill of a volume. Unselected volumes stay
 * outline-only so a layout of many volumes remains readable.
 *
 * @param mesh Grey box volume mesh.
 * @param visible True to fill the volume.
 */
export function setGreyBoxFillVisible(mesh: THREE.Mesh, visible: boolean): void {
  mesh.userData[GREY_BOX_FILL_USERDATA_KEY] = visible;
  const material = mesh.material;
  if (Array.isArray(material) || !(material instanceof THREE.MeshBasicMaterial)) return;
  material.opacity = visible ? GREY_BOX_FILL_OPACITY : 0;
  material.needsUpdate = true;
}

/**
 * Returns whether a volume currently shows its fill.
 *
 * @param mesh Grey box volume mesh.
 * @returns True when the fill is drawn.
 */
export function isGreyBoxFillVisible(mesh: THREE.Object3D): boolean {
  return mesh.userData[GREY_BOX_FILL_USERDATA_KEY] === true;
}

/**
 * Builds the outline child for a volume, bound to the shared faded material.
 *
 * @param geometry Volume geometry to outline.
 * @returns Outline line segments marked as a decorative helper.
 */
function buildGreyBoxOutline(geometry: THREE.BufferGeometry): THREE.LineSegments {
  const outline = new THREE.LineSegments(
    new THREE.EdgesGeometry(geometry, 1),
    GreyBoxEdgeMaterials.getOutlineMaterial(),
  );
  outline.userData[GREY_BOX_OUTLINE_USERDATA_KEY] = true;
  outline.userData[DECORATIVE_EDGE_USERDATA_KEY] = true;
  outline.renderOrder = GREY_BOX_RENDER_ORDER;
  return outline;
}

/**
 * Removes and disposes any existing outline children.
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
 * Disposes an outline's geometry, leaving the shared material alive.
 *
 * @param outline Outline object being discarded.
 */
function disposeOutline(outline: THREE.Object3D): void {
  if (!(outline instanceof THREE.LineSegments)) return;
  outline.geometry.dispose();
  if (Array.isArray(outline.material)) return;
  if (GreyBoxEdgeMaterials.isSharedMaterial(outline.material)) return;
  outline.material.dispose();
}

/**
 * Disposes the material a mesh owns before it is replaced, skipping shared
 * ones.
 *
 * @param mesh Mesh whose material is being replaced.
 */
function disposeReplaceableMaterial(mesh: THREE.Mesh): void {
  if (!mesh.material) return;
  if (Array.isArray(mesh.material)) {
    mesh.material.forEach((material) => material.dispose());
    return;
  }
  if (GreyBoxEdgeMaterials.isSharedMaterial(mesh.material)) return;
  mesh.material.dispose();
}
