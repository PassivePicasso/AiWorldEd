import * as THREE from 'three';
import { GreyBoxOrientedVolume, greyBoxVolumeHalfExtent } from './grey_box_oriented_volume.js';
import { GREY_BOX_CONTACT_TOLERANCE } from './grey_box_connectivity_tolerance.js';

/**
 * Fraction of a volume that must sit inside another before it counts as nested.
 * Well below 1 on purpose: a bridge overhanging its ravine, or a ledge poking a
 * little past a room wall, is still a feature of the space that holds it.
 */
export const GREY_BOX_CONTAINMENT_MIN_RATIO = 0.6;

/** Relative rotation below which two volumes share an orientation frame. */
const SHARED_ORIENTATION_EPSILON = 1e-4;

/** Samples per axis when measuring containment of differently oriented volumes. */
const SAMPLES_PER_AXIS = 8;

/** Containment of one volume inside another, with the measured ratio. */
export interface GreyBoxContainment {
  /** Volume that holds the other. */
  parentId: string;

  /** Volume that sits inside. */
  childId: string;

  /** Fraction of the child inside the parent, 0 to 1. */
  ratio: number;
}

/** Scratch state reused while measuring containment. */
const scratchRelativeRotation = new THREE.Quaternion();
const scratchOrientationInverse = new THREE.Quaternion();
const scratchSamplePoint = new THREE.Vector3();
const scratchLocalPoint = new THREE.Vector3();

/**
 * Measures the fraction of one volume that lies inside another. Exact when the
 * two share an orientation frame, which covers axis-aligned blockouts and any
 * pair rotated together; otherwise a deterministic lattice sample, so repeated
 * calls on an unchanged scene always agree.
 *
 * @param child Volume that might sit inside.
 * @param parent Volume that might hold it.
 * @returns Ratio from 0 (outside) to 1 (fully inside).
 */
export function greyBoxContainmentRatio(child: GreyBoxOrientedVolume, parent: GreyBoxOrientedVolume): number {
  if (sharesOrientation(child, parent)) {
    return alignedContainmentRatio(child, parent);
  }
  return sampledContainmentRatio(child, parent);
}

/** How much of each volume of a pair lies inside the other, and any nesting. */
export interface GreyBoxContainmentMeasurement {
  /** Fraction of the first volume inside the second, 0 to 1. */
  firstInsideSecond: number;

  /** Fraction of the second volume inside the first, 0 to 1. */
  secondInsideFirst: number;

  /** Nesting when one volume is inside the other far enough, else null. */
  containment: GreyBoxContainment | null;
}

/**
 * Measures a pair both ways and resolves nesting from it. The ratios come back
 * whether or not they amount to containment: a pair that merely clips still
 * needs a number, because how much two volumes intersect is what decides
 * whether the intersection matters, and only the person or agent reading the
 * layout can judge that.
 *
 * The better-contained volume is the child; an exact tie falls to the smaller
 * volume, then to id order, so the answer never depends on iteration order.
 *
 * @param first One volume of the pair.
 * @param second The other volume.
 * @returns Both ratios plus the containment they imply, if any.
 */
export function measureGreyBoxContainment(
  first: GreyBoxOrientedVolume,
  second: GreyBoxOrientedVolume,
): GreyBoxContainmentMeasurement {
  const firstInsideSecond = greyBoxContainmentRatio(first, second);
  const secondInsideFirst = greyBoxContainmentRatio(second, first);
  return {
    firstInsideSecond,
    secondInsideFirst,
    containment: resolveContainment(first, second, firstInsideSecond, secondInsideFirst),
  };
}

/**
 * Decides which volume holds the other, if either does.
 *
 * @param first One volume of the pair.
 * @param second The other volume.
 * @param firstInsideSecond Fraction of the first inside the second.
 * @param secondInsideFirst Fraction of the second inside the first.
 * @returns Containment record, or null when neither is nested in the other.
 */
function resolveContainment(
  first: GreyBoxOrientedVolume,
  second: GreyBoxOrientedVolume,
  firstInsideSecond: number,
  secondInsideFirst: number,
): GreyBoxContainment | null {
  if (firstInsideSecond < GREY_BOX_CONTAINMENT_MIN_RATIO && secondInsideFirst < GREY_BOX_CONTAINMENT_MIN_RATIO) {
    return null;
  }
  if (Math.abs(firstInsideSecond - secondInsideFirst) > 1e-6) {
    return firstInsideSecond > secondInsideFirst
      ? { parentId: second.id, childId: first.id, ratio: firstInsideSecond }
      : { parentId: first.id, childId: second.id, ratio: secondInsideFirst };
  }
  return resolveTiedContainment(first, second, firstInsideSecond);
}

/**
 * Returns the world-space volume of an oriented box.
 *
 * @param volume Oriented volume.
 * @returns Volume in cubic world units.
 */
export function greyBoxVolumeSize(volume: GreyBoxOrientedVolume): number {
  return 8 * volume.halfExtents.x * volume.halfExtents.y * volume.halfExtents.z;
}

/**
 * Breaks a containment tie by size, then by id, so the parent never depends on
 * which volume the caller happened to pass first.
 *
 * @param first One volume of the pair.
 * @param second The other volume.
 * @param ratio Shared containment ratio.
 * @returns Containment record.
 */
function resolveTiedContainment(
  first: GreyBoxOrientedVolume,
  second: GreyBoxOrientedVolume,
  ratio: number,
): GreyBoxContainment {
  const firstSize = greyBoxVolumeSize(first);
  const secondSize = greyBoxVolumeSize(second);
  if (Math.abs(firstSize - secondSize) > 1e-6) {
    return firstSize < secondSize
      ? { parentId: second.id, childId: first.id, ratio }
      : { parentId: first.id, childId: second.id, ratio };
  }
  return first.id < second.id
    ? { parentId: first.id, childId: second.id, ratio }
    : { parentId: second.id, childId: first.id, ratio };
}

/**
 * Returns whether two volumes share an orientation frame, so the child is
 * axis-aligned within the parent's space.
 *
 * @param child Volume that might sit inside.
 * @param parent Volume that might hold it.
 * @returns True when their rotations match.
 */
function sharesOrientation(child: GreyBoxOrientedVolume, parent: GreyBoxOrientedVolume): boolean {
  scratchOrientationInverse.copy(parent.rotation).invert();
  scratchRelativeRotation.copy(scratchOrientationInverse).multiply(child.rotation);
  return Math.abs(scratchRelativeRotation.w) > 1 - SHARED_ORIENTATION_EPSILON;
}

/**
 * Exact containment ratio for volumes sharing an orientation: the child becomes
 * an axis-aligned box in the parent's frame, so the overlap is a box product.
 *
 * @param child Volume that might sit inside.
 * @param parent Volume that might hold it.
 * @returns Ratio from 0 to 1.
 */
function alignedContainmentRatio(child: GreyBoxOrientedVolume, parent: GreyBoxOrientedVolume): number {
  const parentInverse = new THREE.Quaternion().copy(parent.rotation).invert();
  const childCenterInParent = toParentSpace(child.center, parent, parentInverse);
  let ratio = 1;
  for (let axisIndex = 0; axisIndex < 3; axisIndex++) {
    const childHalf = greyBoxVolumeHalfExtent(child, axisIndex);
    if (childHalf <= 0) return 0;
    const parentHalf = greyBoxVolumeHalfExtent(parent, axisIndex) + GREY_BOX_CONTACT_TOLERANCE;
    const offset = axisComponent(childCenterInParent, axisIndex);
    const inside = Math.min(offset + childHalf, parentHalf) - Math.max(offset - childHalf, -parentHalf);
    if (inside <= 0) return 0;
    ratio *= Math.min(inside / (childHalf * 2), 1);
  }
  return ratio;
}

/**
 * Approximate containment ratio for differently oriented volumes, from a
 * regular lattice of sample points inside the child. Deterministic by
 * construction.
 *
 * @param child Volume that might sit inside.
 * @param parent Volume that might hold it.
 * @returns Ratio from 0 to 1.
 */
function sampledContainmentRatio(child: GreyBoxOrientedVolume, parent: GreyBoxOrientedVolume): number {
  const parentInverse = new THREE.Quaternion().copy(parent.rotation).invert();
  let inside = 0;
  let total = 0;
  for (let x = 0; x < SAMPLES_PER_AXIS; x++) {
    for (let y = 0; y < SAMPLES_PER_AXIS; y++) {
      for (let z = 0; z < SAMPLES_PER_AXIS; z++) {
        total += 1;
        if (isSampleInsideParent(child, parent, parentInverse, x, y, z)) inside += 1;
      }
    }
  }
  return total === 0 ? 0 : inside / total;
}

/**
 * Tests one lattice cell center of the child against the parent's extents.
 *
 * @param child Volume being sampled.
 * @param parent Volume that might hold it.
 * @param parentInverse Precomputed inverse of the parent rotation.
 * @param xIndex Lattice index along the child's X axis.
 * @param yIndex Lattice index along the child's Y axis.
 * @param zIndex Lattice index along the child's Z axis.
 * @returns True when the sample lies inside the parent.
 */
function isSampleInsideParent(
  child: GreyBoxOrientedVolume,
  parent: GreyBoxOrientedVolume,
  parentInverse: THREE.Quaternion,
  xIndex: number,
  yIndex: number,
  zIndex: number,
): boolean {
  scratchSamplePoint.set(
    latticeOffset(xIndex) * child.halfExtents.x,
    latticeOffset(yIndex) * child.halfExtents.y,
    latticeOffset(zIndex) * child.halfExtents.z,
  );
  scratchSamplePoint.applyQuaternion(child.rotation).add(child.center);
  const local = toParentSpace(scratchSamplePoint, parent, parentInverse);
  return (
    Math.abs(local.x) <= parent.halfExtents.x + GREY_BOX_CONTACT_TOLERANCE &&
    Math.abs(local.y) <= parent.halfExtents.y + GREY_BOX_CONTACT_TOLERANCE &&
    Math.abs(local.z) <= parent.halfExtents.z + GREY_BOX_CONTACT_TOLERANCE
  );
}

/**
 * Maps a lattice index to a cell-center offset in the range -1 to 1, so samples
 * never land exactly on the child's surface.
 *
 * @param index Lattice index along one axis.
 * @returns Offset from -1 to 1.
 */
function latticeOffset(index: number): number {
  return ((index + 0.5) / SAMPLES_PER_AXIS) * 2 - 1;
}

/**
 * Converts a world point into a volume's local frame.
 *
 * @param point World point.
 * @param volume Volume whose frame to use.
 * @param volumeInverse Precomputed inverse of the volume rotation.
 * @returns Point in the volume's local space, valid until the next call.
 */
function toParentSpace(
  point: THREE.Vector3,
  volume: GreyBoxOrientedVolume,
  volumeInverse: THREE.Quaternion,
): THREE.Vector3 {
  return scratchLocalPoint.copy(point).sub(volume.center).applyQuaternion(volumeInverse);
}

/**
 * Reads one axis component of a vector by index.
 *
 * @param vector Source vector.
 * @param axisIndex 0 = X, 1 = Y, 2 = Z.
 * @returns Component value.
 */
function axisComponent(vector: THREE.Vector3, axisIndex: number): number {
  if (axisIndex === 0) return vector.x;
  if (axisIndex === 1) return vector.y;
  return vector.z;
}
