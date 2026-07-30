import * as THREE from 'three';
import type { EditorApiHost } from './editor_api_host.js';
import type { McpToolResult } from '../shared/mcp_protocol_types.js';
import { GreyBoxRegistry } from '../../greybox/model/grey_box_registry.js';
import { buildGreyBoxSceneGraph } from '../../greybox/connectivity/grey_box_scene_graph.js';
import { computeGreyBoxWorldBounds, computeGreyBoxWorldSize } from '../../greybox/model/grey_box_volume.js';
import { serializeGreyBoxGraph, serializeGreyBoxNode } from './grey_box_payloads.js';
import { computeGreyBoxOccupancy, readGreyBoxOccupancy } from './grey_box_occupancy.js';

/**
 * Grey box read tools: the layout an agent builds against. Reads never mutate
 * the scene.
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
   * Lists every grey box with its identity, description, and volume.
   *
   * @returns Tool result with the volume list.
   */
  listGreyBoxes(): McpToolResult {
    const graph = buildGreyBoxSceneGraph(this.host.worldObject);
    return {
      ok: true,
      message: `${graph.nodes.length} grey box planning volume(s)`,
      data: {
        greyBoxes: graph.nodes.map((node) => serializeGreyBoxNode(node)),
        count: graph.nodes.length,
      },
    };
  }

  /**
   * Returns one grey box in full, including its connections and what already
   * occupies it.
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
    const occupancy = readGreyBoxOccupancy(computeGreyBoxOccupancy(this.host.worldObject, graph), greyBoxId);
    return {
      ok: true,
      message: occupancy.empty
        ? `Grey box "${node.name}" is empty and ready to build in`
        : `Grey box "${node.name}" already holds ${occupancy.subtreeBrushCount} brush(es) in its subtree`,
      data: {
        greyBox: serializeGreyBoxNode(node),
        bounds: boundsPayload(computeGreyBoxWorldBounds(mesh)),
        size: vectorPayload(computeGreyBoxWorldSize(mesh)),
        connections: serializeGreyBoxGraph(graph, greyBoxId).edges,
        occupancy,
      },
    };
  }

  /**
   * Returns the whole merged layout graph.
   *
   * @returns Tool result with nodes, edges, mutes, and problems.
   */
  getGreyBoxGraph(): McpToolResult {
    const graph = buildGreyBoxSceneGraph(this.host.worldObject);
    const problemNote = graph.problems.length > 0 ? `, ${graph.problems.length} unresolved link(s)` : '';
    return {
      ok: true,
      message: `${graph.nodes.length} volume(s), ${graph.edges.length} connection(s)${problemNote}`,
      data: serializeGreyBoxGraph(graph, null),
    };
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
