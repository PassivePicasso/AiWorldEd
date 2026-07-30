import * as THREE from 'three';
import { UndoCommand } from '../undo_command.js';
import {
  getGreyBoxSizeIntent,
  getGreyBoxSurfaceIntent,
  setGreyBoxSizeIntent,
  setGreyBoxSurfaceField,
} from '../../greybox/model/grey_box_access.js';
import {
  GREY_BOX_SURFACE_FIELDS,
  GreyBoxSizeIntent,
  GreyBoxSurfaceIntent,
  cloneSurfaceIntent,
} from '../../greybox/model/grey_box_intent.js';

/** Intent fields an edit may change; omitted fields are left alone. */
export interface GreyBoxIntentPatch {
  sizeIntent?: GreyBoxSizeIntent;
  surface?: Partial<GreyBoxSurfaceIntent>;
}

/**
 * Undoable change to a volume's authoring intent: how firm its dimensions are
 * and how its surfaces should feel. One command covers a whole editing session
 * on one field, so typing a mood is a single undo step.
 */
export class SetGreyBoxIntentCommand implements UndoCommand {
  private readonly greyBox: THREE.Object3D;
  private readonly previousSizeIntent: GreyBoxSizeIntent;
  private readonly previousSurface: GreyBoxSurfaceIntent;
  private readonly patch: GreyBoxIntentPatch;

  /**
   * Creates an intent edit command.
   *
   * @param greyBox Volume being described.
   * @param previousSizeIntent Size intent before the edit.
   * @param previousSurface Surface intent before the edit.
   * @param patch Fields to change.
   */
  constructor(
    greyBox: THREE.Object3D,
    previousSizeIntent: GreyBoxSizeIntent,
    previousSurface: GreyBoxSurfaceIntent,
    patch: GreyBoxIntentPatch,
  ) {
    this.greyBox = greyBox;
    this.previousSizeIntent = previousSizeIntent;
    this.previousSurface = cloneSurfaceIntent(previousSurface);
    this.patch = patch;
  }

  /**
   * Builds a command from the volume's current intent.
   *
   * @param greyBox Volume being described.
   * @param patch Fields to change.
   * @returns Command capturing the current intent as its undo state.
   */
  static fromCurrent(greyBox: THREE.Object3D, patch: GreyBoxIntentPatch): SetGreyBoxIntentCommand {
    return new SetGreyBoxIntentCommand(greyBox, getGreyBoxSizeIntent(greyBox), getGreyBoxSurfaceIntent(greyBox), patch);
  }

  /** Applies the patched fields. */
  execute(): void {
    if (this.patch.sizeIntent !== undefined) {
      setGreyBoxSizeIntent(this.greyBox, this.patch.sizeIntent);
    }
    for (const field of GREY_BOX_SURFACE_FIELDS) {
      const value = this.patch.surface?.[field];
      if (value !== undefined) setGreyBoxSurfaceField(this.greyBox, field, value);
    }
  }

  /** Restores the intent from before the edit. */
  undo(): void {
    setGreyBoxSizeIntent(this.greyBox, this.previousSizeIntent);
    for (const field of GREY_BOX_SURFACE_FIELDS) {
      setGreyBoxSurfaceField(this.greyBox, field, this.previousSurface[field]);
    }
  }

  /**
   * Returns whether this command would change anything.
   *
   * @returns True when at least one patched field differs from the stored
   *   value.
   */
  changesIntent(): boolean {
    if (this.patch.sizeIntent !== undefined && this.patch.sizeIntent !== this.previousSizeIntent) return true;
    return GREY_BOX_SURFACE_FIELDS.some((field) => {
      const value = this.patch.surface?.[field];
      return value !== undefined && value !== this.previousSurface[field];
    });
  }
}
