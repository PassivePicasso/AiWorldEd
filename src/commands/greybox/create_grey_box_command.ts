import * as THREE from 'three';
import { UndoCommand } from '../undo_command.js';

/**
 * Undoable creation of a grey box planning volume. Undo detaches the mesh
 * without disposing it, and its layout payload stays registered, so redo
 * restores the same volume with its description and connections intact.
 */
export class CreateGreyBoxCommand implements UndoCommand {
  private mesh: THREE.Mesh;
  private parent: THREE.Object3D;

  /**
   * Creates a grey box creation command.
   *
   * @param mesh Registered grey box mesh to attach.
   * @param parent Parent that receives the volume.
   */
  constructor(mesh: THREE.Mesh, parent: THREE.Object3D) {
    this.mesh = mesh;
    this.parent = parent;
  }

  /** Attaches the volume to its parent. No-op when already attached. */
  execute(): void {
    if (this.mesh.parent) return;
    this.parent.add(this.mesh);
  }

  /** Detaches the volume, keeping geometry, material, and payload for redo. */
  undo(): void {
    if (this.mesh.parent) {
      this.mesh.parent.remove(this.mesh);
    }
  }
}
