'use strict';

const jwt = require('jsonwebtoken');

// Set JWT_SECRET before requiring the middleware
process.env.JWT_SECRET = 'test-secret';

const authMiddleware = require('../auth.middleware');

describe('authMiddleware', () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    // Reset mocks before each test
    next = jest.fn();
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    req = {
      headers: {},
    };
  });

  test('valid token passes and attaches userId to req.user', () => {
    const userId = 42;
    const token = jwt.sign({ userId }, process.env.JWT_SECRET);

    req.headers['authorization'] = `Bearer ${token}`;

    authMiddleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toBeDefined();
    expect(req.user.userId).toBe(userId);
    expect(res.status).not.toHaveBeenCalled();
  });

  test('missing Authorization header returns 401', () => {
    // No authorization header set
    authMiddleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
  });

  test('Authorization header without Bearer prefix returns 401', () => {
    req.headers['authorization'] = 'Token sometoken';

    authMiddleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
  });

  test('malformed token returns 401', () => {
    req.headers['authorization'] = 'Bearer this.is.not.a.valid.jwt';

    authMiddleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
  });

  test('expired token returns 401', () => {
    const userId = 7;
    // Sign a token that expired 1 second ago
    const token = jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: -1 });

    req.headers['authorization'] = `Bearer ${token}`;

    authMiddleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
  });

  test('token signed with wrong secret returns 401', () => {
    const userId = 99;
    const token = jwt.sign({ userId }, 'wrong-secret');

    req.headers['authorization'] = `Bearer ${token}`;

    authMiddleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
  });
});
