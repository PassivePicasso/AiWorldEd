import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { Theme } from '../../src/theme.js';
import {
  DEFAULT_GREY_BOX_SIZE_INTENT,
  GREY_BOX_SURFACE_FIELDS,
  createEmptySurfaceIntent,
  hasSurfaceIntent,
  isGreyBoxSizeIntent,
} from '../../src/greybox/model/grey_box_intent.js';
import {
  getGreyBoxSizeIntent,
  getGreyBoxSurfaceIntent,
  setGreyBoxSurfaceField,
} from '../../src/greybox/model/grey_box_access.js';
import { SetGreyBoxIntentCommand } from '../../src/commands/greybox/set_grey_box_intent_command.js';
import { commitGreyBoxIntent } from '../../src/managers/hierarchy/grey_box_description_commit.js';
import { CommandStack } from '../../src/commands/command_stack.js';
import { GreyBoxCodec } from '../../src/greybox/io/grey_box_codec.js';
import { createGreyBoxData } from '../../src/greybox/model/grey_box_data.js';
import { createDefaultGreyBoxMesh } from '../../src/greybox/model/grey_box_factory.js';
import { PropertiesContextSections } from '../../src/ui/properties/properties_context_sections.js';
import { setObjectLocked } from '../../src/utils/object_lock.js';

const COMMAND_STACK_LIMIT = 32;

describe('grey box authoring intent', () => {
  let commandStack: CommandStack;

  beforeEach(() => {
    commandStack = new CommandStack(COMMAND_STACK_LIMIT);
  });

  it('starts a new volume as approximate', () => {
    expect(getGreyBoxSizeIntent(createDefaultGreyBoxMesh('GreyBox001'))).toBe('approximate');
    expect(DEFAULT_GREY_BOX_SIZE_INTENT).toBe('approximate');
  });

  it('starts a new volume with every surface field empty', () => {
    const surface = getGreyBoxSurfaceIntent(createDefaultGreyBoxMesh('GreyBox001'));
    for (const field of GREY_BOX_SURFACE_FIELDS) {
      expect(surface[field], field).toBe('');
    }
    expect(hasSurfaceIntent(surface)).toBe(false);
  });

  it('recognizes only the two fixity values', () => {
    expect(isGreyBoxSizeIntent('exact')).toBe(true);
    expect(isGreyBoxSizeIntent('approximate')).toBe(true);
    expect(isGreyBoxSizeIntent('measured')).toBe(false);
  });

  it('marks a volume exact and undoes it', () => {
    const mesh = createDefaultGreyBoxMesh('GreyBox001');
    const command = SetGreyBoxIntentCommand.fromCurrent(mesh, { sizeIntent: 'exact' });
    command.execute();
    expect(getGreyBoxSizeIntent(mesh)).toBe('exact');
    command.undo();
    expect(getGreyBoxSizeIntent(mesh)).toBe('approximate');
  });

  it('writes one surface field without disturbing the others', () => {
    const mesh = createDefaultGreyBoxMesh('GreyBox001');
    setGreyBoxSurfaceField(mesh, 'wall', 'brick, soot-stained');
    SetGreyBoxIntentCommand.fromCurrent(mesh, { surface: { floor: 'wet stone' } }).execute();
    const surface = getGreyBoxSurfaceIntent(mesh);
    expect(surface.floor).toBe('wet stone');
    expect(surface.wall).toBe('brick, soot-stained');
  });

  it('restores every surface field on undo', () => {
    const mesh = createDefaultGreyBoxMesh('GreyBox001');
    setGreyBoxSurfaceField(mesh, 'mood', 'oppressive');
    const command = SetGreyBoxIntentCommand.fromCurrent(mesh, { surface: { mood: 'airy', floor: 'sand' } });
    command.execute();
    command.undo();
    const surface = getGreyBoxSurfaceIntent(mesh);
    expect(surface.mood).toBe('oppressive');
    expect(surface.floor).toBe('');
  });

  it('treats clearing a surface field as a real edit', () => {
    const mesh = createDefaultGreyBoxMesh('GreyBox001');
    setGreyBoxSurfaceField(mesh, 'floor', 'wet stone');
    const command = SetGreyBoxIntentCommand.fromCurrent(mesh, { surface: { floor: '' } });
    expect(command.changesIntent()).toBe(true);
    command.execute();
    expect(getGreyBoxSurfaceIntent(mesh).floor).toBe('');
  });

  it('reports an edit that changes nothing', () => {
    const mesh = createDefaultGreyBoxMesh('GreyBox001');
    expect(SetGreyBoxIntentCommand.fromCurrent(mesh, { sizeIntent: 'approximate' }).changesIntent()).toBe(false);
    expect(SetGreyBoxIntentCommand.fromCurrent(mesh, { surface: { floor: '' } }).changesIntent()).toBe(false);
  });

  it('returns copies so stored intent cannot be mutated through a handle', () => {
    const mesh = createDefaultGreyBoxMesh('GreyBox001');
    const surface = getGreyBoxSurfaceIntent(mesh);
    surface.floor = 'mutated';
    expect(getGreyBoxSurfaceIntent(mesh).floor).toBe('');
  });

  it('pushes one undo entry per committed edit and skips no-ops', () => {
    const mesh = createDefaultGreyBoxMesh('GreyBox001');
    commitGreyBoxIntent(commandStack, mesh, { sizeIntent: 'exact' });
    commitGreyBoxIntent(commandStack, mesh, { sizeIntent: 'exact' });
    expect(commandStack.getUndoCount()).toBe(1);
  });

  it('refuses to record intent on a locked volume', () => {
    const mesh = createDefaultGreyBoxMesh('GreyBox001');
    setObjectLocked(mesh, true);
    commitGreyBoxIntent(commandStack, mesh, { sizeIntent: 'exact' });
    expect(getGreyBoxSizeIntent(mesh)).toBe('approximate');
  });
});

describe('grey box intent persistence', () => {
  it('round-trips fixity and every surface field', () => {
    const data = createGreyBoxData('greybox-1', 'a crypt', 'room');
    data.sizeIntent = 'exact';
    data.surface = { floor: 'wet stone', wall: 'brick', ceiling: 'beams', mood: 'oppressive' };
    const decoded = GreyBoxCodec.decode(GreyBoxCodec.encode(data), '"Crypt" (uuid)');
    expect(decoded.sizeIntent).toBe('exact');
    expect(decoded.surface).toEqual(data.surface);
  });

  it('round-trips empty surface fields as empty rather than absent', () => {
    const data = createGreyBoxData('greybox-1', '', 'room');
    const decoded = GreyBoxCodec.decode(GreyBoxCodec.encode(data), '"Blank" (uuid)');
    expect(decoded.surface).toEqual(createEmptySurfaceIntent());
  });

  it('migrates a payload written before intent existed', () => {
    const payload = {
      id: 'greybox-1',
      description: 'older scene',
      role: 'room',
      explicitConnections: [],
      suppressedDerivedConnections: [],
    };
    const decoded = GreyBoxCodec.decode(payload, '"Legacy" (uuid)');
    expect(decoded.sizeIntent).toBe(DEFAULT_GREY_BOX_SIZE_INTENT);
    expect(decoded.surface).toEqual(createEmptySurfaceIntent());
  });

  it('rejects an unknown fixity value', () => {
    const payload = {
      id: 'greybox-1',
      description: '',
      sizeIntent: 'measured',
      explicitConnections: [],
      suppressedDerivedConnections: [],
    };
    expect(() => GreyBoxCodec.decode(payload, '"Broken" (uuid)')).toThrow(/unknown sizeIntent/);
  });

  it('rejects a surface field that is present but not a string', () => {
    const payload = {
      id: 'greybox-1',
      description: '',
      surface: { floor: 5, wall: '', ceiling: '', mood: '' },
      explicitConnections: [],
      suppressedDerivedConnections: [],
    };
    expect(() => GreyBoxCodec.decode(payload, '"Broken" (uuid)')).toThrow(/surface floor/);
  });
});

describe('grey box intent inspector section', () => {
  let host: HTMLElement;
  let sections: PropertiesContextSections;
  let commandStack: CommandStack;
  let mesh: THREE.Mesh;

  beforeEach(() => {
    host = document.createElement('div');
    commandStack = new CommandStack(COMMAND_STACK_LIMIT);
    mesh = createDefaultGreyBoxMesh('GreyBox001');
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
    sections.setGreyBoxIntentCommitter((greyBox, patch) => commitGreyBoxIntent(commandStack, greyBox, patch));
    sections.mountInto(host, () => undefined);
  });

  it('stays hidden until a grey box is selected', () => {
    expect(intentSection(host).style.display).toBe('none');
    sections.updateFromObjects([mesh]);
    expect(intentSection(host).style.display).toBe('block');
  });

  it('commits a fixity toggle as one undo entry', () => {
    sections.updateFromObjects([mesh]);
    const toggle = intentSection(host).querySelector('input[type="checkbox"]') as HTMLInputElement;
    toggle.checked = true;
    toggle.dispatchEvent(new Event('change'));
    expect(getGreyBoxSizeIntent(mesh)).toBe('exact');
    expect(commandStack.getUndoCount()).toBe(1);
  });

  it('commits a surface field on blur', () => {
    sections.updateFromObjects([mesh]);
    const input = surfaceInput(host, 'wet stone, puddles');
    input.dispatchEvent(new FocusEvent('focus'));
    input.value = 'cracked tile';
    input.dispatchEvent(new FocusEvent('blur'));
    expect(getGreyBoxSurfaceIntent(mesh).floor).toBe('cracked tile');
  });

  it('reverts a surface field on Escape', () => {
    sections.updateFromObjects([mesh]);
    const input = surfaceInput(host, 'oppressive, low light');
    input.dispatchEvent(new FocusEvent('focus'));
    input.value = 'discard me';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(input.value).toBe('');
    expect(getGreyBoxSurfaceIntent(mesh).mood).toBe('');
  });

  it('disables the fields for a multi-volume selection', () => {
    sections.updateFromObjects([mesh, createDefaultGreyBoxMesh('GreyBox002')]);
    const toggle = intentSection(host).querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(toggle.disabled).toBe(true);
  });

  it('does not lose an in-flight edit when the selection changes', () => {
    sections.updateFromObjects([mesh]);
    const input = surfaceInput(host, 'brick, soot-stained');
    input.dispatchEvent(new FocusEvent('focus'));
    input.value = 'typed then reselected';
    sections.updateFromObjects([createDefaultGreyBoxMesh('GreyBox002')]);
    expect(getGreyBoxSurfaceIntent(mesh).wall).toBe('typed then reselected');
  });
});

/**
 * Finds the intent section among the mounted sections.
 *
 * @param host Container the sections were mounted into.
 * @returns Intent section element.
 */
function intentSection(host: HTMLElement): HTMLElement {
  const match = (Array.from(host.children) as HTMLElement[]).find((section) =>
    section.textContent?.includes('Grey Box Intent'),
  );
  expect(match).toBeDefined();
  return match!;
}

/**
 * Finds a surface input by its placeholder text.
 *
 * @param host Container the sections were mounted into.
 * @param placeholder Placeholder identifying the field.
 * @returns The input element.
 */
function surfaceInput(host: HTMLElement, placeholder: string): HTMLInputElement {
  const inputs = Array.from(intentSection(host).querySelectorAll('input[type="text"]')) as HTMLInputElement[];
  const match = inputs.find((input) => input.placeholder === placeholder);
  expect(match).toBeDefined();
  return match!;
}
