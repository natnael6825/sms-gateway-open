'use strict';

jest.mock('../../prisma/client', () => ({
  message: {
    count: jest.fn(),
    findMany: jest.fn(),
  },
}));

const prisma = require('../../prisma/client');
const { getUserMessages } = require('../messages.controller');

function createResponse() {
  return {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

async function listMessages({ userId = 42, query } = {}) {
  const req = { user: { userId } };
  if (query !== undefined) req.query = query;
  const res = createResponse();
  await getUserMessages(req, res);
  return res;
}

describe('getUserMessages pagination', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('preserves the legacy array response when pagination and status are omitted', async () => {
    const messages = [{ id: 9, user_id: 42 }];
    prisma.message.findMany.mockResolvedValue(messages);

    const res = await listMessages();

    expect(res.statusCode).toBe(200);
    expect(res.body).toBe(messages);
    expect(prisma.message.count).not.toHaveBeenCalled();
    expect(prisma.message.findMany).toHaveBeenCalledWith({
      where: { user_id: 42 },
      orderBy: { created_at: 'desc' },
      include: { device: { select: { id: true, name: true, model: true } } },
    });
  });

  test('returns one owner-scoped page with stable newest-first ordering and metadata', async () => {
    const messages = [
      { id: 44, user_id: 42, device: { id: 3, name: 'Pixel', model: 'Pixel 8' } },
      { id: 43, user_id: 42, device: null },
    ];
    prisma.message.count.mockResolvedValue(45);
    prisma.message.findMany.mockResolvedValue(messages);

    const res = await listMessages({ query: { page: '3', page_size: '20' } });

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      messages,
      pagination: {
        page: 3,
        page_size: 20,
        total: 45,
        total_pages: 3,
        has_previous: true,
        has_next: false,
      },
    });
    expect(prisma.message.count).toHaveBeenCalledWith({ where: { user_id: 42 } });
    expect(prisma.message.findMany).toHaveBeenCalledWith({
      where: { user_id: 42 },
      orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
      skip: 40,
      take: 20,
      include: { device: { select: { id: true, name: true, model: true } } },
    });
  });

  test('filters both the count and page by status and authenticated user', async () => {
    prisma.message.count.mockImplementation(async ({ where }) => {
      expect(where).toEqual({ user_id: 17, status: 'failed' });
      return 1;
    });
    prisma.message.findMany.mockImplementation(async ({ where }) => {
      expect(where).toEqual({ user_id: 17, status: 'failed' });
      return [{ id: 7, user_id: 17, status: 'failed' }];
    });

    const res = await listMessages({ userId: 17, query: { status: 'failed' } });

    expect(res.statusCode).toBe(200);
    expect(res.body.messages).toEqual([{ id: 7, user_id: 17, status: 'failed' }]);
    expect(res.body.pagination).toEqual({
      page: 1,
      page_size: 20,
      total: 1,
      total_pages: 1,
      has_previous: false,
      has_next: false,
    });
  });

  test('treats status=all as unfiltered and applies pagination defaults', async () => {
    prisma.message.count.mockResolvedValue(21);
    prisma.message.findMany.mockResolvedValue([]);

    const res = await listMessages({ userId: 8, query: { status: 'all' } });

    expect(res.statusCode).toBe(200);
    expect(prisma.message.count).toHaveBeenCalledWith({ where: { user_id: 8 } });
    expect(prisma.message.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { user_id: 8 },
      skip: 0,
      take: 20,
    }));
    expect(res.body.pagination.has_next).toBe(true);
  });

  test.each([
    [{ page: '0' }, 'page must be a positive integer'],
    [{ page: '-1' }, 'page must be a positive integer'],
    [{ page: '1.5' }, 'page must be a positive integer'],
    [{ page: 'abc' }, 'page must be a positive integer'],
    [{ page: ['1', '2'] }, 'page must be a positive integer'],
    [{ page_size: '0' }, 'page_size must be an integer between 1 and 100'],
    [{ page_size: '101' }, 'page_size must be an integer between 1 and 100'],
    [{ page_size: '2.5' }, 'page_size must be an integer between 1 and 100'],
    [{ page_size: 'abc' }, 'page_size must be an integer between 1 and 100'],
    [{ status: 'queued' }, 'status must be one of: all, pending, dispatched, sent, failed'],
    [{ status: '' }, 'status must be one of: all, pending, dispatched, sent, failed'],
    [{ status: ['sent', 'failed'] }, 'status must be one of: all, pending, dispatched, sent, failed'],
  ])('rejects invalid query %# without touching Prisma', async (query, error) => {
    const res = await listMessages({ query });

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error });
    expect(prisma.message.count).not.toHaveBeenCalled();
    expect(prisma.message.findMany).not.toHaveBeenCalled();
  });
});
