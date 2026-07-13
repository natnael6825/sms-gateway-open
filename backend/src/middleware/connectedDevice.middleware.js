'use strict';

const prisma = require('../prisma/client');

/**
 * Blocks message creation unless the owner has an active phone that has been
 * seen in the last 60 seconds. Runs after JWT or API-key authentication.
 */
async function connectedDeviceMiddleware(req, res, next) {
  const userId = req.user?.userId ?? req.apiUser?.userId;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const cutoff = new Date(Date.now() - 60_000);
    const device = await prisma.device.findFirst({
      where: {
        user_id: userId,
        is_active: true,
        is_connected: true,
        last_seen: { gte: cutoff },
      },
      select: { id: true },
    });

    if (!device) {
      return res.status(409).json({
        error: 'No connected SMS device. Open the Android app and wait for it to connect before sending.',
        code: 'NO_CONNECTED_DEVICE',
      });
    }
    next();
  } catch (error) {
    console.error('connectedDeviceMiddleware error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = connectedDeviceMiddleware;
