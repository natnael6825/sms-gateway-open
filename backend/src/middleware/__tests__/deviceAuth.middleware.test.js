'use strict';

const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'test-device-secret';

const deviceAuthMiddleware = require('../deviceAuth.middleware');

describe('deviceAuthMiddleware', () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    next = jest.fn();
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    req = {
      headers: {},
    };
  });

  test('valid token passes and attaches userId and deviceId to req.device', () => {
    const userId = 42;
    const deviceId = 7;
    const token = jwt.sign({ userId, deviceId }, process.env.JWT_SECRET);

    req.headers['x-device-token'] = token;

    deviceAuthMiddleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.device).toBeDefined();
    expect(req.device.userId).toBe(userId);
    expect(req.device.deviceId).toBe(deviceId);
    expect(res.status).not.toHaveBeenCalled();
  });

  test('missing X-Device-Token header returns 401', () => {
    // No x-device-token header set
    deviceAuthMiddleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
  });

  test('token signed with wrong secret returns 401', () => {
    const userId = 99;
    const deviceId = 3;
    const token = jwt.sign({ userId, deviceId }, 'wrong-secret');

    req.headers['x-device-token'] = token;

    deviceAuthMiddleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
  });

  test('expired token returns 401', () => {
    const userId = 7;
    const deviceId = 2;
    // Sign a token that expired 1 second ago
    const token = jwt.sign({ userId, deviceId }, process.env.JWT_SECRET, { expiresIn: -1 });

    req.headers['x-device-token'] = token;

    deviceAuthMiddleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
  });
});
