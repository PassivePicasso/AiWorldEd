import * as THREE from 'three';
import { BrushSpatialIndex } from '../../solid/algorithm/brush_spatial_index.js';
import { greyBoxPairKey } from '../model/grey_box_pair_key.js';
import {
  GreyBoxDerivedConnection,
  createFaceContactConnection,
  createInterpenetratingConnection,
} from './grey_box_derived_connection.js';
import { findGreyBoxFaceContacts } from './grey_box_face_contact.js';
import { greyBoxVolumesInterpenetrate } from './grey_box_volume_overlap.js';
import { GREY_BOX_CONTACT_TOLERANCE, GREY_BOX_MIN_OVERLAP_DEPTH } from './grey_box_connectivity_tolerance.js';
import { GreyBoxOrientedVolume, greyBoxVolumeWorldBounds } from './grey_box_oriented_volume.js';

/**
 * Computes the connectivity a set of grey box volumes implies by geometry
 * alone: which volumes touch, on which face, and how large the shared opening
 * is. Pure — it reads the volumes and returns edges, touching no scene state.
 *
 * @param volumes Oriented volumes to relate.
 * @returns Derived connections, one per connected pair, in stable key order.
 */
export function deriveGreyBoxConnections(volumes: GreyBoxOrientedVolume[]): GreyBoxDerivedConnection[] {
  const bounds = volumes.map((volume) => greyBoxVolumeWorldBounds(volume));
  const index = new BrushSpatialIndex(
    bounds.map((box) => ({ bounds: box })),
    GREY_BOX_CONTACT_TOLERANCE,
  );
  const connections = new Map<string, GreyBoxDerivedConnection>();
  for (let first = 0; first < volumes.length; first++) {
    for (const second of index.queryBounds(bounds[first]!, first)) {
      if (second <= first) continue;
      addPairConnection(volumes[first]!, volumes[second]!, bounds[first]!, bounds[second]!, connections);
    }
  }
  return sortByPairKey([...connections.values()]);
}

/**
 * Relates one candidate pair and records a connection when they meet.
 *
 * @param first First oriented volume.
 * @param second Second oriented volume.
 * @param firstBounds World bounds of the first volume.
 * @param secondBounds World bounds of the second volume.
 * @param connections Accumulator keyed by canonical pair key.
 */
function addPairConnection(
  first: GreyBoxOrientedVolume,
  second: GreyBoxOrientedVolume,
  firstBounds: THREE.Box3,
  secondBounds: THREE.Box3,
  connections: Map<string, GreyBoxDerivedConnection>,
): void {
  if (first.id === second.id) return;
  const pairKey = greyBoxPairKey(first.id, second.id);
  const [firstId, secondId] = orderedPairIds(first.id, second.id);
  if (greyBoxVolumesInterpenetrate(first, second, GREY_BOX_MIN_OVERLAP_DEPTH)) {
    const overlap = firstBounds.clone().intersect(secondBounds);
    connections.set(pairKey, createInterpenetratingConnection(pairKey, firstId, secondId, overlap));
    return;
  }
  const contacts = findGreyBoxFaceContacts(first, second);
  if (contacts.length === 0) return;
  connections.set(pairKey, createFaceContactConnection(pairKey, firstId, secondId, contacts));
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
 * Orders connections by pair key so repeated derivation is byte-stable.
 *
 * @param connections Connections to order.
 * @returns Connections sorted by pair key.
 */
function sortByPairKey(connections: GreyBoxDerivedConnection[]): GreyBoxDerivedConnection[] {
  return connections.sort((left, right) => left.pairKey.localeCompare(right.pairKey));
}
