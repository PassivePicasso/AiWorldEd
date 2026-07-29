import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { buildExportScene, shouldOmitFromExport } from '../../src/io/export_scene_builder.js';
import { ObjExporter } from '../../src/io/obj/obj_exporter.js';
import { FbxExporter } from '../../src/io/fbx/fbx_exporter.js';
import { GlbExporter } from '../../src/io/glb/glb_exporter.js';
import { createGreyBoxFixture, createContentBox } from './grey_box_fixture.js';

const GREY_BOX_NAME = 'PlanningVolumeOnly';
const CONTENT_NAME = 'RealGeometry';

describe('grey box export exclusion', () => {
  let world: THREE.Group;

  beforeEach(() => {
    world = new THREE.Group();
  });

  it('omits grey boxes from the export scene', () => {
    const { mesh } = createGreyBoxFixture(GREY_BOX_NAME, size(8, 4, 8), new THREE.Vector3(), 'blocked-out hall');
    world.add(mesh);
    expect(shouldOmitFromExport(mesh)).toBe(true);
    expect(buildExportScene(world).children.length).toBe(0);
  });

  it('keeps real geometry while dropping the grey box beside it', () => {
    const { mesh } = createGreyBoxFixture(GREY_BOX_NAME, size(8, 4, 8), new THREE.Vector3(), '');
    world.add(mesh);
    world.add(createContentBox(CONTENT_NAME, size(2, 2, 2)));
    const exportRoot = buildExportScene(world);
    expect(exportRoot.children.length).toBe(1);
    expect(exportRoot.children[0]!.name).toBe(CONTENT_NAME);
  });

  it('drops a grey box nested inside an exported group', () => {
    const { mesh } = createGreyBoxFixture(GREY_BOX_NAME, size(6, 3, 6), new THREE.Vector3(), '');
    const group = new THREE.Group();
    group.name = 'Layout';
    group.add(mesh);
    group.add(createContentBox(CONTENT_NAME, size(1, 1, 1)));
    world.add(group);
    const exportRoot = buildExportScene(world);
    const exportedNames: string[] = [];
    exportRoot.traverse((object) => exportedNames.push(object.name));
    expect(exportedNames).toContain(CONTENT_NAME);
    expect(exportedNames).not.toContain(GREY_BOX_NAME);
  });

  it('omits grey boxes from OBJ output', () => {
    addGreyBoxAndContent(world);
    const text = new ObjExporter().export(world);
    expect(text).toContain(CONTENT_NAME);
    expect(text).not.toContain(GREY_BOX_NAME);
  });

  it('omits grey boxes from FBX output', () => {
    addGreyBoxAndContent(world);
    const text = new FbxExporter().export(world);
    expect(text).toContain(CONTENT_NAME);
    expect(text).not.toContain(GREY_BOX_NAME);
  });

  it('omits grey boxes from GLB output', async () => {
    addGreyBoxAndContent(world);
    const buffer = await new GlbExporter().export(world);
    const bytes = new Uint8Array(buffer);
    const asText = String.fromCharCode(...bytes.slice(0, bytes.length));
    expect(asText).toContain(CONTENT_NAME);
    expect(asText).not.toContain(GREY_BOX_NAME);
  });
});

/**
 * Adds one grey box and one content mesh to a world.
 *
 * @param world World group to populate.
 */
function addGreyBoxAndContent(world: THREE.Group): void {
  const { mesh } = createGreyBoxFixture(
    GREY_BOX_NAME,
    size(8, 4, 8),
    new THREE.Vector3(),
    'layout aid, never exported',
  );
  world.add(mesh);
  world.add(createContentBox(CONTENT_NAME, size(2, 2, 2)));
}

/**
 * Builds a size vector.
 *
 * @param x Width.
 * @param y Height.
 * @param z Depth.
 * @returns Size vector.
 */
function size(x: number, y: number, z: number): THREE.Vector3 {
  return new THREE.Vector3(x, y, z);
}
