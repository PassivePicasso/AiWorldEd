import type * as THREE from 'three';

/**
 * Describes one kind of helper wireframe for {@link HelperEdgeFader}: which
 * meshes it covers, which children are its edge lines, how far those edges stay
 * useful, and how its materials switch between render passes.
 */
export interface HelperEdgeFadeProfile {
  /**
   * Returns whether a mesh owns edges this profile manages.
   *
   * @param mesh Candidate scene mesh.
   * @returns True when the mesh is in scope.
   */
  matchesMesh(mesh: THREE.Mesh): boolean;

  /**
   * Returns whether a child object is one of this profile's edge lines.
   *
   * @param child Candidate child of a matched mesh.
   * @returns True when the child is an edge line to toggle.
   */
  matchesEdge(child: THREE.Object3D): boolean;

  /**
   * Returns whether a mesh counts as selected, which extends its fade range.
   *
   * @param mesh Matched mesh.
   * @returns True when the mesh is selected.
   */
  isSelected(mesh: THREE.Mesh): boolean;

  /** Distance beyond which edges stop drawing in the perspective pass. */
  readonly fadeFar: number;

  /**
   * Whether distance measurement refreshes ancestor matrices. False relies on
   * the render loop having flushed them, which costs nothing per mesh and is
   * right for helpers that exist in the thousands; true pays an ancestor walk
   * so helpers nested under freshly moved groups cull against their real
   * position.
   */
  readonly refreshAncestorMatrices: boolean;

  /** Multiplier on {@link fadeFar} for selected meshes. */
  readonly selectedFadeRangeScale: number;

  /**
   * Switches this profile's shared materials between depth-tested perspective
   * output and always-on-top orthographic output.
   *
   * @param root Scene root, for profiles that also restyle per-mesh materials.
   * @param enabled True for 3D depth testing; false for full-bright 2D.
   */
  setDepthOcclusionEnabled(root: THREE.Object3D, enabled: boolean): void;
}
