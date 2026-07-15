'use strict';

const prisma = require('../prisma/client');
const { DISPATCH_TIMEOUT_MS } = require('../services/dispatchPolicy');

const TERMINAL_STATUSES = new Set(['sent', 'failed']);

/**
 * POST /api/webhook/delivery/:id
 * Requires device authentication (req.device set by deviceAuthMiddleware).
 *
 * The dispatched -> terminal transition and sent counter increment happen in
 * one transaction. Reports retried from the phone after a timeout are
 * acknowledged without changing the terminal result, allowing its durable
 * outbox entry to be cleared safely.
 */
async function reportDelivery(req, res) {
  const { status } = req.body;
  const id = Number.parseInt(req.params.id, 10);

  if (status !== 'sent' && status !== 'failed') {
    return res.status(400).json({ error: 'Invalid status' });
  }

  try {
    const outcome = await prisma.$transaction(async (tx) => {
      const message = await tx.message.findUnique({ where: { id } });

      if (!message) return { type: 'not_found' };
      if (message.user_id !== req.device.userId) return { type: 'unauthorized' };
      if (message.device_id !== req.device.deviceId) return { type: 'wrong_device' };

      // The phone retries reports until it receives a success response. Once a
      // message is terminal, acknowledge every late report but never rewrite it.
      if (TERMINAL_STATUSES.has(message.status)) {
        return { type: 'acknowledged', message };
      }

      if (message.status !== 'dispatched') return { type: 'conflict' };

      const now = new Date();
      const cutoff = new Date(now.getTime() - DISPATCH_TIMEOUT_MS);

      // Enforce the one-minute deadline in the same request that reports the
      // outcome. This closes the sub-second window before the background
      // sweeper's next tick in which an already-expired job could become sent.
      if (!message.dispatched_at || new Date(message.dispatched_at) <= cutoff) {
        await tx.message.updateMany({
          where: {
            id,
            user_id: req.device.userId,
            device_id: req.device.deviceId,
            status: 'dispatched',
            OR: [
              { dispatched_at: null },
              { dispatched_at: { lte: cutoff } },
            ],
          },
          data: { status: 'failed', delivered_at: now, updated_at: now },
        });

        const current = await tx.message.findUnique({ where: { id } });
        if (current && TERMINAL_STATUSES.has(current.status)) {
          return { type: 'acknowledged', message: current };
        }
        return { type: 'conflict' };
      }

      const transition = await tx.message.updateMany({
        where: {
          id,
          user_id: req.device.userId,
          device_id: req.device.deviceId,
          status: 'dispatched',
          dispatched_at: { gt: cutoff },
        },
        data: {
          status,
          delivered_at: now,
          updated_at: now,
        },
      });

      if (transition.count === 1 && status === 'sent') {
        await tx.device.updateMany({
          where: { id: req.device.deviceId, user_id: req.device.userId },
          data: { messages_sent: { increment: 1 } },
        });
      }

      const current = await tx.message.findUnique({ where: { id } });

      if (transition.count === 1) return { type: 'transitioned', message: current };

      // Another transaction (normally the timeout sweeper or a duplicate
      // report) won the race. A terminal row is final and must not be changed.
      if (current && TERMINAL_STATUSES.has(current.status)) {
        return { type: 'acknowledged', message: current };
      }

      return { type: 'conflict' };
    });

    if (outcome.type === 'not_found') {
      return res.status(404).json({ error: 'Message not found' });
    }
    if (outcome.type === 'unauthorized') {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (outcome.type === 'wrong_device') {
      return res.status(403).json({ error: 'Message is assigned to another device' });
    }
    if (outcome.type === 'conflict') {
      return res.status(409).json({ error: 'Message is not in dispatched state' });
    }

    return res.status(200).json(outcome.message);
  } catch (err) {
    console.error('reportDelivery error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { reportDelivery };
