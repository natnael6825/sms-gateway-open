'use strict';

const prisma = require('../prisma/client');

/**
 * GET /api/analytics/summary
 * Returns a count of messages grouped by status for the authenticated user.
 * Response shape: { pending: N, dispatched: N, sent: N, failed: N }
 */
async function getSummary(req, res) {
  try {
    const rows = await prisma.message.groupBy({
      by: ['status'],
      where: { user_id: req.user.userId },
      _count: true,
    });

    // Build the summary, defaulting any missing status to 0
    const summary = {
      pending: 0,
      dispatched: 0,
      sent: 0,
      failed: 0,
    };

    for (const row of rows) {
      if (Object.prototype.hasOwnProperty.call(summary, row.status)) {
        summary[row.status] = row._count._all;
      }
    }

    return res.status(200).json(summary);
  } catch (err) {
    console.error('getSummary error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { getSummary };
