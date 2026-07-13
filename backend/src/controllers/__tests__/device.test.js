'use strict';

const jwt = require('jsonwebtoken');

// Mock the Prisma client before requiring the controller
jest.mock('../../prisma/client', () => ({
  user: {
    findUnique: jest.fn(),
  },
  device: {
    create: jest.fn(),
  },
}));

const prisma = require('../../prisma/client');
const { pairDevice } = require('../device.controller');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildReqRes(body = {}) {
  const req = { body };
  let _status = null;
  let _body = null;
  const res = {
    status(code) { _status = code; return this; },
    json(body) { _body = body; return this; },
  };
  return { req, res, getResponse: () => ({ status: _status, body: _body }) };
}

function validUser(overrides = {}) {
  return {
    id: 42,
    email: 'user@example.com',
    device_key: 'ABC1234',
    daily_limit: 100,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('pairDevice', () => {
  beforeAll(() => {
    process.env.JWT_SECRET = 'test-device-secret';
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 200 with a token for a valid device key', async () => {
    const user = validUser();
    const createdDevice = { id: 99, user_id: user.id, device_identifier: 'test-device' };

    prisma.user.findUnique.mockResolvedValue(user);
    prisma.device.create.mockResolvedValue(createdDevice);

    const { req, res, getResponse } = buildReqRes({
      code: 'ABC1234',
      device_identifier: 'test-device',
    });

    await pairDevice(req, res);

    const { status, body } = getResponse();
    expect(status).toBe(200);
    expect(body).toHaveProperty('token');
    expect(typeof body.token).toBe('string');
  });

  it('token decodes to correct userId and deviceId', async () => {
    const user = validUser({ id: 42 });
    const createdDevice = { id: 99, user_id: 42, device_identifier: 'my-phone' };

    prisma.user.findUnique.mockResolvedValue(user);
    prisma.device.create.mockResolvedValue(createdDevice);

    const { req, res, getResponse } = buildReqRes({
      code: 'ABC1234',
      device_identifier: 'my-phone',
    });

    await pairDevice(req, res);

    const { status, body } = getResponse();
    expect(status).toBe(200);

    const decoded = jwt.verify(body.token, process.env.JWT_SECRET);
    expect(decoded.userId).toBe(42);
    expect(decoded.deviceId).toBe(99);
  });

  it('generates a device_identifier via crypto.randomUUID() when not provided', async () => {
    const user = validUser();
    let capturedDeviceData = null;

    prisma.user.findUnique.mockResolvedValue(user);
    prisma.device.create.mockImplementation(async ({ data }) => {
      capturedDeviceData = data;
      return { id: 7, user_id: data.user_id, device_identifier: data.device_identifier };
    });

    const { req, res, getResponse } = buildReqRes({ code: 'ABC1234' });
    await pairDevice(req, res);

    const { status } = getResponse();
    expect(status).toBe(200);
    expect(capturedDeviceData).not.toBeNull();
    expect(capturedDeviceData.device_identifier).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });

  it('looks up user by device_key (case-insensitive — uppercased before lookup)', async () => {
    const user = validUser({ device_key: 'ABC1234' });
    prisma.user.findUnique.mockResolvedValue(user);
    prisma.device.create.mockResolvedValue({ id: 1, user_id: user.id, device_identifier: 'dev' });

    const { req, res } = buildReqRes({ code: 'abc1234' }); // lowercase input
    await pairDevice(req, res);

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { device_key: 'ABC1234' },
    });
  });

  it('returns 400 for an invalid (non-existent) device key', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    const { req, res, getResponse } = buildReqRes({ code: 'XXXXXXX' });
    await pairDevice(req, res);

    const { status, body } = getResponse();
    expect(status).toBe(400);
    expect(body).toHaveProperty('error', 'Invalid device key');
  });

  it('returns 400 when no code is provided', async () => {
    const { req, res, getResponse } = buildReqRes({});
    await pairDevice(req, res);

    const { status, body } = getResponse();
    expect(status).toBe(400);
    expect(body).toHaveProperty('error', 'Device key is required');
  });

  it('allows multiple phones to pair with the same key', async () => {
    const user = validUser();

    // First phone
    prisma.user.findUnique.mockResolvedValue(user);
    prisma.device.create.mockResolvedValueOnce({ id: 1, user_id: user.id, device_identifier: 'phone-1' });

    const { req: req1, res: res1, getResponse: get1 } = buildReqRes({ code: 'ABC1234', device_identifier: 'phone-1' });
    await pairDevice(req1, res1);
    expect(get1().status).toBe(200);

    // Second phone — same key, different device
    prisma.user.findUnique.mockResolvedValue(user);
    prisma.device.create.mockResolvedValueOnce({ id: 2, user_id: user.id, device_identifier: 'phone-2' });

    const { req: req2, res: res2, getResponse: get2 } = buildReqRes({ code: 'ABC1234', device_identifier: 'phone-2' });
    await pairDevice(req2, res2);
    expect(get2().status).toBe(200);

    // Both should have gotten tokens
    expect(prisma.device.create).toHaveBeenCalledTimes(2);
  });
});
