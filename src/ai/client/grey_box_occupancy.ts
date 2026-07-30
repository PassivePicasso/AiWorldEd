import * as THREE from 'three';
import { SolidModel } from '../../solid/model/solid_model.js';
import { SolidModelRegistry } from '../../solid/model/solid_model_registry.js';
import { GreyBoxRegistry } from '../../greybox/model/grey_box_registry.js';
import { computeGreyBoxWorldBounds } from '../../greybox/model/grey_box_volume.js';
import type { GreyBoxMergedGraph } from '../../greybox/connectivity/grey_box_graph_types.js';

/** What already exists inside a grey box volume. */
export interface GreyBoxOccupancyPayload {
  /** Solid models with at least one brush attributed to this volume. */
  solidModelIds: string[];

  /** Brushes attributed here rather than to a volume nested inside this one. */
  ownBrushCount: number;

  /** Brushes attributed to this volume or to anything nested inside it. */
  subtreeBrushCount: number;

  /** True when nothing has been authored in this volume or below it. */
  empty: boolean;
}

/**
 * Reports what occupies every grey box volume. A brush is attributed to the
 * innermost volume that contains it, so a brush inside a mezzanine inside a
 * hall counts as the mezzanine's work; the hall still sees it in its subtree
 * count.
 *
 * @param worldObject Scene root to search.
 * @param graph Merged layout graph supplying the containment hierarchy.
 * @returns Occupancy per grey box id.
 */
export function computeGreyBoxOccupancy(
  worldObject: THREE.Object3D,
  graph: GreyBoxMergedGraph,
): Map<string, GreyBoxOccupancyPayload> {
  const volumes = collectVolumeBounds(worldObject, graph);
  const occupancy = new Map<string, GreyBoxOccupancyPayload>();
  for (const node of graph.nodes) {
    occupancy.set(node.id, { solidModelIds: [], ownBrushCount: 0, subtreeBrushCount: 0, empty: true });
  }
  for (const brush of collectBrushPlacements(worldObject)) {
    const innermostId = findInnermostVolumeId(brush.center, volumes, graph);
    if (!innermostId) continue;
    attributeBrush(innermostId, brush.solidModelId, occupancy, graph);
  }
  return occupancy;
}

/**
 * Reads occupancy for one volume, defaulting to empty when it has no entry.
 *
 * @param occupancy Occupancy map from {@link computeGreyBoxOccupancy}.
 * @param greyBoxId Volume to read.
 * @returns Occupancy for that volume.
 */
export function readGreyBoxOccupancy(
  occupancy: Map<string, GreyBoxOccupancyPayload>,
  greyBoxId: string,
): GreyBoxOccupancyPayload {
  return occupancy.get(greyBoxId) ?? { solidModelIds: [], ownBrushCount: 0, subtreeBrushCount: 0, empty: true };
}

/**
 * Records a brush against its innermost volume and every ancestor's subtree.
 *
 * @param innermostId Volume the brush is attributed to.
 * @param solidModelId Owning solid model uuid.
 * @param occupancy Occupancy map being filled.
 * @param graph Merged graph supplying parent links.
 */
function attributeBrush(
  innermostId: string,
  solidModelId: string,
  occupancy: Map<string, GreyBoxOccupancyPayload>,
  graph: GreyBoxMergedGraph,
): void {
  const own = occupancy.get(innermostId);
  if (own) {
    own.ownBrushCount += 1;
    if (!own.solidModelIds.includes(solidModelId)) own.solidModelIds.push(solidModelId);
  }
  let currentId: string | null = innermostId;
  const seen = new Set<string>();
  while (currentId && !seen.has(currentId)) {
    seen.add(currentId);
    const entry = occupancy.get(currentId);
    if (entry) {
      entry.subtreeBrushCount += 1;
      entry.empty = false;
    }
    currentId = graph.tree.nodes.get(currentId)?.parentId ?? null;
  }
}

/**
 * Collects world bounds per grey box volume present in the graph.
 *
 * @param worldObject Scene root to search.
 * @param graph Merged layout graph.
 * @returns World bounds keyed by grey box id.
 */
function collectVolumeBounds(worldObject: THREE.Object3D, graph: GreyBoxMergedGraph): Map<string, THREE.Box3> {
  const bounds = new Map<string, THREE.Box3>();
  for (const node of graph.nodes) {
    const object = GreyBoxRegistry.findById(worldObject, node.id);
    if (!(object instanceof THREE.Mesh)) continue;
    bounds.set(node.id, computeGreyBoxWorldBounds(object));
  }
  return bounds;
}

/**
 * Finds the deepest volume whose bounds contain a point.
 *
 * @param point World point to place.
 * @param volumes World bounds keyed by grey box id.
 * @param graph Merged graph supplying nesting depth.
 * @returns Innermost containing volume id, or null when outside every volume.
 */
function findInnermostVolumeId(
  point: THREE.Vector3,
  volumes: Map<string, THREE.Box3>,
  graph: GreyBoxMergedGraph,
): string | null {
  let bestId: string | null = null;
  let bestDepth = -1;
  for (const [id, box] of volumes) {
    if (!box.containsPoint(point)) continue;
    const depth = graph.tree.nodes.get(id)?.depth ?? 0;
    if (depth > bestDepth) {
      bestDepth = depth;
      bestId = id;
    }
  }
  return bestId;
}

/** A brush's world center and the solid model that owns it. */
interface BrushPlacement {
  center: THREE.Vector3;
  solidModelId: string;
}

/**
 * Collects the world center of every brush under a scene root.
 *
 * @param worldObject Scene root to search.
 * @returns Brush placements.
 */
function collectBrushPlacements(worldObject: THREE.Object3D): BrushPlacement[] {
  const placements: BrushPlacement[] = [];
  for (const model of SolidModelRegistry.collectUnder(worldObject)) {
    collectModelBrushPlacements(model, placements);
  }
  return placements;
}

/**
 * Collects brush centers for one solid model.
 *
 * @param model Solid model to read.
 * @param placements Accumulator.
 */
function collectModelBrushPlacements(model: SolidModel, placements: BrushPlacement[]): void {
  for (const brush of model.getBrushes()) {
    if (!brush.mesh) continue;
    placements.push({
      center: brush.mesh.getWorldPosition(new THREE.Vector3()),
      solidModelId: model.root.uuid,
    });
  }
}
