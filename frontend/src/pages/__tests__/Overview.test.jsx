import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getAnalyticsSummary,
  getDevices,
  getOverviewAnalytics,
} from '../../api/client';
import Overview, { getDateRange, isDeviceLive, toLocalDateKey } from '../Overview';

vi.mock('../../api/client', () => ({
  getAnalyticsSummary: vi.fn(),
  getDevices: vi.fn(),
  getOverviewAnalytics: vi.fn(),
}));

function analyticsResponse({ devices = { total: 0, connected: 0, offline: 0, live: [] } } = {}) {
  const today = toLocalDateKey();
  return {
    pending: 2,
    dispatched: 1,
    sent: 14,
    failed: 3,
    total: 20,
    sent_today: 4,
    period: {
      from: today,
      to: today,
      timezone_offset: -new Date().getTimezoneOffset(),
      requested: 6,
      sent: 4,
      failed: 1,
      completed: 5,
    },
    daily: [{ date: today, requested: 6, sent: 4, failed: 1 }],
    devices,
  };
}

function renderOverview() {
  return render(
    <MemoryRouter>
      <Overview />
    </MemoryRouter>,
  );
}

describe('Overview device states', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAnalyticsSummary.mockResolvedValue({ pending: 0, dispatched: 0, sent: 0, failed: 0 });
    getOverviewAnalytics.mockResolvedValue(analyticsResponse());
    getDevices.mockResolvedValue([]);
  });

  it('shows first-device onboarding when no phone has been paired', async () => {
    renderOverview();

    expect(await screen.findByRole('heading', { name: 'Connect your first phone' })).toBeInTheDocument();
    expect(screen.getByText('Getting started')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Reconnect your sender' })).not.toBeInTheDocument();
  });

  it('hides Getting Started and shows a reconnect state for a paired offline phone', async () => {
    const offlinePhone = {
      id: 8,
      name: 'Office relay',
      model: 'Pixel 7',
      is_connected: false,
      last_seen: new Date(Date.now() - 300_000).toISOString(),
      claimed_count: 11,
      sent_count: 9,
      failed_count: 2,
    };
    getOverviewAnalytics.mockResolvedValue(analyticsResponse({
      devices: { total: 1, connected: 0, offline: 1, live: [] },
    }));
    getDevices.mockResolvedValue([offlinePhone]);

    renderOverview();

    expect(await screen.findByRole('heading', { name: 'Reconnect your sender' })).toBeInTheDocument();
    expect(screen.getByText('Office relay')).toBeInTheDocument();
    expect(screen.queryByText('Getting started')).not.toBeInTheDocument();
  });

  it('shows only a fresh connected phone as live and uses the correct delivery counters', async () => {
    const freshSeen = new Date(Date.now() - 5_000).toISOString();
    const staleSeen = new Date(Date.now() - 120_000).toISOString();
    const freshPhone = {
      id: 11,
      name: 'Fresh phone',
      model: 'Samsung SM-A356E',
      is_connected: true,
      last_seen: freshSeen,
      claimed_count: 12,
      sent_count: 7,
      failed_count: 2,
    };
    const stalePhone = {
      id: 12,
      name: 'Stale phone',
      model: 'Pixel 6',
      is_connected: true,
      last_seen: staleSeen,
      claimed_count: 20,
      sent_count: 18,
      failed_count: 2,
    };
    getOverviewAnalytics.mockResolvedValue(analyticsResponse({
      devices: {
        total: 2,
        connected: 2,
        offline: 0,
        live: [
          { id: 11, name: freshPhone.name, model: freshPhone.model, last_seen: freshSeen, messages_sent: 7 },
          { id: 12, name: stalePhone.name, model: stalePhone.model, last_seen: staleSeen, messages_sent: 18 },
        ],
      },
    }));
    getDevices.mockResolvedValue([freshPhone, stalePhone]);

    renderOverview();

    const phoneLink = await screen.findByRole('link', { name: 'Fresh phone' });
    const livePhone = phoneLink.closest('article');
    expect(livePhone).not.toBeNull();
    expect(within(livePhone).getByText('Live now')).toBeInTheDocument();
    expect(within(livePhone).getByText('12')).toBeInTheDocument();
    expect(within(livePhone).getByText('7')).toBeInTheDocument();
    expect(within(livePhone).getByText('2')).toBeInTheDocument();
    expect(screen.getByText('1 live')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Stale phone' })).not.toBeInTheDocument();
  });
});

describe('Overview date filtering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAnalyticsSummary.mockResolvedValue({ pending: 0, dispatched: 0, sent: 0, failed: 0 });
    getOverviewAnalytics.mockResolvedValue(analyticsResponse());
    getDevices.mockResolvedValue([]);
  });

  it('requests Today, a seven-day range, and an exact date using the local timezone offset', async () => {
    const today = toLocalDateKey();
    const timezoneOffset = -new Date().getTimezoneOffset();
    renderOverview();

    await waitFor(() => {
      expect(getOverviewAnalytics).toHaveBeenCalledWith({
        from: today,
        to: today,
        timezone_offset: timezoneOffset,
      });
    });

    fireEvent.click(screen.getByRole('button', { name: '7 days' }));
    const sevenDays = getDateRange({ mode: '7d', date: today });
    await waitFor(() => {
      expect(getOverviewAnalytics).toHaveBeenLastCalledWith({
        ...sevenDays,
        timezone_offset: timezoneOffset,
      });
    });

    fireEvent.change(screen.getByLabelText('Show analytics for a specific date'), {
      target: { value: '2026-07-01' },
    });
    await waitFor(() => {
      expect(getOverviewAnalytics).toHaveBeenLastCalledWith({
        from: '2026-07-01',
        to: '2026-07-01',
        timezone_offset: timezoneOffset,
      });
    });
  });

  it('treats missing and expired heartbeats as offline', () => {
    const now = new Date('2026-07-13T12:00:00.000Z').getTime();
    expect(isDeviceLive({ is_connected: true }, now)).toBe(false);
    expect(isDeviceLive({ is_connected: true, last_seen: '2026-07-13T11:58:59.000Z' }, now)).toBe(false);
    expect(isDeviceLive({ is_connected: true, last_seen: '2026-07-13T11:59:45.000Z' }, now)).toBe(true);
    expect(isDeviceLive({ is_connected: false, last_seen: '2026-07-13T11:59:59.000Z' }, now)).toBe(false);
  });
});
