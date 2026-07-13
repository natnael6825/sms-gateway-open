'use strict';

const crypto = require('crypto');
const request = require('supertest');

jest.mock('../../prisma/client', () => ({
  apiKey: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  message: {
    create: jest.fn(),
    findFirst: jest.fn(),
  },
}));

const prisma = require('../../prisma/client');
const { sendSms } = require('../publicApi.controller');
const app = require('../../app');

const PUBLIC_ID = '88271e9c-72be-4d36-a42b-d9deab9cb1c8';

function responseRecorder() {
  return {
    statusCode: null,
    body: null,
    headers: {},
    status(code) { this.statusCode = code; return this; },
    set(name, value) { this.headers[name.toLowerCase()] = value; return this; },
    json(body) { this.body = body; return this; },
  };
}

describe('public SMS UUID and status API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.apiKey.update.mockResolvedValue({});
  });

  test('POST returns only the public UUID as id, plus its polling URL', async () => {
    prisma.message.create.mockResolvedValue({
      id: 127,
      public_id: PUBLIC_ID,
      status: 'pending',
    });
    const req = {
      baseUrl: '/api/v1',
      apiUser: { userId: 7, apiKeyId: 19 },
      body: { phone_number: '+15551234567', message_text: 'Hello' },
    };
    const res = responseRecorder();

    await sendSms(req, res);

    expect(res.statusCode).toBe(201);
    expect(res.body).toEqual({
      id: PUBLIC_ID,
      status: 'pending',
      status_url: `/api/v1/sms/${PUBLIC_ID}`,
    });
    expect(res.headers.location).toBe(`/api/v1/sms/${PUBLIC_ID}`);
    expect(res.body).not.toHaveProperty('internal_id');
  });

  test('GET is API-key authenticated and returns a non-cacheable pending lifecycle', async () => {
    const plaintext = 'sms_status_test_key';
    const keyHash = crypto.createHash('sha256').update(plaintext).digest('hex');
    const requestedAt = new Date('2026-07-13T10:00:00.000Z');
    const updatedAt = new Date('2026-07-13T10:00:01.000Z');

    prisma.apiKey.findUnique.mockResolvedValue({ id: 19, user_id: 7, key_hash: keyHash });
    prisma.message.findFirst.mockResolvedValue({
      public_id: PUBLIC_ID,
      phone_number: '+15551234567',
      status: 'pending',
      created_at: requestedAt,
      updated_at: updatedAt,
      dispatched_at: null,
      send_started_at: null,
      delivered_at: null,
      device: null,
    });

    const response = await request(app)
      .get(`/api/v1/sms/${PUBLIC_ID}`)
      .set('X-API-Key', plaintext);

    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.headers['retry-after']).toBe('2');
    expect(response.body).toEqual({
      id: PUBLIC_ID,
      status: 'pending',
      terminal: false,
      phone_number: '+15551234567',
      created_at: requestedAt.toISOString(),
      updated_at: updatedAt.toISOString(),
      dispatched_at: null,
      send_started_at: null,
      completed_at: null,
      device: null,
    });
    expect(prisma.message.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { public_id: PUBLIC_ID, api_key_id: 19 },
    }));
  });

  test('GET returns terminal delivery data without any numeric identifiers', async () => {
    const plaintext = 'sms_status_test_key';
    prisma.apiKey.findUnique.mockResolvedValue({ id: 19, user_id: 7 });
    prisma.message.findFirst.mockResolvedValue({
      public_id: PUBLIC_ID,
      phone_number: '+15551234567',
      status: 'sent',
      created_at: new Date('2026-07-13T10:00:00.000Z'),
      updated_at: new Date('2026-07-13T10:00:05.000Z'),
      dispatched_at: new Date('2026-07-13T10:00:01.000Z'),
      send_started_at: new Date('2026-07-13T10:00:02.000Z'),
      delivered_at: new Date('2026-07-13T10:00:05.000Z'),
      device: { name: 'Gateway phone', model: 'Pixel 8' },
    });

    const response = await request(app)
      .get(`/api/v1/sms/${PUBLIC_ID}`)
      .set('X-API-Key', plaintext);

    expect(response.status).toBe(200);
    expect(response.body.terminal).toBe(true);
    expect(response.body.completed_at).toBe('2026-07-13T10:00:05.000Z');
    expect(response.body).not.toHaveProperty('delivered_at');
    expect(response.body.device).toEqual({ name: 'Gateway phone', model: 'Pixel 8' });
    expect(response.body).not.toHaveProperty('internal_id');
    expect(response.body.device).not.toHaveProperty('id');
    expect(response.headers['retry-after']).toBeUndefined();
  });

  test('GET rejects a malformed UUID before querying messages', async () => {
    const plaintext = 'sms_status_test_key';
    prisma.apiKey.findUnique.mockResolvedValue({ id: 19, user_id: 7 });

    const response = await request(app)
      .get('/api/v1/sms/not-a-uuid')
      .set('X-API-Key', plaintext);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'Invalid message id' });
    expect(response.headers['cache-control']).toBe('no-store');
    expect(prisma.message.findFirst).not.toHaveBeenCalled();
  });

  test('GET hides missing messages and messages created by another key as 404', async () => {
    const plaintext = 'sms_status_test_key';
    prisma.apiKey.findUnique.mockResolvedValue({ id: 44, user_id: 7 });
    prisma.message.findFirst.mockResolvedValue(null);

    const response = await request(app)
      .get(`/api/v1/sms/${PUBLIC_ID}`)
      .set('X-API-Key', plaintext);

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'Message not found' });
    expect(prisma.message.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { public_id: PUBLIC_ID, api_key_id: 44 },
    }));
  });

  test('GET requires an API key', async () => {
    const response = await request(app).get(`/api/v1/sms/${PUBLIC_ID}`);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: 'Unauthorized' });
    expect(prisma.message.findFirst).not.toHaveBeenCalled();
  });
});
