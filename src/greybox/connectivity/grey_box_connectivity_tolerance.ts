/**
 * Gap between two volumes still read as a contact, in world units. Looser than
 * the CSG fat-plane epsilon on purpose: a designer who leaves a hair of space
 * between two blocked-out rooms still means they connect, and layout volumes
 * are placed by eye and grid snap rather than by exact plane arithmetic.
 */
export const GREY_BOX_CONTACT_TOLERANCE = 0.01;

/**
 * Smallest shared face area reported as a connection, in square world units.
 * Edge and corner contacts clip to a degenerate polygon with effectively zero
 * area, so this only has to be above numerical noise, not above a doorway
 * size.
 */
export const GREY_BOX_MIN_CONTACT_AREA = 1e-4;

/**
 * Depth of mutual penetration beyond which two volumes are reported as
 * interpenetrating rather than merely touching. Sits above the contact
 * tolerance so a flush pair is never misread as an overlap.
 */
export const GREY_BOX_MIN_OVERLAP_DEPTH = 0.02;
