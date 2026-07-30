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
import { GreyBoxRegistry } from '../../../src/greybox/model/grey_box_registry.js';
import { isGreyBoxGroup } from '../../../src/greybox/model/grey_box_group.js';

const COMMAND_STACK_LIMIT = 64;

describe('EditorApi grey box grouping tools', () => {
  let world: THREE.Group;
  let api: EditorApi;

  beforeEach(() => {
    world = new THREE.Group();
    api = new EditorApi(createTestHost(world, new CommandStack(COMMAND_STACK_LIMIT)));
  });

  it('creates an empty group and reports its id', () => {
    const result = api.invokeTool('create_grey_box_group', { name: 'Ground Floor' });
    expect(result.ok).toBe(true);
    const group = GreyBoxRegistry.findById(world, payload(result)['greyBoxId'] as string);
    expect(group).not.toBeNull();
    expect(isGreyBoxGroup(group!)).toBe(true);
  });

  it('auto-names a group created without a name', () => {
    expect(payload(api.invokeTool('create_grey_box_group', {}))['name']).toBe('GreyBoxGroup001');
  });

  it('moves volumes into the group as one undo step', () => {
    const hall = createVolume(api, 'Hall', { x: 0, y: 0, z: 0 });
    const store = createVolume(api, 'Store', { x: 40, y: 0, z: 0 });
    const groupId = createGroup(api, 'Ground Floor', [hall, store]);

    expect(parentIdOf(world, hall)).toBe(groupId);
    expect(parentIdOf(world, store)).toBe(groupId);
    api.invokeTool('undo');
    expect(GreyBoxRegistry.findById(world, groupId)).toBeNull();
    expect(GreyBoxRegistry.findById(world, hall)!.parent).toBe(world);
  });

  it('reports the group as a container node in the layout reads', () => {
    const hall = createVolume(api, 'Hall', { x: 0, y: 0, z: 0 });
    const groupId = createGroup(api, 'Ground Floor', [hall]);
    const boxes = payload(api.invokeTool('list_grey_boxes'))['greyBoxes'] as Array<Record<string, unknown>>;
    const group = boxes.find((box) => box['greyBoxId'] === groupId)!;
    expect(group['kind']).toBe('group');
    expect(group['childGreyBoxIds']).toEqual([hall]);
    expect(boxes.find((box) => box['greyBoxId'] === hall)!['kind']).toBe('volume');
  });

  it('counts volumes and groups separately when listing', () => {
    createGroup(api, 'Ground Floor', [createVolume(api, 'Hall', { x: 0, y: 0, z: 0 })]);
    const data = payload(api.invokeTool('list_grey_boxes'));
    expect(data['count']).toBe(1);
    expect(data['groupCount']).toBe(1);
  });

  it('leaves the group out of the grey box count in the editor context', () => {
    createGroup(api, 'Ground Floor', [createVolume(api, 'Hall', { x: 0, y: 0, z: 0 })]);
    expect(payload(api.invokeTool('get_editor_context'))['greyBoxCount']).toBe(1);
  });

  it('nests the scene hierarchy the way the outliner does', () => {
    const hall = createVolume(api, 'Hall', { x: 0, y: 0, z: 0 });
    const groupId = createGroup(api, 'Ground Floor', [hall]);
    const nodes = payload(api.invokeTool('get_scene_hierarchy'))['greyBoxes'] as Array<Record<string, unknown>>;
    expect(nodes.length).toBe(1);
    expect(nodes[0]!['greyBoxId']).toBe(groupId);
    expect(nodes[0]!['kind']).toBe('grey_box_group');
    const children = nodes[0]!['children'] as Array<Record<string, unknown>>;
    expect(children.map((child) => child['greyBoxId'])).toEqual([hall]);
  });

  it('creates a volume directly inside a group, in world coordinates', () => {
    const groupId = createGroup(api, 'Ground Floor', []);
    const hall = createVolume(api, 'Hall', { x: 12, y: 0, z: 0 }, groupId);
    expect(parentIdOf(world, hall)).toBe(groupId);
    expect(GreyBoxRegistry.findById(world, hall)!.getWorldPosition(new THREE.Vector3()).x).toBeCloseTo(12);
  });

  it('reparents volumes into and back out of a group', () => {
    const hall = createVolume(api, 'Hall', { x: 0, y: 0, z: 0 });
    const groupId = createGroup(api, 'Ground Floor', []);
    expect(api.invokeTool('reparent_grey_boxes', { greyBoxIds: [hall], parentGreyBoxId: groupId }).ok).toBe(true);
    expect(parentIdOf(world, hall)).toBe(groupId);
    expect(api.invokeTool('reparent_grey_boxes', { greyBoxIds: [hall] }).ok).toBe(true);
    expect(GreyBoxRegistry.findById(world, hall)!.parent).toBe(world);
  });

  it('states an authored parent when a volume is reparented into another volume', () => {
    const ravine = createVolume(api, 'Ravine', { x: 0, y: 0, z: 0 });
    const bridge = createVolume(api, 'Bridge', { x: 200, y: 0, z: 0 });
    api.invokeTool('reparent_grey_boxes', { greyBoxIds: [bridge], parentGreyBoxId: ravine });
    const boxes = payload(api.invokeTool('list_grey_boxes'))['greyBoxes'] as Array<Record<string, unknown>>;
    const node = boxes.find((box) => box['greyBoxId'] === bridge)!;
    expect(node['parentGreyBoxId']).toBe(ravine);
    expect(node['authoredParent']).toBe(true);
  });

  it('refuses a move that would nest a grey box in itself', () => {
    const outer = createGroup(api, 'Outer', []);
    const inner = createGroup(api, 'Inner', []);
    api.invokeTool('reparent_grey_boxes', { greyBoxIds: [inner], parentGreyBoxId: outer });
    const result = api.invokeTool('reparent_grey_boxes', { greyBoxIds: [outer], parentGreyBoxId: inner });
    expect(result.ok).toBe(false);
    expect(result.message).toContain('itself');
  });

  it('dissolves a group and leaves its volumes in place', () => {
    const hall = createVolume(api, 'Hall', { x: 0, y: 0, z: 0 });
    const groupId = createGroup(api, 'Ground Floor', [hall]);
    expect(api.invokeTool('ungroup_grey_box_groups', { greyBoxIds: [groupId] }).ok).toBe(true);
    expect(GreyBoxRegistry.findById(world, groupId)).toBeNull();
    expect(GreyBoxRegistry.findById(world, hall)!.parent).toBe(world);
  });

  it('refuses to ungroup a volume', () => {
    const hall = createVolume(api, 'Hall', { x: 0, y: 0, z: 0 });
    const result = api.invokeTool('ungroup_grey_box_groups', { greyBoxIds: [hall] });
    expect(result.ok).toBe(false);
    expect(result.message).toContain('Hall');
  });

  it('deletes a group with everything inside it, and restores it on undo', () => {
    const hall = createVolume(api, 'Hall', { x: 0, y: 0, z: 0 });
    const groupId = createGroup(api, 'Ground Floor', [hall]);
    expect(api.invokeTool('delete_grey_boxes', { greyBoxIds: [groupId] }).ok).toBe(true);
    expect(GreyBoxRegistry.findById(world, hall)).toBeNull();
    api.invokeTool('undo');
    expect(parentIdOf(world, hall)).toBe(groupId);
  });

  it('reports an unknown parent rather than silently using the world root', () => {
    const result = api.invokeTool('create_grey_box', { name: 'Hall', parentGreyBoxId: 'greybox-missing' });
    expect(result.ok).toBe(false);
    expect(result.message).toContain('greybox-missing');
  });

  it('names every unknown id when a batch does not resolve', () => {
    const result = api.invokeTool('reparent_grey_boxes', { greyBoxIds: ['greybox-a', 'greybox-b'] });
    expect(result.ok).toBe(false);
    expect(result.message).toContain('greybox-a');
    expect(result.message).toContain('greybox-b');
  });
});

/**
 * Reads the grey box id of an object's parent.
 *
 * @param world World to search.
 * @param greyBoxId Child to look up.
 * @returns Parent grey box id, or null when the parent is not a grey box.
 */
function parentIdOf(world: THREE.Object3D, greyBoxId: string): string | null {
  const parent = GreyBoxRegistry.findById(world, greyBoxId)?.parent;
  if (!parent) return null;
  return GreyBoxRegistry.tryGet(parent)?.id ?? null;
}

/**
 * Creates a grey box group through the MCP tool and returns its id.
 *
 * @param api Editor API under test.
 * @param name Group name.
 * @param greyBoxIds Volumes moved into the group.
 * @returns New group id.
 */
function createGroup(api: EditorApi, name: string, greyBoxIds: string[]): string {
  const result = api.invokeTool('create_grey_box_group', { name, greyBoxIds });
  expect(result.ok).toBe(true);
  return payload(result)['greyBoxId'] as string;
}

/**
 * Creates a volume through the MCP tool and returns its id.
 *
 * @param api Editor API under test.
 * @param name Volume name.
 * @param center World center.
 * @param parentGreyBoxId Optional grey box to create it under.
 * @returns New grey box id.
 */
function createVolume(
  api: EditorApi,
  name: string,
  center: { x: number; y: number; z: number },
  parentGreyBoxId?: string,
): string {
  const args: Record<string, unknown> = { name, center, size: { x: 10, y: 10, z: 10 } };
  if (parentGreyBoxId !== undefined) args['parentGreyBoxId'] = parentGreyBoxId;
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
 * Builds a minimal EditorApiHost for grey box grouping tests.
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
