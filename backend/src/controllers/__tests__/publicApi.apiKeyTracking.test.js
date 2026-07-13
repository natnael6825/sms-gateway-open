'use strict';

jest.mock('../../prisma/client', () => ({
  message: { create: jest.fn() },
}));

const prisma = require('../../prisma/client');
const { sendSms } = require('../publicApi.controller');

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

describe('public API key message attribution', () => {
  beforeEach(() => jest.clearAllMocks());

  it('stores the exact authenticated API key on an accepted SMS', async () => {
    prisma.message.create.mockImplementation(async ({ data }) => ({
      id: 42,
      public_id: '88271e9c-72be-4d36-a42b-d9deab9cb1c8',
      ...data,
    }));
    const req = {
      apiUser: { userId: 7, apiKeyId: 19 },
      body: { phone_number: '+15551234567', message_text: 'Hello' },
    };
    const res = responseRecorder();

    await sendSms(req, res);

    expect(res.statusCode).toBe(201);
    expect(prisma.message.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        user_id: 7,
        api_key_id: 19,
        status: 'pending',
        source: 'api',
      }),
    });
  });
});
