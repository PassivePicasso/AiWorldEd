import * as THREE from 'three';
import { Theme } from '../../theme.js';
import { isGreyBox } from '../../greybox/model/grey_box_keys.js';
import { GreyBoxRegistry } from '../../greybox/model/grey_box_registry.js';
import { getGreyBoxDescription } from '../../greybox/model/grey_box_access.js';

/** Placeholder guiding the user toward descriptions an AI agent can act on. */
const DESCRIPTION_PLACEHOLDER = 'What is this space for? Mood, role, what connects here.';

/** Text shown in the name row when several volumes are selected. */
const MIXED_SELECTION_LABEL = '— multiple —';

/** Commits a description edit as one undoable step. */
export type GreyBoxDescriptionCommitter = (greyBox: THREE.Object3D, description: string) => void;

/**
 * Inspector section for grey box planning volumes: the volume's name for
 * orientation (renaming happens in the Outliner) and the description an AI
 * agent reads as the brief for what to build inside.
 */
export class PropertiesGreyBoxSection {
  private readonly section: HTMLElement;
  private readonly nameValue: HTMLElement;
  private readonly descriptionInput: HTMLTextAreaElement;
  private boundGreyBoxes: THREE.Object3D[];
  private descriptionAtFocus: string | null;
  private commitDescription: GreyBoxDescriptionCommitter | null;

  /**
   * Builds the grey box section UI.
   *
   * @param createSectionContainer Factory for a section container element.
   * @param createSectionHeader Factory for a section header element.
   */
  constructor(createSectionContainer: () => HTMLElement, createSectionHeader: (title: string) => HTMLElement) {
    this.boundGreyBoxes = [];
    this.descriptionAtFocus = null;
    this.commitDescription = null;
    this.section = createSectionContainer();
    this.section.style.display = 'none';
    this.section.appendChild(createSectionHeader('Grey Box'));
    this.nameValue = this.createNameValue();
    this.descriptionInput = this.createDescriptionInput();
    this.section.appendChild(this.createContent());
    this.bindDescriptionEvents();
  }

  /**
   * Sets the callback that turns a finished edit into an undoable command.
   *
   * @param committer Commit callback, or null to make the field read-only.
   */
  setDescriptionCommitter(committer: GreyBoxDescriptionCommitter | null): void {
    this.commitDescription = committer;
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
   * Shows and fills the section for the grey boxes in a selection, hiding it
   * when the selection holds none.
   *
   * @param objects Objects in the current selection.
   */
  updateFromObjects(objects: THREE.Object3D[]): void {
    this.commitPendingEdit();
    this.boundGreyBoxes = objects.filter((object) => isGreyBox(object) && GreyBoxRegistry.has(object));
    if (this.boundGreyBoxes.length === 0) {
      this.section.style.display = 'none';
      this.descriptionInput.value = '';
      return;
    }
    this.section.style.display = 'block';
    this.writeNameRow();
    this.writeDescriptionField();
  }

  /**
   * Commits an in-flight edit, used before the selection changes or the panel
   * goes away so typing is never silently lost.
   */
  commitPendingEdit(): void {
    if (this.descriptionAtFocus === null) return;
    const previous = this.descriptionAtFocus;
    this.descriptionAtFocus = null;
    const target = this.singleBoundGreyBox();
    if (!target) return;
    if (this.descriptionInput.value === previous) return;
    this.commitDescription?.(target, this.descriptionInput.value);
  }

  /** Writes the name row from the bound selection. */
  private writeNameRow(): void {
    const single = this.singleBoundGreyBox();
    this.nameValue.textContent = single ? single.name : MIXED_SELECTION_LABEL;
  }

  /** Writes the description field and its editability from the selection. */
  private writeDescriptionField(): void {
    const single = this.singleBoundGreyBox();
    if (!single) {
      this.descriptionInput.value = '';
      this.descriptionInput.disabled = true;
      this.descriptionInput.placeholder = 'Select one grey box to describe it.';
      return;
    }
    this.descriptionInput.value = getGreyBoxDescription(single);
    this.descriptionInput.disabled = false;
    this.descriptionInput.placeholder = DESCRIPTION_PLACEHOLDER;
  }

  /**
   * Returns the single bound grey box, or null when zero or several are bound.
   *
   * @returns The one bound volume, or null.
   */
  private singleBoundGreyBox(): THREE.Object3D | null {
    if (this.boundGreyBoxes.length !== 1) return null;
    return this.boundGreyBoxes[0]!;
  }

  /**
   * Builds the section body: name row above the description field.
   *
   * @returns Content element.
   */
  private createContent(): HTMLElement {
    const content = document.createElement('div');
    content.style.padding = '6px 8px';
    content.style.display = 'flex';
    content.style.flexDirection = 'column';
    content.style.gap = '6px';
    content.appendChild(this.createNameRow());
    content.appendChild(this.createDescriptionLabel());
    content.appendChild(this.descriptionInput);
    return content;
  }

  /**
   * Builds the read-only name row. Renaming stays in the Outliner so there is
   * one rename path, not two.
   *
   * @returns Name row element.
   */
  private createNameRow(): HTMLElement {
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.alignItems = 'baseline';
    row.style.gap = '6px';
    row.appendChild(this.createFieldLabel('Name'));
    row.appendChild(this.nameValue);
    return row;
  }

  /**
   * Builds the element displaying the bound volume's name.
   *
   * @returns Name value element.
   */
  private createNameValue(): HTMLElement {
    const value = document.createElement('span');
    value.style.color = Theme.buttonTextColor;
    value.style.fontSize = '11px';
    value.style.overflow = 'hidden';
    value.style.textOverflow = 'ellipsis';
    value.style.whiteSpace = 'nowrap';
    value.title = 'Rename in the Outliner';
    return value;
  }

  /**
   * Builds the description field label.
   *
   * @returns Label element.
   */
  private createDescriptionLabel(): HTMLElement {
    const label = this.createFieldLabel('Description');
    label.title = 'Read by AI over MCP as the brief for what to build in this volume';
    return label;
  }

  /**
   * Builds a small field label in the inspector style.
   *
   * @param text Label text.
   * @returns Label element.
   */
  private createFieldLabel(text: string): HTMLElement {
    const label = document.createElement('span');
    label.textContent = text;
    label.style.color = Theme.viewportLabelTextColor;
    label.style.fontSize = '10px';
    label.style.textTransform = 'uppercase';
    label.style.letterSpacing = '0.4px';
    return label;
  }

  /**
   * Builds the multi-line description input.
   *
   * @returns Textarea element.
   */
  private createDescriptionInput(): HTMLTextAreaElement {
    const input = document.createElement('textarea');
    input.rows = 4;
    input.placeholder = DESCRIPTION_PLACEHOLDER;
    input.style.width = '100%';
    input.style.boxSizing = 'border-box';
    input.style.resize = 'vertical';
    input.style.fontSize = '11px';
    input.style.fontFamily = 'inherit';
    input.style.color = Theme.buttonTextColor;
    input.style.background = '#1a1a1a';
    input.style.border = '1px solid #3a3a3a';
    input.style.borderRadius = '2px';
    input.style.padding = '4px';
    return input;
  }

  /** Wires focus, blur, and commit-key handling for the description field. */
  private bindDescriptionEvents(): void {
    this.descriptionInput.addEventListener('focus', () => {
      this.descriptionAtFocus = this.descriptionInput.value;
    });
    this.descriptionInput.addEventListener('blur', () => this.commitPendingEdit());
    this.descriptionInput.addEventListener('keydown', (event) => this.onDescriptionKeyDown(event));
  }

  /**
   * Commits on Ctrl+Enter and reverts on Escape, leaving plain Enter to insert
   * a newline so multi-paragraph descriptions stay natural to write.
   *
   * @param event Keyboard event from the description field.
   */
  private onDescriptionKeyDown(event: KeyboardEvent): void {
    event.stopPropagation();
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      this.commitPendingEdit();
      this.descriptionAtFocus = this.descriptionInput.value;
      return;
    }
    if (event.key === 'Escape') {
      this.revertPendingEdit();
    }
  }

  /** Restores the field to the value it had when editing began. */
  private revertPendingEdit(): void {
    if (this.descriptionAtFocus === null) return;
    this.descriptionInput.value = this.descriptionAtFocus;
    this.descriptionAtFocus = null;
    this.descriptionInput.blur();
  }
}
