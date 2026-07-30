import type { McpVec3 } from '../shared/mcp_protocol_types.js';

/** Arguments for create_grey_box. */
export interface CreateGreyBoxArgs {
  name?: string;
  description?: string;
  center?: McpVec3;
  size?: McpVec3;
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
