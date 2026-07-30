import { describe, it, expect } from 'vitest';
import {
  GreyBoxParentClaims,
  buildGreyBoxContainmentTree,
  pickDerivedParent,
} from '../../src/greybox/connectivity/grey_box_containment_tree.js';

describe('buildGreyBoxContainmentTree', () => {
  it('treats a volume with no parent as a root', () => {
    const tree = buildGreyBoxContainmentTree([claim('hall')]);
    expect(tree.rootIds).toEqual(['hall']);
    expect(tree.nodes.get('hall')!.depth).toBe(0);
  });

  it('nests a child under its derived parent', () => {
    const tree = buildGreyBoxContainmentTree([claim('hall'), claim('ledge', null, 'hall')]);
    expect(tree.rootIds).toEqual(['hall']);
    expect(tree.nodes.get('ledge')!.parentId).toBe('hall');
    expect(tree.nodes.get('hall')!.childIds).toEqual(['ledge']);
    expect(tree.nodes.get('ledge')!.depth).toBe(1);
  });

  it('records depth through two levels', () => {
    const tree = buildGreyBoxContainmentTree([
      claim('hall'),
      claim('mezzanine', null, 'hall'),
      claim('crate', null, 'mezzanine'),
    ]);
    expect(tree.nodes.get('crate')!.depth).toBe(2);
  });

  it('prefers an authored parent over the derived one', () => {
    const tree = buildGreyBoxContainmentTree([claim('hall'), claim('ravine'), claim('bridge', 'ravine', 'hall')]);
    const bridge = tree.nodes.get('bridge')!;
    expect(bridge.parentId).toBe('ravine');
    expect(bridge.authoredParent).toBe(true);
  });

  it('accepts an authored parent where geometry found none', () => {
    const tree = buildGreyBoxContainmentTree([claim('ravine'), claim('bridge', 'ravine', null)]);
    expect(tree.nodes.get('bridge')!.parentId).toBe('ravine');
    expect(tree.rootIds).toEqual(['ravine']);
  });

  it('marks a derived parent as not authored', () => {
    const tree = buildGreyBoxContainmentTree([claim('hall'), claim('ledge', null, 'hall')]);
    expect(tree.nodes.get('ledge')!.authoredParent).toBe(false);
  });

  it('ignores a parent claim naming a volume outside the graph', () => {
    const tree = buildGreyBoxContainmentTree([claim('ledge', 'missing', 'alsoMissing')]);
    expect(tree.nodes.get('ledge')!.parentId).toBeNull();
    expect(tree.rootIds).toEqual(['ledge']);
  });

  it('ignores a volume claiming itself as parent', () => {
    const tree = buildGreyBoxContainmentTree([claim('ledge', 'ledge', 'ledge')]);
    expect(tree.nodes.get('ledge')!.parentId).toBeNull();
  });

  it('breaks a two-volume cycle and reports it', () => {
    const tree = buildGreyBoxContainmentTree([claim('a', 'b'), claim('b', 'a')]);
    expect(tree.brokenCycles.length).toBe(1);
    expect(tree.rootIds.length).toBeGreaterThan(0);
    expect(countLinkedNodes(tree.nodes)).toBe(1);
  });

  it('breaks a longer cycle and reports it', () => {
    const tree = buildGreyBoxContainmentTree([claim('a', 'b'), claim('b', 'c'), claim('c', 'a')]);
    expect(tree.brokenCycles.length).toBe(1);
    expect(tree.nodes.size).toBe(3);
  });

  it('keeps root order stable with the input order', () => {
    const tree = buildGreyBoxContainmentTree([claim('second'), claim('first'), claim('child', null, 'first')]);
    expect(tree.rootIds).toEqual(['second', 'first']);
  });

  it('keeps child order stable with the input order', () => {
    const tree = buildGreyBoxContainmentTree([
      claim('hall'),
      claim('ledgeB', null, 'hall'),
      claim('ledgeA', null, 'hall'),
    ]);
    expect(tree.nodes.get('hall')!.childIds).toEqual(['ledgeB', 'ledgeA']);
  });
});

describe('pickDerivedParent', () => {
  it('returns null when nothing contains the volume', () => {
    expect(pickDerivedParent('ledge', [], new Map())).toBeNull();
  });

  it('picks the tightest containing volume', () => {
    const containments = [
      { parentId: 'hall', childId: 'crate', ratio: 1 },
      { parentId: 'mezzanine', childId: 'crate', ratio: 1 },
    ];
    const sizes = new Map([
      ['hall', 1000],
      ['mezzanine', 100],
    ]);
    expect(pickDerivedParent('crate', containments, sizes)).toBe('mezzanine');
  });

  it('ignores containments for other volumes', () => {
    const containments = [{ parentId: 'hall', childId: 'other', ratio: 1 }];
    expect(pickDerivedParent('crate', containments, new Map([['hall', 10]]))).toBeNull();
  });

  it('breaks a size tie by id so the answer is stable', () => {
    const containments = [
      { parentId: 'zulu', childId: 'crate', ratio: 1 },
      { parentId: 'alpha', childId: 'crate', ratio: 1 },
    ];
    const sizes = new Map([
      ['zulu', 100],
      ['alpha', 100],
    ]);
    expect(pickDerivedParent('crate', containments, sizes)).toBe('alpha');
  });
});

/**
 * Builds a parent claim for the tree builder.
 *
 * @param id Volume id.
 * @param authoredParentId Authored parent, or null.
 * @param derivedParentId Derived parent, or null.
 * @returns Parent claim record.
 */
function claim(
  id: string,
  authoredParentId: string | null = null,
  derivedParentId: string | null = null,
): GreyBoxParentClaims {
  return { id, authoredParentId, derivedParentId };
}

/**
 * Counts nodes that ended up with a parent link.
 *
 * @param nodes Tree nodes.
 * @returns Number of linked nodes.
 */
function countLinkedNodes(nodes: Map<string, { parentId: string | null }>): number {
  let linked = 0;
  for (const node of nodes.values()) {
    if (node.parentId !== null) linked += 1;
  }
  return linked;
}
