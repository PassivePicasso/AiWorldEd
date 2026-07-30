/**
 * Gameplay function of a grey box volume. A documented vocabulary rather than a
 * closed enum: the editor colours and reasons about the known roles, and any
 * other string is accepted so a missing category never blocks blocking out.
 */
export type GreyBoxRole = string;

/**
 * Roles the editor understands, drawn from blockout practice. Order is the
 * order they are offered in the inspector.
 */
export const KNOWN_GREY_BOX_ROLES = [
  'room',
  'corridor',
  'bridge',
  'ledge',
  'platform',
  'pit',
  'ravine',
  'cover',
  'hazard',
  'landmark',
  'objective',
  'spawn',
  'transition',
] as const;

/**
 * Role a volume takes when none was stated, and the migration value for scenes
 * written before roles existed. A plain enclosed space is the safe reading of
 * an undescribed volume.
 */
export const DEFAULT_GREY_BOX_ROLE: GreyBoxRole = 'room';

/**
 * Role a grey box group takes when none was stated. A group organizes volumes
 * rather than standing for a space, so it claims no gameplay category.
 */
export const DEFAULT_GREY_BOX_GROUP_ROLE: GreyBoxRole = 'group';

/**
 * Returns whether a role is one the editor has colours and vocabulary for.
 *
 * @param role Role to test.
 * @returns True for a documented role.
 */
export function isKnownGreyBoxRole(role: string): boolean {
  return (KNOWN_GREY_BOX_ROLES as readonly string[]).includes(role);
}

/**
 * Normalizes a role for storage: trimmed, lowercased, and falling back to the
 * default when empty. Unknown-but-non-empty roles pass through untouched.
 *
 * @param role Raw role text.
 * @returns Role safe to store.
 */
export function normalizeGreyBoxRole(role: string): GreyBoxRole {
  const trimmed = role.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : DEFAULT_GREY_BOX_ROLE;
}
