import * as THREE from 'three';
import { attachGreyBoxData } from '../../src/greybox/model/grey_box_access.js';
import { GreyBoxData } from '../../src/greybox/model/grey_box_data.js';

/** A grey box volume plus its registered payload, as tests need them together. */
export interface GreyBoxFixture {
  mesh: THREE.Mesh;
  data: GreyBoxData;
}

/**
 * Builds a registered grey box volume sized and placed by the caller, so tests
 * never depend on creation-tool defaults.
 *
 * @param name Display name of the volume.
 * @param size Box dimensions in world units.
 * @param position Volume center.
 * @param description Initial description; empty string when unwritten.
 * @returns Mesh and its registered payload.
 */
export function createGreyBoxFixture(
  name: string,
  size: THREE.Vector3,
  position: THREE.Vector3,
  description: string,
): GreyBoxFixture {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(size.x, size.y, size.z),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.25 }),
  );
  mesh.name = name;
  mesh.position.copy(position);
  const data = attachGreyBoxData(mesh, description);
  return { mesh, data };
}

/**
 * Builds a plain content mesh for contrast cases where a grey box must be
 * treated differently from ordinary geometry.
 *
 * @param name Display name of the mesh.
 * @param size Box dimensions in world units.
 * @returns Content mesh with no grey box marker.
 */
export function createContentBox(name: string, size: THREE.Vector3): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(size.x, size.y, size.z),
    new THREE.MeshStandardMaterial({ color: 0x888888 }),
  );
  mesh.name = name;
  return mesh;
}
