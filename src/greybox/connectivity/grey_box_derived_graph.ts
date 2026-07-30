import * as THREE from 'three';
import { BrushSpatialIndex } from '../../solid/algorithm/brush_spatial_index.js';
import { greyBoxPairKey } from '../model/grey_box_pair_key.js';
import { GreyBoxDerivedRelation, createDerivedRelation, hasAnyRelation } from './grey_box_derived_connection.js';
import { findGreyBoxFaceContacts } from './grey_box_face_contact.js';
import { greyBoxVolumesInterpenetrate } from './grey_box_volume_overlap.js';
import { GreyBoxContainment, resolveGreyBoxContainment } from './grey_box_containment.js';
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
  const containment = resolveGreyBoxContainment(first, second);
  const relation = createDerivedRelation(
    greyBoxPairKey(first.id, second.id),
    ...orderedPairIds(first.id, second.id),
    findGreyBoxFaceContacts(first, second),
    resolveOverlapBounds(first, second, firstBounds, secondBounds, containment),
    containment,
  );
  if (!hasAnyRelation(relation)) return;
  relations.set(relation.pairKey, relation);
}

/**
 * Computes the overlap region for a pair that intersects without one containing
 * the other. Containment is reported as nesting rather than as an overlap, so a
 * ledge inside a room does not also read as a collision.
 *
 * @param first First oriented volume.
 * @param second Second oriented volume.
 * @param firstBounds World bounds of the first volume.
 * @param secondBounds World bounds of the second volume.
 * @param containment Containment for this pair, or null.
 * @returns Overlap region, or null.
 */
function resolveOverlapBounds(
  first: GreyBoxOrientedVolume,
  second: GreyBoxOrientedVolume,
  firstBounds: THREE.Box3,
  secondBounds: THREE.Box3,
  containment: GreyBoxContainment | null,
): THREE.Box3 | null {
  if (containment) return null;
  if (!greyBoxVolumesInterpenetrate(first, second, GREY_BOX_MIN_OVERLAP_DEPTH)) return null;
  return firstBounds.clone().intersect(secondBounds);
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
