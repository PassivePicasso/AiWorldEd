import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { deriveGreyBoxRelations } from '../../src/greybox/connectivity/grey_box_derived_graph.js';
import { GreyBoxOrientedVolume } from '../../src/greybox/connectivity/grey_box_oriented_volume.js';
import { GREY_BOX_CONTACT_TOLERANCE } from '../../src/greybox/connectivity/grey_box_connectivity_tolerance.js';
import {
  GREY_BOX_CONTAINMENT_MIN_RATIO,
  greyBoxContainmentRatio,
} from '../../src/greybox/connectivity/grey_box_containment.js';
import { relationKinds } from '../../src/greybox/connectivity/grey_box_derived_connection.js';
import { greyBoxPairKey } from '../../src/greybox/model/grey_box_pair_key.js';

describe('grey box adjacency', () => {
  it('finds no relations for a single volume', () => {
    expect(deriveGreyBoxRelations([box('a', 0, 0, 0, 10, 10, 10)])).toEqual([]);
  });

  it('relates two volumes sharing a full face', () => {
    const relations = deriveGreyBoxRelations([box('a', 0, 0, 0, 10, 10, 10), box('b', 10, 0, 0, 10, 10, 10)]);
    expect(relations.length).toBe(1);
    expect(relationKinds(relations[0]!)).toEqual(['adjacent']);
    expect(relations[0]!.pairKey).toBe(greyBoxPairKey('a', 'b'));
  });

  it('reports the shared face area and opening size', () => {
    const relations = deriveGreyBoxRelations([box('a', 0, 0, 0, 10, 4, 6), box('b', 10, 0, 0, 10, 4, 6)]);
    const contact = relations[0]!.contacts[0]!;
    expect(contact.area).toBeCloseTo(24);
    const sortedSize = [contact.size.x, contact.size.y].sort((left, right) => left - right);
    expect(sortedSize[0]).toBeCloseTo(4);
    expect(sortedSize[1]).toBeCloseTo(6);
  });

  it('ignores edge-only and corner-only touches', () => {
    expect(deriveGreyBoxRelations([box('a', 0, 0, 0, 10, 10, 10), box('b', 10, 10, 0, 10, 10, 10)])).toEqual([]);
    expect(deriveGreyBoxRelations([box('a', 0, 0, 0, 10, 10, 10), box('b', 10, 10, 10, 10, 10, 10)])).toEqual([]);
  });

  it('ignores volumes separated by a real gap', () => {
    expect(deriveGreyBoxRelations([box('a', 0, 0, 0, 10, 10, 10), box('b', 12, 0, 0, 10, 10, 10)])).toEqual([]);
  });

  it('still relates volumes separated by less than the contact tolerance', () => {
    const gap = GREY_BOX_CONTACT_TOLERANCE / 2;
    const relations = deriveGreyBoxRelations([box('a', 0, 0, 0, 10, 10, 10), box('b', 10 + gap, 0, 0, 10, 10, 10)]);
    expect(relationKinds(relations[0]!)).toEqual(['adjacent']);
  });

  it('relates a chain of rooms in stable key order', () => {
    const volumes = [box('a', 0, 0, 0, 10, 10, 10), box('b', 10, 0, 0, 10, 10, 10), box('c', 20, 0, 0, 10, 10, 10)];
    const keys = deriveGreyBoxRelations(volumes).map((relation) => relation.pairKey);
    expect(keys).toEqual([greyBoxPairKey('a', 'b'), greyBoxPairKey('b', 'c')]);
  });

  it('detects a shared face between volumes rotated together', () => {
    const angle = Math.PI / 4;
    const offset = new THREE.Vector3(10, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
    const relations = deriveGreyBoxRelations([
      rotatedBox('a', new THREE.Vector3(0, 0, 0), 10, 10, 10, angle),
      rotatedBox('b', offset, 10, 10, 10, angle),
    ]);
    expect(relations[0]!.contacts[0]!.area).toBeCloseTo(100);
  });
});

describe('grey box nesting', () => {
  it('reports a fully contained volume as nested, not as an anomaly', () => {
    const relations = deriveGreyBoxRelations([box('hall', 0, 0, 0, 40, 20, 40), box('pillar', 0, 0, 0, 4, 20, 4)]);
    expect(relations.length).toBe(1);
    expect(relationKinds(relations[0]!)).toEqual(['contains']);
    expect(relations[0]!.overlapBounds).toBeNull();
  });

  it('names the larger volume as the parent', () => {
    const relations = deriveGreyBoxRelations([box('hall', 0, 0, 0, 40, 20, 40), box('ledge', 10, 0, 10, 8, 2, 8)]);
    expect(relations[0]!.containment!.parentId).toBe('hall');
    expect(relations[0]!.containment!.childId).toBe('ledge');
    expect(relations[0]!.containment!.ratio).toBeCloseTo(1);
  });

  it('reports containment the same way whichever order the volumes arrive in', () => {
    const hall = box('hall', 0, 0, 0, 40, 20, 40);
    const ledge = box('ledge', 10, 0, 10, 8, 2, 8);
    const forward = deriveGreyBoxRelations([hall, ledge])[0]!.containment!;
    const reversed = deriveGreyBoxRelations([ledge, hall])[0]!.containment!;
    expect(reversed.parentId).toBe(forward.parentId);
    expect(reversed.childId).toBe(forward.childId);
  });

  it('nests a bridge that overhangs the volume holding it', () => {
    const relations = deriveGreyBoxRelations([box('ravine', 0, 0, 0, 20, 10, 10), box('bridge', 2, 0, 0, 20, 2, 4)]);
    const containment = relations[0]!.containment!;
    expect(containment.parentId).toBe('ravine');
    expect(containment.childId).toBe('bridge');
    expect(containment.ratio).toBeGreaterThan(GREY_BOX_CONTAINMENT_MIN_RATIO);
    expect(containment.ratio).toBeLessThan(1);
  });

  it('treats a half-and-half intersection as an overlap rather than nesting', () => {
    const relations = deriveGreyBoxRelations([box('a', 0, 0, 0, 10, 10, 10), box('b', 5, 0, 0, 10, 10, 10)]);
    expect(relationKinds(relations[0]!)).toEqual(['overlaps']);
    expect(relations[0]!.containment).toBeNull();
    expect(relations[0]!.overlapBounds).not.toBeNull();
  });

  it('reports the overlap region of an intersecting pair', () => {
    const relations = deriveGreyBoxRelations([box('a', 0, 0, 0, 10, 10, 10), box('b', 6, 0, 0, 10, 10, 10)]);
    const overlap = relations[0]!.overlapBounds!;
    expect(overlap.min.x).toBeCloseTo(1);
    expect(overlap.max.x).toBeCloseTo(5);
  });

  it('reports nesting without adjacency for a volume flush inside its parent', () => {
    const relations = deriveGreyBoxRelations([box('hall', 0, 0, 0, 40, 20, 40), box('alcove', 0, 0, 0, 40, 20, 8)]);
    expect(relationKinds(relations[0]!)).toEqual(['contains']);
    expect(relations[0]!.contacts).toEqual([]);
  });

  it('does not let nesting hide a doorway elsewhere in the layout', () => {
    const relations = deriveGreyBoxRelations([
      box('hall', 0, 0, 0, 40, 20, 40),
      box('pillar', 0, 0, 0, 4, 20, 4),
      box('corridor', 25, 0, 0, 10, 20, 8),
    ]);
    const hallToCorridor = relations.find((relation) => relation.pairKey === greyBoxPairKey('hall', 'corridor'))!;
    expect(relationKinds(hallToCorridor)).toContain('adjacent');
    expect(hallToCorridor.contacts[0]!.area).toBeCloseTo(160);
  });

  it('reports an angled volume crossing another as an overlap', () => {
    const bridge = rotatedBox('bridge', new THREE.Vector3(9, 0, 0), 20, 2, 4, Math.PI / 6);
    const relations = deriveGreyBoxRelations([box('room', 0, 0, 0, 16, 12, 16), bridge]);
    expect(relations.length).toBe(1);
    expect(relationKinds(relations[0]!)).toContain('overlaps');
  });

  it('nests a volume rotated inside an unrotated parent', () => {
    const ledge = rotatedBox('ledge', new THREE.Vector3(0, 0, 0), 8, 2, 4, Math.PI / 5);
    const relations = deriveGreyBoxRelations([box('hall', 0, 0, 0, 40, 20, 40), ledge]);
    expect(relations[0]!.containment!.childId).toBe('ledge');
    expect(relations[0]!.containment!.ratio).toBeCloseTo(1);
  });

  it('measures containment ratio the same way on repeated calls', () => {
    const ledge = rotatedBox('ledge', new THREE.Vector3(6, 0, 0), 12, 2, 4, Math.PI / 7);
    const hall = box('hall', 0, 0, 0, 20, 10, 10);
    const first = greyBoxContainmentRatio(ledge, hall);
    expect(greyBoxContainmentRatio(ledge, hall)).toBe(first);
    expect(first).toBeGreaterThan(0);
    expect(first).toBeLessThan(1);
  });

  it('reports zero containment for volumes that do not intersect', () => {
    expect(greyBoxContainmentRatio(box('a', 0, 0, 0, 4, 4, 4), box('b', 40, 0, 0, 10, 10, 10))).toBe(0);
  });

  it('handles two levels of nesting', () => {
    const relations = deriveGreyBoxRelations([
      box('hall', 0, 0, 0, 40, 20, 40),
      box('mezzanine', 0, 6, 0, 20, 6, 20),
      box('crate', 0, 6, 0, 2, 2, 2),
    ]);
    const hallMezz = relations.find((entry) => entry.pairKey === greyBoxPairKey('hall', 'mezzanine'))!;
    const mezzCrate = relations.find((entry) => entry.pairKey === greyBoxPairKey('mezzanine', 'crate'))!;
    expect(hallMezz.containment!.parentId).toBe('hall');
    expect(mezzCrate.containment!.parentId).toBe('mezzanine');
  });

  it('stays fast enough over a layout with many volumes', () => {
    const volumes: GreyBoxOrientedVolume[] = [];
    for (let index = 0; index < 40; index++) {
      volumes.push(box(`room-${index}`, index * 10, 0, 0, 10, 10, 10));
      volumes.push(box(`prop-${index}`, index * 10, 0, 0, 2, 2, 2));
    }
    const relations = deriveGreyBoxRelations(volumes);
    expect(relations.filter((relation) => relation.containment !== null).length).toBe(40);
  });
});

/**
 * Builds an axis-aligned volume from a center and full size.
 *
 * @param id Volume id.
 * @param centerX Center X.
 * @param centerY Center Y.
 * @param centerZ Center Z.
 * @param sizeX Full width.
 * @param sizeY Full height.
 * @param sizeZ Full depth.
 * @returns Oriented volume with identity rotation.
 */
function box(
  id: string,
  centerX: number,
  centerY: number,
  centerZ: number,
  sizeX: number,
  sizeY: number,
  sizeZ: number,
): GreyBoxOrientedVolume {
  return {
    id,
    name: id,
    center: new THREE.Vector3(centerX, centerY, centerZ),
    halfExtents: new THREE.Vector3(sizeX / 2, sizeY / 2, sizeZ / 2),
    rotation: new THREE.Quaternion(),
  };
}

/**
 * Builds a volume rotated about the Y axis.
 *
 * @param id Volume id.
 * @param center World center.
 * @param sizeX Full width.
 * @param sizeY Full height.
 * @param sizeZ Full depth.
 * @param yawRadians Rotation about Y.
 * @returns Oriented volume with the given yaw.
 */
function rotatedBox(
  id: string,
  center: THREE.Vector3,
  sizeX: number,
  sizeY: number,
  sizeZ: number,
  yawRadians: number,
): GreyBoxOrientedVolume {
  return {
    id,
    name: id,
    center: center.clone(),
    halfExtents: new THREE.Vector3(sizeX / 2, sizeY / 2, sizeZ / 2),
    rotation: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yawRadians),
  };
}
