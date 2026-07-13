import React from 'react';

const STATUS_COLORS = {
  pending: 'yellow',
  dispatched: '#3b82f6',
  sent: 'green',
  failed: 'red',
};

const STATUS_CLASS = {
  pending: 'status-badge status-pending',
  dispatched: 'status-badge status-dispatched',
  sent: 'status-badge status-sent',
  failed: 'status-badge status-failed',
};

function MessageTable({ messages }) {
  return (
    <div className="table-card">
      <h2>Messages ({messages.length})</h2>

      {messages.length === 0 ? (
        <p className="empty-state">No messages yet. Send one above!</p>
      ) : (
        <table className="messages-table">
          <thead>
            <tr>
              <th>Phone Number</th>
              <th>Message Text</th>
              <th>Status</th>
              <th>Delivered At</th>
              <th>Updated At</th>
              <th>Created At</th>
            </tr>
          </thead>
          <tbody>
            {messages.map((message) => (
              <tr key={message.id}>
                <td style={{ fontFamily: 'monospace' }}>{message.phone_number}</td>
                <td>{message.message_text}</td>
                <td
                  // keep inline backgroundColor for the property tests that check it
                  data-testid="status-cell"
                  style={{ backgroundColor: STATUS_COLORS[message.status] || 'transparent' }}
                >
                  <span className={STATUS_CLASS[message.status] || 'status-badge'}>
                    {message.status}
                  </span>
                </td>
                <td style={{ color: '#9ca3af', fontSize: '0.85rem' }}>
                  {message.delivered_at ? new Date(message.delivered_at).toLocaleString() : '—'}
                </td>
                <td style={{ color: '#9ca3af', fontSize: '0.85rem' }}>
                  {message.updated_at ? new Date(message.updated_at).toLocaleString() : '—'}
                </td>
                <td style={{ color: '#9ca3af', fontSize: '0.85rem' }}>
                  {new Date(message.created_at).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default MessageTable;
