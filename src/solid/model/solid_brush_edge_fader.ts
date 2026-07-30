import * as THREE from 'three';
import { SolidBrushVisual } from './solid_brush_visual.js';
import {
  BRUSH_EDGE_FADE_FAR,
  SOLID_BRUSH_EDGE_USERDATA_KEY,
  SolidBrushEdgeMaterials,
} from './solid_brush_edge_materials.js';
import { HelperEdgeFader } from '../../viewports/edge_fade/helper_edge_fader.js';
import type { HelperEdgeFadeProfile } from '../../viewports/edge_fade/helper_edge_fade_profile.js';

/**
 * Multiplier on fade-far for selected brushes so their edges stay available
 * longer.
 */
const SELECTED_FADE_RANGE_SCALE = 1.75;

/**
 * Fade behaviour for solid brush hull edges. Brushes whose edges are batched at
 * the solid root are skipped: those fade through the shared edge shader instead
 * of per-mesh visibility.
 */
const BRUSH_EDGE_PROFILE: HelperEdgeFadeProfile = {
  matchesMesh: (mesh) => SolidBrushVisual.isBrushObject(mesh) && SolidBrushVisual.hasLocalEdges(mesh),
  matchesEdge: (child) => child instanceof THREE.LineSegments && child.userData[SOLID_BRUSH_EDGE_USERDATA_KEY] === true,
  isSelected: (mesh) => SolidBrushVisual.isHullFillVisible(mesh),
  fadeFar: BRUSH_EDGE_FADE_FAR,
  selectedFadeRangeScale: SELECTED_FADE_RANGE_SCALE,
  refreshAncestorMatrices: false,
  setDepthOcclusionEnabled: (root, enabled) => {
    SolidBrushEdgeMaterials.setDepthOcclusionEnabled(enabled);
    SolidBrushVisual.setHullFillDepthOcclusionEnabled(root, enabled);
  },
};

/** Shared fader instance driving brush edge visibility. */
const brushEdgeFader = new HelperEdgeFader(BRUSH_EDGE_PROFILE);

/**
 * Distance-culls solid brush edge helpers for the perspective multi-view pass.
 * Far brushes hide edge draws so large maps rely on compiled solid geometry.
 * Shared-scene 2D panes restore full edge visibility and disable depth testing
 * so wireframes stay complete over sky / solid depth.
 *
 * The traversal, distance, and pass-cache logic lives in
 * {@link HelperEdgeFader}, shared with grey box volumes.
 */
export class SolidBrushEdgeFader {
  /**
   * Distance-culls personal brush edge LineSegments under a scene root.
   *
   * @param root World group or scene containing solid brush helpers.
   * @param camera Perspective camera used for distance tests.
   */
  static updateForCamera(root: THREE.Object3D, camera: THREE.Camera): void {
    brushEdgeFader.updateForCamera(root, camera);
  }

  /**
   * Restores full personal brush edge visibility for orthographic multi-view
   * panes that share the world hierarchy with the perspective pass.
   *
   * @param root World group or scene containing solid brush helpers.
   */
  static showAllEdges(root: THREE.Object3D): void {
    brushEdgeFader.showAllEdges(root);
  }

  /**
   * Prepares shared brush edges and selected hull fills for an orthographic
   * multi-view pass: full-bright lines without depth darkening.
   *
   * @param root World group or scene containing solid brush helpers.
   */
  static prepareForOrthographicPass(root: THREE.Object3D): void {
    brushEdgeFader.prepareForOrthographicPass(root);
  }

  /**
   * Restores depth-tested brush edges and selected hull fills before a
   * perspective pass. Edge visibility is then updated by
   * {@link updateForCamera}.
   *
   * @param root World group or scene containing solid brush helpers.
   */
  static prepareForPerspectivePass(root: THREE.Object3D): void {
    brushEdgeFader.prepareForPerspectivePass(root);
  }

  /**
   * Invalidates the multi-view edge-pass cache so the next prepare walks the
   * brush tree again (selection changes, undo, or structural edits).
   */
  static invalidateCameraCache(): void {
    brushEdgeFader.invalidateCameraCache();
  }
}
