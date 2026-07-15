'use strict';

jest.mock('../../prisma/client', () => ({
  message: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    updateMany: jest.fn(),
  },
}));

const prisma = require('../../prisma/client');
const { markSendStarted } = require('../messages.controller');

function response() {
  return {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

function request() {
  return { params: { id: '12' }, device: { userId: 4, deviceId: 8 } };
}

describe('markSendStarted dispatch deadline', () => {
  beforeEach(() => jest.clearAllMocks());

  test('atomically records send start only while the one-minute lease is valid', async () => {
    const message = {
      id: 12,
      user_id: 4,
      device_id: 8,
      status: 'dispatched',
      dispatched_at: new Date(Date.now() - 1_000),
      send_started_at: null,
    };
    const started = { ...message, send_started_at: new Date() };
    prisma.message.findFirst.mockResolvedValue(message);
    prisma.message.updateMany.mockResolvedValue({ count: 1 });
    prisma.message.findUnique.mockResolvedValue(started);
    const res = response();

    await markSendStarted(request(), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toBe(started);
    expect(prisma.message.updateMany).toHaveBeenCalledWith({
      where: {
        id: 12,
        user_id: 4,
        device_id: 8,
        status: 'dispatched',
        dispatched_at: { gt: expect.any(Date) },
      },
      data: { send_started_at: expect.any(Date) },
    });
  });

  test('makes an overdue dispatched message terminally failed instead of starting it', async () => {
    prisma.message.findFirst.mockResolvedValue({
      id: 12,
      user_id: 4,
      device_id: 8,
      status: 'dispatched',
      dispatched_at: new Date(Date.now() - 60_001),
      send_started_at: null,
    });
    prisma.message.updateMany.mockResolvedValue({ count: 1 });
    const res = response();

    await markSendStarted(request(), res);

    expect(res.statusCode).toBe(409);
    expect(res.body).toEqual({ error: 'Message dispatch timed out' });
    expect(prisma.message.updateMany).toHaveBeenCalledWith({
      where: {
        id: 12,
        user_id: 4,
        device_id: 8,
        status: 'dispatched',
        OR: [
          { dispatched_at: null },
          { dispatched_at: { lte: expect.any(Date) } },
        ],
      },
      data: { status: 'failed', delivered_at: expect.any(Date) },
    });
    expect(prisma.message.findUnique).not.toHaveBeenCalled();
  });

  test('does not report success when a terminal transition wins the race', async () => {
    prisma.message.findFirst.mockResolvedValue({
      id: 12,
      user_id: 4,
      device_id: 8,
      status: 'dispatched',
      dispatched_at: new Date(Date.now() - 1_000),
      send_started_at: null,
    });
    prisma.message.updateMany.mockResolvedValue({ count: 0 });
    const res = response();

    await markSendStarted(request(), res);

    expect(res.statusCode).toBe(409);
    expect(prisma.message.findUnique).not.toHaveBeenCalled();
  });
});
