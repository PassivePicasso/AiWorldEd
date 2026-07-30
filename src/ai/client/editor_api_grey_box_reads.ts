import * as THREE from 'three';
import type { EditorApiHost } from './editor_api_host.js';
import type { McpToolResult } from '../shared/mcp_protocol_types.js';
import { GreyBoxRegistry } from '../../greybox/model/grey_box_registry.js';
import { buildGreyBoxSceneGraph } from '../../greybox/connectivity/grey_box_scene_graph.js';
import { computeGreyBoxGroupBounds } from '../../greybox/connectivity/grey_box_group_volume.js';
import type { GreyBoxMergedGraph, GreyBoxNodeKind } from '../../greybox/connectivity/grey_box_graph_types.js';
import { computeGreyBoxWorldBounds, computeGreyBoxWorldSize } from '../../greybox/model/grey_box_volume.js';
import { serializeGreyBoxGraph, serializeGreyBoxNode } from './grey_box_payloads.js';
import { GreyBoxOccupancyPayload, computeGreyBoxOccupancy, readGreyBoxOccupancy } from './grey_box_occupancy.js';

/**
 * Grey box read tools: the layout an agent builds against. A blockout is a
 * hierarchy, so every read reports where a volume sits in it. Reads never
 * mutate the scene.
 */
export class EditorApiGreyBoxReads {
  private readonly host: EditorApiHost;

  /**
   * Creates the grey box read API.
   *
   * @param host Injected editor systems.
   */
  constructor(host: EditorApiHost) {
    this.host = host;
  }

  /**
   * Lists every grey box with its identity, role, intent, and place in the
   * hierarchy.
   *
   * @returns Tool result with the volume list.
   */
  listGreyBoxes(): McpToolResult {
    const graph = buildGreyBoxSceneGraph(this.host.worldObject);
    const occupancy = this.occupancyFor(graph);
    const groupCount = graph.nodes.filter((node) => node.kind === 'group').length;
    const volumeCount = graph.nodes.length - groupCount;
    return {
      ok: true,
      message:
        `${volumeCount} grey box planning volume(s) in ${groupCount} group(s), ` +
        `${graph.tree.rootIds.length} outermost`,
      data: {
        greyBoxes: graph.nodes.map((node) => serializeGreyBoxNode(node, graph, occupancy)),
        count: volumeCount,
        groupCount,
      },
    };
  }

  /**
   * Returns one grey box in full: role, intent, children, relations, and what
   * has already been built inside it.
   *
   * @param greyBoxId Id of the volume to read.
   * @returns Tool result with the volume detail.
   */
  getGreyBox(greyBoxId: string): McpToolResult {
    const graph = buildGreyBoxSceneGraph(this.host.worldObject);
    const node = graph.nodes.find((candidate) => candidate.id === greyBoxId);
    if (!node) return { ok: false, message: `Unknown greyBoxId: ${greyBoxId}` };
    const occupancy = this.occupancyFor(graph);
    const built = readGreyBoxOccupancy(occupancy, greyBoxId);
    return {
      ok: true,
      message: describeVolume(node.kind, node.name, built),
      data: {
        greyBox: serializeGreyBoxNode(node, graph, occupancy),
        ...this.extentFor(greyBoxId),
        connections: serializeGreyBoxGraph(graph, occupancy, greyBoxId).edges,
        occupancy: built,
      },
    };
  }

  /**
   * Reports a grey box's world extent. A volume measures its own geometry; a
   * group has none, so it reports the bounds of everything it holds and an
   * empty group reports nothing.
   *
   * @param greyBoxId Grey box to measure.
   * @returns Bounds and size payload fields.
   */
  private extentFor(greyBoxId: string): { bounds: BoundsPayload | null; size: VectorPayload | null } {
    const object = GreyBoxRegistry.findById(this.host.worldObject, greyBoxId);
    if (object instanceof THREE.Mesh) {
      return {
        bounds: boundsPayload(computeGreyBoxWorldBounds(object)),
        size: vectorPayload(computeGreyBoxWorldSize(object)),
      };
    }
    const bounds = object ? computeGreyBoxGroupBounds(object) : null;
    if (!bounds) return { bounds: null, size: null };
    return { bounds: boundsPayload(bounds), size: vectorPayload(bounds.getSize(new THREE.Vector3())) };
  }

  /**
   * Returns the whole merged layout graph: hierarchy, relations, and build
   * order.
   *
   * @returns Tool result with the layout brief.
   */
  getGreyBoxGraph(): McpToolResult {
    const graph = buildGreyBoxSceneGraph(this.host.worldObject);
    const problemNote = graph.problems.length > 0 ? `, ${graph.problems.length} unresolved link(s)` : '';
    return {
      ok: true,
      message:
        `${graph.nodes.length} volume(s) in ${graph.tree.rootIds.length} outermost space(s), ` +
        `${graph.edges.length} relation(s)${problemNote}`,
      data: serializeGreyBoxGraph(graph, this.occupancyFor(graph), null),
    };
  }

  /**
   * Computes occupancy for a graph.
   *
   * @param graph Merged layout graph.
   * @returns Occupancy per grey box id.
   */
  private occupancyFor(graph: GreyBoxMergedGraph): Map<string, GreyBoxOccupancyPayload> {
    return computeGreyBoxOccupancy(this.host.worldObject, graph);
  }
}

/** World bounds as an MCP payload. */
interface BoundsPayload {
  min: VectorPayload;
  max: VectorPayload;
}

/** A vector as an MCP payload. */
interface VectorPayload {
  x: number;
  y: number;
  z: number;
}

/**
 * Builds a one-line summary of what a grey box holds.
 *
 * @param kind Whether this is a volume or a group.
 * @param name Grey box name.
 * @param built Occupancy for the grey box.
 * @returns Human-readable summary.
 */
function describeVolume(kind: GreyBoxNodeKind, name: string, built: GreyBoxOccupancyPayload): string {
  const label = kind === 'group' ? 'Grey box group' : 'Grey box';
  if (built.empty) return `${label} "${name}" is empty and ready to build in`;
  return `${label} "${name}" holds ${built.subtreeBrushCount} brush(es) including nested volumes`;
}

/**
 * Converts world bounds into an MCP payload.
 *
 * @param bounds World bounds.
 * @returns Min and max corners.
 */
function boundsPayload(bounds: THREE.Box3): BoundsPayload {
  return { min: vectorPayload(bounds.min), max: vectorPayload(bounds.max) };
}

/**
 * Converts a vector into an MCP payload.
 *
 * @param vector Source vector.
 * @returns Plain coordinate object.
 */
function vectorPayload(vector: THREE.Vector3): VectorPayload {
  return { x: vector.x, y: vector.y, z: vector.z };
}
