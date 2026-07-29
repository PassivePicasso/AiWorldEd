import { describe, it, expect } from 'vitest';
import { greyBoxPairKey, splitGreyBoxPairKey } from '../../src/greybox/model/grey_box_pair_key.js';
import { allocateGreyBoxId } from '../../src/greybox/model/grey_box_id.js';

describe('greyBoxPairKey', () => {
  it('produces the same key regardless of argument order', () => {
    const first = allocateGreyBoxId();
    const second = allocateGreyBoxId();
    expect(greyBoxPairKey(first, second)).toBe(greyBoxPairKey(second, first));
  });

  it('produces different keys for different pairs', () => {
    const first = allocateGreyBoxId();
    const second = allocateGreyBoxId();
    const third = allocateGreyBoxId();
    expect(greyBoxPairKey(first, second)).not.toBe(greyBoxPairKey(first, third));
  });

  it('is stable across repeated computation', () => {
    const first = allocateGreyBoxId();
    const second = allocateGreyBoxId();
    const initial = greyBoxPairKey(first, second);
    expect(greyBoxPairKey(first, second)).toBe(initial);
    expect(greyBoxPairKey(first, second)).toBe(initial);
  });

  it('round-trips back into its two ids in sorted order', () => {
    const first = allocateGreyBoxId();
    const second = allocateGreyBoxId();
    const [low, high] = splitGreyBoxPairKey(greyBoxPairKey(first, second));
    const expected = [first, second].sort();
    expect(low).toBe(expected[0]);
    expect(high).toBe(expected[1]);
  });

  it('rejects an empty id', () => {
    expect(() => greyBoxPairKey('', allocateGreyBoxId())).toThrow(/non-empty/);
  });

  it('rejects pairing an id with itself', () => {
    const id = allocateGreyBoxId();
    expect(() => greyBoxPairKey(id, id)).toThrow(/distinct/);
  });

  it('rejects an id containing the key separator', () => {
    expect(() => greyBoxPairKey('left|right', allocateGreyBoxId())).toThrow(/must not contain/);
  });

  it('rejects a malformed key on split', () => {
    expect(() => splitGreyBoxPairKey('single-id')).toThrow(/Malformed/);
  });
});
