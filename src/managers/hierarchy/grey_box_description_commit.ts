import * as THREE from 'three';
import { CommandStack } from '../../commands/command_stack.js';
import { SetGreyBoxDescriptionCommand } from '../../commands/greybox/set_grey_box_description_command.js';
import { SetGreyBoxRoleCommand } from '../../commands/greybox/set_grey_box_role_command.js';
import { GreyBoxIntentPatch, SetGreyBoxIntentCommand } from '../../commands/greybox/set_grey_box_intent_command.js';
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

/**
 * Commits a grey box role change as a single undoable step, skipping a change
 * that names the role the volume already has.
 *
 * @param commandStack Undo stack receiving the edit.
 * @param greyBox Grey box being reclassified.
 * @param role Role text from the inspector.
 */
export function commitGreyBoxRole(commandStack: CommandStack, greyBox: THREE.Object3D, role: string): void {
  if (isObjectOrAncestorLocked(greyBox)) return;
  if (!(greyBox instanceof THREE.Mesh)) return;
  const command = SetGreyBoxRoleCommand.fromCurrent(greyBox, role);
  if (!command.changesRole()) return;
  commandStack.push(command);
}

/**
 * Commits a grey box intent edit as a single undoable step, skipping an edit
 * that changes nothing.
 *
 * @param commandStack Undo stack receiving the edit.
 * @param greyBox Grey box being described.
 * @param patch Intent fields to change.
 */
export function commitGreyBoxIntent(
  commandStack: CommandStack,
  greyBox: THREE.Object3D,
  patch: GreyBoxIntentPatch,
): void {
  if (isObjectOrAncestorLocked(greyBox)) return;
  const command = SetGreyBoxIntentCommand.fromCurrent(greyBox, patch);
  if (!command.changesIntent()) return;
  commandStack.push(command);
}
