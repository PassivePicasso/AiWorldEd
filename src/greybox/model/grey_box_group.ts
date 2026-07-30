import * as THREE from 'three';
import { GreyBoxRegistry } from './grey_box_registry.js';

/**
 * UserData key marking a group that organizes grey boxes. A grey box group
 * holds no geometry: it is a branch node, the way a solid CSG group is.
 */
export const GREY_BOX_GROUP_USERDATA_KEY = 'isGreyBoxGroup';

/**
 * Returns whether an object is a grey box group.
 *
 * @param object Candidate scene object.
 * @returns True when the object is a marked grey box group.
 */
export function isGreyBoxGroup(object: THREE.Object3D): boolean {
  return object instanceof THREE.Group && object.userData[GREY_BOX_GROUP_USERDATA_KEY] === true;
}

/**
 * Stamps the grey box group marker. The marker alone does not make a usable
 * group; register its data with GreyBoxRegistry in the same operation.
 *
 * @param group Group that becomes a grey box branch node.
 */
export function stampGreyBoxGroupMarker(group: THREE.Group): void {
  group.userData[GREY_BOX_GROUP_USERDATA_KEY] = true;
}

/**
 * Walks up to the outermost grey box group above an object: what the outliner
 * shows as that object's grey box root. A grey box parented straight to the
 * world has none.
 *
 * @param object Grey box volume, group, or any descendant.
 * @returns Outermost enclosing grey box group, or null.
 */
export function findGreyBoxRoot(object: THREE.Object3D): THREE.Object3D | null {
  let root: THREE.Object3D | null = null;
  let current: THREE.Object3D | null = object;
  while (current) {
    if (isGreyBoxGroup(current)) root = current;
    current = current.parent;
  }
  return root;
}

/**
 * Returns whether an object sits inside a grey box group.
 *
 * @param object Candidate object.
 * @returns True when a grey box group is found on the parent chain.
 */
export function isUnderGreyBoxGroup(object: THREE.Object3D): boolean {
  return findGreyBoxRoot(object) !== null;
}

/**
 * Collects the grey box groups under a scene root in traversal order.
 *
 * @param root Scene or world root.
 * @returns Registered grey box groups.
 */
export function collectGreyBoxGroupsUnder(root: THREE.Object3D): THREE.Object3D[] {
  return GreyBoxRegistry.collectUnder(root).filter((object) => isGreyBoxGroup(object));
}
