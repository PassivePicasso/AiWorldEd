import * as THREE from 'three';
import { GreyBoxRegistry } from './grey_box_registry.js';

/** Name stem shared by auto-named grey box volumes. */
export const GREY_BOX_NAME_PREFIX = 'GreyBox';

/** Digits in an auto-allocated grey box name suffix. */
const NAME_DIGITS = 3;

/** Matches an auto-allocated grey box name and captures its number. */
const AUTO_NAME_PATTERN = new RegExp(`^${GREY_BOX_NAME_PREFIX}(\\d+)$`);

/**
 * Allocates the next unused auto grey box name for a scene. Derived from the
 * names already present rather than from a session counter, so names stay
 * unique after loading a scene that already contains grey boxes.
 *
 * @param root Scene or world root to inspect.
 * @returns Next auto name, such as GreyBox004.
 */
export function allocateGreyBoxName(root: THREE.Object3D): string {
  const highest = findHighestAutoNameNumber(root);
  return formatGreyBoxName(highest + 1);
}

/**
 * Formats a grey box auto name from its number.
 *
 * @param value Positive name number.
 * @returns Zero-padded auto name.
 */
export function formatGreyBoxName(value: number): string {
  return `${GREY_BOX_NAME_PREFIX}${String(value).padStart(NAME_DIGITS, '0')}`;
}

/**
 * Finds the highest auto name number among grey boxes under a root.
 *
 * @param root Scene or world root to inspect.
 * @returns Highest number found, or zero when none match.
 */
function findHighestAutoNameNumber(root: THREE.Object3D): number {
  let highest = 0;
  for (const object of GreyBoxRegistry.collectUnder(root)) {
    const parsed = parseAutoNameNumber(object.name);
    if (parsed > highest) highest = parsed;
  }
  return highest;
}

/**
 * Parses the number out of an auto grey box name.
 *
 * @param name Candidate object name.
 * @returns Parsed number, or zero when the name is user-authored.
 */
function parseAutoNameNumber(name: string): number {
  const match = AUTO_NAME_PATTERN.exec(name);
  if (!match) return 0;
  return Number.parseInt(match[1]!, 10);
}
