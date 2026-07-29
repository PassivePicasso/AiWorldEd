import { GreyBoxData } from '../model/grey_box_data.js';
import {
  GreyBoxExplicitConnection,
  createExplicitConnection,
  isGreyBoxConnectionDirection,
} from '../model/grey_box_connection.js';

/** Serialized form of one authored grey box connection. */
export interface SerializedGreyBoxConnection {
  id: string;
  targetGreyBoxId: string;
  kind: string;
  note: string;
  direction: string;
}

/**
 * Serialized grey box payload. The volume itself rides on the object entry's
 * geometry and transform; this carries only the layout meaning.
 */
export interface SerializedGreyBox {
  id: string;
  description: string;
  explicitConnections: SerializedGreyBoxConnection[];
  suppressedDerivedConnections: string[];
}

/**
 * Encodes and decodes grey box payloads for scene persistence. Decoding rejects
 * malformed payloads loudly: a grey box with unreadable data must not load as
 * an empty one, because that silently discards the user's layout intent.
 */
export class GreyBoxCodec {
  /**
   * Serializes a grey box payload.
   *
   * @param data Live grey box data.
   * @returns JSON-safe payload.
   */
  static encode(data: GreyBoxData): SerializedGreyBox {
    return {
      id: data.id,
      description: data.description,
      explicitConnections: data.explicitConnections.map((connection) => this.encodeConnection(connection)),
      suppressedDerivedConnections: data.suppressedDerivedConnections.slice(),
    };
  }

  /**
   * Rebuilds a grey box payload from a serialized entry.
   *
   * @param payload Serialized payload of unknown shape.
   * @param objectLabel Label naming the offending object in failure messages.
   * @returns Validated grey box data.
   */
  static decode(payload: unknown, objectLabel: string): GreyBoxData {
    const record = this.requireRecord(payload, objectLabel);
    return {
      id: this.requireNonEmptyString(record['id'], 'id', objectLabel),
      description: this.requireString(record['description'], 'description', objectLabel),
      explicitConnections: this.decodeConnections(record['explicitConnections'], objectLabel),
      suppressedDerivedConnections: this.decodeSuppressions(record['suppressedDerivedConnections'], objectLabel),
    };
  }

  /**
   * Serializes one authored connection.
   *
   * @param connection Live connection record.
   * @returns JSON-safe connection.
   */
  private static encodeConnection(connection: GreyBoxExplicitConnection): SerializedGreyBoxConnection {
    return {
      id: connection.id,
      targetGreyBoxId: connection.targetGreyBoxId,
      kind: connection.kind,
      note: connection.note,
      direction: connection.direction,
    };
  }

  /**
   * Decodes the authored connection list.
   *
   * @param value Candidate connection array.
   * @param objectLabel Label naming the offending object.
   * @returns Validated connections.
   */
  private static decodeConnections(value: unknown, objectLabel: string): GreyBoxExplicitConnection[] {
    if (!Array.isArray(value)) {
      throw new Error(`Grey box ${objectLabel} has a non-array explicitConnections field`);
    }
    return value.map((entry) => this.decodeConnection(entry, objectLabel));
  }

  /**
   * Decodes one authored connection.
   *
   * @param value Candidate connection record.
   * @param objectLabel Label naming the offending object.
   * @returns Validated connection.
   */
  private static decodeConnection(value: unknown, objectLabel: string): GreyBoxExplicitConnection {
    const record = this.requireRecord(value, objectLabel);
    const direction = record['direction'];
    if (!isGreyBoxConnectionDirection(direction)) {
      throw new Error(`Grey box ${objectLabel} has a connection with unknown direction "${String(direction)}"`);
    }
    return createExplicitConnection(
      this.requireNonEmptyString(record['id'], 'connection id', objectLabel),
      this.requireNonEmptyString(record['targetGreyBoxId'], 'connection targetGreyBoxId', objectLabel),
      this.requireString(record['kind'], 'connection kind', objectLabel),
      this.requireString(record['note'], 'connection note', objectLabel),
      direction,
    );
  }

  /**
   * Decodes the muted-adjacency key list.
   *
   * @param value Candidate key array.
   * @param objectLabel Label naming the offending object.
   * @returns Validated pair keys.
   */
  private static decodeSuppressions(value: unknown, objectLabel: string): string[] {
    if (!Array.isArray(value)) {
      throw new Error(`Grey box ${objectLabel} has a non-array suppressedDerivedConnections field`);
    }
    return value.map((entry) => this.requireNonEmptyString(entry, 'suppressed pair key', objectLabel));
  }

  /**
   * Requires a plain object payload.
   *
   * @param value Candidate value.
   * @param objectLabel Label naming the offending object.
   * @returns The value as a record.
   */
  private static requireRecord(value: unknown, objectLabel: string): Record<string, unknown> {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new Error(`Grey box ${objectLabel} has a malformed grey box payload`);
    }
    return value as Record<string, unknown>;
  }

  /**
   * Requires a string field, allowing empty strings.
   *
   * @param value Candidate value.
   * @param fieldName Field name for the failure message.
   * @param objectLabel Label naming the offending object.
   * @returns The validated string.
   */
  private static requireString(value: unknown, fieldName: string, objectLabel: string): string {
    if (typeof value !== 'string') {
      throw new Error(`Grey box ${objectLabel} is missing a string ${fieldName}`);
    }
    return value;
  }

  /**
   * Requires a non-empty string field.
   *
   * @param value Candidate value.
   * @param fieldName Field name for the failure message.
   * @param objectLabel Label naming the offending object.
   * @returns The validated string.
   */
  private static requireNonEmptyString(value: unknown, fieldName: string, objectLabel: string): string {
    const text = this.requireString(value, fieldName, objectLabel);
    if (text.length === 0) {
      throw new Error(`Grey box ${objectLabel} has an empty ${fieldName}`);
    }
    return text;
  }
}
