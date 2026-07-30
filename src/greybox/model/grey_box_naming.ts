import * as THREE from 'three';
import { GreyBoxRegistry } from './grey_box_registry.js';

/** Name stem shared by auto-named grey box volumes. */
export const GREY_BOX_NAME_PREFIX = 'GreyBox';

/** Name stem shared by auto-named grey box groups. */
export const GREY_BOX_GROUP_NAME_PREFIX = 'GreyBoxGroup';

/** Digits in an auto-allocated grey box name suffix. */
const NAME_DIGITS = 3;

/**
 * Allocates the next unused auto grey box name for a scene. Derived from the
 * names already present rather than from a session counter, so names stay
 * unique after loading a scene that already contains grey boxes.
 *
 * @param root Scene or world root to inspect.
 * @returns Next auto name, such as GreyBox004.
 */
export function allocateGreyBoxName(root: THREE.Object3D): string {
  return allocateAutoName(root, GREY_BOX_NAME_PREFIX);
}

/**
 * Allocates the next unused auto grey box group name for a scene.
 *
 * @param root Scene or world root to inspect.
 * @returns Next auto name, such as GreyBoxGroup002.
 */
export function allocateGreyBoxGroupName(root: THREE.Object3D): string {
  return allocateAutoName(root, GREY_BOX_GROUP_NAME_PREFIX);
}

/**
 * Formats a grey box auto name from its number.
 *
 * @param value Positive name number.
 * @returns Zero-padded auto name.
 */
export function formatGreyBoxName(value: number): string {
  return formatAutoName(GREY_BOX_NAME_PREFIX, value);
}

/**
 * Formats a grey box group auto name from its number.
 *
 * @param value Positive name number.
 * @returns Zero-padded auto name.
 */
export function formatGreyBoxGroupName(value: number): string {
  return formatAutoName(GREY_BOX_GROUP_NAME_PREFIX, value);
}

/**
 * Allocates the next auto name for one prefix, reading the names already in the
 * scene. Volume and group names never collide because "GreyBoxGroup001" does
 * not parse as a volume number.
 *
 * @param root Scene or world root to inspect.
 * @param prefix Name stem to allocate under.
 * @returns Next auto name for that prefix.
 */
function allocateAutoName(root: THREE.Object3D, prefix: string): string {
  return formatAutoName(prefix, findHighestAutoNameNumber(root, prefix) + 1);
}

/**
 * Formats an auto name from a prefix and number.
 *
 * @param prefix Name stem.
 * @param value Positive name number.
 * @returns Zero-padded auto name.
 */
function formatAutoName(prefix: string, value: number): string {
  return `${prefix}${String(value).padStart(NAME_DIGITS, '0')}`;
}

/**
 * Finds the highest auto name number among grey boxes under a root.
 *
 * @param root Scene or world root to inspect.
 * @param prefix Name stem to match.
 * @returns Highest number found, or zero when none match.
 */
function findHighestAutoNameNumber(root: THREE.Object3D, prefix: string): number {
  const pattern = new RegExp(`^${prefix}(\\d+)$`);
  let highest = 0;
  for (const object of GreyBoxRegistry.collectUnder(root)) {
    const parsed = parseAutoNameNumber(object.name, pattern);
    if (parsed > highest) highest = parsed;
  }
  return highest;
}

/**
 * Parses the number out of an auto grey box name.
 *
 * @param name Candidate object name.
 * @param pattern Prefix pattern capturing the number.
 * @returns Parsed number, or zero when the name is user-authored.
 */
function parseAutoNameNumber(name: string, pattern: RegExp): number {
  const match = pattern.exec(name);
  if (!match) return 0;
  return Number.parseInt(match[1]!, 10);
}
