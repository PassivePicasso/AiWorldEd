import type * as THREE from 'three';
import { isGreyBox } from './grey_box_keys.js';
import { isGreyBoxFillVisible, isGreyBoxOutline } from './grey_box_visual.js';
import { GREY_BOX_EDGE_FADE_FAR, GreyBoxEdgeMaterials } from './grey_box_edge_materials.js';
import { HelperEdgeFader } from '../../viewports/edge_fade/helper_edge_fader.js';
import type { HelperEdgeFadeProfile } from '../../viewports/edge_fade/helper_edge_fade_profile.js';

/** Fade-far multiplier for selected volumes so their outline stays available. */
const SELECTED_FADE_RANGE_SCALE = 1.75;

/** Fade behaviour for grey box volume outlines. */
const GREY_BOX_EDGE_PROFILE: HelperEdgeFadeProfile = {
  matchesMesh: (mesh) => isGreyBox(mesh),
  matchesEdge: (child) => isGreyBoxOutline(child),
  isSelected: (mesh) => isGreyBoxFillVisible(mesh),
  fadeFar: GREY_BOX_EDGE_FADE_FAR,
  selectedFadeRangeScale: SELECTED_FADE_RANGE_SCALE,
  refreshAncestorMatrices: true,
  setDepthOcclusionEnabled: (_root, enabled) => GreyBoxEdgeMaterials.setDepthOcclusionEnabled(enabled),
};

/** Shared fader instance driving grey box outline visibility. */
const greyBoxEdgeFader = new HelperEdgeFader(GREY_BOX_EDGE_PROFILE);

/**
 * Distance-culls grey box outlines in the perspective pass so a large layout
 * does not bury the geometry built inside it, and restores complete wireframes
 * for the orthographic panes where the layout is read.
 *
 * Traversal, distance, and pass-cache logic live in {@link HelperEdgeFader},
 * shared with solid brush hull edges.
 */
export class GreyBoxEdgeFader {
  /**
   * Hides outlines of volumes beyond the fade range for a perspective camera.
   *
   * @param root World group or scene containing grey box volumes.
   * @param camera Perspective camera used for distance tests.
   */
  static updateForCamera(root: THREE.Object3D, camera: THREE.Camera): void {
    greyBoxEdgeFader.updateForCamera(root, camera);
  }

  /**
   * Restores depth-tested outlines before a perspective pass. Visibility is
   * then updated by {@link updateForCamera}.
   *
   * @param root World group or scene containing grey box volumes.
   */
  static prepareForPerspectivePass(root: THREE.Object3D): void {
    greyBoxEdgeFader.prepareForPerspectivePass(root);
  }

  /**
   * Restores full outline visibility without depth testing for an orthographic
   * pane. Consecutive 2D panes in one frame skip the tree walk.
   *
   * @param root World group or scene containing grey box volumes.
   */
  static prepareForOrthographicPass(root: THREE.Object3D): void {
    greyBoxEdgeFader.prepareForOrthographicPass(root);
  }

  /**
   * Invalidates the pass cache so the next prepare walks the tree again, after
   * a selection change, undo, or structural edit.
   */
  static invalidateCameraCache(): void {
    greyBoxEdgeFader.invalidateCameraCache();
  }
}
