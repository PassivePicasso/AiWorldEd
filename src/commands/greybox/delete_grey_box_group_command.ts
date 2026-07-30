import * as THREE from 'three';
import { UndoCommand } from '../undo_command.js';

/**
 * Undoable deletion of a grey box group and everything it holds. The subtree is
 * detached rather than disposed, so the volumes inside keep their geometry and
 * registered payloads and come back intact on undo.
 */
export class DeleteGreyBoxGroupCommand implements UndoCommand {
  private readonly group: THREE.Object3D;
  private readonly parent: THREE.Object3D | null;
  private readonly siblingIndex: number;

  /**
   * Creates a grey box group deletion command.
   *
   * @param group Grey box group to remove, with its contents.
   */
  constructor(group: THREE.Object3D) {
    this.group = group;
    this.parent = group.parent;
    this.siblingIndex = this.parent ? this.parent.children.indexOf(group) : 0;
  }

  /** Detaches the group and its subtree from the scene. */
  execute(): void {
    if (this.group.parent) {
      this.group.parent.remove(this.group);
    }
  }

  /** Reattaches the group at the sibling position it was removed from. */
  undo(): void {
    if (!this.parent || this.group.parent) return;
    if (this.siblingIndex < this.parent.children.length) {
      this.group.parent = this.parent;
      this.parent.children.splice(this.siblingIndex, 0, this.group);
      return;
    }
    this.parent.add(this.group);
  }
}
