import * as THREE from 'three';

/**
 * UserData key marking an object as part of the grey box layout: a planning
 * volume, or a group that organizes them. Grey boxes are layout aids: they
 * never compile into solid geometry and never export.
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
 * Stamps the grey box marker. The marker alone does not make a usable grey box;
 * register its data with GreyBoxRegistry in the same operation.
 *
 * @param object Mesh that becomes a volume, or group that organizes them.
 */
export function stampGreyBoxMarker(object: THREE.Object3D): void {
  object.userData[GREY_BOX_USERDATA_KEY] = true;
}

/**
 * Removes the grey box marker from an object.
 *
 * @param object Object that stops being a grey box volume.
 */
export function clearGreyBoxMarker(object: THREE.Object3D): void {
  delete object.userData[GREY_BOX_USERDATA_KEY];
}
