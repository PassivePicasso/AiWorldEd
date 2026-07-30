import * as THREE from 'three';
import { UndoCommand } from '../undo_command.js';
import { getGreyBoxRole, setGreyBoxRole } from '../../greybox/model/grey_box_access.js';
import { GreyBoxRole, normalizeGreyBoxRole } from '../../greybox/model/grey_box_role.js';
import { applyGreyBoxVisual } from '../../greybox/model/grey_box_visual.js';

/**
 * Undoable role change on a grey box. The role drives the volume's colour, so
 * applying it restyles the mesh as well as rewriting the payload.
 */
export class SetGreyBoxRoleCommand implements UndoCommand {
  private readonly greyBox: THREE.Mesh;
  private readonly previousRole: GreyBoxRole;
  private readonly nextRole: GreyBoxRole;

  /**
   * Creates a role change command.
   *
   * @param greyBox Volume being reclassified.
   * @param previousRole Role before the change.
   * @param nextRole Role to store.
   */
  constructor(greyBox: THREE.Mesh, previousRole: GreyBoxRole, nextRole: GreyBoxRole) {
    this.greyBox = greyBox;
    this.previousRole = previousRole;
    this.nextRole = normalizeGreyBoxRole(nextRole);
  }

  /**
   * Builds a command from the volume's current role.
   *
   * @param greyBox Volume being reclassified.
   * @param nextRole Role to store.
   * @returns Command capturing the current role as its undo state.
   */
  static fromCurrent(greyBox: THREE.Mesh, nextRole: GreyBoxRole): SetGreyBoxRoleCommand {
    return new SetGreyBoxRoleCommand(greyBox, getGreyBoxRole(greyBox), nextRole);
  }

  /** Stores the new role and restyles the volume. */
  execute(): void {
    this.applyRole(this.nextRole);
  }

  /** Restores the previous role and restyles the volume. */
  undo(): void {
    this.applyRole(this.previousRole);
  }

  /**
   * Returns whether this command would change anything.
   *
   * @returns True when the roles differ.
   */
  changesRole(): boolean {
    return this.previousRole !== this.nextRole;
  }

  /**
   * Writes a role and refreshes the volume's colour.
   *
   * @param role Role to apply.
   */
  private applyRole(role: GreyBoxRole): void {
    setGreyBoxRole(this.greyBox, role);
    applyGreyBoxVisual(this.greyBox, role);
  }
}
