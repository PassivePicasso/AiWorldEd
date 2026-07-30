import * as THREE from 'three';

/**
 * How two volumes meet. Face contact is where a door or corridor mouth can go;
 * interpenetration usually means the designer intended one merged space.
 */
export type GreyBoxContactKind = 'face' | 'interpenetrating';

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
 * A connection between two volumes computed from geometry alone. Authored links
 * and suppressions are applied on top of these by the merge step.
 */
export interface GreyBoxDerivedConnection {
  /** Canonical order-independent key for the pair. */
  pairKey: string;

  /** Id of the volume sorted first in the pair key. */
  firstId: string;

  /** Id of the volume sorted second in the pair key. */
  secondId: string;

  /** How the two volumes meet. */
  kind: GreyBoxContactKind;

  /** Shared face regions, ordered largest area first. Empty when overlapping. */
  contacts: GreyBoxFaceContact[];

  /** Sum of shared face areas. Zero for interpenetrating pairs. */
  totalContactArea: number;

  /**
   * Axis-aligned intersection of the two world bounds for interpenetrating
   * pairs, or null for face contacts. Approximate for rotated volumes.
   */
  overlapBounds: THREE.Box3 | null;
}

/**
 * Builds a face-contact connection record.
 *
 * @param pairKey Canonical pair key.
 * @param firstId Id sorted first in the pair key.
 * @param secondId Id sorted second in the pair key.
 * @param contacts Shared face regions.
 * @returns Derived connection describing the contact.
 */
export function createFaceContactConnection(
  pairKey: string,
  firstId: string,
  secondId: string,
  contacts: GreyBoxFaceContact[],
): GreyBoxDerivedConnection {
  const ordered = [...contacts].sort((left, right) => right.area - left.area);
  return {
    pairKey,
    firstId,
    secondId,
    kind: 'face',
    contacts: ordered,
    totalContactArea: ordered.reduce((sum, contact) => sum + contact.area, 0),
    overlapBounds: null,
  };
}

/**
 * Builds an interpenetration connection record.
 *
 * @param pairKey Canonical pair key.
 * @param firstId Id sorted first in the pair key.
 * @param secondId Id sorted second in the pair key.
 * @param overlapBounds Axis-aligned overlap region.
 * @returns Derived connection describing the overlap.
 */
export function createInterpenetratingConnection(
  pairKey: string,
  firstId: string,
  secondId: string,
  overlapBounds: THREE.Box3,
): GreyBoxDerivedConnection {
  return {
    pairKey,
    firstId,
    secondId,
    kind: 'interpenetrating',
    contacts: [],
    totalContactArea: 0,
    overlapBounds,
  };
}
