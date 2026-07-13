'use strict';
jest.mock('../../prisma/client', () => ({ user: { findUnique: jest.fn() } }));
jest.mock('bcrypt', () => ({ compare: jest.fn() }));
const prisma = require('../../prisma/client');
const bcrypt = require('bcrypt');
const { login } = require('../auth.controller');

process.env.JWT_SECRET = 'single-owner-test-secret';

function response() {
  const res = { statusCode: 200, body: null };
  res.status = jest.fn((code) => { res.statusCode = code; return res; });
  res.json = jest.fn((body) => { res.body = body; return res; });
  return res;
}

describe('single-owner login', () => {
  beforeEach(() => jest.clearAllMocks());
  it('returns the first-login flag with a valid owner session', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 1, email: 'owner@example.com', password: 'hash', must_change_password: true });
    bcrypt.compare.mockResolvedValue(true);
    const res = response();
    await login({ body: { email: 'OWNER@example.com', password: 'temporary-password' } }, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.must_change_password).toBe(true);
  });
  it('rejects unknown credentials without revealing which field failed', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    const res = response();
    await login({ body: { email: 'other@example.com', password: 'wrong' } }, res);
    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: 'Invalid credentials' });
  });
});
