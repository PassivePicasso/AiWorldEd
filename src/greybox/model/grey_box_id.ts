/** Monotonic counter making allocated grey box ids readable and ordered. */
let greyBoxCounter = 0;

/** Prefix identifying grey box ids in MCP payloads and scene files. */
const GREY_BOX_ID_PREFIX = 'greybox';

/**
 * Allocates a stable grey box id. The random suffix keeps ids distinct across
 * separately authored scenes that are later merged or imported.
 *
 * @returns Fresh grey box id.
 */
export function allocateGreyBoxId(): string {
  greyBoxCounter += 1;
  const randomSuffix = Math.random().toString(36).slice(2, 8);
  return `${GREY_BOX_ID_PREFIX}-${greyBoxCounter}-${randomSuffix}`;
}

/** Monotonic counter for authored connection ids. */
let connectionCounter = 0;

/** Prefix identifying authored grey box connection ids. */
const GREY_BOX_CONNECTION_ID_PREFIX = 'greylink';

/**
 * Allocates an id for an authored connection, unique within its owning volume
 * and readable in MCP payloads.
 *
 * @returns Fresh connection id.
 */
export function allocateGreyBoxConnectionId(): string {
  connectionCounter += 1;
  const randomSuffix = Math.random().toString(36).slice(2, 8);
  return `${GREY_BOX_CONNECTION_ID_PREFIX}-${connectionCounter}-${randomSuffix}`;
}
