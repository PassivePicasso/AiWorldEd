import * as THREE from 'three';
import { Theme } from '../../theme.js';
import { PropertiesSolidBrushSection, SolidBrushPropertyHandlers } from './properties_solid_brush_section.js';
import {
  GreyBoxDescriptionCommitter,
  GreyBoxRoleCommitter,
  PropertiesGreyBoxSection,
} from './properties_grey_box_section.js';
import {
  GreyBoxConnectionHandlers,
  PropertiesGreyBoxConnectionsSection,
} from './properties_grey_box_connections_section.js';
import type { GreyBoxMergedGraph } from '../../greybox/connectivity/grey_box_graph_types.js';

/**
 * Owns the inspector sections that appear only for particular object types and
 * dispatches selection updates to them. Keeping this out of PropertiesPanel
 * leaves the panel responsible for transform, material, and layout alone.
 */
export class PropertiesContextSections {
  private readonly solidBrushSection: PropertiesSolidBrushSection;
  private readonly greyBoxSection: PropertiesGreyBoxSection;
  private readonly greyBoxConnectionsSection: PropertiesGreyBoxConnectionsSection;

  /**
   * Builds every type-specific section.
   *
   * @param theme Editor theme.
   * @param createSectionContainer Factory for a section container element.
   * @param createSectionHeader Factory for a section header element.
   * @param hexToRgb Converts theme hex colors to CSS rgb strings.
   */
  constructor(
    theme: typeof Theme,
    createSectionContainer: () => HTMLElement,
    createSectionHeader: (title: string) => HTMLElement,
    hexToRgb: (hex: number) => string,
  ) {
    this.solidBrushSection = new PropertiesSolidBrushSection(
      theme,
      createSectionContainer,
      createSectionHeader,
      hexToRgb,
    );
    this.greyBoxSection = new PropertiesGreyBoxSection(createSectionContainer, createSectionHeader);
    this.greyBoxConnectionsSection = new PropertiesGreyBoxConnectionsSection(
      createSectionContainer,
      createSectionHeader,
    );
  }

  /**
   * Wires solid-brush operation and rebuild handlers.
   *
   * @param handlers Brush property handlers, or null to clear.
   */
  setSolidBrushHandlers(handlers: SolidBrushPropertyHandlers | null): void {
    this.solidBrushSection.setHandlers(handlers);
  }

  /**
   * Provides the brush meshes the solid brush section may edit.
   *
   * @param provider Returns editable brush meshes from the current selection.
   */
  setEditableBrushMeshProvider(provider: () => THREE.Mesh[]): void {
    this.solidBrushSection.setEditableBrushMeshProvider(provider);
  }

  /**
   * Wires the callback that commits a grey box description edit.
   *
   * @param committer Commit callback, or null to leave descriptions read-only.
   */
  setGreyBoxDescriptionCommitter(committer: GreyBoxDescriptionCommitter | null): void {
    this.greyBoxSection.setDescriptionCommitter(committer);
  }

  /**
   * Wires the callback that commits a grey box role change.
   *
   * @param committer Commit callback, or null to leave the role read-only.
   */
  setGreyBoxRoleCommitter(committer: GreyBoxRoleCommitter | null): void {
    this.greyBoxSection.setRoleCommitter(committer);
  }

  /**
   * Wires the undoable grey box connection actions.
   *
   * @param handlers Connection handlers, or null to disable connection editing.
   */
  setGreyBoxConnectionHandlers(handlers: GreyBoxConnectionHandlers | null): void {
    this.greyBoxConnectionsSection.setHandlers(handlers);
  }

  /**
   * Supplies the merged layout graph the connection rows read from.
   *
   * @param graph Merged graph, or null when unavailable.
   */
  setGreyBoxGraph(graph: GreyBoxMergedGraph | null): void {
    this.greyBoxConnectionsSection.setGraph(graph);
  }

  /**
   * Appends every section to the panel container.
   *
   * @param container Panel container element.
   * @param registerSection Records a mounted section with the panel.
   */
  mountInto(container: HTMLElement, registerSection: (section: HTMLElement) => void): void {
    const elements = [
      this.solidBrushSection.getElement(),
      this.greyBoxSection.getElement(),
      this.greyBoxConnectionsSection.getElement(),
    ];
    for (const element of elements) {
      registerSection(element);
      container.appendChild(element);
    }
  }

  /**
   * Updates every type-specific section from the current selection.
   *
   * @param objects Objects in the current selection.
   */
  updateFromObjects(objects: THREE.Object3D[]): void {
    this.solidBrushSection.updateFromObjects(objects);
    this.greyBoxSection.updateFromObjects(objects);
    this.greyBoxConnectionsSection.updateFromObjects(objects);
  }

  /** Hides every type-specific section. */
  clear(): void {
    this.updateFromObjects([]);
  }

  /** Commits edits still in flight, so panel teardown never drops typing. */
  commitPendingEdits(): void {
    this.greyBoxSection.commitPendingEdit();
  }
}
