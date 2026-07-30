import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { Theme } from '../../src/theme.js';
import { PropertiesContextSections } from '../../src/ui/properties/properties_context_sections.js';
import { buildGreyBoxConnectionRows } from '../../src/ui/properties/grey_box_connection_rows.js';
import { createGreyBoxConnectionHandlers } from '../../src/managers/hierarchy/grey_box_connection_actions.js';
import { buildGreyBoxSceneGraph } from '../../src/greybox/connectivity/grey_box_scene_graph.js';
import { CommandStack } from '../../src/commands/command_stack.js';
import { createGreyBoxMesh } from '../../src/greybox/model/grey_box_factory.js';
import { getGreyBoxId } from '../../src/greybox/model/grey_box_access.js';
import {
  addGreyBoxConnection,
  isDerivedConnectionSuppressed,
  listGreyBoxConnections,
} from '../../src/greybox/model/grey_box_connection_access.js';
import { greyBoxPairKey } from '../../src/greybox/model/grey_box_pair_key.js';
import { setObjectLocked } from '../../src/utils/object_lock.js';

const COMMAND_STACK_LIMIT = 32;

describe('buildGreyBoxConnectionRows', () => {
  let world: THREE.Group;
  let left: THREE.Mesh;
  let right: THREE.Mesh;
  let detached: THREE.Mesh;

  beforeEach(() => {
    world = new THREE.Group();
    left = createGreyBoxMesh('Left', 10, 10, 10);
    right = createGreyBoxMesh('Right', 10, 10, 10);
    right.position.set(10, 0, 0);
    detached = createGreyBoxMesh('Detached', 10, 10, 10);
    detached.position.set(0, 40, 0);
    world.add(left);
    world.add(right);
    world.add(detached);
  });

  it('lists a derived neighbour with its shared face size', () => {
    const rows = buildGreyBoxConnectionRows(buildGreyBoxSceneGraph(world), getGreyBoxId(left));
    expect(rows.length).toBe(1);
    expect(rows[0]!.source).toBe('derived');
    expect(rows[0]!.label).toContain('Right');
    expect(rows[0]!.label).toContain('shared face');
  });

  it('omits neighbours of other volumes', () => {
    const rows = buildGreyBoxConnectionRows(buildGreyBoxSceneGraph(world), getGreyBoxId(detached));
    expect(rows).toEqual([]);
  });

  it('lists an authored link with its kind and owner', () => {
    addGreyBoxConnection(left, getGreyBoxId(detached), 'elevator', 'keycard', 'forward');
    const rows = buildGreyBoxConnectionRows(buildGreyBoxSceneGraph(world), getGreyBoxId(left));
    const authored = rows.find((row) => row.source === 'authored')!;
    expect(authored.label).toContain('elevator');
    expect(authored.label).toContain('one way');
    expect(authored.detail).toBe('keycard');
    expect(authored.authoredOwnerId).toBe(getGreyBoxId(left));
  });

  it('shows an authored link on the target volume too, owned by its author', () => {
    addGreyBoxConnection(left, getGreyBoxId(detached), 'elevator', '', 'bidirectional');
    const rows = buildGreyBoxConnectionRows(buildGreyBoxSceneGraph(world), getGreyBoxId(detached));
    const authored = rows.find((row) => row.source === 'authored')!;
    expect(authored.label).toContain('Left');
    expect(authored.authoredOwnerId).toBe(getGreyBoxId(left));
  });

  it('keeps a muted adjacency visible so it can be restored', () => {
    const commandStack = new CommandStack(COMMAND_STACK_LIMIT);
    const handlers = createGreyBoxConnectionHandlers(commandStack, world, () => undefined);
    const pairKey = greyBoxPairKey(getGreyBoxId(left), getGreyBoxId(right));
    handlers.onSetSuppressed(getGreyBoxId(left), pairKey, true);
    const rows = buildGreyBoxConnectionRows(buildGreyBoxSceneGraph(world), getGreyBoxId(left));
    expect(rows.length).toBe(1);
    expect(rows[0]!.suppressed).toBe(true);
    expect(rows[0]!.label).toContain('muted');
  });

  it('states how much of the selected volume an overlap consumes', () => {
    right.position.set(5, 0, 0);
    const rows = buildGreyBoxConnectionRows(buildGreyBoxSceneGraph(world), getGreyBoxId(left));
    expect(rows[0]!.label).toContain('overlapping 50%');
  });

  it('reports the overlap as a fraction of the selected volume, not the other', () => {
    right.position.set(40, 0, 0);
    const narrow = createGreyBoxMesh('Narrow', 5, 10, 10);
    narrow.position.set(7, 0, 0);
    world.add(narrow);
    const leftRows = buildGreyBoxConnectionRows(buildGreyBoxSceneGraph(world), getGreyBoxId(left));
    const narrowRows = buildGreyBoxConnectionRows(buildGreyBoxSceneGraph(world), getGreyBoxId(narrow));
    expect(leftRows[0]!.label).toContain('overlapping 5%');
    expect(narrowRows[0]!.label).toContain('overlapping 10%');
  });
});

describe('grey box connection handlers', () => {
  let world: THREE.Group;
  let commandStack: CommandStack;
  let left: THREE.Mesh;
  let right: THREE.Mesh;

  beforeEach(() => {
    world = new THREE.Group();
    commandStack = new CommandStack(COMMAND_STACK_LIMIT);
    left = createGreyBoxMesh('Left', 10, 10, 10);
    right = createGreyBoxMesh('Right', 10, 10, 10);
    right.position.set(40, 0, 0);
    world.add(left);
    world.add(right);
  });

  it('connects two volumes by id as one undoable step', () => {
    const handlers = createGreyBoxConnectionHandlers(commandStack, world, () => undefined);
    handlers.onConnect(getGreyBoxId(left), getGreyBoxId(right));
    expect(listGreyBoxConnections(left).length).toBe(1);
    expect(commandStack.getUndoCount()).toBe(1);
    commandStack.undo();
    expect(listGreyBoxConnections(left)).toEqual([]);
  });

  it('removes an authored link by owner id', () => {
    const handlers = createGreyBoxConnectionHandlers(commandStack, world, () => undefined);
    handlers.onConnect(getGreyBoxId(left), getGreyBoxId(right));
    const connectionId = listGreyBoxConnections(left)[0]!.id;
    handlers.onRemoveAuthored(getGreyBoxId(left), connectionId);
    expect(listGreyBoxConnections(left)).toEqual([]);
    commandStack.undo();
    expect(listGreyBoxConnections(left).length).toBe(1);
  });

  it('mutes an adjacency by owner id', () => {
    const handlers = createGreyBoxConnectionHandlers(commandStack, world, () => undefined);
    const pairKey = greyBoxPairKey(getGreyBoxId(left), getGreyBoxId(right));
    handlers.onSetSuppressed(getGreyBoxId(left), pairKey, true);
    expect(isDerivedConnectionSuppressed(left, pairKey)).toBe(true);
  });

  it('ignores an unknown volume id', () => {
    const handlers = createGreyBoxConnectionHandlers(commandStack, world, () => undefined);
    handlers.onConnect('greybox-missing', getGreyBoxId(right));
    expect(commandStack.getUndoCount()).toBe(0);
  });

  it('refuses to edit a locked volume', () => {
    setObjectLocked(left, true);
    const handlers = createGreyBoxConnectionHandlers(commandStack, world, () => undefined);
    handlers.onConnect(getGreyBoxId(left), getGreyBoxId(right));
    expect(listGreyBoxConnections(left)).toEqual([]);
  });

  it('rebuilds the graph when asked', () => {
    let rebuilds = 0;
    const handlers = createGreyBoxConnectionHandlers(commandStack, world, () => rebuilds++);
    handlers.onGraphChanged();
    expect(rebuilds).toBe(1);
  });
});

describe('grey box connections inspector section', () => {
  let world: THREE.Group;
  let host: HTMLElement;
  let sections: PropertiesContextSections;
  let commandStack: CommandStack;
  let left: THREE.Mesh;
  let right: THREE.Mesh;

  beforeEach(() => {
    world = new THREE.Group();
    host = document.createElement('div');
    commandStack = new CommandStack(COMMAND_STACK_LIMIT);
    left = createGreyBoxMesh('Left', 10, 10, 10);
    right = createGreyBoxMesh('Right', 10, 10, 10);
    right.position.set(10, 0, 0);
    world.add(left);
    world.add(right);
    sections = new PropertiesContextSections(
      Theme,
      () => document.createElement('div'),
      (title) => {
        const header = document.createElement('div');
        header.textContent = title;
        return header;
      },
      () => 'rgb(0, 0, 0)',
    );
    sections.setEditableBrushMeshProvider(() => []);
    sections.setGreyBoxConnectionHandlers(
      createGreyBoxConnectionHandlers(commandStack, world, (graph) => sections.setGreyBoxGraph(graph)),
    );
    sections.mountInto(host, () => undefined);
    sections.setGreyBoxGraph(buildGreyBoxSceneGraph(world));
  });

  it('stays hidden without a grey box selection', () => {
    expect(connectionsSection(host).style.display).toBe('none');
  });

  it('lists the derived neighbour of the selected volume', () => {
    sections.updateFromObjects([left]);
    expect(connectionsSection(host).style.display).toBe('block');
    expect(connectionsSection(host).textContent).toContain('Right');
  });

  it('mutes an adjacency from its row action', () => {
    sections.updateFromObjects([left]);
    clickButtonWithText(connectionsSection(host), 'Mute');
    const pairKey = greyBoxPairKey(getGreyBoxId(left), getGreyBoxId(right));
    expect(isDerivedConnectionSuppressed(left, pairKey)).toBe(true);
    expect(connectionsSection(host).textContent).toContain('muted');
  });

  it('restores a muted adjacency from its row action', () => {
    sections.updateFromObjects([left]);
    clickButtonWithText(connectionsSection(host), 'Mute');
    clickButtonWithText(connectionsSection(host), 'Unmute');
    const pairKey = greyBoxPairKey(getGreyBoxId(left), getGreyBoxId(right));
    expect(isDerivedConnectionSuppressed(left, pairKey)).toBe(false);
  });

  it('offers a connect action for a two-volume selection', () => {
    sections.updateFromObjects([left, right]);
    const button = findButtonWithText(connectionsSection(host), 'Connect selected two');
    expect(button).not.toBeNull();
    button!.click();
    expect(listGreyBoxConnections(left).length).toBe(1);
  });

  it('hides the connect action for a single selection', () => {
    sections.updateFromObjects([left]);
    const button = findButtonWithText(connectionsSection(host), 'Connect selected two');
    expect(button!.style.display).toBe('none');
  });

  it('removes an authored link from its row action', () => {
    addGreyBoxConnection(left, getGreyBoxId(right), 'door', '', 'bidirectional');
    sections.setGreyBoxGraph(buildGreyBoxSceneGraph(world));
    sections.updateFromObjects([left]);
    clickButtonWithText(connectionsSection(host), 'Remove');
    expect(listGreyBoxConnections(left)).toEqual([]);
  });
});

/**
 * Finds the connections section among the mounted sections.
 *
 * @param host Container the sections were mounted into.
 * @returns Connections section element.
 */
function connectionsSection(host: HTMLElement): HTMLElement {
  const match = (Array.from(host.children) as HTMLElement[]).find((section) =>
    section.textContent?.includes('Grey Box Connections'),
  );
  expect(match).toBeDefined();
  return match!;
}

/**
 * Finds a button by its visible text.
 *
 * @param root Element to search.
 * @param text Button text to match.
 * @returns The button, or null when absent.
 */
function findButtonWithText(root: HTMLElement, text: string): HTMLButtonElement | null {
  const buttons = Array.from(root.querySelectorAll('button')) as HTMLButtonElement[];
  return buttons.find((button) => button.textContent === text) ?? null;
}

/**
 * Clicks a button by its visible text, failing the test when absent.
 *
 * @param root Element to search.
 * @param text Button text to match.
 */
function clickButtonWithText(root: HTMLElement, text: string): void {
  const button = findButtonWithText(root, text);
  expect(button).not.toBeNull();
  button!.click();
}
