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
import { SolidModel } from '../../../src/solid/model/solid_model.js';
import { SolidOperation } from '../../../src/solid/types/solid_operation.js';
import { GreyBoxRegistry } from '../../../src/greybox/model/grey_box_registry.js';
import { getGreyBoxDescription } from '../../../src/greybox/model/grey_box_access.js';
import { listGreyBoxConnections } from '../../../src/greybox/model/grey_box_connection_access.js';
import { computeGreyBoxWorldSize } from '../../../src/greybox/model/grey_box_volume.js';

const COMMAND_STACK_LIMIT = 64;

describe('EditorApi grey box tools', () => {
  let world: THREE.Group;
  let commandStack: CommandStack;
  let api: EditorApi;

  beforeEach(() => {
    world = new THREE.Group();
    commandStack = new CommandStack(COMMAND_STACK_LIMIT);
    api = new EditorApi(createTestHost(world, commandStack));
  });

  it('creates a grey box and reports its id', () => {
    const result = api.invokeTool('create_grey_box', {
      name: 'HubRoom',
      description: 'central atrium',
      center: { x: 0, y: 0, z: 0 },
      size: { x: 10, y: 6, z: 10 },
    });
    expect(result.ok).toBe(true);
    const greyBoxId = payload(result)['greyBoxId'] as string;
    expect(GreyBoxRegistry.findById(world, greyBoxId)).not.toBeNull();
  });

  it('auto-names a volume created without a name', () => {
    const result = api.invokeTool('create_grey_box', {});
    expect(payload(result)['name']).toBe('GreyBox001');
  });

  it('undoes a creation through the undo tool', () => {
    const greyBoxId = createVolume(api, 'Temp', { x: 0, y: 0, z: 0 });
    expect(api.invokeTool('undo').ok).toBe(true);
    expect(GreyBoxRegistry.findById(world, greyBoxId)).toBeNull();
  });

  it('lists created volumes with descriptions', () => {
    createVolume(api, 'Left', { x: 0, y: 0, z: 0 }, 'entry');
    createVolume(api, 'Right', { x: 10, y: 0, z: 0 }, 'corridor');
    const result = api.invokeTool('list_grey_boxes');
    const boxes = payload(result)['greyBoxes'] as Array<Record<string, unknown>>;
    expect(boxes.length).toBe(2);
    expect(boxes.map((box) => box['description'])).toContain('entry');
  });

  it('reports one volume with bounds, size, and connections', () => {
    const leftId = createVolume(api, 'Left', { x: 0, y: 0, z: 0 });
    createVolume(api, 'Right', { x: 10, y: 0, z: 0 });
    const result = api.invokeTool('get_grey_box', { greyBoxId: leftId });
    const data = payload(result);
    expect((data['size'] as Record<string, number>)['x']).toBeCloseTo(10);
    expect((data['connections'] as unknown[]).length).toBe(1);
  });

  it('reports occupancy so an empty volume is distinguishable', () => {
    const greyBoxId = createVolume(api, 'Empty', { x: 0, y: 0, z: 0 });
    const before = payload(api.invokeTool('get_grey_box', { greyBoxId }))['occupancy'] as Record<string, unknown>;
    expect(before['empty']).toBe(true);
    const model = new SolidModel('Inside');
    model.addBoxBrush(2, SolidOperation.Additive);
    world.add(model.root);
    const after = payload(api.invokeTool('get_grey_box', { greyBoxId }))['occupancy'] as Record<string, unknown>;
    expect(after['empty']).toBe(false);
    expect(after['brushCount']).toBe(1);
  });

  it('returns the whole graph with derived edges', () => {
    createVolume(api, 'Left', { x: 0, y: 0, z: 0 });
    createVolume(api, 'Right', { x: 10, y: 0, z: 0 });
    const data = payload(api.invokeTool('get_grey_box_graph'));
    const edges = data['edges'] as Array<Record<string, unknown>>;
    expect(edges.length).toBe(1);
    expect(edges[0]!['source']).toBe('derived');
    expect(edges[0]!['contact']).toBe('face');
    expect((edges[0]!['sharedFace'] as Record<string, number>)['area']).toBeCloseTo(100);
  });

  it('renames a volume and undoes the rename', () => {
    const greyBoxId = createVolume(api, 'Before', { x: 0, y: 0, z: 0 });
    expect(api.invokeTool('rename_grey_box', { greyBoxId, name: 'After' }).ok).toBe(true);
    expect(GreyBoxRegistry.findById(world, greyBoxId)!.name).toBe('After');
    api.invokeTool('undo');
    expect(GreyBoxRegistry.findById(world, greyBoxId)!.name).toBe('Before');
  });

  it('sets and clears a description', () => {
    const greyBoxId = createVolume(api, 'Room', { x: 0, y: 0, z: 0 });
    api.invokeTool('set_grey_box_description', { greyBoxId, description: 'ruined chapel' });
    const mesh = GreyBoxRegistry.findById(world, greyBoxId)!;
    expect(getGreyBoxDescription(mesh)).toBe('ruined chapel');
    expect(api.invokeTool('set_grey_box_description', { greyBoxId, description: '' }).ok).toBe(true);
    expect(getGreyBoxDescription(mesh)).toBe('');
  });

  it('moves and resizes a volume with undo', () => {
    const greyBoxId = createVolume(api, 'Room', { x: 0, y: 0, z: 0 });
    api.invokeTool('set_grey_box_transform', {
      greyBoxId,
      center: { x: 20, y: 0, z: 0 },
      size: { x: 20, y: 6, z: 10 },
    });
    const mesh = GreyBoxRegistry.findById(world, greyBoxId) as THREE.Mesh;
    expect(mesh.position.x).toBeCloseTo(20);
    expect(computeGreyBoxWorldSize(mesh).x).toBeCloseTo(20);
    api.invokeTool('undo');
    expect(mesh.position.x).toBeCloseTo(0);
  });

  it('deletes volumes and restores them with undo', () => {
    const greyBoxId = createVolume(api, 'Doomed', { x: 0, y: 0, z: 0 });
    expect(api.invokeTool('delete_grey_boxes', { greyBoxIds: [greyBoxId] }).ok).toBe(true);
    expect(GreyBoxRegistry.findById(world, greyBoxId)).toBeNull();
    api.invokeTool('undo');
    expect(GreyBoxRegistry.findById(world, greyBoxId)).not.toBeNull();
  });

  it('connects two volumes and reports the connection id', () => {
    const first = createVolume(api, 'Lower', { x: 0, y: 0, z: 0 });
    const second = createVolume(api, 'Upper', { x: 0, y: 40, z: 0 });
    const result = api.invokeTool('connect_grey_boxes', {
      greyBoxId: first,
      targetGreyBoxId: second,
      kind: 'elevator',
      note: 'keycard',
      direction: 'forward',
    });
    expect(result.ok).toBe(true);
    expect(payload(result)['connectionId']).toBeTruthy();
    const stored = listGreyBoxConnections(GreyBoxRegistry.findById(world, first)!)[0]!;
    expect(stored.kind).toBe('elevator');
    expect(stored.direction).toBe('forward');
  });

  it('surfaces the authored link in the graph', () => {
    const first = createVolume(api, 'Lower', { x: 0, y: 0, z: 0 });
    const second = createVolume(api, 'Upper', { x: 0, y: 40, z: 0 });
    api.invokeTool('connect_grey_boxes', { greyBoxId: first, targetGreyBoxId: second, kind: 'elevator' });
    const edges = payload(api.invokeTool('get_grey_box_graph'))['edges'] as Array<Record<string, unknown>>;
    const authored = edges.find((edge) => edge['source'] === 'authored')!;
    expect((authored['authoredLinks'] as Array<Record<string, unknown>>)[0]!['kind']).toBe('elevator');
  });

  it('removes an authored link by connection id', () => {
    const first = createVolume(api, 'Lower', { x: 0, y: 0, z: 0 });
    const second = createVolume(api, 'Upper', { x: 0, y: 40, z: 0 });
    const connectionId = payload(api.invokeTool('connect_grey_boxes', { greyBoxId: first, targetGreyBoxId: second }))[
      'connectionId'
    ] as string;
    expect(api.invokeTool('disconnect_grey_boxes', { greyBoxId: first, connectionId }).ok).toBe(true);
    expect(listGreyBoxConnections(GreyBoxRegistry.findById(world, first)!)).toEqual([]);
  });

  it('mutes a derived adjacency when given a target instead of a connection id', () => {
    const first = createVolume(api, 'Left', { x: 0, y: 0, z: 0 });
    const second = createVolume(api, 'Right', { x: 10, y: 0, z: 0 });
    expect(api.invokeTool('disconnect_grey_boxes', { greyBoxId: first, targetGreyBoxId: second }).ok).toBe(true);
    const data = payload(api.invokeTool('get_grey_box_graph'));
    expect((data['edges'] as unknown[]).length).toBe(0);
    expect((data['mutedAdjacencies'] as unknown[]).length).toBe(1);
  });

  it('prunes authored links when their target volume is deleted', () => {
    const first = createVolume(api, 'Left', { x: 0, y: 0, z: 0 });
    const second = createVolume(api, 'Right', { x: 40, y: 0, z: 0 });
    api.invokeTool('connect_grey_boxes', { greyBoxId: first, targetGreyBoxId: second });
    api.invokeTool('delete_grey_boxes', { greyBoxIds: [second] });
    const problems = payload(api.invokeTool('get_grey_box_graph'))['problems'] as unknown[];
    expect(problems.length).toBe(0);
  });

  it('fails clearly on an unknown volume id', () => {
    for (const tool of ['get_grey_box', 'rename_grey_box', 'set_grey_box_transform']) {
      const result = api.invokeTool(tool, { greyBoxId: 'greybox-missing', name: 'x' });
      expect(result.ok).toBe(false);
      expect(result.message).toContain('greybox-missing');
    }
  });

  it('fails when deleting an unknown volume', () => {
    const result = api.invokeTool('delete_grey_boxes', { greyBoxIds: ['greybox-missing'] });
    expect(result.ok).toBe(false);
    expect(result.message).toContain('greybox-missing');
  });

  it('refuses to connect a volume to itself', () => {
    const greyBoxId = createVolume(api, 'Only', { x: 0, y: 0, z: 0 });
    const result = api.invokeTool('connect_grey_boxes', { greyBoxId, targetGreyBoxId: greyBoxId });
    expect(result.ok).toBe(false);
    expect(result.message).toContain('itself');
  });

  it('fails when disconnecting with neither a connection id nor a target', () => {
    const greyBoxId = createVolume(api, 'Only', { x: 0, y: 0, z: 0 });
    const result = api.invokeTool('disconnect_grey_boxes', { greyBoxId });
    expect(result.ok).toBe(false);
    expect(result.message).toContain('connectionId');
  });

  it('fails when removing a connection id the volume does not own', () => {
    const greyBoxId = createVolume(api, 'Only', { x: 0, y: 0, z: 0 });
    const result = api.invokeTool('disconnect_grey_boxes', { greyBoxId, connectionId: 'greylink-missing' });
    expect(result.ok).toBe(false);
    expect(result.message).toContain('greylink-missing');
  });

  it('reports grey box count in the editor context', () => {
    createVolume(api, 'Room', { x: 0, y: 0, z: 0 });
    const data = payload(api.invokeTool('get_editor_context'));
    expect(data['greyBoxCount']).toBe(1);
  });

  it('includes grey boxes in the scene hierarchy', () => {
    const greyBoxId = createVolume(api, 'Room', { x: 0, y: 0, z: 0 });
    const data = payload(api.invokeTool('get_scene_hierarchy'));
    const greyBoxes = data['greyBoxes'] as Array<Record<string, unknown>>;
    expect(greyBoxes.length).toBe(1);
    expect(greyBoxes[0]!['greyBoxId']).toBe(greyBoxId);
  });
});

/**
 * Creates a volume through the MCP tool and returns its id.
 *
 * @param api Editor API under test.
 * @param name Volume name.
 * @param center World center.
 * @param description Optional description.
 * @returns New grey box id.
 */
function createVolume(
  api: EditorApi,
  name: string,
  center: { x: number; y: number; z: number },
  description?: string,
): string {
  const args: Record<string, unknown> = { name, center, size: { x: 10, y: 10, z: 10 } };
  if (description !== undefined) args['description'] = description;
  const result = api.invokeTool('create_grey_box', args);
  expect(result.ok).toBe(true);
  return payload(result)['greyBoxId'] as string;
}

/**
 * Reads the data payload of a tool result, failing the test when absent.
 *
 * @param result Tool result.
 * @returns Payload record.
 */
function payload(result: { ok: boolean; data?: unknown }): Record<string, unknown> {
  expect(result.ok).toBe(true);
  expect(result.data).toBeDefined();
  return result.data as Record<string, unknown>;
}

/**
 * Builds a minimal EditorApiHost for grey box tool tests.
 *
 * @param worldObject World group.
 * @param commandStack Command stack.
 * @returns Host bag.
 */
function createTestHost(worldObject: THREE.Group, commandStack: CommandStack): EditorApiHost {
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
