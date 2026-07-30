import { GreyBoxContainment } from './grey_box_containment.js';

/** One volume's place in the containment hierarchy. */
export interface GreyBoxTreeNode {
  /** Grey box id. */
  id: string;

  /** Id of the volume that holds this one, or null for a root. */
  parentId: string | null;

  /** Ids of the volumes nested directly inside this one, in stable order. */
  childIds: string[];

  /** Nesting depth, zero for a root. */
  depth: number;

  /** Whether the parent was stated by the user rather than derived. */
  authoredParent: boolean;
}

/** The containment hierarchy of a blockout. */
export interface GreyBoxContainmentTree {
  /** Ids with no parent, in stable order. */
  rootIds: string[];

  /** Every volume's node, keyed by id. */
  nodes: Map<string, GreyBoxTreeNode>;

  /**
   * Parent links dropped because following them would have formed a cycle.
   * Reported rather than silently ignored.
   */
  brokenCycles: Array<{ childId: string; parentId: string }>;
}

/** Parent claims for one volume, from geometry and from the user. */
export interface GreyBoxParentClaims {
  /** Volume being placed. */
  id: string;

  /** Parent stated by Outliner parenting, or null. */
  authoredParentId: string | null;

  /** Parent implied by geometry, or null. */
  derivedParentId: string | null;
}

/**
 * Builds the containment hierarchy. A parent stated by Outliner parenting wins
 * over the geometric guess, including where geometry found nothing. Parent
 * links that would close a cycle are dropped and reported, so a bad hierarchy
 * surfaces instead of hanging the graph.
 *
 * @param claims Parent claims for every volume, in stable input order.
 * @returns Containment tree with roots, nodes, and any broken cycles.
 */
export function buildGreyBoxContainmentTree(claims: GreyBoxParentClaims[]): GreyBoxContainmentTree {
  const known = new Set(claims.map((claim) => claim.id));
  const nodes = new Map<string, GreyBoxTreeNode>();
  const brokenCycles: Array<{ childId: string; parentId: string }> = [];
  const resolved = resolveParents(claims, known);
  for (const claim of claims) {
    nodes.set(claim.id, {
      id: claim.id,
      parentId: null,
      childIds: [],
      depth: 0,
      authoredParent: false,
    });
  }
  for (const claim of claims) {
    attachToParent(claim, resolved, nodes, brokenCycles);
  }
  assignDepths(nodes);
  return { rootIds: collectRootIds(claims, nodes), nodes, brokenCycles };
}

/**
 * Picks each volume's parent, preferring the authored claim and ignoring claims
 * that name a volume outside the set.
 *
 * @param claims Parent claims for every volume.
 * @param known Ids present in this graph.
 * @returns Chosen parent id per volume, with a flag for authored claims.
 */
function resolveParents(
  claims: GreyBoxParentClaims[],
  known: Set<string>,
): Map<string, { parentId: string; authored: boolean }> {
  const resolved = new Map<string, { parentId: string; authored: boolean }>();
  for (const claim of claims) {
    const authored = claim.authoredParentId;
    if (authored && authored !== claim.id && known.has(authored)) {
      resolved.set(claim.id, { parentId: authored, authored: true });
      continue;
    }
    const derived = claim.derivedParentId;
    if (derived && derived !== claim.id && known.has(derived)) {
      resolved.set(claim.id, { parentId: derived, authored: false });
    }
  }
  return resolved;
}

/**
 * Links one volume to its parent unless doing so would close a cycle.
 *
 * @param claim Volume being placed.
 * @param resolved Chosen parent per volume.
 * @param nodes Node map being built.
 * @param brokenCycles Accumulator for dropped links.
 */
function attachToParent(
  claim: GreyBoxParentClaims,
  resolved: Map<string, { parentId: string; authored: boolean }>,
  nodes: Map<string, GreyBoxTreeNode>,
  brokenCycles: Array<{ childId: string; parentId: string }>,
): void {
  const choice = resolved.get(claim.id);
  if (!choice) return;
  if (wouldFormCycle(claim.id, choice.parentId, nodes)) {
    brokenCycles.push({ childId: claim.id, parentId: choice.parentId });
    return;
  }
  const node = nodes.get(claim.id);
  const parent = nodes.get(choice.parentId);
  if (!node || !parent) return;
  node.parentId = choice.parentId;
  node.authoredParent = choice.authored;
  parent.childIds.push(claim.id);
}

/**
 * Returns whether following already-committed parent links from a proposed
 * parent leads back to the child. Checking committed links rather than raw
 * claims means a mutual claim keeps its first link and only the one that would
 * close the loop is dropped, instead of both volumes losing their parent.
 *
 * @param childId Volume being placed.
 * @param parentId Proposed parent.
 * @param nodes Nodes with the links committed so far.
 * @returns True when the link would close a cycle.
 */
function wouldFormCycle(childId: string, parentId: string, nodes: Map<string, GreyBoxTreeNode>): boolean {
  const seen = new Set<string>([childId]);
  let current: string | null = parentId;
  while (current !== null) {
    if (seen.has(current)) return true;
    seen.add(current);
    current = nodes.get(current)?.parentId ?? null;
  }
  return false;
}

/**
 * Walks from the roots down, recording each node's nesting depth.
 *
 * @param nodes Node map with parent links already set.
 */
function assignDepths(nodes: Map<string, GreyBoxTreeNode>): void {
  for (const node of nodes.values()) {
    node.depth = measureDepth(node, nodes);
  }
}

/**
 * Counts parent links above a node.
 *
 * @param node Node to measure.
 * @param nodes Node map with parent links already set.
 * @returns Nesting depth, zero for a root.
 */
function measureDepth(node: GreyBoxTreeNode, nodes: Map<string, GreyBoxTreeNode>): number {
  let depth = 0;
  let current = node.parentId;
  const seen = new Set<string>([node.id]);
  while (current !== null && !seen.has(current)) {
    seen.add(current);
    depth += 1;
    current = nodes.get(current)?.parentId ?? null;
  }
  return depth;
}

/**
 * Collects root ids in the order their volumes were supplied.
 *
 * @param claims Parent claims in input order.
 * @param nodes Node map with parent links already set.
 * @returns Root ids in stable order.
 */
function collectRootIds(claims: GreyBoxParentClaims[], nodes: Map<string, GreyBoxTreeNode>): string[] {
  const roots: string[] = [];
  for (const claim of claims) {
    if (nodes.get(claim.id)?.parentId === null) roots.push(claim.id);
  }
  return roots;
}

/**
 * Extracts the derived parent claim for a volume from its containment records.
 * A volume can be geometrically inside several others; the deepest-fitting one
 * wins, measured by the tightest containing volume.
 *
 * @param volumeId Volume to place.
 * @param containments Containment records touching this volume.
 * @param volumeSizeById Volume size per id, used to pick the tightest parent.
 * @returns Chosen derived parent id, or null.
 */
export function pickDerivedParent(
  volumeId: string,
  containments: GreyBoxContainment[],
  volumeSizeById: Map<string, number>,
): string | null {
  let bestParentId: string | null = null;
  let bestSize = Number.POSITIVE_INFINITY;
  for (const containment of containments) {
    if (containment.childId !== volumeId) continue;
    const size = volumeSizeById.get(containment.parentId) ?? Number.POSITIVE_INFINITY;
    if (size < bestSize || (size === bestSize && bestParentId !== null && containment.parentId < bestParentId)) {
      bestParentId = containment.parentId;
      bestSize = size;
    }
  }
  return bestParentId;
}
