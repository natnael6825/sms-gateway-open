'use strict';

jest.mock('../../prisma/client', () => ({
  device: { findFirst: jest.fn() },
}));

const prisma = require('../../prisma/client');
const connectedDeviceMiddleware = require('../connectedDevice.middleware');

function response() {
  return {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

describe('connectedDeviceMiddleware dispatch readiness', () => {
  beforeEach(() => jest.clearAllMocks());

  test('allows message creation only when a sender has polled recently', async () => {
    prisma.device.findFirst.mockResolvedValue({ id: 7 });
    const next = jest.fn();
    const res = response();

    await connectedDeviceMiddleware({ user: { userId: 4 } }, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(prisma.device.findFirst).toHaveBeenCalledWith({
      where: {
        user_id: 4,
        is_active: true,
        is_connected: true,
        last_seen: { gte: expect.any(Date) },
        last_polled_at: { gte: expect.any(Date) },
      },
      select: { id: true },
    });
  });

  test('returns NO_CONNECTED_DEVICE when heartbeats exist but no sender is ready', async () => {
    prisma.device.findFirst.mockResolvedValue(null);
    const next = jest.fn();
    const res = response();

    await connectedDeviceMiddleware({ apiUser: { userId: 4 } }, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(409);
    expect(res.body).toMatchObject({ code: 'NO_CONNECTED_DEVICE' });
  });
});
