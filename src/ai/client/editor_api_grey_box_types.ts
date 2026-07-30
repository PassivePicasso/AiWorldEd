import type { McpVec3 } from '../shared/mcp_protocol_types.js';

/** Arguments for create_grey_box. */
export interface CreateGreyBoxArgs {
  name?: string;
  description?: string;
  role?: string;
  center?: McpVec3;
  size?: McpVec3;
  /** Group or volume to create this one under; omitted means the world root. */
  parentGreyBoxId?: string;
}

/** Arguments for create_grey_box_group. */
export interface CreateGreyBoxGroupArgs {
  name?: string;
  description?: string;
  /** Group to nest the new group under; omitted means the world root. */
  parentGreyBoxId?: string;
  /** Grey boxes moved into the new group as part of the same undo step. */
  greyBoxIds?: string[];
}

/** Arguments for reparent_grey_boxes. */
export interface ReparentGreyBoxesArgs {
  greyBoxIds: string[];
  /** Destination grey box; omitted moves them back out to the world root. */
  parentGreyBoxId?: string;
}

/** Arguments for set_grey_box_transform. */
export interface SetGreyBoxTransformArgs {
  greyBoxId: string;
  center?: McpVec3;
  size?: McpVec3;
}

/** Arguments for connect_grey_boxes. */
export interface ConnectGreyBoxesArgs {
  greyBoxId: string;
  targetGreyBoxId: string;
  kind?: string;
  note?: string;
  direction?: 'bidirectional' | 'forward';
}

/** Arguments for disconnect_grey_boxes. */
export interface DisconnectGreyBoxesArgs {
  greyBoxId: string;
  connectionId?: string;
  targetGreyBoxId?: string;
}

/** Arguments for set_grey_box_intent. */
export interface SetGreyBoxIntentArgs {
  greyBoxId: string;
  sizeIntent?: 'exact' | 'approximate';
  surface?: { floor?: string; wall?: string; ceiling?: string; mood?: string };
}
