import * as THREE from 'three';
import { CommandStack } from '../../commands/command_stack.js';
import { CreateGreyBoxCommand } from '../../commands/greybox/create_grey_box_command.js';
import { SelectionManager } from '../../selection/object/selection_manager.js';
import { computeOcclusionAwareSpawnPosition, DEFAULT_SPAWN_DISTANCE } from '../../navigation/object_spawn_placement.js';
import { DEFAULT_GREY_BOX_SIZE, createDefaultGreyBoxMesh } from '../../greybox/model/grey_box_factory.js';
import { allocateGreyBoxName } from '../../greybox/model/grey_box_naming.js';

/** Callback invoked after a grey box is created and added to the scene. */
export type GreyBoxCreatedCallback = (mesh: THREE.Mesh) => void;

/**
 * Creates grey box planning volumes from the Add menu: allocates a unique name,
 * places the volume in view, registers the creation on the command stack, and
 * selects it.
 */
export class GreyBoxCreationHandler {
  private worldObject: THREE.Group;
  private commandStack: CommandStack;
  private selectionManager: SelectionManager;
  private onGreyBoxCreated: GreyBoxCreatedCallback | null;
  private getActiveCamera: (() => THREE.Camera | null) | null;
  private getGridInterval: (() => number) | null;

  /**
   * Creates a grey box creation handler.
   *
   * @param worldObject Root group that receives new volumes.
   * @param commandStack Command stack for undo support.
   * @param selectionManager Selection manager for post-creation selection.
   */
  constructor(worldObject: THREE.Group, commandStack: CommandStack, selectionManager: SelectionManager) {
    this.worldObject = worldObject;
    this.commandStack = commandStack;
    this.selectionManager = selectionManager;
    this.onGreyBoxCreated = null;
    this.getActiveCamera = null;
    this.getGridInterval = null;
  }

  /**
   * Sets the callback invoked after a volume is created.
   *
   * @param callback Function called with the new volume, or null to clear.
   */
  setOnGreyBoxCreated(callback: GreyBoxCreatedCallback | null): void {
    this.onGreyBoxCreated = callback;
  }

  /**
   * Provides the active view camera used for spawn placement.
   *
   * @param callback Returns the camera, or null when unavailable.
   */
  setActiveCameraProvider(callback: (() => THREE.Camera | null) | null): void {
    this.getActiveCamera = callback;
  }

  /**
   * Provides the current grid interval for snapping spawn positions.
   *
   * @param callback Returns a positive grid step.
   */
  setGridIntervalProvider(callback: (() => number) | null): void {
    this.getGridInterval = callback;
  }

  /**
   * Creates a grey box volume, pushes the undoable command, and selects it.
   *
   * @returns The created volume.
   */
  createGreyBox(): THREE.Mesh {
    const mesh = createDefaultGreyBoxMesh(allocateGreyBoxName(this.worldObject));
    this.applySpawnPlacement(mesh);
    this.commandStack.push(new CreateGreyBoxCommand(mesh, this.worldObject));
    this.onGreyBoxCreated?.(mesh);
    this.selectionManager.selectObject(mesh);
    return mesh;
  }

  /**
   * Positions a new volume in front of the active camera, snapped to the grid.
   *
   * @param mesh Newly created volume.
   */
  private applySpawnPlacement(mesh: THREE.Mesh): void {
    const camera = this.getActiveCamera?.() ?? null;
    if (!camera) {
      mesh.position.set(0, 0, 0);
      return;
    }
    mesh.position.copy(
      computeOcclusionAwareSpawnPosition({
        camera,
        preferredDistance: DEFAULT_SPAWN_DISTANCE,
        gridInterval: this.getGridInterval?.() ?? 1,
        raycastRoot: this.worldObject,
        objectRadius: DEFAULT_GREY_BOX_SIZE / 2,
      }),
    );
  }
}
