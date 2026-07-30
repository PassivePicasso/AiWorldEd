import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { CommandStack } from '../../src/commands/command_stack.js';
import { ObjectActionHandler } from '../../src/managers/hierarchy/object_action_handler.js';
import { SelectionManager } from '../../src/selection/object/selection_manager.js';
import { GreyBoxRegistry } from '../../src/greybox/model/grey_box_registry.js';
import { isGreyBoxGroup } from '../../src/greybox/model/grey_box_group.js';
import { createGreyBoxMesh } from '../../src/greybox/model/grey_box_factory.js';
import { createContentBox } from './grey_box_fixture.js';

const COMMAND_STACK_LIMIT = 32;

describe('grouping grey boxes from the outliner', () => {
  let world: THREE.Group;
  let commandStack: CommandStack;
  let handler: ObjectActionHandler;
  let hall: THREE.Mesh;
  let store: THREE.Mesh;

  beforeEach(() => {
    world = new THREE.Group();
    commandStack = new CommandStack(COMMAND_STACK_LIMIT);
    handler = new ObjectActionHandler(world, commandStack, new SelectionManager());
    hall = createGreyBoxMesh('Hall', 8, 4, 8);
    store = createGreyBoxMesh('Store', 6, 4, 6);
    store.position.set(30, 0, 0);
    world.add(hall);
    world.add(store);
  });

  it('produces a grey box group rather than a plain group', () => {
    handler.groupObjects([hall, store]);
    const group = world.children.find((child) => child !== hall && child !== store)!;
    expect(isGreyBoxGroup(group)).toBe(true);
    expect(GreyBoxRegistry.get(group).id).toMatch(/^greybox-/);
  });

  it('names it in the grey box group sequence', () => {
    handler.groupObjects([hall, store]);
    expect(world.children.find((child) => isGreyBoxGroup(child))!.name).toBe('GreyBoxGroup001');
  });

  it('nests both volumes under the new group', () => {
    handler.groupObjects([hall, store]);
    const group = world.children.find((child) => isGreyBoxGroup(child))!;
    expect(hall.parent).toBe(group);
    expect(store.parent).toBe(group);
  });

  it('undoes back to the flat layout', () => {
    handler.groupObjects([hall, store]);
    commandStack.undo();
    expect(hall.parent).toBe(world);
    expect(world.children.some((child) => isGreyBoxGroup(child))).toBe(false);
  });

  it('falls back to a plain group for a mixed selection', () => {
    const prop = createContentBox('Prop', new THREE.Vector3(1, 1, 1));
    world.add(prop);
    handler.groupObjects([hall, prop]);
    const group = hall.parent!;
    expect(group).not.toBe(world);
    expect(isGreyBoxGroup(group)).toBe(false);
    expect(GreyBoxRegistry.has(group)).toBe(false);
  });
});
