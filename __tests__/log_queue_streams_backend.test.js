'use strict';

const {
  RedisStreamBackend,
  KafkaLogBackend,
} = require('../vaultfire/storage/log_queue_adapter');

describe('Log queue backends', () => {
  it('writes records to redis stream using xAdd', async () => {
    const xAdd = jest.fn().mockResolvedValue('ok');
    const client = { xAdd };
    const backend = new RedisStreamBackend({ client, streamKey: 'vf:test', maxLength: 10 });
    const acknowledgement = await backend.append([
      { payload: 'a', metadata: { foo: 'bar' }, createdAt: 1 },
      { payload: 'b', metadata: { foo: 'baz' }, createdAt: 2 },
    ], { backendId: 'queue' });

    expect(acknowledgement.appended).toBe(2);
    expect(xAdd).toHaveBeenCalledTimes(2);
  });

  it('writes records to redis stream using sendCommand fallback', async () => {
    const sendCommand = jest.fn().mockResolvedValue('OK');
    const client = { sendCommand };
    const backend = new RedisStreamBackend({ client, streamKey: 'vf:test2' });
    await backend.append([{ payload: 'x', metadata: {}, createdAt: 3 }], {});
    expect(sendCommand).toHaveBeenCalledWith(expect.arrayContaining(['XADD', 'vf:test2']));
  });

  it('publishes records to kafka topic', async () => {
    const send = jest.fn().mockResolvedValue({});
    const producer = { send };
    const backend = new KafkaLogBackend({ producer, topic: 'vf.telemetry' });
    await backend.append([
      { payload: { value: 1 }, metadata: { partnerId: 'alpha' }, createdAt: 1 },
      { payload: { value: 2 }, metadata: { partnerId: 'beta' }, createdAt: 2 },
    ], { backendId: 'queue' });

    expect(send).toHaveBeenCalledWith({
      topic: 'vf.telemetry',
      messages: expect.arrayContaining([
        expect.objectContaining({ value: expect.any(Buffer) }),
      ]),
    });
  });
});
