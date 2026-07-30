import * as THREE from 'three';
import { GreyBoxRegistry } from '../model/grey_box_registry.js';
import { deriveGreyBoxConnections } from './grey_box_derived_graph.js';
import { GreyBoxMergedGraph } from './grey_box_graph_types.js';
import { GreyBoxGraphInput, mergeGreyBoxGraph } from './grey_box_merged_graph.js';
import { sampleGreyBoxVolume } from './grey_box_volume_sampler.js';

/**
 * Builds the merged grey box layout graph for a scene: samples the volumes,
 * derives adjacency, then applies the user's mutes and authored links. This is
 * the single entry point for the inspector and for MCP reads.
 *
 * @param root Scene or world root to read.
 * @returns Merged layout graph.
 */
export function buildGreyBoxSceneGraph(root: THREE.Object3D): GreyBoxMergedGraph {
  const inputs = collectGraphInputs(root);
  const derived = deriveGreyBoxConnections(inputs.map((input) => input.volume));
  return mergeGreyBoxGraph(inputs, derived);
}

/**
 * Collects every registered grey box under a root as a graph input.
 *
 * @param root Scene or world root to read.
 * @returns Volumes paired with their layout payloads.
 */
export function collectGraphInputs(root: THREE.Object3D): GreyBoxGraphInput[] {
  const inputs: GreyBoxGraphInput[] = [];
  for (const object of GreyBoxRegistry.collectUnder(root)) {
    if (!(object instanceof THREE.Mesh)) continue;
    inputs.push({ volume: sampleGreyBoxVolume(object), data: GreyBoxRegistry.get(object) });
  }
  return inputs;
}
