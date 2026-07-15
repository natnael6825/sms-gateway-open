'use strict';

const prisma = require('../prisma/client');
const { DISPATCH_TIMEOUT_MS } = require('./dispatchPolicy');
const SWEEP_INTERVAL_MS = 1_000;

/**
 * Mark jobs that a phone claimed but did not finish within one minute as failed.
 *
 * The status predicate is part of the UPDATE, rather than a preceding read, so a
 * delivery report that has already changed the message to `sent` cannot be
 * overwritten by the timeout sweep.
 */
async function expireStaleDispatchedMessages({
  client = prisma,
  now = new Date(),
  timeoutMs = DISPATCH_TIMEOUT_MS,
} = {}) {
  const cutoff = new Date(now.getTime() - timeoutMs);

  return client.message.updateMany({
    where: {
      status: 'dispatched',
      dispatched_at: { lte: cutoff },
    },
    // `delivered_at` is the existing terminal timestamp used by the dashboard,
    // API status response, and analytics for both sent and failed outcomes.
    data: { status: 'failed', delivered_at: now },
  });
}

/**
 * Run the timeout update regularly without allowing overlapping database calls.
 * A failed sweep is logged and retried on the next tick; it does not terminate
 * the API process.
 */
function startDispatchTimeoutSweeper({
  client = prisma,
  intervalMs = SWEEP_INTERVAL_MS,
  timeoutMs = DISPATCH_TIMEOUT_MS,
  now = () => new Date(),
  logger = console,
  runImmediately = true,
} = {}) {
  if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
    throw new TypeError('intervalMs must be a positive number');
  }

  let inFlight = null;
  let stopped = false;

  const sweep = () => {
    if (stopped) return Promise.resolve({ count: 0 });
    if (inFlight) return inFlight;

    inFlight = expireStaleDispatchedMessages({ client, now: now(), timeoutMs })
      .then((result) => {
        if (result.count > 0) {
          logger.info(`Marked ${result.count} dispatched message(s) as failed after the 60-second timeout.`);
        }
        return result;
      })
      .catch((error) => {
        logger.error('Dispatch timeout sweep failed:', error);
        return { count: 0 };
      })
      .finally(() => {
        inFlight = null;
      });

    return inFlight;
  };

  if (runImmediately) void sweep();

  const timer = setInterval(() => void sweep(), intervalMs);
  timer.unref?.();

  return {
    sweep,
    stop() {
      stopped = true;
      clearInterval(timer);
    },
  };
}

module.exports = {
  DISPATCH_TIMEOUT_MS,
  SWEEP_INTERVAL_MS,
  expireStaleDispatchedMessages,
  startDispatchTimeoutSweeper,
};
