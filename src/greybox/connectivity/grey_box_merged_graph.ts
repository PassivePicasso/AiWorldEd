import * as THREE from 'three';
import { GreyBoxData } from '../model/grey_box_data.js';
import { greyBoxPairKey } from '../model/grey_box_pair_key.js';
import { GreyBoxDerivedConnection } from './grey_box_derived_connection.js';
import { GreyBoxOrientedVolume } from './grey_box_oriented_volume.js';
import {
  GreyBoxAuthoredLink,
  GreyBoxGraphEdge,
  GreyBoxGraphNode,
  GreyBoxGraphProblem,
  GreyBoxMergedGraph,
} from './grey_box_graph_types.js';

/** A volume paired with its layout payload, the input to merging. */
export interface GreyBoxGraphInput {
  volume: GreyBoxOrientedVolume;
  data: GreyBoxData;
}

/**
 * Merges geometry-derived adjacency with the user's authored links: derived
 * edges minus muted pairs, plus authored links. An authored link that
 * duplicates a derived adjacency annotates that edge instead of producing a
 * second one.
 *
 * @param inputs Volumes with their layout payloads.
 * @param derived Connections computed from geometry.
 * @returns Merged graph with nodes, edges, muted keys, and any problems.
 */
export function mergeGreyBoxGraph(
  inputs: GreyBoxGraphInput[],
  derived: GreyBoxDerivedConnection[],
): GreyBoxMergedGraph {
  const suppressedKeys = collectSuppressedKeys(inputs);
  const edges = new Map<string, GreyBoxGraphEdge>();
  for (const connection of derived) {
    if (suppressedKeys.has(connection.pairKey)) continue;
    edges.set(connection.pairKey, derivedEdge(connection));
  }
  const problems: GreyBoxGraphProblem[] = [];
  applyAuthoredLinks(inputs, edges, problems);
  return {
    nodes: inputs.map((input) => buildNode(input)),
    edges: [...edges.values()].sort((left, right) => left.pairKey.localeCompare(right.pairKey)),
    suppressedPairKeys: [...suppressedKeys].sort(),
    problems,
  };
}

/**
 * Collects every muted pair key across all volumes. Either endpoint muting an
 * adjacency is enough to drop it.
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
 * Converts a derived connection into a merged edge.
 *
 * @param connection Derived connection.
 * @returns Edge marked as coming from geometry.
 */
function derivedEdge(connection: GreyBoxDerivedConnection): GreyBoxGraphEdge {
  return {
    pairKey: connection.pairKey,
    firstId: connection.firstId,
    secondId: connection.secondId,
    source: 'derived',
    contactKind: connection.kind,
    contacts: connection.contacts,
    totalContactArea: connection.totalContactArea,
    overlapBounds: connection.overlapBounds,
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
 * when the pair has no surviving derived adjacency.
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
    contactKind: null,
    contacts: [],
    totalContactArea: 0,
    overlapBounds: null,
    authoredLinks: [link],
  });
}

/**
 * Builds a graph node from a volume and its payload.
 *
 * @param input Volume with its payload.
 * @returns Node describing the volume.
 */
function buildNode(input: GreyBoxGraphInput): GreyBoxGraphNode {
  return {
    id: input.data.id,
    name: input.volume.name,
    description: input.data.description,
    center: input.volume.center.clone(),
    size: new THREE.Vector3(
      input.volume.halfExtents.x * 2,
      input.volume.halfExtents.y * 2,
      input.volume.halfExtents.z * 2,
    ),
  };
}
