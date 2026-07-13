// Feature: sms-gateway-v2, Property 9: Analytics Summary Counts Are Accurate

'use strict';

const fc = require('fast-check');

// Mock the Prisma client before requiring the controller
jest.mock('../../prisma/client', () => ({
  message: {
    groupBy: jest.fn(),
  },
}));

const prisma = require('../../prisma/client');
const { getSummary } = require('../analytics.controller');

/**
 * Validates: Requirements 5.4
 *
 * Property 9: Analytics Summary Counts Are Accurate.
 *
 * For any user with a known distribution of message statuses, getSummary()
 * returns counts that exactly match the number of messages in each status
 * for that user. Messages belonging to other users are NOT included.
 */
describe('Property 9: Analytics Summary Counts Are Accurate', () => {
  const STATUSES = ['pending', 'dispatched', 'sent', 'failed'];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns exact counts matching the groupBy result for the authenticated user', async () => {
    // Generator: produce a count for each status (0 to 50)
    const statusCountsArb = fc.record({
      pending: fc.integer({ min: 0, max: 50 }),
      dispatched: fc.integer({ min: 0, max: 50 }),
      sent: fc.integer({ min: 0, max: 50 }),
      failed: fc.integer({ min: 0, max: 50 }),
    });

    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 1000 }), // userId
        statusCountsArb,
        async (userId, counts) => {
          // Build the Prisma groupBy response — only include statuses with count > 0
          // to simulate realistic Prisma behaviour (missing rows = 0 messages)
          const groupByResult = STATUSES
            .filter((s) => counts[s] > 0)
            .map((s) => ({
              status: s,
              _count: { _all: counts[s] },
            }));

          prisma.message.groupBy.mockResolvedValue(groupByResult);

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

          await getSummary(req, res);

          // 1. HTTP 200
          expect(statusCode).toBe(200);

          // 2. Each status count must exactly match the generated distribution
          expect(responseBody.pending).toBe(counts.pending);
          expect(responseBody.dispatched).toBe(counts.dispatched);
          expect(responseBody.sent).toBe(counts.sent);
          expect(responseBody.failed).toBe(counts.failed);

          // 3. groupBy was called with the correct user_id scope
          expect(prisma.message.groupBy).toHaveBeenCalledWith(
            expect.objectContaining({
              where: expect.objectContaining({ user_id: userId }),
            })
          );

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('defaults all counts to 0 when no messages exist for the user', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 1000 }), // userId
        async (userId) => {
          // Prisma returns an empty array when no messages exist
          prisma.message.groupBy.mockResolvedValue([]);

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

          await getSummary(req, res);

          expect(statusCode).toBe(200);
          expect(responseBody).toEqual({
            pending: 0,
            dispatched: 0,
            sent: 0,
            failed: 0,
          });

          return true;
        }
      ),
      { numRuns: 50 }
    );
  });

  it('does not include counts from other users (groupBy is scoped by user_id)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 500 }),   // userId (the requesting user)
        fc.integer({ min: 501, max: 1000 }), // otherUserId (guaranteed distinct from userId)
        fc.integer({ min: 1, max: 50 }),     // count for the requesting user
        fc.integer({ min: 1, max: 50 }),     // count that belongs to the other user (should NOT be queried)
        async (userId, otherUserId, userCount, otherCount) => {
          // Clear mock call history before each fc iteration
          prisma.message.groupBy.mockClear();

          // Track which user_ids groupBy was called with
          const calledWithUserIds = [];

          // The mock simulates Prisma's WHERE clause — returns data scoped to the queried user_id.
          prisma.message.groupBy.mockImplementation(async ({ where }) => {
            calledWithUserIds.push(where.user_id);
            if (where.user_id === userId) {
              return [{ status: 'sent', _count: { _all: userCount } }];
            }
            return [{ status: 'sent', _count: { _all: otherCount } }];
          });

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

          await getSummary(req, res);

          expect(statusCode).toBe(200);

          // The response must reflect only the requesting user's count
          expect(responseBody.sent).toBe(userCount);

          // groupBy must have been called exactly once, with the requesting user's id
          expect(prisma.message.groupBy).toHaveBeenCalledTimes(1);
          expect(calledWithUserIds).toEqual([userId]);

          // groupBy must NOT have been called with the other user's id
          expect(calledWithUserIds).not.toContain(otherUserId);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
