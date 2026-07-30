import * as THREE from 'three';
import { Theme } from '../../theme.js';
import { isGreyBox } from '../../greybox/model/grey_box_keys.js';
import { GreyBoxRegistry } from '../../greybox/model/grey_box_registry.js';
import { GreyBoxMergedGraph } from '../../greybox/connectivity/grey_box_graph_types.js';
import { buildGreyBoxConnectionRows, GreyBoxConnectionRow } from './grey_box_connection_rows.js';

/** Actions the layout supplies so connection edits become undoable commands. */
export interface GreyBoxConnectionHandlers {
  /** Connects two volumes with an authored link, both named by grey box id. */
  onConnect: (ownerId: string, targetId: string) => void;

  /** Removes an authored link from the volume that owns it. */
  onRemoveAuthored: (ownerId: string, connectionId: string) => void;

  /** Mutes or restores a derived adjacency, recorded on the given volume. */
  onSetSuppressed: (ownerId: string, pairKey: string, suppressed: boolean) => void;

  /** Rebuilds the merged graph after a change. */
  onGraphChanged: () => void;
}

/**
 * Inspector section listing how the selected grey box connects to its
 * neighbours: derived adjacencies with a mute toggle, authored links with
 * removal, and a connect action when exactly two volumes are selected.
 */
export class PropertiesGreyBoxConnectionsSection {
  private readonly section: HTMLElement;
  private readonly rowList: HTMLElement;
  private readonly connectButton: HTMLButtonElement;
  private readonly emptyLabel: HTMLElement;
  private boundGreyBoxes: THREE.Object3D[];
  private graph: GreyBoxMergedGraph | null;
  private handlers: GreyBoxConnectionHandlers | null;

  /**
   * Builds the connections section UI.
   *
   * @param createSectionContainer Factory for a section container element.
   * @param createSectionHeader Factory for a section header element.
   */
  constructor(createSectionContainer: () => HTMLElement, createSectionHeader: (title: string) => HTMLElement) {
    this.boundGreyBoxes = [];
    this.graph = null;
    this.handlers = null;
    this.section = createSectionContainer();
    this.section.style.display = 'none';
    this.section.appendChild(createSectionHeader('Grey Box Connections'));
    this.rowList = this.createRowList();
    this.emptyLabel = this.createEmptyLabel();
    this.connectButton = this.createConnectButton();
    this.section.appendChild(this.createContent());
  }

  /**
   * Wires the undoable connection actions.
   *
   * @param handlers Connection handlers, or null to disable editing.
   */
  setHandlers(handlers: GreyBoxConnectionHandlers | null): void {
    this.handlers = handlers;
  }

  /**
   * Supplies the merged graph the rows are read from.
   *
   * @param graph Merged layout graph, or null when unavailable.
   */
  setGraph(graph: GreyBoxMergedGraph | null): void {
    this.graph = graph;
    this.rebuildRows();
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
   * Shows the section for grey box selections and rebuilds its rows.
   *
   * @param objects Objects in the current selection.
   */
  updateFromObjects(objects: THREE.Object3D[]): void {
    this.boundGreyBoxes = objects.filter((object) => isGreyBox(object) && GreyBoxRegistry.has(object));
    this.section.style.display = this.boundGreyBoxes.length > 0 ? 'block' : 'none';
    this.rebuildRows();
  }

  /** Rebuilds the row list from the graph and current selection. */
  private rebuildRows(): void {
    this.rowList.replaceChildren();
    const owner = this.singleBoundGreyBox();
    this.connectButton.style.display = this.boundGreyBoxes.length === 2 ? 'block' : 'none';
    if (!owner || !this.graph) {
      this.emptyLabel.textContent = this.emptyMessage();
      this.emptyLabel.style.display = 'block';
      return;
    }
    const rows = buildGreyBoxConnectionRows(this.graph, GreyBoxRegistry.get(owner).id);
    this.emptyLabel.style.display = rows.length === 0 ? 'block' : 'none';
    this.emptyLabel.textContent = 'No connections yet.';
    for (const row of rows) {
      this.rowList.appendChild(this.createRowElement(owner, row));
    }
  }

  /**
   * Builds the message shown when no rows can be listed.
   *
   * @returns Message text.
   */
  private emptyMessage(): string {
    if (this.boundGreyBoxes.length === 2) return 'Two volumes selected — connect them below.';
    if (this.boundGreyBoxes.length > 1) return 'Select one grey box to see its connections.';
    return 'No connections yet.';
  }

  /**
   * Builds one connection row element.
   *
   * @param owner Selected volume the row belongs to.
   * @param row Row model.
   * @returns Row element.
   */
  private createRowElement(owner: THREE.Object3D, row: GreyBoxConnectionRow): HTMLElement {
    const element = document.createElement('div');
    element.style.display = 'flex';
    element.style.alignItems = 'center';
    element.style.gap = '4px';
    element.style.fontSize = '11px';
    element.style.color = row.suppressed ? Theme.viewportLabelTextColor : Theme.buttonTextColor;
    element.appendChild(this.createRowLabel(row));
    element.appendChild(this.createRowAction(owner, row));
    return element;
  }

  /**
   * Builds the descriptive label of a row.
   *
   * @param row Row model.
   * @returns Label element.
   */
  private createRowLabel(row: GreyBoxConnectionRow): HTMLElement {
    const label = document.createElement('span');
    label.textContent = row.label;
    label.title = row.detail;
    label.style.flex = '1';
    label.style.overflow = 'hidden';
    label.style.textOverflow = 'ellipsis';
    label.style.whiteSpace = 'nowrap';
    if (row.suppressed) label.style.textDecoration = 'line-through';
    return label;
  }

  /**
   * Builds the mute or remove action for a row.
   *
   * @param owner Selected volume the row belongs to.
   * @param row Row model.
   * @returns Action button.
   */
  private createRowAction(owner: THREE.Object3D, row: GreyBoxConnectionRow): HTMLButtonElement {
    const button = this.createSmallButton(row.source === 'authored' ? 'Remove' : row.suppressed ? 'Unmute' : 'Mute');
    button.addEventListener('click', () => this.runRowAction(owner, row));
    return button;
  }

  /**
   * Runs a row's action through the layout handlers.
   *
   * @param owner Selected volume the row belongs to.
   * @param row Row model.
   */
  private runRowAction(owner: THREE.Object3D, row: GreyBoxConnectionRow): void {
    if (!this.handlers) return;
    const ownerId = GreyBoxRegistry.get(owner).id;
    if (row.source === 'authored' && row.connectionId) {
      this.handlers.onRemoveAuthored(row.authoredOwnerId ?? ownerId, row.connectionId);
    } else {
      this.handlers.onSetSuppressed(ownerId, row.pairKey, !row.suppressed);
    }
    this.handlers.onGraphChanged();
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
    content.appendChild(this.rowList);
    content.appendChild(this.emptyLabel);
    content.appendChild(this.connectButton);
    return content;
  }

  /**
   * Builds the container holding connection rows.
   *
   * @returns Row list element.
   */
  private createRowList(): HTMLElement {
    const list = document.createElement('div');
    list.style.display = 'flex';
    list.style.flexDirection = 'column';
    list.style.gap = '2px';
    return list;
  }

  /**
   * Builds the label shown when there is nothing to list.
   *
   * @returns Empty-state element.
   */
  private createEmptyLabel(): HTMLElement {
    const label = document.createElement('span');
    label.style.color = Theme.viewportLabelTextColor;
    label.style.fontSize = '10px';
    return label;
  }

  /**
   * Builds the connect action shown for a two-volume selection.
   *
   * @returns Connect button.
   */
  private createConnectButton(): HTMLButtonElement {
    const button = this.createSmallButton('Connect selected two');
    button.style.display = 'none';
    button.addEventListener('click', () => this.connectSelectedPair());
    return button;
  }

  /** Connects the two selected volumes with an authored link. */
  private connectSelectedPair(): void {
    if (!this.handlers || this.boundGreyBoxes.length !== 2) return;
    const owner = this.boundGreyBoxes[0]!;
    const target = this.boundGreyBoxes[1]!;
    this.handlers.onConnect(GreyBoxRegistry.get(owner).id, GreyBoxRegistry.get(target).id);
    this.handlers.onGraphChanged();
  }

  /**
   * Builds a small inspector button.
   *
   * @param text Button label.
   * @returns Styled button.
   */
  private createSmallButton(text: string): HTMLButtonElement {
    const button = document.createElement('button');
    button.textContent = text;
    button.style.fontSize = '10px';
    button.style.padding = '2px 6px';
    button.style.color = Theme.buttonTextColor;
    button.style.background = '#2a2a2a';
    button.style.border = '1px solid #3a3a3a';
    button.style.borderRadius = '2px';
    button.style.cursor = 'pointer';
    return button;
  }
}
