import * as THREE from 'three';
import { GreyBoxData, createGreyBoxData } from './grey_box_data.js';
import { GreyBoxRegistry } from './grey_box_registry.js';
import { allocateGreyBoxId } from './grey_box_id.js';

/**
 * Turns an existing mesh into a registered grey box with a fresh id.
 *
 * @param mesh Mesh that becomes the grey box volume.
 * @param description Initial description; pass an empty string when unwritten.
 * @returns Payload registered for the mesh.
 */
export function attachGreyBoxData(mesh: THREE.Mesh, description: string): GreyBoxData {
  const data = createGreyBoxData(allocateGreyBoxId(), description);
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
