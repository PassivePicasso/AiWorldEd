import * as THREE from 'three';
import { UndoCommand } from '../undo_command.js';
import { getGreyBoxDescription, setGreyBoxDescription } from '../../greybox/model/grey_box_access.js';

/**
 * Undoable description edit on a grey box. One command covers a whole editing
 * session (focus to commit), so a paragraph of typing is a single undo step
 * rather than one per keystroke.
 */
export class SetGreyBoxDescriptionCommand implements UndoCommand {
  private readonly greyBox: THREE.Object3D;
  private readonly previousDescription: string;
  private readonly nextDescription: string;

  /**
   * Creates a description edit command.
   *
   * @param greyBox Grey box being described.
   * @param previousDescription Description before the editing session.
   * @param nextDescription Description to store.
   */
  constructor(greyBox: THREE.Object3D, previousDescription: string, nextDescription: string) {
    this.greyBox = greyBox;
    this.previousDescription = previousDescription;
    this.nextDescription = nextDescription;
  }

  /**
   * Builds a command from the grey box's current description.
   *
   * @param greyBox Grey box being described.
   * @param nextDescription Description to store.
   * @returns Command capturing the current value as its undo state.
   */
  static fromCurrent(greyBox: THREE.Object3D, nextDescription: string): SetGreyBoxDescriptionCommand {
    return new SetGreyBoxDescriptionCommand(greyBox, getGreyBoxDescription(greyBox), nextDescription);
  }

  /** Writes the new description. */
  execute(): void {
    setGreyBoxDescription(this.greyBox, this.nextDescription);
  }

  /** Restores the description from before the editing session. */
  undo(): void {
    setGreyBoxDescription(this.greyBox, this.previousDescription);
  }

  /**
   * Returns whether this command would change anything.
   *
   * @returns True when the descriptions differ.
   */
  changesDescription(): boolean {
    return this.previousDescription !== this.nextDescription;
  }
}
