'use strict';

jest.mock('../../prisma/client', () => ({
  apiKey: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
  },
  message: {
    groupBy: jest.fn(),
    count: jest.fn(),
    findMany: jest.fn(),
  },
}));

const prisma = require('../../prisma/client');
const { listApiKeys, getApiKeyDetails } = require('../user.controller');

function responseRecorder() {
  return {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

describe('API key delivery analytics', () => {
  beforeEach(() => jest.clearAllMocks());

  it('enriches the owner key list with isolated delivery counts', async () => {
    prisma.apiKey.findMany.mockResolvedValue([
      { id: 3, name: 'Orders', key_hint: 'sms_orders...', usage_count: 12, last_used_at: null, created_at: new Date() },
      { id: 4, name: 'Alerts', key_hint: 'sms_alerts...', usage_count: 2, last_used_at: null, created_at: new Date() },
    ]);
    prisma.message.groupBy.mockResolvedValue([
      { api_key_id: 3, status: 'sent', _count: { _all: 7 } },
      { api_key_id: 3, status: 'failed', _count: { _all: 1 } },
      { api_key_id: 3, status: 'pending', _count: { _all: 2 } },
      { api_key_id: 4, status: 'dispatched', _count: { _all: 1 } },
    ]);
    const res = responseRecorder();

    await listApiKeys({ user: { userId: 10 } }, res);

    expect(res.statusCode).toBe(200);
    expect(prisma.apiKey.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { user_id: 10 } }));
    expect(prisma.message.groupBy).toHaveBeenCalledWith(expect.objectContaining({
      where: { user_id: 10, api_key_id: { in: [3, 4] } },
    }));
    expect(res.body[0]).toEqual(expect.objectContaining({
      message_count: 10,
      sent_count: 7,
      failed_count: 1,
      pending_count: 2,
      dispatched_count: 0,
      in_progress_count: 2,
      success_rate: 87.5,
    }));
    expect(res.body[1]).toEqual(expect.objectContaining({
      message_count: 1,
      dispatched_count: 1,
      success_rate: null,
    }));
  });

  it('returns owner-scoped key metadata, delivery totals, activity, and recent messages', async () => {
    const createdAt = new Date();
    const dayKey = createdAt.toISOString().slice(0, 10);
    const apiKey = {
      id: 3,
      name: 'Orders',
      key_hint: 'sms_orders...',
      usage_count: 12,
      last_used_at: createdAt,
      created_at: createdAt,
      updated_at: createdAt,
    };
    const recentMessage = {
      id: 51,
      phone_number: '+15551234567',
      message_text: 'Ready',
      status: 'sent',
      source: 'api',
      created_at: createdAt,
      updated_at: createdAt,
      dispatched_at: createdAt,
      send_started_at: createdAt,
      delivered_at: createdAt,
      device: { id: 8, name: 'Pixel', model: 'Pixel 8' },
    };

    prisma.apiKey.findFirst.mockResolvedValue(apiKey);
    prisma.message.groupBy.mockResolvedValue([
      { status: 'sent', _count: { _all: 7 } },
      { status: 'failed', _count: { _all: 1 } },
      { status: 'pending', _count: { _all: 2 } },
      { status: 'dispatched', _count: { _all: 1 } },
    ]);
    prisma.message.count.mockResolvedValue(3);
    prisma.message.findMany
      .mockResolvedValueOnce([
        { status: 'sent', created_at: createdAt },
        { status: 'failed', created_at: createdAt },
      ])
      .mockResolvedValueOnce([recentMessage]);
    const res = responseRecorder();

    await getApiKeyDetails({ user: { userId: 10 }, params: { id: '3' } }, res);

    expect(res.statusCode).toBe(200);
    expect(prisma.apiKey.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 3, user_id: 10 },
    }));
    expect(prisma.message.groupBy).toHaveBeenCalledWith(expect.objectContaining({
      where: { user_id: 10, api_key_id: 3 },
    }));
    expect(res.body.api_key).toEqual(apiKey);
    expect(res.body.stats).toEqual({
      authenticated_requests: 12,
      message_count: 11,
      sent: 7,
      failed: 1,
      pending: 2,
      dispatched: 1,
      in_progress: 3,
      sent_today: 3,
      success_rate: 87.5,
    });
    expect(res.body.daily_activity).toHaveLength(7);
    expect(res.body.daily_activity.find((day) => day.date === dayKey)).toEqual({
      date: dayKey,
      queued: 2,
      sent: 1,
      failed: 1,
    });
    expect(res.body.messages).toEqual([recentMessage]);
  });

  it('does not expose a key owned by another user', async () => {
    prisma.apiKey.findFirst.mockResolvedValue(null);
    const res = responseRecorder();

    await getApiKeyDetails({ user: { userId: 10 }, params: { id: '999' } }, res);

    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ error: 'API key not found' });
    expect(prisma.apiKey.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 999, user_id: 10 },
    }));
    expect(prisma.message.groupBy).not.toHaveBeenCalled();
  });
});
