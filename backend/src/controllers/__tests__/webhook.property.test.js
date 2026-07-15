'use strict';

jest.mock('../../prisma/client', () => {
  const client = {
    message: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
    device: { updateMany: jest.fn() },
  };
  client.$transaction = jest.fn(async (callback) => callback(client));
  return client;
});

const prisma = require('../../prisma/client');
const { reportDelivery } = require('../webhook.controller');

function response() {
  return {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

function request({
  id = 12,
  status = 'sent',
  userId = 4,
  deviceId = 8,
} = {}) {
  return {
    params: { id: String(id) },
    body: { status },
    device: { userId, deviceId },
  };
}

function message(overrides = {}) {
  return {
    id: 12,
    user_id: 4,
    device_id: 8,
    status: 'dispatched',
    dispatched_at: new Date(Date.now() - 1_000),
    delivered_at: null,
    ...overrides,
  };
}

describe('reportDelivery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test.each(['sent', 'failed'])('atomically transitions a dispatched message to %s', async (status) => {
    const claimed = message();
    const terminal = message({ status, delivered_at: new Date() });
    prisma.message.findUnique
      .mockResolvedValueOnce(claimed)
      .mockResolvedValueOnce(terminal);
    prisma.message.updateMany.mockResolvedValue({ count: 1 });
    prisma.device.updateMany.mockResolvedValue({ count: 1 });
    const res = response();

    await reportDelivery(request({ status }), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toBe(terminal);
    expect(prisma.message.updateMany).toHaveBeenCalledWith({
      where: {
        id: 12,
        user_id: 4,
        device_id: 8,
        status: 'dispatched',
        dispatched_at: { gt: expect.any(Date) },
      },
      data: {
        status,
        delivered_at: expect.any(Date),
        updated_at: expect.any(Date),
      },
    });

    if (status === 'sent') {
      expect(prisma.device.updateMany).toHaveBeenCalledWith({
        where: { id: 8, user_id: 4 },
        data: { messages_sent: { increment: 1 } },
      });
    } else {
      expect(prisma.device.updateMany).not.toHaveBeenCalled();
    }
  });

  test('acknowledges a late sent report after timeout without changing failed', async () => {
    const timedOut = message({ status: 'failed' });
    prisma.message.findUnique.mockResolvedValue(timedOut);
    const res = response();

    await reportDelivery(request({ status: 'sent' }), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toBe(timedOut);
    expect(prisma.message.updateMany).not.toHaveBeenCalled();
    expect(prisma.device.updateMany).not.toHaveBeenCalled();
  });

  test('turns an overdue dispatched message into failed before accepting a late sent report', async () => {
    const overdue = message({ dispatched_at: new Date(Date.now() - 60_001) });
    const failed = message({ status: 'failed', dispatched_at: overdue.dispatched_at, delivered_at: new Date() });
    prisma.message.findUnique
      .mockResolvedValueOnce(overdue)
      .mockResolvedValueOnce(failed);
    prisma.message.updateMany.mockResolvedValue({ count: 1 });
    const res = response();

    await reportDelivery(request({ status: 'sent' }), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toBe(failed);
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
      data: { status: 'failed', delivered_at: expect.any(Date), updated_at: expect.any(Date) },
    });
    expect(prisma.device.updateMany).not.toHaveBeenCalled();
  });

  test('acknowledges the terminal status when the timeout wins the update race', async () => {
    const claimed = message();
    const timedOut = message({ status: 'failed' });
    prisma.message.findUnique
      .mockResolvedValueOnce(claimed)
      .mockResolvedValueOnce(timedOut);
    prisma.message.updateMany.mockResolvedValue({ count: 0 });
    const res = response();

    await reportDelivery(request({ status: 'sent' }), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toBe(timedOut);
    expect(prisma.device.updateMany).not.toHaveBeenCalled();
  });

  test('rejects a report from another phone owned by the same user', async () => {
    prisma.message.findUnique.mockResolvedValue(message());
    const res = response();

    await reportDelivery(request({ deviceId: 99 }), res);

    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ error: 'Message is assigned to another device' });
    expect(prisma.message.updateMany).not.toHaveBeenCalled();
  });

  test('rejects a report for another owner', async () => {
    prisma.message.findUnique.mockResolvedValue(message({ user_id: 99 }));
    const res = response();

    await reportDelivery(request(), res);

    expect(res.statusCode).toBe(401);
    expect(prisma.message.updateMany).not.toHaveBeenCalled();
  });

  test('returns 404 for a missing message', async () => {
    prisma.message.findUnique.mockResolvedValue(null);
    const res = response();

    await reportDelivery(request(), res);

    expect(res.statusCode).toBe(404);
    expect(prisma.message.updateMany).not.toHaveBeenCalled();
  });

  test('returns 409 for a non-terminal message that is not dispatched', async () => {
    prisma.message.findUnique.mockResolvedValue(message({ status: 'pending', device_id: 8 }));
    const res = response();

    await reportDelivery(request(), res);

    expect(res.statusCode).toBe(409);
    expect(prisma.message.updateMany).not.toHaveBeenCalled();
  });

  test('rejects invalid delivery status before querying the database', async () => {
    const res = response();

    await reportDelivery(request({ status: 'pending' }), res);

    expect(res.statusCode).toBe(400);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
