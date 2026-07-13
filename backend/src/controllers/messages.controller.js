const prisma = require('../prisma/client');

// Valid status transitions
const VALID_TRANSITIONS = {
  pending: ['dispatched'],
  dispatched: ['sent', 'failed'],
  failed: ['pending'],
  sent: [],
};

/**
 * POST /api/messages
 * Validates phone_number and message_text, creates a pending message
 * associated with the authenticated user.
 * Accepts an optional `source` parameter (default 'dashboard').
 * Returns 201 with the created message on success.
 */
async function createMessage(req, res) {
  const { phone_number, message_text, source = 'dashboard' } = req.body;

  // Validate required fields
  if (!phone_number || !message_text) {
    return res.status(400).json({ error: 'phone_number and message_text are required' });
  }

  try {
    const message = await prisma.message.create({
      data: {
        phone_number,
        message_text,
        status: 'pending',
        source,
        user_id: req.user.userId,
      },
    });

    return res.status(201).json(message);
  } catch (err) {
    console.error('createMessage error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * GET /api/messages
 * Returns all messages belonging to the authenticated user,
 * ordered by created_at descending (newest first).
 * Returns HTTP 200 with a JSON array of messages.
 */
async function getUserMessages(req, res) {
  try {
    const messages = await prisma.message.findMany({
      where: { user_id: req.user.userId },
      orderBy: { created_at: 'desc' },
      include: { device: { select: { id: true, name: true, model: true } } },
    });

    return res.status(200).json(messages);
  } catch (err) {
    console.error('getUserMessages error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * GET /api/messages/pending
 * Requires device authentication (req.device set by deviceAuthMiddleware).
 * Uses a Prisma transaction to atomically:
 *   1. Find the oldest pending message for the device's user
 *   2. Update its status to 'dispatched' and set dispatched_at
 * Returns HTTP 200 with the dispatched message, or null if no pending messages exist.
 * Returns HTTP 401 if req.device is not present.
 */
async function getPendingMessage(req, res) {
  if (!req.device) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const message = await prisma.$transaction(async (tx) => {
      const cutoff = new Date(Date.now() - 60_000);
      const connected = await tx.device.findMany({
        where: { user_id: req.device.userId, is_active: true, is_connected: true, last_seen: { gte: cutoff } },
        select: { id: true },
      });
      if (!connected.some((device) => device.id === req.device.deviceId)) return null;

      const loads = await tx.message.groupBy({
        by: ['device_id'],
        where: { user_id: req.device.userId, device_id: { in: connected.map((device) => device.id) } },
        _count: { _all: true },
      });
      const loadByDevice = new Map(loads.map((row) => [row.device_id, row._count._all]));
      connected.sort((a, b) => (loadByDevice.get(a.id) || 0) - (loadByDevice.get(b.id) || 0) || a.id - b.id);
      if (connected[0]?.id !== req.device.deviceId) return null;

      const pending = await tx.message.findFirst({
        where: { user_id: req.device.userId, status: 'pending' },
        orderBy: { created_at: 'asc' },
      });
      if (!pending) return null;

      const [updated] = await Promise.all([
        tx.message.update({
          where: { id: pending.id },
          data: { status: 'dispatched', dispatched_at: new Date(), device_id: req.device.deviceId },
        }),
        tx.device.update({
          where: { id: req.device.deviceId },
          data: {
            last_seen: new Date(),
            is_connected: true,
          },
        }),
      ]);

      return updated;
    });

    return res.status(200).json(message);
  } catch (err) {
    console.error('getPendingMessage error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * POST /api/messages/:id/retry
 * Requires device authentication (req.device set by deviceAuthMiddleware).
 * Resets a failed message back to pending status.
 * Returns HTTP 200 with the updated message on success.
 * Returns HTTP 404 if the message does not exist or belongs to a different user.
 * Returns HTTP 409 if the message is not in 'failed' state.
 */
async function retryMessage(req, res) {
  const { id } = req.params;

  try {
    const existing = await prisma.message.findUnique({
      where: { id: parseInt(id) },
    });

    if (!existing || existing.user_id !== req.device.userId) {
      return res.status(404).json({ error: 'Message not found' });
    }

    if (existing.status !== 'failed') {
      return res.status(409).json({ error: 'Message is not in failed state' });
    }

    const updated = await prisma.message.update({
      where: { id: parseInt(id) },
      data: {
        status: 'pending',
        dispatched_at: null,
        delivered_at: null,
        send_started_at: null,
        device_id: null,
      },
    });

    return res.status(200).json(updated);
  } catch (err) {
    console.error('retryMessage error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function markSendStarted(req, res) {
  const id = parseInt(req.params.id);
  try {
    const message = await prisma.message.findFirst({
      where: { id, user_id: req.device.userId, device_id: req.device.deviceId },
    });
    if (!message) return res.status(404).json({ error: 'Message not assigned to this device' });
    if (message.status !== 'dispatched') return res.status(409).json({ error: 'Message is not dispatched' });
    const updated = await prisma.message.update({ where: { id }, data: { send_started_at: message.send_started_at || new Date() } });
    return res.status(200).json(updated);
  } catch (err) {
    console.error('markSendStarted error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * PATCH /api/messages/:id/status
 * Updates the status of a message to 'sent' or 'failed' (no authentication required).
 * Returns HTTP 200 with the updated message on success.
 * Returns HTTP 400 if status is not 'sent' or 'failed'.
 * Returns HTTP 404 if the message does not exist.
 */
async function updateMessageStatus(req, res) {
  const { id } = req.params;
  const { status } = req.body;

  // Validate status value
  if (status !== 'sent' && status !== 'failed') {
    return res.status(400).json({ error: "Status must be 'sent' or 'failed'" });
  }

  try {
    // Look up the message
    const existing = await prisma.message.findUnique({
      where: { id: parseInt(id) },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Enforce valid status transitions
    const allowedNext = VALID_TRANSITIONS[existing.status] || [];
    if (!allowedNext.includes(status)) {
      return res.status(409).json({
        error: `Invalid status transition from '${existing.status}' to '${status}'`,
      });
    }

    // Update status and updated_at
    const updated = await prisma.message.update({
      where: { id: parseInt(id) },
      data: {
        status,
        updated_at: new Date(),
      },
    });

    return res.status(200).json(updated);
  } catch (err) {
    console.error('updateMessageStatus error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { createMessage, getUserMessages, getPendingMessage, retryMessage, markSendStarted, updateMessageStatus };
