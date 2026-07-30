import * as THREE from 'three';
import { SolidModel } from '../../solid/model/solid_model.js';
import { SolidModelRegistry } from '../../solid/model/solid_model_registry.js';
import { computeGreyBoxWorldBounds } from '../../greybox/model/grey_box_volume.js';

/** What already exists inside a grey box volume. */
export interface GreyBoxOccupancyPayload {
  /** Solid models with at least one brush centered inside the volume. */
  solidModelIds: string[];

  /** Brushes centered inside the volume. */
  brushCount: number;

  /** True when nothing has been authored inside the volume yet. */
  empty: boolean;
}

/**
 * Reports what occupies a grey box volume, so an agent can tell a blocked-out
 * space from one it has already built.
 *
 * @param worldObject Scene root to search.
 * @param greyBox Grey box volume mesh.
 * @returns Occupancy summary for the volume.
 */
export function collectGreyBoxOccupancy(worldObject: THREE.Object3D, greyBox: THREE.Mesh): GreyBoxOccupancyPayload {
  const bounds = computeGreyBoxWorldBounds(greyBox);
  const solidModelIds = new Set<string>();
  let brushCount = 0;
  for (const model of SolidModelRegistry.collectUnder(worldObject)) {
    const inside = countBrushesInside(model, bounds);
    if (inside === 0) continue;
    brushCount += inside;
    solidModelIds.add(model.root.uuid);
  }
  return {
    solidModelIds: [...solidModelIds],
    brushCount,
    empty: brushCount === 0,
  };
}

/**
 * Counts a model's brushes whose world center falls inside the bounds.
 *
 * @param model Solid model to inspect.
 * @param bounds Grey box world bounds.
 * @returns Number of brushes centered inside.
 */
function countBrushesInside(model: SolidModel, bounds: THREE.Box3): number {
  let count = 0;
  const center = new THREE.Vector3();
  for (const brush of model.getBrushes()) {
    if (!brush.mesh) continue;
    brush.mesh.getWorldPosition(center);
    if (bounds.containsPoint(center)) count += 1;
  }
  return count;
}
