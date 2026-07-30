import * as THREE from 'three';
import { UndoCommand } from '../undo_command.js';

/**
 * Undoable creation of a grey box: a planning volume, or a group that organizes
 * them. Undo detaches the object without disposing it, and its layout payload
 * stays registered, so redo restores the same grey box with its description and
 * connections intact.
 */
export class CreateGreyBoxCommand implements UndoCommand {
  private greyBox: THREE.Object3D;
  private parent: THREE.Object3D;

  /**
   * Creates a grey box creation command.
   *
   * @param greyBox Registered grey box volume or group to attach.
   * @param parent Parent that receives the grey box.
   */
  constructor(greyBox: THREE.Object3D, parent: THREE.Object3D) {
    this.greyBox = greyBox;
    this.parent = parent;
  }

  /** Attaches the grey box to its parent. No-op when already attached. */
  execute(): void {
    if (this.greyBox.parent) return;
    this.parent.add(this.greyBox);
  }

  /** Detaches the grey box, keeping geometry, material, and payload for redo. */
  undo(): void {
    if (this.greyBox.parent) {
      this.greyBox.parent.remove(this.greyBox);
    }
  }
}
