import * as THREE from 'three';

/** Scratch box reused when measuring grey box volumes. */
const scratchBounds = new THREE.Box3();

/**
 * Reads the local size of a grey box volume from its geometry bounds, ignoring
 * transform scale.
 *
 * @param mesh Grey box volume mesh.
 * @returns Width, height, and depth in local units.
 */
export function computeGreyBoxLocalSize(mesh: THREE.Mesh): THREE.Vector3 {
  mesh.geometry.computeBoundingBox();
  const bounds = mesh.geometry.boundingBox;
  if (!bounds) return new THREE.Vector3();
  return bounds.getSize(new THREE.Vector3());
}

/**
 * Computes the axis-aligned world bounds of a grey box volume, including its
 * transform. This is the volume reported over MCP.
 *
 * @param mesh Grey box volume mesh.
 * @returns World-space bounds of the volume.
 */
export function computeGreyBoxWorldBounds(mesh: THREE.Mesh): THREE.Box3 {
  mesh.updateWorldMatrix(true, true);
  scratchBounds.makeEmpty();
  scratchBounds.setFromObject(mesh, true);
  return scratchBounds.clone();
}

/**
 * Computes the world-space size of a grey box volume.
 *
 * @param mesh Grey box volume mesh.
 * @returns Width, height, and depth of the world bounds.
 */
export function computeGreyBoxWorldSize(mesh: THREE.Mesh): THREE.Vector3 {
  return computeGreyBoxWorldBounds(mesh).getSize(new THREE.Vector3());
}

/**
 * Computes the world-space center of a grey box volume.
 *
 * @param mesh Grey box volume mesh.
 * @returns Center of the world bounds.
 */
export function computeGreyBoxWorldCenter(mesh: THREE.Mesh): THREE.Vector3 {
  return computeGreyBoxWorldBounds(mesh).getCenter(new THREE.Vector3());
}
