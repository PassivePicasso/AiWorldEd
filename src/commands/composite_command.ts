import { UndoCommand } from './undo_command.js';

/**
 * Runs several commands as one undo entry. Undo reverses them in the opposite
 * order so paired effects — deleting an object and pruning the references to it
 * — restore together rather than needing two undos.
 */
export class CompositeCommand implements UndoCommand {
  private readonly commands: UndoCommand[];

  /**
   * Creates a composite from commands in application order.
   *
   * @param commands Commands to run as one step.
   */
  constructor(commands: UndoCommand[]) {
    this.commands = commands;
  }

  /** Executes every command in order. */
  execute(): void {
    for (const command of this.commands) {
      command.execute();
    }
  }

  /** Undoes every command in reverse order. */
  undo(): void {
    for (let index = this.commands.length - 1; index >= 0; index--) {
      this.commands[index]!.undo();
    }
  }
}
