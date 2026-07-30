import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { findMcpTool } from '../../src/ai/server/mcp_tool_registry.js';

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
  const matches = text.match(/`(?:list|get|create|rename|set|delete|connect|disconnect)_grey_box[a-z_]*`/g) ?? [];
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

  it('shows a worked example with a graph and description guidance', () => {
    const page = readRepoFile(GREY_BOX_PAGE);
    expect(page).toContain('## A worked example');
    expect(page).toContain('derived');
    expect(page).toContain('authored');
    expect(page.toLowerCase()).toContain('weak description');
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

  it('references only grey box tool names that exist in the catalog', () => {
    const names = extractGreyBoxToolNames(readRepoFile(MCP_README));
    expect(names.length).toBeGreaterThanOrEqual(10);
    for (const name of names) {
      expect(findMcpTool(name), name).toBeDefined();
    }
  });
});
