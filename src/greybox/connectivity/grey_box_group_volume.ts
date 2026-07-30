import * as THREE from 'three';
import { GreyBoxRegistry } from '../model/grey_box_registry.js';
import { isGreyBoxGroup } from '../model/grey_box_group.js';
import { GreyBoxOrientedVolume, greyBoxVolumeWorldBounds } from './grey_box_oriented_volume.js';
import { sampleGreyBoxVolume } from './grey_box_volume_sampler.js';

/**
 * Samples a grey box group into an oriented volume: the axis-aligned world
 * bounds of every volume nested anywhere below it. A group has no geometry of
 * its own, so its extent is derived rather than authored, and the box is
 * axis-aligned because a union of arbitrarily rotated children is.
 *
 * @param group Registered grey box group.
 * @returns Oriented volume enclosing the group's contents.
 */
export function sampleGreyBoxGroupVolume(group: THREE.Object3D): GreyBoxOrientedVolume {
  const data = GreyBoxRegistry.get(group);
  const bounds = computeGreyBoxGroupBounds(group);
  const center = bounds ? bounds.getCenter(new THREE.Vector3()) : group.getWorldPosition(new THREE.Vector3());
  const size = bounds ? bounds.getSize(new THREE.Vector3()) : new THREE.Vector3();
  return {
    id: data.id,
    name: group.name,
    center,
    rotation: new THREE.Quaternion(),
    halfExtents: size.multiplyScalar(0.5),
  };
}

/**
 * Unions the world bounds of every volume nested below a group. Nested groups
 * contribute through their own volumes rather than directly, so an empty group
 * inside a populated one adds nothing.
 *
 * @param group Grey box group to measure.
 * @returns World bounds, or null when the group holds no volumes.
 */
export function computeGreyBoxGroupBounds(group: THREE.Object3D): THREE.Box3 | null {
  let bounds: THREE.Box3 | null = null;
  for (const object of GreyBoxRegistry.collectUnder(group)) {
    if (object === group) continue;
    if (isGreyBoxGroup(object)) continue;
    if (!(object instanceof THREE.Mesh)) continue;
    const childBounds = greyBoxVolumeWorldBounds(sampleGreyBoxVolume(object));
    bounds = bounds ? bounds.union(childBounds) : childBounds;
  }
  return bounds;
}
