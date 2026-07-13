'use strict';

const prisma = require('../prisma/client');

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function publicStatusUrl(req, publicId) {
  const apiBase = req.baseUrl || '/api/v1';
  return `${apiBase}/sms/${publicId}`;
}

/**
 * POST /api/v1/sms/send
 * Authenticated via apiKeyAuthMiddleware (req.apiUser.userId).
 * Validates phone_number and message_text, creates a pending message
 * with source = 'api'.
 * Returns 201 with { id, status, status_url } on success.
 * Returns 400 if phone_number or message_text is missing.
 * Returns 422 if message_text exceeds 1600 characters.
 */
async function sendSms(req, res) {
  const { phone_number, message_text } = req.body;

  if (!phone_number) {
    return res.status(400).json({ error: 'phone_number is required' });
  }

  if (!message_text) {
    return res.status(400).json({ error: 'message_text is required' });
  }

  if (message_text.length > 1600) {
    return res.status(422).json({ error: 'message_text must be 1600 characters or fewer' });
  }

  try {
    const message = await prisma.message.create({
      data: {
        phone_number,
        message_text,
        status: 'pending',
        source: 'api',
        user_id: req.apiUser.userId,
        api_key_id: req.apiUser.apiKeyId,
      },
    });

    const statusUrl = publicStatusUrl(req, message.public_id);
    if (typeof res.set === 'function') res.set('Location', statusUrl);

    return res.status(201).json({
      id: message.public_id,
      status: message.status,
      status_url: statusUrl,
    });
  } catch (err) {
    console.error('sendSms error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * GET /api/v1/sms/:id
 * Returns the delivery lifecycle for a message created with the exact API key
 * authenticating this request. The internal integer identifiers used by the
 * Android protocol are deliberately never exposed here.
 */
async function getSmsStatus(req, res) {
  const publicId = typeof req.params.id === 'string' ? req.params.id.trim().toLowerCase() : '';

  res.set('Cache-Control', 'no-store');

  if (!UUID_PATTERN.test(publicId)) {
    return res.status(400).json({ error: 'Invalid message id' });
  }

  try {
    const message = await prisma.message.findFirst({
      where: {
        public_id: publicId,
        api_key_id: req.apiUser.apiKeyId,
      },
      select: {
        public_id: true,
        phone_number: true,
        status: true,
        created_at: true,
        updated_at: true,
        dispatched_at: true,
        send_started_at: true,
        delivered_at: true,
        device: { select: { name: true, model: true } },
      },
    });

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    const terminal = message.status === 'sent' || message.status === 'failed';
    if (!terminal) res.set('Retry-After', '2');

    return res.status(200).json({
      id: message.public_id,
      status: message.status,
      terminal,
      phone_number: message.phone_number,
      created_at: message.created_at,
      updated_at: message.updated_at,
      dispatched_at: message.dispatched_at,
      send_started_at: message.send_started_at,
      completed_at: message.delivered_at,
      device: message.device,
    });
  } catch (err) {
    console.error('getSmsStatus error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { sendSms, getSmsStatus };
