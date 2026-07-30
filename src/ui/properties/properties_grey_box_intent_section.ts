import * as THREE from 'three';
import { Theme } from '../../theme.js';
import { isGreyBox } from '../../greybox/model/grey_box_keys.js';
import { GreyBoxRegistry } from '../../greybox/model/grey_box_registry.js';
import { getGreyBoxSizeIntent, getGreyBoxSurfaceIntent } from '../../greybox/model/grey_box_access.js';
import {
  GREY_BOX_SURFACE_FIELDS,
  GreyBoxSizeIntent,
  GreyBoxSurfaceField,
} from '../../greybox/model/grey_box_intent.js';
import type { GreyBoxIntentPatch } from '../../commands/greybox/set_grey_box_intent_command.js';

/** Commits an intent edit as one undoable step. */
export type GreyBoxIntentCommitter = (greyBox: THREE.Object3D, patch: GreyBoxIntentPatch) => void;

/** Placeholder text guiding what each surface field is for. */
const FIELD_PLACEHOLDERS: Record<GreyBoxSurfaceField, string> = {
  floor: 'wet stone, puddles',
  wall: 'brick, soot-stained',
  ceiling: 'timber beams',
  mood: 'oppressive, low light',
};

/**
 * Inspector section for authoring intent: whether a volume's dimensions are
 * measured or a gesture, and how its surfaces should feel. Both are read by an
 * agent — fixity decides whether it may refine the shape, surface intent guides
 * what it builds the space out of.
 */
export class PropertiesGreyBoxIntentSection {
  private readonly section: HTMLElement;
  private readonly exactToggle: HTMLInputElement;
  private readonly surfaceInputs: Map<GreyBoxSurfaceField, HTMLInputElement>;
  private boundGreyBoxes: THREE.Object3D[];
  private valueAtFocus: Map<GreyBoxSurfaceField, string>;
  private commitIntent: GreyBoxIntentCommitter | null;

  /**
   * Builds the intent section UI.
   *
   * @param createSectionContainer Factory for a section container element.
   * @param createSectionHeader Factory for a section header element.
   */
  constructor(createSectionContainer: () => HTMLElement, createSectionHeader: (title: string) => HTMLElement) {
    this.boundGreyBoxes = [];
    this.valueAtFocus = new Map();
    this.commitIntent = null;
    this.surfaceInputs = new Map();
    this.exactToggle = this.createExactToggle();
    this.section = createSectionContainer();
    this.section.style.display = 'none';
    this.section.appendChild(createSectionHeader('Grey Box Intent'));
    this.section.appendChild(this.createContent());
  }

  /**
   * Sets the callback that turns a finished edit into an undoable command.
   *
   * @param committer Commit callback, or null to make the fields read-only.
   */
  setIntentCommitter(committer: GreyBoxIntentCommitter | null): void {
    this.commitIntent = committer;
  }

  /**
   * Returns the section root for mounting.
   *
   * @returns Section element.
   */
  getElement(): HTMLElement {
    return this.section;
  }

  /**
   * Shows and fills the section for a single-volume selection.
   *
   * @param objects Objects in the current selection.
   */
  updateFromObjects(objects: THREE.Object3D[]): void {
    this.commitPendingEdits();
    this.boundGreyBoxes = objects.filter((object) => isGreyBox(object) && GreyBoxRegistry.has(object));
    if (this.boundGreyBoxes.length === 0) {
      this.section.style.display = 'none';
      return;
    }
    this.section.style.display = 'block';
    this.writeFields();
  }

  /** Commits any in-flight surface edit, so switching selection loses nothing. */
  commitPendingEdits(): void {
    for (const field of GREY_BOX_SURFACE_FIELDS) {
      this.commitField(field);
    }
  }

  /** Writes every field from the bound volume, disabling them for multi-select. */
  private writeFields(): void {
    const single = this.singleBoundGreyBox();
    this.exactToggle.disabled = single === null;
    this.exactToggle.checked = single !== null && getGreyBoxSizeIntent(single) === 'exact';
    const surface = single ? getGreyBoxSurfaceIntent(single) : null;
    for (const field of GREY_BOX_SURFACE_FIELDS) {
      const input = this.surfaceInputs.get(field)!;
      input.value = surface ? surface[field] : '';
      input.disabled = single === null;
    }
  }

  /**
   * Returns the single bound volume, or null when zero or several are bound.
   *
   * @returns The one bound volume, or null.
   */
  private singleBoundGreyBox(): THREE.Object3D | null {
    if (this.boundGreyBoxes.length !== 1) return null;
    return this.boundGreyBoxes[0]!;
  }

  /**
   * Builds the section body.
   *
   * @returns Content element.
   */
  private createContent(): HTMLElement {
    const content = document.createElement('div');
    content.style.padding = '6px 8px';
    content.style.display = 'flex';
    content.style.flexDirection = 'column';
    content.style.gap = '4px';
    content.appendChild(this.createExactRow());
    for (const field of GREY_BOX_SURFACE_FIELDS) {
      content.appendChild(this.createSurfaceRow(field));
    }
    return content;
  }

  /**
   * Builds the dimension fixity row.
   *
   * @returns Fixity row element.
   */
  private createExactRow(): HTMLElement {
    const row = document.createElement('label');
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.gap = '6px';
    row.style.fontSize = '10px';
    row.style.textTransform = 'uppercase';
    row.style.letterSpacing = '0.4px';
    row.style.color = Theme.viewportLabelTextColor;
    row.title = 'Exact means an agent must build to these dimensions; otherwise the shape is a suggestion';
    row.appendChild(this.exactToggle);
    const label = document.createElement('span');
    label.textContent = 'Dimensions are exact';
    row.appendChild(label);
    return row;
  }

  /**
   * Builds the fixity checkbox and binds its commit.
   *
   * @returns Checkbox element.
   */
  private createExactToggle(): HTMLInputElement {
    const toggle = document.createElement('input');
    toggle.type = 'checkbox';
    toggle.addEventListener('change', () => this.commitSizeIntent());
    return toggle;
  }

  /** Commits a fixity change. */
  private commitSizeIntent(): void {
    const target = this.singleBoundGreyBox();
    if (!target || !this.commitIntent) return;
    const intent: GreyBoxSizeIntent = this.exactToggle.checked ? 'exact' : 'approximate';
    this.commitIntent(target, { sizeIntent: intent });
  }

  /**
   * Builds one surface field row.
   *
   * @param field Surface field the row edits.
   * @returns Row element.
   */
  private createSurfaceRow(field: GreyBoxSurfaceField): HTMLElement {
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.gap = '6px';
    row.appendChild(this.createFieldLabel(field));
    row.appendChild(this.createSurfaceInput(field));
    return row;
  }

  /**
   * Builds the label for a surface field.
   *
   * @param field Surface field being labelled.
   * @returns Label element.
   */
  private createFieldLabel(field: GreyBoxSurfaceField): HTMLElement {
    const label = document.createElement('span');
    label.textContent = field;
    label.style.color = Theme.viewportLabelTextColor;
    label.style.fontSize = '10px';
    label.style.textTransform = 'uppercase';
    label.style.letterSpacing = '0.4px';
    label.style.width = '46px';
    return label;
  }

  /**
   * Builds one surface input and binds its commit behaviour.
   *
   * @param field Surface field the input edits.
   * @returns Input element.
   */
  private createSurfaceInput(field: GreyBoxSurfaceField): HTMLInputElement {
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = FIELD_PLACEHOLDERS[field];
    input.title = 'A hint for how this should feel, not a texture assignment';
    input.style.flex = '1';
    input.style.minWidth = '0';
    input.style.fontSize = '11px';
    input.style.color = Theme.buttonTextColor;
    input.style.background = '#1a1a1a';
    input.style.border = '1px solid #3a3a3a';
    input.style.borderRadius = '2px';
    input.style.padding = '2px 4px';
    input.addEventListener('focus', () => this.valueAtFocus.set(field, input.value));
    input.addEventListener('blur', () => this.commitField(field));
    input.addEventListener('keydown', (event) => this.onFieldKeyDown(event, field));
    this.surfaceInputs.set(field, input);
    return input;
  }

  /**
   * Commits on Enter and reverts on Escape, keeping keystrokes out of the
   * viewport shortcuts.
   *
   * @param event Keyboard event from a surface input.
   * @param field Surface field being edited.
   */
  private onFieldKeyDown(event: KeyboardEvent, field: GreyBoxSurfaceField): void {
    event.stopPropagation();
    if (event.key === 'Enter') {
      this.commitField(field);
      this.valueAtFocus.set(field, this.surfaceInputs.get(field)!.value);
      return;
    }
    if (event.key === 'Escape') this.revertField(field);
  }

  /**
   * Commits one surface field when its editing session changed the text.
   *
   * @param field Surface field to commit.
   */
  private commitField(field: GreyBoxSurfaceField): void {
    const previous = this.valueAtFocus.get(field);
    if (previous === undefined) return;
    this.valueAtFocus.delete(field);
    const target = this.singleBoundGreyBox();
    const input = this.surfaceInputs.get(field)!;
    if (!target || !this.commitIntent || input.value === previous) return;
    this.commitIntent(target, { surface: { [field]: input.value } });
  }

  /**
   * Restores one field to the value it had when editing began.
   *
   * @param field Surface field to revert.
   */
  private revertField(field: GreyBoxSurfaceField): void {
    const previous = this.valueAtFocus.get(field);
    if (previous === undefined) return;
    const input = this.surfaceInputs.get(field)!;
    input.value = previous;
    this.valueAtFocus.delete(field);
    input.blur();
  }
}
