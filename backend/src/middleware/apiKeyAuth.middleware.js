const crypto = require('crypto');
const prisma = require('../prisma/client');

/**
 * API Key authentication middleware.
 * Reads the X-API-Key header, computes its SHA-256 hash, and looks up
 * the matching ApiKey record in the database.
 * Attaches req.apiUser = { userId } on success.
 * Returns HTTP 401 with { "error": "Unauthorized" } if the header is missing
 * or the key is not found in the database.
 */
async function apiKeyAuthMiddleware(req, res, next) {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

  try {
    const record = await prisma.apiKey.findUnique({ where: { key_hash: keyHash } });

    if (!record) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    await prisma.apiKey.update({
      where: { id: record.id },
      data: { usage_count: { increment: 1 }, last_used_at: new Date() },
    });
    req.apiUser = { userId: record.user_id, apiKeyId: record.id };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

module.exports = apiKeyAuthMiddleware;
