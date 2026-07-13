// Feature: sms-gateway, Property 5: New messages always start as pending and belong to the creating user
// (v2 properties 6, 7, 12, 13, 15 are appended at the bottom of this file)

'use strict';

const fc = require('fast-check');

// Mock the Prisma client before requiring the controller
jest.mock('../../prisma/client', () => ({
  message: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  $transaction: jest.fn(),
}));

const prisma = require('../../prisma/client');
const { createMessage } = require('../messages.controller');

/**
 * Validates: Requirements 3.1, 3.4
 *
 * Property 5: New messages always start as pending and belong to the creating user.
 *
 * For any authenticated user submitting a valid phone number and message text
 * to createMessage():
 *   1. The data passed to prisma.message.create has status === 'pending'.
 *   2. The data passed to prisma.message.create has user_id === req.user.userId.
 *   3. The response status is HTTP 201.
 */
describe('Property 5: New messages always start as pending and belong to the creating user', () => {
  const FIXED_USER_ID = 42;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('always creates a pending message associated with the authenticated user', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        async (phone_number, message_text) => {
          // Capture the data passed to prisma.message.create
          let capturedCreateData = null;

          prisma.message.create.mockImplementation(async ({ data }) => {
            capturedCreateData = data;
            return {
              id: 1,
              user_id: data.user_id,
              phone_number: data.phone_number,
              message_text: data.message_text,
              status: data.status,
              created_at: new Date(),
              updated_at: new Date(),
            };
          });

          // Build mock req / res with a fixed authenticated user
          const req = {
            body: { phone_number, message_text },
            user: { userId: FIXED_USER_ID },
          };

          let statusCode = null;
          const res = {
            status(code) {
              statusCode = code;
              return this;
            },
            json() {
              return this;
            },
          };

          await createMessage(req, res);

          // 1. The data passed to prisma.message.create must have status === 'pending'
          expect(capturedCreateData).not.toBeNull();
          expect(capturedCreateData.status).toBe('pending');

          // 2. The data passed to prisma.message.create must have user_id === req.user.userId
          expect(capturedCreateData.user_id).toBe(FIXED_USER_ID);

          // 3. The response status must be HTTP 201
          expect(statusCode).toBe(201);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: sms-gateway, Property 6: Missing message fields always produce HTTP 400

/**
 * Validates: Requirements 3.3
 *
 * Property 6: Missing message fields always produce HTTP 400.
 *
 * For any message creation request where at least one of phone_number or
 * message_text is null/missing, createMessage() SHALL return HTTP 400.
 */
describe('Property 6: Missing message fields always produce HTTP 400', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('always returns HTTP 400 when phone_number or message_text is missing', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc
          .record({
            phone_number: fc.option(fc.string({ minLength: 1 })),
            message_text: fc.option(fc.string({ minLength: 1 })),
          })
          .filter((r) => !r.phone_number || !r.message_text),
        async ({ phone_number, message_text }) => {
          const req = {
            body: { phone_number, message_text },
            user: { userId: 1 },
          };

          let statusCode = null;
          const res = {
            status(code) {
              statusCode = code;
              return this;
            },
            json() {
              return this;
            },
          };

          await createMessage(req, res);

          expect(statusCode).toBe(400);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: sms-gateway, Property 7: Message list is scoped to the authenticated user and ordered by creation date descending

/**
 * Validates: Requirements 4.1
 *
 * Property 7: Message list is scoped to the authenticated user and ordered by
 * creation date descending.
 *
 * For any two distinct users each having messages, getUserMessages() for user A
 * SHALL return only user A's messages (never user B's), and the returned array
 * SHALL be ordered by created_at descending (newest first).
 */
describe('Property 7: Message list is scoped to the authenticated user and ordered by creation date descending', () => {
  // We need getUserMessages in scope — re-require after the existing mock is set up.
  // The jest.mock for prisma/client is already declared at the top of this file.
  let getUserMessages;

  beforeAll(() => {
    getUserMessages = require('../messages.controller').getUserMessages;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns only the requesting user\'s messages, ordered by created_at descending', async () => {
    const messageRecord = (userId) =>
      fc.record({
        id: fc.integer({ min: 1, max: 1_000_000 }),
        user_id: fc.constant(userId),
        phone_number: fc.string(),
        message_text: fc.string(),
        status: fc.constantFrom('pending', 'sent', 'failed'),
        created_at: fc.date(),
      });

    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 500 }),   // userId1
        fc.integer({ min: 501, max: 1000 }), // userId2 — guaranteed distinct from userId1
        fc.array(messageRecord(1), { minLength: 1 }).map((msgs) =>
          msgs.map((m) => ({ ...m, user_id: 1 }))
        ),
        fc.array(messageRecord(2), { minLength: 1 }).map((msgs) =>
          msgs.map((m) => ({ ...m, user_id: 2 }))
        ),
        async (userId1, userId2, messagesForUser1, messagesForUser2) => {
          // Patch user_ids to match the generated userId values
          const user1Messages = messagesForUser1.map((m) => ({ ...m, user_id: userId1 }));
          const user2Messages = messagesForUser2.map((m) => ({ ...m, user_id: userId2 }));

          const allMessages = [...user1Messages, ...user2Messages];

          // Mock prisma.message.findMany to filter by where.user_id and sort by created_at desc
          prisma.message.findMany.mockImplementation(async ({ where, orderBy }) => {
            const filtered = allMessages.filter((m) => m.user_id === where.user_id);
            // Sort by created_at descending (newest first)
            filtered.sort((a, b) => b.created_at - a.created_at);
            return filtered;
          });

          // Helper to call getUserMessages for a given userId
          const callGetUserMessages = async (userId) => {
            const req = { user: { userId } };
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
            await getUserMessages(req, res);
            return { statusCode, responseBody };
          };

          // --- User 1 ---
          const result1 = await callGetUserMessages(userId1);
          expect(result1.statusCode).toBe(200);
          const msgs1 = result1.responseBody;

          // Isolation: every returned message must belong to userId1
          for (const msg of msgs1) {
            expect(msg.user_id).toBe(userId1);
          }

          // Ordering: consecutive pairs must be descending by created_at
          for (let i = 0; i < msgs1.length - 1; i++) {
            expect(msgs1[i].created_at >= msgs1[i + 1].created_at).toBe(true);
          }

          // --- User 2 ---
          const result2 = await callGetUserMessages(userId2);
          expect(result2.statusCode).toBe(200);
          const msgs2 = result2.responseBody;

          // Isolation: every returned message must belong to userId2
          for (const msg of msgs2) {
            expect(msg.user_id).toBe(userId2);
          }

          // Ordering: consecutive pairs must be descending by created_at
          for (let i = 0; i < msgs2.length - 1; i++) {
            expect(msgs2[i].created_at >= msgs2[i + 1].created_at).toBe(true);
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: sms-gateway, Property 9: Pending endpoint always returns the oldest pending message

/**
 * Validates: Requirements 5.1, 3.4 (v2: now requires device auth)
 *
 * Property 9: Pending endpoint always returns the oldest pending message
 * for the authenticated device's user.
 *
 * For any set of pending messages with distinct created_at timestamps,
 * getPendingMessage() SHALL return the message with the earliest created_at value
 * (when called with a valid req.device).
 */
describe('Property 9: Pending endpoint always returns the oldest pending message', () => {
  let getPendingMessage;

  beforeAll(() => {
    getPendingMessage = require('../messages.controller').getPendingMessage;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Default: $transaction delegates to the callback with prisma as tx
    prisma.$transaction.mockImplementation(async (fn) => fn(prisma));
  });

  it('always returns the message with the earliest created_at among all pending messages', async () => {
    const DEVICE_USER_ID = 42;

    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            id: fc.integer({ min: 1 }),
            created_at: fc.date(),
            status: fc.constant('pending'),
            phone_number: fc.string(),
            message_text: fc.string(),
          }),
          { minLength: 2 }
        ),
        async (messages) => {
          // Find the message with the earliest created_at (simulating Prisma orderBy: { created_at: 'asc' })
          const oldestMessage = messages.reduce((oldest, msg) =>
            msg.created_at < oldest.created_at ? msg : oldest
          );

          const dispatchedOldest = { ...oldestMessage, status: 'dispatched', dispatched_at: new Date() };

          // Mock prisma.message.findFirst to return the oldest message
          prisma.message.findFirst.mockResolvedValue(oldestMessage);
          prisma.message.update.mockResolvedValue(dispatchedOldest);

          // v2: req.device is required
          const req = { device: { userId: DEVICE_USER_ID } };
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

          await getPendingMessage(req, res);

          // 1. Response must be HTTP 200
          expect(statusCode).toBe(200);

          // 2. The returned message must have the earliest created_at among all pending messages
          expect(responseBody).not.toBeNull();
          for (const msg of messages) {
            expect(responseBody.created_at <= msg.created_at).toBe(true);
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: sms-gateway, Property 10: Valid status updates always succeed and reflect the new status

/**
 * Validates: Requirements 6.1, 8.1 (v2: only dispatched→sent and dispatched→failed are valid)
 *
 * Property 10: Valid status updates always succeed and reflect the new status.
 *
 * For any existing message with status 'dispatched' and a status value of either
 * 'sent' or 'failed', updateMessageStatus() SHALL return HTTP 200 with the
 * message's status field equal to the submitted value and updated_at greater
 * than the original updated_at.
 */
describe('Property 10: Valid status updates always succeed and reflect the new status', () => {
  let updateMessageStatus;

  beforeAll(() => {
    updateMessageStatus = require('../messages.controller').updateMessageStatus;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('always returns HTTP 200 with the new status and a later updated_at', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1 }),
        fc.constantFrom('sent', 'failed'),
        async (id, status) => {
          const originalUpdatedAt = new Date('2020-01-01T00:00:00.000Z');

          // v2: must start from 'dispatched' for sent/failed transitions to be valid
          const existingMessage = {
            id,
            user_id: 1,
            phone_number: '+15551234567',
            message_text: 'Hello!',
            status: 'dispatched',
            created_at: new Date('2020-01-01T00:00:00.000Z'),
            updated_at: originalUpdatedAt,
          };

          // Mock findUnique to return the existing message
          prisma.message.findUnique.mockResolvedValue(existingMessage);

          // Mock update to return the message with the new status and a fresh updated_at
          const freshUpdatedAt = new Date();
          prisma.message.update.mockResolvedValue({
            ...existingMessage,
            status,
            updated_at: freshUpdatedAt,
          });

          const req = {
            params: { id: String(id) },
            body: { status },
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

          await updateMessageStatus(req, res);

          // 1. HTTP 200
          expect(statusCode).toBe(200);

          // 2. responseBody.status equals the submitted status value
          expect(responseBody.status).toBe(status);

          // 3. responseBody.updated_at is greater than the original updated_at
          expect(new Date(responseBody.updated_at) > originalUpdatedAt).toBe(true);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: sms-gateway, Property 11: Invalid status values always produce HTTP 400

/**
 * Validates: Requirements 6.2
 *
 * Property 11: Invalid status values always produce HTTP 400.
 *
 * For any string value that is not 'sent' or 'failed' submitted as the status
 * in updateMessageStatus(), the backend SHALL return HTTP 400.
 */
describe('Property 11: Invalid status values always produce HTTP 400', () => {
  let updateMessageStatus;

  beforeAll(() => {
    updateMessageStatus = require('../messages.controller').updateMessageStatus;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('always returns HTTP 400 for any status value that is not sent or failed', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string().filter((s) => s !== 'sent' && s !== 'failed'),
        fc.integer({ min: 1 }),
        async (status, id) => {
          const req = {
            params: { id: String(id) },
            body: { status },
          };

          let statusCode = null;
          const res = {
            status(code) {
              statusCode = code;
              return this;
            },
            json() {
              return this;
            },
          };

          await updateMessageStatus(req, res);

          expect(statusCode).toBe(400);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================
// SMS Gateway v2 Property Tests
// ============================================================

// Feature: sms-gateway-v2, Property 6: Device Token Scopes Pending Messages to Paired User

/**
 * Validates: Requirements 3.4, 9.4
 *
 * Property 6: Device Token Scopes Pending Messages to Paired User.
 *
 * For any device token issued to user A, getPendingMessage() SHALL only return
 * messages where user_id equals A's user ID. Messages belonging to any other
 * user SHALL never appear in the response.
 */
describe('v2 Property 6: Device Token Scopes Pending Messages to Paired User', () => {
  let getPendingMessage;

  beforeAll(() => {
    getPendingMessage = require('../messages.controller').getPendingMessage;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Default: $transaction delegates to the callback with prisma as tx
    prisma.$transaction.mockImplementation(async (fn) => fn(prisma));
  });

  it('only returns messages belonging to the device user, never another user', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 500 }),   // deviceUserId
        fc.integer({ min: 501, max: 1000 }), // otherUserId (guaranteed distinct)
        fc.integer({ min: 1 }),              // messageId
        async (deviceUserId, otherUserId, messageId) => {
          // The pending message belongs to deviceUserId
          const pendingMessage = {
            id: messageId,
            user_id: deviceUserId,
            phone_number: '+15551234567',
            message_text: 'Hello',
            status: 'pending',
            created_at: new Date(),
          };

          const dispatchedMessage = {
            ...pendingMessage,
            status: 'dispatched',
            dispatched_at: new Date(),
          };

          // findFirst returns the pending message (scoped to deviceUserId by the controller)
          prisma.message.findFirst.mockResolvedValue(pendingMessage);
          prisma.message.update.mockResolvedValue(dispatchedMessage);

          const req = { device: { userId: deviceUserId } };
          let statusCode = null;
          let responseBody = null;
          const res = {
            status(code) { statusCode = code; return this; },
            json(body) { responseBody = body; return this; },
          };

          await getPendingMessage(req, res);

          // 1. Response must be HTTP 200
          expect(statusCode).toBe(200);

          // 2. The returned message must belong to deviceUserId, not otherUserId
          expect(responseBody).not.toBeNull();
          expect(responseBody.user_id).toBe(deviceUserId);
          expect(responseBody.user_id).not.toBe(otherUserId);

          // 3. findFirst was called with the correct user_id scope
          expect(prisma.message.findFirst).toHaveBeenCalledWith(
            expect.objectContaining({
              where: expect.objectContaining({ user_id: deviceUserId }),
            })
          );

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('returns null (HTTP 200 with null body) when no pending messages exist for the device user', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 1000 }),
        async (deviceUserId) => {
          // No pending messages
          prisma.message.findFirst.mockResolvedValue(null);

          const req = { device: { userId: deviceUserId } };
          let statusCode = null;
          let responseBody = 'NOT_SET';
          const res = {
            status(code) { statusCode = code; return this; },
            json(body) { responseBody = body; return this; },
          };

          await getPendingMessage(req, res);

          expect(statusCode).toBe(200);
          expect(responseBody).toBeNull();

          return true;
        }
      ),
      { numRuns: 50 }
    );
  });

  it('returns HTTP 401 when req.device is not present', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constant(undefined),
        async () => {
          const req = {}; // no req.device
          let statusCode = null;
          const res = {
            status(code) { statusCode = code; return this; },
            json() { return this; },
          };

          await getPendingMessage(req, res);

          expect(statusCode).toBe(401);

          return true;
        }
      ),
      { numRuns: 10 }
    );
  });
});

// Feature: sms-gateway-v2, Property 7: Pending Pickup Atomically Transitions to Dispatched

/**
 * Validates: Requirements 4.7, 4.8, 8.3
 *
 * Property 7: Pending Pickup Atomically Transitions to Dispatched.
 *
 * For any message with status = "pending", when it is returned by
 * getPendingMessage(), its status in the database SHALL be "dispatched"
 * and dispatched_at SHALL be set to a non-null timestamp.
 */
describe('v2 Property 7: Pending Pickup Atomically Transitions to Dispatched', () => {
  let getPendingMessage;

  beforeAll(() => {
    getPendingMessage = require('../messages.controller').getPendingMessage;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(async (fn) => fn(prisma));
  });

  it('after getPendingMessage, status is dispatched and dispatched_at is set', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 1000 }),  // userId
        fc.integer({ min: 1 }),              // messageId
        fc.date(),                           // created_at
        async (userId, messageId, createdAt) => {
          const pendingMessage = {
            id: messageId,
            user_id: userId,
            phone_number: '+15551234567',
            message_text: 'Test',
            status: 'pending',
            created_at: createdAt,
            dispatched_at: null,
          };

          let capturedUpdateData = null;
          const dispatchedAt = new Date();

          prisma.message.findFirst.mockResolvedValue(pendingMessage);
          prisma.message.update.mockImplementation(async ({ where, data }) => {
            capturedUpdateData = data;
            return {
              ...pendingMessage,
              status: data.status,
              dispatched_at: data.dispatched_at,
            };
          });

          const req = { device: { userId } };
          let statusCode = null;
          let responseBody = null;
          const res = {
            status(code) { statusCode = code; return this; },
            json(body) { responseBody = body; return this; },
          };

          const before = new Date();
          await getPendingMessage(req, res);
          const after = new Date();

          // 1. HTTP 200
          expect(statusCode).toBe(200);

          // 2. Returned message has status 'dispatched'
          expect(responseBody.status).toBe('dispatched');

          // 3. dispatched_at is set (non-null)
          expect(responseBody.dispatched_at).not.toBeNull();

          // 4. The update was called with status: 'dispatched' and a dispatched_at timestamp
          expect(capturedUpdateData).not.toBeNull();
          expect(capturedUpdateData.status).toBe('dispatched');
          expect(capturedUpdateData.dispatched_at).toBeInstanceOf(Date);

          // 5. The update was called with the correct message id
          expect(prisma.message.update).toHaveBeenCalledWith(
            expect.objectContaining({
              where: { id: messageId },
            })
          );

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: sms-gateway-v2, Property 12: Retry Resets Failed Messages to Pending

/**
 * Validates: Requirements 6.3
 *
 * Property 12: Retry Resets Failed Messages to Pending.
 *
 * For any message with status = "failed", calling retryMessage() with a valid
 * device token SHALL set the message's status to "pending" and return HTTP 200.
 * dispatched_at and delivered_at SHALL be cleared (null).
 */
describe('v2 Property 12: Retry Resets Failed Messages to Pending', () => {
  let retryMessage;

  beforeAll(() => {
    retryMessage = require('../messages.controller').retryMessage;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('resets a failed message to pending and clears timestamps', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 1000 }),  // userId
        fc.integer({ min: 1 }),              // messageId
        async (userId, messageId) => {
          const failedMessage = {
            id: messageId,
            user_id: userId,
            phone_number: '+15551234567',
            message_text: 'Test',
            status: 'failed',
            created_at: new Date(),
            dispatched_at: new Date(),
            delivered_at: new Date(),
          };

          let capturedUpdateData = null;

          prisma.message.findUnique.mockResolvedValue(failedMessage);
          prisma.message.update.mockImplementation(async ({ data }) => {
            capturedUpdateData = data;
            return {
              ...failedMessage,
              status: data.status,
              dispatched_at: data.dispatched_at,
              delivered_at: data.delivered_at,
            };
          });

          const req = {
            params: { id: String(messageId) },
            device: { userId },
          };
          let statusCode = null;
          let responseBody = null;
          const res = {
            status(code) { statusCode = code; return this; },
            json(body) { responseBody = body; return this; },
          };

          await retryMessage(req, res);

          // 1. HTTP 200
          expect(statusCode).toBe(200);

          // 2. Returned message has status 'pending'
          expect(responseBody.status).toBe('pending');

          // 3. dispatched_at and delivered_at are cleared
          expect(responseBody.dispatched_at).toBeNull();
          expect(responseBody.delivered_at).toBeNull();

          // 4. Update was called with correct data
          expect(capturedUpdateData).not.toBeNull();
          expect(capturedUpdateData.status).toBe('pending');
          expect(capturedUpdateData.dispatched_at).toBeNull();
          expect(capturedUpdateData.delivered_at).toBeNull();

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: sms-gateway-v2, Property 13: Retry Rejects Non-Failed Messages with 409

/**
 * Validates: Requirements 6.5
 *
 * Property 13: Retry Rejects Non-Failed Messages with 409.
 *
 * For any message with status in { pending, dispatched, sent }, calling
 * retryMessage() SHALL return HTTP 409.
 */
describe('v2 Property 13: Retry Rejects Non-Failed Messages with 409', () => {
  let retryMessage;

  beforeAll(() => {
    retryMessage = require('../messages.controller').retryMessage;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns HTTP 409 for any non-failed status', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 1000 }),                    // userId
        fc.integer({ min: 1 }),                                // messageId
        fc.constantFrom('pending', 'dispatched', 'sent'),      // non-failed status
        async (userId, messageId, status) => {
          const message = {
            id: messageId,
            user_id: userId,
            phone_number: '+15551234567',
            message_text: 'Test',
            status,
            created_at: new Date(),
          };

          prisma.message.findUnique.mockResolvedValue(message);

          const req = {
            params: { id: String(messageId) },
            device: { userId },
          };
          let statusCode = null;
          let responseBody = null;
          const res = {
            status(code) { statusCode = code; return this; },
            json(body) { responseBody = body; return this; },
          };

          await retryMessage(req, res);

          // Must return HTTP 409
          expect(statusCode).toBe(409);
          expect(responseBody).toHaveProperty('error');

          // update must NOT have been called
          expect(prisma.message.update).not.toHaveBeenCalled();

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('returns HTTP 404 when message belongs to a different user', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 500 }),   // deviceUserId
        fc.integer({ min: 501, max: 1000 }), // messageOwnerUserId (different)
        fc.integer({ min: 1 }),              // messageId
        async (deviceUserId, messageOwnerUserId, messageId) => {
          const message = {
            id: messageId,
            user_id: messageOwnerUserId, // belongs to a different user
            phone_number: '+15551234567',
            message_text: 'Test',
            status: 'failed',
            created_at: new Date(),
          };

          prisma.message.findUnique.mockResolvedValue(message);

          const req = {
            params: { id: String(messageId) },
            device: { userId: deviceUserId },
          };
          let statusCode = null;
          const res = {
            status(code) { statusCode = code; return this; },
            json() { return this; },
          };

          await retryMessage(req, res);

          // Must return HTTP 404 (not 403, to avoid leaking existence)
          expect(statusCode).toBe(404);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: sms-gateway-v2, Property 15: Status Transition Enforcement

/**
 * Validates: Requirements 8.1, 8.2
 *
 * Property 15: Status Transition Enforcement.
 *
 * Only valid transitions succeed:
 *   pending → dispatched  (via getPendingMessage)
 *   dispatched → sent     (via updateMessageStatus)
 *   dispatched → failed   (via updateMessageStatus)
 *   failed → pending      (via retryMessage)
 *
 * Any other transition via updateMessageStatus SHALL return HTTP 409.
 */
describe('v2 Property 15: Status Transition Enforcement', () => {
  let updateMessageStatus;

  beforeAll(() => {
    updateMessageStatus = require('../messages.controller').updateMessageStatus;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Valid transitions for updateMessageStatus: dispatched→sent, dispatched→failed
  const VALID_UPDATE_TRANSITIONS = [
    { from: 'dispatched', to: 'sent' },
    { from: 'dispatched', to: 'failed' },
  ];

  it('allows valid transitions (dispatched→sent, dispatched→failed) and returns HTTP 200', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1 }),
        fc.constantFrom(...VALID_UPDATE_TRANSITIONS),
        async (messageId, { from: fromStatus, to: toStatus }) => {
          const existingMessage = {
            id: messageId,
            user_id: 1,
            phone_number: '+15551234567',
            message_text: 'Hello',
            status: fromStatus,
            created_at: new Date(),
            updated_at: new Date('2020-01-01'),
          };

          prisma.message.findUnique.mockResolvedValue(existingMessage);
          prisma.message.update.mockResolvedValue({
            ...existingMessage,
            status: toStatus,
            updated_at: new Date(),
          });

          const req = {
            params: { id: String(messageId) },
            body: { status: toStatus },
          };
          let statusCode = null;
          let responseBody = null;
          const res = {
            status(code) { statusCode = code; return this; },
            json(body) { responseBody = body; return this; },
          };

          await updateMessageStatus(req, res);

          expect(statusCode).toBe(200);
          expect(responseBody.status).toBe(toStatus);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('rejects invalid transitions with HTTP 409', async () => {
    // All (from, to) pairs that are NOT in the valid set for updateMessageStatus
    const allStatuses = ['pending', 'dispatched', 'sent', 'failed'];
    const validToStatuses = ['sent', 'failed']; // updateMessageStatus only accepts these

    // Invalid transitions: any (from, to) where the transition is not allowed
    // For updateMessageStatus, valid = dispatched→sent, dispatched→failed
    // Invalid = anything else where to is 'sent' or 'failed' but from is not 'dispatched'
    const invalidTransitions = [];
    for (const from of allStatuses) {
      for (const to of validToStatuses) {
        if (!(from === 'dispatched')) {
          invalidTransitions.push({ from, to });
        }
      }
    }

    if (invalidTransitions.length === 0) return;

    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1 }),
        fc.constantFrom(...invalidTransitions),
        async (messageId, { from: fromStatus, to: toStatus }) => {
          const existingMessage = {
            id: messageId,
            user_id: 1,
            phone_number: '+15551234567',
            message_text: 'Hello',
            status: fromStatus,
            created_at: new Date(),
            updated_at: new Date(),
          };

          prisma.message.findUnique.mockResolvedValue(existingMessage);

          const req = {
            params: { id: String(messageId) },
            body: { status: toStatus },
          };
          let statusCode = null;
          const res = {
            status(code) { statusCode = code; return this; },
            json() { return this; },
          };

          await updateMessageStatus(req, res);

          // Invalid transitions must return HTTP 409
          expect(statusCode).toBe(409);

          // update must NOT have been called
          expect(prisma.message.update).not.toHaveBeenCalled();

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
