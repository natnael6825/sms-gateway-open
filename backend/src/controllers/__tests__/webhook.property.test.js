// Feature: sms-gateway-v2, Property 8: Webhook Delivery Updates Status and Timestamps

'use strict';

const fc = require('fast-check');

// Mock the Prisma client before requiring the controller
jest.mock('../../prisma/client', () => ({
  message: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
}));

const prisma = require('../../prisma/client');
const { reportDelivery } = require('../webhook.controller');

/**
 * Validates: Requirements 4.3, 8.4
 *
 * Property 8: Webhook Delivery Updates Status and Timestamps.
 *
 * For any message with status = "dispatched", calling reportDelivery() with
 * status: "sent" or status: "failed" SHALL update the message's status to the
 * reported value, set delivered_at to a non-null timestamp, and return HTTP 200.
 */
describe('v2 Property 8: Webhook Delivery Updates Status and Timestamps', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('updates status and sets delivered_at for any dispatched message with sent or failed', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 1000 }),       // userId
        fc.integer({ min: 1 }),                   // messageId
        fc.constantFrom('sent', 'failed'),         // valid delivery status
        async (userId, messageId, deliveryStatus) => {
          const dispatchedMessage = {
            id: messageId,
            user_id: userId,
            phone_number: '+15551234567',
            message_text: 'Test message',
            status: 'dispatched',
            created_at: new Date('2024-01-01T00:00:00.000Z'),
            updated_at: new Date('2024-01-01T00:00:00.000Z'),
            dispatched_at: new Date('2024-01-01T01:00:00.000Z'),
            delivered_at: null,
          };

          let capturedUpdateData = null;

          prisma.message.findUnique.mockResolvedValue(dispatchedMessage);
          prisma.message.update.mockImplementation(async ({ where, data }) => {
            capturedUpdateData = data;
            return {
              ...dispatchedMessage,
              status: data.status,
              delivered_at: data.delivered_at,
              updated_at: data.updated_at,
            };
          });

          const req = {
            params: { id: String(messageId) },
            body: { status: deliveryStatus },
            device: { userId },
          };

          let statusCode = null;
          let responseBody = null;
          const res = {
            status(code) { statusCode = code; return this; },
            json(body) { responseBody = body; return this; },
          };

          const before = new Date();
          await reportDelivery(req, res);
          const after = new Date();

          // 1. HTTP 200
          expect(statusCode).toBe(200);

          // 2. Returned message has the reported status
          expect(responseBody.status).toBe(deliveryStatus);

          // 3. delivered_at is set (non-null)
          expect(responseBody.delivered_at).not.toBeNull();

          // 4. The update was called with correct data
          expect(capturedUpdateData).not.toBeNull();
          expect(capturedUpdateData.status).toBe(deliveryStatus);
          expect(capturedUpdateData.delivered_at).toBeInstanceOf(Date);
          expect(capturedUpdateData.updated_at).toBeInstanceOf(Date);

          // 5. findUnique was called with the correct message id
          expect(prisma.message.findUnique).toHaveBeenCalledWith(
            expect.objectContaining({ where: { id: messageId } })
          );

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('sets delivered_at to a timestamp within the test execution window', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 1000 }),
        fc.integer({ min: 1 }),
        fc.constantFrom('sent', 'failed'),
        async (userId, messageId, deliveryStatus) => {
          const dispatchedMessage = {
            id: messageId,
            user_id: userId,
            phone_number: '+15551234567',
            message_text: 'Test',
            status: 'dispatched',
            created_at: new Date(),
            updated_at: new Date(),
            dispatched_at: new Date(),
            delivered_at: null,
          };

          let capturedDeliveredAt = null;

          prisma.message.findUnique.mockResolvedValue(dispatchedMessage);
          prisma.message.update.mockImplementation(async ({ data }) => {
            capturedDeliveredAt = data.delivered_at;
            return { ...dispatchedMessage, ...data };
          });

          const before = new Date();

          const req = {
            params: { id: String(messageId) },
            body: { status: deliveryStatus },
            device: { userId },
          };
          const res = {
            status() { return this; },
            json() { return this; },
          };

          await reportDelivery(req, res);

          const after = new Date();

          // delivered_at must be within the test execution window
          expect(capturedDeliveredAt).toBeInstanceOf(Date);
          expect(capturedDeliveredAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
          expect(capturedDeliveredAt.getTime()).toBeLessThanOrEqual(after.getTime());

          return true;
        }
      ),
      { numRuns: 50 }
    );
  });
});

// Edge case: invalid status → 400
describe('v2 Property 8 edge case: invalid status returns HTTP 400', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns HTTP 400 for any status value that is not sent or failed', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string().filter((s) => s !== 'sent' && s !== 'failed'),
        fc.integer({ min: 1 }),
        fc.integer({ min: 1 }),
        async (invalidStatus, userId, messageId) => {
          const req = {
            params: { id: String(messageId) },
            body: { status: invalidStatus },
            device: { userId },
          };

          let statusCode = null;
          let responseBody = null;
          const res = {
            status(code) { statusCode = code; return this; },
            json(body) { responseBody = body; return this; },
          };

          await reportDelivery(req, res);

          // Must return HTTP 400
          expect(statusCode).toBe(400);
          expect(responseBody).toHaveProperty('error', 'Invalid status');

          // findUnique must NOT have been called (validation happens first)
          expect(prisma.message.findUnique).not.toHaveBeenCalled();

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Edge case: non-existent message id → 404
describe('v2 Property 8 edge case: non-existent message returns HTTP 404', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns HTTP 404 when the message does not exist', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1 }),
        fc.integer({ min: 1 }),
        fc.constantFrom('sent', 'failed'),
        async (userId, messageId, deliveryStatus) => {
          // Message not found
          prisma.message.findUnique.mockResolvedValue(null);

          const req = {
            params: { id: String(messageId) },
            body: { status: deliveryStatus },
            device: { userId },
          };

          let statusCode = null;
          let responseBody = null;
          const res = {
            status(code) { statusCode = code; return this; },
            json(body) { responseBody = body; return this; },
          };

          await reportDelivery(req, res);

          expect(statusCode).toBe(404);
          expect(responseBody).toHaveProperty('error', 'Message not found');

          // update must NOT have been called
          expect(prisma.message.update).not.toHaveBeenCalled();

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Edge case: wrong user (message belongs to different user) → 401
describe('v2 Property 8 edge case: wrong user returns HTTP 401', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns HTTP 401 when the message belongs to a different user', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 500 }),    // deviceUserId
        fc.integer({ min: 501, max: 1000 }), // messageOwnerUserId (guaranteed different)
        fc.integer({ min: 1 }),              // messageId
        fc.constantFrom('sent', 'failed'),
        async (deviceUserId, messageOwnerUserId, messageId, deliveryStatus) => {
          const message = {
            id: messageId,
            user_id: messageOwnerUserId, // belongs to a different user
            phone_number: '+15551234567',
            message_text: 'Test',
            status: 'dispatched',
            created_at: new Date(),
            updated_at: new Date(),
            dispatched_at: new Date(),
            delivered_at: null,
          };

          prisma.message.findUnique.mockResolvedValue(message);

          const req = {
            params: { id: String(messageId) },
            body: { status: deliveryStatus },
            device: { userId: deviceUserId }, // different from message.user_id
          };

          let statusCode = null;
          let responseBody = null;
          const res = {
            status(code) { statusCode = code; return this; },
            json(body) { responseBody = body; return this; },
          };

          await reportDelivery(req, res);

          expect(statusCode).toBe(401);
          expect(responseBody).toHaveProperty('error', 'Unauthorized');

          // update must NOT have been called
          expect(prisma.message.update).not.toHaveBeenCalled();

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Edge case: non-dispatched message → 409
describe('v2 Property 8 edge case: non-dispatched message returns HTTP 409', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns HTTP 409 when the message is not in dispatched state', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 1000 }),              // userId
        fc.integer({ min: 1 }),                          // messageId
        fc.constantFrom('pending', 'sent', 'failed'),    // non-dispatched status
        fc.constantFrom('sent', 'failed'),               // valid delivery status
        async (userId, messageId, currentStatus, deliveryStatus) => {
          const message = {
            id: messageId,
            user_id: userId,
            phone_number: '+15551234567',
            message_text: 'Test',
            status: currentStatus, // not 'dispatched'
            created_at: new Date(),
            updated_at: new Date(),
            dispatched_at: currentStatus !== 'pending' ? new Date() : null,
            delivered_at: currentStatus === 'sent' || currentStatus === 'failed' ? new Date() : null,
          };

          prisma.message.findUnique.mockResolvedValue(message);

          const req = {
            params: { id: String(messageId) },
            body: { status: deliveryStatus },
            device: { userId },
          };

          let statusCode = null;
          let responseBody = null;
          const res = {
            status(code) { statusCode = code; return this; },
            json(body) { responseBody = body; return this; },
          };

          await reportDelivery(req, res);

          expect(statusCode).toBe(409);
          expect(responseBody).toHaveProperty('error', 'Message is not in dispatched state');

          // update must NOT have been called
          expect(prisma.message.update).not.toHaveBeenCalled();

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
