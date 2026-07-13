import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getDevices, getMessages, sendMessage } from '../api/client';

const STATUS_COLOR = { pending: '#f59e0b', dispatched: '#6366f1', sent: '#22c55e', failed: '#ef4444' };

export default function MessagesPage() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [phone, setPhone] = useState('');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [filter, setFilter] = useState('all');
  const [hasConnectedDevice, setHasConnectedDevice] = useState(false);
  const [deviceStatusLoaded, setDeviceStatusLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const [messageResult, deviceResult] = await Promise.allSettled([getMessages(), getDevices()]);
      if (messageResult.status === 'fulfilled') setMessages(messageResult.value);
      if (deviceResult.status === 'fulfilled') {
        setHasConnectedDevice(deviceResult.value.some(device => device.is_active !== false && device.is_connected));
        setDeviceStatusLoaded(true);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); const t = setInterval(load, 10000); return () => clearInterval(t); }, [load]);

  async function handleSend(e) {
    e.preventDefault();
    setSendError('');
    setSending(true);
    try {
      await sendMessage(phone, text);
      setPhone('');
      setText('');
      await load();
    } catch (err) {
      setSendError(err.response?.data?.error ?? 'Failed to send');
    } finally {
      setSending(false);
    }
  }

  const filtered = filter === 'all' ? messages : messages.filter(m => m.status === filter);

  return (
    <div>
      <h1 style={s.h1}>Messages</h1>

      {/* Send form */}
      {deviceStatusLoaded && !hasConnectedDevice ? (
        <section className="sender-unavailable" role="status">
          <span className="sender-unavailable-icon">▯</span>
          <div><p className="eyebrow">Sender unavailable</p><h2>Connect an Android phone to send</h2><p>Open SignalDesk on a paired phone and keep it online. Sending will unlock automatically when the device checks in.</p><Link to="/devices">Manage devices →</Link></div>
        </section>
      ) : <div style={s.card}>
        <div style={s.cardTitle}>Send a Message</div>
        <form onSubmit={handleSend} style={s.form}>
          <input
            style={s.input}
            placeholder="Phone number (e.g. +1234567890)"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            required
          />
          <textarea
            style={{ ...s.input, height: 80, resize: 'vertical' }}
            placeholder="Message text"
            value={text}
            onChange={e => setText(e.target.value)}
            required
          />
          {sendError && <div style={s.error}>{sendError}</div>}
          <button style={s.btn} type="submit" disabled={sending || !hasConnectedDevice}>
            {sending ? 'Sending…' : 'Send Message'}
          </button>
        </form>
      </div>}

      {/* Filters */}
      <div style={s.filters}>
        {['all', 'pending', 'dispatched', 'sent', 'failed'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{ ...s.filterBtn, ...(filter === f ? s.filterBtnActive : {}) }}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Table */}
      <div style={s.card}>
        {loading ? (
          <p style={{ color: '#94a3b8' }}>Loading…</p>
        ) : filtered.length === 0 ? (
          <p style={{ color: '#94a3b8' }}>No messages found.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={s.table}>
              <thead>
                <tr>
                  {['Phone', 'Message', 'Status', 'Device', 'Delivery history'].map(h => (
                    <th key={h} style={s.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(m => (
                  <tr key={m.id} style={s.tr}>
                    <td style={s.td}>{m.phone_number}</td>
                    <td style={{ ...s.td, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.message_text}</td>
                    <td style={s.td}>
                      <span style={{ ...s.badge, background: STATUS_COLOR[m.status] + '20', color: STATUS_COLOR[m.status] }}>
                        {m.status}
                      </span>
                    </td>
                    <td style={{ ...s.td, fontSize: 12 }}>{m.device ? <><Link to={`/devices/${m.device.id}`} style={{ color: 'var(--accent)', fontWeight: 750, textDecoration: 'none' }}>{m.device.name}</Link><br/><span style={{ color: '#94a3b8' }}>{m.device.model}</span></> : <span style={{ color: '#94a3b8' }}>Waiting</span>}</td>
                    <td style={{ ...s.td, minWidth: 245 }}><MessageTimeline message={m} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function MessageTimeline({ message }) {
  const finalLabel = message.status === 'failed' ? 'Send failed' : 'Successfully sent';
  const items = [['Requested', message.created_at], ['Phone received job', message.dispatched_at], ['Phone started sending', message.send_started_at], [finalLabel, message.delivered_at]];
  return <div style={s.timeline}>{items.map(([label, time]) => <div key={label} style={{ ...s.timelineItem, opacity: time ? 1 : .45 }}><span style={{ ...s.timelineDot, background: time ? (label === 'Send failed' ? '#ef4444' : '#22c55e') : '#cbd5e1' }} /><div><strong>{label}</strong><small style={{ display: 'block', color: '#94a3b8' }}>{time ? new Date(time).toLocaleString() : 'Waiting'}</small></div></div>)}</div>;
}

const s = {
  h1: { fontSize: 24, fontWeight: 700, color: '#1e293b', marginBottom: 24, marginTop: 0 },
  card: { background: '#fff', borderRadius: 12, padding: '20px 24px', boxShadow: '0 1px 4px rgba(0,0,0,.08)', marginBottom: 20 },
  cardTitle: { fontWeight: 600, fontSize: 15, color: '#1e293b', marginBottom: 16 },
  form: { display: 'flex', flexDirection: 'column', gap: 12 },
  input: { padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, outline: 'none', width: '100%', boxSizing: 'border-box' },
  btn: { padding: '10px 20px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: 14, alignSelf: 'flex-start' },
  error: { color: '#ef4444', fontSize: 13 },
  filters: { display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' },
  filterBtn: { padding: '6px 14px', border: '1px solid #e2e8f0', borderRadius: 99, fontSize: 13, cursor: 'pointer', background: '#fff', color: '#64748b' },
  filterBtnActive: { background: '#6366f1', color: '#fff', borderColor: '#6366f1' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 14 },
  th: { padding: '10px 12px', textAlign: 'left', color: '#94a3b8', fontWeight: 600, fontSize: 12, textTransform: 'uppercase', letterSpacing: '.5px', borderBottom: '1px solid #f1f5f9' },
  tr: { borderBottom: '1px solid #f8fafc' },
  td: { padding: '12px', color: '#1e293b' },
  badge: { padding: '3px 10px', borderRadius: 99, fontSize: 12, fontWeight: 600 },
  timeline: { display: 'grid', gap: 7 },
  timelineItem: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 },
  timelineDot: { width: 7, height: 7, borderRadius: '50%', flex: '0 0 auto' },
};
