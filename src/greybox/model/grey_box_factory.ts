import * as THREE from 'three';
import { attachGreyBoxData } from './grey_box_access.js';
import { applyGreyBoxVisual } from './grey_box_visual.js';
import { stampGreyBoxGroupMarker } from './grey_box_group.js';
import { DEFAULT_GREY_BOX_GROUP_ROLE, DEFAULT_GREY_BOX_ROLE, GreyBoxRole } from './grey_box_role.js';

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
 * @param role Gameplay function of the volume.
 * @returns Grey box mesh with registered layout data.
 */
export function createGreyBoxMesh(
  name: string,
  width: number,
  height: number,
  depth: number,
  role: GreyBoxRole = DEFAULT_GREY_BOX_ROLE,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth));
  mesh.name = name;
  const data = attachGreyBoxData(mesh, '', role);
  applyGreyBoxVisual(mesh, data.role);
  return mesh;
}

/**
 * Builds a registered cubic grey box volume at the default size.
 *
 * @param name Display name of the volume.
 * @param role Gameplay function of the volume.
 * @returns Grey box mesh with registered layout data.
 */
export function createDefaultGreyBoxMesh(name: string, role: GreyBoxRole = DEFAULT_GREY_BOX_ROLE): THREE.Mesh {
  return createGreyBoxMesh(name, DEFAULT_GREY_BOX_SIZE, DEFAULT_GREY_BOX_SIZE, DEFAULT_GREY_BOX_SIZE, role);
}

/**
 * Builds a registered grey box group: a branch node that holds volumes and
 * other groups. It carries no geometry of its own, so its extent is whatever
 * its children occupy.
 *
 * @param name Display name of the group.
 * @param description Initial description; pass an empty string when unwritten.
 * @returns Grey box group with registered layout data.
 */
export function createGreyBoxGroup(name: string, description = ''): THREE.Group {
  const group = new THREE.Group();
  group.name = name;
  stampGreyBoxGroupMarker(group);
  attachGreyBoxData(group, description, DEFAULT_GREY_BOX_GROUP_ROLE);
  return group;
}
