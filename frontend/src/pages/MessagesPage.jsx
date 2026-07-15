import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getDevices,
  getMessages,
  normalizeMessagesResponse,
  sendMessage,
} from '../api/client';

const STATUS_COLOR = {
  pending: '#b47a24',
  dispatched: '#68716b',
  sent: '#3ca575',
  failed: '#b33b36',
};
const STATUS_FILTERS = ['all', 'pending', 'dispatched', 'sent', 'failed'];
const PAGE_SIZES = [10, 25, 50];
const EMPTY_PAGINATION = {
  page: 1,
  page_size: 10,
  total: 0,
  total_pages: 0,
  has_previous: false,
  has_next: false,
};

export function getPaginationItems(currentPage, totalPages) {
  if (totalPages <= 0) return [];
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);

  const pages = new Set([1, totalPages, currentPage - 1, currentPage, currentPage + 1]);
  if (currentPage <= 4) [2, 3, 4, 5].forEach(page => pages.add(page));
  if (currentPage >= totalPages - 3) {
    [totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1]
      .forEach(page => pages.add(page));
  }

  const ordered = [...pages]
    .filter(page => page > 0 && page <= totalPages)
    .sort((a, b) => a - b);

  return ordered.flatMap((page, index) => {
    const previous = ordered[index - 1];
    return index > 0 && page - previous > 1 ? [`ellipsis-${previous}`, page] : [page];
  });
}

export default function MessagesPage() {
  const [messages, setMessages] = useState([]);
  const [pagination, setPagination] = useState(EMPTY_PAGINATION);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [phone, setPhone] = useState('');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [hasConnectedDevice, setHasConnectedDevice] = useState(false);
  const [deviceStatusLoaded, setDeviceStatusLoaded] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const requestSequence = useRef(0);
  const hasLoaded = useRef(false);

  const load = useCallback(async () => {
    const requestId = ++requestSequence.current;
    if (hasLoaded.current) setRefreshing(true);
    else setLoading(true);

    const options = { page, pageSize, status: filter };
    try {
      const [messageResult, deviceResult] = await Promise.allSettled([
        getMessages(options),
        getDevices(),
      ]);
      if (requestId !== requestSequence.current) return;

      if (messageResult.status === 'fulfilled') {
        const result = normalizeMessagesResponse(messageResult.value, options);
        const lastPage = Math.max(1, result.pagination.total_pages);

        // Counts can shrink between refreshes. Move back to the final valid
        // page instead of leaving the operator on an empty, out-of-range page.
        if (page > lastPage) {
          setPage(lastPage);
        } else {
          setMessages(result.messages);
          setPagination(result.pagination);
          setLoadError('');
        }
      } else {
        setLoadError(
          messageResult.reason?.response?.data?.error
            ?? 'Message history could not be refreshed. The last loaded page is still shown.',
        );
      }

      if (deviceResult.status === 'fulfilled') {
        setHasConnectedDevice(
          deviceResult.value.some(device => device.is_active !== false && device.dispatch_ready),
        );
        setDeviceStatusLoaded(true);
      }
    } finally {
      if (requestId === requestSequence.current) {
        hasLoaded.current = true;
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [filter, page, pageSize]);

  useEffect(() => {
    load();
    const timer = setInterval(load, 10_000);
    return () => clearInterval(timer);
  }, [load, reloadToken]);

  async function handleSend(event) {
    event.preventDefault();
    setSendError('');
    setSending(true);
    try {
      await sendMessage(phone, text);
      setPhone('');
      setText('');
      if (page !== 1) setPage(1);
      else setReloadToken(token => token + 1);
    } catch (error) {
      setSendError(error.response?.data?.error ?? 'Failed to send');
    } finally {
      setSending(false);
    }
  }

  function selectFilter(nextFilter) {
    if (nextFilter === filter) return;
    setFilter(nextFilter);
    setPage(1);
  }

  function selectPageSize(event) {
    const nextSize = Number(event.target.value);
    setPageSize(nextSize);
    setPage(1);
  }

  const interactionLocked = loading || refreshing;
  const firstShown = pagination.total === 0
    ? 0
    : (pagination.page - 1) * pagination.page_size + 1;
  const lastShown = pagination.total === 0
    ? 0
    : Math.min(pagination.page * pagination.page_size, pagination.total);
  const pageItems = getPaginationItems(pagination.page, pagination.total_pages);

  return (
    <div className="messages-page">
      <h1 style={s.h1}>Messages</h1>

      {deviceStatusLoaded && !hasConnectedDevice ? (
        <section className="sender-unavailable" role="status">
          <span className="sender-unavailable-icon" aria-hidden="true">▯</span>
          <div>
            <p className="eyebrow">Sender unavailable</p>
            <h2>Connect an Android sender to send</h2>
            <p>Open SignalDesk on a paired phone and keep its sender service online. Sending unlocks after the phone begins polling for work.</p>
            <Link to="/devices">Manage devices →</Link>
          </div>
        </section>
      ) : (
        <div style={s.card} className="message-compose-card">
          <div style={s.cardTitle}>Send a Message</div>
          <form onSubmit={handleSend} style={s.form}>
            <input
              style={s.input}
              placeholder="Phone number (e.g. +1234567890)"
              value={phone}
              onChange={event => setPhone(event.target.value)}
              required
            />
            <textarea
              style={{ ...s.input, height: 80, resize: 'vertical' }}
              placeholder="Message text"
              value={text}
              onChange={event => setText(event.target.value)}
              required
            />
            {sendError && <div style={s.error}>{sendError}</div>}
            <button style={s.btn} type="submit" disabled={sending || !hasConnectedDevice}>
              {sending ? 'Sending…' : 'Send Message'}
            </button>
          </form>
        </div>
      )}

      <div className="message-ledger-toolbar">
        <div className="message-status-filters" aria-label="Filter messages by status">
          {STATUS_FILTERS.map(status => (
            <button
              key={status}
              type="button"
              onClick={() => selectFilter(status)}
              className={filter === status ? 'active' : ''}
              aria-pressed={filter === status}
              disabled={interactionLocked}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
        <span className="message-refresh-state" role="status" aria-live="polite">
          {refreshing ? 'Refreshing…' : 'Updates every 10 seconds'}
        </span>
      </div>

      <section
        style={s.card}
        className={`message-ledger-card${refreshing ? ' is-refreshing' : ''}`}
        aria-busy={interactionLocked}
      >
        {loadError && <p className="message-load-error" role="alert">{loadError}</p>}
        {loading ? (
          <div className="message-loading" role="status">
            <span aria-hidden="true" />
            <p>Loading message history…</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="message-empty">
            <strong>No messages found</strong>
            <p>{filter === 'all' ? 'New messages will appear here after you send them.' : `No matching ${filter} messages are currently recorded.`}</p>
          </div>
        ) : (
          <div className="message-table-scroll">
            <table style={s.table}>
              <thead>
                <tr>
                  {['Phone', 'Message', 'Status', 'Device', 'Delivery history'].map(heading => (
                    <th key={heading} style={s.th}>{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {messages.map(message => (
                  <tr key={message.id} style={s.tr}>
                    <td style={s.td}>{message.phone_number}</td>
                    <td style={{ ...s.td, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{message.message_text}</td>
                    <td style={s.td}>
                      <span style={{ ...s.badge, background: `${STATUS_COLOR[message.status]}20`, color: STATUS_COLOR[message.status] }}>
                        {message.status}
                      </span>
                    </td>
                    <td style={{ ...s.td, fontSize: 12 }}>
                      {message.device ? (
                        <>
                          <Link to={`/devices/${message.device.id}`} style={{ color: 'var(--accent)', fontWeight: 750, textDecoration: 'none' }}>{message.device.name}</Link>
                          <br />
                          <span style={{ color: 'var(--muted)' }}>{message.device.model}</span>
                        </>
                      ) : <span style={{ color: 'var(--muted)' }}>Waiting</span>}
                    </td>
                    <td style={{ ...s.td, minWidth: 245 }}><MessageTimeline message={message} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="message-pagination-bar">
          <p aria-live="polite">
            Showing <strong>{firstShown.toLocaleString()}–{lastShown.toLocaleString()}</strong> of <strong>{pagination.total.toLocaleString()}</strong>
          </p>

          <label className="message-page-size">
            <span>Rows per page</span>
            <select value={pageSize} onChange={selectPageSize} disabled={interactionLocked}>
              {PAGE_SIZES.map(size => <option key={size} value={size}>{size}</option>)}
            </select>
          </label>

          <nav className="message-page-controls" aria-label="Message history pages">
            <button
              type="button"
              className="page-direction"
              onClick={() => setPage(current => current - 1)}
              disabled={interactionLocked || !pagination.has_previous}
              aria-label="Previous page"
            >
              <span aria-hidden="true">←</span><span>Previous</span>
            </button>

            <div className="message-page-numbers">
              {pageItems.map(item => typeof item === 'string' ? (
                <span key={item} className="page-ellipsis" aria-hidden="true">…</span>
              ) : (
                <button
                  key={item}
                  type="button"
                  onClick={() => setPage(item)}
                  className={item === pagination.page ? 'active' : ''}
                  aria-label={`Page ${item}`}
                  aria-current={item === pagination.page ? 'page' : undefined}
                  disabled={interactionLocked || item === pagination.page}
                >
                  {item}
                </button>
              ))}
            </div>

            <button
              type="button"
              className="page-direction"
              onClick={() => setPage(current => current + 1)}
              disabled={interactionLocked || !pagination.has_next}
              aria-label="Next page"
            >
              <span>Next</span><span aria-hidden="true">→</span>
            </button>
          </nav>
        </div>
      </section>
    </div>
  );
}

function MessageTimeline({ message }) {
  const finalLabel = message.status === 'failed' ? 'Send failed' : 'Successfully sent';
  const items = [
    ['Requested', message.created_at],
    ['Phone received job', message.dispatched_at],
    ['Phone started sending', message.send_started_at],
    [finalLabel, message.delivered_at],
  ];

  return (
    <div style={s.timeline}>
      {items.map(([label, time]) => (
        <div key={label} style={{ ...s.timelineItem, opacity: time ? 1 : 0.45 }}>
          <span style={{ ...s.timelineDot, background: time ? (label === 'Send failed' ? 'var(--danger)' : '#3ca575') : 'var(--line)' }} />
          <div>
            <strong>{label}</strong>
            <small style={{ display: 'block', color: 'var(--muted)' }}>{time ? new Date(time).toLocaleString() : 'Waiting'}</small>
          </div>
        </div>
      ))}
    </div>
  );
}

const s = {
  h1: { fontSize: 24, fontWeight: 700, color: 'var(--ink)', marginBottom: 24, marginTop: 0 },
  card: { background: 'var(--surface)', borderRadius: 12, padding: '20px 24px', boxShadow: 'var(--shadow)', marginBottom: 20, border: '1px solid var(--line)' },
  cardTitle: { fontWeight: 600, fontSize: 15, color: 'var(--ink)', marginBottom: 16 },
  form: { display: 'flex', flexDirection: 'column', gap: 12 },
  input: { padding: '10px 14px', border: '1px solid var(--line)', borderRadius: 8, fontSize: 14, outline: 'none', width: '100%', boxSizing: 'border-box', background: 'var(--bg)', color: 'var(--ink)' },
  btn: { padding: '10px 20px', background: 'var(--accent)', color: 'var(--surface)', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: 14, alignSelf: 'flex-start' },
  error: { color: 'var(--danger)', fontSize: 13 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 14 },
  th: { padding: '10px 12px', textAlign: 'left', color: 'var(--muted)', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.07em', borderBottom: '1px solid var(--line)' },
  tr: { borderBottom: '1px solid var(--line)' },
  td: { padding: '14px 12px', color: 'var(--ink)' },
  badge: { padding: '4px 9px', borderRadius: 99, fontSize: 11, fontWeight: 750, textTransform: 'capitalize' },
  timeline: { display: 'grid', gap: 7 },
  timelineItem: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 },
  timelineDot: { width: 7, height: 7, borderRadius: '50%', flex: '0 0 auto' },
};
