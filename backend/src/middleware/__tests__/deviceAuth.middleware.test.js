'use strict';

const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'test-device-secret';

jest.mock('../../prisma/client', () => ({
  device: {
    findFirst: jest.fn(),
  },
}));

const prisma = require('../../prisma/client');
const deviceAuthMiddleware = require('../deviceAuth.middleware');

describe('deviceAuthMiddleware', () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    jest.clearAllMocks();
    next = jest.fn();
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    req = {
      headers: {},
    };
  });

  test('valid token for an active device passes and attaches userId and deviceId to req.device', async () => {
    const userId = 42;
    const deviceId = 7;
    const token = jwt.sign({ userId, deviceId }, process.env.JWT_SECRET);

    req.headers['x-device-token'] = token;
    prisma.device.findFirst.mockResolvedValue({ id: deviceId, user_id: userId, is_active: true });

    await deviceAuthMiddleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.device).toBeDefined();
    expect(req.device.userId).toBe(userId);
    expect(req.device.deviceId).toBe(deviceId);
    expect(prisma.device.findFirst).toHaveBeenCalledWith({
      where: { id: deviceId, user_id: userId, is_active: true },
    });
    expect(res.status).not.toHaveBeenCalled();
  });

  test('missing X-Device-Token header returns 401', async () => {
    // No x-device-token header set
    await deviceAuthMiddleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
  });

  test('token signed with wrong secret returns 401', async () => {
    const userId = 99;
    const deviceId = 3;
    const token = jwt.sign({ userId, deviceId }, 'wrong-secret');

    req.headers['x-device-token'] = token;

    await deviceAuthMiddleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
  });

  test('expired token returns 401', async () => {
    const userId = 7;
    const deviceId = 2;
    // Sign a token that expired 1 second ago
    const token = jwt.sign({ userId, deviceId }, process.env.JWT_SECRET, { expiresIn: -1 });

    req.headers['x-device-token'] = token;

    await deviceAuthMiddleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
  });
});
