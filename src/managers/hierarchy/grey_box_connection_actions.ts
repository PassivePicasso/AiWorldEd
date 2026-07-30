import * as THREE from 'three';
import { CommandStack } from '../../commands/command_stack.js';
import {
  AddGreyBoxConnectionCommand,
  RemoveGreyBoxConnectionCommand,
  SetGreyBoxSuppressionCommand,
} from '../../commands/greybox/grey_box_connection_commands.js';
import { GreyBoxRegistry } from '../../greybox/model/grey_box_registry.js';
import { buildGreyBoxSceneGraph } from '../../greybox/connectivity/grey_box_scene_graph.js';
import { GreyBoxMergedGraph } from '../../greybox/connectivity/grey_box_graph_types.js';
import { GreyBoxConnectionHandlers } from '../../ui/properties/properties_grey_box_connections_section.js';
import { isObjectOrAncestorLocked } from '../../utils/object_lock.js';

/** Default route label for a link the user creates from the inspector. */
const DEFAULT_CONNECTION_KIND = 'link';

/**
 * Builds the inspector connection handlers: id-based actions that resolve
 * volumes against the world root and push undoable commands.
 *
 * @param commandStack Undo stack receiving the edits.
 * @param worldObject Root the volumes live under.
 * @param onGraphRebuilt Receives the freshly merged graph after each change.
 * @returns Handlers for the connections inspector section.
 */
export function createGreyBoxConnectionHandlers(
  commandStack: CommandStack,
  worldObject: THREE.Object3D,
  onGraphRebuilt: (graph: GreyBoxMergedGraph) => void,
): GreyBoxConnectionHandlers {
  return {
    onConnect: (ownerId, targetId) => {
      const owner = resolveEditableGreyBox(worldObject, ownerId);
      if (!owner) return;
      commandStack.push(new AddGreyBoxConnectionCommand(owner, targetId, DEFAULT_CONNECTION_KIND, '', 'bidirectional'));
    },
    onRemoveAuthored: (ownerId, connectionId) => {
      const owner = resolveEditableGreyBox(worldObject, ownerId);
      if (!owner) return;
      commandStack.push(new RemoveGreyBoxConnectionCommand(owner, connectionId));
    },
    onSetSuppressed: (ownerId, pairKey, suppressed) => {
      const owner = resolveEditableGreyBox(worldObject, ownerId);
      if (!owner) return;
      commandStack.push(new SetGreyBoxSuppressionCommand(owner, pairKey, suppressed));
    },
    onGraphChanged: () => onGraphRebuilt(buildGreyBoxSceneGraph(worldObject)),
  };
}

/**
 * Resolves a grey box id to an editable volume, skipping locked ones.
 *
 * @param worldObject Root the volumes live under.
 * @param greyBoxId Id to resolve.
 * @returns The volume, or null when missing or locked.
 */
function resolveEditableGreyBox(worldObject: THREE.Object3D, greyBoxId: string): THREE.Object3D | null {
  const found = GreyBoxRegistry.findById(worldObject, greyBoxId);
  if (!found) return null;
  if (isObjectOrAncestorLocked(found)) return null;
  return found;
}
