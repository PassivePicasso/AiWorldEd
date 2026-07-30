import * as THREE from 'three';
import { GreyBoxRegistry } from '../model/grey_box_registry.js';
import { isGreyBox } from '../model/grey_box_keys.js';
import { deriveGreyBoxRelations } from './grey_box_derived_graph.js';
import { GreyBoxMergedGraph } from './grey_box_graph_types.js';
import { GreyBoxGraphInput, mergeGreyBoxGraph } from './grey_box_merged_graph.js';
import { sampleGreyBoxVolume } from './grey_box_volume_sampler.js';

/**
 * Builds the merged grey box layout graph for a scene: samples the volumes,
 * derives their relations, then applies the user's parenting, mutes, and
 * authored links. This is the single entry point for the inspector and for MCP
 * reads.
 *
 * @param root Scene or world root to read.
 * @returns Merged layout graph.
 */
export function buildGreyBoxSceneGraph(root: THREE.Object3D): GreyBoxMergedGraph {
  const inputs = collectGraphInputs(root);
  const derived = deriveGreyBoxRelations(inputs.map((input) => input.volume));
  return mergeGreyBoxGraph(inputs, derived);
}

/**
 * Collects every registered grey box under a root as a graph input, recording
 * the nearest grey box ancestor so Outliner parenting can state containment the
 * geometry would not imply.
 *
 * @param root Scene or world root to read.
 * @returns Volumes paired with their payloads and authored parents.
 */
export function collectGraphInputs(root: THREE.Object3D): GreyBoxGraphInput[] {
  const inputs: GreyBoxGraphInput[] = [];
  for (const object of GreyBoxRegistry.collectUnder(root)) {
    if (!(object instanceof THREE.Mesh)) continue;
    inputs.push({
      volume: sampleGreyBoxVolume(object),
      data: GreyBoxRegistry.get(object),
      authoredParentId: findGreyBoxAncestorId(object),
    });
  }
  return inputs;
}

/**
 * Walks up from a volume to the nearest grey box ancestor.
 *
 * @param object Grey box volume mesh.
 * @returns Ancestor grey box id, or null when the volume is not nested.
 */
function findGreyBoxAncestorId(object: THREE.Object3D): string | null {
  let current: THREE.Object3D | null = object.parent;
  while (current) {
    if (isGreyBox(current)) {
      const data = GreyBoxRegistry.tryGet(current);
      if (data) return data.id;
    }
    current = current.parent;
  }
  return null;
}
