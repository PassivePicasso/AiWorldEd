import * as THREE from 'three';
import { Theme } from '../../theme.js';
import { PropertiesColorSession } from './properties_color_session.js';

/** Opacity applied to the swatch when the selection holds mixed colors. */
const MIXED_COLOR_OPACITY = '0.55';

/** Swatch value shown when there is nothing to read a color from. */
const NEUTRAL_SWATCH = '#ffffff';

/**
 * Inspector Material section: the color swatch, reading the current color from
 * the selection, and committing edits as one coalesced undo entry.
 */
export class PropertiesMaterialSection {
  private readonly theme: typeof Theme;
  private readonly section: HTMLElement;
  private readonly colorInput: HTMLInputElement;
  private readonly colorSession: PropertiesColorSession;
  private getEditableObjects: () => THREE.Object3D[];

  /**
   * Builds the material section UI.
   *
   * @param theme Editor theme.
   * @param createSectionContainer Factory for a section container element.
   * @param createSectionHeader Factory for a section header element.
   * @param colorSession Session coalescing a drag into one undo entry.
   */
  constructor(
    theme: typeof Theme,
    createSectionContainer: () => HTMLElement,
    createSectionHeader: (title: string) => HTMLElement,
    colorSession: PropertiesColorSession,
  ) {
    this.theme = theme;
    this.colorSession = colorSession;
    this.getEditableObjects = () => [];
    this.colorInput = this.createColorInput();
    this.section = createSectionContainer();
    this.section.appendChild(createSectionHeader('Material'));
    this.section.appendChild(this.createContent());
  }

  /**
   * Provides the objects a color edit may write to, already filtered for locks.
   *
   * @param provider Returns editable objects from the current selection.
   */
  setEditableObjectProvider(provider: () => THREE.Object3D[]): void {
    this.getEditableObjects = provider;
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
   * Updates the swatch from the selection, dimming it for mixed colors.
   *
   * @param objects Objects in the current selection.
   */
  updateFromObjects(objects: THREE.Object3D[]): void {
    const colors = collectMeshColors(objects);
    if (colors.length === 0 || !areColorsShared(colors)) {
      this.colorInput.value = NEUTRAL_SWATCH;
      this.colorInput.style.opacity = colors.length === 0 ? '1' : MIXED_COLOR_OPACITY;
      return;
    }
    this.colorInput.value = `#${colors[0]!.toString(16).padStart(6, '0')}`;
    this.colorInput.style.opacity = '1';
  }

  /** Resets the swatch to neutral. */
  clear(): void {
    this.colorInput.value = NEUTRAL_SWATCH;
    this.colorInput.style.opacity = '1';
  }

  /** Ends an in-flight color drag so its undo entry is committed. */
  finalizeEdit(): void {
    this.colorSession.finalize();
  }

  /**
   * Builds the section body holding the label and swatch.
   *
   * @returns Content element.
   */
  private createContent(): HTMLElement {
    const content = document.createElement('div');
    content.style.padding = '6px 8px';
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.gap = '8px';
    row.appendChild(this.createColorLabel());
    row.appendChild(this.colorInput);
    content.appendChild(row);
    return content;
  }

  /**
   * Creates the "Color" label.
   *
   * @returns Styled label element.
   */
  private createColorLabel(): HTMLElement {
    const label = document.createElement('span');
    label.textContent = 'Color';
    label.style.color = this.theme.buttonTextColor;
    label.style.fontFamily = 'monospace';
    label.style.fontSize = '12px';
    return label;
  }

  /**
   * Creates the color input and binds edit and finalize listeners.
   *
   * @returns Configured color input element.
   */
  private createColorInput(): HTMLInputElement {
    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.value = NEUTRAL_SWATCH;
    colorInput.style.width = '48px';
    colorInput.style.height = '24px';
    colorInput.style.border = 'none';
    colorInput.style.background = 'transparent';
    colorInput.style.cursor = 'pointer';
    colorInput.addEventListener('input', () => this.onColorEdited());
    colorInput.addEventListener('change', () => this.onColorEdited());
    colorInput.addEventListener('blur', () => this.colorSession.finalize());
    return colorInput;
  }

  /** Applies the swatch value to every editable mesh in the selection. */
  private onColorEdited(): void {
    const colorHex = parseColorInputHex(this.colorInput.value);
    if (colorHex === null) return;
    const meshes = collectColorEditableMeshes(this.getEditableObjects());
    if (meshes.length === 0) return;
    this.colorSession.onColorEdited(colorHex, meshes);
    this.colorInput.style.opacity = '1';
  }
}

/**
 * Collects material color hex values from mesh objects.
 *
 * @param objects Selected objects.
 * @returns Color hex list.
 */
function collectMeshColors(objects: THREE.Object3D[]): number[] {
  const colors: number[] = [];
  for (const mesh of collectColorEditableMeshes(objects)) {
    colors.push((mesh.material as THREE.MeshStandardMaterial).color.getHex());
  }
  return colors;
}

/**
 * Returns whether all colors are identical.
 *
 * @param colors Hex colors.
 * @returns True when shared or empty.
 */
function areColorsShared(colors: number[]): boolean {
  if (colors.length === 0) return true;
  return colors.every((color) => color === colors[0]);
}

/**
 * Parses a CSS #rrggbb color string into a hex number.
 *
 * @param value Color input value such as "#ff0000".
 * @returns Hex number, or null when invalid.
 */
function parseColorInputHex(value: string): number | null {
  const trimmed = value.trim();
  if (!/^#[0-9a-fA-F]{6}$/.test(trimmed)) return null;
  return parseInt(trimmed.slice(1), 16);
}

/**
 * Collects meshes that expose a writable material color.
 *
 * @param objects Candidate objects.
 * @returns Meshes with a single color material.
 */
function collectColorEditableMeshes(objects: THREE.Object3D[]): THREE.Mesh[] {
  const meshes: THREE.Mesh[] = [];
  for (const object of objects) {
    if (!(object instanceof THREE.Mesh)) continue;
    const material = object.material;
    if (!material || Array.isArray(material) || !('color' in material)) continue;
    meshes.push(object);
  }
  return meshes;
}
