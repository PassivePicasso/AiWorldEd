import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { applyOutlinerRename } from '../../src/managers/hierarchy/outliner_action_helpers.js';
import { CommandStack } from '../../src/commands/command_stack.js';
import { GreyBoxRegistry } from '../../src/greybox/model/grey_box_registry.js';
import { getGreyBoxId } from '../../src/greybox/model/grey_box_access.js';
import { allocateGreyBoxName } from '../../src/greybox/model/grey_box_naming.js';
import { createDefaultGreyBoxMesh } from '../../src/greybox/model/grey_box_factory.js';
import { setObjectLocked } from '../../src/utils/object_lock.js';

const COMMAND_STACK_LIMIT = 32;

describe('renaming a grey box through the outliner path', () => {
  let world: THREE.Group;
  let commandStack: CommandStack;
  let refreshCount: number;

  beforeEach(() => {
    world = new THREE.Group();
    commandStack = new CommandStack(COMMAND_STACK_LIMIT);
    refreshCount = 0;
  });

  it('renames the volume and refreshes the tree', () => {
    const mesh = addGreyBox(world);
    applyOutlinerRename(commandStack, mesh, 'HubRoom', () => refreshCount++);
    expect(mesh.name).toBe('HubRoom');
    expect(refreshCount).toBe(1);
  });

  it('undoes a rename', () => {
    const mesh = addGreyBox(world);
    const original = mesh.name;
    applyOutlinerRename(commandStack, mesh, 'HubRoom', () => refreshCount++);
    commandStack.undo();
    expect(mesh.name).toBe(original);
  });

  it('keeps the layout payload and id across a rename', () => {
    const mesh = addGreyBox(world);
    const id = getGreyBoxId(mesh);
    GreyBoxRegistry.get(mesh).description = 'central atrium';
    applyOutlinerRename(commandStack, mesh, 'Atrium', () => refreshCount++);
    expect(getGreyBoxId(mesh)).toBe(id);
    expect(GreyBoxRegistry.get(mesh).description).toBe('central atrium');
  });

  it('still resolves the volume by id after a rename', () => {
    const mesh = addGreyBox(world);
    const id = getGreyBoxId(mesh);
    applyOutlinerRename(commandStack, mesh, 'RenamedVolume', () => refreshCount++);
    expect(GreyBoxRegistry.findById(world, id)).toBe(mesh);
  });

  it('ignores a blank rename', () => {
    const mesh = addGreyBox(world);
    const original = mesh.name;
    applyOutlinerRename(commandStack, mesh, '   ', () => refreshCount++);
    expect(mesh.name).toBe(original);
    expect(commandStack.getUndoCount()).toBe(0);
  });

  it('refuses to rename a locked volume', () => {
    const mesh = addGreyBox(world);
    const original = mesh.name;
    setObjectLocked(mesh, true);
    applyOutlinerRename(commandStack, mesh, 'Blocked', () => refreshCount++);
    expect(mesh.name).toBe(original);
  });

  it('frees the auto name for reuse once a volume is renamed away from it', () => {
    const mesh = addGreyBox(world);
    expect(allocateGreyBoxName(world)).not.toBe(mesh.name);
    applyOutlinerRename(commandStack, mesh, 'HubRoom', () => refreshCount++);
    expect(allocateGreyBoxName(world)).toBe('GreyBox001');
  });
});

/**
 * Adds an auto-named grey box volume to a world.
 *
 * @param world World group receiving the volume.
 * @returns The added volume.
 */
function addGreyBox(world: THREE.Group): THREE.Mesh {
  const mesh = createDefaultGreyBoxMesh(allocateGreyBoxName(world));
  world.add(mesh);
  return mesh;
}
