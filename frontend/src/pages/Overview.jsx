import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getAnalyticsSummary,
  getDevices,
  getOverviewAnalytics,
} from '../api/client';

const RANGE_OPTIONS = [
  { id: 'today', label: 'Today', days: 1 },
  { id: '7d', label: '7 days', days: 7 },
  { id: '30d', label: '30 days', days: 30 },
];

const LIVE_HEARTBEAT_WINDOW = 60_000;

function asCount(value) {
  const count = Number(value);
  return Number.isFinite(count) && count >= 0 ? count : 0;
}

function formatCount(value) {
  return value == null ? '\u2014' : asCount(value).toLocaleString();
}

export function toLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dateFromKey(value) {
  const [year, month, day] = String(value).split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

export function getDateRange(filter, now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (filter.mode === 'date') {
    const date = filter.date || toLocalDateKey(today);
    return { from: date, to: date };
  }

  const option = RANGE_OPTIONS.find((item) => item.id === filter.mode) || RANGE_OPTIONS[0];
  const from = new Date(today);
  from.setDate(from.getDate() - (option.days - 1));
  return { from: toLocalDateKey(from), to: toLocalDateKey(today) };
}

export function isDeviceLive(device, now = Date.now()) {
  if (!device?.is_connected) return false;
  if (!device.last_seen) return false;
  const lastSeen = new Date(device.last_seen).getTime();
  return Number.isFinite(lastSeen) && now - lastSeen < LIVE_HEARTBEAT_WINDOW;
}

export function formatHeartbeat(lastSeen, now = Date.now()) {
  if (!lastSeen) return 'Heartbeat unavailable';
  const elapsed = Math.max(0, now - new Date(lastSeen).getTime());
  if (!Number.isFinite(elapsed)) return 'Heartbeat unavailable';
  if (elapsed < 10_000) return 'Just now';
  if (elapsed < 60_000) return `${Math.floor(elapsed / 1000)} sec ago`;
  if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)} min ago`;
  if (elapsed < 86_400_000) return `${Math.floor(elapsed / 3_600_000)} hr ago`;
  return `${Math.floor(elapsed / 86_400_000)} days ago`;
}

export function normalizeOverview(data, range, hasPeriodData = true) {
  const statuses = {
    pending: asCount(data?.pending),
    dispatched: asCount(data?.dispatched),
    sent: asCount(data?.sent),
    failed: asCount(data?.failed),
  };
  const total = data?.total == null
    ? Object.values(statuses).reduce((sum, value) => sum + value, 0)
    : asCount(data.total);
  const period = data?.period && typeof data.period === 'object'
    ? {
      from: data.period.from || range.from,
      to: data.period.to || range.to,
      requested: asCount(data.period.requested),
      sent: asCount(data.period.sent),
      failed: asCount(data.period.failed),
      completed: asCount(data.period.completed),
    }
    : {
      from: range.from,
      to: range.to,
      requested: total,
      sent: statuses.sent,
      failed: statuses.failed,
      completed: statuses.sent + statuses.failed,
    };

  const daily = Array.isArray(data?.daily)
    ? data.daily
      .filter((day) => day?.date)
      .map((day) => ({
        date: day.date,
        requested: asCount(day.requested),
        sent: asCount(day.sent),
        failed: asCount(day.failed),
      }))
    : [];

  return {
    ...statuses,
    total,
    sent_today: data?.sent_today == null ? null : asCount(data.sent_today),
    period,
    daily,
    devices: data?.devices && typeof data.devices === 'object' ? data.devices : null,
    hasPeriodData: Boolean(hasPeriodData && data?.period),
  };
}

function formatDate(date, options = {}) {
  return dateFromKey(date).toLocaleDateString(undefined, options);
}

function periodLabel(period) {
  if (!period?.from || !period?.to) return 'Selected period';
  if (period.from === period.to) {
    return formatDate(period.from, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
  }
  const from = formatDate(period.from, { month: 'short', day: 'numeric' });
  const to = formatDate(period.to, { month: 'short', day: 'numeric', year: 'numeric' });
  return `${from} \u2013 ${to}`;
}

function OverviewMetric({ label, value, note, feature = false, danger = false, suffix = '' }) {
  return (
    <article className={`${feature ? 'metric-feature' : ''} ${danger ? 'metric-danger' : ''}`}>
      <span>{label}</span>
      <strong>{formatCount(value)}{value == null ? '' : suffix}</strong>
      <small>{note}</small>
    </article>
  );
}

function ActivityChart({ daily, loading }) {
  const maxValue = Math.max(
    1,
    ...daily.flatMap((day) => [day.requested, day.sent, day.failed]),
  );

  if (loading && daily.length === 0) {
    return <div className="overview-chart-empty" role="status">Loading daily activity&hellip;</div>;
  }

  if (daily.length === 0) {
    return (
      <div className="overview-chart-empty">
        <strong>Daily activity is not available</strong>
        <p>Update the backend to use date filtering and the daily delivery breakdown.</p>
      </div>
    );
  }

  return (
    <div className="activity-ledger" data-testid="daily-activity">
      {daily.map((day) => {
        const accessibleLabel = `${formatDate(day.date, { month: 'short', day: 'numeric' })}: ${day.requested} requested, ${day.sent} sent, ${day.failed} failed`;
        return (
          <div className="activity-day" key={day.date} aria-label={accessibleLabel}>
            <time dateTime={day.date}>
              <strong>{formatDate(day.date, { weekday: 'short' })}</strong>
              <span>{formatDate(day.date, { month: 'short', day: 'numeric' })}</span>
            </time>
            <div className="activity-tracks" aria-hidden="true">
              <i className="requested" style={{ width: `${(day.requested / maxValue) * 100}%` }} />
              <i className="sent" style={{ width: `${(day.sent / maxValue) * 100}%` }} />
              <i className="failed" style={{ width: `${(day.failed / maxValue) * 100}%` }} />
            </div>
            <div className="activity-counts" aria-hidden="true">
              <span><i className="requested" />{day.requested}</span>
              <span><i className="sent" />{day.sent}</span>
              <span><i className="failed" />{day.failed}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LivePhone({ device, now }) {
  const sent = device.sent_count ?? device.messages_sent ?? 0;
  const assigned = device.claimed_count ?? sent;
  const failed = device.failed_count ?? 0;
  const heartbeat = formatHeartbeat(device.last_seen, now);

  return (
    <article className="live-node">
      <div className="live-node-identity">
        <span className="node-phone-icon" aria-hidden="true"><i /></span>
        <div>
          <Link to={`/devices/${device.id}`}>{device.name || 'Android phone'}</Link>
          <span>{device.model || 'Model unavailable'}</span>
        </div>
      </div>
      <div className="node-heartbeat" title={device.last_seen ? new Date(device.last_seen).toLocaleString() : undefined}>
        <span className="live-pulse" aria-hidden="true" />
        <strong>Live now</strong>
        <small>{heartbeat}</small>
      </div>
      <dl className="node-delivery-stats">
        <div><dt>Assigned</dt><dd>{formatCount(assigned)}</dd></div>
        <div><dt>Sent</dt><dd>{formatCount(sent)}</dd></div>
        <div><dt>Failed</dt><dd>{formatCount(failed)}</dd></div>
      </dl>
    </article>
  );
}

export default function Overview() {
  const today = useMemo(() => toLocalDateKey(), []);
  const [filter, setFilter] = useState({ mode: 'today', date: today });
  const range = useMemo(() => getDateRange(filter), [filter]);
  const [analytics, setAnalytics] = useState(null);
  const [devices, setDevices] = useState([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [devicesLoading, setDevicesLoading] = useState(true);
  const [analyticsError, setAnalyticsError] = useState('');
  const [devicesError, setDevicesError] = useState('');
  const [legacyAnalytics, setLegacyAnalytics] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [clock, setClock] = useState(Date.now());

  const loadAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    setAnalyticsError('');
    const params = {
      ...range,
      timezone_offset: -new Date().getTimezoneOffset(),
    };

    try {
      const data = await getOverviewAnalytics(params);
      setAnalytics(normalizeOverview(data, range));
      setLegacyAnalytics(false);
      setLastUpdated(new Date());
    } catch (overviewError) {
      try {
        const summary = await getAnalyticsSummary();
        setAnalytics(normalizeOverview(summary, range, false));
        setLegacyAnalytics(true);
        setLastUpdated(new Date());
      } catch (summaryError) {
        setAnalyticsError('Analytics could not be refreshed. The last successful snapshot is still shown.');
      }
    } finally {
      setAnalyticsLoading(false);
    }
  }, [range]);

  const loadDevices = useCallback(async () => {
    try {
      const data = await getDevices();
      setDevices(Array.isArray(data) ? data : []);
      setDevicesError('');
    } catch (error) {
      setDevicesError('Phone status could not be refreshed. Live indicators expire with the last heartbeat.');
    } finally {
      setDevicesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAnalytics();
    const timer = window.setInterval(loadAnalytics, 20_000);
    return () => window.clearInterval(timer);
  }, [loadAnalytics]);

  useEffect(() => {
    loadDevices();
    const timer = window.setInterval(loadDevices, 15_000);
    return () => window.clearInterval(timer);
  }, [loadDevices]);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 10_000);
    return () => window.clearInterval(timer);
  }, []);

  const statusTotal = analytics?.total ?? null;
  const period = analytics?.period;
  const completed = period?.completed ?? 0;
  const successRate = analytics && completed > 0
    ? Math.round((period.sent / completed) * 100)
    : analytics ? 0 : null;
  const queued = analytics ? analytics.pending + analytics.dispatched : null;
  const selectedMode = RANGE_OPTIONS.find((option) => option.id === filter.mode)?.label || 'Specific date';

  const deviceById = new Map(devices.map((device) => [String(device.id), device]));
  const overviewLive = Array.isArray(analytics?.devices?.live) ? analytics.devices.live : null;
  const liveDevices = (overviewLive || devices.filter((device) => device.is_connected))
    .map((device) => ({
      ...(deviceById.get(String(device.id)) || {}),
      ...device,
      is_connected: overviewLive ? true : device.is_connected,
    }))
    .filter((device) => isDeviceLive(device, clock));
  const knownDeviceCount = Math.max(devices.length, asCount(analytics?.devices?.total));
  const offlineCount = Math.max(0, asCount(analytics?.devices?.offline) || knownDeviceCount - liveDevices.length);
  const offlineDevices = devices.filter((device) => !liveDevices.some((live) => String(live.id) === String(device.id)));

  return (
    <div className="overview-page">
      <section className="page-intro overview-intro">
        <div>
          <p className="eyebrow">Gateway operations</p>
          <h1>Your delivery desk.</h1>
          <p>Track message flow and every phone currently ready to send.</p>
        </div>
        <Link to="/messages" className="btn btn-primary btn-fit">Send a message <span aria-hidden="true">&rarr;</span></Link>
      </section>

      <section className="overview-filterbar" aria-label="Analytics date filter">
        <div>
          <span className="filter-caption">Showing</span>
          <strong>{analytics?.hasPeriodData ? periodLabel(period) : 'All-time snapshot'}</strong>
        </div>
        <div className="range-controls" role="group" aria-label="Choose date range">
          {RANGE_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              className={filter.mode === option.id ? 'active' : ''}
              aria-pressed={filter.mode === option.id}
              onClick={() => setFilter((current) => ({ ...current, mode: option.id }))}
            >
              {option.label}
            </button>
          ))}
          <label className={`exact-date-control ${filter.mode === 'date' ? 'active' : ''}`}>
            <span>Specific date</span>
            <input
              type="date"
              value={filter.date}
              max={today}
              aria-label="Show analytics for a specific date"
              onFocus={() => setFilter((current) => ({ ...current, mode: 'date' }))}
              onChange={(event) => setFilter({ mode: 'date', date: event.target.value || today })}
            />
          </label>
        </div>
      </section>

      {legacyAnalytics && (
        <p className="overview-notice" role="status">
          This backend only provides an all-time snapshot. Update it to enable {selectedMode.toLowerCase()} filtering and daily activity.
        </p>
      )}
      {analyticsError && <p className="overview-notice error" role="alert">{analyticsError}</p>}

      <section className="metric-strip overview-metrics" aria-label="Message analytics">
        <OverviewMetric
          feature
          label={filter.mode === 'today' && analytics?.hasPeriodData ? 'Sent today' : 'Sent in view'}
          value={period?.sent}
          note={analytics?.sent_today != null && filter.mode !== 'today' ? `${formatCount(analytics.sent_today)} sent today` : 'Android reported as sent'}
        />
        <OverviewMetric label="Requested" value={period?.requested} note="Jobs created in this view" />
        <OverviewMetric label="Success rate" value={successRate == null ? null : successRate} suffix="%" note={successRate == null ? 'Waiting for data' : `${formatCount(completed)} completed \u00b7 ${successRate}% sent`} />
        <OverviewMetric danger={Boolean(period?.failed)} label="Failed" value={period?.failed} note="Completed with an error" />
        <OverviewMetric label="Queue now" value={queued} note={analytics ? `${formatCount(analytics.pending)} waiting \u00b7 ${formatCount(analytics.dispatched)} on a phone` : 'Waiting for data'} />
      </section>

      <div className="overview-operations">
        <section className="overview-activity" aria-labelledby="activity-heading">
          <div className="operations-heading">
            <div>
              <p className="eyebrow">Daily flow</p>
              <h2 id="activity-heading">Message activity</h2>
              <p>Requested jobs compared with terminal delivery results.</p>
            </div>
            <div className="activity-legend" aria-label="Chart legend">
              <span><i className="requested" />Requested</span>
              <span><i className="sent" />Sent</span>
              <span><i className="failed" />Failed</span>
            </div>
          </div>
          <ActivityChart daily={analytics?.daily || []} loading={analyticsLoading} />
        </section>

        <section className="overview-nodes" aria-labelledby="nodes-heading">
          <div className="operations-heading node-heading">
            <div>
              <p className="eyebrow">Sending nodes</p>
              <h2 id="nodes-heading">Live phones</h2>
            </div>
            <Link to="/devices">Manage</Link>
          </div>

          {devicesError && <p className="node-refresh-error" role="status">{devicesError}</p>}
          {devicesLoading && knownDeviceCount === 0 ? (
            <div className="nodes-loading" role="status">Checking phone heartbeats&hellip;</div>
          ) : liveDevices.length > 0 ? (
            <>
              <div className="live-count"><span className="live-pulse" aria-hidden="true" /><strong>{liveDevices.length} live</strong><small>Heartbeat within 60 seconds</small></div>
              <div className="live-node-list">
                {liveDevices.map((device) => <LivePhone key={device.id} device={device} now={clock} />)}
              </div>
            </>
          ) : knownDeviceCount > 0 ? (
            <div className="node-offline-state">
              <span className="offline-phone-icon" aria-hidden="true" />
              <p className="eyebrow">Paired, not live</p>
              <h3>Reconnect your sender</h3>
              <p>{offlineCount || knownDeviceCount} phone{(offlineCount || knownDeviceCount) === 1 ? ' is' : 's are'} offline. Open SignalDesk on the phone and turn off Offline mode to resume delivery.</p>
              {offlineDevices.slice(0, 2).map((device) => (
                <div className="offline-phone" key={device.id}>
                  <strong>{device.name || 'Android phone'}</strong>
                  <span>{device.last_seen ? `Last seen ${formatHeartbeat(device.last_seen, clock)}` : 'No heartbeat recorded'}</span>
                </div>
              ))}
              <Link to="/devices">Review paired phones <span aria-hidden="true">&rarr;</span></Link>
            </div>
          ) : (
            <div className="node-onboarding">
              <p className="eyebrow">Getting started</p>
              <h3>Connect your first phone</h3>
              <p>Pair an Android phone, grant SMS access, and keep the gateway online.</p>
              <ol>
                <li><span>1</span>Copy the backend URL and pairing code.</li>
                <li><span>2</span>Enter both values in the Android app.</li>
                <li><span>3</span>Wait for the live heartbeat.</li>
              </ol>
              <Link to="/devices">Pair a phone <span aria-hidden="true">&rarr;</span></Link>
            </div>
          )}
        </section>
      </div>

      <footer className="overview-foot">
        <span>{statusTotal == null ? 'Loading message history\u2026' : `${formatCount(statusTotal)} all-time jobs`}</span>
        <span>{lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} \u00b7 refreshes every 20 seconds` : 'Connecting to analytics\u2026'}</span>
      </footer>
    </div>
  );
}
