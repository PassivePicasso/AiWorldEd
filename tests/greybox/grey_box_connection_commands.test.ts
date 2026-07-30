import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { CommandStack } from '../../src/commands/command_stack.js';
import { CompositeCommand } from '../../src/commands/composite_command.js';
import { DeleteObjectCommand, DeleteSnapshot } from '../../src/commands/object/delete_object_command.js';
import { PruneGreyBoxReferencesCommand } from '../../src/commands/greybox/prune_grey_box_references_command.js';
import {
  AddGreyBoxConnectionCommand,
  EditGreyBoxConnectionCommand,
  RemoveGreyBoxConnectionCommand,
  SetGreyBoxSuppressionCommand,
} from '../../src/commands/greybox/grey_box_connection_commands.js';
import {
  isDerivedConnectionSuppressed,
  listGreyBoxConnections,
} from '../../src/greybox/model/grey_box_connection_access.js';
import { getGreyBoxId } from '../../src/greybox/model/grey_box_access.js';
import { createGreyBoxMesh } from '../../src/greybox/model/grey_box_factory.js';
import { greyBoxPairKey } from '../../src/greybox/model/grey_box_pair_key.js';

const COMMAND_STACK_LIMIT = 32;

describe('grey box connection commands', () => {
  let world: THREE.Group;
  let commandStack: CommandStack;
  let owner: THREE.Mesh;
  let target: THREE.Mesh;

  beforeEach(() => {
    world = new THREE.Group();
    commandStack = new CommandStack(COMMAND_STACK_LIMIT);
    owner = createGreyBoxMesh('Owner', 10, 10, 10);
    target = createGreyBoxMesh('Target', 10, 10, 10);
    target.position.set(40, 0, 0);
    world.add(owner);
    world.add(target);
  });

  it('adds an authored link and undoes it', () => {
    commandStack.push(new AddGreyBoxConnectionCommand(owner, getGreyBoxId(target), 'elevator', 'keycard', 'forward'));
    expect(listGreyBoxConnections(owner).length).toBe(1);
    commandStack.undo();
    expect(listGreyBoxConnections(owner)).toEqual([]);
  });

  it('reuses the same connection id when redone', () => {
    const command = new AddGreyBoxConnectionCommand(owner, getGreyBoxId(target), 'door', '', 'bidirectional');
    commandStack.push(command);
    const createdId = command.getCreatedConnection()!.id;
    commandStack.undo();
    commandStack.redo();
    const connections = listGreyBoxConnections(owner);
    expect(connections.length).toBe(1);
    expect(connections[0]!.id).toBe(createdId);
  });

  it('stores the authored fields as given', () => {
    commandStack.push(new AddGreyBoxConnectionCommand(owner, getGreyBoxId(target), 'stairs', 'steep', 'forward'));
    const connection = listGreyBoxConnections(owner)[0]!;
    expect(connection.targetGreyBoxId).toBe(getGreyBoxId(target));
    expect(connection.kind).toBe('stairs');
    expect(connection.note).toBe('steep');
    expect(connection.direction).toBe('forward');
  });

  it('removes an authored link and restores it at its original index', () => {
    commandStack.push(new AddGreyBoxConnectionCommand(owner, getGreyBoxId(target), 'first', '', 'bidirectional'));
    commandStack.push(new AddGreyBoxConnectionCommand(owner, getGreyBoxId(target), 'second', '', 'bidirectional'));
    const firstId = listGreyBoxConnections(owner)[0]!.id;
    commandStack.push(new RemoveGreyBoxConnectionCommand(owner, firstId));
    expect(listGreyBoxConnections(owner).map((entry) => entry.kind)).toEqual(['second']);
    commandStack.undo();
    expect(listGreyBoxConnections(owner).map((entry) => entry.kind)).toEqual(['first', 'second']);
  });

  it('edits a link kind, note, and direction with undo', () => {
    commandStack.push(
      new AddGreyBoxConnectionCommand(owner, getGreyBoxId(target), 'door', 'old note', 'bidirectional'),
    );
    const connectionId = listGreyBoxConnections(owner)[0]!.id;
    commandStack.push(
      new EditGreyBoxConnectionCommand(owner, connectionId, {
        kind: 'vent',
        note: 'crawl space',
        direction: 'forward',
      }),
    );
    const edited = listGreyBoxConnections(owner)[0]!;
    expect(edited.kind).toBe('vent');
    expect(edited.note).toBe('crawl space');
    expect(edited.direction).toBe('forward');
    commandStack.undo();
    const restored = listGreyBoxConnections(owner)[0]!;
    expect(restored.kind).toBe('door');
    expect(restored.note).toBe('old note');
    expect(restored.direction).toBe('bidirectional');
  });

  it('mutes and unmutes a derived adjacency with undo', () => {
    const pairKey = greyBoxPairKey(getGreyBoxId(owner), getGreyBoxId(target));
    commandStack.push(new SetGreyBoxSuppressionCommand(owner, pairKey, true));
    expect(isDerivedConnectionSuppressed(owner, pairKey)).toBe(true);
    commandStack.undo();
    expect(isDerivedConnectionSuppressed(owner, pairKey)).toBe(false);
    commandStack.redo();
    expect(isDerivedConnectionSuppressed(owner, pairKey)).toBe(true);
  });

  it('does not duplicate a mute recorded twice', () => {
    const pairKey = greyBoxPairKey(getGreyBoxId(owner), getGreyBoxId(target));
    commandStack.push(new SetGreyBoxSuppressionCommand(owner, pairKey, true));
    commandStack.push(new SetGreyBoxSuppressionCommand(owner, pairKey, true));
    commandStack.undo();
    expect(isDerivedConnectionSuppressed(owner, pairKey)).toBe(false);
  });
});

describe('pruning references to a deleted grey box', () => {
  let world: THREE.Group;
  let commandStack: CommandStack;
  let keeper: THREE.Mesh;
  let doomed: THREE.Mesh;

  beforeEach(() => {
    world = new THREE.Group();
    commandStack = new CommandStack(COMMAND_STACK_LIMIT);
    keeper = createGreyBoxMesh('Keeper', 10, 10, 10);
    doomed = createGreyBoxMesh('Doomed', 10, 10, 10);
    doomed.position.set(40, 0, 0);
    world.add(keeper);
    world.add(doomed);
  });

  it('removes links pointing at the deleted volume', () => {
    commandStack.push(new AddGreyBoxConnectionCommand(keeper, getGreyBoxId(doomed), 'elevator', '', 'bidirectional'));
    commandStack.push(deleteWithPruning(world, doomed));
    expect(listGreyBoxConnections(keeper)).toEqual([]);
  });

  it('restores both the volume and the links on undo', () => {
    commandStack.push(new AddGreyBoxConnectionCommand(keeper, getGreyBoxId(doomed), 'elevator', 'note', 'forward'));
    const connectionId = listGreyBoxConnections(keeper)[0]!.id;
    commandStack.push(deleteWithPruning(world, doomed));
    commandStack.undo();
    expect(doomed.parent).toBe(world);
    const restored = listGreyBoxConnections(keeper);
    expect(restored.length).toBe(1);
    expect(restored[0]!.id).toBe(connectionId);
    expect(restored[0]!.note).toBe('note');
  });

  it('leaves links to other volumes alone', () => {
    const other = createGreyBoxMesh('Other', 10, 10, 10);
    other.position.set(80, 0, 0);
    world.add(other);
    commandStack.push(new AddGreyBoxConnectionCommand(keeper, getGreyBoxId(other), 'corridor', '', 'bidirectional'));
    commandStack.push(deleteWithPruning(world, doomed));
    expect(listGreyBoxConnections(keeper).length).toBe(1);
  });

  it('collects grey box ids from a deleted subtree', () => {
    const group = new THREE.Group();
    const nested = createGreyBoxMesh('Nested', 4, 4, 4);
    group.add(nested);
    world.add(group);
    expect(PruneGreyBoxReferencesCommand.collectGreyBoxIds([group])).toEqual([getGreyBoxId(nested)]);
  });

  it('reports no ids when nothing deleted is a grey box', () => {
    const plain = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    expect(PruneGreyBoxReferencesCommand.collectGreyBoxIds([plain])).toEqual([]);
  });
});

/**
 * Builds the composite the editor pushes when deleting a grey box: the deletion
 * plus pruning of authored links that pointed at it.
 *
 * @param world Root the volumes live under.
 * @param mesh Volume being deleted.
 * @returns Composite command covering both effects.
 */
function deleteWithPruning(world: THREE.Group, mesh: THREE.Mesh): CompositeCommand {
  const snapshot: DeleteSnapshot = {
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
  const ids = PruneGreyBoxReferencesCommand.collectGreyBoxIds([mesh]);
  return new CompositeCommand([new DeleteObjectCommand([snapshot]), new PruneGreyBoxReferencesCommand(world, ids)]);
}
