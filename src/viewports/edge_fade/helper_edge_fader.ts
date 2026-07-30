import * as THREE from 'three';
import type { HelperEdgeFadeProfile } from './helper_edge_fade_profile.js';

/** Scratch state reused while measuring distances each frame. */
const cameraWorldPosition = new THREE.Vector3();
const meshWorldCenter = new THREE.Vector3();
const meshWorldPosition = new THREE.Vector3();
const meshWorldQuaternion = new THREE.Quaternion();
const meshWorldScale = new THREE.Vector3();

/** Last multi-view pass mode; skips redundant full-tree visibility walks. */
type EdgePassMode = 'ortho' | 'perspective' | null;

/**
 * Distance-culls helper wireframes for the perspective multi-view pass and
 * restores complete wireframes for orthographic panes. Shared by solid brush
 * hulls and grey box volumes: both draw helper edges over the same world
 * hierarchy and both need far edges to stop competing with real geometry. What
 * differs between them lives in a {@link HelperEdgeFadeProfile}.
 */
export class HelperEdgeFader {
  private readonly profile: HelperEdgeFadeProfile;
  private lastEdgePassMode: EdgePassMode = null;

  /**
   * Creates a fader for one kind of helper wireframe.
   *
   * @param profile Behaviour specific to that helper kind.
   */
  constructor(profile: HelperEdgeFadeProfile) {
    this.profile = profile;
  }

  /**
   * Hides edges of meshes beyond the fade range for a perspective camera.
   *
   * @param root World group or scene containing helper meshes.
   * @param camera Perspective camera used for distance tests.
   */
  updateForCamera(root: THREE.Object3D, camera: THREE.Camera): void {
    camera.getWorldPosition(cameraWorldPosition);
    this.lastEdgePassMode = 'perspective';
    this.forEachMatchedMesh(root, (mesh) => this.updateEdgeVisibility(mesh));
  }

  /**
   * Restores full edge visibility without changing depth mode. Used when a pane
   * needs every wireframe regardless of distance.
   *
   * @param root World group or scene containing helper meshes.
   */
  showAllEdges(root: THREE.Object3D): void {
    this.lastEdgePassMode = 'ortho';
    this.forEachMatchedMesh(root, (mesh) => this.applyEdgeVisibility(mesh, true));
  }

  /**
   * Prepares always-on-top edges for an orthographic pane and restores every
   * wireframe. Consecutive 2D panes in one frame skip the tree walk.
   *
   * @param root World group or scene containing helper meshes.
   */
  prepareForOrthographicPass(root: THREE.Object3D): void {
    this.profile.setDepthOcclusionEnabled(root, false);
    if (this.lastEdgePassMode === 'ortho') return;
    this.showAllEdges(root);
  }

  /**
   * Restores depth-tested edges before a perspective pass. Visibility is then
   * updated by {@link updateForCamera}.
   *
   * @param root World group or scene containing helper meshes.
   */
  prepareForPerspectivePass(root: THREE.Object3D): void {
    this.profile.setDepthOcclusionEnabled(root, true);
  }

  /**
   * Invalidates the pass cache so the next prepare walks the tree again, after
   * a selection change, undo, or structural edit.
   */
  invalidateCameraCache(): void {
    this.lastEdgePassMode = null;
  }

  /**
   * Runs a callback for every mesh this profile covers.
   *
   * @param root Scene root to walk.
   * @param visit Callback receiving each matched mesh.
   */
  private forEachMatchedMesh(root: THREE.Object3D, visit: (mesh: THREE.Mesh) => void): void {
    root.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      if (!this.profile.matchesMesh(object)) return;
      visit(object);
    });
  }

  /**
   * Shows or hides one mesh's edges based on camera distance, extending the
   * range for selected meshes.
   *
   * @param mesh Matched helper mesh.
   */
  private updateEdgeVisibility(mesh: THREE.Mesh): void {
    const hideBeyond = this.profile.isSelected(mesh)
      ? this.profile.fadeFar * this.profile.selectedFadeRangeScale
      : this.profile.fadeFar;
    this.applyEdgeVisibility(mesh, this.estimateNearestDistance(mesh) < hideBeyond);
  }

  /**
   * Estimates distance from the camera to the nearest point on a mesh. Whether
   * ancestor matrices are refreshed first is the profile's call — see
   * {@link HelperEdgeFadeProfile.refreshAncestorMatrices}.
   *
   * @param mesh Matched helper mesh.
   * @returns Non-negative distance in world units.
   */
  private estimateNearestDistance(mesh: THREE.Mesh): number {
    if (this.profile.refreshAncestorMatrices) {
      mesh.updateWorldMatrix(true, false);
    } else {
      mesh.updateMatrixWorld(false);
    }
    const sphere = mesh.geometry.boundingSphere ?? this.computeBoundingSphere(mesh);
    if (!sphere) {
      mesh.getWorldPosition(meshWorldCenter);
      return cameraWorldPosition.distanceTo(meshWorldCenter);
    }
    meshWorldCenter.copy(sphere.center).applyMatrix4(mesh.matrixWorld);
    mesh.matrixWorld.decompose(meshWorldPosition, meshWorldQuaternion, meshWorldScale);
    const maxScale = Math.max(Math.abs(meshWorldScale.x), Math.abs(meshWorldScale.y), Math.abs(meshWorldScale.z));
    return Math.max(0, cameraWorldPosition.distanceTo(meshWorldCenter) - sphere.radius * maxScale);
  }

  /**
   * Computes and caches a geometry bounding sphere.
   *
   * @param mesh Matched helper mesh.
   * @returns Bounding sphere, or null when the geometry has none.
   */
  private computeBoundingSphere(mesh: THREE.Mesh): THREE.Sphere | null {
    mesh.geometry.computeBoundingSphere();
    return mesh.geometry.boundingSphere;
  }

  /**
   * Applies visibility to a mesh's edge children.
   *
   * @param mesh Matched helper mesh.
   * @param showEdges Whether the edges should draw.
   */
  private applyEdgeVisibility(mesh: THREE.Mesh, showEdges: boolean): void {
    for (const child of mesh.children) {
      if (!this.profile.matchesEdge(child)) continue;
      if (child.visible !== showEdges) {
        child.visible = showEdges;
      }
    }
  }
}
