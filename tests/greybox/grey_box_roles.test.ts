import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import {
  DEFAULT_GREY_BOX_ROLE,
  KNOWN_GREY_BOX_ROLES,
  isKnownGreyBoxRole,
  normalizeGreyBoxRole,
} from '../../src/greybox/model/grey_box_role.js';
import { GreyBoxEdgeMaterials } from '../../src/greybox/model/grey_box_edge_materials.js';
import { createGreyBoxMesh, createDefaultGreyBoxMesh } from '../../src/greybox/model/grey_box_factory.js';
import { getGreyBoxRole, setGreyBoxRole } from '../../src/greybox/model/grey_box_access.js';
import { isGreyBoxOutline, setGreyBoxFillVisible } from '../../src/greybox/model/grey_box_visual.js';
import { SetGreyBoxRoleCommand } from '../../src/commands/greybox/set_grey_box_role_command.js';
import { commitGreyBoxRole } from '../../src/managers/hierarchy/grey_box_description_commit.js';
import { CommandStack } from '../../src/commands/command_stack.js';
import { GreyBoxCodec } from '../../src/greybox/io/grey_box_codec.js';
import { createGreyBoxData } from '../../src/greybox/model/grey_box_data.js';
import { ObjectIconFactory } from '../../src/ui/outliner/object_icon_factory.js';
import { setObjectLocked } from '../../src/utils/object_lock.js';
import { Theme } from '../../src/theme.js';

const COMMAND_STACK_LIMIT = 32;

describe('grey box role vocabulary', () => {
  it('offers the documented blockout roles', () => {
    for (const role of ['room', 'corridor', 'bridge', 'ledge', 'pit', 'ravine', 'cover', 'hazard']) {
      expect(isKnownGreyBoxRole(role), role).toBe(true);
    }
  });

  it('accepts a role outside the documented set', () => {
    expect(isKnownGreyBoxRole('my_weird_thing')).toBe(false);
    expect(normalizeGreyBoxRole('My_Weird_Thing')).toBe('my_weird_thing');
  });

  it('falls back to the default for blank text', () => {
    expect(normalizeGreyBoxRole('   ')).toBe(DEFAULT_GREY_BOX_ROLE);
  });

  it('gives every documented role its own colour', () => {
    const colors = KNOWN_GREY_BOX_ROLES.map((role) => GreyBoxEdgeMaterials.colorForRole(role));
    expect(new Set(colors).size).toBe(colors.length);
  });

  it('colours an unknown role with the neutral fallback', () => {
    expect(GreyBoxEdgeMaterials.colorForRole('my_weird_thing')).toBe(Theme.greyBoxEdgeColor);
  });
});

describe('grey box role materials', () => {
  it('shares one outline material per role', () => {
    const firstBridge = createGreyBoxMesh('BridgeA', 4, 1, 4, 'bridge');
    const secondBridge = createGreyBoxMesh('BridgeB', 8, 1, 8, 'bridge');
    expect(outlineMaterial(firstBridge)).toBe(outlineMaterial(secondBridge));
  });

  it('uses a different material for a different role', () => {
    const bridge = createGreyBoxMesh('Bridge', 4, 1, 4, 'bridge');
    const pit = createGreyBoxMesh('Pit', 4, 4, 4, 'pit');
    expect(outlineMaterial(bridge)).not.toBe(outlineMaterial(pit));
  });

  it('draws the outline in the role colour', () => {
    const hazard = createGreyBoxMesh('Hazard', 4, 4, 4, 'hazard');
    const material = outlineMaterial(hazard);
    const color = material.uniforms['diffuse']!.value as THREE.Color;
    expect(color.getHex()).toBe(GreyBoxEdgeMaterials.colorForRole('hazard'));
  });

  it('tints the fill to match the role', () => {
    const cover = createGreyBoxMesh('Cover', 2, 1, 2, 'cover');
    const material = cover.material as THREE.MeshBasicMaterial;
    expect(material.color.getHex()).toBe(GreyBoxEdgeMaterials.colorForRole('cover'));
  });

  it('keeps the distance fade and depth switching on role materials', () => {
    const material = GreyBoxEdgeMaterials.getOutlineMaterial('ravine');
    expect(material.uniforms['fadeNear']).toBeDefined();
    expect(material.vertexShader).toContain('isPerspective');
    GreyBoxEdgeMaterials.setDepthOcclusionEnabled(false);
    expect(material.depthTest).toBe(false);
    GreyBoxEdgeMaterials.setDepthOcclusionEnabled(true);
    expect(material.depthTest).toBe(true);
  });

  it('switches depth mode on every role material at once', () => {
    const bridge = GreyBoxEdgeMaterials.getOutlineMaterial('bridge');
    const pit = GreyBoxEdgeMaterials.getOutlineMaterial('pit');
    GreyBoxEdgeMaterials.setDepthOcclusionEnabled(false);
    expect(bridge.depthTest).toBe(false);
    expect(pit.depthTest).toBe(false);
    GreyBoxEdgeMaterials.setDepthOcclusionEnabled(true);
  });
});

describe('grey box role authoring', () => {
  let commandStack: CommandStack;

  beforeEach(() => {
    commandStack = new CommandStack(COMMAND_STACK_LIMIT);
  });

  it('defaults a new volume to the default role', () => {
    expect(getGreyBoxRole(createDefaultGreyBoxMesh('GreyBox001'))).toBe(DEFAULT_GREY_BOX_ROLE);
  });

  it('stores a role given at creation', () => {
    expect(getGreyBoxRole(createGreyBoxMesh('Bridge', 4, 1, 4, 'bridge'))).toBe('bridge');
  });

  it('normalizes a role written in mixed case', () => {
    const mesh = createDefaultGreyBoxMesh('GreyBox001');
    setGreyBoxRole(mesh, 'Ravine');
    expect(getGreyBoxRole(mesh)).toBe('ravine');
  });

  it('applies and undoes a role change', () => {
    const mesh = createDefaultGreyBoxMesh('GreyBox001');
    const command = SetGreyBoxRoleCommand.fromCurrent(mesh, 'pit');
    command.execute();
    expect(getGreyBoxRole(mesh)).toBe('pit');
    command.undo();
    expect(getGreyBoxRole(mesh)).toBe(DEFAULT_GREY_BOX_ROLE);
  });

  it('restyles the volume when the role changes', () => {
    const mesh = createDefaultGreyBoxMesh('GreyBox001');
    SetGreyBoxRoleCommand.fromCurrent(mesh, 'hazard').execute();
    expect(outlineMaterial(mesh)).toBe(GreyBoxEdgeMaterials.getOutlineMaterial('hazard'));
    expect((mesh.material as THREE.MeshBasicMaterial).color.getHex()).toBe(GreyBoxEdgeMaterials.colorForRole('hazard'));
  });

  it('keeps fill visibility across a role change', () => {
    const mesh = createDefaultGreyBoxMesh('GreyBox001');
    setGreyBoxFillVisible(mesh, true);
    SetGreyBoxRoleCommand.fromCurrent(mesh, 'cover').execute();
    expect((mesh.material as THREE.MeshBasicMaterial).opacity).toBeGreaterThan(0);
  });

  it('reports when a role change would do nothing', () => {
    const mesh = createGreyBoxMesh('Bridge', 4, 1, 4, 'bridge');
    expect(SetGreyBoxRoleCommand.fromCurrent(mesh, 'bridge').changesRole()).toBe(false);
    expect(SetGreyBoxRoleCommand.fromCurrent(mesh, 'ledge').changesRole()).toBe(true);
  });

  it('pushes one undo entry per committed role change', () => {
    const mesh = createDefaultGreyBoxMesh('GreyBox001');
    commitGreyBoxRole(commandStack, mesh, 'ledge');
    expect(commandStack.getUndoCount()).toBe(1);
    commitGreyBoxRole(commandStack, mesh, 'ledge');
    expect(commandStack.getUndoCount()).toBe(1);
    commandStack.undo();
    expect(getGreyBoxRole(mesh)).toBe(DEFAULT_GREY_BOX_ROLE);
  });

  it('refuses to reclassify a locked volume', () => {
    const mesh = createDefaultGreyBoxMesh('GreyBox001');
    setObjectLocked(mesh, true);
    commitGreyBoxRole(commandStack, mesh, 'pit');
    expect(getGreyBoxRole(mesh)).toBe(DEFAULT_GREY_BOX_ROLE);
  });
});

describe('grey box role persistence', () => {
  it('round-trips a role through the codec', () => {
    const data = createGreyBoxData('greybox-1', 'a ravine', 'ravine');
    const decoded = GreyBoxCodec.decode(GreyBoxCodec.encode(data), '"Ravine" (uuid)');
    expect(decoded.role).toBe('ravine');
  });

  it('round-trips an unknown role untouched', () => {
    const data = createGreyBoxData('greybox-1', '', 'my_weird_thing');
    const decoded = GreyBoxCodec.decode(GreyBoxCodec.encode(data), '"Odd" (uuid)');
    expect(decoded.role).toBe('my_weird_thing');
  });

  it('migrates a payload written before roles existed', () => {
    const payload = {
      id: 'greybox-1',
      description: 'from an older scene',
      explicitConnections: [],
      suppressedDerivedConnections: [],
    };
    expect(GreyBoxCodec.decode(payload, '"Legacy" (uuid)').role).toBe(DEFAULT_GREY_BOX_ROLE);
  });

  it('still rejects a role that is present but not a string', () => {
    const payload = {
      id: 'greybox-1',
      description: '',
      role: 42,
      explicitConnections: [],
      suppressedDerivedConnections: [],
    };
    expect(() => GreyBoxCodec.decode(payload, '"Broken" (uuid)')).toThrow(/missing a string role/);
  });
});

describe('grey box outliner icon', () => {
  it('tints the icon by role', () => {
    const bridge = ObjectIconFactory.getIcon(createGreyBoxMesh('Bridge', 4, 1, 4, 'bridge'));
    const pit = ObjectIconFactory.getIcon(createGreyBoxMesh('Pit', 4, 4, 4, 'pit'));
    expect(bridge.color).not.toBe(pit.color);
    expect(bridge.character).toBe('▢');
  });

  it('uses the fallback colour for an unknown role', () => {
    const icon = ObjectIconFactory.getIcon(createGreyBoxMesh('Odd', 4, 4, 4, 'my_weird_thing'));
    expect(icon.color).toBe(`#${Theme.greyBoxEdgeColor.toString(16).padStart(6, '0')}`);
  });
});

/**
 * Reads the outline material of a grey box volume.
 *
 * @param mesh Grey box volume mesh.
 * @returns Shared outline shader material.
 */
function outlineMaterial(mesh: THREE.Mesh): THREE.ShaderMaterial {
  const outline = mesh.children.find((child) => isGreyBoxOutline(child)) as THREE.LineSegments;
  return outline.material as THREE.ShaderMaterial;
}
