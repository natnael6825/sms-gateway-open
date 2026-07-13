'use strict';

jest.mock('../../prisma/client', () => ({
  message: {
    groupBy: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  device: {
    updateMany: jest.fn(),
    findMany: jest.fn(),
  },
}));

const prisma = require('../../prisma/client');
const { getOverview } = require('../analytics.controller');

function buildReqRes(query = {}) {
  const req = { query, user: { userId: 42 } };
  let statusCode;
  let responseBody;
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
  return { req, res, response: () => ({ statusCode, responseBody }) };
}

function mockEmptyOverview() {
  prisma.device.updateMany.mockResolvedValue({ count: 0 });
  prisma.message.groupBy.mockResolvedValue([]);
  prisma.message.findMany.mockResolvedValue([]);
  prisma.message.count.mockResolvedValue(0);
  prisma.device.findMany.mockResolvedValue([]);
}

describe('getOverview', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-13T12:00:00.000Z'));
    jest.clearAllMocks();
    mockEmptyOverview();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns unfiltered totals and buckets requested/completed activity at local date boundaries', async () => {
    prisma.message.groupBy.mockResolvedValue([
      { status: 'pending', _count: { _all: 2 } },
      { status: 'dispatched', _count: { _all: 1 } },
      { status: 'sent', _count: { _all: 10 } },
      { status: 'failed', _count: { _all: 3 } },
    ]);
    prisma.message.findMany
      .mockResolvedValueOnce([
        { created_at: new Date('2026-07-11T21:30:00.000Z') }, // July 12 at UTC+3
        { created_at: new Date('2026-07-12T21:30:00.000Z') }, // July 13 at UTC+3
        { created_at: new Date('2026-07-13T20:59:59.000Z') }, // July 13 at UTC+3
      ])
      .mockResolvedValueOnce([
        { status: 'sent', delivered_at: new Date('2026-07-11T23:00:00.000Z') },
        { status: 'sent', delivered_at: new Date('2026-07-12T22:00:00.000Z') },
        { status: 'failed', delivered_at: new Date('2026-07-13T20:00:00.000Z') },
      ]);
    prisma.message.count.mockResolvedValue(5);
    prisma.device.findMany.mockResolvedValue([
      {
        id: 7,
        name: 'Galaxy sender',
        model: 'SM-A356E',
        is_connected: true,
        last_seen: new Date('2026-07-13T11:59:30.000Z'),
        messages_sent: 84,
      },
    ]);

    const { req, res, response } = buildReqRes({
      from: '2026-07-12',
      to: '2026-07-13',
      timezone_offset: '180',
    });
    await getOverview(req, res);

    expect(response()).toEqual({
      statusCode: 200,
      responseBody: {
        pending: 2,
        dispatched: 1,
        sent: 10,
        failed: 3,
        total: 16,
        sent_today: 5,
        period: {
          from: '2026-07-12',
          to: '2026-07-13',
          timezone_offset: 180,
          requested: 3,
          sent: 2,
          failed: 1,
          completed: 3,
        },
        daily: [
          { date: '2026-07-12', requested: 1, sent: 1, failed: 0 },
          { date: '2026-07-13', requested: 2, sent: 1, failed: 1 },
        ],
        devices: {
          total: 1,
          connected: 1,
          offline: 0,
          live: [{
            id: 7,
            name: 'Galaxy sender',
            model: 'SM-A356E',
            last_seen: new Date('2026-07-13T11:59:30.000Z'),
            messages_sent: 84,
          }],
        },
      },
    });

    expect(prisma.message.findMany).toHaveBeenNthCalledWith(1, {
      where: {
        user_id: 42,
        created_at: {
          gte: new Date('2026-07-11T21:00:00.000Z'),
          lt: new Date('2026-07-13T21:00:00.000Z'),
        },
      },
      select: { created_at: true },
    });
    expect(prisma.message.count).toHaveBeenCalledWith({
      where: {
        user_id: 42,
        status: 'sent',
        delivered_at: {
          gte: new Date('2026-07-12T21:00:00.000Z'),
          lt: new Date('2026-07-13T21:00:00.000Z'),
        },
      },
    });
  });

  it('reports only active phones with a fresh heartbeat as connected', async () => {
    prisma.device.findMany.mockResolvedValue([
      {
        id: 1, name: 'Live phone', model: 'A', is_connected: true,
        last_seen: new Date('2026-07-13T11:59:30.000Z'), messages_sent: 9,
      },
      {
        id: 2, name: 'Stale phone', model: 'B', is_connected: true,
        last_seen: new Date('2026-07-13T11:58:59.000Z'), messages_sent: 4,
      },
      {
        id: 3, name: 'Offline phone', model: 'C', is_connected: false,
        last_seen: new Date('2026-07-13T12:00:00.000Z'), messages_sent: 2,
      },
      {
        id: 4, name: 'Never seen', model: 'D', is_connected: true,
        last_seen: null, messages_sent: 0,
      },
    ]);

    const { req, res, response } = buildReqRes({ from: '2026-07-13', timezone_offset: '0' });
    await getOverview(req, res);

    expect(response().statusCode).toBe(200);
    expect(response().responseBody.devices).toEqual({
      total: 4,
      connected: 1,
      offline: 3,
      live: [{
        id: 1,
        name: 'Live phone',
        model: 'A',
        last_seen: new Date('2026-07-13T11:59:30.000Z'),
        messages_sent: 9,
      }],
    });
    expect(prisma.device.updateMany).toHaveBeenCalledWith({
      where: {
        user_id: 42,
        is_active: true,
        is_connected: true,
        OR: [
          { last_seen: null },
          { last_seen: { lt: new Date('2026-07-13T11:59:00.000Z') } },
        ],
      },
      data: { is_connected: false },
    });
    expect(prisma.device.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { user_id: 42, is_active: true },
    }));
  });

  it('defaults to the seven local calendar days ending today', async () => {
    const { req, res, response } = buildReqRes({ timezone_offset: '180' });
    await getOverview(req, res);

    expect(response().statusCode).toBe(200);
    expect(response().responseBody.period).toEqual(expect.objectContaining({
      from: '2026-07-07',
      to: '2026-07-13',
      timezone_offset: 180,
    }));
    expect(response().responseBody.daily).toHaveLength(7);
  });

  it.each([
    [{ from: '2026/07/13' }, 'from must use YYYY-MM-DD format'],
    [{ from: '2026-02-30' }, 'from must be a valid calendar date'],
    [{ from: '2026-07-14', to: '2026-07-13' }, 'from must be on or before to'],
    [{ from: '2026-01-01', to: '2026-04-01' }, 'Date range cannot exceed 90 days'],
    [{ timezone_offset: '180.5' }, 'timezone_offset must be an integer number of minutes east of UTC'],
    [{ timezone_offset: '841' }, 'timezone_offset must be between -840 and 840 minutes east of UTC'],
  ])('returns 400 without querying Prisma for invalid filters: %o', async (query, error) => {
    jest.clearAllMocks();
    const { req, res, response } = buildReqRes(query);
    await getOverview(req, res);

    expect(response()).toEqual({ statusCode: 400, responseBody: { error } });
    expect(prisma.message.groupBy).not.toHaveBeenCalled();
    expect(prisma.device.updateMany).not.toHaveBeenCalled();
  });
});
