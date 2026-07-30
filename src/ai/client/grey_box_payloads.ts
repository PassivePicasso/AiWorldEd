import type {
  GreyBoxGraphEdge,
  GreyBoxGraphNode,
  GreyBoxMergedGraph,
} from '../../greybox/connectivity/grey_box_graph_types.js';

/** Serialized grey box node for MCP payloads. */
export interface GreyBoxNodePayload {
  greyBoxId: string;
  name: string;
  description: string;
  center: { x: number; y: number; z: number };
  size: { x: number; y: number; z: number };
}

/** Serialized graph edge for MCP payloads. */
export interface GreyBoxEdgePayload {
  pairKey: string;
  greyBoxIds: [string, string];
  source: 'derived' | 'authored';
  contact: 'face' | 'interpenetrating' | 'none';
  sharedFace: { width: number; height: number; area: number; center: { x: number; y: number; z: number } } | null;
  authoredLinks: Array<{
    connectionId: string;
    fromGreyBoxId: string;
    toGreyBoxId: string;
    kind: string;
    note: string;
    direction: 'bidirectional' | 'forward';
  }>;
}

/** Serialized merged graph for MCP payloads. */
export interface GreyBoxGraphPayload {
  greyBoxes: GreyBoxNodePayload[];
  edges: GreyBoxEdgePayload[];
  mutedAdjacencies: string[];
  problems: Array<{ connectionId: string; fromGreyBoxId: string; toGreyBoxId: string; message: string }>;
}

/**
 * Serializes one grey box node.
 *
 * @param node Graph node.
 * @returns MCP node payload.
 */
export function serializeGreyBoxNode(node: GreyBoxGraphNode): GreyBoxNodePayload {
  return {
    greyBoxId: node.id,
    name: node.name,
    description: node.description,
    center: { x: node.center.x, y: node.center.y, z: node.center.z },
    size: { x: node.size.x, y: node.size.y, z: node.size.z },
  };
}

/**
 * Serializes a merged graph, optionally narrowed to the edges touching one
 * volume.
 *
 * @param graph Merged layout graph.
 * @param onlyForGreyBoxId Volume to filter edges by, or null for the whole
 *   graph.
 * @returns MCP graph payload.
 */
export function serializeGreyBoxGraph(graph: GreyBoxMergedGraph, onlyForGreyBoxId: string | null): GreyBoxGraphPayload {
  const edges = graph.edges.filter(
    (edge) => onlyForGreyBoxId === null || edge.firstId === onlyForGreyBoxId || edge.secondId === onlyForGreyBoxId,
  );
  return {
    greyBoxes: graph.nodes.map((node) => serializeGreyBoxNode(node)),
    edges: edges.map((edge) => serializeGreyBoxEdge(edge)),
    mutedAdjacencies: graph.suppressedPairKeys.slice(),
    problems: graph.problems.map((problem) => ({
      connectionId: problem.connectionId,
      fromGreyBoxId: problem.ownerId,
      toGreyBoxId: problem.targetId,
      message: problem.message,
    })),
  };
}

/**
 * Serializes one graph edge, including the shared opening an agent needs to
 * size a doorway.
 *
 * @param edge Graph edge.
 * @returns MCP edge payload.
 */
export function serializeGreyBoxEdge(edge: GreyBoxGraphEdge): GreyBoxEdgePayload {
  const contact = edge.contacts[0];
  return {
    pairKey: edge.pairKey,
    greyBoxIds: [edge.firstId, edge.secondId],
    source: edge.source,
    contact: edge.contactKind ?? 'none',
    sharedFace: contact
      ? {
          width: contact.size.x,
          height: contact.size.y,
          area: contact.area,
          center: { x: contact.center.x, y: contact.center.y, z: contact.center.z },
        }
      : null,
    authoredLinks: edge.authoredLinks.map((link) => ({
      connectionId: link.id,
      fromGreyBoxId: link.ownerId,
      toGreyBoxId: link.targetId,
      kind: link.kind,
      note: link.note,
      direction: link.direction,
    })),
  };
}
