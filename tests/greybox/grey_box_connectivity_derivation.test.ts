import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { deriveGreyBoxConnections } from '../../src/greybox/connectivity/grey_box_derived_graph.js';
import { GreyBoxOrientedVolume } from '../../src/greybox/connectivity/grey_box_oriented_volume.js';
import { GREY_BOX_CONTACT_TOLERANCE } from '../../src/greybox/connectivity/grey_box_connectivity_tolerance.js';
import { greyBoxPairKey } from '../../src/greybox/model/grey_box_pair_key.js';

describe('deriveGreyBoxConnections', () => {
  it('finds no connections for a single volume', () => {
    expect(deriveGreyBoxConnections([box('a', 0, 0, 0, 10, 10, 10)])).toEqual([]);
  });

  it('connects two volumes sharing a full face', () => {
    const left = box('a', 0, 0, 0, 10, 10, 10);
    const right = box('b', 10, 0, 0, 10, 10, 10);
    const connections = deriveGreyBoxConnections([left, right]);
    expect(connections.length).toBe(1);
    expect(connections[0]!.kind).toBe('face');
    expect(connections[0]!.pairKey).toBe(greyBoxPairKey('a', 'b'));
  });

  it('reports the shared face area and opening size', () => {
    const connections = deriveGreyBoxConnections([box('a', 0, 0, 0, 10, 4, 6), box('b', 10, 0, 0, 10, 4, 6)]);
    const contact = connections[0]!.contacts[0]!;
    expect(contact.area).toBeCloseTo(24);
    expect(connections[0]!.totalContactArea).toBeCloseTo(24);
    const sortedSize = [contact.size.x, contact.size.y].sort((left, right) => left - right);
    expect(sortedSize[0]).toBeCloseTo(4);
    expect(sortedSize[1]).toBeCloseTo(6);
  });

  it('reports the contact axis and center', () => {
    const connections = deriveGreyBoxConnections([box('a', 0, 0, 0, 10, 10, 10), box('b', 10, 0, 0, 10, 10, 10)]);
    const contact = connections[0]!.contacts[0]!;
    expect(Math.abs(contact.axis.x)).toBeCloseTo(1);
    expect(contact.center.x).toBeCloseTo(5);
    expect(contact.center.y).toBeCloseTo(0);
  });

  it('reports a partial overlap area when faces only partly meet', () => {
    const connections = deriveGreyBoxConnections([box('a', 0, 0, 0, 10, 10, 10), box('b', 10, 8, 0, 10, 10, 10)]);
    expect(connections.length).toBe(1);
    expect(connections[0]!.contacts[0]!.area).toBeCloseTo(20);
  });

  it('ignores an edge-only touch', () => {
    const connections = deriveGreyBoxConnections([box('a', 0, 0, 0, 10, 10, 10), box('b', 10, 10, 0, 10, 10, 10)]);
    expect(connections).toEqual([]);
  });

  it('ignores a corner-only touch', () => {
    const connections = deriveGreyBoxConnections([box('a', 0, 0, 0, 10, 10, 10), box('b', 10, 10, 10, 10, 10, 10)]);
    expect(connections).toEqual([]);
  });

  it('ignores volumes separated by a real gap', () => {
    const connections = deriveGreyBoxConnections([box('a', 0, 0, 0, 10, 10, 10), box('b', 12, 0, 0, 10, 10, 10)]);
    expect(connections).toEqual([]);
  });

  it('still connects volumes separated by less than the contact tolerance', () => {
    const gap = GREY_BOX_CONTACT_TOLERANCE / 2;
    const connections = deriveGreyBoxConnections([box('a', 0, 0, 0, 10, 10, 10), box('b', 10 + gap, 0, 0, 10, 10, 10)]);
    expect(connections.length).toBe(1);
    expect(connections[0]!.kind).toBe('face');
  });

  it('reports deeply overlapping volumes as interpenetrating', () => {
    const connections = deriveGreyBoxConnections([box('a', 0, 0, 0, 10, 10, 10), box('b', 5, 0, 0, 10, 10, 10)]);
    expect(connections.length).toBe(1);
    expect(connections[0]!.kind).toBe('interpenetrating');
    expect(connections[0]!.contacts).toEqual([]);
  });

  it('reports the overlap region of interpenetrating volumes', () => {
    const connections = deriveGreyBoxConnections([box('a', 0, 0, 0, 10, 10, 10), box('b', 6, 0, 0, 10, 10, 10)]);
    const overlap = connections[0]!.overlapBounds!;
    expect(overlap.min.x).toBeCloseTo(1);
    expect(overlap.max.x).toBeCloseTo(5);
  });

  it('leaves overlapBounds null for face contacts', () => {
    const connections = deriveGreyBoxConnections([box('a', 0, 0, 0, 10, 10, 10), box('b', 10, 0, 0, 10, 10, 10)]);
    expect(connections[0]!.overlapBounds).toBeNull();
  });

  it('connects a stack of rooms into a chain', () => {
    const volumes = [box('a', 0, 0, 0, 10, 10, 10), box('b', 10, 0, 0, 10, 10, 10), box('c', 20, 0, 0, 10, 10, 10)];
    const keys = deriveGreyBoxConnections(volumes).map((connection) => connection.pairKey);
    expect(keys).toEqual([greyBoxPairKey('a', 'b'), greyBoxPairKey('b', 'c')]);
  });

  it('connects volumes stacked vertically', () => {
    const connections = deriveGreyBoxConnections([box('a', 0, 0, 0, 10, 4, 10), box('b', 0, 4, 0, 10, 4, 10)]);
    expect(connections.length).toBe(1);
    expect(Math.abs(connections[0]!.contacts[0]!.axis.y)).toBeCloseTo(1);
  });

  it('records one edge per pair regardless of iteration order', () => {
    const forward = deriveGreyBoxConnections([box('a', 0, 0, 0, 10, 10, 10), box('b', 10, 0, 0, 10, 10, 10)]);
    const reversed = deriveGreyBoxConnections([box('b', 10, 0, 0, 10, 10, 10), box('a', 0, 0, 0, 10, 10, 10)]);
    expect(forward.length).toBe(1);
    expect(reversed.length).toBe(1);
    expect(forward[0]!.pairKey).toBe(reversed[0]!.pairKey);
    expect(forward[0]!.firstId).toBe(reversed[0]!.firstId);
  });

  it('produces identical keys across repeated derivation', () => {
    const volumes = [box('a', 0, 0, 0, 10, 10, 10), box('b', 10, 0, 0, 10, 10, 10)];
    const first = deriveGreyBoxConnections(volumes).map((connection) => connection.pairKey);
    const second = deriveGreyBoxConnections(volumes).map((connection) => connection.pairKey);
    expect(second).toEqual(first);
  });

  it('detects a shared face between rotated volumes', () => {
    const angle = Math.PI / 4;
    const first = rotatedBox('a', new THREE.Vector3(0, 0, 0), 10, 10, 10, angle);
    const offset = new THREE.Vector3(10, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
    const second = rotatedBox('b', offset, 10, 10, 10, angle);
    const connections = deriveGreyBoxConnections([first, second]);
    expect(connections.length).toBe(1);
    expect(connections[0]!.kind).toBe('face');
    expect(connections[0]!.contacts[0]!.area).toBeCloseTo(100);
  });

  it('rejects rotated volumes that only meet along an edge', () => {
    const first = box('a', 0, 0, 0, 10, 10, 10);
    const second = rotatedBox('b', new THREE.Vector3(5 + Math.sqrt(50), 0, 0), 10, 10, 10, Math.PI / 4);
    expect(deriveGreyBoxConnections([first, second])).toEqual([]);
  });

  it('handles a scene large enough to exercise the spatial index', () => {
    const volumes: GreyBoxOrientedVolume[] = [];
    for (let index = 0; index < 40; index++) {
      volumes.push(box(`room-${index}`, index * 10, 0, 0, 10, 10, 10));
    }
    const connections = deriveGreyBoxConnections(volumes);
    expect(connections.length).toBe(39);
    expect(connections.every((connection) => connection.kind === 'face')).toBe(true);
  });

  it('finds no connections among widely scattered volumes', () => {
    const volumes: GreyBoxOrientedVolume[] = [];
    for (let index = 0; index < 30; index++) {
      volumes.push(box(`far-${index}`, index * 100, 0, 0, 10, 10, 10));
    }
    expect(deriveGreyBoxConnections(volumes)).toEqual([]);
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
