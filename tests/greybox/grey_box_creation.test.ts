import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { GreyBoxCreationHandler } from '../../src/managers/creation/grey_box_creation_handler.js';
import { CommandStack } from '../../src/commands/command_stack.js';
import { SelectionManager } from '../../src/selection/object/selection_manager.js';
import { GreyBoxRegistry } from '../../src/greybox/model/grey_box_registry.js';
import { isGreyBox } from '../../src/greybox/model/grey_box_keys.js';
import { getGreyBoxDescription } from '../../src/greybox/model/grey_box_access.js';
import { isGreyBoxOutline } from '../../src/greybox/model/grey_box_visual.js';
import { isSpawnRaycastMesh } from '../../src/navigation/object_spawn_placement.js';
import { computeGreyBoxWorldSize } from '../../src/greybox/model/grey_box_volume.js';
import { DEFAULT_GREY_BOX_SIZE } from '../../src/greybox/model/grey_box_factory.js';

const COMMAND_STACK_LIMIT = 32;

describe('GreyBoxCreationHandler', () => {
  let world: THREE.Group;
  let commandStack: CommandStack;
  let selectionManager: SelectionManager;
  let handler: GreyBoxCreationHandler;

  beforeEach(() => {
    world = new THREE.Group();
    commandStack = new CommandStack(COMMAND_STACK_LIMIT);
    selectionManager = new SelectionManager();
    handler = new GreyBoxCreationHandler(world, commandStack, selectionManager);
  });

  it('adds a registered grey box to the world', () => {
    const mesh = handler.createGreyBox();
    expect(mesh.parent).toBe(world);
    expect(isGreyBox(mesh)).toBe(true);
    expect(GreyBoxRegistry.has(mesh)).toBe(true);
  });

  it('starts a new volume with an empty description', () => {
    const mesh = handler.createGreyBox();
    expect(getGreyBoxDescription(mesh)).toBe('');
  });

  it('selects the new volume', () => {
    const mesh = handler.createGreyBox();
    expect(selectionManager.getSelectedObjects()).toContain(mesh);
  });

  it('gives each new volume a unique name', () => {
    const names = [handler.createGreyBox().name, handler.createGreyBox().name, handler.createGreyBox().name];
    expect(new Set(names).size).toBe(names.length);
  });

  it('creates a cubic volume at the default size', () => {
    const mesh = handler.createGreyBox();
    const worldSize = computeGreyBoxWorldSize(mesh);
    expect(worldSize.x).toBeCloseTo(DEFAULT_GREY_BOX_SIZE);
    expect(worldSize.y).toBeCloseTo(DEFAULT_GREY_BOX_SIZE);
    expect(worldSize.z).toBeCloseTo(DEFAULT_GREY_BOX_SIZE);
  });

  it('attaches an outline child so the volume reads as a wireframe', () => {
    const mesh = handler.createGreyBox();
    expect(mesh.children.some((child) => isGreyBoxOutline(child))).toBe(true);
  });

  it('undoes creation by detaching the volume', () => {
    const mesh = handler.createGreyBox();
    commandStack.undo();
    expect(mesh.parent).toBeNull();
    expect(world.children).not.toContain(mesh);
  });

  it('redoes creation with the same volume and payload', () => {
    const mesh = handler.createGreyBox();
    const dataBefore = GreyBoxRegistry.get(mesh);
    commandStack.undo();
    commandStack.redo();
    expect(mesh.parent).toBe(world);
    expect(GreyBoxRegistry.get(mesh)).toBe(dataBefore);
  });

  it('keeps the description written before an undo through a redo', () => {
    const mesh = handler.createGreyBox();
    GreyBoxRegistry.get(mesh).description = 'entry hall';
    commandStack.undo();
    commandStack.redo();
    expect(getGreyBoxDescription(mesh)).toBe('entry hall');
  });

  it('places the volume at the origin when no camera is available', () => {
    const mesh = handler.createGreyBox();
    expect(mesh.position.toArray()).toEqual([0, 0, 0]);
  });

  it('places the volume along the view ray when a camera is available', () => {
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(0, 0, 40);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld(true);
    handler.setActiveCameraProvider(() => camera);
    handler.setGridIntervalProvider(() => 1);
    const mesh = handler.createGreyBox();
    expect(mesh.position.z).toBeLessThan(camera.position.z);
    expect(mesh.position.length()).toBeGreaterThan(0);
  });

  it('does not occlude spawn placement of later objects', () => {
    const mesh = handler.createGreyBox();
    expect(isSpawnRaycastMesh(mesh)).toBe(false);
  });

  it('reports the created volume through its callback', () => {
    const created: THREE.Mesh[] = [];
    handler.setOnGreyBoxCreated((mesh) => created.push(mesh));
    const mesh = handler.createGreyBox();
    expect(created).toEqual([mesh]);
  });
});
