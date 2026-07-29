/**
 * Travel direction of an authored connection. Forward means the link is only
 * traversable from the owning grey box to its target, which is what a drop or a
 * one-way vent needs.
 */
export type GreyBoxConnectionDirection = 'bidirectional' | 'forward';

/**
 * A connection the user states explicitly, for routes geometry cannot imply:
 * elevators between stacked volumes, locked doors, one-way drops.
 */
export interface GreyBoxExplicitConnection {
  /** Stable identifier, unique within the owning grey box. */
  id: string;

  /** Id of the grey box on the far side of the link. */
  targetGreyBoxId: string;

  /**
   * Free-form route label such as door, corridor, stairs, elevator. Free text
   * rather than an enum so a missing category never blocks the user.
   */
  kind: string;

  /** User note carrying intent the kind label cannot express. */
  note: string;

  /** Whether the route is traversable both ways. */
  direction: GreyBoxConnectionDirection;
}

/**
 * Builds an explicit connection record.
 *
 * @param id Stable identifier, unique within the owning grey box.
 * @param targetGreyBoxId Grey box id on the far side of the link.
 * @param kind Free-form route label.
 * @param note User note; empty string when the user wrote none.
 * @param direction Whether the route is traversable both ways.
 * @returns New explicit connection.
 */
export function createExplicitConnection(
  id: string,
  targetGreyBoxId: string,
  kind: string,
  note: string,
  direction: GreyBoxConnectionDirection,
): GreyBoxExplicitConnection {
  if (id.length === 0) {
    throw new Error('Explicit grey box connection requires a non-empty id');
  }
  if (targetGreyBoxId.length === 0) {
    throw new Error(`Explicit grey box connection "${id}" requires a target grey box id`);
  }
  return { id, targetGreyBoxId, kind, note, direction };
}

/**
 * Copies an explicit connection so callers cannot mutate stored state.
 *
 * @param connection Connection to copy.
 * @returns Independent copy.
 */
export function cloneExplicitConnection(connection: GreyBoxExplicitConnection): GreyBoxExplicitConnection {
  return {
    id: connection.id,
    targetGreyBoxId: connection.targetGreyBoxId,
    kind: connection.kind,
    note: connection.note,
    direction: connection.direction,
  };
}

/**
 * Returns whether a value is a legal connection direction.
 *
 * @param value Candidate direction.
 * @returns True for the two supported directions.
 */
export function isGreyBoxConnectionDirection(value: unknown): value is GreyBoxConnectionDirection {
  return value === 'bidirectional' || value === 'forward';
}
