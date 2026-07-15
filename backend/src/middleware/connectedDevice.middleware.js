'use strict';

const prisma = require('../prisma/client');
const { DISPATCH_READY_WINDOW_MS } = require('../services/dispatchPolicy');

/**
 * Blocks message creation unless an active phone has both checked in and
 * polled the dispatch queue recently. Runs after JWT or API-key authentication.
 */
async function connectedDeviceMiddleware(req, res, next) {
  const userId = req.user?.userId ?? req.apiUser?.userId;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const now = Date.now();
    const cutoff = new Date(now - 60_000);
    const readyCutoff = new Date(now - DISPATCH_READY_WINDOW_MS);
    const device = await prisma.device.findFirst({
      where: {
        user_id: userId,
        is_active: true,
        is_connected: true,
        last_seen: { gte: cutoff },
        last_polled_at: { gte: readyCutoff },
      },
      select: { id: true },
    });

    if (!device) {
      return res.status(409).json({
        error: 'No dispatch-ready SMS device. Open the Android app and wait for its sender service to connect before sending.',
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
