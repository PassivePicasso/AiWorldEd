import * as THREE from 'three';
import { ConvexPolygonClipper } from '../../solid/algorithm/convex_polygon_clipper.js';
import { SOLID_NORMAL_ALIGN_EPSILON } from '../../solid/algorithm/solid_math_constants.js';
import { GreyBoxFaceContact } from './grey_box_derived_connection.js';
import { GREY_BOX_CONTACT_TOLERANCE, GREY_BOX_MIN_CONTACT_AREA } from './grey_box_connectivity_tolerance.js';
import {
  GreyBoxOrientedVolume,
  GreyBoxVolumeFace,
  greyBoxVolumeAxis,
  greyBoxVolumeFaces,
  greyBoxVolumeOutwardPlanes,
} from './grey_box_oriented_volume.js';

/**
 * Finds every shared face region between two volumes: pairs of opposed, nearly
 * coplanar faces whose overlap has real area. Edge-only and corner-only touches
 * clip to a degenerate region and are rejected by the minimum area.
 *
 * @param first First oriented volume.
 * @param second Second oriented volume.
 * @returns Shared face regions, empty when the volumes do not share a face.
 */
export function findGreyBoxFaceContacts(
  first: GreyBoxOrientedVolume,
  second: GreyBoxOrientedVolume,
): GreyBoxFaceContact[] {
  const contacts: GreyBoxFaceContact[] = [];
  const secondFaces = greyBoxVolumeFaces(second);
  const secondPlanes = greyBoxVolumeOutwardPlanes(second);
  for (const firstFace of greyBoxVolumeFaces(first)) {
    const opposed = secondFaces.find((secondFace) => facesAreOpposedAndCoplanar(firstFace, secondFace));
    if (!opposed) continue;
    const contact = buildFaceContact(first, firstFace, secondPlanes);
    if (contact) contacts.push(contact);
  }
  return contacts;
}

/**
 * Returns whether two faces point at each other and lie on the same plane
 * within the contact tolerance.
 *
 * @param firstFace Face of the first volume.
 * @param secondFace Face of the second volume.
 * @returns True when the faces are flush and opposed.
 */
function facesAreOpposedAndCoplanar(firstFace: GreyBoxVolumeFace, secondFace: GreyBoxVolumeFace): boolean {
  if (firstFace.normal.dot(secondFace.normal) > -SOLID_NORMAL_ALIGN_EPSILON) return false;
  const separation = firstFace.normal.dot(secondFace.polygon[0]!) - firstFace.normal.dot(firstFace.polygon[0]!);
  return Math.abs(separation) <= GREY_BOX_CONTACT_TOLERANCE;
}

/**
 * Clips a face against the other volume to get the shared region.
 *
 * @param volume Volume owning the face.
 * @param face Candidate contact face.
 * @param otherPlanes Outward planes of the other volume.
 * @returns Contact record, or null when the shared region is negligible.
 */
function buildFaceContact(
  volume: GreyBoxOrientedVolume,
  face: GreyBoxVolumeFace,
  otherPlanes: ReturnType<typeof greyBoxVolumeOutwardPlanes>,
): GreyBoxFaceContact | null {
  const shared = clipInsideVolume(face.polygon, otherPlanes);
  if (shared.length < 3) return null;
  const area = convexPolygonArea(shared);
  if (area < GREY_BOX_MIN_CONTACT_AREA) return null;
  return {
    axis: face.normal.clone(),
    area,
    center: polygonCenter(shared),
    size: measureInPlaneSize(volume, face, shared),
    polygon: shared,
  };
}

/**
 * Keeps the portion of a polygon inside a volume, clipping with the grey box
 * contact tolerance. The tolerance must match the coplanarity check: a pair
 * accepted as flush with a hair of space between them would otherwise clip away
 * to nothing against the opposing plane.
 *
 * @param polygon Face polygon to clip.
 * @param planes Outward planes of the other volume.
 * @returns Shared region, or an empty array when nothing survives.
 */
function clipInsideVolume(
  polygon: THREE.Vector3[],
  planes: ReturnType<typeof greyBoxVolumeOutwardPlanes>,
): THREE.Vector3[] {
  let current = polygon;
  for (const plane of planes) {
    current = ConvexPolygonClipper.clipByPlane(current, plane, GREY_BOX_CONTACT_TOLERANCE).inside;
    if (current.length < 3) return [];
  }
  return current.map((point) => point.clone());
}

/**
 * Computes the area of a planar convex polygon.
 *
 * @param polygon Ordered polygon vertices.
 * @returns Area in square world units.
 */
export function convexPolygonArea(polygon: THREE.Vector3[]): number {
  if (polygon.length < 3) return 0;
  const accumulated = new THREE.Vector3();
  const origin = polygon[0]!;
  for (let index = 1; index < polygon.length - 1; index++) {
    const edgeA = new THREE.Vector3().subVectors(polygon[index]!, origin);
    const edgeB = new THREE.Vector3().subVectors(polygon[index + 1]!, origin);
    accumulated.add(new THREE.Vector3().crossVectors(edgeA, edgeB));
  }
  return accumulated.length() / 2;
}

/**
 * Averages polygon vertices to a center point.
 *
 * @param polygon Ordered polygon vertices.
 * @returns Center position.
 */
function polygonCenter(polygon: THREE.Vector3[]): THREE.Vector3 {
  const center = new THREE.Vector3();
  for (const point of polygon) {
    center.add(point);
  }
  return center.multiplyScalar(1 / polygon.length);
}

/**
 * Measures a shared region's extents along the contact plane's own two axes, so
 * a reported opening can be sized against a doorway.
 *
 * @param volume Volume owning the contact face.
 * @param face Contact face.
 * @param polygon Shared region.
 * @returns Width and height within the contact plane.
 */
function measureInPlaneSize(
  volume: GreyBoxOrientedVolume,
  face: GreyBoxVolumeFace,
  polygon: THREE.Vector3[],
): THREE.Vector2 {
  const tangentU = greyBoxVolumeAxis(volume, (face.axisIndex + 1) % 3);
  const tangentV = greyBoxVolumeAxis(volume, (face.axisIndex + 2) % 3);
  return new THREE.Vector2(spanAlongAxis(polygon, tangentU), spanAlongAxis(polygon, tangentV));
}

/**
 * Measures the extent of points projected onto an axis.
 *
 * @param points Polygon vertices.
 * @param axis Unit axis to project onto.
 * @returns Distance between the extreme projections.
 */
function spanAlongAxis(points: THREE.Vector3[], axis: THREE.Vector3): number {
  let lowest = Number.POSITIVE_INFINITY;
  let highest = Number.NEGATIVE_INFINITY;
  for (const point of points) {
    const projection = axis.dot(point);
    if (projection < lowest) lowest = projection;
    if (projection > highest) highest = projection;
  }
  return highest - lowest;
}
