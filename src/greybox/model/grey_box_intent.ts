/**
 * How firm a volume's dimensions are. `exact` means an agent must build to
 * these measurements; `approximate` means the shape is a gesture it may refine.
 * One flag covers size and placement together: in practice a volume is either
 * measured or it is not, and splitting the two invites a state where the size
 * is binding but the position is not, which nothing needs.
 */
export type GreyBoxSizeIntent = 'exact' | 'approximate';

/**
 * Stance a newly created volume takes. A box you just dragged out is a gesture
 * until you say otherwise, so new volumes are approximate by choice — this is
 * an authoring stance, not a fallback for missing data.
 */
export const DEFAULT_GREY_BOX_SIZE_INTENT: GreyBoxSizeIntent = 'approximate';

/**
 * Surface and mood hints for a volume. These describe intended feel, not
 * texture assignments: "wet stone, puddles" rather than a texture id. Every
 * field is legally empty.
 */
export interface GreyBoxSurfaceIntent {
  /** Intended floor treatment. */
  floor: string;

  /** Intended wall treatment. */
  wall: string;

  /** Intended ceiling treatment. */
  ceiling: string;

  /** Overall mood of the space: light, atmosphere, how it should feel. */
  mood: string;
}

/**
 * Builds empty surface intent, the state of a volume nobody has described yet.
 *
 * @returns Surface intent with every field empty.
 */
export function createEmptySurfaceIntent(): GreyBoxSurfaceIntent {
  return { floor: '', wall: '', ceiling: '', mood: '' };
}

/**
 * Copies surface intent so stored state cannot be mutated through a handle.
 *
 * @param surface Surface intent to copy.
 * @returns Independent copy.
 */
export function cloneSurfaceIntent(surface: GreyBoxSurfaceIntent): GreyBoxSurfaceIntent {
  return { floor: surface.floor, wall: surface.wall, ceiling: surface.ceiling, mood: surface.mood };
}

/**
 * Returns whether any surface field has been written.
 *
 * @param surface Surface intent to inspect.
 * @returns True when at least one field is non-empty.
 */
export function hasSurfaceIntent(surface: GreyBoxSurfaceIntent): boolean {
  return surface.floor.length > 0 || surface.wall.length > 0 || surface.ceiling.length > 0 || surface.mood.length > 0;
}

/**
 * Returns whether a value is a legal size intent.
 *
 * @param value Candidate value.
 * @returns True for the two supported values.
 */
export function isGreyBoxSizeIntent(value: unknown): value is GreyBoxSizeIntent {
  return value === 'exact' || value === 'approximate';
}

/** Names of the surface intent fields, in the order the inspector shows them. */
export const GREY_BOX_SURFACE_FIELDS = ['floor', 'wall', 'ceiling', 'mood'] as const;

/** One surface intent field name. */
export type GreyBoxSurfaceField = (typeof GREY_BOX_SURFACE_FIELDS)[number];
