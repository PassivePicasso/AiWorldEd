import * as THREE from 'three';
import { GreyBoxOrientedVolume, greyBoxVolumeAxis, greyBoxVolumeHalfExtent } from './grey_box_oriented_volume.js';

/** Below this axis length the separating-axis candidate is degenerate. */
const DEGENERATE_AXIS_LENGTH = 1e-6;

/**
 * Returns the smallest penetration depth between two oriented volumes, or zero
 * when a separating axis exists. Standard 15-axis separating-axis test: the
 * three axes of each volume plus the nine cross products.
 *
 * @param first First oriented volume.
 * @param second Second oriented volume.
 * @returns Minimum penetration depth, or 0 when the volumes are apart.
 */
export function greyBoxPenetrationDepth(first: GreyBoxOrientedVolume, second: GreyBoxOrientedVolume): number {
  let smallestDepth = Number.POSITIVE_INFINITY;
  for (const axis of separatingAxisCandidates(first, second)) {
    const depth = penetrationAlongAxis(first, second, axis);
    if (depth <= 0) return 0;
    if (depth < smallestDepth) smallestDepth = depth;
  }
  return Number.isFinite(smallestDepth) ? smallestDepth : 0;
}

/**
 * Returns whether two volumes interpenetrate by more than a depth threshold.
 *
 * @param first First oriented volume.
 * @param second Second oriented volume.
 * @param minimumDepth Depth above which the pair counts as overlapping.
 * @returns True when the volumes overlap deeply enough.
 */
export function greyBoxVolumesInterpenetrate(
  first: GreyBoxOrientedVolume,
  second: GreyBoxOrientedVolume,
  minimumDepth: number,
): boolean {
  return greyBoxPenetrationDepth(first, second) > minimumDepth;
}

/**
 * Builds the candidate separating axes for two oriented volumes.
 *
 * @param first First oriented volume.
 * @param second Second oriented volume.
 * @returns Unit axis candidates, degenerate cross products omitted.
 */
function separatingAxisCandidates(first: GreyBoxOrientedVolume, second: GreyBoxOrientedVolume): THREE.Vector3[] {
  const firstAxes = [0, 1, 2].map((index) => greyBoxVolumeAxis(first, index));
  const secondAxes = [0, 1, 2].map((index) => greyBoxVolumeAxis(second, index));
  const candidates = [...firstAxes, ...secondAxes];
  for (const firstAxis of firstAxes) {
    for (const secondAxis of secondAxes) {
      const cross = new THREE.Vector3().crossVectors(firstAxis, secondAxis);
      if (cross.length() < DEGENERATE_AXIS_LENGTH) continue;
      candidates.push(cross.normalize());
    }
  }
  return candidates;
}

/**
 * Measures overlap of the two volumes' projections onto one axis.
 *
 * @param first First oriented volume.
 * @param second Second oriented volume.
 * @param axis Unit axis to project onto.
 * @returns Overlap length; zero or less means the axis separates them.
 */
function penetrationAlongAxis(
  first: GreyBoxOrientedVolume,
  second: GreyBoxOrientedVolume,
  axis: THREE.Vector3,
): number {
  const centerDistance = Math.abs(axis.dot(second.center) - axis.dot(first.center));
  const reach = projectedRadius(first, axis) + projectedRadius(second, axis);
  return reach - centerDistance;
}

/**
 * Computes a volume's half width when projected onto an axis.
 *
 * @param volume Oriented volume.
 * @param axis Unit axis to project onto.
 * @returns Projected half width.
 */
function projectedRadius(volume: GreyBoxOrientedVolume, axis: THREE.Vector3): number {
  let radius = 0;
  for (let axisIndex = 0; axisIndex < 3; axisIndex++) {
    const volumeAxis = greyBoxVolumeAxis(volume, axisIndex);
    radius += Math.abs(axis.dot(volumeAxis)) * greyBoxVolumeHalfExtent(volume, axisIndex);
  }
  return radius;
}
