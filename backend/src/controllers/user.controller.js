'use strict';

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const prisma = require('../prisma/client');

/**
 * Compute SHA-256 hash of a string, returning hex digest.
 * @param {string} value
 * @returns {string}
 */
function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

/**
 * Generate a new API key plaintext: 'sms_' + 32 lowercase hex chars (128 bits entropy).
 * @returns {string}
 */
function generateApiKeyPlaintext() {
  return 'sms_' + crypto.randomBytes(16).toString('hex');
}

/**
 * Derive a masked representation from the plaintext key.
 * Shows 'sms_' + first 8 chars of the hex portion + '...'
 * @param {string} plaintext  e.g. 'sms_a1b2c3d4e5f6...'
 * @returns {string}
 */
function maskFromPlaintext(plaintext) {
  // plaintext is 'sms_' + 32 hex chars; take first 8 hex chars after prefix
  return 'sms_' + plaintext.slice(4, 12) + '...';
}

/**
 * Derive a masked representation from the stored key_hash.
 * Since we can't recover the plaintext, we use the first 8 chars of the hash.
 * @param {string} keyHash  SHA-256 hex digest
 * @returns {string}
 */
function maskFromHash(keyHash) {
  return 'sms_' + keyHash.substring(0, 8) + '...';
}

/**
 * GET /api/user/api-key
 *
 * If no ApiKey record exists for the authenticated user, generate one and return
 * the plaintext key (once only) along with the masked version.
 * If a record already exists, return only the masked version.
 *
 * Requires: req.user.userId (set by authMiddleware)
 */
async function getOrCreateApiKey(req, res) {
  const userId = req.user.userId;

  try {
    const existing = await prisma.apiKey.findUnique({
      where: { user_id: userId },
    });

    if (!existing) {
      // Generate new key
      const plaintext = generateApiKeyPlaintext();
      const keyHash = sha256(plaintext);
      const masked = maskFromPlaintext(plaintext);

      await prisma.apiKey.create({
        data: {
          user_id: userId,
          key_hash: keyHash,
        },
      });

      return res.status(200).json({ key: plaintext, masked });
    }

    // Key already exists — return masked only
    const masked = maskFromHash(existing.key_hash);
    return res.status(200).json({ masked });
  } catch (err) {
    console.error('getOrCreateApiKey error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * POST /api/user/api-key/regenerate
 *
 * Generate a new API key, replacing any existing one.
 * Returns the new plaintext key and masked version.
 *
 * Requires: req.user.userId (set by authMiddleware)
 */
async function regenerateApiKey(req, res) {
  const userId = req.user.userId;

  try {
    const plaintext = generateApiKeyPlaintext();
    const keyHash = sha256(plaintext);
    const masked = maskFromPlaintext(plaintext);

    // Upsert: update if exists, create if not
    await prisma.apiKey.upsert({
      where: { user_id: userId },
      update: { key_hash: keyHash },
      create: { user_id: userId, key_hash: keyHash },
    });

    return res.status(200).json({ key: plaintext, masked });
  } catch (err) {
    console.error('regenerateApiKey error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function listApiKeys(req, res) {
  const userId = req.user.userId;
  try {
    const keys = await prisma.apiKey.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
      select: { id: true, name: true, key_hint: true, usage_count: true, last_used_at: true, created_at: true },
    });

    const statusCounts = keys.length
      ? await prisma.message.groupBy({
          by: ['api_key_id', 'status'],
          where: { user_id: userId, api_key_id: { in: keys.map((key) => key.id) } },
          _count: { _all: true },
        })
      : [];

    const enriched = keys.map((key) => {
      const count = (status) => statusCounts.find(
        (row) => row.api_key_id === key.id && row.status === status
      )?._count._all || 0;
      const pending = count('pending');
      const dispatched = count('dispatched');
      const sent = count('sent');
      const failed = count('failed');
      const finalized = sent + failed;

      return {
        ...key,
        message_count: pending + dispatched + sent + failed,
        sent_count: sent,
        failed_count: failed,
        pending_count: pending,
        dispatched_count: dispatched,
        in_progress_count: pending + dispatched,
        success_rate: finalized ? Math.round((sent / finalized) * 1000) / 10 : null,
      };
    });

    return res.status(200).json(enriched);
  } catch (error) {
    console.error('listApiKeys error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * GET /api/user/api-keys/:id
 * Returns delivery analytics for one API key owned by the signed-in owner.
 * `usage_count` / `authenticated_requests` includes every authenticated call,
 * including calls that later fail request validation. Message counts only
 * include accepted SMS requests that were written to the queue.
 */
async function getApiKeyDetails(req, res) {
  const userId = req.user.userId;
  const apiKeyId = Number(req.params.id);

  if (!Number.isInteger(apiKeyId) || apiKeyId <= 0) {
    return res.status(400).json({ error: 'Invalid API key id' });
  }

  try {
    const apiKey = await prisma.apiKey.findFirst({
      where: { id: apiKeyId, user_id: userId },
      select: {
        id: true,
        name: true,
        key_hint: true,
        usage_count: true,
        last_used_at: true,
        created_at: true,
        updated_at: true,
      },
    });

    if (!apiKey) return res.status(404).json({ error: 'API key not found' });

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 6);
    const messageScope = { user_id: userId, api_key_id: apiKeyId };

    const [statusCounts, sentToday, chartMessages, recentMessages] = await Promise.all([
      prisma.message.groupBy({
        by: ['status'],
        where: messageScope,
        _count: { _all: true },
      }),
      prisma.message.count({
        where: { ...messageScope, status: 'sent', delivered_at: { gte: today } },
      }),
      prisma.message.findMany({
        where: { ...messageScope, created_at: { gte: sevenDaysAgo } },
        select: { status: true, created_at: true },
      }),
      prisma.message.findMany({
        where: messageScope,
        orderBy: { created_at: 'desc' },
        take: 100,
        select: {
          id: true,
          public_id: true,
          phone_number: true,
          message_text: true,
          status: true,
          source: true,
          created_at: true,
          updated_at: true,
          dispatched_at: true,
          send_started_at: true,
          delivered_at: true,
          device: { select: { id: true, name: true, model: true } },
        },
      }),
    ]);

    const count = (status) => statusCounts.find((row) => row.status === status)?._count._all || 0;
    const pending = count('pending');
    const dispatched = count('dispatched');
    const sent = count('sent');
    const failed = count('failed');
    const messageCount = pending + dispatched + sent + failed;
    const finalized = sent + failed;

    const dailyActivity = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(sevenDaysAgo);
      date.setUTCDate(sevenDaysAgo.getUTCDate() + index);
      const dateKey = date.toISOString().slice(0, 10);
      const messages = chartMessages.filter(
        (message) => message.created_at.toISOString().slice(0, 10) === dateKey
      );
      return {
        date: dateKey,
        queued: messages.length,
        sent: messages.filter((message) => message.status === 'sent').length,
        failed: messages.filter((message) => message.status === 'failed').length,
      };
    });

    return res.status(200).json({
      api_key: apiKey,
      stats: {
        authenticated_requests: apiKey.usage_count,
        message_count: messageCount,
        sent,
        failed,
        pending,
        dispatched,
        in_progress: pending + dispatched,
        sent_today: sentToday,
        success_rate: finalized ? Math.round((sent / finalized) * 1000) / 10 : null,
      },
      daily_activity: dailyActivity,
      messages: recentMessages,
    });
  } catch (error) {
    console.error('getApiKeyDetails error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function createApiKey(req, res) {
  const name = typeof req.body?.name === 'string' && req.body.name.trim()
    ? req.body.name.trim().slice(0, 60)
    : 'API key';
  try {
    const plaintext = generateApiKeyPlaintext();
    const created = await prisma.apiKey.create({
      data: { user_id: req.user.userId, key_hash: sha256(plaintext), key_hint: maskFromPlaintext(plaintext), name },
      select: { id: true, name: true, key_hint: true, usage_count: true, last_used_at: true, created_at: true },
    });
    return res.status(201).json({ ...created, key: plaintext });
  } catch (error) {
    console.error('createApiKey error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * POST /api/user/pairing-code
 *
 * Returns the user's permanent device key (7-char uppercase alphanumeric).
 * Generates one if it doesn't exist yet.
 *
 * Requires: req.user.userId (set by authMiddleware)
 */
async function getOrCreateDeviceKey(req, res) {
  const userId = req.user.userId;

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.device_key) {
      return res.status(200).json({ code: user.device_key });
    }

    // Generate a new 7-char uppercase alphanumeric key
    const key = generateDeviceKey();

    await prisma.user.update({
      where: { id: userId },
      data: { device_key: key },
    });

    return res.status(200).json({ code: key });
  } catch (err) {
    console.error('getOrCreateDeviceKey error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * POST /api/user/device-key/reset
 *
 * Generates a new device key, invalidating the old one.
 * Any phones using the old key will need to re-pair.
 *
 * Requires: req.user.userId (set by authMiddleware)
 */
async function resetDeviceKey(req, res) {
  const userId = req.user.userId;

  if (req.body?.acknowledged !== true || req.body?.confirmation !== 'RESET ALL DEVICES') {
    return res.status(400).json({
      error: 'Reset requires device-disconnection acknowledgement and the exact confirmation phrase.',
      code: 'RESET_CONFIRMATION_REQUIRED',
    });
  }

  try {
    const key = generateDeviceKey();

    await prisma.$transaction([
      prisma.user.update({ where: { id: userId }, data: { device_key: key } }),
      prisma.device.updateMany({ where: { user_id: userId }, data: { is_active: false, is_connected: false } }),
    ]);

    return res.status(200).json({ code: key });
  } catch (err) {
    console.error('resetDeviceKey error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Generate a 7-char uppercase alphanumeric device key.
 * @returns {string}
 */
function generateDeviceKey() {
  const CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = crypto.randomBytes(7);
  return Array.from(bytes).map(b => CHARSET[b % CHARSET.length]).join('');
}

/**
 * GET /api/user/profile
 * Returns basic profile info for the authenticated user.
 */
async function getProfile(req, res) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { id: true, email: true, must_change_password: true, created_at: true },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.status(200).json(user);
  } catch (err) {
    console.error('getProfile error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * POST /api/user/change-password
 * Body: { currentPassword, newPassword }
 */
async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'currentPassword and newPassword are required' });
  }

  if (newPassword.length < 12) {
    return res.status(400).json({ error: 'New password must be at least 12 characters' });
  }

  try {
    const bcrypt = require('bcrypt');
    const user = await prisma.user.findUnique({ where: { id: req.user.userId } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) return res.status(400).json({ error: 'Current password is incorrect' });

    const hashed = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: user.id }, data: { password: hashed, must_change_password: false } });

    const token = jwt.sign({ userId: user.id, mustChangePassword: false }, process.env.JWT_SECRET, { expiresIn: '7d' });
    return res.status(200).json({ ok: true, token });
  } catch (err) {
    console.error('changePassword error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = {
  listApiKeys,
  getApiKeyDetails,
  createApiKey,
  getOrCreateApiKey,
  regenerateApiKey,
  getOrCreateDeviceKey,
  resetDeviceKey,
  getProfile,
  changePassword,
  generateApiKeyPlaintext,
  generateDeviceKey,
  sha256,
  maskFromPlaintext,
  maskFromHash,
};
