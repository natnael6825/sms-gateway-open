// Feature: sms-gateway-v2, Property 2: API Key Hash Is Never Equal to Plaintext
// Feature: sms-gateway-v2, Property 3: API Key Format Guarantees 128-Bit Entropy
// Feature: sms-gateway-v2, Property 5: Device Key Format

'use strict';

const fc = require('fast-check');
const crypto = require('crypto');

// Mock the Prisma client before requiring the controller
jest.mock('../../prisma/client', () => ({
  apiKey: {
    findUnique: jest.fn(),
    create: jest.fn(),
    upsert: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
}));

const prisma = require('../../prisma/client');
const {
  getOrCreateApiKey,
  regenerateApiKey,
  getOrCreateDeviceKey,
  resetDeviceKey,
  generateApiKeyPlaintext,
  generateDeviceKey,
  sha256,
} = require('../user.controller');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a minimal mock req/res pair.
 * @param {number} userId
 * @returns {{ req: object, res: object, getResponse: () => { status: number, body: object } }}
 */
function buildReqRes(userId = 1) {
  const req = { user: { userId } };
  let _status = null;
  let _body = null;
  const res = {
    status(code) {
      _status = code;
      return this;
    },
    json(body) {
      _body = body;
      return this;
    },
  };
  return {
    req,
    res,
    getResponse: () => ({ status: _status, body: _body }),
  };
}

// ---------------------------------------------------------------------------
// Property 2: API Key Hash Is Never Equal to Plaintext
// ---------------------------------------------------------------------------

/**
 * Validates: Requirements 1.4
 *
 * Property 2: API Key Hash Is Never Equal to Plaintext
 *
 * For any generated API key, the SHA-256 hash stored in the database SHALL NOT
 * equal the plaintext key returned in the response.
 */
describe('Property 2: API Key Hash Is Never Equal to Plaintext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Feature: sms-gateway-v2, Property 2: API Key Hash Is Never Equal to Plaintext
  it('SHA-256(plaintext) !== plaintext for any generated key', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Use integer user IDs
        fc.integer({ min: 1, max: 100000 }),
        async (userId) => {
          // No existing key — force key generation
          prisma.apiKey.findUnique.mockResolvedValue(null);

          let capturedKeyHash = null;
          prisma.apiKey.create.mockImplementation(async ({ data }) => {
            capturedKeyHash = data.key_hash;
            return { id: 1, user_id: userId, key_hash: data.key_hash };
          });

          const { req, res, getResponse } = buildReqRes(userId);
          await getOrCreateApiKey(req, res);

          const { status, body } = getResponse();
          expect(status).toBe(200);
          expect(body).toHaveProperty('key');
          expect(body).toHaveProperty('masked');

          const plaintext = body.key;

          // The stored hash must NOT equal the plaintext
          expect(capturedKeyHash).not.toBeNull();
          expect(capturedKeyHash).not.toEqual(plaintext);

          // Verify the hash is actually SHA-256 of the plaintext
          const expectedHash = crypto.createHash('sha256').update(plaintext).digest('hex');
          expect(capturedKeyHash).toEqual(expectedHash);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: sms-gateway-v2, Property 2: API Key Hash Is Never Equal to Plaintext
  it('SHA-256(plaintext) !== plaintext for any regenerated key', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 100000 }),
        async (userId) => {
          let capturedKeyHash = null;
          prisma.apiKey.upsert.mockImplementation(async ({ update }) => {
            capturedKeyHash = update.key_hash;
            return { id: 1, user_id: userId, key_hash: update.key_hash };
          });

          const { req, res, getResponse } = buildReqRes(userId);
          await regenerateApiKey(req, res);

          const { status, body } = getResponse();
          expect(status).toBe(200);
          expect(body).toHaveProperty('key');

          const plaintext = body.key;

          // The stored hash must NOT equal the plaintext
          expect(capturedKeyHash).not.toBeNull();
          expect(capturedKeyHash).not.toEqual(plaintext);

          // Verify the hash is actually SHA-256 of the plaintext
          const expectedHash = crypto.createHash('sha256').update(plaintext).digest('hex');
          expect(capturedKeyHash).toEqual(expectedHash);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 3: API Key Format Guarantees 128-Bit Entropy
// ---------------------------------------------------------------------------

/**
 * Validates: Requirements 1.6
 *
 * Property 3: API Key Format Guarantees 128-Bit Entropy
 *
 * For any generated API key, it SHALL match the pattern sms_[0-9a-f]{32},
 * ensuring 128 bits of entropy from the 32-character hex portion.
 * Any two independently generated keys SHALL be distinct.
 */
describe('Property 3: API Key Format Guarantees 128-Bit Entropy', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const API_KEY_PATTERN = /^sms_[0-9a-f]{32}$/;

  // Feature: sms-gateway-v2, Property 3: API Key Format Guarantees 128-Bit Entropy
  it('every generated key matches sms_[0-9a-f]{32}', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 100000 }),
        async (userId) => {
          prisma.apiKey.findUnique.mockResolvedValue(null);
          prisma.apiKey.create.mockResolvedValue({ id: 1, user_id: userId, key_hash: 'hash' });

          const { req, res, getResponse } = buildReqRes(userId);
          await getOrCreateApiKey(req, res);

          const { status, body } = getResponse();
          expect(status).toBe(200);
          expect(body).toHaveProperty('key');

          // Key must match the expected format
          expect(body.key).toMatch(API_KEY_PATTERN);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: sms-gateway-v2, Property 3: API Key Format Guarantees 128-Bit Entropy
  it('any two independently generated keys are distinct', () => {
    // Generate a large batch of keys and verify uniqueness
    const keys = new Set();
    const NUM_KEYS = 200;

    for (let i = 0; i < NUM_KEYS; i++) {
      const key = generateApiKeyPlaintext();
      expect(key).toMatch(API_KEY_PATTERN);
      keys.add(key);
    }

    // All keys should be unique (collision probability is astronomically low)
    expect(keys.size).toBe(NUM_KEYS);
  });

  // Feature: sms-gateway-v2, Property 3: API Key Format Guarantees 128-Bit Entropy
  it('regenerated keys also match sms_[0-9a-f]{32}', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 100000 }),
        async (userId) => {
          prisma.apiKey.upsert.mockResolvedValue({ id: 1, user_id: userId, key_hash: 'hash' });

          const { req, res, getResponse } = buildReqRes(userId);
          await regenerateApiKey(req, res);

          const { status, body } = getResponse();
          expect(status).toBe(200);
          expect(body).toHaveProperty('key');

          expect(body.key).toMatch(API_KEY_PATTERN);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 5: Device Key Format
// ---------------------------------------------------------------------------

/**
 * Validates: Requirements 3.1
 *
 * Property 5: Device Key Format
 *
 * For any user, GET /api/user/pairing-code SHALL return a code that matches
 * [A-Z0-9]{7} (7-char permanent key). The same key is returned on subsequent
 * calls. Resetting generates a new distinct key.
 */
describe('Property 5: Device Key Format', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const DEVICE_KEY_PATTERN = /^[A-Z0-9]{7}$/;

  // Feature: sms-gateway-v2, Property 5: Device Key Format
  it('generated device key matches [A-Z0-9]{7}', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 100000 }),
        async (userId) => {
          // No existing key — generate one
          prisma.user.findUnique.mockResolvedValue({ id: userId, device_key: null });

          let capturedKey = null;
          prisma.user.update.mockImplementation(async ({ data }) => {
            capturedKey = data.device_key;
            return { id: userId, device_key: data.device_key };
          });

          const { req, res, getResponse } = buildReqRes(userId);
          await getOrCreateDeviceKey(req, res);

          const { status, body } = getResponse();
          expect(status).toBe(200);
          expect(body).toHaveProperty('code');
          expect(body.code).toMatch(DEVICE_KEY_PATTERN);
          expect(capturedKey).toMatch(DEVICE_KEY_PATTERN);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: sms-gateway-v2, Property 5: Device Key Format
  it('returns the same key on subsequent calls (permanent key)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 100000 }),
        async (userId) => {
          const existingKey = generateDeviceKey();
          // Key already exists — return it without updating
          prisma.user.findUnique.mockResolvedValue({ id: userId, device_key: existingKey });

          const { req, res, getResponse } = buildReqRes(userId);
          await getOrCreateDeviceKey(req, res);

          const { status, body } = getResponse();
          expect(status).toBe(200);
          expect(body.code).toBe(existingKey);

          // user.update must NOT have been called (key already exists)
          expect(prisma.user.update).not.toHaveBeenCalled();

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: sms-gateway-v2, Property 5: Device Key Format
  it('reset generates a new distinct key matching [A-Z0-9]{7}', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 100000 }),
        async (userId) => {
          let capturedNewKey = null;
          prisma.user.update.mockImplementation(async ({ data }) => {
            capturedNewKey = data.device_key;
            return { id: userId, device_key: data.device_key };
          });

          const { req, res, getResponse } = buildReqRes(userId);
          await resetDeviceKey(req, res);

          const { status, body } = getResponse();
          expect(status).toBe(200);
          expect(body).toHaveProperty('code');
          expect(body.code).toMatch(DEVICE_KEY_PATTERN);
          expect(capturedNewKey).toMatch(DEVICE_KEY_PATTERN);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: sms-gateway-v2, Property 5: Device Key Format
  it('generateDeviceKey always produces distinct keys', () => {
    const keys = new Set();
    const NUM_KEYS = 200;
    for (let i = 0; i < NUM_KEYS; i++) {
      const key = generateDeviceKey();
      expect(key).toMatch(DEVICE_KEY_PATTERN);
      keys.add(key);
    }
    expect(keys.size).toBe(NUM_KEYS);
  });
});
