import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getApiKeyDetails } from '../api/client';

const STATUS_LABEL = {
  pending: 'Queued',
  dispatched: 'With phone',
  sent: 'Sent',
  failed: 'Failed',
};

function count(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : 'Never';
}

export default function ApiKeyDetailsPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const load = useCallback(async () => {
    try {
      setData(await getApiKeyDetails(id));
      setError('');
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Could not load this API key.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, [load]);

  const apiKey = data?.api_key || data?.key;
  const rawStats = data?.stats || {};
  const stats = useMemo(() => ({
    requests: count(rawStats.authenticated_requests ?? rawStats.requests ?? apiKey?.usage_count),
    messages: count(rawStats.message_count ?? rawStats.messages ?? rawStats.queued),
    sent: count(rawStats.sent ?? rawStats.sent_count),
    failed: count(rawStats.failed ?? rawStats.failed_count),
    pending: count(rawStats.pending ?? rawStats.pending_count),
    dispatched: count(rawStats.dispatched ?? rawStats.dispatched_count),
    inProgress: count(rawStats.in_progress ?? rawStats.in_progress_count ?? (count(rawStats.pending) + count(rawStats.dispatched))),
    sentToday: count(rawStats.sent_today),
    successRate: rawStats.success_rate == null ? null : count(rawStats.success_rate),
  }), [apiKey?.usage_count, rawStats]);

  const days = useMemo(() => (Array.isArray(data?.daily_activity) ? data.daily_activity : []).map((day) => ({
    date: day.date,
    queued: count(day.queued ?? day.messages ?? day.message_count),
    sent: count(day.sent),
    failed: count(day.failed),
  })), [data]);

  const messages = useMemo(() => {
    const records = Array.isArray(data?.messages) ? data.messages : [];
    if (statusFilter === 'all') return records;
    if (statusFilter === 'in_progress') return records.filter((message) => message.status === 'pending' || message.status === 'dispatched');
    return records.filter((message) => message.status === statusFilter);
  }, [data, statusFilter]);

  if (loading) return <div className="device-detail-state" role="status"><span className="detail-loader" /><p>Reading API key activity...</p></div>;
  if (error || !data || !apiKey) return <div className="device-detail-state"><strong>{error || 'API key not found.'}</strong><Link to="/api">Return to API reference</Link></div>;

  const maxActivity = Math.max(1, ...days.map((day) => day.queued));
  const funnelMax = Math.max(1, stats.requests, stats.messages, stats.sent);
  const funnel = [
    ['Authenticated requests', stats.requests, 'Every call accepted by this credential'],
    ['Messages queued', stats.messages, 'Valid calls that created an SMS job'],
    ['Messages sent', stats.sent, 'Jobs completed by an Android phone'],
  ];

  return <div className="api-key-detail-page">
    <header className="api-key-detail-header">
      <div>
        <Link className="detail-back" to="/api">&larr; API reference</Link>
        <p className="eyebrow">API credential &middot; #{apiKey.id}</p>
        <h1>{apiKey.name}</h1>
        <p>Request and delivery activity attributed to this credential.</p>
      </div>
      <div className={`api-key-recency ${apiKey.last_used_at ? 'used' : ''}`}>
        <i />
        <span><small>Last authenticated request</small>{formatDate(apiKey.last_used_at)}</span>
      </div>
    </header>

    <section className="api-key-facts" aria-label="API key information">
      <div><span>Credential</span><code title={apiKey.key_hint}>{apiKey.key_hint || 'Unavailable'}</code></div>
      <div><span>Created</span><strong>{formatDate(apiKey.created_at)}</strong></div>
      <div><span>Authenticated requests</span><strong>{stats.requests.toLocaleString()}</strong></div>
      <div><span>Messages accepted</span><strong>{stats.messages.toLocaleString()}</strong></div>
    </section>

    <section className="api-key-performance">
      <div className="api-key-performance-copy">
        <p className="eyebrow">Delivery outcome</p>
        <h2>{stats.sent.toLocaleString()} messages sent</h2>
        <p>Only messages created with this key are counted. Requests can be higher when a call has an invalid body or no sender is available.</p>
        <dl>
          <div><dt>Success rate</dt><dd>{stats.successRate == null ? '-' : `${stats.successRate}%`}</dd></div>
          <div><dt>Sent today</dt><dd>{stats.sentToday.toLocaleString()}</dd></div>
          <div><dt>Failed</dt><dd>{stats.failed.toLocaleString()}</dd></div>
          <div><dt>In progress</dt><dd>{stats.inProgress.toLocaleString()}</dd></div>
        </dl>
      </div>

      <div className="api-request-funnel" aria-label="Authenticated request to sent message funnel">
        <div className="funnel-heading"><div><p className="eyebrow">Request funnel</p><h3>From API call to handset</h3></div><span>{stats.messages > 0 ? `${Math.round((stats.sent / stats.messages) * 100)}% sent` : 'No messages yet'}</span></div>
        <ol>
          {funnel.map(([label, value, description], index) => <li key={label}>
            <div><span>{String(index + 1).padStart(2, '0')}</span><strong>{label}</strong><b>{value.toLocaleString()}</b></div>
            <div className="funnel-track"><i style={{ width: `${Math.max(value ? 3 : 0, (value / funnelMax) * 100)}%` }} /></div>
            <small>{description}</small>
          </li>)}
        </ol>
      </div>
    </section>

    <section className="api-key-activity">
      <div>
        <p className="eyebrow">Seven-day activity</p>
        <h2>Messages accepted by day</h2>
        <p>Sent and failed outcomes may complete after the day a message entered the queue.</p>
      </div>
      {days.length === 0 ? <div className="api-activity-empty">Activity will appear after this key queues its first message.</div> : <div className="api-activity-chart" aria-label="Seven day queued, sent, and failed API key activity">
        <div className="chart-key"><span><i className="accepted" />Accepted</span><span><i className="sent" />Sent</span><span><i className="failed" />Failed</span></div>
        <div className="api-activity-bars">{days.map((day) => <div className="api-activity-day" key={day.date} title={`${day.queued} accepted - ${day.sent} sent - ${day.failed} failed`}>
          <strong>{day.queued}</strong>
          <div className="api-bar-group"><i className="accepted" style={{ height: `${(day.queued / maxActivity) * 100}%` }} /><i className="sent" style={{ height: `${(day.sent / maxActivity) * 100}%` }} /><i className="failed" style={{ height: `${(day.failed / maxActivity) * 100}%` }} /></div>
          <span>{new Date(`${day.date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short' })}</span>
        </div>)}</div>
      </div>}
    </section>

    <section className="api-key-ledger">
      <div className="ledger-heading">
        <div><p className="eyebrow">Message ledger</p><h2>Recent API activity</h2><p>Up to 100 recent messages created with this credential.</p></div>
        <div className="ledger-filters" aria-label="Filter messages by status">
          {['all', 'sent', 'failed', 'in_progress'].map((status) => <button type="button" key={status} aria-pressed={statusFilter === status} className={statusFilter === status ? 'active' : ''} onClick={() => setStatusFilter(status)}>{status === 'all' ? 'All' : status === 'in_progress' ? 'In progress' : STATUS_LABEL[status]}</button>)}
        </div>
      </div>
      {messages.length === 0 ? <div className="ledger-empty"><strong>No matching messages</strong><p>Messages sent through this key will appear here with their phone handoff history.</p></div> : <div className="api-key-ledger-table">
        <div className="api-key-ledger-row api-key-ledger-head"><span>Recipient &amp; message</span><span>Outcome</span><span>Android sender</span><span>Delivery history</span></div>
        {messages.map((message) => <article className="api-key-ledger-row" key={message.id}>
          <div className="ledger-message"><strong>{message.phone_number}</strong><p title={message.message_text}>{message.message_text}</p><small title={message.public_id || undefined}>Message {message.public_id || `#${message.id}`}</small></div>
          <div><span className={`ledger-status ${message.status}`}>{STATUS_LABEL[message.status] || message.status}</span></div>
          <div className="api-message-device">{message.device ? <><Link to={`/devices/${message.device.id}`}>{message.device.name}</Link><small>{message.device.model || 'Model unavailable'}</small></> : <><strong>Not assigned</strong><small>Waiting for a sender</small></>}</div>
          <MessageHandoff message={message} />
        </article>)}
      </div>}
    </section>
  </div>;
}

function MessageHandoff({ message }) {
  const finalLabel = message.status === 'failed' ? 'Failed' : 'Sent';
  const steps = [
    ['Requested', message.created_at],
    ['Phone received', message.dispatched_at],
    ['Send started', message.send_started_at],
    [finalLabel, message.completed_at || message.delivered_at],
  ];

  return <ol className="handoff-line">{steps.map(([label, time], index) => <li className={`${time ? 'complete' : ''} ${label === 'Failed' ? 'error' : ''}`} key={`${label}-${index}`}><i /><div><strong>{label}</strong><span>{time ? new Date(time).toLocaleString() : 'Waiting'}</span></div></li>)}</ol>;
}
