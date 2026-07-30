import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { MCP_TOOL_DEFINITIONS, findMcpTool, listMcpTools } from '../../../src/ai/server/mcp_tool_registry.js';
import { EditorApi } from '../../../src/ai/client/editor_api.js';
import type { EditorApiHost } from '../../../src/ai/client/editor_api_host.js';
import { CommandStack } from '../../../src/commands/command_stack.js';
import { SelectionManager } from '../../../src/selection/object/selection_manager.js';
import { SolidModelController } from '../../../src/managers/solid/solid_model_controller.js';
import { SolidModelPanel } from '../../../src/ui/solid_model_panel.js';
import { GridSnap } from '../../../src/transform/snap/grid_snap.js';
import { SnapManager } from '../../../src/transform/snap/snap_manager.js';

const COMMAND_STACK_LIMIT = 16;

/** Grey box tools the catalog must expose. */
const GREY_BOX_TOOLS = [
  'list_grey_boxes',
  'get_grey_box',
  'get_grey_box_graph',
  'create_grey_box',
  'rename_grey_box',
  'set_grey_box_description',
  'set_grey_box_role',
  'set_grey_box_intent',
  'set_grey_box_transform',
  'delete_grey_boxes',
  'connect_grey_boxes',
  'disconnect_grey_boxes',
];

describe('MCP tool catalog coverage', () => {
  it('exposes every grey box tool', () => {
    for (const name of GREY_BOX_TOOLS) {
      expect(findMcpTool(name), name).toBeDefined();
    }
  });

  it('registers no tool name twice', () => {
    const names = MCP_TOOL_DEFINITIONS.map((definition) => definition.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('gives every tool a description and an object schema', () => {
    for (const definition of MCP_TOOL_DEFINITIONS) {
      expect(definition.description.length, definition.name).toBeGreaterThan(10);
      expect(definition.inputSchema['type'], definition.name).toBe('object');
    }
  });

  it('routes every registered tool to a handler', () => {
    const api = new EditorApi(createCoverageHost());
    for (const definition of MCP_TOOL_DEFINITIONS) {
      const result = api.invokeTool(definition.name, {});
      expect(result.message.startsWith('Unknown tool'), definition.name).toBe(false);
    }
  });

  it('rejects a name that is not in the catalog', () => {
    const api = new EditorApi(createCoverageHost());
    const result = api.invokeTool('not_a_real_tool', {});
    expect(result.ok).toBe(false);
    expect(result.message).toContain('Unknown tool');
  });

  it('states in the grey box descriptions that volumes are not geometry', () => {
    const planningTools = ['list_grey_boxes', 'get_grey_box', 'create_grey_box'];
    for (const name of planningTools) {
      const description = findMcpTool(name)!.description.toLowerCase();
      expect(description, name).toContain('planning volume');
      expect(description, name).toContain('export');
    }
  });

  it('keeps the grey box graph tool discoverable by its purpose', () => {
    const description = findMcpTool('get_grey_box_graph')!.description.toLowerCase();
    expect(description).toContain('layout');
    expect(description).toContain('hierarchy');
    expect(description).toContain('buildorder');
  });

  it('tells an agent that volumes nest and what fixity obliges', () => {
    for (const name of ['list_grey_boxes', 'get_grey_box', 'create_grey_box']) {
      expect(findMcpTool(name)!.description.toLowerCase(), name).toContain('nest');
    }
    for (const name of ['list_grey_boxes', 'get_grey_box', 'set_grey_box_intent']) {
      const description = findMcpTool(name)!.description.toLowerCase();
      expect(description, name).toContain('exact');
      expect(description, name).toContain('approximate');
    }
  });

  it('says nesting and intersection are normal rather than mistakes', () => {
    const description = findMcpTool('get_grey_box_graph')!.description.toLowerCase();
    expect(description).toContain('normal in a blockout');
  });

  it('lists more tools than before grey boxes were added', () => {
    expect(listMcpTools().tools.length).toBeGreaterThanOrEqual(MCP_TOOL_DEFINITIONS.length);
    expect(MCP_TOOL_DEFINITIONS.length).toBeGreaterThan(55);
  });
});

/**
 * Builds a host with an empty world for catalog coverage checks.
 *
 * @returns Host bag backed by an empty scene.
 */
function createCoverageHost(): EditorApiHost {
  const worldObject = new THREE.Group();
  const commandStack = new CommandStack(COMMAND_STACK_LIMIT);
  const selectionManager = new SelectionManager();
  const panel = new SolidModelPanel(document.createElement('div'), { onAddBoxBrush: () => undefined });
  return {
    worldObject,
    commandStack,
    selectionManager,
    solidModelController: new SolidModelController(worldObject, commandStack, selectionManager, panel),
    gridSnap: new GridSnap(true, 0.25),
    snapManager: new SnapManager(0.25),
    getUserSnapEnabled: () => true,
    refreshAfterWorldMutation: () => undefined,
    refreshOutliner: () => undefined,
    showStatus: () => undefined,
  };
}
