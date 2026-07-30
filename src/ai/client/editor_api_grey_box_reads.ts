import * as THREE from 'three';
import type { EditorApiHost } from './editor_api_host.js';
import type { McpToolResult } from '../shared/mcp_protocol_types.js';
import { GreyBoxRegistry } from '../../greybox/model/grey_box_registry.js';
import { buildGreyBoxSceneGraph } from '../../greybox/connectivity/grey_box_scene_graph.js';
import type { GreyBoxMergedGraph } from '../../greybox/connectivity/grey_box_graph_types.js';
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
    return {
      ok: true,
      message: `${graph.nodes.length} grey box planning volume(s), ${graph.tree.rootIds.length} outermost`,
      data: {
        greyBoxes: graph.nodes.map((node) => serializeGreyBoxNode(node, graph, occupancy)),
        count: graph.nodes.length,
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
    const mesh = this.findGreyBoxMesh(greyBoxId);
    if (!mesh) return { ok: false, message: `Unknown greyBoxId: ${greyBoxId}` };
    const graph = buildGreyBoxSceneGraph(this.host.worldObject);
    const node = graph.nodes.find((candidate) => candidate.id === greyBoxId);
    if (!node) return { ok: false, message: `Unknown greyBoxId: ${greyBoxId}` };
    const occupancy = this.occupancyFor(graph);
    const built = readGreyBoxOccupancy(occupancy, greyBoxId);
    return {
      ok: true,
      message: describeVolume(node.name, built),
      data: {
        greyBox: serializeGreyBoxNode(node, graph, occupancy),
        bounds: boundsPayload(computeGreyBoxWorldBounds(mesh)),
        size: vectorPayload(computeGreyBoxWorldSize(mesh)),
        connections: serializeGreyBoxGraph(graph, occupancy, greyBoxId).edges,
        occupancy: built,
      },
    };
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

  /**
   * Resolves a grey box id to its mesh.
   *
   * @param greyBoxId Id to resolve.
   * @returns Grey box mesh, or null when absent.
   */
  private findGreyBoxMesh(greyBoxId: string): THREE.Mesh | null {
    const found = GreyBoxRegistry.findById(this.host.worldObject, greyBoxId);
    if (!found || !(found instanceof THREE.Mesh)) return null;
    return found;
  }
}

/**
 * Builds a one-line summary of what a volume holds.
 *
 * @param name Volume name.
 * @param built Occupancy for the volume.
 * @returns Human-readable summary.
 */
function describeVolume(name: string, built: GreyBoxOccupancyPayload): string {
  if (built.empty) return `Grey box "${name}" is empty and ready to build in`;
  return `Grey box "${name}" holds ${built.subtreeBrushCount} brush(es) including nested volumes`;
}

/**
 * Converts world bounds into an MCP payload.
 *
 * @param bounds World bounds.
 * @returns Min and max corners.
 */
function boundsPayload(bounds: THREE.Box3): {
  min: { x: number; y: number; z: number };
  max: { x: number; y: number; z: number };
} {
  return { min: vectorPayload(bounds.min), max: vectorPayload(bounds.max) };
}

/**
 * Converts a vector into an MCP payload.
 *
 * @param vector Source vector.
 * @returns Plain coordinate object.
 */
function vectorPayload(vector: THREE.Vector3): { x: number; y: number; z: number } {
  return { x: vector.x, y: vector.y, z: vector.z };
}
