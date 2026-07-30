import type {
  GreyBoxGraphEdge,
  GreyBoxGraphNode,
  GreyBoxMergedGraph,
} from '../../greybox/connectivity/grey_box_graph_types.js';
import { GreyBoxOccupancyPayload, readGreyBoxOccupancy } from './grey_box_occupancy.js';

/** Serialized grey box node for MCP payloads. */
export interface GreyBoxNodePayload {
  greyBoxId: string;
  name: string;
  description: string;
  /** Gameplay function of the volume. */
  role: string;
  /** 'exact' means build to these dimensions; 'approximate' invites refining. */
  sizeIntent: string;
  /** Intended surface treatment and mood; hints, not texture assignments. */
  surface: { floor: string; wall: string; ceiling: string; mood: string };
  /** Volume this one sits inside, or null when it is a root. */
  parentGreyBoxId: string | null;
  /** Volumes nested directly inside this one. */
  childGreyBoxIds: string[];
  /** Nesting depth, zero for a root. */
  depth: number;
  /** Whether the parent was stated by the user rather than derived. */
  authoredParent: boolean;
  center: { x: number; y: number; z: number };
  size: { x: number; y: number; z: number };
  /** Brushes built in this volume rather than in one nested inside it. */
  ownBrushCount: number;
  /** Brushes built in this volume or anything nested inside it. */
  subtreeBrushCount: number;
  /** True when nothing has been built here or below. */
  empty: boolean;
}

/** Serialized graph edge for MCP payloads. */
export interface GreyBoxEdgePayload {
  pairKey: string;
  greyBoxIds: [string, string];
  source: 'derived' | 'authored';
  /** Every relation this pair holds: adjacent, overlaps, contains. */
  relations: string[];
  /** Containment when one volume sits inside the other, else null. */
  containment: { parentGreyBoxId: string; childGreyBoxId: string; ratio: number } | null;
  /**
   * How the pair intersects when neither contains the other: the intersecting
   * box, and how much of each volume is inside the other. Reported, not
   * judged.
   */
  overlap: {
    min: { x: number; y: number; z: number };
    max: { x: number; y: number; z: number };
    fractionOfFirst: number;
    fractionOfSecond: number;
  } | null;
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
  /** Volumes with no parent: the outermost spaces of the layout. */
  rootGreyBoxIds: string[];
  /**
   * Suggested order to build in: a parent before anything nested inside it.
   * Guidance, not a requirement.
   */
  buildOrder: string[];
  edges: GreyBoxEdgePayload[];
  mutedAdjacencies: string[];
  problems: Array<{ connectionId: string; fromGreyBoxId: string; toGreyBoxId: string; message: string }>;
}

/**
 * Serializes one grey box node, including its place in the hierarchy and what
 * has already been built inside it.
 *
 * @param node Graph node.
 * @param graph Merged graph supplying the hierarchy.
 * @param occupancy Occupancy per grey box id.
 * @returns MCP node payload.
 */
export function serializeGreyBoxNode(
  node: GreyBoxGraphNode,
  graph: GreyBoxMergedGraph,
  occupancy: Map<string, GreyBoxOccupancyPayload>,
): GreyBoxNodePayload {
  const treeNode = graph.tree.nodes.get(node.id);
  const built = readGreyBoxOccupancy(occupancy, node.id);
  return {
    greyBoxId: node.id,
    name: node.name,
    description: node.description,
    role: node.role,
    sizeIntent: node.sizeIntent,
    surface: { ...node.surface },
    parentGreyBoxId: node.parentId,
    childGreyBoxIds: treeNode ? [...treeNode.childIds] : [],
    depth: node.depth,
    authoredParent: node.authoredParent,
    center: { x: node.center.x, y: node.center.y, z: node.center.z },
    size: { x: node.size.x, y: node.size.y, z: node.size.z },
    ownBrushCount: built.ownBrushCount,
    subtreeBrushCount: built.subtreeBrushCount,
    empty: built.empty,
  };
}

/**
 * Serializes a merged graph, optionally narrowed to the edges touching one
 * volume.
 *
 * @param graph Merged layout graph.
 * @param occupancy Occupancy per grey box id.
 * @param onlyForGreyBoxId Volume to filter edges by, or null for the whole
 *   graph.
 * @returns MCP graph payload.
 */
export function serializeGreyBoxGraph(
  graph: GreyBoxMergedGraph,
  occupancy: Map<string, GreyBoxOccupancyPayload>,
  onlyForGreyBoxId: string | null,
): GreyBoxGraphPayload {
  const edges = graph.edges.filter(
    (edge) => onlyForGreyBoxId === null || edge.firstId === onlyForGreyBoxId || edge.secondId === onlyForGreyBoxId,
  );
  return {
    greyBoxes: graph.nodes.map((node) => serializeGreyBoxNode(node, graph, occupancy)),
    rootGreyBoxIds: [...graph.tree.rootIds],
    buildOrder: buildOutsideInOrder(graph),
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
 * Builds the suggested build order: each root, then everything nested inside
 * it, depth first. Parents come before their children so a shell can be built
 * before the features cut into it. Volumes whose parent link was dropped to
 * break a cycle still appear, at the end.
 *
 * @param graph Merged layout graph.
 * @returns Grey box ids in suggested build order.
 */
export function buildOutsideInOrder(graph: GreyBoxMergedGraph): string[] {
  const order: string[] = [];
  const visited = new Set<string>();
  const visit = (id: string): void => {
    if (visited.has(id)) return;
    visited.add(id);
    order.push(id);
    for (const childId of graph.tree.nodes.get(id)?.childIds ?? []) {
      visit(childId);
    }
  };
  graph.tree.rootIds.forEach((id) => visit(id));
  graph.nodes.forEach((node) => visit(node.id));
  return order;
}

/**
 * Serializes one graph edge, including the shared opening an agent needs to
 * size a doorway and the containment that makes one volume a feature of the
 * other.
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
    relations: [...edge.relations],
    containment: edge.containment
      ? {
          parentGreyBoxId: edge.containment.parentId,
          childGreyBoxId: edge.containment.childId,
          ratio: edge.containment.ratio,
        }
      : null,
    overlap: edge.overlap
      ? {
          min: { x: edge.overlap.bounds.min.x, y: edge.overlap.bounds.min.y, z: edge.overlap.bounds.min.z },
          max: { x: edge.overlap.bounds.max.x, y: edge.overlap.bounds.max.y, z: edge.overlap.bounds.max.z },
          fractionOfFirst: edge.overlap.fractionOfFirst,
          fractionOfSecond: edge.overlap.fractionOfSecond,
        }
      : null,
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
