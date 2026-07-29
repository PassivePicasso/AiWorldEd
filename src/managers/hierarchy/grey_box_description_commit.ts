import * as THREE from 'three';
import { CommandStack } from '../../commands/command_stack.js';
import { SetGreyBoxDescriptionCommand } from '../../commands/greybox/set_grey_box_description_command.js';
import { isObjectOrAncestorLocked } from '../../utils/object_lock.js';

/**
 * Commits a grey box description edit as a single undoable step. No-ops when
 * the text is unchanged so an editing session that ends where it began does not
 * clutter the undo history.
 *
 * @param commandStack Undo stack receiving the edit.
 * @param greyBox Grey box being described.
 * @param description Description text from the inspector.
 */
export function commitGreyBoxDescription(
  commandStack: CommandStack,
  greyBox: THREE.Object3D,
  description: string,
): void {
  if (isObjectOrAncestorLocked(greyBox)) return;
  const command = SetGreyBoxDescriptionCommand.fromCurrent(greyBox, description);
  if (!command.changesDescription()) return;
  commandStack.push(command);
}
