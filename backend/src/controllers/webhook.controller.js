'use strict';

const prisma = require('../prisma/client');

/**
 * POST /api/webhook/delivery/:id
 * Requires device authentication (req.device set by deviceAuthMiddleware).
 * Reports delivery status for a dispatched message.
 *
 * Validates:
 *   - req.body.status is 'sent' or 'failed' (400 otherwise)
 *   - Message exists by req.params.id (404 otherwise)
 *   - message.user_id === req.device.userId (401 otherwise)
 *   - message.status === 'dispatched' (409 otherwise)
 *
 * On success: updates status, delivered_at, updated_at and returns HTTP 200.
 */
async function reportDelivery(req, res) {
  const { status } = req.body;
  const id = parseInt(req.params.id);

  // Validate status value
  if (status !== 'sent' && status !== 'failed') {
    return res.status(400).json({ error: 'Invalid status' });
  }

  try {
    // Look up the message
    const message = await prisma.message.findUnique({
      where: { id },
    });

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Verify ownership
    if (message.user_id !== req.device.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // A device may retry a durable delivery report after losing connectivity.
    // Treat an identical final status as an idempotent success.
    if (message.status === status) {
      return res.status(200).json(message);
    }

    // Verify message is in dispatched state
    if (message.status !== 'dispatched') {
      return res.status(409).json({ error: 'Message is not in dispatched state' });
    }

    // Update status, delivered_at, and updated_at
    const now = new Date();
    const updated = await prisma.message.update({
      where: { id },
      data: {
        status,
        delivered_at: now,
        updated_at: now,
      },
    });

    if (status === 'sent' && message.device_id) {
      await prisma.device.update({ where: { id: message.device_id }, data: { messages_sent: { increment: 1 } } });
    }

    return res.status(200).json(updated);
  } catch (err) {
    console.error('reportDelivery error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { reportDelivery };
