import * as THREE from 'three';
import { GreyBoxConnectionDirection } from '../model/grey_box_connection.js';
import { GreyBoxFaceContact, GreyBoxRelationKind } from './grey_box_derived_connection.js';
import type { GreyBoxContainment } from './grey_box_containment.js';
import type { GreyBoxContainmentTree } from './grey_box_containment_tree.js';

/** One grey box volume as a graph node. */
export interface GreyBoxGraphNode {
  /** Stable grey box id. */
  id: string;

  /** Display name. */
  name: string;

  /** User-authored purpose of the volume. */
  description: string;

  /** World center of the volume. */
  center: THREE.Vector3;

  /** World size of the volume along its own axes. */
  size: THREE.Vector3;

  /** Id of the volume this one sits inside, or null when it is a root. */
  parentId: string | null;

  /** Nesting depth, zero for a root. */
  depth: number;

  /** Whether the parent was stated by Outliner parenting rather than derived. */
  authoredParent: boolean;
}

/** An authored link as it appears on a merged edge. */
export interface GreyBoxAuthoredLink {
  /** Connection id, unique within the owning volume. */
  id: string;

  /** Volume that authored the link. */
  ownerId: string;

  /** Volume on the far side. */
  targetId: string;

  /** Free-form route label. */
  kind: string;

  /** User note. */
  note: string;

  /** Whether the route is traversable both ways. */
  direction: GreyBoxConnectionDirection;
}

/**
 * One edge of the merged layout graph. Derived and authored edges are
 * distinguishable, and an authored link that duplicates a derived adjacency
 * annotates it rather than adding a second edge.
 */
export interface GreyBoxGraphEdge {
  /** Canonical order-independent key for the pair. */
  pairKey: string;

  /** Id sorted first in the pair key. */
  firstId: string;

  /** Id sorted second in the pair key. */
  secondId: string;

  /** Whether geometry implies this edge or the user stated it. */
  source: 'derived' | 'authored';

  /**
   * Every relation this pair holds. Empty for an authored edge between volumes
   * that geometry says nothing about.
   */
  relations: GreyBoxRelationKind[];

  /** Containment when one volume sits inside the other, else null. */
  containment: GreyBoxContainment | null;

  /** Shared face regions when the edge comes from geometry. */
  contacts: GreyBoxFaceContact[];

  /** Sum of shared face areas; zero when there is no face contact. */
  totalContactArea: number;

  /** Overlap region for interpenetrating pairs, else null. */
  overlapBounds: THREE.Box3 | null;

  /** Authored links covering this pair, empty for a purely derived edge. */
  authoredLinks: GreyBoxAuthoredLink[];
}

/** A problem found while merging, surfaced rather than silently dropped. */
export interface GreyBoxGraphProblem {
  /** Connection id the problem belongs to. */
  connectionId: string;

  /** Volume that authored the connection. */
  ownerId: string;

  /** Target the connection names. */
  targetId: string;

  /** Human-readable description of what is wrong. */
  message: string;
}

/** The merged layout graph: derived minus suppressed, plus authored links. */
export interface GreyBoxMergedGraph {
  /** Every grey box volume. */
  nodes: GreyBoxGraphNode[];

  /** Edges in stable pair-key order. */
  edges: GreyBoxGraphEdge[];

  /** The containment hierarchy the volumes form. */
  tree: GreyBoxContainmentTree;

  /** Derived adjacencies the user muted, in stable order. */
  suppressedPairKeys: string[];

  /** Authored connections that could not be resolved. */
  problems: GreyBoxGraphProblem[];
}
