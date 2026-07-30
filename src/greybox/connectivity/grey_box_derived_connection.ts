import * as THREE from 'three';
import { GreyBoxContainment } from './grey_box_containment.js';

/**
 * How two volumes relate. A pair can hold more than one of these at once: a
 * bridge can be contained by a ravine and share a face with the ledge at each
 * end. Blockout work nests and intersects volumes freely, so none of these is
 * an anomaly.
 */
export type GreyBoxRelationKind = 'adjacent' | 'overlaps' | 'contains';

/** One shared face region between two volumes. */
export interface GreyBoxFaceContact {
  /** Outward normal on the first volume's side of the contact. */
  axis: THREE.Vector3;

  /** Area of the shared region in square world units. */
  area: number;

  /** World center of the shared region. */
  center: THREE.Vector3;

  /** Extents of the shared region within the contact plane. */
  size: THREE.Vector2;

  /** Shared region outline in world space. */
  polygon: THREE.Vector3[];
}

/**
 * Everything geometry says about one pair of volumes. Authored links and mutes
 * are applied on top of these by the merge step.
 */
export interface GreyBoxDerivedRelation {
  /** Canonical order-independent key for the pair. */
  pairKey: string;

  /** Id of the volume sorted first in the pair key. */
  firstId: string;

  /** Id of the volume sorted second in the pair key. */
  secondId: string;

  /**
   * Shared face regions, largest area first. Empty when the volumes do not meet
   * face to face, which is independent of whether they nest or overlap.
   */
  contacts: GreyBoxFaceContact[];

  /** Sum of shared face areas; zero when there is no face contact. */
  totalContactArea: number;

  /**
   * Axis-aligned intersection of the two world bounds when the volumes overlap
   * without one containing the other, else null. Approximate for rotated
   * volumes.
   */
  overlapBounds: THREE.Box3 | null;

  /** Containment when one volume sits inside the other, else null. */
  containment: GreyBoxContainment | null;
}

/**
 * Builds a relation record for a pair, ordering face contacts largest first.
 *
 * @param pairKey Canonical pair key.
 * @param firstId Id sorted first in the pair key.
 * @param secondId Id sorted second in the pair key.
 * @param contacts Shared face regions, in any order.
 * @param overlapBounds Overlap region, or null.
 * @param containment Containment record, or null.
 * @returns Derived relation for the pair.
 */
export function createDerivedRelation(
  pairKey: string,
  firstId: string,
  secondId: string,
  contacts: GreyBoxFaceContact[],
  overlapBounds: THREE.Box3 | null,
  containment: GreyBoxContainment | null,
): GreyBoxDerivedRelation {
  const ordered = [...contacts].sort((left, right) => right.area - left.area);
  return {
    pairKey,
    firstId,
    secondId,
    contacts: ordered,
    totalContactArea: ordered.reduce((sum, contact) => sum + contact.area, 0),
    overlapBounds,
    containment,
  };
}

/**
 * Returns whether a relation record says anything at all, so pairs that merely
 * pass the broad phase are dropped.
 *
 * @param relation Relation record.
 * @returns True when at least one relation holds.
 */
export function hasAnyRelation(relation: GreyBoxDerivedRelation): boolean {
  return relation.contacts.length > 0 || relation.overlapBounds !== null || relation.containment !== null;
}

/**
 * Lists the relation kinds a record holds, for reporting and display.
 *
 * @param relation Relation record.
 * @returns Relation kinds, in a stable order.
 */
export function relationKinds(relation: GreyBoxDerivedRelation): GreyBoxRelationKind[] {
  const kinds: GreyBoxRelationKind[] = [];
  if (relation.containment) kinds.push('contains');
  if (relation.contacts.length > 0) kinds.push('adjacent');
  if (relation.overlapBounds) kinds.push('overlaps');
  return kinds;
}
