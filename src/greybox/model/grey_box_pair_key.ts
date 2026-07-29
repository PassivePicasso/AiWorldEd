/** Separator between the two grey box ids inside a canonical pair key. */
const PAIR_KEY_SEPARATOR = '|';

/**
 * Builds the canonical, order-independent key identifying a pair of grey boxes.
 * Derived connectivity keys its edges this way so suppression entries and MCP
 * output stay stable regardless of which box is inspected first.
 *
 * @param firstId Grey box id on one side of the pair.
 * @param secondId Grey box id on the other side of the pair.
 * @returns Sorted pair key.
 */
export function greyBoxPairKey(firstId: string, secondId: string): string {
  assertUsablePairId(firstId);
  assertUsablePairId(secondId);
  if (firstId === secondId) {
    throw new Error(`Grey box pair key needs two distinct ids, both were "${firstId}"`);
  }
  const ordered = [firstId, secondId].sort();
  return `${ordered[0]}${PAIR_KEY_SEPARATOR}${ordered[1]}`;
}

/**
 * Splits a canonical pair key back into its two grey box ids.
 *
 * @param pairKey Key produced by greyBoxPairKey.
 * @returns The two ids in sorted order.
 */
export function splitGreyBoxPairKey(pairKey: string): [string, string] {
  const parts = pairKey.split(PAIR_KEY_SEPARATOR);
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error(`Malformed grey box pair key "${pairKey}"`);
  }
  return [parts[0], parts[1]];
}

/**
 * Rejects ids that cannot form a meaningful pair key.
 *
 * @param id Grey box id to check.
 */
function assertUsablePairId(id: string): void {
  if (typeof id !== 'string' || id.length === 0) {
    throw new Error('Grey box pair key requires non-empty grey box ids');
  }
  if (id.includes(PAIR_KEY_SEPARATOR)) {
    throw new Error(`Grey box id "${id}" must not contain "${PAIR_KEY_SEPARATOR}"`);
  }
}
