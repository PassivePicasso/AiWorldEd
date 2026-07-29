import * as THREE from 'three';

/**
 * UserData key marking a mesh as a grey box planning volume. Grey boxes are
 * layout aids: they never compile into solid geometry and never export.
 */
export const GREY_BOX_USERDATA_KEY = 'isGreyBox';

/**
 * Returns whether an object is a grey box planning volume.
 *
 * @param object Candidate scene object.
 * @returns True when the object carries the grey box marker.
 */
export function isGreyBox(object: THREE.Object3D): boolean {
  return object.userData[GREY_BOX_USERDATA_KEY] === true;
}

/**
 * Stamps the grey box marker onto a mesh. The marker alone does not make a
 * usable grey box; register its data with GreyBoxRegistry in the same
 * operation.
 *
 * @param mesh Mesh that becomes a grey box volume.
 */
export function stampGreyBoxMarker(mesh: THREE.Mesh): void {
  mesh.userData[GREY_BOX_USERDATA_KEY] = true;
}

/**
 * Removes the grey box marker from an object.
 *
 * @param object Object that stops being a grey box volume.
 */
export function clearGreyBoxMarker(object: THREE.Object3D): void {
  delete object.userData[GREY_BOX_USERDATA_KEY];
}
