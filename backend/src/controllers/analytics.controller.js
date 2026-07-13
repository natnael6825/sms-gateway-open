'use strict';

const prisma = require('../prisma/client');

const DAY_MS = 24 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;
const MAX_PERIOD_DAYS = 90;
const DEVICE_LIVE_WINDOW_MS = 60 * 1000;
const STATUSES = ['pending', 'dispatched', 'sent', 'failed'];

function emptyStatusSummary() {
  return { pending: 0, dispatched: 0, sent: 0, failed: 0 };
}

function summarizeStatusRows(rows) {
  const summary = emptyStatusSummary();
  for (const row of rows) {
    if (Object.prototype.hasOwnProperty.call(summary, row.status)) {
      summary[row.status] = row._count._all;
    }
  }
  return summary;
}

function parseCalendarDate(value, fieldName) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return { error: `${fieldName} must use YYYY-MM-DD format` };
  }

  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== value) {
    return { error: `${fieldName} must be a valid calendar date` };
  }

  return { value, timestamp };
}

function parseTimezoneOffset(value) {
  if (value === undefined) return { value: 0 };
  if (typeof value !== 'string' || !/^[+-]?\d+$/.test(value)) {
    return { error: 'timezone_offset must be an integer number of minutes east of UTC' };
  }

  const offset = Number(value);
  if (!Number.isInteger(offset) || offset < -840 || offset > 840) {
    return { error: 'timezone_offset must be between -840 and 840 minutes east of UTC' };
  }

  return { value: offset };
}

function localDateKey(date, timezoneOffset) {
  return new Date(date.getTime() + timezoneOffset * MINUTE_MS).toISOString().slice(0, 10);
}

function resolvePeriod(query, now = new Date()) {
  const parsedOffset = parseTimezoneOffset(query.timezone_offset);
  if (parsedOffset.error) return parsedOffset;

  const timezoneOffset = parsedOffset.value;
  const today = localDateKey(now, timezoneOffset);
  const todayTimestamp = Date.parse(`${today}T00:00:00.000Z`);

  let from = query.from;
  let to = query.to;
  if (from === undefined && to === undefined) {
    from = new Date(todayTimestamp - 6 * DAY_MS).toISOString().slice(0, 10);
    to = today;
  } else if (from === undefined) {
    from = to;
  } else if (to === undefined) {
    to = from;
  }

  const parsedFrom = parseCalendarDate(from, 'from');
  if (parsedFrom.error) return parsedFrom;
  const parsedTo = parseCalendarDate(to, 'to');
  if (parsedTo.error) return parsedTo;

  const days = Math.round((parsedTo.timestamp - parsedFrom.timestamp) / DAY_MS) + 1;
  if (days < 1) return { error: 'from must be on or before to' };
  if (days > MAX_PERIOD_DAYS) return { error: `Date range cannot exceed ${MAX_PERIOD_DAYS} days` };

  const start = new Date(parsedFrom.timestamp - timezoneOffset * MINUTE_MS);
  const end = new Date(parsedTo.timestamp + DAY_MS - timezoneOffset * MINUTE_MS);
  const todayStart = new Date(todayTimestamp - timezoneOffset * MINUTE_MS);
  const todayEnd = new Date(todayTimestamp + DAY_MS - timezoneOffset * MINUTE_MS);

  return {
    from: parsedFrom.value,
    to: parsedTo.value,
    days,
    timezoneOffset,
    start,
    end,
    todayStart,
    todayEnd,
  };
}

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

    return res.status(200).json(summarizeStatusRows(rows));
  } catch (err) {
    console.error('getSummary error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * GET /api/analytics/overview
 *
 * Query parameters:
 *   from, to          Inclusive local calendar dates in YYYY-MM-DD format.
 *   timezone_offset   Integer minutes east of UTC (for example, Nairobi is 180).
 *
 * With no dates, the selected period is the seven local calendar days ending
 * today. If only one boundary is supplied, the period is that single day.
 * Date ranges are capped at 90 days so dashboard requests remain bounded.
 *
 * Top-level status counts intentionally remain unfiltered and use the legacy
 * summary shape. Requested jobs are bucketed by created_at while final sent and
 * failed outcomes are bucketed by delivered_at.
 */
async function getOverview(req, res) {
  const period = resolvePeriod(req.query || {});
  if (period.error) return res.status(400).json({ error: period.error });

  const userId = req.user.userId;
  const now = new Date();
  const liveCutoff = new Date(now.getTime() - DEVICE_LIVE_WINDOW_MS);

  try {
    // Persist the same presence rule used by the device list so every consumer
    // agrees about whether a phone is actually online.
    await prisma.device.updateMany({
      where: {
        user_id: userId,
        is_active: true,
        is_connected: true,
        OR: [{ last_seen: null }, { last_seen: { lt: liveCutoff } }],
      },
      data: { is_connected: false },
    });

    const [statusRows, requestedMessages, completedMessages, sentToday, devices] = await Promise.all([
      prisma.message.groupBy({
        by: ['status'],
        where: { user_id: userId },
        _count: true,
      }),
      prisma.message.findMany({
        where: { user_id: userId, created_at: { gte: period.start, lt: period.end } },
        select: { created_at: true },
      }),
      prisma.message.findMany({
        where: {
          user_id: userId,
          status: { in: ['sent', 'failed'] },
          delivered_at: { gte: period.start, lt: period.end },
        },
        select: { status: true, delivered_at: true },
      }),
      prisma.message.count({
        where: {
          user_id: userId,
          status: 'sent',
          delivered_at: { gte: period.todayStart, lt: period.todayEnd },
        },
      }),
      prisma.device.findMany({
        where: { user_id: userId, is_active: true },
        orderBy: { last_seen: 'desc' },
        select: {
          id: true,
          name: true,
          model: true,
          is_connected: true,
          last_seen: true,
          messages_sent: true,
        },
      }),
    ]);

    const dailyByDate = new Map();
    for (let index = 0; index < period.days; index += 1) {
      const date = new Date(Date.parse(`${period.from}T00:00:00.000Z`) + index * DAY_MS)
        .toISOString()
        .slice(0, 10);
      dailyByDate.set(date, { date, requested: 0, sent: 0, failed: 0 });
    }

    for (const message of requestedMessages) {
      const bucket = dailyByDate.get(localDateKey(message.created_at, period.timezoneOffset));
      if (bucket) bucket.requested += 1;
    }

    for (const message of completedMessages) {
      if (!message.delivered_at) continue;
      const bucket = dailyByDate.get(localDateKey(message.delivered_at, period.timezoneOffset));
      if (bucket && (message.status === 'sent' || message.status === 'failed')) {
        bucket[message.status] += 1;
      }
    }

    const summary = summarizeStatusRows(statusRows);
    const sentInPeriod = completedMessages.filter((message) => message.status === 'sent').length;
    const failedInPeriod = completedMessages.filter((message) => message.status === 'failed').length;
    const liveDevices = devices
      .filter((device) => device.is_connected
        && device.last_seen
        && new Date(device.last_seen).getTime() >= liveCutoff.getTime())
      .map(({ is_connected: _isConnected, ...device }) => device);

    return res.status(200).json({
      ...summary,
      total: STATUSES.reduce((sum, status) => sum + summary[status], 0),
      sent_today: sentToday,
      period: {
        from: period.from,
        to: period.to,
        timezone_offset: period.timezoneOffset,
        requested: requestedMessages.length,
        sent: sentInPeriod,
        failed: failedInPeriod,
        completed: sentInPeriod + failedInPeriod,
      },
      daily: Array.from(dailyByDate.values()),
      devices: {
        total: devices.length,
        connected: liveDevices.length,
        offline: devices.length - liveDevices.length,
        live: liveDevices,
      },
    });
  } catch (err) {
    console.error('getOverview error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { getSummary, getOverview };
