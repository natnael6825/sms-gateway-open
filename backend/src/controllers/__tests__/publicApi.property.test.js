// Feature: sms-gateway-v2, Property 4: Public API Accepts Valid Messages and Rejects Oversized Ones

'use strict';

const fc = require('fast-check');

// Mock the Prisma client before requiring the controller
jest.mock('../../prisma/client', () => ({
  message: {
    create: jest.fn(),
  },
}));

const prisma = require('../../prisma/client');
const { sendSms } = require('../publicApi.controller');

/**
 * Validates: Requirements 2.1, 2.2
 *
 * Property 4: Public API Accepts Valid Messages and Rejects Oversized Ones.
 *
 * For any message_text with length in [1, 1600] and a valid phone_number,
 * sendSms() SHALL return HTTP 201 with status: "pending".
 * For any message_text with length > 1600, sendSms() SHALL return HTTP 422.
 */
describe('Property 4: Public API Accepts Valid Messages and Rejects Oversized Ones', () => {
  const FIXED_USER_ID = 99;
  const FIXED_API_KEY_ID = 7;
  const PUBLIC_ID = '88271e9c-72be-4d36-a42b-d9deab9cb1c8';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns HTTP 201 with status pending for any valid message_text (length 1–20) and phone_number', async () => {
    await fc.assert(
      fc.asyncProperty(
        // phone_number: non-empty string
        fc.string({ minLength: 1 }),
        // message_text: length in [1, 1600]
        fc.string({ minLength: 1, maxLength: 1600 }),
        async (phone_number, message_text) => {
          let capturedCreateData = null;

          prisma.message.create.mockImplementation(async ({ data }) => {
            capturedCreateData = data;
            return {
              id: 1,
              public_id: PUBLIC_ID,
              user_id: data.user_id,
              phone_number: data.phone_number,
              message_text: data.message_text,
              status: data.status,
              source: data.source,
              created_at: new Date(),
              updated_at: new Date(),
            };
          });

          const req = {
            body: { phone_number, message_text },
            apiUser: { userId: FIXED_USER_ID, apiKeyId: FIXED_API_KEY_ID },
          };

          let statusCode = null;
          let responseBody = null;
          const res = {
            set() {
              return this;
            },
            status(code) {
              statusCode = code;
              return this;
            },
            json(body) {
              responseBody = body;
              return this;
            },
          };

          await sendSms(req, res);

          // 1. HTTP 201
          expect(statusCode).toBe(201);

          // 2. Response contains status: 'pending'
          expect(responseBody).toHaveProperty('status', 'pending');

          // 3. Response exposes the public UUID, never the integer primary key
          expect(responseBody).toHaveProperty('id', PUBLIC_ID);

          // 4. The data passed to prisma.message.create has status 'pending' and source 'api'
          expect(capturedCreateData).not.toBeNull();
          expect(capturedCreateData.status).toBe('pending');
          expect(capturedCreateData.source).toBe('api');
          expect(capturedCreateData.user_id).toBe(FIXED_USER_ID);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('returns HTTP 422 for any message_text with length > 1600', async () => {
    await fc.assert(
      fc.asyncProperty(
        // phone_number: non-empty string
        fc.string({ minLength: 1 }),
        // message_text: length > 1600
        fc.string({ minLength: 1601, maxLength: 1800 }),
        async (phone_number, message_text) => {
          const req = {
            body: { phone_number, message_text },
            apiUser: { userId: FIXED_USER_ID, apiKeyId: FIXED_API_KEY_ID },
          };

          let statusCode = null;
          let responseBody = null;
          const res = {
            status(code) {
              statusCode = code;
              return this;
            },
            json(body) {
              responseBody = body;
              return this;
            },
          };

          await sendSms(req, res);

          // Must return HTTP 422
          expect(statusCode).toBe(422);
          expect(responseBody).toHaveProperty('error', 'message_text must be 1600 characters or fewer');

          // prisma.message.create must NOT have been called
          expect(prisma.message.create).not.toHaveBeenCalled();

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('returns HTTP 400 when phone_number is missing', async () => {
    const req = {
      body: { message_text: 'Hello' },
      apiUser: { userId: FIXED_USER_ID },
    };

    let statusCode = null;
    let responseBody = null;
    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(body) {
        responseBody = body;
        return this;
      },
    };

    await sendSms(req, res);

    expect(statusCode).toBe(400);
    expect(responseBody).toHaveProperty('error', 'phone_number is required');
    expect(prisma.message.create).not.toHaveBeenCalled();
  });

  it('returns HTTP 400 when message_text is missing', async () => {
    const req = {
      body: { phone_number: '+15551234567' },
      apiUser: { userId: FIXED_USER_ID },
    };

    let statusCode = null;
    let responseBody = null;
    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(body) {
        responseBody = body;
        return this;
      },
    };

    await sendSms(req, res);

    expect(statusCode).toBe(400);
    expect(responseBody).toHaveProperty('error', 'message_text is required');
    expect(prisma.message.create).not.toHaveBeenCalled();
  });
});
