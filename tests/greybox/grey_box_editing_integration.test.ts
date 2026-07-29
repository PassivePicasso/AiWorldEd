import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { isEditorHelperObject } from '../../src/utils/mesh_edge_sync.js';
import { DeleteObjectCommand, DeleteSnapshot } from '../../src/commands/object/delete_object_command.js';
import { BoundsResizeCommand } from '../../src/commands/transform/bounds_resize_command.js';
import { TranslateCommand } from '../../src/commands/transform/translate_command.js';
import { CommandStack } from '../../src/commands/command_stack.js';
import { GreyBoxRegistry } from '../../src/greybox/model/grey_box_registry.js';
import { isGreyBoxOutline } from '../../src/greybox/model/grey_box_visual.js';
import { computeGreyBoxWorldSize } from '../../src/greybox/model/grey_box_volume.js';
import { createDefaultGreyBoxMesh, createGreyBoxMesh } from '../../src/greybox/model/grey_box_factory.js';

const COMMAND_STACK_LIMIT = 32;

describe('grey box editing with existing editor commands', () => {
  let world: THREE.Group;
  let commandStack: CommandStack;

  beforeEach(() => {
    world = new THREE.Group();
    commandStack = new CommandStack(COMMAND_STACK_LIMIT);
  });

  it('is selectable like ordinary content', () => {
    const mesh = createDefaultGreyBoxMesh('GreyBox001');
    expect(isEditorHelperObject(mesh)).toBe(false);
  });

  it('keeps its outline out of selection and the outliner', () => {
    const mesh = createDefaultGreyBoxMesh('GreyBox001');
    const outline = mesh.children.find((child) => isGreyBoxOutline(child))!;
    expect(isEditorHelperObject(outline)).toBe(true);
  });

  it('deletes and restores through the existing delete command', () => {
    const mesh = createDefaultGreyBoxMesh('GreyBox001');
    world.add(mesh);
    commandStack.push(new DeleteObjectCommand([snapshotFor(mesh)]));
    expect(mesh.parent).toBeNull();
    commandStack.undo();
    expect(mesh.parent).toBe(world);
  });

  it('keeps its layout payload across delete and undo', () => {
    const mesh = createDefaultGreyBoxMesh('GreyBox001');
    GreyBoxRegistry.get(mesh).description = 'boss arena';
    world.add(mesh);
    commandStack.push(new DeleteObjectCommand([snapshotFor(mesh)]));
    commandStack.undo();
    expect(GreyBoxRegistry.get(mesh).description).toBe('boss arena');
  });

  it('resizes through the existing bounds resize command', () => {
    const mesh = createGreyBoxMesh('GreyBox001', 4, 4, 4);
    world.add(mesh);
    commandStack.push(
      new BoundsResizeCommand([
        {
          object: mesh,
          originalPosition: new THREE.Vector3(),
          originalScale: new THREE.Vector3(1, 1, 1),
          finalPosition: new THREE.Vector3(2, 0, 0),
          finalScale: new THREE.Vector3(2, 1, 1),
        },
      ]),
    );
    expect(computeGreyBoxWorldSize(mesh).x).toBeCloseTo(8);
    commandStack.undo();
    expect(computeGreyBoxWorldSize(mesh).x).toBeCloseTo(4);
  });

  it('scales its outline with the volume so the wireframe stays aligned', () => {
    const mesh = createGreyBoxMesh('GreyBox001', 4, 4, 4);
    mesh.scale.set(3, 1, 1);
    const outline = mesh.children.find((child) => isGreyBoxOutline(child))!;
    outline.updateWorldMatrix(true, false);
    const worldScale = new THREE.Vector3();
    outline.matrixWorld.decompose(new THREE.Vector3(), new THREE.Quaternion(), worldScale);
    expect(worldScale.x).toBeCloseTo(3);
  });

  it('translates through the existing translate command', () => {
    const mesh = createDefaultGreyBoxMesh('GreyBox001');
    world.add(mesh);
    commandStack.push(
      new TranslateCommand([{ object: mesh, position: mesh.position.clone() }], new THREE.Vector3(5, 0, 0)),
    );
    expect(mesh.position.x).toBeCloseTo(5);
    commandStack.undo();
    expect(mesh.position.x).toBeCloseTo(0);
  });

  it('rotates without losing its registered payload', () => {
    const mesh = createDefaultGreyBoxMesh('GreyBox001');
    mesh.rotation.y = Math.PI / 3;
    expect(GreyBoxRegistry.has(mesh)).toBe(true);
    expect(computeGreyBoxWorldSize(mesh).x).toBeGreaterThan(0);
  });
});

/**
 * Builds a delete snapshot for a mesh the way the editor's delete flow does.
 *
 * @param mesh Mesh being deleted.
 * @returns Snapshot restoring the mesh on undo.
 */
function snapshotFor(mesh: THREE.Mesh): DeleteSnapshot {
  return {
    mesh,
    parent: mesh.parent,
    siblingIndex: mesh.parent ? mesh.parent.children.indexOf(mesh) : 0,
    position: mesh.position.clone(),
    rotation: mesh.quaternion.clone(),
    scale: mesh.scale.clone(),
    name: mesh.name,
    geometry: mesh.geometry,
    material: mesh.material as THREE.Material,
  };
}
