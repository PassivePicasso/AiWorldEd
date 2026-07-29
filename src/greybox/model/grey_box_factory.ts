import * as THREE from 'three';
import { attachGreyBoxData } from './grey_box_access.js';
import { applyGreyBoxVisual } from './grey_box_visual.js';

/** Default edge length of a new grey box volume, in world units. */
export const DEFAULT_GREY_BOX_SIZE = 8;

/**
 * Builds a registered grey box volume: box geometry, translucent look, and an
 * empty description ready for the user to fill in.
 *
 * @param name Display name of the volume.
 * @param width Size along X.
 * @param height Size along Y.
 * @param depth Size along Z.
 * @returns Grey box mesh with registered layout data.
 */
export function createGreyBoxMesh(name: string, width: number, height: number, depth: number): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth));
  mesh.name = name;
  applyGreyBoxVisual(mesh);
  attachGreyBoxData(mesh, '');
  return mesh;
}

/**
 * Builds a registered cubic grey box volume at the default size.
 *
 * @param name Display name of the volume.
 * @returns Grey box mesh with registered layout data.
 */
export function createDefaultGreyBoxMesh(name: string): THREE.Mesh {
  return createGreyBoxMesh(name, DEFAULT_GREY_BOX_SIZE, DEFAULT_GREY_BOX_SIZE, DEFAULT_GREY_BOX_SIZE);
}
