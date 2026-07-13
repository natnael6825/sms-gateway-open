'use strict';

const crypto = require('crypto');

// Mock the Prisma client before requiring the middleware
jest.mock('../../prisma/client', () => ({
  apiKey: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
}));

const prisma = require('../../prisma/client');
const apiKeyAuthMiddleware = require('../apiKeyAuth.middleware');

describe('apiKeyAuthMiddleware', () => {
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
    prisma.apiKey.update.mockResolvedValue({});
  });

  test('valid key attaches req.apiUser and calls next()', async () => {
    const plainKey = 'sms_abc123def456abc123def456abc123de';
    const keyHash = crypto.createHash('sha256').update(plainKey).digest('hex');
    const userId = 42;

    prisma.apiKey.findUnique.mockResolvedValue({ id: 1, user_id: userId, key_hash: keyHash });

    req.headers['x-api-key'] = plainKey;

    await apiKeyAuthMiddleware(req, res, next);

    expect(prisma.apiKey.findUnique).toHaveBeenCalledWith({ where: { key_hash: keyHash } });
    expect(next).toHaveBeenCalledTimes(1);
    expect(req.apiUser).toBeDefined();
    expect(req.apiUser.userId).toBe(userId);
    expect(res.status).not.toHaveBeenCalled();
  });

  test('missing X-API-Key header returns 401', async () => {
    // No x-api-key header set
    await apiKeyAuthMiddleware(req, res, next);

    expect(prisma.apiKey.findUnique).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
  });

  test('unknown key (not in DB) returns 401', async () => {
    const unknownKey = 'sms_unknownkey000000000000000000000';

    prisma.apiKey.findUnique.mockResolvedValue(null);

    req.headers['x-api-key'] = unknownKey;

    await apiKeyAuthMiddleware(req, res, next);

    expect(prisma.apiKey.findUnique).toHaveBeenCalledTimes(1);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
  });
});
