import * as THREE from 'three';
import type { EditorApiHost } from './editor_api_host.js';
import type { McpToolResult } from '../shared/mcp_protocol_types.js';
import { CompositeCommand } from '../../commands/composite_command.js';
import { CreateGreyBoxCommand } from '../../commands/greybox/create_grey_box_command.js';
import { ReparentMove, ReparentObjectsCommand } from '../../commands/object/reparent_objects_command.js';
import { UngroupCommand } from '../../commands/object/ungroup_command.js';
import { GreyBoxRegistry } from '../../greybox/model/grey_box_registry.js';
import { createGreyBoxGroup } from '../../greybox/model/grey_box_factory.js';
import { allocateGreyBoxGroupName } from '../../greybox/model/grey_box_naming.js';
import { isGreyBoxGroup } from '../../greybox/model/grey_box_group.js';
import { isDescendantOf } from '../../utils/hierarchy_utils.js';
import type { CreateGreyBoxGroupArgs, ReparentGreyBoxesArgs } from './editor_api_grey_box_types.js';

/**
 * Grey box grouping tools. A group is a branch node with no geometry: it makes
 * a large blockout navigable by collecting related volumes under one row, the
 * way a solid model root collects its brushes.
 */
export class EditorApiGreyBoxGroups {
  private readonly host: EditorApiHost;

  /**
   * Creates the grey box grouping API.
   *
   * @param host Injected editor systems.
   */
  constructor(host: EditorApiHost) {
    this.host = host;
  }

  /**
   * Creates a grey box group, optionally moving existing grey boxes into it in
   * the same undo step.
   *
   * @param args Optional name, description, parent, and initial members.
   * @returns Tool result with the new group id.
   */
  createGreyBoxGroup(args: CreateGreyBoxGroupArgs): McpToolResult {
    const parent = this.resolveParent(args.parentGreyBoxId);
    if (parent === null) return unknownGreyBox(args.parentGreyBoxId ?? '');
    const members = this.resolveAll(args.greyBoxIds ?? []);
    if (typeof members === 'string') return { ok: false, message: members };
    const cycle = findCycle(members, parent);
    if (cycle) return cycleFailure(cycle);
    const name = args.name && args.name.length > 0 ? args.name : allocateGreyBoxGroupName(this.host.worldObject);
    const group = createGreyBoxGroup(name, args.description ?? '');
    this.host.commandStack.push(
      new CompositeCommand([
        new CreateGreyBoxCommand(group, parent),
        new ReparentObjectsCommand(movesInto(members, group)),
      ]),
    );
    this.afterMutation();
    return {
      ok: true,
      message: `Created grey box group "${name}" holding ${members.length} grey box(es)`,
      data: { greyBoxId: GreyBoxRegistry.get(group).id, name, memberCount: members.length },
    };
  }

  /**
   * Moves grey boxes and groups under a new parent. Passing no parent moves
   * them back out to the world root.
   *
   * @param args Grey boxes to move and the destination.
   * @returns Tool result with the moved count.
   */
  reparentGreyBoxes(args: ReparentGreyBoxesArgs): McpToolResult {
    const parent = this.resolveParent(args.parentGreyBoxId);
    if (parent === null) return unknownGreyBox(args.parentGreyBoxId ?? '');
    const moved = this.resolveAll(args.greyBoxIds);
    if (typeof moved === 'string') return { ok: false, message: moved };
    const cycle = findCycle(moved, parent);
    if (cycle) return cycleFailure(cycle);
    this.host.commandStack.push(new ReparentObjectsCommand(movesInto(moved, parent)));
    this.afterMutation();
    return { ok: true, message: `Moved ${moved.length} grey box(es)`, data: { moved: moved.length } };
  }

  /**
   * Dissolves grey box groups, leaving their contents in the group's place. The
   * volumes themselves are untouched.
   *
   * @param greyBoxIds Groups to dissolve.
   * @returns Tool result with the dissolved count.
   */
  ungroupGreyBoxGroups(greyBoxIds: string[]): McpToolResult {
    const resolved = this.resolveAll(greyBoxIds);
    if (typeof resolved === 'string') return { ok: false, message: resolved };
    const notGroups = resolved.filter((object) => !isGreyBoxGroup(object));
    if (notGroups.length > 0) {
      return { ok: false, message: `Not a grey box group: ${notGroups.map((object) => object.name).join(', ')}` };
    }
    this.host.commandStack.push(
      new CompositeCommand(resolved.map((object) => new UngroupCommand(object as THREE.Group))),
    );
    this.afterMutation();
    return {
      ok: true,
      message: `Dissolved ${resolved.length} grey box group(s)`,
      data: { ungrouped: resolved.length },
    };
  }

  /**
   * Resolves the destination parent for a move, defaulting to the world root.
   *
   * @param parentGreyBoxId Grey box to move under, or undefined for the world.
   * @returns Destination object, or null when the id does not resolve.
   */
  private resolveParent(parentGreyBoxId: string | undefined): THREE.Object3D | null {
    if (!parentGreyBoxId) return this.host.worldObject;
    return GreyBoxRegistry.findById(this.host.worldObject, parentGreyBoxId);
  }

  /**
   * Resolves grey box ids to their scene objects, reporting every id that does
   * not resolve rather than acting on a partial set.
   *
   * @param greyBoxIds Ids to resolve.
   * @returns Resolved objects, or a failure message naming the unknown ids.
   */
  private resolveAll(greyBoxIds: string[]): THREE.Object3D[] | string {
    const resolved = greyBoxIds.map((id) => GreyBoxRegistry.findById(this.host.worldObject, id));
    const missing = greyBoxIds.filter((_id, index) => resolved[index] === null);
    if (missing.length > 0) return `Unknown greyBoxId: ${missing.join(', ')}`;
    return resolved.filter((object): object is THREE.Object3D => object !== null);
  }

  /** Refreshes viewports and the outliner after a mutation. */
  private afterMutation(): void {
    this.host.refreshAfterWorldMutation();
    this.host.refreshOutliner();
  }
}

/**
 * Builds append-at-the-end reparent moves for a batch.
 *
 * @param objects Objects to move.
 * @param parent Destination parent.
 * @returns Moves ready for ReparentObjectsCommand.
 */
function movesInto(objects: readonly THREE.Object3D[], parent: THREE.Object3D): ReparentMove[] {
  return objects.map((object) => ({ object, newParent: parent, insertBefore: null }));
}

/**
 * Finds a mover that cannot go under a destination because it is that
 * destination or sits above it.
 *
 * @param movers Objects being moved.
 * @param parent Destination the movers land under.
 * @returns The offending mover, or null when the batch is safe.
 */
function findCycle(movers: readonly THREE.Object3D[], parent: THREE.Object3D): THREE.Object3D | null {
  return movers.find((object) => object === parent || isDescendantOf(parent, object)) ?? null;
}

/**
 * Builds the failure result for a move that would nest an object in itself.
 *
 * @param mover Object that cannot be moved.
 * @returns Failure result.
 */
function cycleFailure(mover: THREE.Object3D): McpToolResult {
  return { ok: false, message: `Cannot move "${mover.name}" into itself or one of its own descendants` };
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
