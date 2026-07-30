import * as THREE from 'three';
import { GreyBoxRegistry } from '../model/grey_box_registry.js';
import { computeGreyBoxLocalSize } from '../model/grey_box_volume.js';
import { GreyBoxOrientedVolume } from './grey_box_oriented_volume.js';

/** Scratch decomposition targets reused while sampling world transforms. */
const scratchPosition = new THREE.Vector3();
const scratchQuaternion = new THREE.Quaternion();
const scratchScale = new THREE.Vector3();

/**
 * Samples one grey box mesh into an oriented volume in world space. This is the
 * only bridge between the scene and the pure connectivity math.
 *
 * @param mesh Registered grey box mesh.
 * @returns Oriented volume describing the mesh in world space.
 */
export function sampleGreyBoxVolume(mesh: THREE.Mesh): GreyBoxOrientedVolume {
  const data = GreyBoxRegistry.get(mesh);
  mesh.updateWorldMatrix(true, false);
  mesh.matrixWorld.decompose(scratchPosition, scratchQuaternion, scratchScale);
  const localSize = computeGreyBoxLocalSize(mesh);
  return {
    id: data.id,
    name: mesh.name,
    center: scratchPosition.clone(),
    rotation: scratchQuaternion.clone(),
    halfExtents: new THREE.Vector3(
      Math.abs(localSize.x * scratchScale.x) / 2,
      Math.abs(localSize.y * scratchScale.y) / 2,
      Math.abs(localSize.z * scratchScale.z) / 2,
    ),
  };
}

/**
 * Samples every registered grey box under a scene root.
 *
 * @param root Scene or world root.
 * @returns Oriented volumes for each grey box found.
 */
export function sampleGreyBoxVolumesUnder(root: THREE.Object3D): GreyBoxOrientedVolume[] {
  const volumes: GreyBoxOrientedVolume[] = [];
  for (const object of GreyBoxRegistry.collectUnder(root)) {
    if (!(object instanceof THREE.Mesh)) continue;
    volumes.push(sampleGreyBoxVolume(object));
  }
  return volumes;
}
