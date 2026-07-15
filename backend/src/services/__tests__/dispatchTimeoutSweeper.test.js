'use strict';

jest.mock('../../prisma/client', () => ({
  message: { updateMany: jest.fn() },
}));

const prisma = require('../../prisma/client');
const {
  DISPATCH_TIMEOUT_MS,
  expireStaleDispatchedMessages,
  startDispatchTimeoutSweeper,
} = require('../dispatchTimeoutSweeper');

describe('dispatch timeout sweeper', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('atomically fails only messages still dispatched at least 60 seconds ago', async () => {
    const now = new Date('2026-07-15T10:01:00.000Z');
    prisma.message.updateMany.mockResolvedValue({ count: 2 });

    const result = await expireStaleDispatchedMessages({ now });

    expect(result).toEqual({ count: 2 });
    expect(prisma.message.updateMany).toHaveBeenCalledWith({
      where: {
        status: 'dispatched',
        dispatched_at: { lte: new Date('2026-07-15T10:00:00.000Z') },
      },
      data: {
        status: 'failed',
        delivered_at: now,
      },
    });
  });

  test('uses a fixed one-minute dispatch timeout by default', () => {
    expect(DISPATCH_TIMEOUT_MS).toBe(60_000);
  });

  test('does not overlap sweeps while the previous database update is running', async () => {
    let finishFirstSweep;
    prisma.message.updateMany.mockReturnValueOnce(new Promise((resolve) => {
      finishFirstSweep = resolve;
    }));

    const sweeper = startDispatchTimeoutSweeper({
      runImmediately: false,
      intervalMs: 10_000,
      logger: { info: jest.fn(), error: jest.fn() },
    });

    const first = sweeper.sweep();
    const overlapping = sweeper.sweep();

    expect(overlapping).toBe(first);
    expect(prisma.message.updateMany).toHaveBeenCalledTimes(1);

    finishFirstSweep({ count: 0 });
    await first;
    sweeper.stop();
  });

  test('logs a database error and allows a later sweep to retry', async () => {
    const error = new Error('database unavailable');
    const logger = { info: jest.fn(), error: jest.fn() };
    prisma.message.updateMany
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce({ count: 1 });

    const sweeper = startDispatchTimeoutSweeper({
      runImmediately: false,
      intervalMs: 10_000,
      logger,
    });

    await expect(sweeper.sweep()).resolves.toEqual({ count: 0 });
    await expect(sweeper.sweep()).resolves.toEqual({ count: 1 });

    expect(logger.error).toHaveBeenCalledWith('Dispatch timeout sweep failed:', error);
    expect(prisma.message.updateMany).toHaveBeenCalledTimes(2);
    sweeper.stop();
  });

  test('stopping the sweeper prevents manual or scheduled database work', async () => {
    jest.useFakeTimers();
    prisma.message.updateMany.mockResolvedValue({ count: 0 });

    const sweeper = startDispatchTimeoutSweeper({
      runImmediately: false,
      intervalMs: 1_000,
      logger: { info: jest.fn(), error: jest.fn() },
    });
    sweeper.stop();

    jest.advanceTimersByTime(5_000);
    await expect(sweeper.sweep()).resolves.toEqual({ count: 0 });
    expect(prisma.message.updateMany).not.toHaveBeenCalled();
  });
});
