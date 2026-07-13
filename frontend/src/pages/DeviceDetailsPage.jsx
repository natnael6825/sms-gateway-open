import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getDeviceDetails } from '../api/client';

const STATUS_LABEL = { pending: 'Queued', dispatched: 'Claimed', sent: 'Sent', failed: 'Failed' };
const LEDGER_FILTERS = ['all', 'sent', 'failed', 'dispatched', 'pending'];

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : 'Not yet';
}

function formatDuration(milliseconds) {
  if (milliseconds == null) return 'No completed sends';
  const seconds = Math.max(1, Math.round(milliseconds / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${seconds % 60}s`;
}

function formatHandoffTime(value) {
  if (!value) return 'Waiting';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Time unavailable';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  }).format(date);
}

export default function DeviceDetailsPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const load = useCallback(async () => {
    try {
      setData(await getDeviceDetails(id));
      setError('');
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Could not load this device.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, [load]);

  const messages = useMemo(() => {
    if (!data) return [];
    return statusFilter === 'all' ? data.messages : data.messages.filter((message) => message.status === statusFilter);
  }, [data, statusFilter]);

  const ledgerCounts = useMemo(() => {
    const counts = { all: 0, sent: 0, failed: 0, dispatched: 0, pending: 0 };
    if (!data) return counts;
    counts.all = data.messages.length;
    data.messages.forEach((message) => {
      if (Object.hasOwn(counts, message.status)) counts[message.status] += 1;
    });
    return counts;
  }, [data]);

  if (loading) return <div className="device-detail-state"><span className="detail-loader" /><p>Reading device activity…</p></div>;
  if (error || !data) return <div className="device-detail-state"><strong>{error}</strong><Link to="/devices">Return to devices</Link></div>;

  const { device, stats, daily_activity: days } = data;
  const maxDay = Math.max(1, ...days.map((day) => day.assigned));

  return <div className="device-detail-page">
    <header className="device-detail-header">
      <div><Link className="detail-back" to="/devices">← All devices</Link><p className="eyebrow">Android sender · #{device.id}</p><h1>{device.name}</h1><p>{device.model || 'Model unavailable'}</p></div>
      <div className={`detail-presence ${device.is_connected ? 'online' : ''}`}><i />{device.is_connected ? 'Connected' : 'Offline'}</div>
    </header>

    <section className="device-facts" aria-label="Device information">
      <div><span>Device identifier</span><code title={device.device_identifier}>{device.device_identifier}</code></div>
      <div><span>Paired</span><strong>{formatDate(device.paired_at)}</strong></div>
      <div><span>Last check-in</span><strong>{formatDate(device.last_seen)}</strong></div>
      <div><span>Average completion</span><strong>{formatDuration(stats.average_delivery_ms)}</strong></div>
    </section>

    <section className="device-performance">
      <div className="performance-copy"><p className="eyebrow">Delivery record</p><h2>{stats.sent.toLocaleString()} messages sent</h2><p>{stats.assigned.toLocaleString()} jobs have been assigned to this phone since pairing.</p><dl><div><dt>Success rate</dt><dd>{stats.success_rate == null ? '—' : `${stats.success_rate}%`}</dd></div><div><dt>Sent today</dt><dd>{stats.sent_today}</dd></div><div><dt>Failed</dt><dd>{stats.failed}</dd></div><div><dt>In progress</dt><dd>{stats.pending + stats.dispatched}</dd></div></dl></div>
      <div className="workload-chart" aria-label="Seven day assigned, sent, and failed message activity">
        <div className="chart-key"><span><i className="sent" />Sent</span><span><i className="failed" />Failed</span><span><i className="other" />Other</span></div>
        <div className="chart-bars">{days.map((day) => {
          const other = Math.max(0, day.assigned - day.sent - day.failed);
          return <div className="chart-day" key={day.date} title={`${day.assigned} assigned · ${day.sent} sent · ${day.failed} failed`}><strong>{day.assigned}</strong><div className="bar-track"><i className="other" style={{ height: `${(other / maxDay) * 100}%` }} /><i className="failed" style={{ height: `${(day.failed / maxDay) * 100}%` }} /><i className="sent" style={{ height: `${(day.sent / maxDay) * 100}%` }} /></div><span>{new Date(`${day.date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short' })}</span></div>;
        })}</div>
      </div>
    </section>

    <section className="device-message-ledger">
      <div className="ledger-heading">
        <div>
          <p className="eyebrow">Message ledger</p>
          <h2>Recent activity</h2>
          <p>Trace every handoff from request to final result.</p>
        </div>
        <div className="ledger-filters" role="group" aria-label="Filter device messages by status">
          {LEDGER_FILTERS.map((status) => (
            <button
              type="button"
              key={status}
              className={statusFilter === status ? 'active' : ''}
              aria-pressed={statusFilter === status}
              onClick={() => setStatusFilter(status)}
            >
              <span>{status === 'all' ? 'All' : STATUS_LABEL[status]}</span>
              <small>{ledgerCounts[status]}</small>
            </button>
          ))}
        </div>
      </div>

      {messages.length === 0 ? (
        <div className="ledger-empty">
          <span aria-hidden="true">{ledgerCounts[statusFilter]}</span>
          <strong>No matching messages</strong>
          <p>Try another status, or wait for this phone to receive its next job.</p>
        </div>
      ) : (
        <div className="device-ledger-table">
          {messages.map((message) => (
            <article className={`ledger-row ledger-row-${message.status}`} key={message.id}>
              <div className="ledger-message">
                <strong>{message.phone_number}</strong>
                <p title={message.message_text}>{message.message_text}</p>
                <div className="ledger-meta">
                  <span>Job #{message.id}</span>
                  <span>{message.source || 'Dashboard'}</span>
                </div>
              </div>
              <div className="ledger-result">
                <span className={`ledger-status ${message.status}`}>
                  <i aria-hidden="true" />
                  {STATUS_LABEL[message.status]}
                </span>
              </div>
              <MessageHandoff message={message} />
            </article>
          ))}
        </div>
      )}
    </section>
  </div>;
}

function MessageHandoff({ message }) {
  const steps = [
    ['Requested', message.created_at],
    ['Claimed', message.dispatched_at],
    ['Send started', message.send_started_at],
    [message.status === 'failed' ? 'Failed' : 'Sent', message.delivered_at],
  ];
  return (
    <ol className="handoff-line" aria-label={`Delivery history for job ${message.id}`}>
      {steps.map(([label, time], index) => (
        <li
          className={`${time ? 'complete' : ''} ${label === 'Failed' ? 'error' : ''}`}
          key={`${label}-${index}`}
        >
          <i aria-hidden="true" />
          <div>
            <strong>{label}</strong>
            {time ? (
              <time dateTime={time} title={formatDate(time)}>{formatHandoffTime(time)}</time>
            ) : (
              <span>Waiting</span>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
