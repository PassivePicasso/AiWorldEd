import { describe, it, expect } from 'vitest';
import { GreyBoxCodec } from '../../src/greybox/io/grey_box_codec.js';
import { createGreyBoxData } from '../../src/greybox/model/grey_box_data.js';
import { createExplicitConnection } from '../../src/greybox/model/grey_box_connection.js';
import { allocateGreyBoxId } from '../../src/greybox/model/grey_box_id.js';
import { greyBoxPairKey } from '../../src/greybox/model/grey_box_pair_key.js';

const OBJECT_LABEL = '"TestVolume" (test-uuid)';

describe('GreyBoxCodec', () => {
  it('round-trips id and description', () => {
    const data = createGreyBoxData(allocateGreyBoxId(), 'wide entry hall, daylight from above');
    const decoded = GreyBoxCodec.decode(GreyBoxCodec.encode(data), OBJECT_LABEL);
    expect(decoded.id).toBe(data.id);
    expect(decoded.description).toBe(data.description);
  });

  it('round-trips an empty description', () => {
    const data = createGreyBoxData(allocateGreyBoxId(), '');
    const decoded = GreyBoxCodec.decode(GreyBoxCodec.encode(data), OBJECT_LABEL);
    expect(decoded.description).toBe('');
  });

  it('round-trips explicit connections including direction and note', () => {
    const data = createGreyBoxData(allocateGreyBoxId(), 'upper landing');
    const targetId = allocateGreyBoxId();
    data.explicitConnections.push(
      createExplicitConnection('link-1', targetId, 'elevator', 'needs keycard', 'bidirectional'),
    );
    data.explicitConnections.push(createExplicitConnection('link-2', allocateGreyBoxId(), 'drop', '', 'forward'));
    const decoded = GreyBoxCodec.decode(GreyBoxCodec.encode(data), OBJECT_LABEL);
    expect(decoded.explicitConnections.length).toBe(2);
    expect(decoded.explicitConnections[0]!.targetGreyBoxId).toBe(targetId);
    expect(decoded.explicitConnections[0]!.kind).toBe('elevator');
    expect(decoded.explicitConnections[0]!.note).toBe('needs keycard');
    expect(decoded.explicitConnections[0]!.direction).toBe('bidirectional');
    expect(decoded.explicitConnections[1]!.direction).toBe('forward');
  });

  it('round-trips suppressed derived pair keys', () => {
    const data = createGreyBoxData(allocateGreyBoxId(), '');
    const key = greyBoxPairKey(allocateGreyBoxId(), allocateGreyBoxId());
    data.suppressedDerivedConnections.push(key);
    const decoded = GreyBoxCodec.decode(GreyBoxCodec.encode(data), OBJECT_LABEL);
    expect(decoded.suppressedDerivedConnections).toEqual([key]);
  });

  it('produces payloads independent of the source data', () => {
    const data = createGreyBoxData(allocateGreyBoxId(), 'source');
    data.suppressedDerivedConnections.push(greyBoxPairKey(allocateGreyBoxId(), allocateGreyBoxId()));
    const payload = GreyBoxCodec.encode(data);
    payload.suppressedDerivedConnections.push('injected|key');
    expect(data.suppressedDerivedConnections.length).toBe(1);
  });

  it('rejects a non-object payload', () => {
    expect(() => GreyBoxCodec.decode('not-a-payload', OBJECT_LABEL)).toThrow(/malformed grey box payload/);
    expect(() => GreyBoxCodec.decode(null, OBJECT_LABEL)).toThrow(/malformed grey box payload/);
    expect(() => GreyBoxCodec.decode([], OBJECT_LABEL)).toThrow(/malformed grey box payload/);
  });

  it('names the offending object in failure messages', () => {
    expect(() => GreyBoxCodec.decode(undefined, OBJECT_LABEL)).toThrow(/TestVolume/);
  });

  it('rejects a missing id', () => {
    const payload = validPayload();
    delete (payload as Record<string, unknown>)['id'];
    expect(() => GreyBoxCodec.decode(payload, OBJECT_LABEL)).toThrow(/missing a string id/);
  });

  it('rejects an empty id', () => {
    const payload = validPayload();
    payload.id = '';
    expect(() => GreyBoxCodec.decode(payload, OBJECT_LABEL)).toThrow(/empty id/);
  });

  it('rejects a missing description rather than defaulting it', () => {
    const payload = validPayload();
    delete (payload as Record<string, unknown>)['description'];
    expect(() => GreyBoxCodec.decode(payload, OBJECT_LABEL)).toThrow(/missing a string description/);
  });

  it('rejects a non-array connection list', () => {
    const payload = validPayload();
    (payload as Record<string, unknown>)['explicitConnections'] = 'nope';
    expect(() => GreyBoxCodec.decode(payload, OBJECT_LABEL)).toThrow(/non-array explicitConnections/);
  });

  it('rejects a connection with an unknown direction', () => {
    const payload = validPayload();
    payload.explicitConnections = [
      { id: 'link-1', targetGreyBoxId: allocateGreyBoxId(), kind: 'door', note: '', direction: 'sideways' },
    ];
    expect(() => GreyBoxCodec.decode(payload, OBJECT_LABEL)).toThrow(/unknown direction "sideways"/);
  });

  it('rejects a connection with no target', () => {
    const payload = validPayload();
    payload.explicitConnections = [{ id: 'link-1', targetGreyBoxId: '', kind: 'door', note: '', direction: 'forward' }];
    expect(() => GreyBoxCodec.decode(payload, OBJECT_LABEL)).toThrow(/empty connection targetGreyBoxId/);
  });

  it('rejects a non-array suppression list', () => {
    const payload = validPayload();
    (payload as Record<string, unknown>)['suppressedDerivedConnections'] = {};
    expect(() => GreyBoxCodec.decode(payload, OBJECT_LABEL)).toThrow(/non-array suppressedDerivedConnections/);
  });

  it('rejects an empty suppression key', () => {
    const payload = validPayload();
    payload.suppressedDerivedConnections = [''];
    expect(() => GreyBoxCodec.decode(payload, OBJECT_LABEL)).toThrow(/empty suppressed pair key/);
  });
});

/**
 * Builds a well-formed serialized payload that individual cases then corrupt.
 *
 * @returns Mutable valid payload.
 */
function validPayload(): {
  id: string;
  description: string;
  explicitConnections: Array<Record<string, unknown>>;
  suppressedDerivedConnections: string[];
} {
  return {
    id: allocateGreyBoxId(),
    description: 'staging area',
    explicitConnections: [],
    suppressedDerivedConnections: [],
  };
}
