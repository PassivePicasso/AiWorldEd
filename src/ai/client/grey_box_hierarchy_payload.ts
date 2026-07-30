import * as THREE from 'three';
import { GreyBoxRegistry } from '../../greybox/model/grey_box_registry.js';
import { isGreyBox } from '../../greybox/model/grey_box_keys.js';
import { isGreyBoxGroup } from '../../greybox/model/grey_box_group.js';
import type { GreyBoxHierarchyNodeDto } from './editor_api_types.js';

/**
 * Builds the grey box side of the scene hierarchy: the nesting the outliner
 * shows, so an agent reads the same shape the user navigates. Nesting here is
 * scene parentage, which is the authored hierarchy; the containment a layout
 * derives from geometry lives in get_grey_box_graph.
 *
 * @param root Scene or world root to read.
 * @returns Top-level grey box nodes with their descendants.
 */
export function collectGreyBoxHierarchy(root: THREE.Object3D): GreyBoxHierarchyNodeDto[] {
  const nodes: GreyBoxHierarchyNodeDto[] = [];
  for (const child of root.children) {
    collectInto(child, nodes);
  }
  return nodes;
}

/**
 * Emits a node for a grey box and recurses, or passes straight through a
 * non-grey-box object so a volume tucked under an ordinary group still shows.
 *
 * @param object Scene object to inspect.
 * @param siblings Accumulator the object contributes to.
 */
function collectInto(object: THREE.Object3D, siblings: GreyBoxHierarchyNodeDto[]): void {
  if (!isGreyBox(object)) {
    for (const child of object.children) {
      collectInto(child, siblings);
    }
    return;
  }
  const data = GreyBoxRegistry.tryGet(object);
  if (!data) return;
  const node: GreyBoxHierarchyNodeDto = {
    greyBoxId: data.id,
    name: object.name,
    kind: isGreyBoxGroup(object) ? 'grey_box_group' : 'grey_box',
    children: [],
  };
  siblings.push(node);
  for (const child of object.children) {
    collectInto(child, node.children);
  }
}
