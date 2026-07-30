import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { findMcpTool } from '../../src/ai/server/mcp_tool_registry.js';
import { KNOWN_GREY_BOX_ROLES } from '../../src/greybox/model/grey_box_role.js';

/** Backtick used when checking code-quoted values in the docs. */
const QUOTE = String.fromCharCode(96);

/** User guide page describing grey box planning volumes. */
const GREY_BOX_PAGE = 'documentation/grey_boxes.md';

/** Pages that must point readers at the grey box page. */
const REFERRING_PAGES = ['documentation/README.md', 'documentation/creating_and_transforming.md'];

/** MCP overview that documents the grey box tools for agents. */
const MCP_README = 'src/ai/README.md';

/**
 * Reads a repository file as text.
 *
 * @param relativePath Path from the repository root.
 * @returns File contents.
 */
function readRepoFile(relativePath: string): string {
  const absolute = resolve(process.cwd(), relativePath);
  expect(existsSync(absolute), relativePath).toBe(true);
  return readFileSync(absolute, 'utf8');
}

/**
 * Extracts backtick-quoted tool names that look like MCP tool identifiers.
 *
 * @param text Markdown source.
 * @returns Unique candidate tool names.
 */
function extractGreyBoxToolNames(text: string): string[] {
  const pattern = /`(?:list|get|create|rename|set|delete|connect|disconnect|reparent|ungroup)_grey_box[a-z_]*`/g;
  const matches = text.match(pattern) ?? [];
  return [...new Set(matches.map((match) => match.replaceAll('`', '')))];
}

describe('grey box documentation', () => {
  it('ships a user guide page', () => {
    const page = readRepoFile(GREY_BOX_PAGE);
    expect(page).toContain('# Grey Boxes');
  });

  it('states that volumes are excluded from geometry and export', () => {
    const page = readRepoFile(GREY_BOX_PAGE).toLowerCase();
    expect(page).toContain('never compile');
    expect(page).toContain('never appear in an fbx, obj, or glb export');
  });

  it('teaches nesting as the normal case', () => {
    const page = readRepoFile(GREY_BOX_PAGE);
    expect(page).toContain('## Nesting is the normal case');
    expect(page.toLowerCase()).toContain('feature of that space');
    expect(page.toLowerCase()).toContain('perfectly normal');
  });

  it('no longer frames overlap as a probable mistake', () => {
    const page = readRepoFile(GREY_BOX_PAGE).toLowerCase();
    expect(page).not.toContain('usually means you intended one merged space');
  });

  it('documents the three relation kinds', () => {
    const page = readRepoFile(GREY_BOX_PAGE);
    for (const relation of ['**contains**', '**adjacent**', '**overlaps**']) {
      expect(page, relation).toContain(relation);
    }
  });

  it('documents Outliner parenting as the containment override', () => {
    const page = readRepoFile(GREY_BOX_PAGE);
    expect(page).toContain('### Correcting the hierarchy');
    expect(page).toContain('parent one grey box under another in the Outliner');
  });

  it('documents every role the editor understands', () => {
    const page = readRepoFile(GREY_BOX_PAGE);
    for (const role of KNOWN_GREY_BOX_ROLES) {
      expect(page, role).toContain(QUOTE + role + QUOTE);
    }
  });

  it('documents what fixity obliges and permits', () => {
    const page = readRepoFile(GREY_BOX_PAGE);
    expect(page).toContain('Dimensions are exact');
    expect(page.toLowerCase()).toContain('must be built');
    expect(page.toLowerCase()).toContain('suggestion an agent may');
  });

  it('documents surface intent as feel rather than texture assignment', () => {
    const page = readRepoFile(GREY_BOX_PAGE);
    expect(page).toContain('Surface and mood');
    expect(page.toLowerCase()).toContain('not texture assignments');
  });

  it('shows the brief an agent receives in the worked example', () => {
    const page = readRepoFile(GREY_BOX_PAGE);
    expect(page).toContain('rootGreyBoxIds');
    expect(page).toContain('buildOrder');
    expect(page).toContain('contains ratio');
  });

  it('documents the real Add menu path', () => {
    const page = readRepoFile(GREY_BOX_PAGE);
    expect(page).toContain('Add > Layout > Grey Box');
  });

  it('names the inspector sections that exist', () => {
    const page = readRepoFile(GREY_BOX_PAGE);
    expect(page).toContain('**Grey Box** section of the Properties panel');
    expect(page).toContain('**Grey Box Connections**');
  });

  it('documents the connect and mute actions by their button labels', () => {
    const page = readRepoFile(GREY_BOX_PAGE);
    expect(page).toContain('Connect selected two');
    expect(page).toContain('**Mute**');
    expect(page).toContain('**Unmute**');
  });

  it('shows a nested worked example with description guidance', () => {
    const page = readRepoFile(GREY_BOX_PAGE);
    expect(page).toContain('## A worked example');
    expect(page.toLowerCase()).toContain('nested inside the hall');
    expect(page.toLowerCase()).toContain('weak description');
  });

  it('teaches grouping as navigation rather than as layout meaning', () => {
    const page = readRepoFile(GREY_BOX_PAGE);
    expect(page).toContain('## Grouping: keeping a large layout navigable');
    const lowered = page.toLowerCase();
    expect(lowered).toContain('a folder, not a space');
    expect(lowered).toContain('no geometry of its own');
    expect(lowered).toContain('says nothing about the layout');
  });

  it('names the real grouping actions and what deleting a group costs', () => {
    const page = readRepoFile(GREY_BOX_PAGE);
    expect(page).toContain('**Edit > Group**');
    expect(page).toContain('**Edit > Ungroup**');
    expect(page.toLowerCase()).toContain('deleting a group deletes everything inside');
  });

  it('is linked from the pages that introduce it', () => {
    for (const path of REFERRING_PAGES) {
      expect(readRepoFile(path), path).toContain('grey_boxes.md');
    }
  });

  it('links only to pages that exist', () => {
    const page = readRepoFile(GREY_BOX_PAGE);
    const links = page.match(/\]\(([a-z0-9_]+\.md)\)/g) ?? [];
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      const target = link.slice(2, -1);
      expect(existsSync(resolve(process.cwd(), 'documentation', target)), target).toBe(true);
    }
  });

  it('documents the grey box workflow for agents in the MCP overview', () => {
    const readme = readRepoFile(MCP_README);
    expect(readme).toContain('## Grey boxes: read the layout, then populate it');
    expect(readme.toLowerCase()).toContain('planning volumes, not');
  });

  it('tells agents that volumes nest and to build outside in', () => {
    const readme = readRepoFile(MCP_README).toLowerCase();
    expect(readme).toContain('they **nest**');
    expect(readme).toContain('work outside in');
    expect(readme).toContain('buildorder');
  });

  it('states the fixity contract for agents', () => {
    const readme = readRepoFile(MCP_README);
    expect(readme).toContain('sizeIntent: "exact"');
    expect(readme.toLowerCase()).toContain('suggestion you may refine');
  });

  it('warns agents not to build to a group kind node', () => {
    const readme = readRepoFile(MCP_README).toLowerCase();
    expect(readme).toContain("never build to a group's dimensions");
    expect(readme).toContain('takes its center and size from what it holds');
    for (const name of ['create_grey_box_group', 'reparent_grey_boxes', 'ungroup_grey_box_groups']) {
      expect(readme, name).toContain(name);
    }
  });

  it('states the same warning in the tool catalog an agent reads', () => {
    for (const name of ['create_grey_box_group', 'list_grey_boxes']) {
      expect(toolDescription(name).toLowerCase(), name).toContain('a folder, not a space');
    }
  });

  it('references only grey box tool names that exist in the catalog', () => {
    const names = extractGreyBoxToolNames(readRepoFile(MCP_README));
    expect(names.length).toBeGreaterThanOrEqual(10);
    for (const name of names) {
      expect(findMcpTool(name), name).toBeDefined();
    }
  });
});

/**
 * Reads a tool description from the live catalog.
 *
 * @param name Tool identifier.
 * @returns Description text.
 */
function toolDescription(name: string): string {
  const definition = findMcpTool(name);
  expect(definition, name).toBeDefined();
  return definition?.description ?? '';
}

describe('grey box authoring guidance', () => {
  it('states a domain-neutral test for what deserves a volume', () => {
    const description = toolDescription('create_grey_box').toLowerCase();
    expect(description).toContain('authoring granularity');
    expect(description).toContain('a location and a size');
  });

  it('illustrates granularity with examples beyond level geometry', () => {
    const description = toolDescription('create_grey_box').toLowerCase();
    const architectural = ['bridge', 'staircase', 'ravine'];
    const furnishing = ['kitchen island', 'filing cabinet', 'crate', 'refrigerator'];
    expect(architectural.some((example) => description.includes(example))).toBe(true);
    expect(furnishing.some((example) => description.includes(example))).toBe(true);
  });

  it('warns that a layout of only roots is under-boxed', () => {
    expect(toolDescription('create_grey_box').toLowerCase()).toContain('under-boxed');
    expect(toolDescription('get_grey_box_graph').toLowerCase()).toContain('flat list of rooms');
  });

  it('warns that an overhanging child silently detaches', () => {
    for (const name of ['create_grey_box', 'set_grey_box_transform']) {
      expect(toolDescription(name), name).toContain('becomes a root instead of a child');
    }
  });

  it('stops connections being used in place of walkable geometry', () => {
    const description = toolDescription('connect_grey_boxes').toLowerCase();
    expect(description).toContain('not a substitute for geometry');
    expect(description).toContain('no moving-brush support');
  });

  it('frames the graph report as informational rather than a lint', () => {
    expect(toolDescription('get_grey_box_graph').toLowerCase()).toContain('informational, not a lint');
  });

  it('gives agents an authoring section in the MCP overview', () => {
    const readme = readRepoFile(MCP_README);
    expect(readme).toContain('### Authoring a layout yourself');
    expect(readme.toLowerCase()).toContain('box out contents, not just rooms');
  });

  it('treats a spanning feature as a missing enclosing area', () => {
    const description = toolDescription('create_grey_box').toLowerCase();
    expect(description).toContain('the enclosing area is missing');
    expect(description).toContain('design statement, not bookkeeping');
    expect(readRepoFile(GREY_BOX_PAGE).toLowerCase()).toContain('enclosing area is missing');
  });

  it('explains why derived containment beats an authored parent', () => {
    const page = readRepoFile(GREY_BOX_PAGE).toLowerCase().replace(/\s+/g, ' ');
    expect(page).toContain('containment is derived from the volumes');
    expect(page).toContain('cannot answer that');
  });
});
