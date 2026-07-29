import * as THREE from 'three';
import { GreyBoxData, cloneGreyBoxData } from './grey_box_data.js';
import { isGreyBox, stampGreyBoxMarker } from './grey_box_keys.js';

/**
 * Owns grey box payloads keyed by their scene mesh. Data is kept off userData
 * so Object3D.clone() cannot alias two volumes onto one payload; a cloned grey
 * box arrives marked but unregistered and fails loudly until it is registered.
 */
export class GreyBoxRegistry {
  private static readonly registry = new WeakMap<THREE.Object3D, GreyBoxData>();

  /**
   * Marks a mesh as a grey box and associates its payload in one step.
   *
   * @param mesh Mesh that becomes a grey box volume.
   * @param data Payload owned by the registry from this point on.
   */
  static register(mesh: THREE.Mesh, data: GreyBoxData): void {
    stampGreyBoxMarker(mesh);
    GreyBoxRegistry.registry.set(mesh, data);
  }

  /**
   * Drops a grey box payload. The marker stays so export filtering keeps
   * working on an object mid-teardown.
   *
   * @param object Grey box object being retired.
   */
  static unregister(object: THREE.Object3D): void {
    GreyBoxRegistry.registry.delete(object);
  }

  /**
   * Returns whether a payload is registered for an object.
   *
   * @param object Candidate object.
   * @returns True when a payload exists.
   */
  static has(object: THREE.Object3D): boolean {
    return GreyBoxRegistry.registry.has(object);
  }

  /**
   * Returns the live payload of a grey box. Mutating the result mutates stored
   * state; use the accessor helpers rather than editing fields at call sites.
   *
   * @param object Grey box object.
   * @returns Registered payload.
   */
  static get(object: THREE.Object3D): GreyBoxData {
    const data = GreyBoxRegistry.registry.get(object);
    if (!data) {
      throw new Error(`Grey box "${describeObject(object)}" has no registered grey box data`);
    }
    return data;
  }

  /**
   * Returns the payload of a grey box, or undefined when unregistered.
   *
   * @param object Candidate object.
   * @returns Registered payload or undefined.
   */
  static tryGet(object: THREE.Object3D): GreyBoxData | undefined {
    return GreyBoxRegistry.registry.get(object);
  }

  /**
   * Returns an independent copy of a grey box payload, safe to hand to callers
   * outside the grey box module.
   *
   * @param object Grey box object.
   * @returns Deep copy of the payload.
   */
  static snapshot(object: THREE.Object3D): GreyBoxData {
    return cloneGreyBoxData(GreyBoxRegistry.get(object));
  }

  /**
   * Collects grey box meshes under a scene root in traversal order.
   *
   * @param root Scene or world root.
   * @returns Marked grey box objects.
   */
  static collectUnder(root: THREE.Object3D): THREE.Object3D[] {
    const found: THREE.Object3D[] = [];
    root.traverse((object) => {
      if (isGreyBox(object)) found.push(object);
    });
    return found;
  }

  /**
   * Finds a grey box under a scene root by its stable id.
   *
   * @param root Scene or world root.
   * @param id Grey box id to resolve.
   * @returns Matching object, or null when absent.
   */
  static findById(root: THREE.Object3D, id: string): THREE.Object3D | null {
    for (const object of GreyBoxRegistry.collectUnder(root)) {
      if (GreyBoxRegistry.tryGet(object)?.id === id) return object;
    }
    return null;
  }
}

/**
 * Builds a human-readable label for an object used in failure messages.
 *
 * @param object Object to describe.
 * @returns Name and uuid of the object.
 */
function describeObject(object: THREE.Object3D): string {
  const name = object.name.length > 0 ? object.name : '<unnamed>';
  return `${name} (${object.uuid})`;
}
