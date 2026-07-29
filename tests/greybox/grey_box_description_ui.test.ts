import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { Theme } from '../../src/theme.js';
import { PropertiesContextSections } from '../../src/ui/properties/properties_context_sections.js';
import { CommandStack } from '../../src/commands/command_stack.js';
import { commitGreyBoxDescription } from '../../src/managers/hierarchy/grey_box_description_commit.js';
import { SetGreyBoxDescriptionCommand } from '../../src/commands/greybox/set_grey_box_description_command.js';
import { getGreyBoxDescription } from '../../src/greybox/model/grey_box_access.js';
import { createDefaultGreyBoxMesh } from '../../src/greybox/model/grey_box_factory.js';
import { setObjectLocked } from '../../src/utils/object_lock.js';
import { createContentBox } from './grey_box_fixture.js';

const COMMAND_STACK_LIMIT = 32;

describe('SetGreyBoxDescriptionCommand', () => {
  it('applies and undoes a description edit', () => {
    const mesh = createDefaultGreyBoxMesh('GreyBox001');
    const command = SetGreyBoxDescriptionCommand.fromCurrent(mesh, 'ruined chapel, light from broken roof');
    command.execute();
    expect(getGreyBoxDescription(mesh)).toBe('ruined chapel, light from broken roof');
    command.undo();
    expect(getGreyBoxDescription(mesh)).toBe('');
  });

  it('redoes after an undo', () => {
    const mesh = createDefaultGreyBoxMesh('GreyBox001');
    const command = SetGreyBoxDescriptionCommand.fromCurrent(mesh, 'armoury');
    command.execute();
    command.undo();
    command.execute();
    expect(getGreyBoxDescription(mesh)).toBe('armoury');
  });

  it('restores a previous non-empty description on undo', () => {
    const mesh = createDefaultGreyBoxMesh('GreyBox001');
    SetGreyBoxDescriptionCommand.fromCurrent(mesh, 'first draft').execute();
    const second = SetGreyBoxDescriptionCommand.fromCurrent(mesh, 'second draft');
    second.execute();
    second.undo();
    expect(getGreyBoxDescription(mesh)).toBe('first draft');
  });

  it('reports when an edit changes nothing', () => {
    const mesh = createDefaultGreyBoxMesh('GreyBox001');
    SetGreyBoxDescriptionCommand.fromCurrent(mesh, 'hall').execute();
    expect(SetGreyBoxDescriptionCommand.fromCurrent(mesh, 'hall').changesDescription()).toBe(false);
    expect(SetGreyBoxDescriptionCommand.fromCurrent(mesh, 'hallway').changesDescription()).toBe(true);
  });

  it('treats clearing a description as a real edit', () => {
    const mesh = createDefaultGreyBoxMesh('GreyBox001');
    SetGreyBoxDescriptionCommand.fromCurrent(mesh, 'to be cleared').execute();
    const clear = SetGreyBoxDescriptionCommand.fromCurrent(mesh, '');
    expect(clear.changesDescription()).toBe(true);
    clear.execute();
    expect(getGreyBoxDescription(mesh)).toBe('');
  });
});

describe('commitGreyBoxDescription', () => {
  let commandStack: CommandStack;

  beforeEach(() => {
    commandStack = new CommandStack(COMMAND_STACK_LIMIT);
  });

  it('pushes one undoable entry per editing session', () => {
    const mesh = createDefaultGreyBoxMesh('GreyBox001');
    commitGreyBoxDescription(commandStack, mesh, 'entry hall with two exits');
    expect(commandStack.getUndoCount()).toBe(1);
    commandStack.undo();
    expect(getGreyBoxDescription(mesh)).toBe('');
  });

  it('does not record an entry when the text is unchanged', () => {
    const mesh = createDefaultGreyBoxMesh('GreyBox001');
    commitGreyBoxDescription(commandStack, mesh, '');
    expect(commandStack.getUndoCount()).toBe(0);
  });

  it('refuses to edit a locked volume', () => {
    const mesh = createDefaultGreyBoxMesh('GreyBox001');
    setObjectLocked(mesh, true);
    commitGreyBoxDescription(commandStack, mesh, 'should not apply');
    expect(getGreyBoxDescription(mesh)).toBe('');
    expect(commandStack.getUndoCount()).toBe(0);
  });
});

describe('grey box inspector section', () => {
  let sections: PropertiesContextSections;
  let commandStack: CommandStack;
  let host: HTMLElement;

  beforeEach(() => {
    commandStack = new CommandStack(COMMAND_STACK_LIMIT);
    host = document.createElement('div');
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
    sections.setGreyBoxDescriptionCommitter((greyBox, description) =>
      commitGreyBoxDescription(commandStack, greyBox, description),
    );
    sections.mountInto(host, () => undefined);
  });

  it('stays hidden until a grey box is selected', () => {
    expect(greyBoxSectionElement(host).style.display).toBe('none');
    sections.updateFromObjects([createDefaultGreyBoxMesh('GreyBox001')]);
    expect(greyBoxSectionElement(host).style.display).toBe('block');
  });

  it('hides again for a non-grey-box selection', () => {
    sections.updateFromObjects([createDefaultGreyBoxMesh('GreyBox001')]);
    sections.updateFromObjects([createContentBox('Crate', new THREE.Vector3(1, 1, 1))]);
    expect(greyBoxSectionElement(host).style.display).toBe('none');
  });

  it('shows the volume name for orientation', () => {
    const mesh = createDefaultGreyBoxMesh('HubRoom');
    sections.updateFromObjects([mesh]);
    expect(greyBoxSectionElement(host).textContent).toContain('HubRoom');
  });

  it('fills the field with the stored description', () => {
    const mesh = createDefaultGreyBoxMesh('GreyBox001');
    commitGreyBoxDescription(commandStack, mesh, 'long gallery');
    sections.updateFromObjects([mesh]);
    expect(descriptionField(host).value).toBe('long gallery');
  });

  it('commits an edit on blur as one undo entry', () => {
    const mesh = createDefaultGreyBoxMesh('GreyBox001');
    sections.updateFromObjects([mesh]);
    typeDescription(host, 'vaulted crypt, water on the floor');
    expect(getGreyBoxDescription(mesh)).toBe('vaulted crypt, water on the floor');
    expect(commandStack.getUndoCount()).toBe(1);
  });

  it('undoes a committed edit through the command stack', () => {
    const mesh = createDefaultGreyBoxMesh('GreyBox001');
    sections.updateFromObjects([mesh]);
    typeDescription(host, 'first');
    commandStack.undo();
    expect(getGreyBoxDescription(mesh)).toBe('');
  });

  it('coalesces a whole typing session into one entry', () => {
    const mesh = createDefaultGreyBoxMesh('GreyBox001');
    sections.updateFromObjects([mesh]);
    const field = descriptionField(host);
    field.dispatchEvent(new FocusEvent('focus'));
    for (const partial of ['a', 'ar', 'arm', 'armo', 'armoury']) {
      field.value = partial;
      field.dispatchEvent(new Event('input'));
    }
    field.dispatchEvent(new FocusEvent('blur'));
    expect(commandStack.getUndoCount()).toBe(1);
    expect(getGreyBoxDescription(mesh)).toBe('armoury');
  });

  it('reverts an in-flight edit on Escape without recording it', () => {
    const mesh = createDefaultGreyBoxMesh('GreyBox001');
    commitGreyBoxDescription(commandStack, mesh, 'keep me');
    sections.updateFromObjects([mesh]);
    const field = descriptionField(host);
    field.dispatchEvent(new FocusEvent('focus'));
    field.value = 'discard me';
    field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(field.value).toBe('keep me');
    expect(getGreyBoxDescription(mesh)).toBe('keep me');
    expect(commandStack.getUndoCount()).toBe(1);
  });

  it('commits on Ctrl+Enter without waiting for blur', () => {
    const mesh = createDefaultGreyBoxMesh('GreyBox001');
    sections.updateFromObjects([mesh]);
    const field = descriptionField(host);
    field.dispatchEvent(new FocusEvent('focus'));
    field.value = 'committed by key';
    field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true }));
    expect(getGreyBoxDescription(mesh)).toBe('committed by key');
  });

  it('does not lose an in-flight edit when the selection changes', () => {
    const mesh = createDefaultGreyBoxMesh('GreyBox001');
    sections.updateFromObjects([mesh]);
    const field = descriptionField(host);
    field.dispatchEvent(new FocusEvent('focus'));
    field.value = 'typed then reselected';
    sections.updateFromObjects([createDefaultGreyBoxMesh('GreyBox002')]);
    expect(getGreyBoxDescription(mesh)).toBe('typed then reselected');
  });

  it('disables the field for a multi-volume selection', () => {
    sections.updateFromObjects([createDefaultGreyBoxMesh('GreyBox001'), createDefaultGreyBoxMesh('GreyBox002')]);
    expect(greyBoxSectionElement(host).style.display).toBe('block');
    expect(descriptionField(host).disabled).toBe(true);
  });

  it('keeps plain Enter available for multi-line descriptions', () => {
    const mesh = createDefaultGreyBoxMesh('GreyBox001');
    sections.updateFromObjects([mesh]);
    const field = descriptionField(host);
    field.dispatchEvent(new FocusEvent('focus'));
    field.value = 'line one\nline two';
    field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    field.dispatchEvent(new FocusEvent('blur'));
    expect(getGreyBoxDescription(mesh)).toBe('line one\nline two');
  });
});

/**
 * Finds the grey box section element among the mounted sections.
 *
 * @param host Container the sections were mounted into.
 * @returns Grey box section element.
 */
function greyBoxSectionElement(host: HTMLElement): HTMLElement {
  const sections = Array.from(host.children) as HTMLElement[];
  const match = sections.find((section) => section.textContent?.includes('Grey Box'));
  expect(match).toBeDefined();
  return match!;
}

/**
 * Finds the description textarea inside the mounted grey box section.
 *
 * @param host Container the sections were mounted into.
 * @returns Description textarea.
 */
function descriptionField(host: HTMLElement): HTMLTextAreaElement {
  const field = greyBoxSectionElement(host).querySelector('textarea');
  expect(field).not.toBeNull();
  return field as HTMLTextAreaElement;
}

/**
 * Types a description and blurs the field, as a user finishing an edit does.
 *
 * @param host Container the sections were mounted into.
 * @param text Description to type.
 */
function typeDescription(host: HTMLElement, text: string): void {
  const field = descriptionField(host);
  field.dispatchEvent(new FocusEvent('focus'));
  field.value = text;
  field.dispatchEvent(new Event('input'));
  field.dispatchEvent(new FocusEvent('blur'));
}
