import * as THREE from 'three';
import { GreyBoxRegistry } from '../model/grey_box_registry.js';
import { isGreyBox } from '../model/grey_box_keys.js';
import { isGreyBoxGroup } from '../model/grey_box_group.js';
import { deriveGreyBoxRelations } from './grey_box_derived_graph.js';
import { GreyBoxMergedGraph } from './grey_box_graph_types.js';
import { GreyBoxGraphInput, mergeGreyBoxGraph } from './grey_box_merged_graph.js';
import { sampleGreyBoxGroupVolume } from './grey_box_group_volume.js';
import { sampleGreyBoxVolume } from './grey_box_volume_sampler.js';

/**
 * Builds the merged grey box layout graph for a scene: samples the volumes,
 * derives their relations, then applies the user's parenting, mutes, and
 * authored links. This is the single entry point for the inspector and for MCP
 * reads.
 *
 * Groups are structure, not geometry: they contribute a node and a parent link
 * but no derived relations, because their extent is the union of their children
 * and every edge they would produce restates one a child already has.
 *
 * @param root Scene or world root to read.
 * @returns Merged layout graph.
 */
export function buildGreyBoxSceneGraph(root: THREE.Object3D): GreyBoxMergedGraph {
  const inputs = collectGraphInputs(root);
  const volumes = inputs.filter((input) => input.kind === 'volume');
  const derived = deriveGreyBoxRelations(volumes.map((input) => input.volume));
  return mergeGreyBoxGraph(inputs, derived);
}

/**
 * Collects every registered grey box under a root as a graph input, recording
 * the nearest grey box ancestor so Outliner parenting can state containment the
 * geometry would not imply.
 *
 * @param root Scene or world root to read.
 * @returns Volumes and groups paired with their payloads and authored parents.
 */
export function collectGraphInputs(root: THREE.Object3D): GreyBoxGraphInput[] {
  const inputs: GreyBoxGraphInput[] = [];
  for (const object of GreyBoxRegistry.collectUnder(root)) {
    if (isGreyBoxGroup(object)) {
      inputs.push({
        kind: 'group',
        volume: sampleGreyBoxGroupVolume(object),
        data: GreyBoxRegistry.get(object),
        authoredParentId: findGreyBoxAncestorId(object),
      });
      continue;
    }
    if (!(object instanceof THREE.Mesh)) continue;
    inputs.push({
      kind: 'volume',
      volume: sampleGreyBoxVolume(object),
      data: GreyBoxRegistry.get(object),
      authoredParentId: findGreyBoxAncestorId(object),
    });
  }
  return inputs;
}

/**
 * Walks up from a volume to the nearest grey box ancestor, which is a group
 * when one was created to hold it and an enclosing volume otherwise.
 *
 * @param object Grey box volume mesh or group.
 * @returns Ancestor grey box id, or null when not nested.
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
