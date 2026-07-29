import { GreyBoxExplicitConnection, cloneExplicitConnection } from './grey_box_connection.js';

/**
 * Semantic payload of a grey box. The volume itself is the mesh geometry and
 * transform; this is the layout meaning an AI agent reads over MCP.
 */
export interface GreyBoxData {
  /** Stable id independent of Object3D.uuid, referenced by connections. */
  id: string;

  /** User-authored purpose of the volume. Empty string is a legal value. */
  description: string;

  /** Connections the user stated explicitly. */
  explicitConnections: GreyBoxExplicitConnection[];

  /** Canonical pair keys of derived adjacencies the user muted. */
  suppressedDerivedConnections: string[];
}

/**
 * Builds grey box data. The description is required at construction so an
 * unwritten description is an explicit empty string rather than an absent
 * field.
 *
 * @param id Stable grey box id.
 * @param description User-authored purpose; pass an empty string when
 *   unwritten.
 * @returns New grey box data with no connections.
 */
export function createGreyBoxData(id: string, description: string): GreyBoxData {
  if (id.length === 0) {
    throw new Error('Grey box data requires a non-empty id');
  }
  return {
    id,
    description,
    explicitConnections: [],
    suppressedDerivedConnections: [],
  };
}

/**
 * Deep-copies grey box data so stored state cannot be mutated through a handle.
 *
 * @param data Data to copy.
 * @returns Independent copy.
 */
export function cloneGreyBoxData(data: GreyBoxData): GreyBoxData {
  return {
    id: data.id,
    description: data.description,
    explicitConnections: data.explicitConnections.map((connection) => cloneExplicitConnection(connection)),
    suppressedDerivedConnections: data.suppressedDerivedConnections.slice(),
  };
}

/**
 * Copies grey box data under a new id, which is what duplicating a volume
 * needs.
 *
 * @param data Source data.
 * @param newId Id for the copy.
 * @returns Copy carrying the new id.
 */
export function cloneGreyBoxDataWithId(data: GreyBoxData, newId: string): GreyBoxData {
  const copy = cloneGreyBoxData(data);
  if (newId.length === 0) {
    throw new Error('Grey box data copy requires a non-empty id');
  }
  copy.id = newId;
  return copy;
}
