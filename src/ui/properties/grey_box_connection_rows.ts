import { GreyBoxGraphEdge, GreyBoxMergedGraph } from '../../greybox/connectivity/grey_box_graph_types.js';

/** One listable connection for the inspector, derived or authored. */
export interface GreyBoxConnectionRow {
  /** Canonical pair key of the connection. */
  pairKey: string;

  /** Whether geometry implies the row or the user authored it. */
  source: 'derived' | 'authored';

  /** Authored connection id, present only for authored rows. */
  connectionId: string | null;

  /** Id of the volume that authored the link, for authored rows only. */
  authoredOwnerId: string | null;

  /** Whether a derived adjacency is muted. */
  suppressed: boolean;

  /** One-line row text. */
  label: string;

  /** Longer text for the row tooltip. */
  detail: string;
}

/**
 * Builds the inspector rows for one volume: its surviving graph edges plus the
 * adjacencies it has muted, so a muted neighbour stays visible and restorable.
 *
 * @param graph Merged layout graph.
 * @param ownerId Id of the selected volume.
 * @returns Rows in graph order, muted rows last.
 */
export function buildGreyBoxConnectionRows(graph: GreyBoxMergedGraph, ownerId: string): GreyBoxConnectionRow[] {
  const names = new Map(graph.nodes.map((node) => [node.id, node.name]));
  const rows: GreyBoxConnectionRow[] = [];
  for (const edge of graph.edges) {
    if (edge.firstId !== ownerId && edge.secondId !== ownerId) continue;
    rows.push(...edgeRows(edge, ownerId, names));
  }
  rows.push(...suppressedRows(graph, ownerId, names));
  return rows;
}

/**
 * Builds the rows one edge contributes: the geometric adjacency and each
 * authored link on it.
 *
 * @param edge Graph edge touching the owner.
 * @param ownerId Id of the selected volume.
 * @param names Volume names by id.
 * @returns Rows for this edge.
 */
function edgeRows(edge: GreyBoxGraphEdge, ownerId: string, names: Map<string, string>): GreyBoxConnectionRow[] {
  const rows: GreyBoxConnectionRow[] = [];
  const neighbourName = names.get(otherId(edge, ownerId)) ?? otherId(edge, ownerId);
  if (edge.source === 'derived') {
    rows.push({
      pairKey: edge.pairKey,
      source: 'derived',
      connectionId: null,
      authoredOwnerId: null,
      suppressed: false,
      label: `${neighbourName} — ${describeContact(edge)}`,
      detail: `Derived from geometry: ${describeContact(edge)}`,
    });
  }
  for (const link of edge.authoredLinks) {
    rows.push({
      pairKey: edge.pairKey,
      source: 'authored',
      connectionId: link.id,
      authoredOwnerId: link.ownerId,
      suppressed: false,
      label: `${neighbourName} — ${link.kind || 'link'}${link.direction === 'forward' ? ' (one way)' : ''}`,
      detail: link.note.length > 0 ? link.note : 'Authored connection',
    });
  }
  return rows;
}

/**
 * Builds rows for adjacencies the user muted, which are absent from the edges.
 *
 * @param graph Merged layout graph.
 * @param ownerId Id of the selected volume.
 * @param names Volume names by id.
 * @returns Muted rows.
 */
function suppressedRows(
  graph: GreyBoxMergedGraph,
  ownerId: string,
  names: Map<string, string>,
): GreyBoxConnectionRow[] {
  const rows: GreyBoxConnectionRow[] = [];
  for (const pairKey of graph.suppressedPairKeys) {
    const ids = pairKey.split('|');
    if (!ids.includes(ownerId)) continue;
    const neighbourId = ids.find((id) => id !== ownerId) ?? ownerId;
    rows.push({
      pairKey,
      source: 'derived',
      connectionId: null,
      authoredOwnerId: null,
      suppressed: true,
      label: `${names.get(neighbourId) ?? neighbourId} — muted`,
      detail: 'Adjacency muted by the user',
    });
  }
  return rows;
}

/**
 * Returns the id on the far side of an edge.
 *
 * @param edge Graph edge.
 * @param ownerId Id of the selected volume.
 * @returns The neighbour's id.
 */
function otherId(edge: GreyBoxGraphEdge, ownerId: string): string {
  return edge.firstId === ownerId ? edge.secondId : edge.firstId;
}

/**
 * Describes how two volumes meet in one short phrase.
 *
 * @param edge Graph edge.
 * @returns Human-readable contact summary.
 */
function describeContact(edge: GreyBoxGraphEdge): string {
  if (edge.contactKind === 'interpenetrating') return 'overlapping';
  if (edge.contacts.length === 0) return 'connected';
  const contact = edge.contacts[0]!;
  return `shared face ${formatSize(contact.size.x)} x ${formatSize(contact.size.y)}`;
}

/**
 * Formats a size for inspector display.
 *
 * @param value Size in world units.
 * @returns Trimmed numeric text.
 */
function formatSize(value: number): string {
  return value.toFixed(2).replace(/\.?0+$/, '');
}
