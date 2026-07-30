import * as THREE from 'three';
import { GreyBoxData } from '../model/grey_box_data.js';
import { greyBoxPairKey } from '../model/grey_box_pair_key.js';
import { GreyBoxDerivedRelation, relationKinds } from './grey_box_derived_connection.js';
import { GreyBoxOrientedVolume } from './grey_box_oriented_volume.js';
import { greyBoxVolumeSize } from './grey_box_containment.js';
import {
  GreyBoxContainmentTree,
  GreyBoxParentClaims,
  buildGreyBoxContainmentTree,
  pickDerivedParent,
} from './grey_box_containment_tree.js';
import {
  GreyBoxAuthoredLink,
  GreyBoxGraphEdge,
  GreyBoxGraphNode,
  GreyBoxGraphProblem,
  GreyBoxMergedGraph,
  GreyBoxNodeKind,
} from './grey_box_graph_types.js';

/** A volume paired with its layout payload, the input to merging. */
export interface GreyBoxGraphInput {
  /** Whether this is an authored volume or a group organizing volumes. */
  kind: GreyBoxNodeKind;
  volume: GreyBoxOrientedVolume;
  data: GreyBoxData;
  /** Grey box id of the nearest grey box ancestor in the scene, or null. */
  authoredParentId: string | null;
}

/**
 * Merges geometry-derived relations with the user's authored links and
 * parenting: derived edges minus muted pairs, plus authored links, over a
 * containment hierarchy. An authored link that duplicates a derived relation
 * annotates that edge instead of producing a second one.
 *
 * @param inputs Volumes with their layout payloads and authored parents.
 * @param derived Relations computed from geometry.
 * @returns Merged graph with nodes, edges, hierarchy, muted keys, and problems.
 */
export function mergeGreyBoxGraph(inputs: GreyBoxGraphInput[], derived: GreyBoxDerivedRelation[]): GreyBoxMergedGraph {
  const suppressedKeys = collectSuppressedKeys(inputs);
  const edges = new Map<string, GreyBoxGraphEdge>();
  for (const relation of derived) {
    if (suppressedKeys.has(relation.pairKey)) continue;
    edges.set(relation.pairKey, derivedEdge(relation));
  }
  const problems: GreyBoxGraphProblem[] = [];
  applyAuthoredLinks(inputs, edges, problems);
  const tree = buildTree(inputs, derived);
  reportBrokenCycles(tree, problems);
  return {
    nodes: inputs.map((input) => buildNode(input, tree)),
    edges: [...edges.values()].sort((left, right) => left.pairKey.localeCompare(right.pairKey)),
    tree,
    suppressedPairKeys: [...suppressedKeys].sort(),
    problems,
  };
}

/**
 * Builds the containment hierarchy from geometry plus authored parenting. A
 * group's place is always authored: its bounds are the union of its children,
 * so a geometric guess would only ever name one of the volumes it already holds
 * and close a cycle.
 *
 * @param inputs Volumes and groups with their authored parents.
 * @param derived Relations carrying containment records.
 * @returns Containment tree.
 */
function buildTree(inputs: GreyBoxGraphInput[], derived: GreyBoxDerivedRelation[]): GreyBoxContainmentTree {
  const sizeById = new Map(inputs.map((input) => [input.data.id, greyBoxVolumeSize(input.volume)]));
  const containments = derived.map((relation) => relation.containment).filter((entry) => entry !== null);
  const claims: GreyBoxParentClaims[] = inputs.map((input) => ({
    id: input.data.id,
    authoredParentId: input.authoredParentId,
    derivedParentId: input.kind === 'group' ? null : pickDerivedParent(input.data.id, containments, sizeById),
  }));
  return buildGreyBoxContainmentTree(claims);
}

/**
 * Reports parent links dropped to break a cycle, so a bad hierarchy is visible.
 *
 * @param tree Containment tree.
 * @param problems Problem accumulator.
 */
function reportBrokenCycles(tree: GreyBoxContainmentTree, problems: GreyBoxGraphProblem[]): void {
  for (const broken of tree.brokenCycles) {
    problems.push({
      connectionId: `containment:${broken.childId}`,
      ownerId: broken.childId,
      targetId: broken.parentId,
      message: 'containment would form a cycle, so the parent link was dropped',
    });
  }
}

/**
 * Collects every muted pair key across all volumes. Either endpoint muting a
 * relation is enough to drop it.
 *
 * @param inputs Volumes with their payloads.
 * @returns Set of muted pair keys.
 */
function collectSuppressedKeys(inputs: GreyBoxGraphInput[]): Set<string> {
  const keys = new Set<string>();
  for (const input of inputs) {
    for (const key of input.data.suppressedDerivedConnections) {
      keys.add(key);
    }
  }
  return keys;
}

/**
 * Converts a derived relation into a merged edge.
 *
 * @param relation Derived relation.
 * @returns Edge marked as coming from geometry.
 */
function derivedEdge(relation: GreyBoxDerivedRelation): GreyBoxGraphEdge {
  return {
    pairKey: relation.pairKey,
    firstId: relation.firstId,
    secondId: relation.secondId,
    source: 'derived',
    relations: relationKinds(relation),
    containment: relation.containment,
    contacts: relation.contacts,
    totalContactArea: relation.totalContactArea,
    overlap: relation.overlap,
    authoredLinks: [],
  };
}

/**
 * Attaches authored links to existing edges or adds authored edges, recording a
 * problem for any link naming a volume that is not present.
 *
 * @param inputs Volumes with their payloads.
 * @param edges Edge accumulator keyed by pair key.
 * @param problems Problem accumulator.
 */
function applyAuthoredLinks(
  inputs: GreyBoxGraphInput[],
  edges: Map<string, GreyBoxGraphEdge>,
  problems: GreyBoxGraphProblem[],
): void {
  const knownIds = new Set(inputs.map((input) => input.data.id));
  for (const input of inputs) {
    for (const connection of input.data.explicitConnections) {
      const link = toAuthoredLink(input.data.id, connection);
      if (!isResolvable(link, knownIds, problems)) continue;
      attachAuthoredLink(link, edges);
    }
  }
}

/**
 * Converts a stored connection into a graph-level authored link.
 *
 * @param ownerId Volume that authored the link.
 * @param connection Stored connection.
 * @returns Authored link record.
 */
function toAuthoredLink(ownerId: string, connection: GreyBoxData['explicitConnections'][number]): GreyBoxAuthoredLink {
  return {
    id: connection.id,
    ownerId,
    targetId: connection.targetGreyBoxId,
    kind: connection.kind,
    note: connection.note,
    direction: connection.direction,
  };
}

/**
 * Checks that an authored link names a present volume, recording a problem when
 * it does not.
 *
 * @param link Authored link to check.
 * @param knownIds Ids of the volumes being merged.
 * @param problems Problem accumulator.
 * @returns True when the link resolves.
 */
function isResolvable(link: GreyBoxAuthoredLink, knownIds: Set<string>, problems: GreyBoxGraphProblem[]): boolean {
  if (link.targetId === link.ownerId) {
    problems.push({ ...linkIdentity(link), message: 'connection points at its own volume' });
    return false;
  }
  if (!knownIds.has(link.targetId)) {
    problems.push({ ...linkIdentity(link), message: `connection target "${link.targetId}" is not in the scene` });
    return false;
  }
  return true;
}

/**
 * Extracts the identifying fields shared by every problem record.
 *
 * @param link Authored link the problem concerns.
 * @returns Identity fields for a problem record.
 */
function linkIdentity(link: GreyBoxAuthoredLink): Omit<GreyBoxGraphProblem, 'message'> {
  return { connectionId: link.id, ownerId: link.ownerId, targetId: link.targetId };
}

/**
 * Annotates an existing edge with an authored link, or creates an authored edge
 * when the pair has no surviving derived relation.
 *
 * @param link Authored link to place.
 * @param edges Edge accumulator keyed by pair key.
 */
function attachAuthoredLink(link: GreyBoxAuthoredLink, edges: Map<string, GreyBoxGraphEdge>): void {
  const pairKey = greyBoxPairKey(link.ownerId, link.targetId);
  const existing = edges.get(pairKey);
  if (existing) {
    existing.authoredLinks.push(link);
    return;
  }
  const [firstId, secondId] = [link.ownerId, link.targetId].sort();
  edges.set(pairKey, {
    pairKey,
    firstId: firstId!,
    secondId: secondId!,
    source: 'authored',
    relations: [],
    containment: null,
    contacts: [],
    totalContactArea: 0,
    overlap: null,
    authoredLinks: [link],
  });
}

/**
 * Builds a graph node from a volume, its payload, and its place in the
 * hierarchy.
 *
 * @param input Volume with its payload.
 * @param tree Containment tree.
 * @returns Node describing the volume.
 */
function buildNode(input: GreyBoxGraphInput, tree: GreyBoxContainmentTree): GreyBoxGraphNode {
  const node = tree.nodes.get(input.data.id);
  return {
    id: input.data.id,
    kind: input.kind,
    name: input.volume.name,
    description: input.data.description,
    role: input.data.role,
    sizeIntent: input.data.sizeIntent,
    surface: { ...input.data.surface },
    center: input.volume.center.clone(),
    size: new THREE.Vector3(
      input.volume.halfExtents.x * 2,
      input.volume.halfExtents.y * 2,
      input.volume.halfExtents.z * 2,
    ),
    parentId: node?.parentId ?? null,
    depth: node?.depth ?? 0,
    authoredParent: node?.authoredParent ?? false,
  };
}
