import * as THREE from 'three';
import type { EditorApiHost } from './editor_api_host.js';
import type { McpToolResult } from '../shared/mcp_protocol_types.js';
import { CompositeCommand } from '../../commands/composite_command.js';
import type { UndoCommand } from '../../commands/undo_command.js';
import { CreateGreyBoxCommand } from '../../commands/greybox/create_grey_box_command.js';
import { DeleteGreyBoxGroupCommand } from '../../commands/greybox/delete_grey_box_group_command.js';
import { DeleteObjectCommand, DeleteSnapshot } from '../../commands/object/delete_object_command.js';
import { PruneGreyBoxReferencesCommand } from '../../commands/greybox/prune_grey_box_references_command.js';
import { RenameCommand } from '../../commands/object/rename_command.js';
import { SetGreyBoxDescriptionCommand } from '../../commands/greybox/set_grey_box_description_command.js';
import {
  AddGreyBoxConnectionCommand,
  RemoveGreyBoxConnectionCommand,
  SetGreyBoxSuppressionCommand,
} from '../../commands/greybox/grey_box_connection_commands.js';
import { BoundsResizeCommand } from '../../commands/transform/bounds_resize_command.js';
import { GreyBoxRegistry } from '../../greybox/model/grey_box_registry.js';
import { createGreyBoxMesh, DEFAULT_GREY_BOX_SIZE } from '../../greybox/model/grey_box_factory.js';
import { isGreyBoxGroup } from '../../greybox/model/grey_box_group.js';
import { DEFAULT_GREY_BOX_ROLE } from '../../greybox/model/grey_box_role.js';
import { allocateGreyBoxName } from '../../greybox/model/grey_box_naming.js';
import { setGreyBoxDescription } from '../../greybox/model/grey_box_access.js';
import { SetGreyBoxRoleCommand } from '../../commands/greybox/set_grey_box_role_command.js';
import { GreyBoxIntentPatch, SetGreyBoxIntentCommand } from '../../commands/greybox/set_grey_box_intent_command.js';
import { isGreyBoxSizeIntent } from '../../greybox/model/grey_box_intent.js';
import { greyBoxPairKey } from '../../greybox/model/grey_box_pair_key.js';
import { computeGreyBoxLocalSize } from '../../greybox/model/grey_box_volume.js';
import { listGreyBoxConnections } from '../../greybox/model/grey_box_connection_access.js';
import type {
  ConnectGreyBoxesArgs,
  CreateGreyBoxArgs,
  DisconnectGreyBoxesArgs,
  SetGreyBoxIntentArgs,
  SetGreyBoxTransformArgs,
} from './editor_api_grey_box_types.js';

/**
 * Grey box authoring tools. Every mutation goes through the same undoable
 * commands the editor UI uses, so `undo` reverses an agent's edits.
 */
export class EditorApiGreyBoxWrites {
  private readonly host: EditorApiHost;

  /**
   * Creates the grey box write API.
   *
   * @param host Injected editor systems.
   */
  constructor(host: EditorApiHost) {
    this.host = host;
  }

  /**
   * Creates a grey box planning volume.
   *
   * @param args Optional name, description, center, and size.
   * @returns Tool result with the new volume id.
   */
  createGreyBox(args: CreateGreyBoxArgs): McpToolResult {
    const parent = this.resolveParent(args.parentGreyBoxId);
    if (!parent) return unknownGreyBox(args.parentGreyBoxId ?? '');
    const size = args.size ?? { x: DEFAULT_GREY_BOX_SIZE, y: DEFAULT_GREY_BOX_SIZE, z: DEFAULT_GREY_BOX_SIZE };
    const name = args.name && args.name.length > 0 ? args.name : allocateGreyBoxName(this.host.worldObject);
    const mesh = createGreyBoxMesh(name, size.x, size.y, size.z, args.role ?? DEFAULT_GREY_BOX_ROLE);
    if (args.center) mesh.position.copy(toParentLocal(parent, args.center));
    if (args.description) setGreyBoxDescription(mesh, args.description);
    this.host.commandStack.push(new CreateGreyBoxCommand(mesh, parent));
    this.afterMutation();
    return {
      ok: true,
      message: `Created grey box "${mesh.name}"`,
      data: { greyBoxId: GreyBoxRegistry.get(mesh).id, name: mesh.name },
    };
  }

  /**
   * Renames a grey box.
   *
   * @param greyBoxId Volume to rename.
   * @param name New display name.
   * @returns Tool result.
   */
  renameGreyBox(greyBoxId: string, name: string): McpToolResult {
    const mesh = this.resolve(greyBoxId);
    if (!mesh) return unknownGreyBox(greyBoxId);
    this.host.commandStack.push(new RenameCommand(mesh, name));
    this.afterMutation();
    return { ok: true, message: `Renamed grey box to "${name}"`, data: { greyBoxId, name } };
  }

  /**
   * Replaces a grey box description.
   *
   * @param greyBoxId Volume to describe.
   * @param description New description; empty string clears it.
   * @returns Tool result.
   */
  setGreyBoxDescription(greyBoxId: string, description: string): McpToolResult {
    const mesh = this.resolve(greyBoxId);
    if (!mesh) return unknownGreyBox(greyBoxId);
    this.host.commandStack.push(SetGreyBoxDescriptionCommand.fromCurrent(mesh, description));
    this.afterMutation();
    return { ok: true, message: `Set description on grey box ${greyBoxId}`, data: { greyBoxId, description } };
  }

  /**
   * Sets a grey box gameplay role.
   *
   * @param greyBoxId Volume to reclassify.
   * @param role New role.
   * @returns Tool result.
   */
  setGreyBoxRole(greyBoxId: string, role: string): McpToolResult {
    const mesh = this.resolve(greyBoxId);
    if (!mesh) return unknownGreyBox(greyBoxId);
    this.host.commandStack.push(SetGreyBoxRoleCommand.fromCurrent(mesh, role));
    this.afterMutation();
    return { ok: true, message: `Set role "${role}" on grey box ${greyBoxId}`, data: { greyBoxId, role } };
  }

  /**
   * Records authoring intent: dimension fixity and surface feel.
   *
   * @param args Volume id with the intent fields to change.
   * @returns Tool result.
   */
  setGreyBoxIntent(args: SetGreyBoxIntentArgs): McpToolResult {
    const mesh = this.resolve(args.greyBoxId);
    if (!mesh) return unknownGreyBox(args.greyBoxId);
    if (args.sizeIntent !== undefined && !isGreyBoxSizeIntent(args.sizeIntent)) {
      return { ok: false, message: `sizeIntent must be "exact" or "approximate", got "${args.sizeIntent}"` };
    }
    if (args.sizeIntent === undefined && args.surface === undefined) {
      return { ok: false, message: 'Provide sizeIntent, surface, or both' };
    }
    const patch: GreyBoxIntentPatch = {};
    if (args.sizeIntent !== undefined) patch.sizeIntent = args.sizeIntent;
    if (args.surface !== undefined) patch.surface = args.surface;
    this.host.commandStack.push(SetGreyBoxIntentCommand.fromCurrent(mesh, patch));
    this.afterMutation();
    return { ok: true, message: `Recorded intent on grey box ${args.greyBoxId}`, data: { greyBoxId: args.greyBoxId } };
  }

  /**
   * Moves and resizes a grey box volume.
   *
   * @param args Volume id with optional center and size.
   * @returns Tool result with the applied pose.
   */
  setGreyBoxTransform(args: SetGreyBoxTransformArgs): McpToolResult {
    const mesh = this.resolve(args.greyBoxId);
    if (!mesh) return unknownGreyBox(args.greyBoxId);
    const finalPosition = args.center && mesh.parent ? toParentLocal(mesh.parent, args.center) : mesh.position.clone();
    const finalScale = args.size ? this.scaleForSize(mesh, args.size) : mesh.scale.clone();
    this.host.commandStack.push(
      new BoundsResizeCommand([
        {
          object: mesh,
          originalPosition: mesh.position.clone(),
          originalScale: mesh.scale.clone(),
          finalPosition,
          finalScale,
        },
      ]),
    );
    this.afterMutation();
    return { ok: true, message: `Moved grey box ${args.greyBoxId}`, data: { greyBoxId: args.greyBoxId } };
  }

  /**
   * Deletes grey boxes and prunes authored links pointing at them. Deleting a
   * group takes everything inside it; ungroup first to keep the contents.
   *
   * @param greyBoxIds Volumes or groups to delete.
   * @returns Tool result with the deleted count.
   */
  deleteGreyBoxes(greyBoxIds: string[]): McpToolResult {
    const resolved = greyBoxIds.map((id) => GreyBoxRegistry.findById(this.host.worldObject, id));
    const missing = greyBoxIds.filter((_id, index) => resolved[index] === null);
    if (missing.length > 0) return { ok: false, message: `Unknown greyBoxId: ${missing.join(', ')}` };
    const found = resolved.filter((object): object is THREE.Object3D => object !== null);
    this.host.commandStack.push(
      new CompositeCommand([
        ...found.map((object) => this.buildDeleteCommand(object)),
        new PruneGreyBoxReferencesCommand(this.host.worldObject, collectRemovedIds(found)),
      ]),
    );
    this.afterMutation();
    return { ok: true, message: `Deleted ${found.length} grey box(es)`, data: { deleted: found.length } };
  }

  /**
   * Builds the delete command matching what a grey box is: a group detaches its
   * whole subtree, a volume takes the editor's mesh delete path.
   *
   * @param object Grey box volume or group being removed.
   * @returns Undoable delete command.
   */
  private buildDeleteCommand(object: THREE.Object3D): UndoCommand {
    if (isGreyBoxGroup(object)) return new DeleteGreyBoxGroupCommand(object);
    return new DeleteObjectCommand([buildDeleteSnapshot(object as THREE.Mesh)]);
  }

  /**
   * States an authored route between two volumes.
   *
   * @param args Owner, target, and optional label, note, and direction.
   * @returns Tool result with the new connection id.
   */
  connectGreyBoxes(args: ConnectGreyBoxesArgs): McpToolResult {
    const owner = this.resolve(args.greyBoxId);
    if (!owner) return unknownGreyBox(args.greyBoxId);
    if (!this.resolve(args.targetGreyBoxId)) return unknownGreyBox(args.targetGreyBoxId);
    if (args.greyBoxId === args.targetGreyBoxId) {
      return { ok: false, message: 'A grey box cannot connect to itself' };
    }
    const command = new AddGreyBoxConnectionCommand(
      owner,
      args.targetGreyBoxId,
      args.kind ?? 'link',
      args.note ?? '',
      args.direction === 'forward' ? 'forward' : 'bidirectional',
    );
    this.host.commandStack.push(command);
    this.afterMutation();
    return {
      ok: true,
      message: `Connected ${args.greyBoxId} to ${args.targetGreyBoxId}`,
      data: { connectionId: command.getCreatedConnection()?.id ?? null },
    };
  }

  /**
   * Removes an authored link, or mutes a derived adjacency when no connection
   * id is given.
   *
   * @param args Owner plus either a connection id or a target volume.
   * @returns Tool result describing what changed.
   */
  disconnectGreyBoxes(args: DisconnectGreyBoxesArgs): McpToolResult {
    const owner = this.resolve(args.greyBoxId);
    if (!owner) return unknownGreyBox(args.greyBoxId);
    if (args.connectionId) return this.removeAuthoredLink(owner, args.greyBoxId, args.connectionId);
    if (!args.targetGreyBoxId) {
      return { ok: false, message: 'Provide connectionId to remove a link, or targetGreyBoxId to mute an adjacency' };
    }
    if (!this.resolve(args.targetGreyBoxId)) return unknownGreyBox(args.targetGreyBoxId);
    const pairKey = greyBoxPairKey(args.greyBoxId, args.targetGreyBoxId);
    this.host.commandStack.push(new SetGreyBoxSuppressionCommand(owner, pairKey, true));
    this.afterMutation();
    return { ok: true, message: `Muted derived adjacency ${pairKey}`, data: { mutedAdjacency: pairKey } };
  }

  /**
   * Removes one authored link by id, reporting an unknown id rather than
   * silently succeeding.
   *
   * @param owner Volume that owns the link.
   * @param greyBoxId Owner id for the message.
   * @param connectionId Link to remove.
   * @returns Tool result.
   */
  private removeAuthoredLink(owner: THREE.Object3D, greyBoxId: string, connectionId: string): McpToolResult {
    const exists = listGreyBoxConnections(owner).some((connection) => connection.id === connectionId);
    if (!exists) {
      return { ok: false, message: `Grey box ${greyBoxId} has no connection ${connectionId}` };
    }
    this.host.commandStack.push(new RemoveGreyBoxConnectionCommand(owner, connectionId));
    this.afterMutation();
    return {
      ok: true,
      message: `Removed connection ${connectionId}`,
      data: { removedConnectionId: connectionId },
    };
  }

  /**
   * Converts a requested world size into the scale that produces it.
   *
   * @param mesh Grey box volume.
   * @param size Requested world size.
   * @returns Scale vector achieving that size.
   */
  private scaleForSize(mesh: THREE.Mesh, size: { x: number; y: number; z: number }): THREE.Vector3 {
    const local = computeGreyBoxLocalSize(mesh);
    return new THREE.Vector3(
      local.x > 0 ? size.x / local.x : 1,
      local.y > 0 ? size.y / local.y : 1,
      local.z > 0 ? size.z / local.z : 1,
    );
  }

  /**
   * Resolves the parent a new volume is created under, defaulting to the world
   * root. A grey box group or an enclosing volume are both legal parents.
   *
   * @param parentGreyBoxId Grey box to nest under, or undefined for the world.
   * @returns Parent object, or null when the id does not resolve.
   */
  private resolveParent(parentGreyBoxId: string | undefined): THREE.Object3D | null {
    if (!parentGreyBoxId) return this.host.worldObject;
    return GreyBoxRegistry.findById(this.host.worldObject, parentGreyBoxId);
  }

  /**
   * Resolves a grey box id to its mesh.
   *
   * @param greyBoxId Id to resolve.
   * @returns Grey box mesh, or null when absent.
   */
  private resolve(greyBoxId: string): THREE.Mesh | null {
    const found = GreyBoxRegistry.findById(this.host.worldObject, greyBoxId);
    if (!found || !(found instanceof THREE.Mesh)) return null;
    return found;
  }

  /** Refreshes viewports and the outliner after a mutation. */
  private afterMutation(): void {
    this.host.refreshAfterWorldMutation();
    this.host.refreshOutliner();
  }
}

/**
 * Builds the failure result for an unknown grey box id.
 *
 * @param greyBoxId Id that did not resolve.
 * @returns Failure result.
 */
function unknownGreyBox(greyBoxId: string): McpToolResult {
  return { ok: false, message: `Unknown greyBoxId: ${greyBoxId}` };
}

/**
 * Collects the ids of everything a delete removes, including the volumes inside
 * a deleted group, so no authored link is left pointing at a volume that has
 * left the scene.
 *
 * @param removed Grey boxes being deleted.
 * @returns Grey box ids removed by the operation.
 */
function collectRemovedIds(removed: readonly THREE.Object3D[]): string[] {
  const ids = new Set<string>();
  for (const object of removed) {
    for (const inSubtree of GreyBoxRegistry.collectUnder(object)) {
      const data = GreyBoxRegistry.tryGet(inSubtree);
      if (data) ids.add(data.id);
    }
  }
  return [...ids];
}

/**
 * Converts a world center into the parent's local space, so a volume placed
 * inside a moved group still lands where the caller asked.
 *
 * @param parent Parent that will hold the volume.
 * @param center World-space center.
 * @returns Position in the parent's local space.
 */
function toParentLocal(parent: THREE.Object3D, center: { x: number; y: number; z: number }): THREE.Vector3 {
  parent.updateWorldMatrix(true, false);
  return parent.worldToLocal(new THREE.Vector3(center.x, center.y, center.z));
}

/**
 * Builds a delete snapshot the way the editor's delete flow does.
 *
 * @param mesh Volume being deleted.
 * @returns Snapshot restoring the volume on undo.
 */
function buildDeleteSnapshot(mesh: THREE.Mesh): DeleteSnapshot {
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
