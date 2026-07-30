import * as THREE from 'three';
import {
  GreyBoxConnectionDirection,
  GreyBoxExplicitConnection,
  cloneExplicitConnection,
  createExplicitConnection,
} from './grey_box_connection.js';
import { GreyBoxRegistry } from './grey_box_registry.js';
import { allocateGreyBoxConnectionId } from './grey_box_id.js';

/** Fields of an authored connection the user can change after creating it. */
export interface GreyBoxConnectionEdits {
  kind?: string;
  note?: string;
  direction?: GreyBoxConnectionDirection;
}

/**
 * Lists the authored connections of a grey box as copies, so callers cannot
 * mutate stored state through the returned records.
 *
 * @param greyBox Grey box to read.
 * @returns Copies of the authored connections.
 */
export function listGreyBoxConnections(greyBox: THREE.Object3D): GreyBoxExplicitConnection[] {
  return GreyBoxRegistry.get(greyBox).explicitConnections.map((connection) => cloneExplicitConnection(connection));
}

/**
 * Adds an authored connection from one grey box to another.
 *
 * @param greyBox Grey box that owns the link.
 * @param targetGreyBoxId Id of the volume on the far side.
 * @param kind Free-form route label.
 * @param note User note; empty string when none.
 * @param direction Whether the route is traversable both ways.
 * @returns The stored connection.
 */
export function addGreyBoxConnection(
  greyBox: THREE.Object3D,
  targetGreyBoxId: string,
  kind: string,
  note: string,
  direction: GreyBoxConnectionDirection,
): GreyBoxExplicitConnection {
  const data = GreyBoxRegistry.get(greyBox);
  if (targetGreyBoxId === data.id) {
    throw new Error(`Grey box "${greyBox.name}" cannot connect to itself`);
  }
  const connection = createExplicitConnection(allocateGreyBoxConnectionId(), targetGreyBoxId, kind, note, direction);
  data.explicitConnections.push(connection);
  return cloneExplicitConnection(connection);
}

/**
 * Restores a previously removed authored connection, keeping its id so undo
 * round-trips exactly.
 *
 * @param greyBox Grey box that owns the link.
 * @param connection Connection to reinstate.
 * @param index Position to reinsert at, appended when out of range.
 */
export function restoreGreyBoxConnection(
  greyBox: THREE.Object3D,
  connection: GreyBoxExplicitConnection,
  index: number,
): void {
  const connections = GreyBoxRegistry.get(greyBox).explicitConnections;
  const copy = cloneExplicitConnection(connection);
  if (index < 0 || index > connections.length) {
    connections.push(copy);
    return;
  }
  connections.splice(index, 0, copy);
}

/**
 * Removes an authored connection by id.
 *
 * @param greyBox Grey box that owns the link.
 * @param connectionId Id of the connection to remove.
 * @returns Index the connection occupied, or -1 when absent.
 */
export function removeGreyBoxConnection(greyBox: THREE.Object3D, connectionId: string): number {
  const connections = GreyBoxRegistry.get(greyBox).explicitConnections;
  const index = connections.findIndex((connection) => connection.id === connectionId);
  if (index < 0) return -1;
  connections.splice(index, 1);
  return index;
}

/**
 * Finds an authored connection by id.
 *
 * @param greyBox Grey box that owns the link.
 * @param connectionId Id to look up.
 * @returns Copy of the connection, or null when absent.
 */
export function findGreyBoxConnection(greyBox: THREE.Object3D, connectionId: string): GreyBoxExplicitConnection | null {
  const found = GreyBoxRegistry.get(greyBox).explicitConnections.find((connection) => connection.id === connectionId);
  return found ? cloneExplicitConnection(found) : null;
}

/**
 * Applies edits to an authored connection.
 *
 * @param greyBox Grey box that owns the link.
 * @param connectionId Id of the connection to edit.
 * @param edits Fields to change.
 * @returns True when the connection existed.
 */
export function editGreyBoxConnection(
  greyBox: THREE.Object3D,
  connectionId: string,
  edits: GreyBoxConnectionEdits,
): boolean {
  const stored = GreyBoxRegistry.get(greyBox).explicitConnections.find((entry) => entry.id === connectionId);
  if (!stored) return false;
  if (edits.kind !== undefined) stored.kind = edits.kind;
  if (edits.note !== undefined) stored.note = edits.note;
  if (edits.direction !== undefined) stored.direction = edits.direction;
  return true;
}

/**
 * Removes every authored connection pointing at a grey box id. Used when a
 * volume is deleted so no link dangles.
 *
 * @param greyBox Grey box to clean up.
 * @param removedGreyBoxId Id of the volume that went away.
 * @returns Removed connections with the index each occupied, for undo.
 */
export function pruneGreyBoxConnectionsTo(
  greyBox: THREE.Object3D,
  removedGreyBoxId: string,
): Array<{ connection: GreyBoxExplicitConnection; index: number }> {
  const connections = GreyBoxRegistry.get(greyBox).explicitConnections;
  const removed: Array<{ connection: GreyBoxExplicitConnection; index: number }> = [];
  for (let index = connections.length - 1; index >= 0; index--) {
    if (connections[index]!.targetGreyBoxId !== removedGreyBoxId) continue;
    removed.push({ connection: cloneExplicitConnection(connections[index]!), index });
    connections.splice(index, 1);
  }
  return removed.reverse();
}

/**
 * Returns whether a grey box mutes a derived adjacency.
 *
 * @param greyBox Grey box to read.
 * @param pairKey Canonical pair key of the adjacency.
 * @returns True when the adjacency is muted.
 */
export function isDerivedConnectionSuppressed(greyBox: THREE.Object3D, pairKey: string): boolean {
  return GreyBoxRegistry.get(greyBox).suppressedDerivedConnections.includes(pairKey);
}

/**
 * Mutes or unmutes a derived adjacency on a grey box.
 *
 * @param greyBox Grey box to update.
 * @param pairKey Canonical pair key of the adjacency.
 * @param suppressed True to mute, false to restore.
 * @returns True when the stored state changed.
 */
export function setDerivedConnectionSuppressed(greyBox: THREE.Object3D, pairKey: string, suppressed: boolean): boolean {
  const keys = GreyBoxRegistry.get(greyBox).suppressedDerivedConnections;
  const index = keys.indexOf(pairKey);
  if (suppressed && index < 0) {
    keys.push(pairKey);
    return true;
  }
  if (!suppressed && index >= 0) {
    keys.splice(index, 1);
    return true;
  }
  return false;
}
