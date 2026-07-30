import * as THREE from 'three';
import { UndoCommand } from '../undo_command.js';
import { GreyBoxConnectionDirection, GreyBoxExplicitConnection } from '../../greybox/model/grey_box_connection.js';
import {
  GreyBoxConnectionEdits,
  addGreyBoxConnection,
  editGreyBoxConnection,
  findGreyBoxConnection,
  removeGreyBoxConnection,
  restoreGreyBoxConnection,
  setDerivedConnectionSuppressed,
} from '../../greybox/model/grey_box_connection_access.js';

/** Undoable creation of an authored link between two grey boxes. */
export class AddGreyBoxConnectionCommand implements UndoCommand {
  private readonly owner: THREE.Object3D;
  private readonly targetId: string;
  private readonly kind: string;
  private readonly note: string;
  private readonly direction: GreyBoxConnectionDirection;
  private created: GreyBoxExplicitConnection | null;

  /**
   * Creates an add-connection command.
   *
   * @param owner Grey box that will own the link.
   * @param targetId Id of the volume on the far side.
   * @param kind Free-form route label.
   * @param note User note; empty string when none.
   * @param direction Whether the route is traversable both ways.
   */
  constructor(
    owner: THREE.Object3D,
    targetId: string,
    kind: string,
    note: string,
    direction: GreyBoxConnectionDirection,
  ) {
    this.owner = owner;
    this.targetId = targetId;
    this.kind = kind;
    this.note = note;
    this.direction = direction;
    this.created = null;
  }

  /** Adds the link, reusing the same id when redone. */
  execute(): void {
    if (this.created) {
      restoreGreyBoxConnection(this.owner, this.created, Number.MAX_SAFE_INTEGER);
      return;
    }
    this.created = addGreyBoxConnection(this.owner, this.targetId, this.kind, this.note, this.direction);
  }

  /** Removes the link. */
  undo(): void {
    if (!this.created) return;
    removeGreyBoxConnection(this.owner, this.created.id);
  }

  /**
   * Returns the created link for callers that need its id.
   *
   * @returns The stored link, or null before execution.
   */
  getCreatedConnection(): GreyBoxExplicitConnection | null {
    return this.created;
  }
}

/** Undoable removal of an authored link, restoring its original position. */
export class RemoveGreyBoxConnectionCommand implements UndoCommand {
  private readonly owner: THREE.Object3D;
  private readonly connectionId: string;
  private removed: GreyBoxExplicitConnection | null;
  private removedIndex: number;

  /**
   * Creates a remove-connection command.
   *
   * @param owner Grey box that owns the link.
   * @param connectionId Id of the link to remove.
   */
  constructor(owner: THREE.Object3D, connectionId: string) {
    this.owner = owner;
    this.connectionId = connectionId;
    this.removed = null;
    this.removedIndex = -1;
  }

  /** Removes the link, remembering where it was. */
  execute(): void {
    this.removed = findGreyBoxConnection(this.owner, this.connectionId);
    this.removedIndex = removeGreyBoxConnection(this.owner, this.connectionId);
  }

  /** Reinstates the link at its original index. */
  undo(): void {
    if (!this.removed || this.removedIndex < 0) return;
    restoreGreyBoxConnection(this.owner, this.removed, this.removedIndex);
  }
}

/** Undoable edit of an authored link's label, note, or direction. */
export class EditGreyBoxConnectionCommand implements UndoCommand {
  private readonly owner: THREE.Object3D;
  private readonly connectionId: string;
  private readonly edits: GreyBoxConnectionEdits;
  private previous: GreyBoxExplicitConnection | null;

  /**
   * Creates an edit-connection command.
   *
   * @param owner Grey box that owns the link.
   * @param connectionId Id of the link to edit.
   * @param edits Fields to change.
   */
  constructor(owner: THREE.Object3D, connectionId: string, edits: GreyBoxConnectionEdits) {
    this.owner = owner;
    this.connectionId = connectionId;
    this.edits = edits;
    this.previous = null;
  }

  /** Applies the edits, remembering the prior values. */
  execute(): void {
    this.previous = findGreyBoxConnection(this.owner, this.connectionId);
    editGreyBoxConnection(this.owner, this.connectionId, this.edits);
  }

  /** Restores the prior label, note, and direction. */
  undo(): void {
    if (!this.previous) return;
    editGreyBoxConnection(this.owner, this.connectionId, {
      kind: this.previous.kind,
      note: this.previous.note,
      direction: this.previous.direction,
    });
  }
}

/** Undoable mute or unmute of a derived adjacency. */
export class SetGreyBoxSuppressionCommand implements UndoCommand {
  private readonly owner: THREE.Object3D;
  private readonly pairKey: string;
  private readonly suppressed: boolean;

  /**
   * Creates a suppression command.
   *
   * @param owner Grey box recording the mute.
   * @param pairKey Canonical pair key of the adjacency.
   * @param suppressed True to mute, false to restore.
   */
  constructor(owner: THREE.Object3D, pairKey: string, suppressed: boolean) {
    this.owner = owner;
    this.pairKey = pairKey;
    this.suppressed = suppressed;
  }

  /** Applies the mute state. */
  execute(): void {
    setDerivedConnectionSuppressed(this.owner, this.pairKey, this.suppressed);
  }

  /** Restores the opposite mute state. */
  undo(): void {
    setDerivedConnectionSuppressed(this.owner, this.pairKey, !this.suppressed);
  }
}
