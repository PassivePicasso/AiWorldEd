import * as THREE from 'three';
import { UndoCommand } from '../undo_command.js';
import { GreyBoxExplicitConnection } from '../../greybox/model/grey_box_connection.js';
import { GreyBoxRegistry } from '../../greybox/model/grey_box_registry.js';
import { isGreyBox } from '../../greybox/model/grey_box_keys.js';
import { pruneGreyBoxConnectionsTo, restoreGreyBoxConnection } from '../../greybox/model/grey_box_connection_access.js';

/** One authored link removed because its target went away. */
interface PrunedReference {
  owner: THREE.Object3D;
  connection: GreyBoxExplicitConnection;
  index: number;
}

/**
 * Removes authored links pointing at grey boxes that are being deleted, so no
 * connection dangles. Pair this with the delete command in a CompositeCommand
 * so one undo restores both the volumes and the links to them.
 */
export class PruneGreyBoxReferencesCommand implements UndoCommand {
  private readonly searchRoot: THREE.Object3D;
  private readonly removedGreyBoxIds: string[];
  private pruned: PrunedReference[];

  /**
   * Creates a reference-pruning command.
   *
   * @param searchRoot Root to search for volumes holding links.
   * @param removedGreyBoxIds Ids of the volumes going away.
   */
  constructor(searchRoot: THREE.Object3D, removedGreyBoxIds: string[]) {
    this.searchRoot = searchRoot;
    this.removedGreyBoxIds = removedGreyBoxIds;
    this.pruned = [];
  }

  /**
   * Collects the grey box ids in a set of objects about to be deleted.
   *
   * @param objects Objects being deleted.
   * @returns Ids of the registered grey boxes among them.
   */
  static collectGreyBoxIds(objects: THREE.Object3D[]): string[] {
    const ids: string[] = [];
    for (const object of objects) {
      object.traverse((candidate) => {
        if (!isGreyBox(candidate)) return;
        const data = GreyBoxRegistry.tryGet(candidate);
        if (data) ids.push(data.id);
      });
    }
    return ids;
  }

  /** Removes every link pointing at the departing volumes. */
  execute(): void {
    this.pruned = [];
    for (const owner of GreyBoxRegistry.collectUnder(this.searchRoot)) {
      if (!GreyBoxRegistry.has(owner)) continue;
      this.pruneOwner(owner);
    }
  }

  /** Restores the removed links at their original positions. */
  undo(): void {
    for (let index = this.pruned.length - 1; index >= 0; index--) {
      const entry = this.pruned[index]!;
      restoreGreyBoxConnection(entry.owner, entry.connection, entry.index);
    }
    this.pruned = [];
  }

  /**
   * Prunes links on one volume for every departing id.
   *
   * @param owner Volume whose links are checked.
   */
  private pruneOwner(owner: THREE.Object3D): void {
    for (const removedId of this.removedGreyBoxIds) {
      for (const entry of pruneGreyBoxConnectionsTo(owner, removedId)) {
        this.pruned.push({ owner, connection: entry.connection, index: entry.index });
      }
    }
  }
}
