import * as THREE from 'three';
import { BrushSpatialIndex } from '../../solid/algorithm/brush_spatial_index.js';
import { greyBoxPairKey } from '../model/grey_box_pair_key.js';
import {
  GreyBoxDerivedRelation,
  GreyBoxOverlap,
  createDerivedRelation,
  hasAnyRelation,
} from './grey_box_derived_connection.js';
import { findGreyBoxFaceContacts } from './grey_box_face_contact.js';
import { greyBoxVolumesInterpenetrate } from './grey_box_volume_overlap.js';
import { GreyBoxContainmentMeasurement, measureGreyBoxContainment } from './grey_box_containment.js';
import { GREY_BOX_CONTACT_TOLERANCE, GREY_BOX_MIN_OVERLAP_DEPTH } from './grey_box_connectivity_tolerance.js';
import { GreyBoxOrientedVolume, greyBoxVolumeWorldBounds } from './grey_box_oriented_volume.js';

/**
 * Computes what geometry says about a set of grey box volumes: which nest
 * inside which, which overlap, and which meet face to face. All three are
 * ordinary blockout relations, so a pair is tested for every one of them —
 * nesting a ledge in a room never hides the doorway that room shares with a
 * corridor.
 *
 * Pure: it reads the volumes and returns relations, touching no scene state.
 *
 * @param volumes Oriented volumes to relate.
 * @returns Derived relations, one per related pair, in stable key order.
 */
export function deriveGreyBoxRelations(volumes: GreyBoxOrientedVolume[]): GreyBoxDerivedRelation[] {
  const bounds = volumes.map((volume) => greyBoxVolumeWorldBounds(volume));
  const index = new BrushSpatialIndex(
    bounds.map((box) => ({ bounds: box })),
    GREY_BOX_CONTACT_TOLERANCE,
  );
  const relations = new Map<string, GreyBoxDerivedRelation>();
  for (let first = 0; first < volumes.length; first++) {
    for (const second of index.queryBounds(bounds[first]!, first)) {
      if (second <= first) continue;
      addPairRelation(volumes[first]!, volumes[second]!, bounds[first]!, bounds[second]!, relations);
    }
  }
  return sortByPairKey([...relations.values()]);
}

/**
 * Relates one candidate pair, recording every relation that holds.
 *
 * @param first First oriented volume.
 * @param second Second oriented volume.
 * @param firstBounds World bounds of the first volume.
 * @param secondBounds World bounds of the second volume.
 * @param relations Accumulator keyed by canonical pair key.
 */
function addPairRelation(
  first: GreyBoxOrientedVolume,
  second: GreyBoxOrientedVolume,
  firstBounds: THREE.Box3,
  secondBounds: THREE.Box3,
  relations: Map<string, GreyBoxDerivedRelation>,
): void {
  if (first.id === second.id) return;
  const measurement = measureGreyBoxContainment(first, second);
  const [firstId, secondId] = orderedPairIds(first.id, second.id);
  const relation = createDerivedRelation(
    greyBoxPairKey(first.id, second.id),
    firstId,
    secondId,
    findGreyBoxFaceContacts(first, second),
    resolveOverlap(first, second, firstBounds, secondBounds, measurement, firstId === first.id),
    measurement.containment,
  );
  if (!hasAnyRelation(relation)) return;
  relations.set(relation.pairKey, relation);
}

/**
 * Describes how a pair intersects when neither contains the other, including
 * how much of each volume is involved. The fractions are what let a reader tell
 * a couple of centimetres of clipping from two spaces half merged into each
 * other; the editor reports them and judges neither.
 *
 * Containment is reported as nesting instead, so a ledge inside a room does not
 * also read as a collision — the containment ratio is its magnitude.
 *
 * @param first First oriented volume.
 * @param second Second oriented volume.
 * @param firstBounds World bounds of the first volume.
 * @param secondBounds World bounds of the second volume.
 * @param measurement Containment measurement for this pair.
 * @param firstIsPairKeyFirst Whether the first volume sorts first in the pair
 *   key.
 * @returns Overlap with its extent, or null.
 */
function resolveOverlap(
  first: GreyBoxOrientedVolume,
  second: GreyBoxOrientedVolume,
  firstBounds: THREE.Box3,
  secondBounds: THREE.Box3,
  measurement: GreyBoxContainmentMeasurement,
  firstIsPairKeyFirst: boolean,
): GreyBoxOverlap | null {
  if (measurement.containment) return null;
  if (!greyBoxVolumesInterpenetrate(first, second, GREY_BOX_MIN_OVERLAP_DEPTH)) return null;
  return {
    bounds: firstBounds.clone().intersect(secondBounds),
    fractionOfFirst: firstIsPairKeyFirst ? measurement.firstInsideSecond : measurement.secondInsideFirst,
    fractionOfSecond: firstIsPairKeyFirst ? measurement.secondInsideFirst : measurement.firstInsideSecond,
  };
}

/**
 * Sorts the two ids of a pair the way the canonical key orders them.
 *
 * @param firstId One volume id.
 * @param secondId The other volume id.
 * @returns Ids in sorted order.
 */
function orderedPairIds(firstId: string, secondId: string): [string, string] {
  return firstId < secondId ? [firstId, secondId] : [secondId, firstId];
}

/**
 * Orders relations by pair key so repeated derivation is byte-stable.
 *
 * @param relations Relations to order.
 * @returns Relations sorted by pair key.
 */
function sortByPairKey(relations: GreyBoxDerivedRelation[]): GreyBoxDerivedRelation[] {
  return relations.sort((left, right) => left.pairKey.localeCompare(right.pairKey));
}
