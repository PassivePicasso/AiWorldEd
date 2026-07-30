import * as THREE from 'three';
import { Theme } from '../../theme.js';

/** UserData flag marking the shared grey box outline material (never disposed). */
export const GREY_BOX_SHARED_MATERIAL_KEY = 'isSharedGreyBoxOutlineMaterial';

/** UserData flag marking materials that carry distance-fade uniforms. */
export const GREY_BOX_DISTANCE_FADE_KEY = 'greyBoxOutlineDistanceFade';

/**
 * Distance where grey box outlines begin fading in the perspective viewport.
 * Far beyond the brush-edge range on purpose: a grey box is the level's layout
 * skeleton, read from across the map, where a brush hull only matters up
 * close.
 */
export const GREY_BOX_EDGE_FADE_NEAR = 120;

/** Distance where grey box outlines are fully faded and culled in perspective. */
export const GREY_BOX_EDGE_FADE_FAR = 320;

/** Base opacity for grey box outlines. */
export const GREY_BOX_EDGE_OPACITY = 0.85;

/**
 * Vertex shader projecting outline verts and computing perspective-only fade.
 * Orthographic panes share this material; Three.js leaves
 * projectionMatrix[2][3] at zero for ortho, so 2D views stay fully opaque while
 * 3D fades with distance.
 */
const OUTLINE_VERTEX_SHADER = `
  uniform float fadeNear;
  uniform float fadeFar;
  varying float vFade;

  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    bool isPerspective = projectionMatrix[2][3] != 0.0;
    if (isPerspective) {
      float distanceFromCamera = length(mvPosition.xyz);
      vFade = 1.0 - smoothstep(fadeNear, fadeFar, distanceFromCamera);
    } else {
      vFade = 1.0;
    }
    gl_Position = projectionMatrix * mvPosition;
  }
`;

/** Fragment shader multiplying the outline color by fade and base opacity. */
const OUTLINE_FRAGMENT_SHADER = `
  uniform vec3 diffuse;
  uniform float opacity;
  varying float vFade;

  void main() {
    float alpha = opacity * vFade;
    if (alpha < 0.012) discard;
    gl_FragColor = vec4(diffuse, alpha);
  }
`;

/**
 * One shared, distance-faded outline material for every grey box volume.
 * Sharing keeps a layout of many volumes to a single material, and the fade
 * plus the per-pass depth mode stop outlines from covering the geometry an
 * agent builds inside them.
 */
export class GreyBoxEdgeMaterials {
  private static shared: THREE.ShaderMaterial | null = null;
  private static depthOcclusionEnabled = true;

  /**
   * Returns the shared grey box outline material.
   *
   * @returns Shared outline material.
   */
  static getOutlineMaterial(): THREE.ShaderMaterial {
    if (!this.shared) {
      this.shared = this.createMaterial();
    }
    return this.shared;
  }

  /**
   * Enables depth testing for the perspective pass, or always-on-top outlines
   * for orthographic panes where a complete wireframe is what makes the layout
   * readable.
   *
   * @param enabled True for 3D depth testing; false for full-bright 2D.
   */
  static setDepthOcclusionEnabled(enabled: boolean): void {
    if (this.depthOcclusionEnabled === enabled) return;
    this.depthOcclusionEnabled = enabled;
    if (this.shared) {
      this.applyDepthMode(this.shared, enabled);
    }
  }

  /**
   * Returns whether outlines currently use depth testing.
   *
   * @returns True when 3D depth testing is active.
   */
  static isDepthOcclusionEnabled(): boolean {
    return this.depthOcclusionEnabled;
  }

  /**
   * Returns whether a material is the shared outline material, so dispose paths
   * skip it.
   *
   * @param material Candidate material.
   * @returns True when the material is shared.
   */
  static isSharedMaterial(material: THREE.Material): boolean {
    return material.userData[GREY_BOX_SHARED_MATERIAL_KEY] === true;
  }

  /**
   * Builds the shared outline material.
   *
   * @returns Configured shader material.
   */
  private static createMaterial(): THREE.ShaderMaterial {
    const material = new THREE.ShaderMaterial({
      uniforms: {
        diffuse: { value: new THREE.Color(Theme.greyBoxEdgeColor) },
        opacity: { value: GREY_BOX_EDGE_OPACITY },
        fadeNear: { value: GREY_BOX_EDGE_FADE_NEAR },
        fadeFar: { value: GREY_BOX_EDGE_FADE_FAR },
      },
      vertexShader: OUTLINE_VERTEX_SHADER,
      fragmentShader: OUTLINE_FRAGMENT_SHADER,
      transparent: true,
      depthTest: this.depthOcclusionEnabled,
      depthWrite: false,
      depthFunc: this.depthOcclusionEnabled ? THREE.LessEqualDepth : THREE.AlwaysDepth,
      toneMapped: false,
    });
    material.userData[GREY_BOX_SHARED_MATERIAL_KEY] = true;
    material.userData[GREY_BOX_DISTANCE_FADE_KEY] = true;
    return material;
  }

  /**
   * Applies depth settings for 3D occlusion or full-bright 2D.
   *
   * @param material Outline material to update.
   * @param depthOcclusionEnabled Whether 3D depth testing is active.
   */
  private static applyDepthMode(material: THREE.ShaderMaterial, depthOcclusionEnabled: boolean): void {
    material.depthTest = depthOcclusionEnabled;
    material.depthWrite = false;
    material.depthFunc = depthOcclusionEnabled ? THREE.LessEqualDepth : THREE.AlwaysDepth;
    material.needsUpdate = true;
  }
}
