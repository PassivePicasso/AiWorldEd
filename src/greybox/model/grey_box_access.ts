import * as THREE from 'three';
import { GreyBoxData, createGreyBoxData } from './grey_box_data.js';
import { GreyBoxRegistry } from './grey_box_registry.js';
import { allocateGreyBoxId } from './grey_box_id.js';
import { DEFAULT_GREY_BOX_ROLE, GreyBoxRole, normalizeGreyBoxRole } from './grey_box_role.js';

/**
 * Turns an existing mesh into a registered grey box with a fresh id.
 *
 * @param mesh Mesh that becomes the grey box volume.
 * @param description Initial description; pass an empty string when unwritten.
 * @param role Gameplay function of the volume.
 * @returns Payload registered for the mesh.
 */
export function attachGreyBoxData(
  mesh: THREE.Mesh,
  description: string,
  role: GreyBoxRole = DEFAULT_GREY_BOX_ROLE,
): GreyBoxData {
  const data = createGreyBoxData(allocateGreyBoxId(), description, normalizeGreyBoxRole(role));
  GreyBoxRegistry.register(mesh, data);
  return data;
}

/**
 * Reads the description of a grey box.
 *
 * @param object Grey box object.
 * @returns Stored description, possibly empty.
 */
export function getGreyBoxDescription(object: THREE.Object3D): string {
  return GreyBoxRegistry.get(object).description;
}

/**
 * Replaces the description of a grey box.
 *
 * @param object Grey box object.
 * @param description New description; empty string clears it.
 */
export function setGreyBoxDescription(object: THREE.Object3D, description: string): void {
  GreyBoxRegistry.get(object).description = description;
}

/**
 * Reads the stable id of a grey box.
 *
 * @param object Grey box object.
 * @returns Stored grey box id.
 */
export function getGreyBoxId(object: THREE.Object3D): string {
  return GreyBoxRegistry.get(object).id;
}

/**
 * Reads the gameplay role of a grey box.
 *
 * @param object Grey box object.
 * @returns Stored role.
 */
export function getGreyBoxRole(object: THREE.Object3D): GreyBoxRole {
  return GreyBoxRegistry.get(object).role;
}

/**
 * Replaces the gameplay role of a grey box, normalizing the text so an empty
 * value falls back to the default rather than storing a blank role.
 *
 * @param object Grey box object.
 * @param role New role.
 */
export function setGreyBoxRole(object: THREE.Object3D, role: GreyBoxRole): void {
  GreyBoxRegistry.get(object).role = normalizeGreyBoxRole(role);
}
