import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { EditorApi } from '../../../src/ai/client/editor_api.js';
import type { EditorApiHost } from '../../../src/ai/client/editor_api_host.js';
import { CommandStack } from '../../../src/commands/command_stack.js';
import { SelectionManager } from '../../../src/selection/object/selection_manager.js';
import { SolidModelController } from '../../../src/managers/solid/solid_model_controller.js';
import { SolidModelPanel } from '../../../src/ui/solid_model_panel.js';
import { GridSnap } from '../../../src/transform/snap/grid_snap.js';
import { SnapManager } from '../../../src/transform/snap/snap_manager.js';
import { buildExportScene } from '../../../src/io/export_scene_builder.js';
import { GreyBoxRegistry } from '../../../src/greybox/model/grey_box_registry.js';

const COMMAND_STACK_LIMIT = 256;

/**
 * Blocks out the sprint's reference layout and then builds inside it the way an
 * agent would: read the brief, follow the build order, honour the fixity
 * contract. Exercises the whole path in one test rather than each layer alone.
 */
describe('grey box end to end: block out a hall, then build in it', () => {
  let world: THREE.Group;
  let api: EditorApi;

  beforeEach(() => {
    world = new THREE.Group();
    api = new EditorApi(createHost(world));
  });

  it('reads a nested layout and builds it outside in', () => {
    const layout = blockOutReferenceLayout(api);
    const brief = readBrief(api);

    expect(brief.rootGreyBoxIds).toEqual([layout.hall]);
    expect(brief.buildOrder[0]).toBe(layout.hall);
    expect(new Set(brief.buildOrder)).toEqual(new Set(Object.values(layout)));

    const hallNode = nodeFor(brief, layout.hall);
    expect((hallNode['childGreyBoxIds'] as string[]).length).toBe(3);
    expect(hallNode['sizeIntent']).toBe('exact');
    expect((hallNode['surface'] as Record<string, string>)['floor']).toBe('cracked flagstone');
    expect(nodeFor(brief, layout.chasm)['sizeIntent']).toBe('approximate');
    expect(nodeFor(brief, layout.chasm)['depth']).toBe(1);

    const builtIds = buildFromBrief(api, brief);
    expect(builtIds.length).toBe(brief.buildOrder.length);

    const after = readBrief(api);
    for (const id of Object.values(layout)) {
      expect(nodeFor(after, id)['empty'], id).toBe(false);
    }
    expect(nodeFor(after, layout.hall)['subtreeBrushCount'] as number).toBeGreaterThan(
      nodeFor(after, layout.hall)['ownBrushCount'] as number,
    );
  });

  it('attributes each brush to the volume it was built in', () => {
    const layout = blockOutReferenceLayout(api);
    buildFromBrief(api, readBrief(api));
    const brief = readBrief(api);
    expect(nodeFor(brief, layout.chasm)['ownBrushCount'] as number).toBeGreaterThan(0);
    expect(nodeFor(brief, layout.span)['ownBrushCount'] as number).toBeGreaterThan(0);
  });

  it('reports the bridge as nested in the hall with a shared face to the ledge', () => {
    const layout = blockOutReferenceLayout(api);
    const brief = readBrief(api);
    const containment = brief.edges.find(
      (edge) => edge.containment?.childGreyBoxId === layout.span && edge.containment?.parentGreyBoxId === layout.hall,
    );
    expect(containment).toBeDefined();
    const ledgeEdge = brief.edges.find(
      (edge) => edge.greyBoxIds.includes(layout.span) && edge.greyBoxIds.includes(layout.ledge),
    );
    expect(ledgeEdge?.relations).toContain('adjacent');
    expect(ledgeEdge?.sharedFace).not.toBeNull();
  });

  it('keeps the blocked-out volumes out of the export after building', () => {
    const layout = blockOutReferenceLayout(api);
    buildFromBrief(api, readBrief(api));
    const exportRoot = buildExportScene(world);
    const exportedNames: string[] = [];
    exportRoot.traverse((object) => exportedNames.push(object.name));
    for (const id of Object.values(layout)) {
      const volume = GreyBoxRegistry.findById(world, id)!;
      expect(exportedNames, volume.name).not.toContain(volume.name);
    }
    expect(exportedNames.length).toBeGreaterThan(0);
  });

  it('leaves the layout unchanged when the agent work is undone', () => {
    blockOutReferenceLayout(api);
    const before = readBrief(api);
    const undoCountBeforeBuild = readUndoCount(api);
    buildFromBrief(api, before);
    while (readUndoCount(api) > undoCountBeforeBuild) {
      expect(api.invokeTool('undo').ok).toBe(true);
    }
    const after = readBrief(api);
    expect(after.greyBoxes.length).toBe(before.greyBoxes.length);
    expect(after.buildOrder).toEqual(before.buildOrder);
    for (const node of after.greyBoxes) {
      expect(node['empty'], String(node['greyBoxId'])).toBe(true);
    }
  });
});

/** Ids of the reference layout's volumes. */
interface ReferenceLayout {
  hall: string;
  chasm: string;
  span: string;
  ledge: string;
}

/** Shape of the layout brief this test reads. */
interface Brief {
  greyBoxes: Array<Record<string, unknown>>;
  rootGreyBoxIds: string[];
  buildOrder: string[];
  edges: Array<{
    greyBoxIds: string[];
    relations: string[];
    containment: { parentGreyBoxId: string; childGreyBoxId: string; ratio: number } | null;
    sharedFace: unknown;
  }>;
}

/**
 * Blocks out a hall with a chasm through it, a bridge across, and a ledge at
 * the far end — the sprint's reference layout — through the MCP tools.
 *
 * @param api Editor API standing in for an agent's MCP session.
 * @returns Ids of the created volumes.
 */
function blockOutReferenceLayout(api: EditorApi): ReferenceLayout {
  const hall = createVolume(api, 'great_hall', 'room', { x: 0, y: 0, z: 0 }, { x: 40, y: 20, z: 20 });
  const chasm = createVolume(api, 'chasm', 'ravine', { x: 0, y: -6, z: 0 }, { x: 12, y: 8, z: 20 });
  const span = createVolume(api, 'span', 'bridge', { x: 0, y: -2, z: 0 }, { x: 14, y: 1, z: 4 });
  const ledge = createVolume(api, 'east_ledge', 'ledge', { x: 8.5, y: -2, z: 0 }, { x: 3, y: 1, z: 4 });
  api.invokeTool('set_grey_box_intent', {
    greyBoxId: hall,
    sizeIntent: 'exact',
    surface: { floor: 'cracked flagstone', wall: 'soot-stained brick', mood: 'cold, cavernous' },
  });
  api.invokeTool('set_grey_box_intent', { greyBoxId: span, sizeIntent: 'exact' });
  api.invokeTool('set_grey_box_intent', { greyBoxId: ledge, sizeIntent: 'exact' });
  api.invokeTool('set_grey_box_description', { greyBoxId: chasm, description: 'Splits the hall floor.' });
  return { hall, chasm, span, ledge };
}

/**
 * Creates one volume through MCP and returns its id.
 *
 * @param api Editor API.
 * @param name Volume name.
 * @param role Gameplay role.
 * @param center World center.
 * @param size World size.
 * @returns New grey box id.
 */
function createVolume(
  api: EditorApi,
  name: string,
  role: string,
  center: { x: number; y: number; z: number },
  size: { x: number; y: number; z: number },
): string {
  const result = api.invokeTool('create_grey_box', { name, role, center, size });
  expect(result.ok, result.message).toBe(true);
  return (result.data as Record<string, unknown>)['greyBoxId'] as string;
}

/**
 * Reads the layout brief.
 *
 * @param api Editor API.
 * @returns Parsed brief.
 */
function readBrief(api: EditorApi): Brief {
  const result = api.invokeTool('get_grey_box_graph');
  expect(result.ok, result.message).toBe(true);
  return result.data as unknown as Brief;
}

/**
 * Finds one node in a brief.
 *
 * @param brief Layout brief.
 * @param greyBoxId Volume to look up.
 * @returns The node record.
 */
function nodeFor(brief: Brief, greyBoxId: string): Record<string, unknown> {
  const node = brief.greyBoxes.find((candidate) => candidate['greyBoxId'] === greyBoxId);
  expect(node, greyBoxId).toBeDefined();
  return node!;
}

/**
 * Builds geometry inside every volume, in the order the brief suggests, sizing
 * each brush to the volume it belongs to — what an agent does with the brief.
 *
 * @param api Editor API.
 * @param brief Layout brief to follow.
 * @returns Ids of the volumes built in.
 */
function buildFromBrief(api: EditorApi, brief: Brief): string[] {
  const built: string[] = [];
  for (const greyBoxId of brief.buildOrder) {
    const detail = api.invokeTool('get_grey_box', { greyBoxId });
    expect(detail.ok, detail.message).toBe(true);
    const data = detail.data as Record<string, unknown>;
    const size = data['size'] as { x: number; y: number; z: number };
    const node = data['greyBox'] as Record<string, unknown>;
    const center = node['center'] as { x: number; y: number; z: number };
    const created = api.invokeTool('create_solid_model', { name: `${node['name']}_geometry` });
    expect(created.ok, created.message).toBe(true);
    const modelId = (created.data as Record<string, unknown>)['modelId'] as string;
    const added = api.invokeTool('add_box_brush', {
      modelId,
      position: center,
      size: { x: Math.max(size.x - 1, 1), y: Math.max(size.y - 1, 1), z: Math.max(size.z - 1, 1) },
      operation: 'additive',
      exact: true,
    });
    expect(added.ok, added.message).toBe(true);
    built.push(greyBoxId);
  }
  return built;
}

/**
 * Reads the editor's undo depth, so the test can rewind exactly the agent's
 * work without assuming how many commands each build step costs.
 *
 * @param api Editor API.
 * @returns Current undo count.
 */
function readUndoCount(api: EditorApi): number {
  const result = api.invokeTool('get_editor_context');
  expect(result.ok, result.message).toBe(true);
  return (result.data as Record<string, unknown>)['undoCount'] as number;
}

/**
 * Builds a host wired to a real command stack and controller.
 *
 * @param worldObject World group the session edits.
 * @returns Host bag.
 */
function createHost(worldObject: THREE.Group): EditorApiHost {
  const commandStack = new CommandStack(COMMAND_STACK_LIMIT);
  const selectionManager = new SelectionManager();
  const panel = new SolidModelPanel(document.createElement('div'), { onAddBoxBrush: () => undefined });
  return {
    worldObject,
    commandStack,
    selectionManager,
    solidModelController: new SolidModelController(worldObject, commandStack, selectionManager, panel),
    gridSnap: new GridSnap(true, 0.25),
    snapManager: new SnapManager(0.25),
    getUserSnapEnabled: () => true,
    refreshAfterWorldMutation: () => undefined,
    refreshOutliner: () => undefined,
    showStatus: () => undefined,
  };
}
