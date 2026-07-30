import * as THREE from 'three';
import { SolidPlane } from '../../solid/brush/solid_plane.js';

/**
 * A grey box volume as an oriented box in world space. Connectivity works from
 * this rather than from scene objects so derivation stays pure and testable.
 */
export interface GreyBoxOrientedVolume {
  /** Stable grey box id. */
  id: string;

  /** Display name, carried for readable connectivity output. */
  name: string;

  /** World-space center of the volume. */
  center: THREE.Vector3;

  /** World-scaled half sizes along the volume's own axes. */
  halfExtents: THREE.Vector3;

  /** World rotation of the volume. */
  rotation: THREE.Quaternion;
}

/** One face of an oriented volume in world space. */
export interface GreyBoxVolumeFace {
  /** Axis this face faces along: 0 = X, 1 = Y, 2 = Z. */
  axisIndex: number;

  /** Direction along that axis: +1 or -1. */
  axisSign: number;

  /** Outward unit normal in world space. */
  normal: THREE.Vector3;

  /** Four world corners, counter-clockwise seen from outside. */
  polygon: THREE.Vector3[];
}

/** Unit axes indexed 0 = X, 1 = Y, 2 = Z. */
const UNIT_AXES = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)];

/**
 * Returns a volume's own axis in world space.
 *
 * @param volume Oriented volume.
 * @param axisIndex 0 = X, 1 = Y, 2 = Z.
 * @returns Unit axis direction.
 */
export function greyBoxVolumeAxis(volume: GreyBoxOrientedVolume, axisIndex: number): THREE.Vector3 {
  return UNIT_AXES[axisIndex]!.clone().applyQuaternion(volume.rotation).normalize();
}

/**
 * Returns the half extent along one of a volume's own axes.
 *
 * @param volume Oriented volume.
 * @param axisIndex 0 = X, 1 = Y, 2 = Z.
 * @returns Half size along that axis.
 */
export function greyBoxVolumeHalfExtent(volume: GreyBoxOrientedVolume, axisIndex: number): number {
  if (axisIndex === 0) return volume.halfExtents.x;
  if (axisIndex === 1) return volume.halfExtents.y;
  return volume.halfExtents.z;
}

/**
 * Builds all six world-space faces of a volume.
 *
 * @param volume Oriented volume.
 * @returns Faces with outward normals and corner rings.
 */
export function greyBoxVolumeFaces(volume: GreyBoxOrientedVolume): GreyBoxVolumeFace[] {
  const faces: GreyBoxVolumeFace[] = [];
  for (let axisIndex = 0; axisIndex < 3; axisIndex++) {
    faces.push(buildVolumeFace(volume, axisIndex, 1));
    faces.push(buildVolumeFace(volume, axisIndex, -1));
  }
  return faces;
}

/**
 * Builds the six outward planes of a volume, ready for convex clipping.
 *
 * @param volume Oriented volume.
 * @returns Outward planes in world space.
 */
export function greyBoxVolumeOutwardPlanes(volume: GreyBoxOrientedVolume): SolidPlane[] {
  return greyBoxVolumeFaces(volume).map((face) => {
    const pointOnFace = face.polygon[0]!;
    return new SolidPlane(face.normal, -face.normal.dot(pointOnFace));
  });
}

/**
 * Computes the axis-aligned world bounds enclosing a volume.
 *
 * @param volume Oriented volume.
 * @returns World bounds.
 */
export function greyBoxVolumeWorldBounds(volume: GreyBoxOrientedVolume): THREE.Box3 {
  const bounds = new THREE.Box3();
  for (const corner of greyBoxVolumeCorners(volume)) {
    bounds.expandByPoint(corner);
  }
  return bounds;
}

/**
 * Returns the eight world corners of a volume.
 *
 * @param volume Oriented volume.
 * @returns Corner positions.
 */
export function greyBoxVolumeCorners(volume: GreyBoxOrientedVolume): THREE.Vector3[] {
  const corners: THREE.Vector3[] = [];
  for (const signX of [-1, 1]) {
    for (const signY of [-1, 1]) {
      for (const signZ of [-1, 1]) {
        corners.push(volumeLocalPoint(volume, signX, signY, signZ));
      }
    }
  }
  return corners;
}

/**
 * Maps a corner sign triple to a world position.
 *
 * @param volume Oriented volume.
 * @param signX Sign along the volume's X axis.
 * @param signY Sign along the volume's Y axis.
 * @param signZ Sign along the volume's Z axis.
 * @returns World position of that corner.
 */
function volumeLocalPoint(volume: GreyBoxOrientedVolume, signX: number, signY: number, signZ: number): THREE.Vector3 {
  const local = new THREE.Vector3(
    signX * volume.halfExtents.x,
    signY * volume.halfExtents.y,
    signZ * volume.halfExtents.z,
  );
  return local.applyQuaternion(volume.rotation).add(volume.center);
}

/**
 * Builds one world-space face. Corner order is counter-clockwise seen from
 * outside so Newell-derived planes point outward.
 *
 * @param volume Oriented volume.
 * @param axisIndex Face axis: 0 = X, 1 = Y, 2 = Z.
 * @param axisSign +1 for the positive face, -1 for the negative face.
 * @returns Face with outward normal and corner ring.
 */
function buildVolumeFace(volume: GreyBoxOrientedVolume, axisIndex: number, axisSign: number): GreyBoxVolumeFace {
  const normal = greyBoxVolumeAxis(volume, axisIndex).multiplyScalar(axisSign);
  const tangentU = greyBoxVolumeAxis(volume, (axisIndex + 1) % 3);
  const tangentV = greyBoxVolumeAxis(volume, (axisIndex + 2) % 3);
  const halfU = greyBoxVolumeHalfExtent(volume, (axisIndex + 1) % 3);
  const halfV = greyBoxVolumeHalfExtent(volume, (axisIndex + 2) % 3);
  const faceCenter = volume.center.clone().addScaledVector(normal, greyBoxVolumeHalfExtent(volume, axisIndex));
  const ring: Array<[number, number]> =
    axisSign > 0
      ? [
          [-1, -1],
          [1, -1],
          [1, 1],
          [-1, 1],
        ]
      : [
          [-1, 1],
          [1, 1],
          [1, -1],
          [-1, -1],
        ];
  const polygon = ring.map(([signU, signV]) =>
    faceCenter
      .clone()
      .addScaledVector(tangentU, signU * halfU)
      .addScaledVector(tangentV, signV * halfV),
  );
  return { axisIndex, axisSign, normal, polygon };
}
